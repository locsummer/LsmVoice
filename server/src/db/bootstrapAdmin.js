import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import database, { dbGet, dbRun, initDatabase } from './database.js';

async function bootstrap() {
  await initDatabase();

  const username = (process.argv[2] || process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
  const email = (process.argv[3] || process.env.ADMIN_EMAIL || 'admin@lsmvoice.vn').toLowerCase().trim();
  const password = process.argv[4] || process.env.ADMIN_PASSWORD || 'Admin@LsmVoice2026!';

  console.log(`[BOOTSTRAP] Khởi tạo / cập nhật tài khoản Quản trị viên: ${username} (${email})...`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const existing = await dbGet(`SELECT id FROM users WHERE username = ? OR email = ?`, [username, email]);
  if (existing) {
    await dbRun(
      `UPDATE users SET role = 'admin', password_hash = ?, is_email_verified = 1, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [passwordHash, existing.id]
    );
    console.log(`[BOOTSTRAP] ✓ Đã nâng cấp & cập nhật mật khẩu ADMIN cho tài khoản hiện có (ID: ${existing.id})`);
  } else {
    const adminId = 'admin_root_' + uuidv4().substring(0, 8);
    await dbRun(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, status, is_email_verified)
       VALUES (?, ?, ?, ?, 'Quản trị viên hệ thống', 'admin', 'active', 1)`,
      [adminId, username, email, passwordHash]
    );
    console.log(`[BOOTSTRAP] ✓ Đã tạo mới tài khoản ADMIN thành công (ID: ${adminId})`);
  }

  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('[BOOTSTRAP] Lỗi khi tạo ADMIN:', err);
  process.exit(1);
});
