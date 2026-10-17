import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc biến môi trường từ file server/.env và .env với override: true
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ override: true });

import { initDatabase } from './db/database.js';
import apiRoutes from './routes/api.js';
import { streamAudioFile } from './controllers/ttsController.js';
import audioService from './services/audioService.js';
import { SYSTEM_LIMITS } from './config/constants.js';

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Cấu hình CORS an toàn
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request từ localhost hoặc không có origin (mobile apps, curl, etc.)
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      callback(null, true);
    },
    credentials: true,
  })
);

// Ghi log request kỹ thuật
app.use(morgan('dev'));

// Parse JSON body với giới hạn an toàn 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Giới hạn tần suất request (Rate Limiting) để chống tấn công và lạm dụng API
const limiter = rateLimit({
  windowMs: SYSTEM_LIMITS.RATE_LIMIT_WINDOW_MS,
  max: SYSTEM_LIMITS.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau 15 phút.',
  },
});
app.use('/api', limiter);

// Phục vụ stream audio với hỗ trợ HTTP 206 Partial Content (tua, seek)
app.get('/audio/:filename', streamAudioFile);

// Tuyến đường API chính
app.use('/api', apiRoutes);

// Phục vụ frontend tĩnh khi triển khai production hoặc chuyển hướng trong development
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.redirect('http://localhost:5173');
  });
}

// Middleware xử lý lỗi tập trung có cấu trúc
app.use((err, req, res, next) => {
  console.error('[App Error]', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Dung lượng tệp tải lên vượt quá giới hạn 10MB cho phép.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Lỗi tải tệp: ${err.message}`,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

// Khởi chạy hệ thống
const startServer = async () => {
  try {
    // 1. Khởi tạo cơ sở dữ liệu SQLite
    await initDatabase();

    // 2. Chạy dọn dẹp file tạm audio định kỳ mỗi 6 giờ
    audioService.cleanupOldAudioFiles(parseInt(process.env.CLEANUP_TEMP_FILES_HOURS || '24', 10));
    setInterval(() => {
      audioService.cleanupOldAudioFiles(parseInt(process.env.CLEANUP_TEMP_FILES_HOURS || '24', 10));
    }, 6 * 60 * 60 * 1000);

    // 3. Khởi động HTTP server
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  LsmVoice Backend Server đang chạy tại cổng: ${PORT}`);
      console.log(`  Môi trường: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  API Base: http://localhost:${PORT}/api`);
      console.log(`  Audio Stream: http://localhost:${PORT}/audio/:filename`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Không thể khởi động máy chủ LsmVoice:', err);
    process.exit(1);
  }
};

startServer();

export default app;
