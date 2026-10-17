<script setup>
import { ref, computed } from 'vue';
import { useTtsStore, MAX_CHAR_LIMIT } from '../stores/ttsStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import { uploadDocument } from '../services/api.js';
import TextToolsModal from './TextToolsModal.vue';

const emit = defineEmits(['notify', 'start-synthesis', 'save-library']);

const ttsStore = useTtsStore();
const notification = useNotificationStore();
const fileInput = ref(null);
const isUploading = ref(false);
const showToolsModal = ref(false);
const textareaRef = ref(null);
const hasSelection = ref(false);

const progressClass = computed(() => {
  const p = ttsStore.charPercentage;
  if (p > 95) return 'progress-danger';
  if (p > 80) return 'progress-warn';
  return 'progress-normal';
});

const handleInput = (e) => {
  const val = e.target.value;
  if (val.length > MAX_CHAR_LIMIT) {
    const res = ttsStore.setText(val);
    emit('notify', {
      type: 'warning',
      message: res.message,
    });
  } else {
    ttsStore.setText(val);
  }
};

const handleSelectChange = () => {
  if (textareaRef.value) {
    const start = textareaRef.value.selectionStart;
    const end = textareaRef.value.selectionEnd;
    hasSelection.value = end - start > 10;
  }
};

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      emit('notify', { type: 'info', message: 'Bộ nhớ tạm không có nội dung văn bản.' });
      return;
    }

    const available = MAX_CHAR_LIMIT - ttsStore.charCount;
    if (available <= 0) {
      emit('notify', {
        type: 'danger',
        message: `Đã đạt giới hạn tối đa ${MAX_CHAR_LIMIT.toLocaleString('vi-VN')} ký tự.`,
      });
      return;
    }

    let toPaste = text;
    if (text.length > available) {
      toPaste = text.substring(0, available);
      emit('notify', {
        type: 'warning',
        message: `Văn bản dán được cắt gọn để vừa đủ ${MAX_CHAR_LIMIT.toLocaleString('vi-VN')} ký tự.`,
      });
    }

    const newFullText = ttsStore.text ? ttsStore.text + '\n' + toPaste : toPaste;
    ttsStore.setText(newFullText);
  } catch (_) {
    emit('notify', { type: 'info', message: 'Vui lòng nhấn tổ hợp phím Ctrl + V để dán văn bản.' });
  }
};

const handleClear = async () => {
  if (!ttsStore.text) return;
  const confirmed = await notification.askConfirm({
    title: 'Xóa toàn bộ văn bản?',
    message: 'Nội dung trong ô soạn thảo sẽ bị xóa sạch. Thao tác này không thể hoàn tác nếu chưa được lưu vào Thư viện.',
    confirmText: 'Xóa sạch',
    cancelText: 'Giữ lại',
    type: 'danger',
  });
  if (confirmed) {
    ttsStore.clearText();
  }
};

const triggerFileInput = () => {
  if (fileInput.value) fileInput.value.click();
};

const handleFileSelected = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  isUploading.value = true;
  try {
    const res = await uploadDocument(formData);
    const data = res.data;

    if (!ttsStore.title) {
      ttsStore.title = file.name.replace(/\.[^/.]+$/, '');
    }

    ttsStore.setText(data.text);
    if (data.warning) {
      emit('notify', { type: 'warning', message: data.warning });
    } else {
      emit('notify', {
        type: 'success',
        message: `Đã trích xuất ${data.charCount.toLocaleString('vi-VN')} ký tự từ "${file.name}".`,
      });
    }
  } catch (err) {
    emit('notify', { type: 'danger', message: err.message });
  } finally {
    isUploading.value = false;
    e.target.value = '';
  }
};

const loadSampleText = () => {
  const sample = `TẬP 1: NGƯỜI LUÔN CẦN ĐƯỢC CÔNG NHẬN

Năm tôi mười sáu tuổi, tôi từng nghĩ chỉ cần bản thân đủ giỏi, đủ nhiệt tình và đủ hữu ích thì sẽ chẳng ai có lý do để rời bỏ mình. Tôi luôn cố gắng làm vừa lòng mọi người xung quanh, nhận lấy mọi trách nhiệm và mỉm cười ngay cả khi bản thân cảm thấy kiệt sức.

Nhưng năm tháng trôi qua dạy cho tôi hiểu rằng: Sự công nhận quý giá nhất không đến từ ánh nhìn của người khác, mà bắt đầu từ khoảnh khắc bạn biết lắng nghe và trân trọng chính tiếng nói nội tâm của mình. Khi bạn bình thản bước đi trên con đường của riêng mình, thế giới tự khắc sẽ tìm thấy bạn.`;

  ttsStore.title = 'Người Luôn Cần Được Công Nhận';
  ttsStore.setText(sample);
  emit('notify', { type: 'info', message: 'Đã tải nội dung văn bản mẫu.' });
};

const handleApplyTools = (newText) => {
  ttsStore.setText(newText);
  showToolsModal.value = false;
  emit('notify', { type: 'success', message: 'Đã cập nhật nội dung sau xử lý.' });
};

const handleReadSelectedOnly = () => {
  if (!textareaRef.value) return;
  const start = textareaRef.value.selectionStart;
  const end = textareaRef.value.selectionEnd;
  const selected = ttsStore.text.substring(start, end).trim();

  if (!selected || selected.length < 5) return;

  emit('start-synthesis', {
    text: selected,
    title: `Đoạn trích (${selected.substring(0, 30)}...)`,
  });
};
</script>

<template>
  <div class="panel-white p-4 d-flex flex-column" style="min-height: 560px;">
    <!-- Phần trên: Tiêu đề tác phẩm & Trạng thái lưu nháp -->
    <div class="d-flex align-items-center justify-content-between gap-3 pb-3 mb-3 hairline-border-bottom">
      <div class="flex-grow-1">
        <input
          v-model="ttsStore.title"
          type="text"
          class="title-input"
          placeholder="Tiêu đề tác phẩm hoặc tài liệu..."
          @input="ttsStore.triggerAutoSave"
        />
      </div>

      <div class="d-flex align-items-center gap-1 flex-shrink-0 text-muted small">
        <i class="bi" :class="ttsStore.isDraftSaved ? 'bi-cloud-check text-success' : 'bi-arrow-repeat spin'"></i>
        <span style="font-size: 12.5px;">{{ ttsStore.isDraftSaved ? 'Đã lưu nháp' : 'Đang lưu...' }}</span>
      </div>
    </div>

    <!-- Thanh công cụ nhỏ gọn (UI8 Toolbar) -->
    <div class="toolbar-container d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 mb-3 rounded-3">
      <div class="d-flex align-items-center gap-1">
        <button
          type="button"
          class="toolbar-btn"
          @click="handlePaste"
          title="Dán văn bản"
        >
          <i class="bi bi-clipboard"></i>
          <span>Dán</span>
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="isUploading"
          @click="triggerFileInput"
          title="Tải tệp .txt, .docx, .pdf"
        >
          <i class="bi bi-upload"></i>
          <span>{{ isUploading ? 'Đang đọc...' : 'Tải tệp' }}</span>
        </button>
        <input
          ref="fileInput"
          type="file"
          class="d-none"
          accept=".txt,.docx,.pdf"
          @change="handleFileSelected"
        />

        <button
          type="button"
          class="toolbar-btn"
          @click="loadSampleText"
          title="Văn bản mẫu"
        >
          <i class="bi bi-file-earmark-text"></i>
          <span>Văn bản mẫu</span>
        </button>

        <button
          type="button"
          class="toolbar-btn"
          @click="showToolsModal = true"
          title="Công cụ xử lý chữ"
        >
          <i class="bi bi-sliders"></i>
          <span>Xử lý chữ</span>
        </button>
      </div>

      <div class="d-flex align-items-center gap-1">
        <button
          v-if="hasSelection"
          type="button"
          class="toolbar-btn text-primary"
          @click="handleReadSelectedOnly"
          title="Chỉ chuyển đoạn đang bôi đen"
        >
          <i class="bi bi-cursor-fill"></i>
          <span>Đọc đoạn chọn</span>
        </button>

        <button
          type="button"
          class="toolbar-btn text-danger"
          :disabled="!ttsStore.text"
          @click="handleClear"
          title="Xóa nội dung"
        >
          <i class="bi bi-trash3"></i>
          <span>Xóa</span>
        </button>
      </div>
    </div>

    <!-- Khu vực nhập văn bản chính -->
    <div class="flex-grow-1 d-flex flex-column mb-3">
      <textarea
        ref="textareaRef"
        :value="ttsStore.text"
        class="ui8-textarea flex-grow-1"
        placeholder="Nhập hoặc dán nội dung văn bản tiếng Việt tại đây (tối đa 50.000 ký tự cho truyện dài, tiểu thuyết, sách nói và tài liệu)..."
        @input="handleInput"
        @select="handleSelectChange"
        @keyup="handleSelectChange"
        @mouseup="handleSelectChange"
      ></textarea>
    </div>

    <!-- Bộ đếm ký tự & Tiến trình -->
    <div class="mb-3">
      <div class="d-flex justify-content-between align-items-center small text-muted mb-1.5" style="font-size: 13px;">
        <span>Tiến độ văn bản</span>
        <span class="fw-medium" :class="{ 'text-danger': ttsStore.charPercentage > 95 }">
          {{ ttsStore.charCount.toLocaleString('vi-VN') }} / {{ MAX_CHAR_LIMIT.toLocaleString('vi-VN') }} ký tự
          ({{ ttsStore.charPercentage }}%)
        </span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :class="progressClass"
          :style="{ width: `${ttsStore.charPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Hàng nút hành động -->
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-2 hairline-border-top">
      <div class="d-flex align-items-center gap-2 small">
        <span class="text-muted">Giọng đang chọn:</span>
        <span class="badge-primary-pill">{{ ttsStore.selectedVoice?.name || 'Hoài My' }}</span>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn-secondary-action"
          :disabled="!ttsStore.text"
          @click="emit('save-library')"
        >
          <i class="bi bi-bookmark-plus"></i>
          <span>Lưu thư viện</span>
        </button>

        <button
          type="button"
          class="btn-primary-action"
          :disabled="ttsStore.isSynthesizing || !ttsStore.text"
          @click="emit('start-synthesis')"
        >
          <span v-if="ttsStore.isSynthesizing" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="bi bi-play-circle-fill"></i>
          <span>Chuyển thành giọng nói</span>
        </button>
      </div>
    </div>

    <!-- Modal công cụ xử lý chữ -->
    <TextToolsModal
      v-if="showToolsModal"
      :text="ttsStore.text"
      @apply-changes="handleApplyTools"
      @close="showToolsModal = false"
    />
  </div>
</template>

<style scoped>
.title-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 650;
  outline: none;
  padding: 4px 0;
}

.title-input::placeholder {
  color: var(--text-muted);
  font-weight: 500;
}

.toolbar-container {
  background: var(--surface-soft);
  border: 1px solid var(--border);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--surface);
  color: var(--primary);
  box-shadow: 0 2px 6px rgba(62, 56, 111, 0.05);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui8-textarea {
  width: 100%;
  min-height: 340px;
  max-height: 520px;
  background: var(--surface-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 18px 22px;
  color: var(--text-primary);
  font-size: 15.5px;
  line-height: 1.75;
  outline: none;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ui8-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.ui8-textarea::placeholder {
  color: var(--text-muted);
  line-height: 1.75;
}

.progress-track {
  width: 100%;
  height: 5px;
  background: var(--surface-hover);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-normal {
  background: var(--primary);
}

.progress-warn {
  background: var(--warning);
}

.progress-danger {
  background: var(--danger);
}
</style>
