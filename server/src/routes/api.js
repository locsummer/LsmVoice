import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/authMiddleware.js';
import * as ttsController from '../controllers/ttsController.js';
import * as libraryController from '../controllers/libraryController.js';
import * as historyController from '../controllers/historyController.js';
import * as authController from '../controllers/authController.js';
import * as adminController from '../controllers/adminController.js';
import * as uploadController from '../controllers/uploadController.js';
import * as categoryController from '../controllers/categoryController.js';
import database from '../db/database.js';
import { SYSTEM_LIMITS } from '../config/constants.js';

const router = express.Router();

// Thiết lập thư mục tải lên tạm thời
const uploadsDir = path.join(database.storageDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: SYSTEM_LIMITS.MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.txt', '.docx', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các tệp định dạng .txt, .docx hoặc .pdf.'));
    }
  },
});

// --- Tuyến đường gốc API ---
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'LsmVoice Backend API',
    version: '1.0.0',
    status: 'online',
    message: 'Máy chủ LsmVoice API đang hoạt động bình thường.',
    frontend: 'http://localhost:5173',
    endpoints: {
      voices: '/api/voices',
      providers: '/api/tts/providers',
      createJob: 'POST /api/tts/jobs',
      library: '/api/library',
      history: '/api/history',
      auth: '/api/auth',
      admin: '/api/admin',
    },
  });
});

// --- Tuyến đường TTS & Giọng đọc ---
router.get('/voices', ttsController.getVoices);
router.get('/tts/providers', ttsController.getProvidersStatus);
router.post('/tts/preview', ttsController.previewVoice);
router.post('/tts/jobs', optionalAuth, ttsController.createJob);
router.get('/tts/jobs/:id', ttsController.getJob);
router.post('/tts/jobs/:id/cancel', ttsController.cancelJob);
router.post('/tts/chunks/:id/retry', ttsController.retryChunk);

// --- Tuyến đường Tải lên tệp văn bản ---
router.post('/upload', upload.single('file'), uploadController.handleFileUpload);

// --- Tuyến đường Thư viện nội dung ---
router.get('/library', optionalAuth, libraryController.getLibrary);
router.post('/library', optionalAuth, libraryController.createLibraryItem);
router.get('/library/:id', optionalAuth, libraryController.getLibraryItem);
router.put('/library/:id', optionalAuth, libraryController.updateLibraryItem);
router.delete('/library/:id', optionalAuth, libraryController.deleteLibraryItem);

// --- Tuyến đường Lịch sử nghe ---
router.get('/history', optionalAuth, historyController.getHistory);
router.post('/history', optionalAuth, historyController.recordListening);
router.delete('/history/:id', optionalAuth, historyController.deleteHistoryItem);
router.delete('/history', optionalAuth, historyController.clearHistory);

// --- Tuyến đường Tải xuống Audio ---
router.get('/audio/download/:filename', ttsController.downloadAudioFile);

// --- Tuyến đường Thể loại (Categories) ---
router.get('/categories', optionalAuth, categoryController.getCategories);
router.post('/categories', optionalAuth, categoryController.createCategory);

// =========================================================================
// TUYẾN ĐƯỜNG XÁC THỰC & TÀI KHOẢN (AUTH & SECURITY)
// =========================================================================

// Đăng ký (Tạo ngẫu nhiên mật khẩu ban đầu và gửi qua Email)
router.post('/auth/register', authController.register);

// Đăng nhập bằng Tên đăng nhập + Email + OTP
router.post('/auth/login/request-otp', authController.requestLoginOtp);
router.post('/auth/login/verify-otp', authController.verifyLoginOtp);

// Đăng nhập bằng Mật khẩu (Dùng mật khẩu ban đầu hoặc mật khẩu đã đổi)
router.post('/auth/login', authController.loginWithPassword);

// Đăng xuất và quản lý phiên
router.post('/auth/logout', optionalAuth, authController.logout);
router.post('/auth/logout-all', requireAuth, authController.logoutAllDevices);
router.get('/auth/me', requireAuth, authController.getMe);
router.get('/auth/profile', requireAuth, authController.getMe);
router.put('/auth/profile', requireAuth, authController.updateProfile);

// Đổi mật khẩu bằng mã OTP Email
router.post('/auth/password/change/request-otp', requireAuth, authController.requestPasswordChangeOtp);
router.post('/auth/password/change/verify-otp', requireAuth, authController.verifyPasswordChangeOtp);
router.post('/auth/password/change/confirm', requireAuth, authController.confirmPasswordChange);

// Quên mật khẩu và khôi phục tài khoản bằng OTP Email
router.post('/auth/password/reset/request-otp', authController.requestPasswordResetOtp);
router.post('/auth/password/reset/verify-otp', authController.verifyPasswordResetOtp);
router.post('/auth/password/reset/confirm', authController.confirmPasswordReset);

// Xác minh địa chỉ Email
router.post('/auth/email-verification/request', requireAuth, authController.requestEmailVerification);
router.post('/auth/email-verification/verify', requireAuth, authController.verifyEmailVerification);

// =========================================================================
// TUYẾN ĐƯỜNG QUẢN TRỊ VIÊN (ADMIN DASHBOARD & CUSTOMER MANAGEMENT)
// Chỉ dành cho vai trò ADMIN (Bảo vệ ở backend bởi requireAuth + requireAdmin)
// =========================================================================

router.get('/admin/dashboard/summary', requireAuth, requireAdmin, adminController.getDashboardSummary);
router.get('/admin/dashboard/charts', requireAuth, requireAdmin, adminController.getDashboardCharts);
router.get('/admin/customers', requireAuth, requireAdmin, adminController.getCustomers);
router.get('/admin/customers/:id', requireAuth, requireAdmin, adminController.getCustomerDetails);
router.patch('/admin/customers/:id/status', requireAuth, requireAdmin, adminController.updateCustomerStatus);
router.patch('/admin/customers/:id/role', requireAuth, requireAdmin, adminController.updateCustomerRole);
router.delete('/admin/customers/:id', requireAuth, requireAdmin, adminController.deleteCustomer);
router.post('/admin/customers/:id/revoke-sessions', requireAuth, requireAdmin, adminController.revokeCustomerSessions);
router.post('/admin/customers/:id/resend-verification', requireAuth, requireAdmin, adminController.resendCustomerVerification);
router.get('/admin/login-events', requireAuth, requireAdmin, adminController.getLoginEvents);
router.get('/admin/audit-logs', requireAuth, requireAdmin, adminController.getAdminAuditLogs);

export default router;
