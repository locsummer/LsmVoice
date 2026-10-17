<script setup>
import { ref, computed, watch } from 'vue';
import { useLibraryStore } from '../stores/libraryStore.js';
import { useTtsStore } from '../stores/ttsStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  initialData: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['close', 'saved']);

const libraryStore = useLibraryStore();
const ttsStore = useTtsStore();
const notification = useNotificationStore();

const title = ref('');
const category = ref('Tiểu thuyết');
const author = ref('');
const description = ref('');
const voiceId = ref('');
const speed = ref(1.0);
const isSubmitting = ref(false);

const isAddingNewCategory = ref(false);
const newCategoryInput = ref('');
const titleError = ref('');

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      title.value = props.initialData.title || ttsStore.title || '';
      category.value = props.initialData.category || 'Tiểu thuyết';
      author.value = props.initialData.author || '';
      description.value = props.initialData.description || '';
      voiceId.value = props.initialData.voiceId || props.initialData.voice_id || ttsStore.selectedVoiceId || 'vi-VN-HoaiMyNeural';
      speed.value = props.initialData.speed !== undefined ? props.initialData.speed : ttsStore.speed;
      isAddingNewCategory.value = false;
      newCategoryInput.value = '';
      titleError.value = '';
      libraryStore.loadCategories();
    }
  }
);

const handleAddNewCategory = async () => {
  if (!newCategoryInput.value.trim()) return;
  const created = await libraryStore.addCustomCategory(newCategoryInput.value.trim());
  if (created) {
    category.value = newCategoryInput.value.trim();
    newCategoryInput.value = '';
    isAddingNewCategory.value = false;
    notification.success(`Đã thêm thể loại "${category.value}".`);
  }
};

const handleSave = async () => {
  if (!title.value.trim()) {
    titleError.value = 'Vui lòng nhập tên tác phẩm.';
    return;
  }
  titleError.value = '';

  const contentText = props.initialData.content || ttsStore.text;
  if (!contentText || !contentText.trim()) {
    notification.warning('Chưa có nội dung văn bản để lưu.');
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      title: title.value.trim(),
      content: contentText.trim(),
      category: category.value || 'Chung',
      author: author.value ? author.value.trim() : null,
      description: description.value ? description.value.trim() : null,
      voiceId: voiceId.value,
      provider: ttsStore.voices.find((v) => v.id === voiceId.value)?.provider || props.initialData.provider || 'edge',
      speed: speed.value,
      audioUrl: props.initialData.audioUrl || props.initialData.audio_url || null,
      duration: props.initialData.duration || 0,
      status: (props.initialData.audioUrl || props.initialData.audio_url) ? 'audio_ready' : (props.initialData.status || 'text_saved'),
    };

    let saved;
    if (props.initialData && props.initialData.id) {
      saved = await libraryStore.editItem(props.initialData.id, payload);
      notification.success(`Đã cập nhật "${payload.title}" thành công!`);
    } else {
      saved = await libraryStore.addItem(payload);
      notification.success(`Đã lưu "${payload.title}" vào thư viện thành công!`);
    }

    emit('saved', saved);
    emit('close');
  } catch (err) {
    notification.error('Không thể lưu tác phẩm: ' + err.message);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div
    v-if="show"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(32, 34, 56, 0.45); backdrop-filter: blur(4px); z-index: 1075;"
  >
    <div class="modal-dialog modal-dialog-centered" style="max-width: 540px;">
      <div class="modal-content modal-content-clean p-2">
        <!-- Header -->
        <div class="modal-header hairline-border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <div class="header-icon-box">
              <i class="bi bi-bookmark-plus text-primary fs-5"></i>
            </div>
            <div>
              <h5 class="section-title mb-0" style="font-size: 17px;">
                {{ props.initialData && props.initialData.id ? 'Chỉnh sửa tác phẩm' : 'Lưu tác phẩm vào Thư viện' }}
              </h5>
              <div class="text-muted small">Nhập thông tin phân loại và lưu trữ lâu dài</div>
            </div>
          </div>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <!-- Form Body -->
        <div class="modal-body p-4">
          <!-- Tên tác phẩm (Bắt buộc) -->
          <div class="mb-3">
            <label class="form-label control-label mb-1">
              Tên tác phẩm <span class="text-danger">*</span>
            </label>
            <input
              v-model="title"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': titleError }"
              placeholder="Ví dụ: Dế Mèn Phiêu Lưu Ký - Chương 1"
            />
            <div v-if="titleError" class="text-danger small mt-1">
              {{ titleError }}
            </div>
          </div>

          <!-- Thể loại (Chọn hoặc tạo mới) -->
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label class="form-label control-label mb-0">
                Thể loại phân loại
              </label>
              <button
                type="button"
                class="btn btn-link p-0 text-decoration-none small"
                style="color: var(--primary); font-size: 12.5px; font-weight: 550;"
                @click="isAddingNewCategory = !isAddingNewCategory"
              >
                {{ isAddingNewCategory ? 'Hủy thêm mới' : '+ Tạo thể loại mới' }}
              </button>
            </div>

            <!-- Input thêm thể loại mới -->
            <div v-if="isAddingNewCategory" class="input-group mb-2">
              <input
                v-model="newCategoryInput"
                type="text"
                class="form-control form-control-sm"
                placeholder="Nhập tên thể loại mới..."
                @keyup.enter="handleAddNewCategory"
              />
              <button
                class="btn-primary-action px-3"
                style="height: 38px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;"
                type="button"
                @click="handleAddNewCategory"
              >
                Lưu
              </button>
            </div>

            <select v-model="category" class="form-select">
              <option v-for="cat in libraryStore.categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>

          <!-- Tác giả & Tốc độ đọc (2 cột) -->
          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <label class="form-label control-label mb-1">Tác giả (tùy chọn)</label>
              <input
                v-model="author"
                type="text"
                class="form-control"
                placeholder="Tên tác giả hoặc dịch giả"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label control-label mb-1">Giọng đọc</label>
              <select v-model="voiceId" class="form-select">
                <option v-for="v in ttsStore.voices" :key="v.id" :value="v.id">
                  {{ v.name }} ({{ v.gender === 'female' ? 'Nữ' : 'Nam' }})
                </option>
              </select>
            </div>
          </div>

          <!-- Mô tả tóm tắt -->
          <div class="mb-3">
            <label class="form-label control-label mb-1">Mô tả tóm tắt (tùy chọn)</label>
            <textarea
              v-model="description"
              class="form-control"
              style="height: 70px; resize: none;"
              placeholder="Ghi chú ngắn về nội dung hoặc ý tưởng..."
            ></textarea>
          </div>

          <!-- Trạng thái lưu trữ -->
          <div class="panel-sub p-3 rounded-3 d-flex align-items-center justify-content-between">
            <div>
              <div class="fw-semibold text-main small">Trạng thái dữ liệu</div>
              <div class="text-muted" style="font-size: 12px;">
                {{ initialData.audioUrl ? 'Bao gồm file âm thanh MP3 hoàn chỉnh' : 'Lưu trữ nội dung văn bản (có thể tạo audio sau)' }}
              </div>
            </div>
            <span
              class="badge-neutral"
              :class="initialData.audioUrl ? 'badge-primary-pill' : ''"
              style="font-size: 11.5px;"
            >
              {{ initialData.audioUrl ? 'Audio sẵn sàng' : 'Bản nháp văn bản' }}
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer hairline-border-top px-4 py-3 d-flex justify-content-end gap-2">
          <button
            type="button"
            class="btn-secondary-action"
            style="height: 42px; padding: 0 18px;"
            :disabled="isSubmitting"
            @click="emit('close')"
          >
            Hủy
          </button>
          <button
            type="button"
            class="btn-primary-action"
            style="height: 42px; padding: 0 22px;"
            :disabled="isSubmitting"
            @click="handleSave"
          >
            <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1.5" role="status"></span>
            <i v-else class="bi bi-check2-circle"></i>
            <span>Lưu vào Thư viện</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
