import { BaseProvider } from './baseProvider.js';
import { VIETNAMESE_VOICES } from '../../config/constants.js';
import axios from 'axios';
import fs from 'fs';

export class FptProvider extends BaseProvider {
  constructor() {
    super('fpt');
    this.apiKey = process.env.FPT_AI_API_KEY || '';
    this.endpoint = 'https://api.fpt.ai/hmi/tts/v5';
  }

  getVoices() {
    return VIETNAMESE_VOICES.filter((v) => v.provider === 'fpt');
  }

  async checkAvailability() {
    if (!this.apiKey) {
      return {
        available: false,
        message: 'Chưa cấu hình FPT_AI_API_KEY trong file .env máy chủ.',
      };
    }
    return {
      available: true,
      message: 'FPT.AI Voice API sẵn sàng.',
    };
  }

  async synthesize({ text, voiceId = 'banmai', speed = 1.0, outputFile }) {
    if (!this.apiKey) {
      throw new Error('Chưa cấu hình FPT_AI_API_KEY. Vui lòng thiết lập biến môi trường FPT_AI_API_KEY trong file .env');
    }

    // FPT speed quy đổi: speed = 1.0 -> 0, 1.25 -> 1, 0.8 -> -1 (từ -3 đến 3)
    let fptSpeed = '0';
    if (speed > 1.4) fptSpeed = '2';
    else if (speed > 1.1) fptSpeed = '1';
    else if (speed < 0.7) fptSpeed = '-2';
    else if (speed < 0.9) fptSpeed = '-1';

    try {
      // Gửi yêu cầu khởi tạo giọng đọc tới FPT.AI
      const res = await axios.post(this.endpoint, text, {
        headers: {
          'api_key': this.apiKey,
          'voice': voiceId,
          'speed': fptSpeed,
          'format': 'mp3',
        },
        timeout: 20000,
      });

      if (res.data.error !== 0) {
        throw new Error(`FPT.AI trả về lỗi: ${res.data.message || 'Mã lỗi ' + res.data.error}`);
      }

      const asyncUrl = res.data.async;
      if (!asyncUrl) {
        throw new Error('FPT.AI không trả về đường dẫn tải audio hợp lệ.');
      }

      // Polling chờ FPT.AI hoàn thành sinh file audio
      let audioBuffer = null;
      const maxRetries = 25;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const downloadRes = await axios.get(asyncUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          if (downloadRes.status === 200 && downloadRes.data && downloadRes.data.byteLength > 1000) {
            audioBuffer = Buffer.from(downloadRes.data);
            break;
          }
        } catch (e) {
          // File chưa sẵn sàng trên CDN, tiếp tục thử
        }
      }

      if (!audioBuffer) {
        throw new Error('Hết thời gian chờ FPT.AI xử lý file audio (polling timeout).');
      }

      await fs.promises.writeFile(outputFile, audioBuffer);
      const duration = Math.max(1, Math.round((audioBuffer.length / 16000) * 10) / 10);

      return {
        audioPath: outputFile,
        duration,
        format: 'mp3',
        sizeBytes: audioBuffer.length,
      };
    } catch (err) {
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          throw new Error('FPT.AI API Key không chính xác hoặc tài khoản đã hết hạn mức.');
        }
        throw new Error(`FPT.AI API lỗi (${err.response.status}): ${err.message}`);
      }
      throw err;
    }
  }
}

export default FptProvider;
