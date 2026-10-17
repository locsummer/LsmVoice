import { SYSTEM_LIMITS } from '../config/constants.js';

/**
 * Dịch vụ phân tích và chia nhỏ văn bản dài tiếng Việt
 * Tuân thủ quy tắc ngắt câu, ngắt đoạn tự nhiên, không làm mất dấu câu hoặc đứt gãy từ.
 */
class ChunkService {
  /**
   * Kiểm tra độ dài văn bản có hợp lệ với giới hạn hệ thống hay không (50.000 ký tự)
   * @param {string} text 
   * @returns {{ valid: boolean, length: number, max: number, message?: string }}
   */
  validateTextLength(text) {
    if (!text || typeof text !== 'string') {
      return { valid: false, length: 0, max: SYSTEM_LIMITS.MAX_TEXT_LENGTH, message: 'Nội dung văn bản không được để trống.' };
    }
    const len = text.length;
    if (len > SYSTEM_LIMITS.MAX_TEXT_LENGTH) {
      return {
        valid: false,
        length: len,
        max: SYSTEM_LIMITS.MAX_TEXT_LENGTH,
        message: `Văn bản vượt quá giới hạn cho phép: ${len.toLocaleString('vi-VN')} / ${SYSTEM_LIMITS.MAX_TEXT_LENGTH.toLocaleString('vi-VN')} ký tự.`
      };
    }
    return { valid: true, length: len, max: SYSTEM_LIMITS.MAX_TEXT_LENGTH };
  }

  /**
   * Chia văn bản dài thành các đoạn nhỏ tối ưu cho TTS
   * @param {string} text Văn bản gốc cần chia
   * @param {number} maxChunkSize Kích thước tối đa của mỗi đoạn (mặc định 1200 ký tự)
   * @returns {Array<{ index: number, text: string, charCount: number }>}
   */
  splitIntoChunks(text, maxChunkSize = SYSTEM_LIMITS.CHUNK_SIZE_LIMIT) {
    if (!text || typeof text !== 'string') return [];

    const normalizedText = text.replace(/\r\n/g, '\n').trim();
    if (!normalizedText) return [];

    // Nếu văn bản nhỏ hơn giới hạn đoạn thì trả về luôn
    if (normalizedText.length <= maxChunkSize) {
      return [{
        index: 0,
        text: normalizedText,
        charCount: normalizedText.length,
      }];
    }

    const chunks = [];
    // Bước 1: Chia theo các đoạn văn bản chính (dấu xuống dòng)
    const rawParagraphs = normalizedText.split(/\n+/);
    let currentChunk = '';

    for (let i = 0; i < rawParagraphs.length; i++) {
      const paragraph = rawParagraphs[i].trim();
      if (!paragraph) continue;

      // Nếu thêm cả đoạn này vào chunk hiện tại mà không vượt quá maxChunkSize
      if (currentChunk.length + paragraph.length + 1 <= maxChunkSize) {
        currentChunk = currentChunk ? `${currentChunk}\n${paragraph}` : paragraph;
      } else {
        // Nếu đoạn văn tự nó đã dài hơn maxChunkSize, ta phải chia nhỏ đoạn văn theo câu
        if (paragraph.length > maxChunkSize) {
          // Lưu chunk hiện tại nếu đã có nội dung
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
          }

          // Chia đoạn văn dài theo câu (dấu chấm, chấm hỏi, chấm than, dấu ba chấm...)
          const sentenceChunks = this.splitParagraphBySentences(paragraph, maxChunkSize);
          for (let s = 0; s < sentenceChunks.length; s++) {
            const sentence = sentenceChunks[s];
            if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
              currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = sentence;
            }
          }
        } else {
          // Đoạn văn ngắn nhưng không vừa với currentChunk, đẩy currentChunk ra và bắt đầu chunk mới
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Đóng gói danh sách chunks với chỉ mục và độ dài
    return chunks.map((chunkText, index) => ({
      index,
      text: chunkText.trim(),
      charCount: chunkText.trim().length,
    }));
  }

  /**
   * Chia nhỏ một đoạn văn dài thành các câu hoặc mệnh đề
   */
  splitParagraphBySentences(paragraph, maxChunkSize) {
    // Tách câu giữ nguyên dấu câu: . ? ! … \n
    // Regex bắt ranh giới kết thúc câu tiếng Việt kèm dấu ngoặc kép hoặc gạch đầu dòng
    const regex = /([^.?!…]+[.?!…]+["']?)/g;
    const matches = paragraph.match(regex);

    if (!matches || matches.length === 0) {
      // Nếu không có dấu câu chuẩn, chia theo dấu phẩy, chấm phẩy hoặc khoảng trắng
      return this.splitByWords(paragraph, maxChunkSize);
    }

    const sentences = [];
    let currentPart = '';

    for (const match of matches) {
      const item = match.trim();
      if (!item) continue;

      if (currentPart.length + item.length + 1 <= maxChunkSize) {
        currentPart = currentPart ? `${currentPart} ${item}` : item;
      } else {
        if (item.length > maxChunkSize) {
          if (currentPart) sentences.push(currentPart);
          const subWords = this.splitByWords(item, maxChunkSize);
          sentences.push(...subWords);
          currentPart = '';
        } else {
          if (currentPart) sentences.push(currentPart);
          currentPart = item;
        }
      }
    }

    // Thu thập phần dư nếu có (văn bản sau dấu câu cuối cùng)
    const lastMatchedIndex = paragraph.lastIndexOf(matches[matches.length - 1]);
    const remainder = paragraph.slice(lastMatchedIndex + matches[matches.length - 1].length).trim();
    if (remainder) {
      if (currentPart.length + remainder.length + 1 <= maxChunkSize) {
        currentPart = currentPart ? `${currentPart} ${remainder}` : remainder;
      } else {
        if (currentPart) sentences.push(currentPart);
        currentPart = remainder;
      }
    }

    if (currentPart) {
      sentences.push(currentPart);
    }

    return sentences;
  }

  /**
   * Chia văn bản không có dấu câu theo từ, không bao giờ ngắt giữa một từ
   */
  splitByWords(text, maxChunkSize) {
    const words = text.split(/\s+/);
    const parts = [];
    let current = '';

    for (const word of words) {
      if (!word) continue;
      if (current.length + word.length + 1 <= maxChunkSize) {
        current = current ? `${current} ${word}` : word;
      } else {
        if (current) parts.push(current);
        current = word;
      }
    }

    if (current) parts.push(current);
    return parts;
  }
}

export const chunkService = new ChunkService();
export default chunkService;
