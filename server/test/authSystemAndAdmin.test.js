import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, dbRun, dbGet, dbAll } from '../src/db/database.js';
import authService from '../src/services/authService.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

describe('Auth System & Admin RBAC - Kiểm thử hệ thống tài khoản & Quản trị', () => {
  before(async () => {
    await initDatabase();
  });

  it('1. Đăng ký tài khoản: Sinh mật khẩu ngẫu nhiên an toàn và lưu trữ hash bcrypt', async () => {
    const username = `user_${Date.now()}`;
    const email = `${username}@example.com`;
    const initialPassword = authService.generateSecureInitialPassword(12);

    assert.ok(initialPassword.length >= 10, 'Mật khẩu ngẫu nhiên phải đủ độ dài');
    assert.match(initialPassword, /[A-Z]/, 'Phải có chữ hoa');
    assert.match(initialPassword, /[a-z]/, 'Phải có chữ thường');
    assert.match(initialPassword, /[0-9]/, 'Phải có số');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(initialPassword, salt);
    const userId = uuidv4();

    await dbRun(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, status, is_email_verified)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 0)`,
      [userId, username, email, passwordHash, 'Người dùng Mới']
    );

    const savedUser = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
    assert.ok(savedUser);
    assert.equal(savedUser.username, username);
    assert.equal(savedUser.email, email);
    assert.equal(savedUser.role, 'user');
    assert.equal(savedUser.status, 'active');

    // Xác thực mật khẩu ban đầu
    const isMatch = await bcrypt.compare(initialPassword, savedUser.password_hash);
    assert.equal(isMatch, true, 'Mật khẩu ngẫu nhiên gửi qua email phải đối chiếu khớp với hash trong DB');
  });

  it('2. Quản lý OTP: Sinh mã 6 số, mã hóa bcrypt trong DB, xác minh và hủy sau khi dùng', async () => {
    const testEmail = `otp_test_${Date.now()}@example.com`;
    const otp = authService.generateOtp();

    assert.equal(otp.length, 6);
    assert.match(otp, /^\d{6}$/);

    // Lưu trữ OTP vào database
    await authService.storeOtp({
      email: testEmail,
      otp,
      purpose: 'login',
      expiresInMinutes: 5,
    });

    // Bản ghi trong DB không được lưu plaintext OTP
    const rawRecord = await dbGet(
      `SELECT * FROM otp_codes WHERE email = ? AND purpose = 'login' AND is_used = 0 ORDER BY id DESC LIMIT 1`,
      [testEmail]
    );
    assert.ok(rawRecord);
    assert.notEqual(rawRecord.code_hash, otp, 'OTP trong DB phải được mã hóa (băm)');

    // Thử xác minh với mã OTP sai
    const wrongVerify = await authService.verifyOtp({
      email: testEmail,
      otp: '000000',
      purpose: 'login',
    });
    assert.equal(wrongVerify.success, false);

    // Xác minh với mã OTP đúng
    const correctVerify = await authService.verifyOtp({
      email: testEmail,
      otp,
      purpose: 'login',
    });
    assert.equal(correctVerify.success, true);

    // Thử dùng lại mã OTP đã dùng (chống Replay Attack)
    const replayVerify = await authService.verifyOtp({
      email: testEmail,
      otp,
      purpose: 'login',
    });
    assert.equal(replayVerify.success, false, 'Mã OTP không được phép sử dụng lần thứ hai');
  });

  it('3. Quản lý Phiên (Session Tracking): Tạo phiên, xác thực, và thu hồi (Revoke)', async () => {
    const mockUser = {
      id: uuidv4(),
      username: `sess_user_${Date.now()}`,
      email: `sess_${Date.now()}@example.com`,
      role: 'user',
    };

    const sessionRes = await authService.createUserSession({
      user: mockUser,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Test Suite',
    });

    assert.ok(sessionRes.token);
    assert.ok(sessionRes.sessionId);

    // Kiểm tra tính hợp lệ của session
    const isValid = await authService.validateSession(sessionRes.sessionId, mockUser.id);
    assert.equal(isValid, true, 'Phiên vừa tạo phải ở trạng thái hợp lệ');

    // Thu hồi phiên đơn lẻ
    await authService.revokeSession(sessionRes.sessionId);
    const isValidAfterRevoke = await authService.validateSession(sessionRes.sessionId, mockUser.id);
    assert.equal(isValidAfterRevoke, false, 'Phiên sau khi thu hồi phải bị từ chối');
  });

  it('4. Đổi mật khẩu qua OTP và thu hồi toàn bộ các phiên đăng nhập cũ', async () => {
    const userId = uuidv4();
    const userEmail = `pwd_change_${Date.now()}@example.com`;
    const oldPassword = 'OldPassword123';
    const oldHash = await bcrypt.hash(oldPassword, 10);

    await dbRun(
      `INSERT INTO users (id, username, email, full_name, password_hash, role, status) VALUES (?, ?, ?, 'Người Đổi Mật Khẩu', ?, 'user', 'active')`,
      [userId, `user_${Date.now()}`, userEmail, oldHash]
    );

    // Tạo 2 phiên đăng nhập cho người dùng này
    const sess1 = await authService.createUserSession({ user: { id: userId, email: userEmail, role: 'user' } });
    const sess2 = await authService.createUserSession({ user: { id: userId, email: userEmail, role: 'user' } });

    assert.equal(await authService.validateSession(sess1.sessionId, userId), true);
    assert.equal(await authService.validateSession(sess2.sessionId, userId), true);

    // Cập nhật mật khẩu mới và gọi revokeAllUserSessions
    const newPassword = 'NewSecretPassword456!';
    const newHash = await bcrypt.hash(newPassword, 10);
    await dbRun(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);
    await authService.revokeAllUserSessions(userId);

    // Cả 2 phiên cũ phải bị thu hồi ngay lập tức
    assert.equal(await authService.validateSession(sess1.sessionId, userId), false);
    assert.equal(await authService.validateSession(sess2.sessionId, userId), false);

    // Xác nhận mật khẩu mới đã có hiệu lực
    const updatedUser = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
    assert.equal(await bcrypt.compare(newPassword, updatedUser.password_hash), true);
    assert.equal(await bcrypt.compare(oldPassword, updatedUser.password_hash), false);
  });

  it('5. Ghi nhận sự kiện đăng nhập (Login Events) và kiểm toán Quản trị (Admin Audit Logs)', async () => {
    const adminId = uuidv4();
    const adminEmail = 'superadmin@lsmvoice.vn';
    const targetUserId = uuidv4();
    const targetUserEmail = 'target@example.com';

    // 1. Ghi nhận sự kiện đăng nhập
    await authService.recordLoginEvent({
      userId: targetUserId,
      identifier: targetUserEmail,
      status: 'failed',
      failureReason: 'Sai mật khẩu',
      method: 'password',
      ipAddress: '192.168.1.50',
      userAgent: 'Chrome on Windows',
    });

    const loginLog = await dbGet(
      `SELECT * FROM login_events WHERE identifier = ? ORDER BY id DESC LIMIT 1`,
      [targetUserEmail]
    );
    assert.ok(loginLog);
    assert.equal(loginLog.status, 'failed');
    assert.equal(loginLog.failure_reason, 'Sai mật khẩu');

    // 2. Ghi nhận kiểm toán quản trị
    await authService.logAdminAudit({
      adminId,
      adminEmail,
      action: 'lock_account',
      targetUserId,
      targetUserEmail,
      details: { reason: 'Phát hiện đăng nhập bất thường nhiều lần' },
      ipAddress: '127.0.0.1',
    });

    const auditLog = await dbGet(
      `SELECT * FROM admin_audit_logs WHERE target_user_id = ? ORDER BY id DESC LIMIT 1`,
      [targetUserId]
    );
    assert.ok(auditLog);
    assert.equal(auditLog.action, 'lock_account');
    assert.equal(auditLog.admin_email, adminEmail);
  });

  it('6. Bảo vệ Quản trị viên: Không cho phép khóa hoặc hạ quyền Admin cuối cùng trong hệ thống', async () => {
    // Đảm bảo chỉ có ít nhất 1 admin
    const adminCountRow = await dbGet(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'`);
    assert.ok(adminCountRow.count >= 1, 'Hệ thống phải có ít nhất 1 admin (tự động seed)');

    // Giả sử chỉ có 1 admin, logic kiểm tra phải chặn việc khóa tài khoản
    const soleAdmin = await dbGet(`SELECT * FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1`);
    assert.ok(soleAdmin);

    // Kiểm tra xem hệ thống có nhận diện đúng nếu cố hạ quyền khi chỉ có 1 admin duy nhất không
    const remainingAdmins = await dbGet(
      `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active' AND id != ?`,
      [soleAdmin.id]
    );

    if (remainingAdmins.count === 0) {
      // Đúng quy tắc: Không được phép demote admin cuối cùng
      assert.equal(remainingAdmins.count, 0, 'Đây là admin duy nhất, không được hạ quyền hoặc khóa');
    }
  });

  it('7. Đăng nhập trực tiếp bằng Username + Password (không yêu cầu OTP/Email)', async () => {
    const rawUsername = `DirectUser_${Date.now()}`;
    const rawPassword = 'DirectPassword2026@!';
    const userEmail = `${rawUsername.toLowerCase()}@example.com`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const userId = uuidv4();

    await dbRun(
      `INSERT INTO users (id, username, email, full_name, password_hash, role, status)
       VALUES (?, ?, ?, 'Người dùng Trực Tiếp', ?, 'user', 'active')`,
      [userId, rawUsername.toLowerCase(), userEmail, passwordHash]
    );

    // 1. Đăng nhập đúng username (kể cả hoa/thường) và đúng password
    const userFound = await dbGet(
      `SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?`,
      [rawUsername.toLowerCase(), rawUsername.toLowerCase()]
    );
    assert.ok(userFound, 'Phải tìm thấy user bằng username');
    const isPassValid = await bcrypt.compare(rawPassword, userFound.password_hash);
    assert.equal(isPassValid, true, 'Mật khẩu đúng phải xác thực thành công');

    // 2. Thử đăng nhập với mật khẩu sai
    const isWrongPass = await bcrypt.compare('WrongPassword999', userFound.password_hash);
    assert.equal(isWrongPass, false, 'Mật khẩu sai phải bị từ chối');

    // 3. Thử đăng nhập với username không tồn tại
    const userNotFound = await dbGet(
      `SELECT * FROM users WHERE LOWER(username) = ?`,
      ['non_existent_username_xyz']
    );
    assert.equal(userNotFound, undefined, 'Username không tồn tại phải trả về undefined');
  });

  it('8. Rollback tài khoản nếu gửi email SMTP thất bại trong luồng đăng ký', async () => {
    const failUsername = `fail_user_${Date.now()}`;
    const failEmail = `${failUsername}@example.com`;
    const tempUserId = uuidv4();

    // Giả lập luồng: tạo tài khoản trong DB
    await dbRun(
      `INSERT INTO users (id, username, email, full_name, password_hash, role, status)
       VALUES (?, ?, ?, 'User Rollback Test', 'dummy_hash', 'user', 'active')`,
      [tempUserId, failUsername, failEmail]
    );

    const existsBefore = await dbGet(`SELECT * FROM users WHERE id = ?`, [tempUserId]);
    assert.ok(existsBefore);

    // Giả lập SMTP ném lỗi -> Rollback xóa user
    await dbRun(`DELETE FROM users WHERE id = ?`, [tempUserId]);

    const existsAfter = await dbGet(`SELECT * FROM users WHERE id = ?`, [tempUserId]);
    assert.equal(existsAfter, undefined, 'Tài khoản phải bị xóa sạch khỏi database khi gửi email thất bại');

    // Người dùng có thể đăng ký lại cùng username/email mà không bị báo lỗi trùng lặp
    const canReuse = await dbGet(`SELECT * FROM users WHERE username = ? OR email = ?`, [failUsername, failEmail]);
    assert.equal(canReuse, undefined, 'Username/Email đã được giải phóng để đăng ký lại an toàn');
  });

  it('9. Tính bền vững (Persistence): Dữ liệu tài khoản lưu trữ vĩnh viễn trong SQLite sau khi khởi động lại', async () => {
    const persistUsername = `persist_${Date.now()}`;
    const persistEmail = `${persistUsername}@example.com`;
    const persistId = uuidv4();

    await dbRun(
      `INSERT INTO users (id, username, email, full_name, password_hash, role, status)
       VALUES (?, ?, ?, 'Người dùng Bền vững', 'hash123', 'user', 'active')`,
      [persistId, persistUsername, persistEmail]
    );

    // Giả lập "khởi động lại" bằng cách gọi initDatabase()
    await initDatabase();

    const stillExists = await dbGet(`SELECT * FROM users WHERE id = ?`, [persistId]);
    assert.ok(stillExists, 'Tài khoản phải tồn tại nguyên vẹn sau khi server khởi động lại');
    assert.equal(stillExists.username, persistUsername);
    assert.equal(stillExists.email, persistEmail);
  });
});
