import database, { dbGet, dbRun, dbAll } from '../db/database.js';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';

/**
 * 1. TỔNG QUAN DASHBOARD (Summary KPI metrics từ database thật)
 */
export const getDashboardSummary = async (req, res, next) => {
  try {
    // 1. Tổng số tài khoản
    const totalUsersRow = await dbGet(`SELECT COUNT(*) as count FROM users`);
    const totalUsers = totalUsersRow ? totalUsersRow.count : 0;

    // 2. Tổng số tài khoản đã xác minh email
    const verifiedUsersRow = await dbGet(`SELECT COUNT(*) as count FROM users WHERE is_email_verified = 1`);
    const verifiedEmailUsers = verifiedUsersRow ? verifiedUsersRow.count : 0;

    // 3. Số tài khoản mới hôm nay (theo ngày giờ địa phương / UTC)
    const newTodayRow = await dbGet(
      `SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')`
    );
    const newUsersToday = newTodayRow ? newTodayRow.count : 0;

    // 4. Số tài khoản mới trong 7 ngày
    const new7dRow = await dbGet(
      `SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')`
    );
    const newUsers7d = new7dRow ? new7dRow.count : 0;

    // 5. Số tài khoản mới trong 30 ngày
    const new30dRow = await dbGet(
      `SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-30 days')`
    );
    const newUsers30d = new30dRow ? new30dRow.count : 0;

    // 6. Số người dùng hoạt động trong 24 giờ qua (Đăng nhập thành công hoặc có session hoạt động)
    const active24hRow = await dbGet(
      `SELECT COUNT(DISTINCT user_id) as count FROM (
         SELECT user_id FROM login_events WHERE status = 'success' AND created_at >= datetime('now', '-24 hours') AND user_id IS NOT NULL
         UNION
         SELECT user_id FROM user_sessions WHERE is_revoked = 0 AND last_active_at >= datetime('now', '-24 hours')
       )`
    );
    const activeUsers24h = active24hRow ? active24hRow.count : 0;

    // 7. Số người dùng hoạt động trong 7 ngày qua
    const active7dRow = await dbGet(
      `SELECT COUNT(DISTINCT user_id) as count FROM (
         SELECT user_id FROM login_events WHERE status = 'success' AND created_at >= datetime('now', '-7 days') AND user_id IS NOT NULL
         UNION
         SELECT user_id FROM user_sessions WHERE is_revoked = 0 AND last_active_at >= datetime('now', '-7 days')
       )`
    );
    const activeUsers7d = active7dRow ? active7dRow.count : 0;

    // 8. Tổng lượt đăng nhập thành công
    const loginsSuccessRow = await dbGet(
      `SELECT COUNT(*) as count FROM login_events WHERE status = 'success'`
    );
    const totalLoginsSuccess = loginsSuccessRow ? loginsSuccessRow.count : 0;

    // 9. Tổng lượt đăng nhập thất bại
    const loginsFailedRow = await dbGet(
      `SELECT COUNT(*) as count FROM login_events WHERE status = 'failed'`
    );
    const totalLoginsFailed = loginsFailedRow ? loginsFailedRow.count : 0;

    // 10. Số tài khoản bị khóa hoặc vô hiệu hóa
    const lockedUsersRow = await dbGet(
      `SELECT COUNT(*) as count FROM users WHERE status IN ('locked', 'disabled')`
    );
    const lockedUsers = lockedUsersRow ? lockedUsersRow.count : 0;

    // 11. Tổng số audio jobs và library items
    const jobsCountRow = await dbGet(`SELECT COUNT(*) as count FROM tts_jobs`);
    const totalAudioJobs = jobsCountRow ? jobsCountRow.count : 0;

    const libraryCountRow = await dbGet(`SELECT COUNT(*) as count FROM library_items`);
    const totalLibraryItems = libraryCountRow ? libraryCountRow.count : 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        verifiedEmailUsers,
        newUsersToday,
        newUsers7d,
        newUsers30d,
        activeUsers24h,
        activeUsers7d,
        totalLoginsSuccess,
        totalLoginsFailed,
        lockedUsers,
        totalAudioJobs,
        totalLibraryItems,
        isUsingTurso: database.isUsingTurso || false,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. DỮ LIỆU BIỂU ĐỒ THỐNG KÊ THEO THỜI GIAN (Real Time-Series Data)
 */
export const getDashboardCharts = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const safeDays = [7, 30, 90].includes(days) ? days : 7;

    // 1. Số tài khoản đăng ký theo ngày
    const registrationsByDay = await dbAll(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= datetime('now', '-${safeDays} days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    );

    // 2. Lượt đăng nhập thành công và thất bại theo ngày
    const loginsSuccessByDay = await dbAll(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM login_events
       WHERE status = 'success' AND created_at >= datetime('now', '-${safeDays} days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    );

    const loginsFailedByDay = await dbAll(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM login_events
       WHERE status = 'failed' AND created_at >= datetime('now', '-${safeDays} days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    );

    // 3. Người dùng hoạt động theo ngày
    const activeUsersByDay = await dbAll(
      `SELECT date(created_at) as date, COUNT(DISTINCT user_id) as count
       FROM login_events
       WHERE status = 'success' AND user_id IS NOT NULL AND created_at >= datetime('now', '-${safeDays} days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    );

    // 4. Phân bổ vai trò (USER vs ADMIN)
    const rolesDistribution = await dbAll(
      `SELECT role, COUNT(*) as count FROM users GROUP BY role`
    );

    // 5. Tỷ lệ xác minh email
    const emailVerificationRatio = await dbAll(
      `SELECT is_email_verified, COUNT(*) as count FROM users GROUP BY is_email_verified`
    );

    res.json({
      success: true,
      data: {
        days: safeDays,
        registrations: registrationsByDay,
        loginsSuccess: loginsSuccessByDay,
        loginsFailed: loginsFailedByDay,
        activeUsers: activeUsersByDay,
        roles: rolesDistribution,
        emailVerification: emailVerificationRatio,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. DANH SÁCH KHÁCH HÀNG (Phân trang thực tế từ backend, tìm kiếm, lọc và sắp xếp)
 */
export const getCustomers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const { search, role, status, is_email_verified, sortBy = 'newest' } = req.query;

    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR LOWER(full_name) LIKE ?)`);
      params.push(q, q, q);
    }

    if (role && ['user', 'admin'].includes(role)) {
      conditions.push(`role = ?`);
      params.push(role);
    }

    if (status && ['active', 'locked', 'disabled'].includes(status)) {
      conditions.push(`status = ?`);
      params.push(status);
    }

    if (is_email_verified !== undefined && is_email_verified !== '') {
      conditions.push(`is_email_verified = ?`);
      params.push(parseInt(is_email_verified, 10) === 1 ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Đếm tổng số bản ghi
    const countQuery = `SELECT COUNT(*) as count FROM users ${whereClause}`;
    const totalRow = await dbGet(countQuery, params);
    const total = totalRow ? totalRow.count : 0;

    // Sắp xếp
    let orderClause = 'ORDER BY created_at DESC';
    if (sortBy === 'oldest') {
      orderClause = 'ORDER BY created_at ASC';
    } else if (sortBy === 'last_login') {
      orderClause = 'ORDER BY last_login_at DESC NULLS LAST';
    }

    // Truy vấn dữ liệu có kèm tổng lượt đăng nhập thành công
    const dataQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.full_name, 
        u.role, 
        u.status, 
        u.is_email_verified, 
        u.created_at, 
        u.last_login_at,
        (SELECT COUNT(*) FROM login_events le WHERE le.user_id = u.id AND le.status = 'success') as successful_logins_count
      FROM users u
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const customers = await dbAll(dataQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. XEM CHI TIẾT KHÁCH HÀNG
 */
export const getCustomerDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await dbGet(
      `SELECT id, username, email, full_name, role, status, is_email_verified, created_at, updated_at, last_login_at
       FROM users WHERE id = ?`,
      [id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }

    // Thống kê liên quan
    const totalSuccessLogins = (
      await dbGet(`SELECT COUNT(*) as count FROM login_events WHERE user_id = ? AND status = 'success'`, [id])
    )?.count || 0;

    const totalFailedLogins = (
      await dbGet(`SELECT COUNT(*) as count FROM login_events WHERE user_id = ? AND status = 'failed'`, [id])
    )?.count || 0;

    const totalLibraryItems = (
      await dbGet(`SELECT COUNT(*) as count FROM library_items WHERE user_id = ?`, [id])
    )?.count || 0;

    const totalAudioJobs = (
      await dbGet(`SELECT COUNT(*) as count FROM tts_jobs WHERE user_id = ?`, [id])
    )?.count || 0;

    // Lịch sử đăng nhập gần nhất (10 lần)
    const recentLogins = await dbAll(
      `SELECT id, identifier, status, failure_reason, method, ip_address, user_agent, created_at
       FROM login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    // Phiên đăng nhập đang hoạt động
    const activeSessions = await dbAll(
      `SELECT id, ip_address, user_agent, expires_at, created_at, last_active_at
       FROM user_sessions WHERE user_id = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY last_active_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        customer: user,
        stats: {
          successfulLogins: totalSuccessLogins,
          failedLogins: totalFailedLogins,
          libraryItemsCount: totalLibraryItems,
          audioJobsCount: totalAudioJobs,
          activeSessionsCount: activeSessions.length,
        },
        recentLogins,
        activeSessions,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. CẬP NHẬT TRẠNG THÁI KHÁCH HÀNG (Khóa / Mở khóa / Vô hiệu hóa)
 */
export const updateCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason = '' } = req.body;

    if (!['active', 'locked', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ. Chỉ chấp nhận active, locked hoặc disabled.',
      });
    }

    const targetUser = await dbGet(`SELECT id, username, email, role, status FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại.' });
    }

    // Bảo vệ: Không cho phép tự khóa tài khoản của chính mình nếu là Admin
    if (req.user.id === targetUser.id && status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản quản trị của chính mình.',
      });
    }

    // Bảo vệ: Các người khác đều không thể khóa tài khoản có vai trò Quản trị viên (Admin)
    if (targetUser.role === 'admin' && status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Không thể khóa tài khoản có vai trò Quản trị viên (Admin).',
      });
    }

    await dbRun(`UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);

    // Nếu khóa hoặc vô hiệu hóa, tự động thu hồi toàn bộ phiên đăng nhập của người dùng đó
    if (status === 'locked' || status === 'disabled') {
      await authService.revokeAllUserSessions(id);
    }

    // Ghi nhật ký quản trị
    await authService.logAdminAudit({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: status === 'active' ? 'unlock_user' : 'lock_user',
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      details: { newStatus: status, previousStatus: targetUser.status, reason },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái tài khoản "${targetUser.username}" thành "${status}".`,
      data: {
        id,
        status,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. ĐIỀU CHỈNH VAI TRÒ KHÁCH HÀNG (USER <-> ADMIN)
 */
export const updateCustomerRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò chỉ có thể là user hoặc admin.' });
    }

    const targetUser = await dbGet(`SELECT id, username, email, role FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại.' });
    }

    // Bảo vệ: Không cho phép tự hạ quyền của chính mình nếu là Admin
    if (req.user.id === targetUser.id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tự hạ quyền quản trị của chính mình.',
      });
    }

    // Bảo vệ: Không cho phép hạ quyền Quản trị viên cuối cùng
    if (targetUser.role === 'admin' && role === 'user') {
      const adminCountRow = await dbGet(
        `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'`
      );
      if (adminCountRow && adminCountRow.count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Không thể hạ quyền Quản trị viên duy nhất còn lại của hệ thống.',
        });
      }
    }

    await dbRun(`UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [role, id]);

    // Ghi nhật ký quản trị
    await authService.logAdminAudit({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'change_role',
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      details: { oldRole: targetUser.role, newRole: role },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Đã thay đổi vai trò tài khoản "${targetUser.username}" thành "${role}".`,
      data: { id, role },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6.1. XÓA VĨNH VIỄN TÀI KHOẢN KHÁCH HÀNG (KHÓA CỨNG - HARD DELETE)
 */
export const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await dbGet(`SELECT id, username, email, role, full_name FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại hoặc đã bị xóa.' });
    }

    // Bảo vệ 1: Admin không thể tự xóa tài khoản của chính mình
    if (req.user.id === targetUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không thể tự xóa tài khoản quản trị của chính mình.',
      });
    }

    // Bảo vệ 2: Các người khác đều không thể xóa Quản trị viên (Admin)
    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không thể xóa tài khoản Quản trị viên (Admin). Vui lòng hạ quyền xuống User trước nếu thực sự cần xóa.',
      });
    }

    // 1. Xóa các phiên đăng nhập
    await dbRun(`DELETE FROM user_sessions WHERE user_id = ?`, [id]);
    // 2. Xóa mã OTP liên quan
    await dbRun(`DELETE FROM otp_codes WHERE user_id = ? OR email = ?`, [id, targetUser.email]);
    // 3. Xóa lịch sử nghe
    await dbRun(`DELETE FROM listen_history WHERE user_id = ?`, [id]);
    // 4. Xóa tts chunks và jobs
    await dbRun(`DELETE FROM tts_chunks WHERE job_id IN (SELECT id FROM tts_jobs WHERE user_id = ?)`, [id]);
    await dbRun(`DELETE FROM tts_jobs WHERE user_id = ?`, [id]);
    // 5. Xóa thư viện cá nhân
    await dbRun(`DELETE FROM library_items WHERE user_id = ?`, [id]);
    // 6. Xóa thể loại cá nhân
    await dbRun(`DELETE FROM categories WHERE user_id = ?`, [id]);
    // 7. Cập nhật nhật ký đăng nhập sang NULL
    await dbRun(`UPDATE login_events SET user_id = NULL WHERE user_id = ?`, [id]);
    // 8. Xóa vĩnh viễn khỏi bảng users
    await dbRun(`DELETE FROM users WHERE id = ?`, [id]);

    // Ghi nhật ký kiểm toán hành động XÓA CỨNG
    await authService.logAdminAudit({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'delete_account',
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      details: {
        message: `Quản trị viên đã xóa vĩnh viễn (khóa cứng) tài khoản @${targetUser.username} (${targetUser.email}).`,
        deletedUser: {
          id: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
          fullName: targetUser.full_name,
        },
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Đã xóa vĩnh viễn tài khoản "${targetUser.username}" (${targetUser.email}) khỏi hệ thống.`,
      data: { id },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. THU HỒI TẤT CẢ PHIÊN ĐĂNG NHẬP CỦA KHÁCH HÀNG (Force Logout)
 */
export const revokeCustomerSessions = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await dbGet(`SELECT id, username, email FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại.' });
    }

    await authService.revokeAllUserSessions(id);

    await authService.logAdminAudit({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'revoke_sessions',
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      details: { message: 'Quản trị viên thu hồi toàn bộ phiên đăng nhập.' },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Đã thu hồi tất cả phiên đăng nhập của người dùng "${targetUser.username}".`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. GỬI LẠI EMAIL XÁC MINH CHO KHÁCH HÀNG
 */
export const resendCustomerVerification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await dbGet(`SELECT id, username, email, is_email_verified FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại.' });
    }

    if (targetUser.is_email_verified) {
      return res.json({
        success: true,
        message: 'Tài khoản này đã được xác minh địa chỉ email từ trước.',
      });
    }

    const otp = authService.generateOtp();

    await authService.storeOtp({
      userId: targetUser.id,
      email: targetUser.email,
      otp,
      purpose: 'email_verify',
      expiresInMinutes: 10,
    });

    await emailService.sendEmailVerificationOtpEmail({
      email: targetUser.email,
      username: targetUser.username,
      otp,
      expiresInMinutes: 10,
    });

    await authService.logAdminAudit({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'resend_verification',
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      details: { message: 'Gửi lại email mã xác minh cho người dùng.' },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Đã gửi lại mã xác minh tới email ${targetUser.email}.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 9. LỊCH SỬ ĐĂNG NHẬP TOÀN HỆ THỐNG (Login Events)
 */
export const getLoginEvents = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { status, search } = req.query;
    const conditions = [];
    const params = [];

    if (status && ['success', 'failed'].includes(status)) {
      conditions.push(`status = ?`);
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push(`(LOWER(identifier) LIKE ? OR ip_address LIKE ?)`);
      const q = `%${search.trim().toLowerCase()}%`;
      params.push(q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await dbGet(`SELECT COUNT(*) as count FROM login_events ${whereClause}`, params);
    const total = countRow ? countRow.count : 0;

    const events = await dbAll(
      `SELECT le.*, u.username, u.email 
       FROM login_events le 
       LEFT JOIN users u ON le.user_id = u.id 
       ${whereClause} 
       ORDER BY le.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 10. NHẬT KÝ QUẢN TRỊ (Admin Audit Logs)
 */
export const getAdminAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countRow = await dbGet(`SELECT COUNT(*) as count FROM admin_audit_logs`);
    const total = countRow ? countRow.count : 0;

    const logs = await dbAll(
      `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 11. XUẤT BẢN SAO LƯU DỮ LIỆU TOÀN HỆ THỐNG (JSON EXPORT)
 */
export const exportBackup = async (req, res, next) => {
  try {
    const users = await dbAll(
      `SELECT id, username, email, password_hash, full_name, role, status, is_email_verified, must_change_password, created_at, updated_at, last_login_at FROM users`
    );
    const libraryItems = await dbAll(`SELECT * FROM library_items`);
    const categories = await dbAll(`SELECT * FROM categories`);
    const listenHistory = await dbAll(`SELECT * FROM listen_history`);

    const backupData = {
      platform: 'LsmVoice',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || req.user?.email || 'admin',
      data: {
        users,
        libraryItems,
        categories,
        listenHistory,
      },
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lsmvoice_backup_${Date.now()}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    next(err);
  }
};

/**
 * 12. PHỤC HỒI DỮ LIỆU TỪ TỆP SAO LƯU JSON (JSON RESTORE)
 */
export const importBackup = async (req, res, next) => {
  try {
    const { backup } = req.body;
    if (!backup || !backup.data || !Array.isArray(backup.data.users)) {
      return res.status(400).json({
        success: false,
        message: 'Tệp sao lưu không hợp lệ hoặc thiếu dữ liệu tài khoản.',
      });
    }

    let restoredUsers = 0;
    for (const u of backup.data.users) {
      if (!u.email) continue;
      const cleanEmail = u.email.toLowerCase().trim();
      const cleanUsername = u.username ? u.username.toLowerCase().trim() : null;

      const existing = await dbGet(
        `SELECT id FROM users WHERE email = ? OR (username = ? AND username IS NOT NULL)`,
        [cleanEmail, cleanUsername || '']
      );

      if (!existing) {
        await dbRun(
          `INSERT INTO users (id, username, email, password_hash, full_name, role, status, is_email_verified, must_change_password, created_at, updated_at, last_login_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            u.id || ('usr_' + Date.now() + Math.random().toString(36).substring(2, 6)),
            cleanUsername,
            cleanEmail,
            u.password_hash,
            u.full_name || 'Người dùng',
            u.role || 'user',
            u.status || 'active',
            u.is_email_verified ? 1 : 0,
            u.must_change_password ? 1 : 0,
            u.created_at || new Date().toISOString(),
            u.updated_at || new Date().toISOString(),
            u.last_login_at || null,
          ]
        );
        restoredUsers++;
      }
    }

    let restoredItems = 0;
    if (Array.isArray(backup.data.libraryItems)) {
      for (const item of backup.data.libraryItems) {
        if (!item.id || !item.title) continue;
        const existing = await dbGet(`SELECT id FROM library_items WHERE id = ?`, [item.id]);
        if (!existing) {
          await dbRun(
            `INSERT INTO library_items (id, user_id, title, content, voice_id, provider, char_count, category, author, description, speed, status, audio_url, duration, last_position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              item.user_id,
              item.title,
              item.content || '',
              item.voice_id || 'vi-VN-HoaiMyNeural',
              item.provider || 'edge',
              item.char_count || 0,
              item.category || 'Chung',
              item.author || null,
              item.description || null,
              item.speed || 1.0,
              item.status || 'text_saved',
              item.audio_url || null,
              item.duration || 0,
              item.last_position || 0,
              item.created_at || new Date().toISOString(),
              item.updated_at || new Date().toISOString(),
            ]
          );
          restoredItems++;
        }
      }
    }

    // Ghi nhật ký kiểm toán hệ thống
    try {
      await authService.logAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'database_restore',
        details: { restoredUsers, restoredItems },
        ipAddress: req.ip,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `Khôi phục dữ liệu thành công! Đã nạp ${restoredUsers} tài khoản người dùng và ${restoredItems} tác phẩm thư viện vào hệ thống.`,
      data: {
        restoredUsers,
        restoredItems,
      },
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getDashboardSummary,
  getDashboardCharts,
  getCustomers,
  getCustomerDetails,
  updateCustomerStatus,
  updateCustomerRole,
  revokeCustomerSessions,
  resendCustomerVerification,
  deleteCustomer,
  getLoginEvents,
  getAdminAuditLogs,
  exportBackup,
  importBackup,
};
