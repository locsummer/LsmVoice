import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { logHistory, GuestStorage, resolveBackendUrl } from '../services/api.js';

export const usePlayerStore = defineStore('player', () => {
  // --- Audio Instance & Core State ---
  const audioElement = new Audio();
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const hasError = ref(false);
  const errorMessage = ref('');

  // --- Track Metadata ---
  const currentTitle = ref('');
  const currentVoiceName = ref('');
  const currentAudioUrl = ref('');
  const currentLibraryId = ref(null);
  const currentJobId = ref(null);

  // --- Chunks Playlist (hỗ trợ đọc nối tiếp và đồng bộ văn bản) ---
  const chunks = ref([]); // [{ index: 0, text: '...', audioUrl: '...', duration: 12.5 }, ...]
  const currentChunkIndex = ref(0);

  // --- Time & Progress ---
  const currentTime = ref(0);
  const duration = ref(0);
  const playbackRate = ref(1.0);
  const volume = ref(1.0);
  const isMuted = ref(false);
  const repeatMode = ref('off'); // 'off', 'one', 'all'

  // --- Formatted Time Helpers ---
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remainingMins = mins % 60;
      return `${hrs.toString().padStart(2, '0')}:${remainingMins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formattedCurrentTime = computed(() => formatTime(currentTime.value));
  const formattedDuration = computed(() => formatTime(duration.value));

  const progressPercent = computed(() => {
    if (!duration.value || duration.value === 0) return 0;
    return Math.min(100, (currentTime.value / duration.value) * 100);
  });

  const hasNext = computed(() => currentChunkIndex.value < chunks.value.length - 1);
  const hasPrev = computed(() => currentChunkIndex.value > 0);

  // --- Audio Event Listeners ---
  audioElement.addEventListener('timeupdate', () => {
    currentTime.value = audioElement.currentTime;
    // Tự động lưu tiến trình mỗi 5 giây
    if (Math.floor(currentTime.value) % 5 === 0) {
      persistListeningProgress();
    }
  });

  audioElement.addEventListener('loadedmetadata', () => {
    if (audioElement.duration && !isNaN(audioElement.duration)) {
      duration.value = audioElement.duration;
    }
    isLoading.value = false;
  });

  audioElement.addEventListener('waiting', () => {
    isLoading.value = true;
  });

  audioElement.addEventListener('playing', () => {
    isLoading.value = false;
    isPlaying.value = true;
    hasError.value = false;
  });

  audioElement.addEventListener('pause', () => {
    isPlaying.value = false;
  });

  audioElement.addEventListener('ended', () => {
    handleTrackEnded();
  });

  audioElement.addEventListener('error', (e) => {
    isLoading.value = false;
    isPlaying.value = false;
    hasError.value = true;
    errorMessage.value = 'Không thể phát tệp âm thanh này hoặc định dạng không được hỗ trợ.';
    console.error('Audio Player Error:', e);
  });

  // --- Player Methods ---

  /**
   * Tải và phát nội dung âm thanh
   */
  const loadTrack = ({
    title,
    voiceName,
    audioUrl,
    chunksList = [],
    libraryId = null,
    jobId = null,
    resumePosition = 0,
    autoPlay = true,
  }) => {
    currentTitle.value = title || 'Văn bản audio';
    currentVoiceName.value = voiceName || 'Giọng đọc chuẩn';
    currentLibraryId.value = libraryId;
    currentJobId.value = jobId;
    chunks.value = chunksList;
    currentChunkIndex.value = 0;

    let targetUrl = audioUrl;
    // Nếu có danh sách chunks và không có audioUrl đơn lẻ (hoặc phát theo chunk)
    if ((!targetUrl || targetUrl === '') && chunksList.length > 0) {
      targetUrl = chunksList[0].audioUrl;
    }

    setSource(targetUrl, resumePosition, autoPlay);
  };

  /**
   * Thiết lập nguồn audio và phát
   */
  const setSource = (url, seekTo = 0, autoPlay = true) => {
    if (!url) return;
    currentAudioUrl.value = url;
    isLoading.value = true;
    hasError.value = false;

    const resolvedUrl = resolveBackendUrl(url);
    audioElement.src = resolvedUrl;
    audioElement.playbackRate = playbackRate.value;
    audioElement.volume = isMuted.value ? 0 : volume.value;

    if (seekTo > 0) {
      audioElement.currentTime = seekTo;
      currentTime.value = seekTo;
    } else {
      currentTime.value = 0;
    }

    if (autoPlay) {
      play();
    }
  };

  const play = () => {
    if (!audioElement.src) return;
    audioElement
      .play()
      .then(() => {
        isPlaying.value = true;
      })
      .catch((err) => {
        console.warn('Tự động phát bị chặn hoặc cần thao tác người dùng:', err);
        isPlaying.value = false;
      });
  };

  const pause = () => {
    audioElement.pause();
    isPlaying.value = false;
    persistListeningProgress();
  };

  const togglePlay = () => {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  };

  /**
   * Tua đến vị trí cụ thể (giây)
   */
  const seek = (seconds) => {
    if (!audioElement.duration) return;
    const clamped = Math.max(0, Math.min(seconds, audioElement.duration));
    audioElement.currentTime = clamped;
    currentTime.value = clamped;
  };

  /**
   * Tua nhanh hoặc lùi (+/- 10s)
   */
  const skip = (delta) => {
    seek(currentTime.value + delta);
  };

  /**
   * Đổi tốc độ phát: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x
   */
  const setSpeed = (rate) => {
    playbackRate.value = rate;
    audioElement.playbackRate = rate;
  };

  /**
   * Đổi âm lượng: 0.0 - 1.0
   */
  const setVolume = (val) => {
    const clamped = Math.max(0, Math.min(1, val));
    volume.value = clamped;
    if (clamped > 0 && isMuted.value) {
      isMuted.value = false;
    }
    audioElement.volume = clamped;
  };

  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    audioElement.volume = isMuted.value ? 0 : volume.value;
  };

  const setRepeatMode = (mode) => {
    repeatMode.value = mode;
  };

  /**
   * Chuyển đến đoạn tiếp theo
   */
  const nextChunk = () => {
    if (hasNext.value) {
      currentChunkIndex.value++;
      const nextC = chunks.value[currentChunkIndex.value];
      if (nextC && nextC.audioUrl) {
        setSource(nextC.audioUrl, 0, true);
      }
    }
  };

  /**
   * Chuyển về đoạn trước
   */
  const prevChunk = () => {
    if (currentTime.value > 3) {
      // Nếu đã phát hơn 3s thì tua về đầu đoạn hiện tại
      seek(0);
      return;
    }
    if (hasPrev.value) {
      currentChunkIndex.value--;
      const prevC = chunks.value[currentChunkIndex.value];
      if (prevC && prevC.audioUrl) {
        setSource(prevC.audioUrl, 0, true);
      }
    }
  };

  /**
   * Nhảy thẳng tới một chunk chỉ định (dùng khi bấm vào văn bản đồng bộ)
   */
  const playChunk = (index) => {
    if (index >= 0 && index < chunks.value.length) {
      currentChunkIndex.value = index;
      const targetChunk = chunks.value[index];
      if (targetChunk && targetChunk.audioUrl) {
        setSource(targetChunk.audioUrl, 0, true);
      }
    }
  };

  /**
   * Xử lý khi hết bài / hết đoạn
   */
  const handleTrackEnded = () => {
    if (repeatMode.value === 'one') {
      seek(0);
      play();
      return;
    }

    if (hasNext.value) {
      nextChunk();
    } else {
      if (repeatMode.value === 'all' && chunks.value.length > 0) {
        playChunk(0);
      } else {
        isPlaying.value = false;
        persistListeningProgress(true); // Đánh dấu hoàn thành 100%
      }
    }
  };

  /**
   * Lưu vị trí nghe vào server hoặc localStorage
   */
  const persistListeningProgress = async (completed = false) => {
    if (!currentTitle.value) return;

    const data = {
      libraryId: currentLibraryId.value,
      jobId: currentJobId.value,
      title: currentTitle.value,
      voiceName: currentVoiceName.value,
      lastPosition: Math.round(currentTime.value),
      totalDuration: Math.round(duration.value),
      completed,
    };

    try {
      await logHistory(data);
    } catch (_) {
      // Fallback sang GuestStorage nếu chưa đăng nhập
      GuestStorage.saveHistoryItem(data);
    }
  };

  const closePlayer = () => {
    pause();
    currentAudioUrl.value = '';
    currentTitle.value = '';
    chunks.value = [];
    currentTime.value = 0;
    duration.value = 0;
  };

  return {
    closePlayer,
    isPlaying,
    isLoading,
    hasError,
    errorMessage,
    currentTitle,
    currentVoiceName,
    currentAudioUrl,
    currentLibraryId,
    currentJobId,
    chunks,
    currentChunkIndex,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    repeatMode,
    formattedCurrentTime,
    formattedDuration,
    progressPercent,
    hasNext,
    hasPrev,
    loadTrack,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    setSpeed,
    setVolume,
    toggleMute,
    setRepeatMode,
    nextChunk,
    prevChunk,
    playChunk,
    persistListeningProgress,
  };
});
