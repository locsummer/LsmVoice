<script setup>
import { computed } from 'vue';
import { useTtsStore } from '../stores/ttsStore.js';

const emit = defineEmits(['notify', 'start-synthesis']);

const ttsStore = useTtsStore();

const getRegionText = (region) => {
  switch (region) {
    case 'north':
      return 'Miền Bắc';
    case 'south':
      return 'Miền Nam';
    case 'central':
      return 'Miền Trung';
    default:
      return 'Toàn quốc';
  }
};

const getProviderText = (provider) => {
  switch (provider) {
    case 'edge':
      return 'Edge Neural';
    case 'azure':
      return 'Azure';
    case 'fpt':
      return 'FPT.AI';
    case 'viettel':
      return 'Viettel';
    case 'demo':
      return 'Demo';
    default:
      return provider;
  }
};

const handleSelectVoice = (voiceId) => {
  ttsStore.selectedVoiceId = voiceId;
  ttsStore.triggerAutoSave();
};

const handlePreview = async (voice, event) => {
  event.stopPropagation();
  try {
    await ttsStore.playPreview(voice);
  } catch (err) {
    emit('notify', {
      type: 'warning',
      message: err.message || 'Dịch vụ đang khởi tạo âm thanh, vui lòng thử lại sau giây lát.',
    });
  }
};
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <!-- Panel 1: Danh sách giọng đọc cao cấp (UI8 White Panel) -->
    <div class="panel-white p-4 d-flex flex-column" style="min-height: 480px;">
      <!-- Header của Panel -->
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h2 class="section-title mb-0">Chọn giọng đọc</h2>
        <span class="badge-primary-pill">{{ ttsStore.filteredVoices.length }} giọng khả dụng</span>
      </div>
      <p class="section-desc mb-3">
        Lựa chọn chất giọng tiếng Việt phù hợp với ngữ điệu truyện dài, sách nói và tin tức.
      </p>

      <!-- Bộ lọc 3 tiêu chí: Nhà cung cấp, Giới tính, Vùng miền -->
      <div class="filter-bar p-2 rounded-3 mb-3">
        <div class="row g-2">
          <!-- Nhà cung cấp -->
          <div class="col-4">
            <select v-model="ttsStore.providerFilter" class="form-select form-select-sm filter-select">
              <option value="all">Nhà cung cấp</option>
              <option value="edge">Edge Neural</option>
              <option value="azure">Azure Speech</option>
              <option value="fpt">FPT.AI</option>
              <option value="viettel">Viettel AI</option>
              <option value="demo">Demo</option>
            </select>
          </div>

          <!-- Giới tính -->
          <div class="col-4">
            <select v-model="ttsStore.genderFilter" class="form-select form-select-sm filter-select">
              <option value="all">Giới tính</option>
              <option value="female">Giọng Nữ</option>
              <option value="male">Giọng Nam</option>
            </select>
          </div>

          <!-- Vùng miền -->
          <div class="col-4">
            <select v-model="ttsStore.regionFilter" class="form-select form-select-sm filter-select">
              <option value="all">Vùng miền</option>
              <option value="north">Miền Bắc</option>
              <option value="central">Miền Trung</option>
              <option value="south">Miền Nam</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Danh sách thẻ giọng đọc (Thoáng đãng, 1 cột hoặc 2 cột) -->
      <div class="voice-list flex-grow-1" style="max-height: 380px; overflow-y: auto;">
        <div class="d-flex flex-column gap-2 pe-1">
          <div
            v-for="voice in ttsStore.filteredVoices"
            :key="voice.id"
            class="voice-card transition-all"
            :class="{ selected: ttsStore.selectedVoiceId === voice.id }"
            @click="handleSelectVoice(voice.id)"
          >
            <div class="d-flex align-items-center justify-content-between gap-2 mb-1.5">
              <div class="d-flex align-items-center gap-2">
                <span class="voice-name">{{ voice.name }}</span>
                <span class="badge-neutral" style="font-size: 11px;">
                  {{ voice.gender === 'female' ? 'Nữ' : 'Nam' }}
                </span>
                <span class="badge-neutral" style="font-size: 11px;">
                  {{ getRegionText(voice.region) }}
                </span>
              </div>

              <!-- Dấu check khi đang chọn / Hoặc vòng tròn rỗng -->
              <div class="check-indicator">
                <i
                  v-if="ttsStore.selectedVoiceId === voice.id"
                  class="bi bi-check-circle-fill text-primary fs-5"
                ></i>
                <div v-else class="check-placeholder"></div>
              </div>
            </div>

            <div class="d-flex align-items-center justify-content-between gap-3 mt-1">
              <p class="voice-desc mb-0 text-truncate">
                {{ voice.description }}
              </p>

              <!-- Nút nghe thử nhỏ gọn -->
              <button
                type="button"
                class="btn-preview-pill flex-shrink-0"
                :disabled="ttsStore.isPreviewLoading && ttsStore.previewVoiceId === voice.id"
                @click="handlePreview(voice, $event)"
              >
                <span
                  v-if="ttsStore.isPreviewLoading && ttsStore.previewVoiceId === voice.id"
                  class="spinner-border spinner-border-sm me-1"
                ></span>
                <i
                  v-else
                  class="bi me-1"
                  :class="ttsStore.previewVoiceId === voice.id ? 'bi-stop-fill' : 'bi-play-fill'"
                ></i>
                <span>{{ ttsStore.previewVoiceId === voice.id ? 'Dừng' : 'Nghe thử' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Panel 2: Tùy chỉnh thông số giọng đọc (Tách riêng theo Section 9) -->
    <div class="panel-white p-4">
      <h3 class="section-title mb-1" style="font-size: 16px;">Tùy chỉnh giọng đọc</h3>
      <p class="section-desc mb-3" style="font-size: 13px;">
        Điều chỉnh nhịp điệu phát âm để phù hợp với từng thể loại nội dung.
      </p>

      <div class="d-flex flex-column gap-3">
        <!-- Tốc độ đọc -->
        <div>
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="control-label">Tốc độ đọc</span>
            <span class="badge-primary-pill font-monospace" style="font-size: 12px;">{{ ttsStore.speed.toFixed(2) }}x</span>
          </div>
          <input
            v-model.number="ttsStore.speed"
            type="range"
            class="form-range"
            min="0.5"
            max="2.0"
            step="0.05"
            @change="ttsStore.triggerAutoSave"
          />
        </div>

        <!-- Cao độ & Âm lượng theo 2 cột -->
        <div class="row g-3">
          <div class="col-6">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="control-label">Cao độ</span>
              <span class="text-muted small font-monospace">{{ ttsStore.pitch > 0 ? '+' : '' }}{{ ttsStore.pitch }}Hz</span>
            </div>
            <input
              v-model.number="ttsStore.pitch"
              type="range"
              class="form-range"
              min="-20"
              max="20"
              step="1"
              @change="ttsStore.triggerAutoSave"
            />
          </div>

          <div class="col-6">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="control-label">Âm lượng</span>
              <span class="text-muted small font-monospace">{{ Math.round(ttsStore.volume * 100) }}%</span>
            </div>
            <input
              v-model.number="ttsStore.volume"
              type="range"
              class="form-range"
              min="0"
              max="1"
              step="0.05"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  background: var(--surface-soft);
  border: 1px solid var(--border);
}

.filter-select {
  height: 40px;
  background-color: var(--surface) !important;
  border-radius: 10px !important;
  font-size: 13px !important;
  font-weight: 500;
  border: 1px solid var(--border) !important;
}

.voice-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.voice-card:hover {
  background: var(--surface-hover);
  border-color: var(--border-focus);
  transform: translateY(-1px);
}

.voice-card.selected {
  background: var(--primary-soft);
  border-color: var(--primary);
  box-shadow: 0 4px 14px var(--primary-soft);
}

.voice-name {
  font-size: 15px;
  font-weight: 650;
  color: var(--text-primary);
}

.voice-card.selected .voice-name {
  color: var(--primary);
}

.voice-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  max-width: 260px;
}

.check-placeholder {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
}

.btn-preview-pill {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-preview-pill:hover:not(:disabled) {
  background: var(--surface-soft);
  color: var(--primary);
  border-color: var(--primary-border);
}
</style>
