import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import database, { dbGet, dbRun, dbAll } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'lsmvoice_jwt_secret_dev_key_change_in_production_998877';

class AuthService {
  /**
   * Tạo mật khẩu ban đầu ngẫu nhiên và an toàn
   */
  generateSecureInitialPassword(length = 12) {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*+?';

    let password = '';
    password += uppercase[crypto.randomInt(0, uppercase.length)];
    password += lowercase[crypto.randomInt(0, lowercase.length)];
    password += numbers[crypto.randomInt(0, numbers.length)];
    password += symbols[crypto.randomInt(0, symbols.length)];

    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }

    // Trộn ngẫu nhiên các ký tự
    return password
      .split('')
      .sort(() => crypto.randomInt(-1, 2))
      .join('');
  }

  /**
   * Tạo mã OTP 6 chữ số an toàn
   */
  generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Lưu mã OTP vào cơ sở dữ liệu dưới dạng hash
   */
  async storeOtp({ userId = null, email, otp, purpose, expiresInMinutes = 5 }) {
    const cleanEmail = email.toLowerCase().trim();

    // Vô hiệu hóa toàn bộ mã OTP cũ chưa dùng cho cùng email và mục đích
    await dbRun(
      `UPDATE otp_codes SET is_used = 1 WHERE email = ? AND purpose = ? AND is_used = 0`,
      [cleanEmail, purpose]
    );

    const salt = await bcrypt.genSalt(8);
    const codeHash = await bcrypt.hash(otp, salt);
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    await dbRun(
      `INSERT INTO otp_codes (id, user_id, email, code_hash, purpose, attempts, max_attempts, expires_at, is_used)
       VALUES (?, ?, ?, ?, ?, 0, 5, ?, 0)`,
      [id, userId, cleanEmail, codeHash, purpose, expiresAt]
    );

    return { id, expiresAt };
  }

  /**
   * Xác minh mã OTP
   */
  async verifyOtp({ email, otp, purpose }) {
    const cleanEmail = email.toLowerCase().trim();

    // Tìm mã OTP còn hiệu lực gần nhất cho email và mục đích này
    const record = await dbGet(
      `SELECT * FROM otp_codes 
       WHERE email = ? AND purpose = ? AND is_used = 0 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, purpose]
    );

    if (!record) {
      return {
        success: false,
        reason: 'otp_not_found',
        message: 'Mã OTP không tồn tại hoặc đã được sử dụng. Vui lòng yêu cầu mã mới.',
      };
    }

    // Kiểm tra hết hạn
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await dbRun(`UPDATE otp_codes SET is_used = 1 WHERE id = ?`, [record.id]);
      return {
        success: false,
        reason: 'otp_expired',
        message: 'Mã OTP đã hết thời hạn sử dụng (5 phút). Vui lòng gửi lại mã mới.',
      };
    }

    // Kiểm tra số lần thử tối đa
    if (record.attempts >= record.max_attempts) {
      await dbRun(`UPDATE otp_codes SET is_used = 1 WHERE id = ?`, [record.id]);
      return {
        success: false,
        reason: 'max_attempts_exceeded',
        message: 'Bạn đã nhập sai mã xác thực quá 5 lần. Mã này đã bị vô hiệu hóa.',
      };
    }

    // So sánh mã OTP
    const isMatch = await bcrypt.compare(otp, record.code_hash);
    if (!isMatch) {
      await dbRun(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`, [record.id]);
      const remainingAttempts = record.max_attempts - (record.attempts + 1);
      return {
        success: false,
        reason: 'invalid_code',
        message: `Mã OTP không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
      };
    }

    // Đánh dấu mã đã sử dụng
    await dbRun(`UPDATE otp_codes SET is_used = 1 WHERE id = ?`, [record.id]);

    return {
      success: true,
      otpRecord: record,
    };
  }

  /**
   * Tạo phiên đăng nhập cho người dùng
   */
  async createUserSession({ user, ipAddress = '', userAgent = '', expiresInDays = 30 }) {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        sessionId,
      },
      JWT_SECRET,
      { expiresIn: `${expiresInDays}d` }
    );

    // Lưu token hash hoặc chữ ký token vào bảng phiên
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await dbRun(
      `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, is_revoked)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [sessionId, user.id, tokenHash, ipAddress, userAgent, expiresAt]
    );

    return { token, sessionId, expiresAt };
  }

  /**
   * Kiểm tra tính hợp lệ của phiên đăng nhập
   */
  async validateSession(sessionId, userId) {
    if (!sessionId || !userId) return false;

    const session = await dbGet(
      `SELECT * FROM user_sessions WHERE id = ? AND user_id = ? AND is_revoked = 0`,
      [sessionId, userId]
    );

    if (!session) return false;

    // Kiểm tra hết hạn
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await dbRun(`UPDATE user_sessions SET is_revoked = 1 WHERE id = ?`, [sessionId]);
      return false;
    }

    // Cập nhật thời điểm hoạt động gần nhất
    await dbRun(`UPDATE user_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);

    return true;
  }

  /**
   * Thu hồi phiên đăng nhập hiện tại
   */
  async revokeSession(sessionId) {
    if (!sessionId) return;
    await dbRun(`UPDATE user_sessions SET is_revoked = 1 WHERE id = ?`, [sessionId]);
  }

  /**
   * Thu hồi tất cả các phiên đăng nhập của người dùng (khi đổi mật khẩu hoặc bị khóa)
   */
  async revokeAllUserSessions(userId) {
    if (!userId) return;
    await dbRun(`UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?`, [userId]);
  }

  /**
   * Ghi nhận sự kiện đăng nhập vào nhật ký
   */
  async recordLoginEvent({
    userId = null,
    identifier,
    status,
    failureReason = null,
    method = 'otp',
    ipAddress = '',
    userAgent = '',
  }) {
    const id = uuidv4();
    try {
      await dbRun(
        `INSERT INTO login_events (id, user_id, identifier, status, failure_reason, method, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, identifier, status, failureReason, method, ipAddress, userAgent]
      );
    } catch (err) {
      console.error('[AuthService] Lỗi khi ghi nhận sự kiện đăng nhập:', err.message);
    }
  }

  /**
   * Ghi nhật ký quản trị viên (Admin Audit Log)
   */
  async logAdminAudit({
    adminId,
    adminEmail,
    action,
    targetUserId = null,
    targetUserEmail = null,
    details = {},
    ipAddress = '',
  }) {
    const id = uuidv4();
    try {
      await dbRun(
        `INSERT INTO admin_audit_logs (id, admin_id, admin_email, action, target_user_id, target_user_email, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          adminId,
          adminEmail,
          action,
          targetUserId,
          targetUserEmail,
          typeof details === 'string' ? details : JSON.stringify(details),
          ipAddress,
        ]
      );
    } catch (err) {
      console.error('[AuthService] Lỗi khi ghi nhật ký quản trị:', err.message);
    }
  }
}

const authService = new AuthService();
export default authService;
