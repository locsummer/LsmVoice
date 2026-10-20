<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Navbar from './components/Navbar.vue';
import AudioPlayer from './components/AudioPlayer.vue';
import MobileBottomNav from './components/MobileBottomNav.vue';
import NotificationProvider from './components/NotificationProvider.vue';
import AuthModal from './components/AuthModal.vue';
import AudioExporter from './components/AudioExporter.vue';
import { useAuthStore } from './stores/authStore.js';
import { useTtsStore } from './stores/ttsStore.js';
import { usePlayerStore } from './stores/playerStore.js';
import { useNotificationStore } from './stores/notificationStore.js';
import { isNativeApp } from './services/api.js';
import { App as CapApp } from '@capacitor/app';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const ttsStore = useTtsStore();
const playerStore = usePlayerStore();
const notification = useNotificationStore();

const showAuthModal = ref(false);
const showExporterModal = ref(false);

// Tự động bảo vệ: Ngay khi nhấn đăng xuất, nếu đang ở giao diện Quản trị viên (/admin/*), lập tức đá về trang chủ
watch(
  () => [authStore.isAuthenticated, authStore.isAdmin, route.path],
  ([isAuth, isAdmin, path]) => {
    if (path && path.startsWith('/admin') && (!isAuth || !isAdmin)) {
      router.replace('/');
    }
  }
);

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

onMounted(async () => {
  authStore.checkProfile();
  ttsStore.loadVoices();
  ttsStore.loadDraft();

  // Khởi tạo các tính năng Native trên Android & iOS
  if (isNativeApp()) {
    // Xử lý nút Back phần cứng của Android
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (showAuthModal.value) {
        showAuthModal.value = false;
        return;
      }
      if (showExporterModal.value) {
        showExporterModal.value = false;
        return;
      }
      if (route.path !== '/') {
        router.back();
      } else {
        CapApp.exitApp();
      }
    });
  }
});
</script>

<template>
  <div class="app-layout d-flex flex-column min-vh-100">
    <!-- Thanh điều hướng đầu trang -->
    <Navbar @open-auth="showAuthModal = true" />

    <!-- Nội dung chính của từng trang -->
    <main class="flex-grow-1" :class="{ 'has-player-active': !!playerStore.currentAudioUrl }">
      <router-view @notify="handleNotify" @open-auth="showAuthModal = true" />
    </main>

    <!-- Trình phát Audio chuyên nghiệp gắn chân trang (Persistent Player) -->
    <AudioPlayer @open-exporter="showExporterModal = true" />

    <!-- Thanh điều hướng đáy màn hình cho Điện thoại di động (Bottom Navigation Bar) -->
    <MobileBottomNav />

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
