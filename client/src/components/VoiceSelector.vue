<script setup>
import { ref, computed } from 'vue';
import { useTtsStore } from '../stores/ttsStore.js';

const emit = defineEmits(['notify', 'start-synthesis']);

const ttsStore = useTtsStore();

const currentMobileFilter = ref('all');

const setMobileFilter = (filterKey) => {
  currentMobileFilter.value = filterKey;
  if (filterKey === 'all') {
    ttsStore.providerFilter = 'all';
    ttsStore.genderFilter = 'all';
    ttsStore.regionFilter = 'all';
  } else if (filterKey === 'north' || filterKey === 'south' || filterKey === 'central') {
    ttsStore.regionFilter = filterKey;
    ttsStore.genderFilter = 'all';
  } else if (filterKey === 'female' || filterKey === 'male') {
    ttsStore.genderFilter = filterKey;
    ttsStore.regionFilter = 'all';
  }
};

const getInitials = (name) => {
  if (!name) return 'AI';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getRegionText = (region) => {
  switch (region) {
    case 'north':
      return 'Bắc';
    case 'south':
      return 'Nam';
    case 'central':
      return 'Trung';
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
    <div class="panel-white p-3 p-sm-4 d-flex flex-column voice-selector-panel">
      <!-- Header của Panel -->
      <div class="d-flex align-items-center justify-content-between mb-1.5">
        <h2 class="section-title mb-0">Chọn giọng đọc</h2>
        <span class="badge-primary-pill">{{ ttsStore.filteredVoices.length }} giọng</span>
      </div>
      <p class="section-desc mb-2.5 d-none d-sm-block">
        Lựa chọn chất giọng tiếng Việt phù hợp với ngữ điệu truyện dài, sách nói và tin tức.
      </p>

      <!-- Thanh cuộn Chip lọc ngang vuốt chạm cho Điện thoại (< 768px) -->
      <div class="mobile-filter-chips d-md-none mb-2.5">
        <button
          type="button"
          class="filter-chip"
          :class="{ active: currentMobileFilter === 'all' }"
          @click="setMobileFilter('all')"
        >
          <span>Tất cả</span>
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: currentMobileFilter === 'north' }"
          @click="setMobileFilter('north')"
        >
          <span>Miền Bắc</span>
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: currentMobileFilter === 'south' }"
          @click="setMobileFilter('south')"
        >
          <span>Miền Nam</span>
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: currentMobileFilter === 'central' }"
          @click="setMobileFilter('central')"
        >
          <span>Miền Trung</span>
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: currentMobileFilter === 'female' }"
          @click="setMobileFilter('female')"
        >
          <span>Giọng Nữ</span>
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: currentMobileFilter === 'male' }"
          @click="setMobileFilter('male')"
        >
          <span>Giọng Nam</span>
        </button>
      </div>

      <!-- Bộ lọc 3 tiêu chí đầy đủ cho Desktop / Tablet (>= 768px) -->
      <div class="filter-bar p-2 rounded-3 mb-3 d-none d-md-block">
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

      <!-- Danh sách thẻ giọng đọc -->
      <div class="voice-list flex-grow-1" style="max-height: 380px; overflow-y: auto;">
        <div class="d-flex flex-column gap-2 pe-1">
          <div
            v-for="voice in ttsStore.filteredVoices"
            :key="voice.id"
            class="voice-card transition-all"
            :class="{ selected: ttsStore.selectedVoiceId === voice.id }"
            @click="handleSelectVoice(voice.id)"
          >
            <div class="d-flex align-items-center justify-content-between gap-2">
              <div class="d-flex align-items-center gap-2.5 overflow-hidden">
                <!-- Avatar chất giọng thông minh -->
                <div
                  class="voice-avatar flex-shrink-0"
                  :class="[voice.gender, voice.region]"
                >
                  {{ getInitials(voice.name) }}
                </div>

                <div class="overflow-hidden">
                  <div class="d-flex align-items-center gap-1.5 flex-wrap">
                    <span class="voice-name">{{ voice.name }}</span>
                    <span class="badge-neutral" style="font-size: 10px; padding: 2px 6px;">
                      {{ voice.gender === 'female' ? 'Nữ' : 'Nam' }}
                    </span>
                    <span class="badge-neutral" style="font-size: 10px; padding: 2px 6px;">
                      {{ getRegionText(voice.region) }}
                    </span>
                  </div>
                  <p class="voice-desc mb-0 text-truncate mt-0.5">
                    {{ voice.description }}
                  </p>
                </div>
              </div>

              <!-- Cụm bên phải: Nghe thử + Radio Indicator -->
              <div class="d-flex align-items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  class="btn-preview-pill"
                  :disabled="ttsStore.isPreviewLoading && ttsStore.previewVoiceId === voice.id"
                  @click="handlePreview(voice, $event)"
                  title="Nghe thử giọng đọc"
                >
                  <span
                    v-if="ttsStore.isPreviewLoading && ttsStore.previewVoiceId === voice.id"
                    class="spinner-border spinner-border-sm"
                  ></span>
                  <i
                    v-else
                    class="bi"
                    :class="ttsStore.previewVoiceId === voice.id ? 'bi-stop-fill text-danger' : 'bi-play-fill text-primary'"
                  ></i>
                  <span class="d-none d-sm-inline ms-1">{{ ttsStore.previewVoiceId === voice.id ? 'Dừng' : 'Thử' }}</span>
                </button>

                <!-- Dấu check khi đang chọn / Hoặc vòng tròn rỗng -->
                <div class="check-indicator">
                  <i
                    v-if="ttsStore.selectedVoiceId === voice.id"
                    class="bi bi-check-circle-fill text-primary fs-5"
                  ></i>
                  <div v-else class="check-placeholder"></div>
                </div>
              </div>
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
.mobile-filter-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.mobile-filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 6px 13px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.filter-chip:active {
  transform: scale(0.95);
}

.filter-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #FFFFFF;
  box-shadow: 0 2px 8px var(--primary-soft);
  font-weight: 600;
}

.voice-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.voice-avatar.female {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.voice-avatar.female.north {
  background: linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%);
}

.voice-avatar.female.south {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.voice-avatar.male {
  background: linear-gradient(135deg, #4facfe 0%, #000dff 100%);
}

.voice-avatar.male.north {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #111827;
}

.voice-avatar.male.south {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #111827;
}

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

.voice-selector-panel {
  min-height: 480px;
}

@media (max-width: 768px) {
  .voice-selector-panel {
    min-height: auto;
  }

  .filter-select {
    font-size: 11.5px !important;
    padding: 5px 6px !important;
  }

  .voice-desc {
    max-width: 170px !important;
    font-size: 12px !important;
  }

  .voice-card {
    padding: 10px 12px !important;
  }
}
</style>
