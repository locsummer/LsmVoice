<script setup>
import { ref } from 'vue';
import { useTtsStore } from '../stores/ttsStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useLibraryStore } from '../stores/libraryStore.js';
import TextInputArea from '../components/TextInputArea.vue';
import VoiceSelector from '../components/VoiceSelector.vue';
import JobProgressModal from '../components/JobProgressModal.vue';
import SyncTextDisplay from '../components/SyncTextDisplay.vue';
import AudioExporter from '../components/AudioExporter.vue';
import SaveWorkModal from '../components/SaveWorkModal.vue';

const emit = defineEmits(['notify']);

const ttsStore = useTtsStore();
const playerStore = usePlayerStore();
const libraryStore = useLibraryStore();

const showProgressModal = ref(false);
const showExporterModal = ref(false);
const showSaveModal = ref(false);
const saveInitialData = ref({});

const handleStartSynthesis = async (customParams = null) => {
  if (customParams && customParams.text) {
    ttsStore.text = customParams.text;
    if (customParams.title) ttsStore.title = customParams.title;
  }

  if (!ttsStore.text.trim()) {
    emit('notify', {
      type: 'warning',
      message: 'Vui lòng nhập hoặc dán nội dung văn bản trước khi tạo audio.',
    });
    return;
  }

  showProgressModal.value = true;
  try {
    await ttsStore.startJob();
  } catch (err) {
    emit('notify', {
      type: 'danger',
      message: err.message,
    });
  }
};

const handleOpenSaveModal = () => {
  if (!ttsStore.text.trim()) {
    emit('notify', {
      type: 'warning',
      message: 'Không có nội dung văn bản để lưu.',
    });
    return;
  }

  saveInitialData.value = {
    title: ttsStore.title.trim() || 'Văn bản không tên',
    content: ttsStore.text,
    voiceId: ttsStore.selectedVoiceId,
    speed: ttsStore.speed,
    audioUrl: playerStore.currentAudioUrl || null,
    duration: playerStore.duration || 0,
  };
  showSaveModal.value = true;
};
</script>

<template>
  <div class="container-fluid px-2 px-sm-3 px-lg-4 py-3 py-lg-4" style="max-width: 1480px;">
    <!-- Hero Section (UI8 Modern Dashboard style) -->
    <div class="hero-container mb-3 mb-md-4 p-3 p-md-4 rounded-4">
      <div class="hero-row">
        <!-- Bên trái: Tiêu đề, Badge & Mô tả -->
        <div class="hero-content">
          <div class="hero-title-group mb-2">
            <h1 class="page-title mb-0">Biến văn bản thành giọng nói.</h1>
            <span class="badge-violet-pill">
              <i class="bi bi-shield-check me-1"></i> Hỗ trợ tối đa 50.000 ký tự
            </span>
          </div>
          <p class="section-desc mb-0">
            Lắng nghe câu chuyện của bạn qua những giọng đọc tiếng Việt tự nhiên, truyền cảm và rõ ràng.
          </p>
        </div>

        <!-- Bên phải: Các nút hành động chính -->
        <div class="hero-actions">
          <button
            type="button"
            class="btn-secondary-action hero-btn"
            @click="handleOpenSaveModal"
          >
            <i class="bi bi-bookmark-plus"></i>
            <span>Lưu vào thư viện</span>
          </button>

          <button
            type="button"
            class="btn-primary-action hero-btn"
            :disabled="ttsStore.isSynthesizing"
            @click="handleStartSynthesis"
          >
            <span v-if="ttsStore.isSynthesizing" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-play-circle-fill"></i>
            <span>Chuyển thành giọng nói</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Dashboard Workspace (60% / 40%) -->
    <div class="row g-3 g-lg-4 align-items-start">
      <!-- Cột trái: Soạn thảo văn bản (~60%) -->
      <div class="col-lg-7 d-flex flex-column gap-4">
        <TextInputArea
          @notify="emit('notify', $event)"
          @start-synthesis="handleStartSynthesis"
          @save-library="handleOpenSaveModal"
        />

        <!-- Đồng bộ văn bản theo giọng đọc khi đang phát audio -->
        <SyncTextDisplay />
      </div>

      <!-- Cột phải: Chọn giọng đọc & Tùy chỉnh (~40%) -->
      <div class="col-lg-5 d-flex flex-column gap-4">
        <VoiceSelector
          @notify="emit('notify', $event)"
          @start-synthesis="handleStartSynthesis"
        />
      </div>
    </div>

    <!-- Modal theo dõi tiến trình tạo audio -->
    <JobProgressModal
      v-if="showProgressModal"
      @notify="emit('notify', $event)"
      @close="showProgressModal = false"
    />

    <!-- Modal xuất bản & tải xuống file -->
    <AudioExporter
      v-if="showExporterModal"
      @close="showExporterModal = false"
    />

    <!-- Modal phân loại & lưu tác phẩm -->
    <SaveWorkModal
      :show="showSaveModal"
      :initialData="saveInitialData"
      @close="showSaveModal = false"
    />
  </div>
</template>

<style scoped>
.hero-container {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
}

.hero-container::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(108, 92, 231, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.hero-content {
  flex: 1 1 auto;
  min-width: 0;
}

.hero-title-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .hero-row {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .hero-actions {
    width: 100%;
    gap: 8px;
  }

  .hero-btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 10px !important;
    font-size: 13px !important;
    white-space: nowrap;
  }
}
</style>
