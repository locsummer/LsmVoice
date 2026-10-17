import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { SYSTEM_LIMITS } from '../config/constants.js';

class FileParserService {
  /**
   * Trích xuất văn bản từ tệp tin tải lên (TXT, DOCX, PDF)
   * @param {object} file Đối tượng file từ multer ({ path, originalname, mimetype, size })
   * @returns {Promise<{ text: string, fileName: string, charCount: number, truncated: boolean, warning?: string }>}
   */
  async extractTextFromFile(file) {
    if (!file || !file.path) {
      throw new Error('Không nhận được tệp tin tải lên.');
    }

    if (file.size > SYSTEM_LIMITS.MAX_UPLOAD_SIZE_BYTES) {
      throw new Error(`Dung lượng tệp vượt quá mức cho phép (${Math.round(SYSTEM_LIMITS.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB).`);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    let rawText = '';
    let warning = null;

    try {
      if (ext === '.txt') {
        rawText = await fs.promises.readFile(file.path, 'utf8');
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: file.path });
        rawText = result.value;
      } else if (ext === '.pdf') {
        const dataBuffer = await fs.promises.readFile(file.path);
        const data = await pdfParse(dataBuffer);
        rawText = data.text;

        // Kiểm tra xem PDF có phải là file scan ảnh không có chữ hay không
        if (!rawText || rawText.trim().length < 20) {
          warning = 'Tệp PDF có thể là bản scan dạng hình ảnh và không chứa lớp văn bản (text layer) để trích xuất.';
        }
      } else {
        throw new Error(`Định dạng tệp '${ext}' không được hỗ trợ. Vui lòng tải lên tệp .txt, .docx hoặc .pdf.`);
      }

      // Xóa tệp tạm thời sau khi trích xuất
      await fs.promises.unlink(file.path).catch(() => {});

      let cleanText = (rawText || '').replace(/\r\n/g, '\n').trim();
      let truncated = false;

      // Kiểm tra giới hạn 50.000 ký tự
      if (cleanText.length > SYSTEM_LIMITS.MAX_TEXT_LENGTH) {
        cleanText = cleanText.substring(0, SYSTEM_LIMITS.MAX_TEXT_LENGTH);
        truncated = true;
        warning = `Văn bản trong tệp vượt quá ${SYSTEM_LIMITS.MAX_TEXT_LENGTH.toLocaleString('vi-VN')} ký tự và đã được cắt bớt đến giới hạn tối đa.`;
      }

      return {
        text: cleanText,
        fileName: file.originalname,
        charCount: cleanText.length,
        truncated,
        warning,
      };
    } catch (err) {
      // Đảm bảo dọn dẹp file tạm nếu xảy ra lỗi
      await fs.promises.unlink(file.path).catch(() => {});
      throw err;
    }
  }
}

export const fileParserService = new FileParserService();
export default fileParserService;
