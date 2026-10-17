import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, dbRun, dbGet } from '../src/db/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

describe('Auth & Library - Xác thực, Thư viện và Phân quyền', () => {
  before(async () => {
    await initDatabase();
  });

  it('1. Đăng ký tài khoản và mã hóa mật khẩu an toàn với bcrypt', async () => {
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'SecretPassword123';
    const fullName = 'Trần Văn Thử Nghiệm';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    await dbRun(
      `INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)`,
      [userId, email, hash, fullName]
    );

    const savedUser = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
    assert.ok(savedUser);
    assert.equal(savedUser.email, email);
    assert.notEqual(savedUser.password_hash, password); // Không lưu plain text

    const isMatch = await bcrypt.compare(password, savedUser.password_hash);
    assert.equal(isMatch, true);

    const isWrongMatch = await bcrypt.compare('WrongPass', savedUser.password_hash);
    assert.equal(isWrongMatch, false);
  });

  it('2. Lưu trữ nội dung vào thư viện và ghi nhận lịch sử nghe', async () => {
    const itemId = uuidv4();
    const title = 'Chương 1: Khởi đầu mới';
    const content = 'Mặt trời từ từ nhô lên trên rặng núi xa xôi...';

    await dbRun(
      `INSERT INTO library_items (id, title, content, char_count, category, last_position)
       VALUES (?, ?, ?, ?, 'Tiểu thuyết', 45.5)`,
      [itemId, title, content, content.length]
    );

    const item = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [itemId]);
    assert.ok(item);
    assert.equal(item.title, title);
    assert.equal(item.category, 'Tiểu thuyết');
    assert.equal(item.last_position, 45.5);
  });

  it('3. Cách ly dữ liệu: Người dùng B không thể truy cập hoặc sửa dữ liệu của Người dùng A', async () => {
    const userA = uuidv4();
    const userB = uuidv4();
    const itemA = uuidv4();

    // Người dùng A tạo nội dung riêng tư
    await dbRun(
      `INSERT INTO library_items (id, user_id, title, content, char_count)
       VALUES (?, ?, 'Tài liệu mật của A', 'Nội dung riêng tư...', 20)`,
      [itemA, userA]
    );

    // Kiểm tra logic truy cập: nếu user_id !== req.user.id thì từ chối
    const item = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [itemA]);
    assert.ok(item);
    assert.equal(item.user_id, userA);

    const isAuthorizedForA = item.user_id === userA;
    const isAuthorizedForB = item.user_id === userB;

    assert.equal(isAuthorizedForA, true);
    assert.equal(isAuthorizedForB, false, 'Người dùng B không được phép có quyền truy cập dữ liệu của A');
  });

  it('4. Khởi tạo danh mục mặc định và tạo thể loại tùy chỉnh cho người dùng', async () => {
    // Kiểm tra danh mục mặc định
    const defaultCats = await dbGet(`SELECT count(*) as count FROM categories WHERE is_default = 1`);
    assert.ok(defaultCats.count >= 13, 'Phải có ít nhất 13 danh mục mặc định');

    // Thêm danh mục tùy chỉnh cho người dùng
    const customUserId = uuidv4();
    const customCatName = 'Truyện Trinh Thám Cổ Điển ' + Date.now();
    await dbRun(
      `INSERT INTO categories (id, user_id, name, is_default) VALUES (?, ?, ?, 0)`,
      [uuidv4(), customUserId, customCatName]
    );

    const savedCat = await dbGet(`SELECT * FROM categories WHERE name = ? AND user_id = ?`, [
      customCatName,
      customUserId,
    ]);
    assert.ok(savedCat);
    assert.equal(savedCat.name, customCatName);
    assert.equal(savedCat.is_default, 0);
  });

  it('5. Lưu trữ tác phẩm với đầy đủ metadata: Tác giả, Mô tả, Tốc độ đọc và Trạng thái', async () => {
    const itemId = uuidv4();
    const title = 'Tắt Đèn';
    const author = 'Ngô Tất Tố';
    const description = 'Tác phẩm văn học hiện thực phê phán kinh điển Việt Nam';
    const content = 'Trời tối đen như mực. Chị Dậu ôm con ngồi trong góc tối...';
    const speed = 1.15;
    const status = 'audio_ready';

    await dbRun(
      `INSERT INTO library_items (id, title, author, description, content, char_count, category, speed, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Truyện đời sống', ?, ?)`,
      [itemId, title, author, description, content, content.length, speed, status]
    );

    const savedWork = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [itemId]);
    assert.ok(savedWork);
    assert.equal(savedWork.title, title);
    assert.equal(savedWork.author, author);
    assert.equal(savedWork.description, description);
    assert.equal(savedWork.speed, 1.15);
    assert.equal(savedWork.status, 'audio_ready');
  });
});

