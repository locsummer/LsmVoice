import { BaseProvider } from './baseProvider.js';
import { VIETNAMESE_VOICES } from '../../config/constants.js';
import axios from 'axios';
import fs from 'fs';

export class ViettelProvider extends BaseProvider {
  constructor() {
    super('viettel');
    this.token = process.env.VIETTEL_AI_TOKEN || '';
    this.endpoint = 'https://viettelgroup.ai/voice/api/tts/v1/rest/syn';
  }

  getVoices() {
    return VIETNAMESE_VOICES.filter((v) => v.provider === 'viettel');
  }

  async checkAvailability() {
    if (!this.token) {
      return {
        available: false,
        message: 'Chưa cấu hình VIETTEL_AI_TOKEN trong file .env máy chủ.',
      };
    }
    return {
      available: true,
      message: 'Viettel AI Voice API sẵn sàng.',
    };
  }

  async synthesize({ text, voiceId = 'h-vi-1', speed = 1.0, outputFile }) {
    if (!this.token) {
      throw new Error('Chưa cấu hình VIETTEL_AI_TOKEN. Vui lòng thiết lập biến môi trường VIETTEL_AI_TOKEN trong file .env');
    }

    try {
      const response = await axios.post(
        this.endpoint,
        {
          text,
          voice: voiceId,
          speed: speed,
          tts_return_option: 2, // Trả về file audio trực tiếp
        },
        {
          headers: {
            'token': this.token,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 25000,
        }
      );

      const buffer = Buffer.from(response.data);
      if (buffer.length < 500) {
        // Kiểm tra nếu là thông báo lỗi JSON
        try {
          const jsonStr = buffer.toString('utf8');
          const errObj = JSON.parse(jsonStr);
          throw new Error(errObj.message || 'Viettel AI báo lỗi không rõ nguyên nhân');
        } catch (_) {}
      }

      await fs.promises.writeFile(outputFile, buffer);
      const duration = Math.max(1, Math.round((buffer.length / 16000) * 10) / 10);

      return {
        audioPath: outputFile,
        duration,
        format: 'mp3',
        sizeBytes: buffer.length,
      };
    } catch (err) {
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          throw new Error('Viettel AI Token không hợp lệ hoặc đã hết hạn.');
        }
        throw new Error(`Viettel AI trả về lỗi (${err.response.status}): ${err.message}`);
      }
      throw err;
    }
  }
}

export default ViettelProvider;
