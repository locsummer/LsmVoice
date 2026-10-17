import { BaseProvider } from './baseProvider.js';
import { VIETNAMESE_VOICES } from '../../config/constants.js';
import { TextToSpeech } from '@kirillasyamov/text-to-speech';
import fs from 'fs';

/**
 * Provider Microsoft Edge TTS (Công nghệ giọng đọc thần kinh tự nhiên Neural Tiếng Việt)
 * Tích hợp engine giải mã Sec-MS-GEC, cơ chế tự động thử lại khi gặp 429 và kiểm soát tốc độ.
 */
export class EdgeProvider extends BaseProvider {
  constructor() {
    super('edge');
  }

  getVoices() {
    return VIETNAMESE_VOICES.filter((v) => v.provider === 'edge');
  }

  async checkAvailability() {
    return {
      available: true,
      message: 'Microsoft Edge Neural TTS khả dụng (Hoài My, Nam Minh tự nhiên)',
    };
  }

  /**
   * Tạo audio từ văn bản tiếng Việt qua Microsoft Edge Neural engine kèm cơ chế Retry
   */
  async synthesize({ text, voiceId = 'vi-VN-HoaiMyNeural', speed = 1.0, pitch = 0.0, outputFile }) {
    if (!text || !text.trim()) {
      throw new Error('Nội dung văn bản chuyển đổi không được để trống.');
    }

    let targetVoice = voiceId;
    if (targetVoice.startsWith('azure-')) {
      targetVoice = targetVoice.replace('azure-', '');
    }
    const voiceExists = this.getVoices().some((v) => v.id === targetVoice || v.id === voiceId);
    if (!voiceExists && !targetVoice.startsWith('vi-VN-')) {
      targetVoice = 'vi-VN-HoaiMyNeural';
    }

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const pitchHz = Math.round(pitch);
    const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

    // Cơ chế retry tối đa 3 lần với backoff thời gian
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = new TextToSpeech();
        const buffer = await client.speak(text.trim(), {
          voice: targetVoice,
          rate: rateStr,
          pitch: pitchStr,
        });

        if (!buffer || buffer.length === 0) {
          throw new Error('Dịch vụ Edge TTS không trả về dữ liệu âm thanh.');
        }

        const audioBuffer = Buffer.from(buffer);
        await fs.promises.writeFile(outputFile, audioBuffer);

        // Bitrate trung bình 48kbps = 6000 bytes/sec
        const duration = Math.max(1, Math.round((audioBuffer.length / 6000) * 10) / 10);

        return {
          audioPath: outputFile,
          duration,
          format: 'mp3',
          sizeBytes: audioBuffer.length,
        };
      } catch (err) {
        lastError = err;
        console.warn(`[EdgeProvider] Lần thử ${attempt}/${maxRetries} thất bại: ${err.message}`);

        // Nếu là lỗi 429 (rate limit) hoặc lỗi kết nối, đợi rồi thử lại
        if (attempt < maxRetries) {
          const delayMs = attempt * 1800; // 1.8s, 3.6s
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error('[EdgeProvider Error]', lastError?.message);
    throw new Error(
      `Dịch vụ Microsoft Edge TTS đang tạm thời bận hoặc giới hạn kết nối (${lastError?.message || 'Lỗi mạng'}). Vui lòng thử lại sau giây lát hoặc chọn giọng đọc khác.`
    );
  }
}

export default EdgeProvider;
