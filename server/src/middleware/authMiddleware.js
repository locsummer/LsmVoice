import jwt from 'jsonwebtoken';
import { dbGet } from '../db/database.js';
import authService from '../services/authService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'lsmvoice_jwt_secret_dev_key_change_in_production_998877';

/**
 * Middleware xác thực bắt buộc phải đăng nhập
 */
export const requireAuth = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.lsm_token) {
    token = req.cookies.lsm_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để thực hiện chức năng này.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Kiểm tra tính hợp lệ của phiên đăng nhập trong DB nếu có sessionId
    if (decoded.sessionId) {
      const isValid = await authService.validateSession(decoded.sessionId, decoded.id);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.',
        });
      }
    }

    // Kiểm tra trạng thái tài khoản trong DB
    const user = await dbGet(`SELECT id, username, email, full_name, role, status, is_email_verified FROM users WHERE id = ?`, [decoded.id]);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản người dùng không tồn tại.',
      });
    }

    if (user.status === 'locked' || user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm dừng hoạt động. Vui lòng liên hệ quản trị viên.',
      });
    }

    req.user = {
      ...user,
      sessionId: decoded.sessionId,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
    });
  }
};

/**
 * Middleware kiểm tra quyền Quản trị viên (ADMIN)
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_ADMIN_ONLY',
      message: 'Truy cập bị từ chối. Khu vực này chỉ dành cho Quản trị viên hệ thống.',
    });
  }
  next();
};

/**
 * Middleware xác thực tùy chọn (Hỗ trợ cả chế độ Khách và Người dùng đã đăng nhập)
 */
export const optionalAuth = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.lsm_token) {
    token = req.cookies.lsm_token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.sessionId) {
        const isValid = await authService.validateSession(decoded.sessionId, decoded.id);
        if (!isValid) {
          req.user = null;
          return next();
        }
      }
      const user = await dbGet(`SELECT id, username, email, full_name, role, status FROM users WHERE id = ?`, [decoded.id]);
      if (user && user.status === 'active') {
        req.user = {
          ...user,
          sessionId: decoded.sessionId,
        };
      } else {
        req.user = null;
      }
    } catch (_) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};

export default { requireAuth, requireAdmin, optionalAuth };
