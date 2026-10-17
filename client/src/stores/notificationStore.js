import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([]);
  const confirmState = ref({
    isOpen: false,
    title: 'Xác nhận thao tác',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Hủy',
    type: 'danger',
    resolve: null,
  });

  const add = ({ type = 'info', title = '', message = '', duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    const item = {
      id,
      type, // 'success' | 'danger' | 'error' | 'warning' | 'info'
      title,
      message,
      duration,
    };

    notifications.value.push(item);

    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }

    return id;
  };

  const remove = (id) => {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  };

  const success = (message, title = 'Thành công') => {
    return add({ type: 'success', title, message });
  };

  const error = (message, title = 'Lỗi') => {
    return add({ type: 'danger', title, message, duration: 6000 });
  };

  const warning = (message, title = 'Cảnh báo') => {
    return add({ type: 'warning', title, message, duration: 5000 });
  };

  const info = (message, title = 'Thông báo') => {
    return add({ type: 'info', title, message });
  };

  const askConfirm = ({
    title = 'Xác nhận thao tác',
    message = 'Bạn có chắc chắn muốn thực hiện hành động này?',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    type = 'danger',
  } = {}) => {
    return new Promise((resolve) => {
      confirmState.value = {
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        resolve,
      };
    });
  };

  const handleConfirmResult = (confirmed) => {
    if (confirmState.value.resolve) {
      confirmState.value.resolve(confirmed);
    }
    confirmState.value.isOpen = false;
    confirmState.value.resolve = null;
  };

  return {
    notifications,
    confirmState,
    add,
    remove,
    success,
    error,
    warning,
    info,
    askConfirm,
    handleConfirmResult,
  };
});

