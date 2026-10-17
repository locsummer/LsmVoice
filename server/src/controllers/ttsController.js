import ttsService from '../services/ttsService.js';
import jobService from '../services/jobService.js';
import path from 'path';
import fs from 'fs';
import database from '../db/database.js';

export const getVoices = async (req, res, next) => {
  try {
    const { provider, gender, region } = req.query;
    const voices = ttsService.getVoices({ provider, gender, region });
    res.json({
      success: true,
      data: {
        total: voices.length,
        voices,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProvidersStatus = async (req, res, next) => {
  try {
    const statuses = await ttsService.checkProvidersStatus();
    res.json({
      success: true,
      data: {
        statuses,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const previewVoice = async (req, res, next) => {
  try {
    const { voiceId, text, speed, pitch } = req.body;
    if (!voiceId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp voiceId để nghe thử giọng.',
      });
    }

    const preview = await ttsService.createPreview({
      voiceId,
      text,
      speed: speed ? parseFloat(speed) : 1.0,
      pitch: pitch ? parseFloat(pitch) : 0.0,
    });

    res.json({
      success: true,
      data: preview,
    });
  } catch (err) {
    next(err);
  }
};

export const createJob = async (req, res, next) => {
  try {
    const { title, text, voiceId, speed, pitch } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung văn bản không được để trống.',
      });
    }

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn giọng đọc.',
      });
    }

    const job = await jobService.createJob({
      title,
      text,
      voiceId,
      speed: speed ? parseFloat(speed) : 1.0,
      pitch: pitch ? parseFloat(pitch) : 0.0,
      userId,
    });

    res.status(202).json({
      success: true,
      message: 'Đã khởi tạo tác vụ chuyển đổi âm thanh.',
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

export const getJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await jobService.getJobDetails(id);
    res.json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await jobService.cancelJob(id);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

export const retryChunk = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await jobService.retryChunk(id);
    res.json({
      success: true,
      message: 'Đoạn âm thanh đã được tạo lại thành công.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const streamAudioFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    // Ngăn chặn path traversal attack
    const safeFileName = path.basename(filename);
    const filePath = path.join(database.audioDir, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tệp âm thanh yêu cầu.',
      });
    }

    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(safeFileName).toLowerCase();
    const contentType = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';

    // Nếu có query ?download=true hoặc ?download=1, thiết lập header Content-Disposition để tải về máy
    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const customTitle = req.query.title;
    let dispositionHeader = {};
    if (isDownload) {
      let downloadName = (customTitle || 'lsmvoice_audio')
        .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      if (!downloadName) downloadName = 'lsmvoice_audio';
      const finalDownloadName = `${downloadName}${ext}`;
      dispositionHeader['Content-Disposition'] = `attachment; filename="${encodeURIComponent(finalDownloadName)}"; filename*=UTF-8''${encodeURIComponent(finalDownloadName)}`;
    }

    // Xử lý HTTP 206 Partial Content cho seeking thanh tua của HTML5 Audio
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        ...dispositionHeader,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        ...dispositionHeader,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
};

export const downloadAudioFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { title } = req.query;
    const safeFileName = path.basename(filename);
    const filePath = path.join(database.audioDir, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tệp âm thanh để tải xuống.',
      });
    }

    const ext = path.extname(safeFileName).toLowerCase();
    const contentType = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';

    let downloadName = (title || 'lsmvoice_audio')
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    if (!downloadName) downloadName = 'lsmvoice_audio';
    const finalDownloadName = `${downloadName}${ext}`;

    const stat = await fs.promises.stat(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(finalDownloadName)}"; filename*=UTF-8''${encodeURIComponent(finalDownloadName)}`,
    });

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

export default {
  getVoices,
  getProvidersStatus,
  previewVoice,
  createJob,
  getJob,
  cancelJob,
  retryChunk,
  streamAudioFile,
  downloadAudioFile,
};
