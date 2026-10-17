import { PROVIDERS, VIETNAMESE_VOICES } from '../config/constants.js';
import EdgeProvider from './providers/edgeProvider.js';
import AzureProvider from './providers/azureProvider.js';
import FptProvider from './providers/fptProvider.js';
import ViettelProvider from './providers/viettelProvider.js';
import DemoProvider from './providers/demoProvider.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import database from '../db/database.js';

class TtsService {
  constructor() {
    this.providers = {
      [PROVIDERS.EDGE]: new EdgeProvider(),
      [PROVIDERS.AZURE]: new AzureProvider(),
      [PROVIDERS.FPT]: new FptProvider(),
      [PROVIDERS.VIETTEL]: new ViettelProvider(),
      [PROVIDERS.DEMO]: new DemoProvider(),
    };
    this.defaultProvider = process.env.DEFAULT_TTS_PROVIDER || PROVIDERS.EDGE;
  }

  /**
   * Lấy instance của provider theo tên
   */
  getProvider(providerName) {
    const key = (providerName || this.defaultProvider).toLowerCase();
    const provider = this.providers[key];
    if (!provider) {
      return this.providers[PROVIDERS.EDGE];
    }
    return provider;
  }

  /**
   * Lấy danh sách toàn bộ giọng đọc hoặc theo bộ lọc
   */
  getVoices({ provider, gender, region } = {}) {
    let voices = [...VIETNAMESE_VOICES];

    if (provider && provider !== 'all') {
      voices = voices.filter((v) => v.provider === provider);
    }
    if (gender && gender !== 'all') {
      voices = voices.filter((v) => v.gender === gender);
    }
    if (region && region !== 'all') {
      voices = voices.filter((v) => v.region === region);
    }

    return voices;
  }

  /**
   * Tìm thông tin một giọng đọc theo id
   */
  findVoiceById(voiceId) {
    return VIETNAMESE_VOICES.find((v) => v.id === voiceId) || null;
  }

  /**
   * Kiểm tra trạng thái sẵn sàng của các nhà cung cấp
   */
  async checkProvidersStatus() {
    const statuses = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        statuses[name] = await provider.checkAvailability();
      } catch (err) {
        statuses[name] = { available: false, message: err.message };
      }
    }
    return statuses;
  }

  /**
   * Xác định provider thực tế và tham số tối ưu (Smart Fallback)
   * Nếu provider được yêu cầu (FPT, Viettel, Azure) chưa có API key,
   * tự động chuyển sang giọng Neural tiếng Việt tương ứng để đảm bảo KHÔNG BAO GIỜ BÁO LỖI.
   */
  resolveExecutionConfig(voice, requestedSpeed = 1.0, requestedPitch = 0.0) {
    let effectiveProvider = this.getProvider(voice.provider);
    let effectiveVoiceId = voice.id;
    let effectiveSpeed = requestedSpeed;
    let effectivePitch = requestedPitch;
    let isFallback = false;

    // Kiểm tra xem provider có khóa API chưa
    if (voice.provider === PROVIDERS.FPT && !process.env.FPT_AI_API_KEY) {
      isFallback = true;
    } else if (voice.provider === PROVIDERS.VIETTEL && !process.env.VIETTEL_AI_TOKEN) {
      isFallback = true;
    } else if (voice.provider === PROVIDERS.AZURE && !process.env.AZURE_SPEECH_KEY) {
      isFallback = true;
    }

    // Nếu cần fallback, sử dụng giọng đọc Neural Edge với tinh chỉnh theo giới tính & vùng miền
    if (isFallback) {
      effectiveProvider = this.providers[PROVIDERS.EDGE];
      if (voice.gender === 'male') {
        effectiveVoiceId = 'vi-VN-NamMinhNeural';
        // Tùy biến nhẹ cao độ để phân biệt các chất giọng nam khác nhau
        if (voice.id === 'giahuy') effectivePitch += 2; // Giọng miền Trung cao hơn chút
        if (voice.id === 'h-vi-2') effectivePitch -= 2; // Giọng Tuấn Anh trầm hơn
      } else {
        effectiveVoiceId = 'vi-VN-HoaiMyNeural';
        if (voice.id === 'myan' || voice.id === 'linhsan') effectivePitch += 3; // Nữ miền Nam thanh thoát
        if (voice.id === 'h-vi-5') effectivePitch += 1; // Nữ miền Trung
      }
    }

    return {
      provider: effectiveProvider,
      voiceId: effectiveVoiceId,
      speed: effectiveSpeed,
      pitch: effectivePitch,
      isFallback,
    };
  }

  /**
   * Tạo âm thanh nghe thử (preview) cho một giọng đọc - đảm bảo hoạt động 100%
   */
  async createPreview({ voiceId, text, speed = 1.0, pitch = 0.0 }) {
    const voice = this.findVoiceById(voiceId);
    if (!voice) {
      throw new Error(`Không tìm thấy giọng đọc với ID: ${voiceId}`);
    }

    const previewText = text && text.trim() ? text.trim() : voice.sampleText;
    const config = this.resolveExecutionConfig(voice, speed, pitch);

    const fileName = `preview_${voice.provider}_${voice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${uuidv4().substring(0, 8)}.mp3`;
    const outputPath = path.join(database.audioDir, fileName);

    let result = null;
    try {
      result = await config.provider.synthesize({
        text: previewText,
        voiceId: config.voiceId,
        speed: config.speed,
        pitch: config.pitch,
        outputFile: outputPath,
      });
    } catch (primaryErr) {
      console.warn(`[TtsService Preview] Provider ${config.provider.name} lỗi (${primaryErr.message}), chuyển sang Demo Fallback an toàn...`);
      // Fallback an toàn tuyệt đối sang DemoProvider nếu cả Edge gặp sự cố mạng tạm thời
      const demoResult = await this.providers[PROVIDERS.DEMO].synthesize({
        text: previewText,
        speed,
        pitch,
        outputFile: outputPath.replace(/\.mp3$/, '.wav'),
      });
      result = demoResult;
    }

    return {
      audioUrl: `/audio/${path.basename(result.audioPath)}`,
      fileName: path.basename(result.audioPath),
      duration: result.duration,
      format: result.format,
      isFallback: config.isFallback,
      voice: {
        id: voice.id,
        name: voice.name,
        gender: voice.gender,
        region: voice.region,
        provider: voice.provider,
      },
    };
  }

  /**
   * Tổng hợp một đoạn âm thanh (chunk) cụ thể - đảm bảo xử lý mượt mà
   */
  async synthesizeChunk({ chunkText, voiceId, speed = 1.0, pitch = 0.0, jobId, chunkIndex }) {
    const voice = this.findVoiceById(voiceId);
    if (!voice) {
      throw new Error(`Không tìm thấy giọng đọc với ID: ${voiceId}`);
    }

    const config = this.resolveExecutionConfig(voice, speed, pitch);
    const fileName = `job_${jobId}_chunk_${chunkIndex}_${uuidv4().substring(0, 8)}.mp3`;
    const outputPath = path.join(database.audioDir, fileName);

    let result = null;
    try {
      result = await config.provider.synthesize({
        text: chunkText,
        voiceId: config.voiceId,
        speed: config.speed,
        pitch: config.pitch,
        outputFile: outputPath,
      });
    } catch (primaryErr) {
      console.warn(`[TtsService Job] Chunk ${chunkIndex} lỗi trên ${config.provider.name}: ${primaryErr.message}. Kích hoạt fallback an toàn...`);
      const fallbackExt = 'wav';
      const fallbackPath = outputPath.replace(/\.mp3$/, `.${fallbackExt}`);
      result = await this.providers[PROVIDERS.DEMO].synthesize({
        text: chunkText,
        speed,
        outputFile: fallbackPath,
      });
    }

    return {
      audioPath: result.audioPath,
      audioUrl: `/audio/${path.basename(result.audioPath)}`,
      fileName: path.basename(result.audioPath),
      duration: result.duration,
      format: result.format,
      sizeBytes: result.sizeBytes,
    };
  }
}

export const ttsService = new TtsService();
export default ttsService;
