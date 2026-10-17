<script setup>
import { ref, onMounted } from 'vue';
import Navbar from './components/Navbar.vue';
import AudioPlayer from './components/AudioPlayer.vue';
import NotificationProvider from './components/NotificationProvider.vue';
import AuthModal from './components/AuthModal.vue';
import AudioExporter from './components/AudioExporter.vue';
import { useAuthStore } from './stores/authStore.js';
import { useTtsStore } from './stores/ttsStore.js';
import { useNotificationStore } from './stores/notificationStore.js';

const authStore = useAuthStore();
const ttsStore = useTtsStore();
const notification = useNotificationStore();

const showAuthModal = ref(false);
const showExporterModal = ref(false);

const handleNotify = (payload) => {
  if (typeof payload === 'string') {
    notification.info(payload);
  } else if (payload && payload.message) {
    const type = payload.type || 'info';
    notification.add({
      type,
      title: payload.title || (type === 'success' ? 'Thành công' : type === 'danger' || type === 'error' ? 'Lỗi' : type === 'warning' ? 'Cảnh báo' : 'Thông báo'),
      message: payload.message,
    });
  }
};

onMounted(() => {
  authStore.checkProfile();
  ttsStore.loadVoices();
  ttsStore.loadDraft();
});
</script>

<template>
  <div class="app-layout d-flex flex-column min-vh-100">
    <!-- Thanh điều hướng đầu trang -->
    <Navbar @open-auth="showAuthModal = true" />

    <!-- Nội dung chính của từng trang -->
    <main class="flex-grow-1">
      <router-view @notify="handleNotify" @open-auth="showAuthModal = true" />
    </main>

    <!-- Trình phát Audio chuyên nghiệp gắn chân trang (Persistent Player) -->
    <AudioPlayer @open-exporter="showExporterModal = true" />

    <!-- Cửa sổ đăng nhập / đăng ký -->
    <AuthModal
      v-if="showAuthModal"
      @close="showAuthModal = false"
    />

    <!-- Cửa sổ tải xuống và xuất tệp -->
    <AudioExporter
      v-if="showExporterModal"
      @close="showExporterModal = false"
    />

    <!-- Hệ thống thông báo tập trung NotificationProvider (UI8 Toast) -->
    <NotificationProvider />
  </div>
</template>
