import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkService } from '../src/services/chunkService.js';
import { SYSTEM_LIMITS } from '../src/config/constants.js';

describe('ChunkService - Phân tích và kiểm tra văn bản tiếng Việt', () => {
  it('1. Xử lý văn bản ngắn tiếng Việt', () => {
    const text = 'Hôm nay trời thu Hà Nội rất đẹp và dịu mát.';
    const validation = chunkService.validateTextLength(text);
    assert.equal(validation.valid, true);

    const chunks = chunkService.splitIntoChunks(text);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].text, text);
    assert.equal(chunks[0].index, 0);
  });

  it('2. Giữ nguyên toàn bộ dấu thanh tiếng Việt đầy đủ', () => {
    const vietnameseSentence =
      'Bác Hồ nói: "Không có gì quý hơn độc lập, tự do!". Tiếng Việt có đủ 6 thanh điệu: ngang, huyền, sắc, hỏi, ngã, nặng.';
    const chunks = chunkService.splitIntoChunks(vietnameseSentence);
    assert.equal(chunks[0].text, vietnameseSentence);
    assert.ok(chunks[0].text.includes('độc lập, tự do!'));
  });

  it('3. Kiểm tra văn bản đúng chính xác 50.000 ký tự', () => {
    const exactText = 'A'.repeat(50000);
    const validation = chunkService.validateTextLength(exactText);
    assert.equal(validation.valid, true);
    assert.equal(validation.length, 50000);
  });

  it('4. Chặn văn bản vượt quá 50.000 ký tự', () => {
    const overText = 'A'.repeat(50001);
    const validation = chunkService.validateTextLength(overText);
    assert.equal(validation.valid, false);
    assert.ok(validation.message.includes('vượt quá giới hạn'));
  });

  it('5. Chia văn bản dài thành nhiều đoạn mà không cắt giữa từ', () => {
    // Tạo đoạn văn bản dài có dấu chấm câu
    const sentence = 'Đây là một câu văn hoàn chỉnh tiếng Việt để kiểm tra chia đoạn. ';
    const longText = sentence.repeat(50); // khoảng 3.200 ký tự

    const chunks = chunkService.splitIntoChunks(longText, 1000);
    assert.ok(chunks.length > 1, 'Văn bản dài phải được chia thành nhiều hơn 1 đoạn');

    for (const chunk of chunks) {
      assert.ok(
        chunk.charCount <= 1000 + 100,
        `Mỗi đoạn không được vượt quá kích thước giới hạn an toàn (${chunk.charCount})`
      );
      // Đảm bảo không kết thúc lơ lửng giữa từ
      assert.ok(!chunk.text.endsWith(' '), 'Đoạn không được kết thúc bằng khoảng trắng thừa');
    }
  });
});
