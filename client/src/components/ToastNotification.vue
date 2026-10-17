<script setup>
import { ref } from 'vue';

const toasts = ref([]);

const addToast = ({ message, type = 'info', duration = 4000 }) => {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    removeToast(id);
  }, duration);
};

const removeToast = (id) => {
  toasts.value = toasts.value.filter((t) => t.id !== id);
};

defineExpose({ addToast });
</script>

<template>
  <div class="toast-container-custom">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="panel-white d-flex align-items-center mb-2 py-2.5 px-3 rounded-3 transition-all"
      style="min-width: 280px; max-width: 440px; box-shadow: var(--shadow-float); z-index: 1090;"
      role="alert"
    >
      <span
        class="me-2.5 d-inline-block rounded-circle flex-shrink-0"
        style="width: 10px; height: 10px;"
        :style="{
          backgroundColor:
            toast.type === 'success'
              ? 'var(--success)'
              : toast.type === 'danger' || toast.type === 'error'
              ? 'var(--danger)'
              : toast.type === 'warning'
              ? '#F59E0B'
              : 'var(--primary)',
        }"
      ></span>
      <div class="flex-grow-1 small text-main lh-sm pe-2" style="font-size: 13.5px; font-weight: 500;">
        {{ toast.message }}
      </div>
      <button
        type="button"
        class="btn-close"
        style="font-size: 0.7rem; opacity: 0.6;"
        @click="removeToast(toast.id)"
      ></button>
    </div>
  </div>
</template>
