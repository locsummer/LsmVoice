import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const storageDir = path.resolve(__dirname, '../../storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

export const audioDir = path.resolve(storageDir, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const isTestEnv = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));
const dbPath = process.env.SQLITE_DB_PATH || (
  isTestEnv
    ? path.resolve(storageDir, 'lsmvoice_test.sqlite')
    : path.resolve(storageDir, 'lsmvoice.sqlite')
);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Không thể kết nối cơ sở dữ liệu SQLite:', err.message);
  } else {
    console.log(`✓ Kết nối SQLite ${isTestEnv ? '(MÔI TRƯỜNG TEST)' : ''} thành công tại:`, dbPath);
  }
});

// Chuyển đổi các thao tác SQLite thành Promise
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

// Khởi tạo bảng cơ sở dữ liệu
export const initDatabase = async () => {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'user', -- 'user', 'admin'
        status TEXT DEFAULT 'active', -- 'active', 'locked', 'disabled'
        is_email_verified INTEGER DEFAULT 0,
        must_change_password INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      )
    `);

    // Safe migration: thêm các cột mới vào users nếu bảng đã tồn tại từ trước
    const newUsersColumns = [
      { name: 'username', type: 'TEXT' },
      { name: 'role', type: "TEXT DEFAULT 'user'" },
      { name: 'status', type: "TEXT DEFAULT 'active'" },
      { name: 'is_email_verified', type: 'INTEGER DEFAULT 0' },
      { name: 'must_change_password', type: 'INTEGER DEFAULT 0' },
      { name: 'last_login_at', type: 'DATETIME' },
    ];
    for (const col of newUsersColumns) {
      try {
        await dbRun(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      } catch (_) {
        // Cột đã tồn tại
      }
    }

    // Tự động chuẩn hóa username nếu bị trống cho các tài khoản cũ
    try {
      await dbRun(`
        UPDATE users 
        SET username = LOWER(SUBSTR(email, 1, INSTR(email, '@') - 1)) 
        WHERE (username IS NULL OR username = '') AND INSTR(email, '@') > 1
      `);
    } catch (_) {}

    try {
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    } catch (_) {}

    // Bảng nhật ký đăng nhập (Login Events)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS login_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        identifier TEXT NOT NULL,
        status TEXT NOT NULL, -- 'success', 'failed'
        failure_reason TEXT,
        method TEXT DEFAULT 'otp', -- 'otp', 'password'
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON login_events(user_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON login_events(created_at)`);

    // Bảng phiên đăng nhập (User Sessions)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at DATETIME NOT NULL,
        is_revoked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash)`);

    // Bảng mã xác thực OTP (OTP Codes)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        purpose TEXT NOT NULL, -- 'login', 'password_change', 'password_reset', 'email_verify'
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        expires_at DATETIME NOT NULL,
        is_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose)`);

    // Bảng nhật ký quản trị (Admin Audit Logs)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        admin_email TEXT NOT NULL,
        action TEXT NOT NULL,
        target_user_id TEXT,
        target_user_email TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at)`);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS library_items (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        voice_id TEXT,
        provider TEXT,
        char_count INTEGER,
        category TEXT DEFAULT 'Chung',
        author TEXT,
        description TEXT,
        speed REAL DEFAULT 1.0,
        status TEXT DEFAULT 'text_saved', -- 'text_saved', 'audio_processing', 'audio_ready', 'audio_failed'
        audio_url TEXT,
        duration REAL DEFAULT 0,
        last_position REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safe migration: thêm các cột mới vào library_items nếu bảng đã tồn tại từ trước
    const newColumns = [
      { name: 'author', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'speed', type: 'REAL DEFAULT 1.0' },
      { name: 'status', type: "TEXT DEFAULT 'text_saved'" },
    ];
    for (const col of newColumns) {
      try {
        await dbRun(`ALTER TABLE library_items ADD COLUMN ${col.name} ${col.type}`);
      } catch (_) {
        // Cột đã tồn tại, bỏ qua
      }
    }

    // Bảng thể loại (Categories)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT, -- NULL là thể loại mặc định toàn hệ thống
        name TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Nạp đầy đủ danh sách thể loại mặc định nếu chưa có
    const defaultCategories = [
      'Tiểu thuyết',
      'Truyện ngắn',
      'Ngôn tình',
      'Trinh thám',
      'Kinh dị',
      'Tâm lý - tình cảm',
      'Kiếm hiệp - tiên hiệp',
      'Khoa học viễn tưởng',
      'Truyện đời sống',
      'Tin tức',
      'Học tập',
      'Tài liệu',
      'Khác',
    ];
    for (const name of defaultCategories) {
      const existing = await dbGet(`SELECT id FROM categories WHERE name = ? AND is_default = 1`, [name]);
      if (!existing) {
        await dbRun(
          `INSERT OR IGNORE INTO categories (id, user_id, name, is_default) VALUES (?, NULL, ?, 1)`,
          [`cat_default_${Buffer.from(name).toString('hex')}`, name]
        );
      }
    }

    await dbRun(`
      CREATE TABLE IF NOT EXISTS tts_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        total_chars INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        completed_chunks INTEGER DEFAULT 0,
        failed_chunks INTEGER DEFAULT 0,
        status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
        provider TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        speed REAL DEFAULT 1.0,
        pitch REAL DEFAULT 0.0,
        merged_audio_path TEXT,
        merged_audio_url TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS tts_chunks (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        char_count INTEGER NOT NULL,
        status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
        audio_path TEXT,
        audio_url TEXT,
        duration REAL DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(job_id) REFERENCES tts_jobs(id) ON DELETE CASCADE
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS listen_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        library_id TEXT,
        job_id TEXT,
        title TEXT NOT NULL,
        voice_id TEXT,
        voice_name TEXT,
        last_position REAL DEFAULT 0,
        total_duration REAL DEFAULT 0,
        completed INTEGER DEFAULT 0,
        last_listened_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Khởi tạo tài khoản Quản trị viên (ADMIN) đầu tiên nếu chưa có
    const adminExists = await dbGet(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (!adminExists) {
      const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@lsmvoice.vn').toLowerCase().trim();
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@LsmVoice2026!';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      const adminId = 'admin_root_' + uuidv4().substring(0, 8);

      await dbRun(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, status, is_email_verified)
         VALUES (?, ?, ?, ?, 'Quản trị viên hệ thống', 'admin', 'active', 1)`,
        [adminId, adminUsername, adminEmail, passwordHash]
      );

      await dbRun(
        `INSERT INTO admin_audit_logs (id, admin_id, admin_email, action, details)
         VALUES (?, ?, ?, 'system_bootstrap', ?)`,
        [
          uuidv4(),
          adminId,
          adminEmail,
          JSON.stringify({ message: 'Khởi tạo tài khoản Quản trị viên đầu tiên thành công.' }),
        ]
      );
      console.log(`✓ Khởi tạo tài khoản Quản trị viên (ADMIN) đầu tiên thành công: ${adminUsername}`);
    }

    console.log('✓ Khởi tạo toàn bộ bảng cơ sở dữ liệu thành công');
  } catch (err) {
    console.error('Lỗi khi khởi tạo bảng cơ sở dữ liệu:', err);
    throw err;
  }
};

export default {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  storageDir,
  audioDir,
};
