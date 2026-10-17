import database, { dbRun, dbGet, dbAll } from '../src/db/database.js';

async function clean() {
  console.log('--- BẮT ĐẦU DỌN DẸP DỮ LIỆU ĐỂ ĐẢM BẢO 100% THỰC TẾ ---');

  // 1. Dọn dẹp tài khoản ảo/test
  const deletedUsers = await dbRun(
    `DELETE FROM users WHERE username NOT IN ('admin', 'lsm29', 'mebee', 'locsummer_test')`
  );
  console.log('1. Đã xóa các tài khoản test:', deletedUsers.changes);

  // 2. Nâng cấp tài khoản lsm29 thành admin
  await dbRun(
    `UPDATE users SET role = 'admin', is_email_verified = 1 WHERE username = 'lsm29'`
  );
  console.log('2. Đã nâng cấp lsm29 thành Quản trị viên (admin)');

  // 3. Dọn dẹp login events ảo
  const deletedLogins = await dbRun(
    `DELETE FROM login_events WHERE identifier LIKE '%@example.com' OR user_id NOT IN (SELECT id FROM users)`
  );
  console.log('3. Đã xóa login events ảo:', deletedLogins.changes);

  // 4. Dọn dẹp audit logs ảo
  const deletedAudits = await dbRun(
    `DELETE FROM admin_audit_logs WHERE target_user_email LIKE '%@example.com' OR admin_email = 'superadmin@lsmvoice.vn'`
  );
  console.log('4. Đã xóa admin audit logs ảo:', deletedAudits.changes);

  // 5. Dọn dẹp library items ảo
  const deletedLib = await dbRun(
    `DELETE FROM library_items WHERE title = 'Tài liệu mật của A'`
  );
  console.log('5. Đã xóa library items ảo:', deletedLib.changes);

  // 6. Dọn dẹp tts_jobs và chunks ảo
  const deletedChunks = await dbRun(
    `DELETE FROM tts_chunks WHERE job_id IN (SELECT id FROM tts_jobs WHERE title IN ('Tác phẩm kiểm thử', 'Tác vụ cần hủy'))`
  );
  const deletedJobs = await dbRun(
    `DELETE FROM tts_jobs WHERE title IN ('Tác phẩm kiểm thử', 'Tác vụ cần hủy')`
  );
  console.log('6. Đã xóa tts_jobs ảo:', deletedJobs.changes, 'và chunks:', deletedChunks.changes);

  // 7. Ghi audit log thực tế cho các tài khoản hiện có
  const lsm29User = await dbGet(`SELECT id, email FROM users WHERE username = 'lsm29'`);
  if (lsm29User) {
    const existingAudit = await dbGet(`SELECT id FROM admin_audit_logs WHERE target_user_id = ?`, [lsm29User.id]);
    if (!existingAudit) {
      await dbRun(
        `INSERT INTO admin_audit_logs (id, admin_id, admin_email, action, target_user_id, target_user_email, details)
         VALUES (?, 'system', 'admin@lsmvoice.vn', 'user_registered', ?, ?, ?)`,
        [
          'audit_reg_lsm29',
          lsm29User.id,
          lsm29User.email,
          JSON.stringify({
            message: 'Thành viên mới @lsm29 đăng ký tài khoản thành công qua Email thật.',
            username: 'lsm29',
            email: lsm29User.email,
            role: 'admin',
          }),
        ]
      );
    }
  }

  const mebeeUser = await dbGet(`SELECT id, email FROM users WHERE username = 'mebee'`);
  if (mebeeUser) {
    const existingAudit = await dbGet(`SELECT id FROM admin_audit_logs WHERE target_user_id = ?`, [mebeeUser.id]);
    if (!existingAudit) {
      await dbRun(
        `INSERT INTO admin_audit_logs (id, admin_id, admin_email, action, target_user_id, target_user_email, details)
         VALUES (?, 'system', 'admin@lsmvoice.vn', 'user_registered', ?, ?, ?)`,
        [
          'audit_reg_mebee',
          mebeeUser.id,
          mebeeUser.email,
          JSON.stringify({
            message: 'Thành viên mới @mebee đăng ký tài khoản thành công qua Email thật.',
            username: 'mebee',
            email: mebeeUser.email,
            role: 'user',
          }),
        ]
      );
    }
  }

  // Báo cáo số liệu thực
  const users = await dbAll('SELECT id, username, email, role, status FROM users');
  console.log('\n--- KẾT QUẢ DỮ LIỆU THỰC TRONG DATABASE ---');
  console.log('Danh sách tài khoản THỰC:', users);
  const auditLogs = await dbAll('SELECT id, action, target_user_email, created_at FROM admin_audit_logs');
  console.log('Danh sách Audit logs THỰC:', auditLogs);
  const jobs = await dbAll('SELECT id, title, status FROM tts_jobs');
  console.log('Danh sách TTS Jobs THỰC:', jobs);
  const lib = await dbAll('SELECT id, title FROM library_items');
  console.log('Danh sách Library THỰC:', lib);

  process.exit(0);
}

clean().catch((err) => {
  console.error('Lỗi khi dọn dẹp:', err);
  process.exit(1);
});
