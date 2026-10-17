import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../db/database.js';

export const getCategories = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;

    let query = `SELECT id, name, is_default, user_id FROM categories WHERE is_default = 1`;
    const params = [];

    if (userId) {
      query += ` OR user_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY is_default DESC, name ASC`;

    const categories = await dbAll(query, params);

    res.json({
      success: true,
      data: {
        total: categories.length,
        categories: categories.map((c) => c.name),
        detailed: categories,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tên thể loại không được để trống.',
      });
    }

    const trimmedName = name.trim();

    // Kiểm tra xem thể loại này đã tồn tại chưa
    const existing = await dbGet(
      `SELECT id, name FROM categories WHERE (is_default = 1 OR user_id = ?) AND LOWER(name) = LOWER(?)`,
      [userId, trimmedName]
    );

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Thể loại đã tồn tại.',
        data: existing,
      });
    }

    const id = `cat_user_${uuidv4()}`;
    await dbRun(
      `INSERT INTO categories (id, user_id, name, is_default) VALUES (?, ?, ?, 0)`,
      [id, userId, trimmedName]
    );

    const created = await dbGet(`SELECT id, name, is_default, user_id FROM categories WHERE id = ?`, [id]);

    res.status(201).json({
      success: true,
      message: `Đã tạo thể loại "${trimmedName}" thành công.`,
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getCategories,
  createCategory,
};
