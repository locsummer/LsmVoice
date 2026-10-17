import { dbRun, dbGet, dbAll } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { search, limit = 50 } = req.query;

    let query = `SELECT * FROM listen_history WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL))`;
    const params = [userId, userId];

    if (search && search.trim()) {
      query += ` AND title LIKE ?`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY last_listened_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const records = await dbAll(query, params);

    res.json({
      success: true,
      data: {
        total: records.length,
        history: records,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const recordListening = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { libraryId, jobId, title, voiceId, voiceName, lastPosition, totalDuration, completed } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề nội dung không được để trống.' });
    }

    // Kiểm tra xem đã có bản ghi lịch sử tương ứng chưa (dựa vào libraryId hoặc jobId hoặc title)
    let existing = null;
    if (libraryId) {
      existing = await dbGet(
        `SELECT id FROM listen_history WHERE library_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
        [libraryId, userId, userId]
      );
    } else if (jobId) {
      existing = await dbGet(
        `SELECT id FROM listen_history WHERE job_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
        [jobId, userId, userId]
      );
    }

    if (existing) {
      await dbRun(
        `UPDATE listen_history
         SET last_position = ?, total_duration = ?, completed = ?, last_listened_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          lastPosition !== undefined ? parseFloat(lastPosition) : 0,
          totalDuration !== undefined ? parseFloat(totalDuration) : 0,
          completed ? 1 : 0,
          existing.id,
        ]
      );

      // Cập nhật last_position vào library_items nếu có
      if (libraryId) {
        await dbRun(
          `UPDATE library_items SET last_position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [lastPosition !== undefined ? parseFloat(lastPosition) : 0, libraryId]
        );
      }

      const updated = await dbGet(`SELECT * FROM listen_history WHERE id = ?`, [existing.id]);
      return res.json({ success: true, data: updated });
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO listen_history (id, user_id, library_id, job_id, title, voice_id, voice_name, last_position, total_duration, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        libraryId || null,
        jobId || null,
        title.trim(),
        voiceId || null,
        voiceName || null,
        lastPosition !== undefined ? parseFloat(lastPosition) : 0,
        totalDuration !== undefined ? parseFloat(totalDuration) : 0,
        completed ? 1 : 0,
      ]
    );

    const created = await dbGet(`SELECT * FROM listen_history WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const deleteHistoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    await dbRun(
      `DELETE FROM listen_history WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [id, userId, userId]
    );

    res.json({ success: true, message: 'Đã xóa bản ghi lịch sử nghe.' });
  } catch (err) {
    next(err);
  }
};

export const clearHistory = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;

    await dbRun(
      `DELETE FROM listen_history WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL))`,
      [userId, userId]
    );

    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử nghe.' });
  } catch (err) {
    next(err);
  }
};

export default {
  getHistory,
  recordListening,
  deleteHistoryItem,
  clearHistory,
};
