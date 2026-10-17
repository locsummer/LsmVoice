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

export const useTtsStore = defineStore('tts', () => {
  // --- Text State ---
  const title = ref('');
  const text = ref('');
  const lastSavedAt = ref(null);
  const isDraftSaved = ref(false);

  // --- Voice Selection & Filters ---
  const voices = ref([]);
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
      if (voicesRes.data && voicesRes.data.voices) {
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
   * Nghe thử mẫu giọng đọc
   */
  const playPreview = async (voice) => {
    if (previewAudio.value) {
      previewAudio.value.pause();
      previewAudio.value = null;
    }

    previewVoiceId.value = voice.id;
    isPreviewLoading.value = true;

    try {
      const res = await previewVoice({
        voiceId: voice.id,
        text: voice.sampleText,
        speed: speed.value,
        pitch: pitch.value,
      });

      const audio = new Audio(res.data.audioUrl);
      previewAudio.value = audio;
      audio.onended = () => {
        previewVoiceId.value = null;
      };
      audio.onerror = () => {
        previewVoiceId.value = null;
      };
      await audio.play();
    } catch (err) {
      console.error('Không thể phát thử giọng đọc:', err);
      previewVoiceId.value = null;
      throw err;
    } finally {
      isPreviewLoading.value = false;
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
