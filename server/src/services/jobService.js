import { dbRun, dbGet, dbAll, audioDir } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import chunkService from './chunkService.js';
import ttsService from './ttsService.js';
import audioService from './audioService.js';
import { SYSTEM_LIMITS } from '../config/constants.js';

class JobService {
  constructor() {
    this.activeJobs = new Map(); // Lưu trữ cờ huỷ và trạng thái runtime
  }

  /**
   * Tạo một job mới để xử lý văn bản dài
   */
  async createJob({ title, text, voiceId, speed = 1.0, pitch = 0.0, userId = null }) {
    // 1. Kiểm tra giới hạn 50.000 ký tự
    const validation = chunkService.validateTextLength(text);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // 2. Kiểm tra thông tin giọng đọc
    const voice = ttsService.findVoiceById(voiceId);
    if (!voice) {
      throw new Error(`Giọng đọc '${voiceId}' không tồn tại trong hệ thống.`);
    }

    // 3. Phân chia văn bản thành các đoạn nhỏ
    const chunks = chunkService.splitIntoChunks(text);
    if (chunks.length === 0) {
      throw new Error('Không thể phân tách văn bản thành các đoạn hợp lệ.');
    }

    const jobId = uuidv4();
    const jobTitle = title && title.trim() ? title.trim() : `Văn bản audio - ${new Date().toLocaleDateString('vi-VN')}`;

    // 4. Lưu job vào database
    await dbRun(
      `INSERT INTO tts_jobs (id, user_id, title, total_chars, total_chunks, completed_chunks, failed_chunks, status, provider, voice_id, speed, pitch)
       VALUES (?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?, ?, ?)`,
      [jobId, userId, jobTitle, text.length, chunks.length, voice.provider, voice.id, speed, pitch]
    );

    // 5. Lưu các chunks vào database
    for (const chunk of chunks) {
      const chunkId = uuidv4();
      await dbRun(
        `INSERT INTO tts_chunks (id, job_id, chunk_index, text, char_count, status, retry_count)
         VALUES (?, ?, ?, ?, ?, 'pending', 0)`,
        [chunkId, jobId, chunk.index, chunk.text, chunk.charCount]
      );
    }

    // Khởi chạy tiến trình xử lý bất đồng bộ trong nền
    this.startJobProcessing(jobId);

    return {
      id: jobId,
      title: jobTitle,
      totalChars: text.length,
      totalChunks: chunks.length,
      status: 'pending',
      voice: {
        id: voice.id,
        name: voice.name,
        provider: voice.provider,
      },
    };
  }

  /**
   * Khởi chạy vòng lặp xử lý các chunks của job với kiểm soát đồng thời
   */
  async startJobProcessing(jobId) {
    this.activeJobs.set(jobId, { isCancelled: false });

    // Cập nhật trạng thái job sang 'processing'
    await dbRun(`UPDATE tts_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [jobId]);

    try {
      const job = await dbGet(`SELECT * FROM tts_jobs WHERE id = ?`, [jobId]);
      if (!job) return;

      const concurrency = SYSTEM_LIMITS.CONCURRENT_CHUNK_LIMIT || 2;
      let hasError = false;

      // Lấy danh sách các chunk chưa hoàn thành
      const pendingChunks = await dbAll(
        `SELECT * FROM tts_chunks WHERE job_id = ? AND status != 'completed' ORDER BY chunk_index ASC`,
        [jobId]
      );

      // Xử lý các chunk theo từng nhóm đồng thời
      for (let i = 0; i < pendingChunks.length; i += concurrency) {
        // Kiểm tra nếu job đã bị hủy
        const runtime = this.activeJobs.get(jobId);
        if (runtime && runtime.isCancelled) {
          await dbRun(`UPDATE tts_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [jobId]);
          this.activeJobs.delete(jobId);
          return;
        }

        const batch = pendingChunks.slice(i, i + concurrency);
        const promises = batch.map((chunk) => this.processSingleChunk(job, chunk));
        const results = await Promise.allSettled(promises);

        for (const res of results) {
          if (res.status === 'rejected') {
            hasError = true;
          }
        }
      }

      // Kiểm tra lại trạng thái sau khi chạy xong tất cả
      const updatedJob = await dbGet(`SELECT * FROM tts_jobs WHERE id = ?`, [jobId]);
      const runtime = this.activeJobs.get(jobId);
      if (runtime && runtime.isCancelled) {
        await dbRun(`UPDATE tts_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [jobId]);
        this.activeJobs.delete(jobId);
        return;
      }

      const allChunks = await dbAll(
        `SELECT * FROM tts_chunks WHERE job_id = ? ORDER BY chunk_index ASC`,
        [jobId]
      );

      const allCompleted = allChunks.every((c) => c.status === 'completed');
      if (allCompleted) {
        // Thử ghép các file audio thành 1 file MP3 hợp nhất
        try {
          const filePaths = allChunks.map((c) => c.audio_path).filter(Boolean);
          const ext = job.provider === 'demo' ? 'wav' : 'mp3';
          const mergedFileName = `job_${jobId}_full.${ext}`;
          const mergedPath = path.join(audioDir, mergedFileName);

          await audioService.mergeAudioFiles(filePaths, mergedPath);

          await dbRun(
            `UPDATE tts_jobs SET status = 'completed', merged_audio_path = ?, merged_audio_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [mergedPath, `/audio/${mergedFileName}`, jobId]
          );
        } catch (mergeErr) {
          console.warn(`[JobService] Lỗi khi ghép file audio cho job ${jobId}:`, mergeErr.message);
          // Vẫn đánh dấu completed vì người dùng có thể nghe theo playlist từng đoạn
          await dbRun(
            `UPDATE tts_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [jobId]
          );
        }
      } else {
        await dbRun(
          `UPDATE tts_jobs SET status = 'failed', error_message = 'Một hoặc nhiều đoạn văn bản gặp lỗi khi tạo audio', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [jobId]
        );
      }
    } catch (err) {
      console.error(`[JobService] Lỗi nghiêm trọng khi xử lý job ${jobId}:`, err);
      await dbRun(
        `UPDATE tts_jobs SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [err.message, jobId]
      );
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Xử lý tạo audio cho một chunk cụ thể
   */
  async processSingleChunk(job, chunk) {
    // Đánh dấu chunk đang xử lý
    await dbRun(`UPDATE tts_chunks SET status = 'processing' WHERE id = ?`, [chunk.id]);

    try {
      const result = await ttsService.synthesizeChunk({
        chunkText: chunk.text,
        voiceId: job.voice_id,
        speed: job.speed,
        pitch: job.pitch,
        jobId: job.id,
        chunkIndex: chunk.chunk_index,
      });

      // Cập nhật chunk thành công
      await dbRun(
        `UPDATE tts_chunks SET status = 'completed', audio_path = ?, audio_url = ?, duration = ?, error_message = NULL WHERE id = ?`,
        [result.audioPath, result.audioUrl, result.duration, chunk.id]
      );

      // Cập nhật số lượng completed_chunks của job
      await dbRun(
        `UPDATE tts_jobs SET completed_chunks = completed_chunks + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [job.id]
      );

      return result;
    } catch (err) {
      console.warn(`[JobService] Thất bại tại chunk ${chunk.chunk_index} của job ${job.id}:`, err.message);

      await dbRun(
        `UPDATE tts_chunks SET status = 'failed', error_message = ?, retry_count = retry_count + 1 WHERE id = ?`,
        [err.message, chunk.id]
      );

      await dbRun(
        `UPDATE tts_jobs SET failed_chunks = failed_chunks + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [job.id]
      );

      throw err;
    }
  }

  /**
   * Thử lại một chunk bị lỗi mà không phải làm lại toàn bộ job
   */
  async retryChunk(chunkId) {
    const chunk = await dbGet(`SELECT * FROM tts_chunks WHERE id = ?`, [chunkId]);
    if (!chunk) {
      throw new Error('Không tìm thấy đoạn âm thanh yêu cầu.');
    }

    const job = await dbGet(`SELECT * FROM tts_jobs WHERE id = ?`, [chunk.job_id]);
    if (!job) {
      throw new Error('Không tìm thấy tác vụ tương ứng.');
    }

    // Trừ 1 ở failed_chunks nếu trước đó là failed
    if (chunk.status === 'failed') {
      await dbRun(
        `UPDATE tts_jobs SET failed_chunks = MAX(0, failed_chunks - 1) WHERE id = ?`,
        [job.id]
      );
    }

    const result = await this.processSingleChunk(job, chunk);

    // Kiểm tra xem tất cả các chunk đã completed chưa để hoàn tất job
    const remainingFailed = await dbGet(
      `SELECT COUNT(*) as count FROM tts_chunks WHERE job_id = ? AND status != 'completed'`,
      [job.id]
    );

    if (remainingFailed.count === 0) {
      const allChunks = await dbAll(
        `SELECT * FROM tts_chunks WHERE job_id = ? ORDER BY chunk_index ASC`,
        [job.id]
      );
      try {
        const filePaths = allChunks.map((c) => c.audio_path).filter(Boolean);
        const ext = job.provider === 'demo' ? 'wav' : 'mp3';
        const mergedFileName = `job_${job.id}_full.${ext}`;
        const mergedPath = path.join(audioDir, mergedFileName);

        await audioService.mergeAudioFiles(filePaths, mergedPath);

        await dbRun(
          `UPDATE tts_jobs SET status = 'completed', merged_audio_path = ?, merged_audio_url = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [mergedPath, `/audio/${mergedFileName}`, job.id]
        );
      } catch (e) {
        await dbRun(
          `UPDATE tts_jobs SET status = 'completed', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [job.id]
        );
      }
    }

    return result;
  }

  /**
   * Hủy một tác vụ đang chạy
   */
  async cancelJob(jobId) {
    const job = await dbGet(`SELECT * FROM tts_jobs WHERE id = ?`, [jobId]);
    if (!job) {
      throw new Error('Không tìm thấy tác vụ.');
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return { success: true, message: `Tác vụ đã ở trạng thái ${job.status}` };
    }

    // Đặt cờ huỷ trong bộ nhớ
    const runtime = this.activeJobs.get(jobId);
    if (runtime) {
      runtime.isCancelled = true;
    }

    await dbRun(`UPDATE tts_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [jobId]);

    return {
      success: true,
      message: 'Đã hủy tác vụ chuyển đổi âm thanh thành công.',
    };
  }

  /**
   * Lấy chi tiết thông tin và tiến trình của một job
   */
  async getJobDetails(jobId) {
    const job = await dbGet(`SELECT * FROM tts_jobs WHERE id = ?`, [jobId]);
    if (!job) {
      throw new Error('Không tìm thấy tác vụ.');
    }

    const chunks = await dbAll(
      `SELECT id, chunk_index, text, char_count, status, audio_url, duration, retry_count, error_message
       FROM tts_chunks WHERE job_id = ? ORDER BY chunk_index ASC`,
      [jobId]
    );

    const voice = ttsService.findVoiceById(job.voice_id) || {
      id: job.voice_id,
      name: job.voice_id,
      provider: job.provider,
    };

    const percent = job.total_chunks > 0 ? Math.round((job.completed_chunks / job.total_chunks) * 100) : 0;
    const totalDuration = chunks.reduce((acc, c) => acc + (c.duration || 0), 0);

    return {
      id: job.id,
      title: job.title,
      totalChars: job.total_chars,
      totalChunks: job.total_chunks,
      completedChunks: job.completed_chunks,
      failedChunks: job.failed_chunks,
      percentage: percent,
      status: job.status,
      provider: job.provider,
      speed: job.speed,
      pitch: job.pitch,
      mergedAudioUrl: job.merged_audio_url,
      totalDuration: Math.round(totalDuration * 10) / 10,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      voice,
      chunks,
    };
  }
}

export const jobService = new JobService();
export default jobService;
