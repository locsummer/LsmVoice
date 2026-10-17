import { BaseProvider } from './baseProvider.js';
import { VIETNAMESE_VOICES } from '../../config/constants.js';
import fs from 'fs';

/**
 * Demo Provider phục vụ kiểm thử luồng giao diện, tiến trình và trình phát.
 * Lưu ý: Chế độ demo chỉ nhằm mục đích kiểm tra tính năng kỹ thuật của hệ thống.
 */
export class DemoProvider extends BaseProvider {
  constructor() {
    super('demo');
  }

  getVoices() {
    return VIETNAMESE_VOICES.filter((v) => v.provider === 'demo');
  }

  async checkAvailability() {
    return {
      available: true,
      message: 'Chế độ Demo (Chỉ để kiểm thử giao diện & luồng xử lý kỹ thuật)',
    };
  }

  /**
   * Tạo file audio WAV chuẩn kỹ thuật để kiểm thử trình phát
   */
  async synthesize({ text, speed = 1.0, outputFile }) {
    // Ước lượng thời lượng đọc dựa trên số từ (khoảng 3 từ/giây ở tốc độ chuẩn)
    const words = (text || '').trim().split(/\s+/).filter(Boolean);
    const wordCount = Math.max(1, words.length);
    const baseDuration = (wordCount * 0.35) / (speed || 1.0);
    const durationSeconds = Math.min(60, Math.max(1.5, Math.round(baseDuration * 10) / 10));

    // Tạo file WAV chuẩn PCM 16-bit, 22050Hz Mono
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const byteLength = numSamples * 2;
    const buffer = Buffer.alloc(44 + byteLength);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + byteLength, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels (1 mono)
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    buffer.writeUInt16LE(2, 32); // BlockAlign (NumChannels * BitsPerSample/8)
    buffer.writeUInt16LE(16, 34); // BitsPerSample (16-bit)

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(byteLength, 40);

    // Tạo âm thanh sóng sin điều hòa ấm áp (soft sine wave chime), mô phỏng nhịp điệu phát
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Nhịp điệu thay đổi theo từng từ (tần số dao động 220Hz - 440Hz dịu nhẹ)
      const freq = 330 + 110 * Math.sin(2 * Math.PI * (t * 3));
      const envelope = Math.min(1, Math.sin((Math.PI * t) / durationSeconds)) * (0.8 + 0.2 * Math.sin(t * 12));
      const sample = Math.round(Math.sin(2 * Math.PI * freq * t) * envelope * 8000);
      buffer.writeInt16LE(sample, offset);
      offset += 2;
    }

    await fs.promises.writeFile(outputFile, buffer);

    return {
      audioPath: outputFile,
      duration: durationSeconds,
      format: 'wav',
      sizeBytes: buffer.length,
    };
  }
}

export default DemoProvider;
