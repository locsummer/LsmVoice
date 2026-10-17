import { BaseProvider } from './baseProvider.js';
import { VIETNAMESE_VOICES } from '../../config/constants.js';
import axios from 'axios';
import fs from 'fs';

export class AzureProvider extends BaseProvider {
  constructor() {
    super('azure');
    this.key = process.env.AZURE_SPEECH_KEY || '';
    this.region = process.env.AZURE_SPEECH_REGION || 'southeastasia';
  }

  getVoices() {
    return VIETNAMESE_VOICES.filter((v) => v.provider === 'azure');
  }

  async checkAvailability() {
    if (!this.key) {
      return {
        available: false,
        message: 'Chưa cấu hình AZURE_SPEECH_KEY trong file .env máy chủ.',
      };
    }
    return {
      available: true,
      message: `Microsoft Azure Speech sẵn sàng (Khu vực: ${this.region})`,
    };
  }

  escapeXml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async synthesize({ text, voiceId = 'vi-VN-HoaiMyNeural', speed = 1.0, pitch = 0.0, outputFile }) {
    if (!this.key) {
      throw new Error('Chưa cấu hình AZURE_SPEECH_KEY. Vui lòng thiết lập biến môi trường AZURE_SPEECH_KEY trong .env');
    }

    let actualVoice = voiceId;
    if (actualVoice.startsWith('azure-')) {
      actualVoice = actualVoice.replace('azure-', '');
    }

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const pitchHz = Math.round(pitch);
    const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

    const ssml = `<speak version='1.0' xml:lang='vi-VN'><voice xml:lang='vi-VN' name='${actualVoice}'><prosody rate='${rateStr}' pitch='${pitchStr}'>${this.escapeXml(text)}</prosody></voice></speak>`;

    const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    try {
      const response = await axios.post(endpoint, ssml, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'LsmVoice-TTS-Client',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const buffer = Buffer.from(response.data);
      await fs.promises.writeFile(outputFile, buffer);

      // Bitrate 128kbps = 16000 bytes/sec
      const duration = Math.max(1, Math.round((buffer.length / 16000) * 10) / 10);

      return {
        audioPath: outputFile,
        duration,
        format: 'mp3',
        sizeBytes: buffer.length,
      };
    } catch (err) {
      if (err.response) {
        if (err.response.status === 401) {
          throw new Error('Azure Speech API Key không hợp lệ hoặc đã hết hạn mức (Mã 401 Unauthorized).');
        } else if (err.response.status === 429) {
          throw new Error('Azure Speech API đạt giới hạn tần suất yêu cầu (Mã 429 Too Many Requests). Vui lòng thử lại sau giây lát.');
        }
        throw new Error(`Azure Speech API trả về lỗi (${err.response.status}): ${err.response.statusText}`);
      }
      throw new Error(`Không thể kết nối đến dịch vụ Azure Speech: ${err.message}`);
    }
  }
}

export default AzureProvider;
