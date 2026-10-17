import fs from 'fs';
import path from 'path';
import database from '../db/database.js';

class AudioService {
  /**
   * Ghép các đoạn audio thành một file âm thanh hoàn chỉnh
   * @param {Array<string>} filePaths Danh sách đường dẫn file audio các đoạn
   * @param {string} outputPath Đường dẫn file đầu ra
   * @returns {Promise<{ success: boolean, outputPath: string, sizeBytes: number }>}
   */
  async mergeAudioFiles(filePaths, outputPath) {
    if (!filePaths || filePaths.length === 0) {
      throw new Error('Danh sách file audio để ghép trống.');
    }

    if (filePaths.length === 1) {
      // Chỉ có 1 file, copy trực tiếp
      await fs.promises.copyFile(filePaths[0], outputPath);
      const stat = await fs.promises.stat(outputPath);
      return { success: true, outputPath, sizeBytes: stat.size };
    }

    // Kiểm tra định dạng của file đầu tiên
    const firstExt = path.extname(filePaths[0]).toLowerCase();

    if (firstExt === '.wav') {
      return this.mergeWavFiles(filePaths, outputPath);
    } else {
      // Đối với MP3, ghép các buffer frame MP3
      return this.mergeMp3Files(filePaths, outputPath);
    }
  }

  /**
   * Ghép các file MP3 bằng cách nối chuỗi buffer MP3 frames
   */
  async mergeMp3Files(filePaths, outputPath) {
    const buffers = [];
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        const buf = await fs.promises.readFile(filePath);
        // Bỏ qua ID3v2 tag ở đầu file nếu có (bắt đầu bằng 'ID3')
        if (buf.length > 10 && buf.toString('utf8', 0, 3) === 'ID3') {
          // Kích thước ID3v2 tag được mã hóa ở 4 byte từ vị trí 6
          const tagSize =
            ((buf[6] & 0x7f) << 21) |
            ((buf[7] & 0x7f) << 14) |
            ((buf[8] & 0x7f) << 7) |
            (buf[9] & 0x7f);
          const totalHeaderSize = 10 + tagSize;
          if (buf.length > totalHeaderSize) {
            buffers.push(buf.subarray(totalHeaderSize));
            continue;
          }
        }
        buffers.push(buf);
      }
    }

    if (buffers.length === 0) {
      throw new Error('Không có dữ liệu âm thanh hợp lệ để ghép.');
    }

    const mergedBuffer = Buffer.concat(buffers);
    await fs.promises.writeFile(outputPath, mergedBuffer);
    const stat = await fs.promises.stat(outputPath);

    return {
      success: true,
      outputPath,
      sizeBytes: stat.size,
    };
  }

  /**
   * Ghép các file WAV chuẩn PCM
   */
  async mergeWavFiles(filePaths, outputPath) {
    const pcmChunks = [];
    let sampleRate = 22050;
    let numChannels = 1;
    let bitsPerSample = 16;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      if (fs.existsSync(filePath)) {
        const buf = await fs.promises.readFile(filePath);
        if (buf.length > 44) {
          if (i === 0) {
            numChannels = buf.readUInt16LE(22);
            sampleRate = buf.readUInt32LE(24);
            bitsPerSample = buf.readUInt16LE(34);
          }
          // Phần PCM data bắt đầu sau 44 byte header tiêu chuẩn
          pcmChunks.push(buf.subarray(44));
        }
      }
    }

    const totalPcm = Buffer.concat(pcmChunks);
    const byteLength = totalPcm.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + byteLength, 4);
    header.write('WAVE', 8);

    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
    header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    header.write('data', 36);
    header.writeUInt32LE(byteLength, 40);

    const mergedWav = Buffer.concat([header, totalPcm]);
    await fs.promises.writeFile(outputPath, mergedWav);

    return {
      success: true,
      outputPath,
      sizeBytes: mergedWav.length,
    };
  }

  /**
   * Dọn dẹp file audio tạm thời đã cũ
   */
  async cleanupOldAudioFiles(maxAgeHours = 24) {
    try {
      const audioDir = database.audioDir;
      const files = await fs.promises.readdir(audioDir);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        // Chỉ dọn dẹp file tạm preview_ hoặc job_
        if (file.startsWith('preview_') || file.startsWith('job_')) {
          const filePath = path.join(audioDir, file);
          const stat = await fs.promises.stat(filePath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(filePath).catch(() => {});
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`[AudioService] Đã dọn dẹp ${deletedCount} file audio tạm cũ.`);
      }
    } catch (err) {
      console.warn('[AudioService] Lỗi khi dọn dẹp file audio tạm:', err.message);
    }
  }
}

export const audioService = new AudioService();
export default audioService;
