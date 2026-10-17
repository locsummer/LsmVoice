<script setup>
import { useNotificationStore } from '../stores/notificationStore.js';
import ConfirmModal from './ConfirmModal.vue';

const notificationStore = useNotificationStore();

const getBorderColor = (type) => {

  switch (type) {
    case 'success':
      return 'var(--success)';
    case 'danger':
    case 'error':
      return 'var(--danger)';
    case 'warning':
      return 'var(--warning)';
    default:
      return 'var(--primary)';
  }
};
</script>

<template>
  <div class="notification-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="item in notificationStore.notifications"
        :key="item.id"
        class="toast-card"
        :role="item.type === 'danger' || item.type === 'error' ? 'alert' : 'status'"
      >
        <div class="d-flex align-items-start gap-3">
          <!-- Status Indicator Dot/Icon -->
          <div
            class="status-indicator-box flex-shrink-0 mt-0.5"
            :style="{ backgroundColor: getBorderColor(item.type) }"
          >
            <i
              class="bi text-white"
              :class="{
                'bi-check': item.type === 'success',
                'bi-exclamation': item.type === 'danger' || item.type === 'error',
                'bi-exclamation-triangle': item.type === 'warning',
                'bi-info': item.type === 'info',
              }"
              style="font-size: 13px;"
            ></i>
          </div>

          <!-- Content: Title & Message -->
          <div class="flex-grow-1">
            <div v-if="item.title" class="toast-title">
              {{ item.title }}
            </div>
            <div class="toast-message">
              {{ item.message }}
            </div>
          </div>

          <!-- Close button -->
          <button
            type="button"
            class="toast-close-btn flex-shrink-0"
            @click="notificationStore.remove(item.id)"
            title="Đóng thông báo"
          >
            <i class="bi bi-x fs-6"></i>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>

  <!-- Global UI8 Confirmation Modal -->
  <ConfirmModal
    :show="notificationStore.confirmState.isOpen"
    :title="notificationStore.confirmState.title"
    :message="notificationStore.confirmState.message"
    :confirmText="notificationStore.confirmState.confirmText"
    :cancelText="notificationStore.confirmState.cancelText"
    :type="notificationStore.confirmState.type"
    @confirm="notificationStore.handleConfirmResult(true)"
    @cancel="notificationStore.handleConfirmResult(false)"
  />
</template>

<style scoped>
.notification-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1099;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 420px;
  width: calc(100% - 48px);
  pointer-events: none;
}

.toast-card {
  pointer-events: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-float);
  padding: 14px 16px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.status-indicator-box {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-primary);
  margin-bottom: 2px;
  line-height: 1.3;
}

.toast-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.45;
}

.toast-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.toast-close-btn:hover {
  color: var(--text-primary);
  background: var(--surface-soft);
}

/* Animations */
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}
</style>
