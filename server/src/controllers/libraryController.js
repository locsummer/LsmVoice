import { dbRun, dbGet, dbAll } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_LIMITS } from '../config/constants.js';

export const getLibrary = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { search, category, sort } = req.query;

    let query = `SELECT * FROM library_items WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL))`;
    const params = [userId, userId];

    if (search && search.trim()) {
      query += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (sort === 'oldest') {
      query += ` ORDER BY created_at ASC`;
    } else if (sort === 'longest') {
      query += ` ORDER BY char_count DESC`;
    } else if (sort === 'recent_listened') {
      query += ` ORDER BY updated_at DESC`;
    } else {
      query += ` ORDER BY created_at DESC`;
    }

    const items = await dbAll(query, params);

    res.json({
      success: true,
      data: {
        total: items.length,
        items,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createLibraryItem = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const {
      title,
      content,
      voiceId,
      provider,
      category,
      author,
      description,
      speed,
      status,
      audioUrl,
      duration,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề nội dung không được để trống.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung văn bản không được để trống.' });
    }

    if (content.length > SYSTEM_LIMITS.MAX_TEXT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Nội dung vượt quá giới hạn ${SYSTEM_LIMITS.MAX_TEXT_LENGTH.toLocaleString('vi-VN')} ký tự.`,
      });
    }

    const id = uuidv4();
    const finalStatus = status || (audioUrl ? 'audio_ready' : 'text_saved');

    await dbRun(
      `INSERT INTO library_items (
        id, user_id, title, content, voice_id, provider, char_count,
        category, author, description, speed, status, audio_url, duration, last_position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        userId,
        title.trim(),
        content.trim(),
        voiceId || null,
        provider || null,
        content.trim().length,
        category || 'Chung',
        author ? author.trim() : null,
        description ? description.trim() : null,
        speed ? parseFloat(speed) : 1.0,
        finalStatus,
        audioUrl || null,
        duration ? parseFloat(duration) : 0,
      ]
    );

    const created = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [id]);

    res.status(201).json({
      success: true,
      message: 'Đã lưu tác phẩm vào thư viện thành công.',
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

export const getLibraryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [id]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nội dung trong thư viện.' });
    }

    // Bảo vệ quyền riêng tư nếu tài khoản khác truy cập
    if (item.user_id && req.user && item.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập nội dung này.' });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
};

export const updateLibraryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      voiceId,
      provider,
      category,
      author,
      description,
      speed,
      status,
      audioUrl,
      duration,
      lastPosition,
    } = req.body;

    const item = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [id]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nội dung để cập nhật.' });
    }

    if (item.user_id && req.user && item.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa nội dung này.' });
    }

    const updatedTitle = title !== undefined ? title.trim() : item.title;
    const updatedContent = content !== undefined ? content.trim() : item.content;
    const updatedCategory = category !== undefined ? category : item.category;
    const updatedAuthor = author !== undefined ? (author ? author.trim() : null) : item.author;
    const updatedDesc = description !== undefined ? (description ? description.trim() : null) : item.description;
    const updatedSpeed = speed !== undefined ? parseFloat(speed) : (item.speed || 1.0);
    const updatedStatus = status !== undefined ? status : (audioUrl ? 'audio_ready' : (item.status || 'text_saved'));
    const updatedVoiceId = voiceId !== undefined ? voiceId : item.voice_id;
    const updatedProvider = provider !== undefined ? provider : item.provider;
    const updatedAudioUrl = audioUrl !== undefined ? audioUrl : item.audio_url;
    const updatedDuration = duration !== undefined ? parseFloat(duration) : item.duration;
    const updatedPosition = lastPosition !== undefined ? parseFloat(lastPosition) : item.last_position;

    await dbRun(
      `UPDATE library_items
       SET title = ?, content = ?, char_count = ?, category = ?, author = ?, description = ?, speed = ?, status = ?, voice_id = ?, provider = ?, audio_url = ?, duration = ?, last_position = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updatedTitle,
        updatedContent,
        updatedContent.length,
        updatedCategory,
        updatedAuthor,
        updatedDesc,
        updatedSpeed,
        updatedStatus,
        updatedVoiceId,
        updatedProvider,
        updatedAudioUrl,
        updatedDuration,
        updatedPosition,
        id,
      ]
    );

    const updated = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: 'Cập nhật nội dung thành công.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteLibraryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await dbGet(`SELECT * FROM library_items WHERE id = ?`, [id]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nội dung để xóa.' });
    }

    if (item.user_id && req.user && item.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa nội dung này.' });
    }

    await dbRun(`DELETE FROM library_items WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: 'Đã xóa nội dung khỏi thư viện.',
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getLibrary,
  createLibraryItem,
  getLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
};
