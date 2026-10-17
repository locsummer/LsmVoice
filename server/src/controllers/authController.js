import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import database, { dbGet, dbRun, dbAll } from '../db/database.js';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'lsmvoice_jwt_secret_dev_key_change_in_production_998877';

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

/**
 * 1. ĐĂNG KÝ TÀI KHOẢN (Username + Email)
 * Hệ thống tự động tạo mật khẩu ban đầu an toàn và gửi qua Email
 */
export const register = async (req, res, next) => {
  try {
    const { username, email, fullName } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ tên đăng nhập và địa chỉ email.',
      });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Kiểm tra định dạng username (chữ cái, số, gạch dưới, từ 3 đến 30 ký tự)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập phải từ 3 đến 30 ký tự, chỉ gồm chữ cái, chữ số và dấu gạch dưới (_).',
      });
    }

    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ email không đúng định dạng hợp lệ.',
      });
    }

    // Kiểm tra trùng username hoặc email
    const existingUsername = await dbGet(`SELECT id FROM users WHERE username = ?`, [cleanUsername]);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        field: 'username',
        message: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.',
      });
    }

    const existingEmail = await dbGet(`SELECT id FROM users WHERE email = ?`, [cleanEmail]);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        field: 'email',
        message: 'Địa chỉ email này đã được đăng ký trên hệ thống.',
      });
    }

    // Tạo mật khẩu ban đầu ngẫu nhiên và an toàn
    const initialPassword = authService.generateSecureInitialPassword(12);

    // Hash mật khẩu với bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(initialPassword, salt);
    const userId = uuidv4();
    const userFullName = (fullName && fullName.trim()) ? fullName.trim() : cleanUsername;

    // Lưu vào database (Vai trò mặc định luôn là USER)
    await dbRun(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, status, is_email_verified)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 0)`,
      [userId, cleanUsername, cleanEmail, passwordHash, userFullName]
    );

    // Gửi email thật chứa thông tin tài khoản và mật khẩu ban đầu
    // Chạy ngầm (asynchronous) để phản hồi ngay lập tức cho người dùng (<100ms),
    // ngăn ngừa triệt để lỗi timeout (ECONNABORTED) do mạng Cloud trễ
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    emailService.sendAccountWelcomeEmail({
      email: cleanEmail,
      username: cleanUsername,
      initialPassword,
      loginUrl: frontendUrl,
    }).then(() => {
      console.log(`[AUTH REGISTER] ✓ Đã gửi email kích hoạt tài khoản thành công tới ${cleanEmail}`);
    }).catch((emailErr) => {
      console.warn(`[AUTH REGISTER] ⚠️ Gửi email kích hoạt tới ${cleanEmail} gặp sự cố mạng nền:`, emailErr.message);
    });

    // Ghi nhận ngay sự kiện vào Nhật ký kiểm toán Quản trị (Admin Audit Logs)
    try {
      await dbRun(
        `INSERT INTO admin_audit_logs (id, admin_id, admin_email, action, target_user_id, target_user_email, details, ip_address)
         VALUES (?, 'system', 'system@lsmvoice.vn', 'user_registered', ?, ?, ?, ?)`,
        [
          uuidv4(),
          userId,
          cleanEmail,
          JSON.stringify({
            message: `Thành viên mới @${cleanUsername} vừa đăng ký tài khoản thành công qua Email thật.`,
            username: cleanUsername,
            email: cleanEmail,
            fullName: userFullName,
            registeredAt: new Date().toISOString(),
            ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
          }),
          req.ip || req.connection?.remoteAddress || '127.0.0.1',
        ]
      );
    } catch (auditErr) {
      console.error('[AUTH REGISTER] Lỗi ghi nhật ký kiểm toán:', auditErr.message);
    }

    // Gửi email thông báo tức thì đến hòm thư Quản trị viên
    emailService.sendNewUserAlertToAdmin({
      username: cleanUsername,
      email: cleanEmail,
      fullName: userFullName,
      registeredAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
    }).catch((err) => {
      console.warn('[AUTH REGISTER] Lỗi gửi thông báo cho Admin:', err.message);
    });

    res.status(201).json({
      success: true,
      message: `Đăng ký tài khoản thành công! Mật khẩu ban đầu đã được gửi đến email "${cleanEmail}". Vui lòng kiểm tra hộp thư (hoặc hòm thư Spam) để lấy mật khẩu đăng nhập.`,
      data: {
        userId,
        username: cleanUsername,
        email: cleanEmail,
        initialPassword,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. ĐĂNG NHẬP BƯỚC 1: YÊU CẦU MÃ OTP ĐĂNG NHẬP (Username + Email)
 */
export const requestLoginOtp = async (req, res, next) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và địa chỉ email đã đăng ký.',
      });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Tìm kiếm tài khoản khớp cả username và email
    const user = await dbGet(
      `SELECT * FROM users WHERE (username = ? OR email = ?) AND email = ?`,
      [cleanUsername, cleanEmail, cleanEmail]
    );

    if (!user) {
      // Ghi nhận sự kiện đăng nhập thất bại
      await authService.recordLoginEvent({
        identifier: `${cleanUsername}/${cleanEmail}`,
        status: 'failed',
        failureReason: 'user_not_found',
        method: 'otp',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(400).json({
        success: false,
        message: 'Thông tin tài khoản không chính xác hoặc không tồn tại.',
      });
    }

    // Kiểm tra tài khoản bị khóa
    if (user.status === 'locked' || user.status === 'disabled') {
      await authService.recordLoginEvent({
        userId: user.id,
        identifier: cleanEmail,
        status: 'failed',
        failureReason: 'account_locked',
        method: 'otp',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn hiện đang bị khóa hoặc tạm dừng. Vui lòng liên hệ quản trị viên.',
      });
    }

    // Tạo mã OTP 6 chữ số
    const otp = authService.generateOtp();

    // Lưu mã OTP đã hash vào database (thời hạn 5 phút)
    await authService.storeOtp({
      userId: user.id,
      email: user.email,
      otp,
      purpose: 'login',
      expiresInMinutes: 5,
    });

    // Gửi email OTP
    await emailService.sendLoginOtpEmail({
      email: user.email,
      username: user.username,
      otp,
      expiresInMinutes: 5,
    });

    res.json({
      success: true,
      message: `Mã OTP đã được gửi đến email ${maskEmail(user.email)}. Mã có hiệu lực trong 5 phút.`,
      data: {
        username: user.username,
        email: user.email,
        maskedEmail: maskEmail(user.email),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. ĐĂNG NHẬP BƯỚC 2: XÁC MINH MÃ OTP VÀ TẠO PHIÊN ĐĂNG NHẬP
 */
export const verifyLoginOtp = async (req, res, next) => {
  try {
    const { username, email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email và mã xác thực OTP.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    // Tìm thông tin người dùng
    const user = await dbGet(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản không tồn tại.',
      });
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status === 'locked' || user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa hoặc tạm dừng.',
      });
    }

    // Xác minh mã OTP
    const verifyRes = await authService.verifyOtp({
      email: cleanEmail,
      otp: cleanOtp,
      purpose: 'login',
    });

    if (!verifyRes.success) {
      await authService.recordLoginEvent({
        userId: user.id,
        identifier: cleanEmail,
        status: 'failed',
        failureReason: verifyRes.reason,
        method: 'otp',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(400).json({
        success: false,
        reason: verifyRes.reason,
        message: verifyRes.message,
      });
    }

    // Tự động đánh dấu email đã xác minh khi người dùng xác thực OTP qua email thành công
    await dbRun(`UPDATE users SET is_email_verified = 1, last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

    // Tạo phiên đăng nhập an toàn
    const sessionRes = await authService.createUserSession({
      user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      expiresInDays: 30,
    });

    // Ghi nhận sự kiện đăng nhập thành công
    await authService.recordLoginEvent({
      userId: user.id,
      identifier: cleanEmail,
      status: 'success',
      method: 'otp',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Thiết lập cookie HttpOnly an toàn
    res.cookie('lsm_token', sessionRes.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const isUserAdmin = user.role === 'admin';

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        token: sessionRes.token,
        redirectTo: isUserAdmin ? '/admin/dashboard' : '/',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
          isEmailVerified: 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. ĐĂNG NHẬP BẰNG MẬT KHẨU (Hỗ trợ mật khẩu ban đầu hoặc mật khẩu đã đổi)
 */
export const loginWithPassword = async (req, res, next) => {
  try {
    const { identifier, username, password } = req.body;
    const loginId = (username || identifier || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
      });
    }

    const cleanIdentifier = loginId.toLowerCase();

    const user = await dbGet(
      `SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?`,
      [cleanIdentifier, cleanIdentifier]
    );

    if (!user) {
      await authService.recordLoginEvent({
        identifier: cleanIdentifier,
        status: 'failed',
        failureReason: 'user_not_found',
        method: 'password',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    if (user.status === 'locked' || user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn hiện đang bị khóa.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await authService.recordLoginEvent({
        userId: user.id,
        identifier: cleanIdentifier,
        status: 'failed',
        failureReason: 'invalid_password',
        method: 'password',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    await dbRun(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

    const sessionRes = await authService.createUserSession({
      user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    await authService.recordLoginEvent({
      userId: user.id,
      identifier: cleanIdentifier,
      status: 'success',
      method: 'password',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.cookie('lsm_token', sessionRes.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        token: sessionRes.token,
        redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
          isEmailVerified: user.is_email_verified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. ĐỔI MẬT KHẨU: BƯỚC 1 — YÊU CẦU MÃ OTP ĐỔI MẬT KHẨU (Gửi đến email tài khoản đang đăng nhập)
 */
export const requestPasswordChangeOtp = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await dbGet(`SELECT id, username, email FROM users WHERE id = ?`, [userId]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    const otp = authService.generateOtp();

    await authService.storeOtp({
      userId: user.id,
      email: user.email,
      otp,
      purpose: 'password_change',
      expiresInMinutes: 5,
    });

    await emailService.sendPasswordChangeOtpEmail({
      email: user.email,
      username: user.username,
      otp,
      expiresInMinutes: 5,
    });

    res.json({
      success: true,
      message: `Mã OTP đổi mật khẩu đã được gửi đến email ${maskEmail(user.email)}.`,
      data: {
        maskedEmail: maskEmail(user.email),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. ĐỔI MẬT KHẨU: BƯỚC 2 — XÁC MINH MÃ OTP ĐỔI MẬT KHẨU
 */
export const verifyPasswordChangeOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã OTP.' });
    }

    const user = await dbGet(`SELECT id, email, username FROM users WHERE id = ?`, [userId]);

    const verifyRes = await authService.verifyOtp({
      email: user.email,
      otp: otp.toString().trim(),
      purpose: 'password_change',
    });

    if (!verifyRes.success) {
      return res.status(400).json({
        success: false,
        message: verifyRes.message,
      });
    }

    // Tạo token thử thách đổi mật khẩu có thời hạn 10 phút
    const challengeToken = jwt.sign(
      { userId: user.id, action: 'password_change_verified' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      message: 'Xác minh mã OTP thành công. Vui lòng nhập mật khẩu mới.',
      data: {
        challengeToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. ĐỔI MẬT KHẨU: BƯỚC 3 — LƯU MẬT KHẨU MỚI VÀ THU HỒI CÁC PHIÊN CŨ
 */
export const confirmPasswordChange = async (req, res, next) => {
  try {
    const { challengeToken, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (!challengeToken) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu bằng chứng xác thực OTP. Vui lòng xác minh OTP trước.',
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có độ dài ít nhất 6 ký tự.',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới và xác nhận mật khẩu không khớp.',
      });
    }

    // Xác thực challengeToken
    try {
      const decoded = jwt.verify(challengeToken, JWT_SECRET);
      if (decoded.userId !== userId || decoded.action !== 'password_change_verified') {
        return res.status(400).json({
          success: false,
          message: 'Phiên xác thực đổi mật khẩu không hợp lệ hoặc đã hết hạn.',
        });
      }
    } catch (_) {
      return res.status(400).json({
        success: false,
        message: 'Thời hạn xác thực đổi mật khẩu đã hết (10 phút). Vui lòng yêu cầu mã OTP mới.',
      });
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // Cập nhật vào DB
    await dbRun(
      `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newHash, userId]
    );

    // Thu hồi toàn bộ các phiên đăng nhập cũ trên mọi thiết bị
    await authService.revokeAllUserSessions(userId);

    const user = await dbGet(`SELECT id, username, email FROM users WHERE id = ?`, [userId]);

    // Tạo phiên đăng nhập mới cho phiên làm việc hiện tại
    const newSession = await authService.createUserSession({
      user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Gửi email cảnh báo bảo mật
    try {
      await emailService.sendPasswordChangedAlertEmail({
        email: user.email,
        username: user.username,
      });
    } catch (e) {
      console.error('[AUTH] Lỗi gửi email cảnh báo đổi mật khẩu:', e.message);
    }

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công! Toàn bộ các phiên đăng nhập khác đã được đăng xuất an toàn.',
      data: {
        token: newSession.token,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. QUÊN MẬT KHẨU: BƯỚC 1 — YÊU CẦU MÃ OTP KHÔI PHỤC
 */
export const requestPasswordResetOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập địa chỉ email đã đăng ký.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await dbGet(`SELECT id, username, email, status FROM users WHERE email = ?`, [cleanEmail]);

    // Luôn trả thông báo chung để tránh rò rỉ danh sách tài khoản
    const genericResponse = {
      success: true,
      message: 'Nếu địa chỉ email tồn tại trong hệ thống, mã xác thực khôi phục mật khẩu đã được gửi đến bạn.',
      data: {
        maskedEmail: maskEmail(cleanEmail),
      },
    };

    if (!user || user.status === 'locked' || user.status === 'disabled') {
      return res.json(genericResponse);
    }

    const otp = authService.generateOtp();

    await authService.storeOtp({
      userId: user.id,
      email: user.email,
      otp,
      purpose: 'password_reset',
      expiresInMinutes: 5,
    });

    await emailService.sendPasswordResetOtpEmail({
      email: user.email,
      otp,
      expiresInMinutes: 5,
    });

    return res.json(genericResponse);
  } catch (err) {
    next(err);
  }
};

/**
 * 9. QUÊN MẬT KHẨU: BƯỚC 2 — XÁC MINH MÃ OTP KHÔI PHỤC
 */
export const verifyPasswordResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email và mã OTP khôi phục.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const verifyRes = await authService.verifyOtp({
      email: cleanEmail,
      otp: otp.toString().trim(),
      purpose: 'password_reset',
    });

    if (!verifyRes.success) {
      return res.status(400).json({
        success: false,
        message: verifyRes.message,
      });
    }

    const resetToken = jwt.sign(
      { email: cleanEmail, action: 'password_reset_verified' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      message: 'Xác minh mã OTP thành công. Vui lòng thiết lập mật khẩu mới.',
      data: {
        resetToken,
        email: cleanEmail,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 10. QUÊN MẬT KHẨU: BƯỚC 3 — XÁC NHẬN ĐẶT LẠI MẬT KHẨU MỚI
 */
export const confirmPasswordReset = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin đặt lại mật khẩu.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới và xác nhận mật khẩu không khớp.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    try {
      const decoded = jwt.verify(resetToken, JWT_SECRET);
      if (decoded.email !== cleanEmail || decoded.action !== 'password_reset_verified') {
        return res.status(400).json({
          success: false,
          message: 'Mã xác thực đặt lại mật khẩu không hợp lệ.',
        });
      }
    } catch (_) {
      return res.status(400).json({
        success: false,
        message: 'Phiên đặt lại mật khẩu đã hết hạn (10 phút). Vui lòng thử lại.',
      });
    }

    const user = await dbGet(`SELECT id, username, email FROM users WHERE email = ?`, [cleanEmail]);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await dbRun(
      `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newHash, user.id]
    );

    // Thu hồi toàn bộ phiên đăng nhập cũ
    await authService.revokeAllUserSessions(user.id);

    try {
      await emailService.sendPasswordChangedAlertEmail({
        email: user.email,
        username: user.username,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể dùng mật khẩu mới này để đăng nhập ngay bây giờ.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 11. XÁC MINH EMAIL (Yêu cầu gửi mã)
 */
export const requestEmailVerification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await dbGet(`SELECT id, username, email, is_email_verified FROM users WHERE id = ?`, [userId]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (user.is_email_verified) {
      return res.json({
        success: true,
        message: 'Địa chỉ email này đã được xác minh trước đó.',
      });
    }

    const otp = authService.generateOtp();

    await authService.storeOtp({
      userId: user.id,
      email: user.email,
      otp,
      purpose: 'email_verify',
      expiresInMinutes: 10,
    });

    await emailService.sendEmailVerificationOtpEmail({
      email: user.email,
      username: user.username,
      otp,
      expiresInMinutes: 10,
    });

    res.json({
      success: true,
      message: `Mã OTP xác minh email đã được gửi đến ${maskEmail(user.email)}.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 12. XÁC MINH EMAIL (Xác nhận mã OTP)
 */
export const verifyEmailVerification = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã OTP.' });
    }

    const user = await dbGet(`SELECT id, email FROM users WHERE id = ?`, [userId]);

    const verifyRes = await authService.verifyOtp({
      email: user.email,
      otp: otp.toString().trim(),
      purpose: 'email_verify',
    });

    if (!verifyRes.success) {
      return res.status(400).json({ success: false, message: verifyRes.message });
    }

    await dbRun(`UPDATE users SET is_email_verified = 1 WHERE id = ?`, [userId]);

    res.json({
      success: true,
      message: 'Địa chỉ email của bạn đã được xác minh thành công!',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 13. LẤY THÔNG TIN TÀI KHOẢN ĐANG ĐĂNG NHẬP (GET /api/auth/me)
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await dbGet(
      `SELECT id, username, email, full_name, role, status, is_email_verified, created_at, last_login_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
          isEmailVerified: user.is_email_verified,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 14. ĐĂNG XUẤT (POST /api/auth/logout)
 */
export const logout = async (req, res, next) => {
  try {
    if (req.user && req.user.sessionId) {
      await authService.revokeSession(req.user.sessionId);
    }
    res.clearCookie('lsm_token');
    res.json({
      success: true,
      message: 'Đăng xuất thành công.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 15. ĐĂNG XUẤT KHỎI TẤT CẢ THIẾT BỊ (POST /api/auth/logout-all)
 */
export const logoutAllDevices = async (req, res, next) => {
  try {
    await authService.revokeAllUserSessions(req.user.id);
    res.clearCookie('lsm_token');
    res.json({
      success: true,
      message: 'Đã thu hồi phiên đăng nhập trên tất cả các thiết bị thành công.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 16. CẬP NHẬT THÔNG TIN HỒ SƠ (PUT /api/auth/profile)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName } = req.body;
    const userId = req.user.id;

    if (fullName && fullName.trim()) {
      await dbRun(
        `UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [fullName.trim(), userId]
      );
    }

    const updated = await dbGet(
      `SELECT id, username, email, full_name, role, status, is_email_verified FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công.',
      data: {
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          fullName: updated.full_name,
          role: updated.role,
          status: updated.status,
          isEmailVerified: updated.is_email_verified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export default {
  register,
  requestLoginOtp,
  verifyLoginOtp,
  loginWithPassword,
  requestPasswordChangeOtp,
  verifyPasswordChangeOtp,
  confirmPasswordChange,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  confirmPasswordReset,
  requestEmailVerification,
  verifyEmailVerification,
  getMe,
  logout,
  logoutAllDevices,
  updateProfile,
};
