<script setup>
import { onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '../stores/playerStore.js';

const emit = defineEmits(['open-exporter']);

const playerStore = usePlayerStore();
const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const handleSeekChange = (e) => {
  playerStore.seek(parseFloat(e.target.value));
};

const handleSpeedChange = (speed) => {
  playerStore.setSpeed(speed);
};

const handleKeyDown = (e) => {
  const tag = e.target.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'input') return;

  if (e.code === 'Space') {
    e.preventDefault();
    playerStore.togglePlay();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    playerStore.skip(-10);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    playerStore.skip(10);
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    playerStore.setVolume(playerStore.volume + 0.1);
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    playerStore.setVolume(playerStore.volume - 0.1);
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    playerStore.toggleMute();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="playerStore.currentAudioUrl" class="floating-player-wrapper">
    <div class="ui8-player-card">
      <!-- Thanh Scrubber mảnh tinh tế ở đỉnh Player -->
      <div class="d-flex align-items-center gap-2 mb-2 px-1">
        <span class="text-muted font-monospace small" style="font-size: 11px; min-width: 42px;">
          {{ playerStore.formattedCurrentTime }}
        </span>
        <input
          type="range"
          class="ui8-scrubber flex-grow-1"
          min="0"
          :max="playerStore.duration || 100"
          step="0.1"
          :value="playerStore.currentTime"
          @input="handleSeekChange"
        />
        <span class="text-muted font-monospace small text-end" style="font-size: 11px; min-width: 42px;">
          {{ playerStore.formattedDuration }}
        </span>
      </div>

      <!-- Bảng điều khiển chính -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <!-- Cột trái: Tên tác phẩm & Tên giọng đọc -->
        <div class="d-flex align-items-center gap-2 gap-sm-3 player-info-col">
          <div class="player-icon-box d-none d-sm-flex">
            <i class="bi bi-music-note-beamed text-primary fs-5"></i>
          </div>
          <div class="overflow-hidden">
            <div class="fw-semibold text-main text-truncate player-title">
              {{ playerStore.currentTitle || 'Văn bản audio' }}
            </div>
            <div class="text-muted text-truncate small" style="font-size: 11.5px;">
              {{ playerStore.currentVoiceName }}
              <span v-if="playerStore.chunks.length > 1" class="ms-1 opacity-75">
                • {{ playerStore.currentChunkIndex + 1 }}/{{ playerStore.chunks.length }}
              </span>
            </div>
          </div>
        </div>

        <!-- Cột giữa: Cụm điều khiển Play / Tua lùi / Tua tiến -->
        <div class="d-flex align-items-center gap-1 gap-sm-2 player-controls-col">
          <!-- Phân đoạn trước -->
          <button
            type="button"
            class="control-btn d-none d-sm-flex"
            :disabled="!playerStore.hasPrev && playerStore.currentTime <= 3"
            @click="playerStore.prevChunk"
            title="Đoạn trước"
          >
            <i class="bi bi-skip-start-fill"></i>
          </button>

          <!-- Tua lùi 10s -->
          <button
            type="button"
            class="control-btn"
            @click="playerStore.skip(-10)"
            title="Tua lùi 10 giây (←)"
          >
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>

          <!-- Nút Play/Pause chính (Hình tròn màu xanh dương) -->
          <button
            type="button"
            class="ui8-play-btn"
            :disabled="playerStore.isLoading"
            @click="playerStore.togglePlay"
            title="Phát / Tạm dừng (Space)"
          >
            <span v-if="playerStore.isLoading" class="spinner-border spinner-border-sm text-white" role="status"></span>
            <i v-else class="bi fs-4 text-white" :class="playerStore.isPlaying ? 'bi-pause-fill' : 'bi-play-fill'"></i>
          </button>

          <!-- Tua tiến 10s -->
          <button
            type="button"
            class="control-btn"
            @click="playerStore.skip(10)"
            title="Tua tới 10 giây (→)"
          >
            <i class="bi bi-arrow-clockwise"></i>
          </button>

          <!-- Phân đoạn tiếp theo -->
          <button
            type="button"
            class="control-btn d-none d-sm-flex"
            :disabled="!playerStore.hasNext"
            @click="playerStore.nextChunk"
            title="Đoạn tiếp theo"
          >
            <i class="bi bi-skip-end-fill"></i>
          </button>
        </div>

        <!-- Cột phải: Tốc độ phát, Âm lượng, Đồng bộ, Tải xuống -->
        <div class="d-flex align-items-center gap-2">
          <!-- Dropdown Tốc độ -->
          <div class="dropdown">
            <button
              class="pill-option-btn dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {{ playerStore.playbackRate }}x
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border hairline-border py-1" style="min-width: 90px; border-radius: var(--radius-sm);">
              <li v-for="speed in speeds" :key="speed">
                <button
                  class="dropdown-item small text-center"
                  :class="{ 'fw-bold text-primary bg-primary-subtle': playerStore.playbackRate === speed }"
                  @click="handleSpeedChange(speed)"
                >
                  {{ speed }}x
                </button>
              </li>
            </ul>
          </div>

          <!-- Âm lượng -->
          <div class="d-none d-md-flex align-items-center gap-1">
            <button
              type="button"
              class="control-btn"
              @click="playerStore.toggleMute"
              title="Bật/Tắt âm thanh (M)"
            >
              <i class="bi" :class="playerStore.isMuted ? 'bi-volume-mute-fill text-danger' : 'bi-volume-up-fill'"></i>
            </button>
            <input
              type="range"
              class="form-range"
              style="width: 70px; height: 4px;"
              min="0"
              max="1"
              step="0.05"
              :value="playerStore.isMuted ? 0 : playerStore.volume"
              @input="playerStore.setVolume(parseFloat($event.target.value))"
            />
          </div>

          <!-- Nút Tải xuống / Xuất bản -->
          <button
            type="button"
            class="pill-option-btn"
            @click="emit('open-exporter')"
            title="Tải tệp âm thanh MP3 hoặc văn bản"
          >
            <i class="bi bi-download"></i>
            <span class="d-none d-sm-inline">Tải về</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-player-wrapper {
  position: fixed;
  bottom: 16px;
  left: 0;
  right: 0;
  padding: 0 16px;
  z-index: 1050;
  pointer-events: none;
}

.ui8-player-card {
  max-width: 1200px;
  margin: 0 auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  padding: 14px 20px;
  pointer-events: auto;
}

.player-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ui8-scrubber {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--surface-hover);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

.ui8-scrubber::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 2px 6px rgba(120, 150, 255, 0.4);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.ui8-scrubber::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.control-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-btn:hover:not(:disabled) {
  background: var(--surface-soft);
  color: var(--primary);
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ui8-play-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  box-shadow: 0 4px 14px rgba(66, 133, 244, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.ui8-play-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: scale(1.06);
  box-shadow: 0 6px 18px rgba(66, 133, 244, 0.45);
}

.pill-option-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill-option-btn:hover {
  background: var(--surface-soft);
  color: var(--primary);
}

@media (max-width: 768px) {
  .floating-player-wrapper {
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    padding: 0 !important;
  }

  .ui8-player-card {
    border-radius: 16px 16px 0 0 !important;
    border-bottom: none !important;
    border-left: none !important;
    border-right: none !important;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.25) !important;
    padding: 8px 12px max(8px, env(safe-area-inset-bottom)) 12px !important;
  }

  .player-info-col {
    max-width: 44% !important;
  }

  .player-title {
    font-size: 13.5px !important;
  }

  .control-btn {
    width: 32px !important;
    height: 32px !important;
    font-size: 14px !important;
  }

  .ui8-play-btn {
    width: 38px !important;
    height: 38px !important;
  }
}
</style>
