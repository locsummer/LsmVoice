<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Xác nhận thao tác',
  },
  message: {
    type: String,
    default: 'Bạn có chắc chắn muốn thực hiện hành động này?',
  },
  confirmText: {
    type: String,
    default: 'Xác nhận',
  },
  cancelText: {
    type: String,
    default: 'Hủy',
  },
  type: {
    type: String,
    default: 'danger', // 'danger' | 'warning' | 'primary'
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['confirm', 'cancel']);

const handleKeyDown = (e) => {
  if (e.key === 'Escape' && props.show && !props.isLoading) {
    emit('cancel');
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
  <div
    v-if="show"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(32, 34, 56, 0.45); backdrop-filter: blur(4px); z-index: 1080;"
  >
    <div class="modal-dialog modal-dialog-centered" style="max-width: 440px;">
      <div class="modal-content modal-content-clean p-2">
        <div class="modal-body p-4">
          <!-- Icon Header -->
          <div class="d-flex align-items-center gap-3 mb-3">
            <div
              class="confirm-icon-box"
              :class="{
                'bg-danger-subtle text-danger': type === 'danger',
                'bg-warning-subtle text-warning': type === 'warning',
                'bg-primary-subtle text-primary': type === 'primary',
              }"
            >
              <i
                class="bi fs-5"
                :class="{
                  'bi-trash3': type === 'danger',
                  'bi-exclamation-triangle': type === 'warning',
                  'bi-question-circle': type === 'primary',
                }"
              ></i>
            </div>
            <div>
              <h5 class="section-title mb-0" style="font-size: 16px;">
                {{ title }}
              </h5>
            </div>
          </div>

          <!-- Description -->
          <p class="section-desc mb-4 lh-base" style="font-size: 13.5px;">
            {{ message }}
          </p>

          <!-- Action buttons -->
          <div class="d-flex justify-content-end gap-2 pt-2 hairline-border-top">
            <button
              type="button"
              class="btn-secondary-action"
              style="height: 40px; padding: 0 16px; font-size: 13.5px;"
              :disabled="isLoading"
              @click="emit('cancel')"
            >
              {{ cancelText }}
            </button>

            <button
              type="button"
              class="btn-confirm-action"
              :class="{
                'btn-danger-custom': type === 'danger',
                'btn-primary-action': type === 'primary',
              }"
              style="height: 40px; padding: 0 18px; font-size: 13.5px;"
              :disabled="isLoading"
              @click="emit('confirm')"
            >
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-1.5" role="status"></span>
              <span>{{ confirmText }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-confirm-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger-custom {
  background-color: var(--danger) !important;
  color: #FFFFFF !important;
  box-shadow: 0 4px 14px rgba(217, 104, 114, 0.3);
}

.btn-danger-custom:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-danger-custom:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
