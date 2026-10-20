import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  fetchVoices,
  fetchProvidersStatus,
  previewVoice,
  createTtsJob,
  getTtsJob,
  cancelTtsJob,
  retryTtsChunk,
  GuestStorage,
} from '../services/api.js';

export const MAX_CHAR_LIMIT = 50000;

export const DEFAULT_VOICES = [
  {
    id: 'vi-VN-HoaiMyNeural',
    provider: 'edge',
    name: 'Hoài My',
    gender: 'female',
    region: 'north',
    description: 'Giọng nữ miền Bắc nhẹ nhàng, truyền cảm, thích hợp đọc truyện, tiểu thuyết và tin tức',
    sampleText: 'Chào bạn, tôi là Hoài My. Chúc bạn có những phút giây nghe truyện thư giãn và tuyệt vời.',
    supportsSpeed: true,
    supportsPitch: true,
    isNeural: true,
  },
  {
    id: 'vi-VN-NamMinhNeural',
    provider: 'edge',
    name: 'Nam Minh',
    gender: 'male',
    region: 'north',
    description: 'Giọng nam miền Bắc trầm ấm, đĩnh đạc, phù hợp với truyện kiếm hiệp, tài liệu và văn bản dài',
    sampleText: 'Xin chào, tôi là Nam Minh. Tôi có thể đọc các tác phẩm văn học và tài liệu dài với chất giọng trầm ấm.',
    supportsSpeed: true,
    supportsPitch: true,
    isNeural: true,
  },
  {
    id: 'vi-VN-DaLatNeural',
    provider: 'edge',
    name: 'Đà Lạt',
    gender: 'female',
    region: 'south',
    description: 'Giọng nữ miền Nam trong trẻo, tự nhiên, ngọt ngào và dễ nghe',
    sampleText: 'Dạ xin chào mọi người, tôi là Đà Lạt, rất vui được đồng hành cùng quý thính giả.',
    supportsSpeed: true,
    supportsPitch: true,
    isNeural: true,
  },
  {
    id: 'banmai',
    provider: 'fpt',
    name: 'Ban Mai',
    gender: 'female',
    region: 'north',
    description: 'Giọng nữ miền Bắc quen thuộc của FPT.AI, rõ ràng, tốc độ vừa phải',
    sampleText: 'Chào bạn, tôi là Ban Mai, giọng đọc nữ miền Bắc từ nền tảng FPT.AI.',
    supportsSpeed: true,
    supportsPitch: false,
    isNeural: true,
  },
  {
    id: 'thuminh',
    provider: 'fpt',
    name: 'Thu Minh',
    gender: 'female',
    region: 'north',
    description: 'Giọng nữ miền Bắc truyền cảm, thích hợp đọc truyện tâm sự, tản văn',
    sampleText: 'Chào bạn, tôi là Thu Minh, hy vọng giọng đọc này sẽ mang lại cảm xúc lắng đọng cho bạn.',
    supportsSpeed: true,
    supportsPitch: false,
    isNeural: true,
  },
  {
    id: 'leminh',
    provider: 'fpt',
    name: 'Lê Minh',
    gender: 'male',
    region: 'north',
    description: 'Giọng nam miền Bắc dõng dạc, phát âm chuẩn, phù hợp tin tức và tài liệu',
    sampleText: 'Tôi là Lê Minh, giọng đọc nam miền Bắc sẵn sàng chuyển đổi văn bản của bạn thành âm thanh.',
    supportsSpeed: true,
    supportsPitch: false,
    isNeural: true,
  },
  {
    id: 'myan',
    provider: 'fpt',
    name: 'Mỹ An',
    gender: 'female',
    region: 'south',
    description: 'Giọng nữ miền Nam dịu dàng, tự nhiên, ngọt ngào',
    sampleText: 'Xin chào các bạn, em là Mỹ An, giọng đọc miền Nam rất hân hạnh được phục vụ.',
    supportsSpeed: true,
    supportsPitch: false,
    isNeural: true,
  },
  {
    id: 'giahuy',
    provider: 'fpt',
    name: 'Gia Huy',
    gender: 'male',
    region: 'central',
    description: 'Giọng nam miền Trung đầm ấm, mộc mạc, tạo nét đặc trưng cho tác phẩm',
    sampleText: 'Xin chào bà con cô bác, tôi là Gia Huy, mang chất giọng miền Trung chân chất và mộc mạc.',
    supportsSpeed: true,
    supportsPitch: false,
    isNeural: true,
  },
  {
    id: 'linhsan',
    provider: 'fpt',
    name: 'Linh San',
    gender: 'female',
    region: 'south',
    description: 'Giọng nữ miền Nam trẻ trung, năng động',
    sampleText: 'Chào các bạn, mình là Linh San với giọng đọc trẻ trung và sinh động.',
    supportsSpeed: true,
    supportsPitch: false,
    isNeural: true,
  },
];

export const useTtsStore = defineStore('tts', () => {
  // --- Text State ---
  const title = ref('');
  const text = ref('');
  const lastSavedAt = ref(null);
  const isDraftSaved = ref(false);

  // --- Voice Selection & Filters ---
  const voices = ref([...DEFAULT_VOICES]);
  const providersStatus = ref({});
  const selectedVoiceId = ref('vi-VN-HoaiMyNeural');
  const speed = ref(1.0);
  const pitch = ref(0.0);
  const volume = ref(1.0);

  const providerFilter = ref('all');
  const genderFilter = ref('all');
  const regionFilter = ref('all');

  // --- Voice Preview State ---
  const isPreviewLoading = ref(false);
  const previewVoiceId = ref(null);
  const previewAudio = ref(null);

  // --- Synthesis Job State ---
  const isSynthesizing = ref(false);
  const activeJob = ref(null);
  const jobPollInterval = ref(null);
  const activeJobError = ref(null);

  // --- Computed ---
  const charCount = computed(() => (text.value ? text.value.length : 0));
  const charPercentage = computed(() =>
    Math.min(100, Math.round((charCount.value / MAX_CHAR_LIMIT) * 100))
  );

  const isOverLimit = computed(() => charCount.value > MAX_CHAR_LIMIT);

  const filteredVoices = computed(() => {
    return voices.value.filter((voice) => {
      const matchProvider =
        providerFilter.value === 'all' || voice.provider === providerFilter.value;
      const matchGender =
        genderFilter.value === 'all' || voice.gender === genderFilter.value;
      const matchRegion =
        regionFilter.value === 'all' || voice.region === regionFilter.value;
      return matchProvider && matchGender && matchRegion;
    });
  });

  const selectedVoice = computed(() => {
    return (
      voices.value.find((v) => v.id === selectedVoiceId.value) ||
      voices.value[0] ||
      null
    );
  });

  // --- Methods ---

  /**
   * Cập nhật nội dung văn bản với kiểm tra giới hạn 50.000 ký tự
   */
  const setText = (newText) => {
    if (newText && newText.length > MAX_CHAR_LIMIT) {
      text.value = newText.substring(0, MAX_CHAR_LIMIT);
      triggerAutoSave();
      return {
        truncated: true,
        message: `Đã cắt bớt văn bản đến giới hạn tối đa ${MAX_CHAR_LIMIT.toLocaleString('vi-VN')} ký tự.`,
      };
    }
    text.value = newText || '';
    triggerAutoSave();
    return { truncated: false };
  };

  /**
   * Tự động lưu bản nháp vào LocalStorage để chống mất dữ liệu khi refresh
   */
  let debounceTimer = null;
  const triggerAutoSave = () => {
    isDraftSaved.value = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      GuestStorage.saveDraft({
        title: title.value,
        text: text.value,
        voiceId: selectedVoiceId.value,
        speed: speed.value,
        pitch: pitch.value,
        savedAt: new Date().toISOString(),
      });
      isDraftSaved.value = true;
      lastSavedAt.value = new Date();
    }, 600);
  };

  /**
   * Tải bản nháp đã lưu
   */
  const loadDraft = () => {
    const draft = GuestStorage.getDraft();
    if (draft.text) {
      text.value = draft.text;
      title.value = draft.title || '';
      if (draft.voiceId) selectedVoiceId.value = draft.voiceId;
      if (draft.speed) speed.value = draft.speed;
      if (draft.pitch) pitch.value = draft.pitch;
      isDraftSaved.value = true;
      lastSavedAt.value = draft.savedAt ? new Date(draft.savedAt) : null;
    }
  };

  /**
   * Xóa nội dung văn bản
   */
  const clearText = () => {
    text.value = '';
    title.value = '';
    triggerAutoSave();
  };

  /**
   * Lấy danh sách giọng đọc từ server
   */
  const loadVoices = async () => {
    try {
      const [voicesRes, providersRes] = await Promise.all([
        fetchVoices(),
        fetchProvidersStatus(),
      ]);
      if (voicesRes.data && voicesRes.data.voices && voicesRes.data.voices.length > 0) {
        voices.value = voicesRes.data.voices;
        // Đảm bảo có giọng được chọn
        if (!selectedVoiceId.value && voices.value.length > 0) {
          selectedVoiceId.value = voices.value[0].id;
        }
      }
      if (providersRes.data && providersRes.data.statuses) {
        providersStatus.value = providersRes.data.statuses;
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách giọng đọc:', err);
    }
  };

  /**
   * Nghe thử mẫu giọng đọc (Có bộ nhớ đệm cache để phát ngay tức thì khi chuyển đổi qua lại)
   */
  const previewCache = new Map();
  const playPreview = async (voice) => {
    const isCurrentlyPlayingThis = previewVoiceId.value === voice.id;
    if (previewAudio.value) {
      previewAudio.value.pause();
      previewAudio.value = null;
    }

    if (isCurrentlyPlayingThis) {
      previewVoiceId.value = null;
      return;
    }

    previewVoiceId.value = voice.id;

    const cacheKey = `${voice.id}-${speed.value}-${pitch.value}`;
    let audioUrl = previewCache.get(cacheKey);

    if (!audioUrl) {
      isPreviewLoading.value = true;
      try {
        const res = await previewVoice({
          voiceId: voice.id,
          text: voice.sampleText,
          speed: speed.value,
          pitch: pitch.value,
        });
        audioUrl = res.data?.audioUrl;
        if (audioUrl) {
          previewCache.set(cacheKey, audioUrl);
        }
      } catch (err) {
        console.error('Không thể phát thử giọng đọc:', err);
        previewVoiceId.value = null;
        throw err;
      } finally {
        isPreviewLoading.value = false;
      }
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      previewAudio.value = audio;
      audio.onended = () => {
        previewVoiceId.value = null;
      };
      audio.onerror = () => {
        previewVoiceId.value = null;
      };
      try {
        await audio.play();
      } catch (_) {
        previewVoiceId.value = null;
      }
    }
  };

  const stopPreview = () => {
    if (previewAudio.value) {
      previewAudio.value.pause();
      previewAudio.value = null;
    }
    previewVoiceId.value = null;
  };

  /**
   * Bắt đầu chuyển văn bản thành audio qua Job Queue
   */
  const startJob = async () => {
    if (!text.value.trim()) {
      throw new Error('Vui lòng nhập hoặc dán nội dung văn bản trước khi tạo audio.');
    }

    if (charCount.value > MAX_CHAR_LIMIT) {
      throw new Error(`Nội dung vượt quá giới hạn ${MAX_CHAR_LIMIT.toLocaleString('vi-VN')} ký tự.`);
    }

    isSynthesizing.value = true;
    activeJobError.value = null;

    try {
      const res = await createTtsJob({
        title: title.value.trim() || 'Nội dung đọc audio',
        text: text.value.trim(),
        voiceId: selectedVoiceId.value,
        speed: speed.value,
        pitch: pitch.value,
      });

      const initialJob = res.data;
      activeJob.value = initialJob;

      // Bắt đầu polling tiến trình
      startPolling(initialJob.id);

      return initialJob;
    } catch (err) {
      isSynthesizing.value = false;
      activeJobError.value = err.message;
      throw err;
    }
  };

  /**
   * Polling định kỳ theo dõi trạng thái job
   */
  const startPolling = (jobId) => {
    if (jobPollInterval.value) clearInterval(jobPollInterval.value);

    jobPollInterval.value = setInterval(async () => {
      try {
        const res = await getTtsJob(jobId);
        const job = res.data;
        activeJob.value = job;

        if (job.status === 'completed') {
          clearInterval(jobPollInterval.value);
          isSynthesizing.value = false;
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(jobPollInterval.value);
          isSynthesizing.value = false;
          if (job.status === 'failed') {
            activeJobError.value = job.errorMessage || 'Tạo audio gặp lỗi ở một số đoạn.';
          }
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra tiến trình:', err);
      }
    }, 1500);
  };

  /**
   * Hủy tác vụ đang chạy
   */
  const cancelJob = async () => {
    if (!activeJob.value) return;
    try {
      await cancelTtsJob(activeJob.value.id);
      if (jobPollInterval.value) clearInterval(jobPollInterval.value);
      isSynthesizing.value = false;
      if (activeJob.value) {
        activeJob.value.status = 'cancelled';
      }
    } catch (err) {
      console.error('Không thể hủy tác vụ:', err);
      throw err;
    }
  };

  /**
   * Thử lại một chunk bị lỗi
   */
  const retryChunk = async (chunkId) => {
    try {
      await retryTtsChunk(chunkId);
      // Tiếp tục theo dõi trạng thái job
      if (activeJob.value) {
        startPolling(activeJob.value.id);
      }
    } catch (err) {
      console.error('Lỗi khi thử lại chunk:', err);
      throw err;
    }
  };

  return {
    title,
    text,
    lastSavedAt,
    isDraftSaved,
    charCount,
    charPercentage,
    isOverLimit,
    voices,
    providersStatus,
    selectedVoiceId,
    selectedVoice,
    speed,
    pitch,
    volume,
    providerFilter,
    genderFilter,
    regionFilter,
    filteredVoices,
    isPreviewLoading,
    previewVoiceId,
    isSynthesizing,
    activeJob,
    activeJobError,
    setText,
    triggerAutoSave,
    loadDraft,
    clearText,
    loadVoices,
    playPreview,
    stopPreview,
    startJob,
    cancelJob,
    retryChunk,
  };
});
