<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '../stores/themeStore.js';
import { useAuthStore } from '../stores/authStore.js';

const emit = defineEmits(['open-auth']);

const route = useRoute();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const isDark = computed(() => themeStore.currentTheme === 'dark');
const isMobileMenuOpen = ref(false);

watch(() => route.path, () => {
  isMobileMenuOpen.value = false;
});

const navLinks = computed(() => {
  const links = [
    { path: '/', label: 'Đọc văn bản', icon: 'bi-mic' },
    { path: '/library', label: 'Thư viện', icon: 'bi-collection' },
    { path: '/history', label: 'Lịch sử nghe', icon: 'bi-clock-history' },
    { path: '/guide', label: 'Hướng dẫn', icon: 'bi-journal-text' },
    { path: '/settings', label: 'Cài đặt', icon: 'bi-gear' },
  ];

  if (authStore.isAdmin) {
    links.push({
      path: '/admin/dashboard',
      label: 'Quản trị',
      icon: 'bi-shield-check',
      isAdmin: true,
    });
  }

  return links;
});

const handleLogout = async () => {
  await authStore.logout();
  window.location.replace('/');
};
</script>

<template>
  <header class="ui8-header sticky-top">
    <div class="container-fluid px-3 px-lg-4" style="max-width: 1480px;">
      <div class="d-flex align-items-center justify-content-between" style="height: 64px;">
        <!-- Left: Logo & Tag -->
        <router-link to="/" class="d-flex align-items-center gap-2 text-decoration-none">
          <div class="logo-box">
            <i class="bi bi-soundwave text-white"></i>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="logo-title">LsmVoice</span>
            <span class="badge-tag d-none d-sm-inline-flex">AI Studio</span>
          </div>
        </router-link>

        <!-- Center: Nav Items (Desktop) -->
        <nav class="d-none d-lg-flex align-items-center gap-1 nav-center-pill">
          <router-link
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="nav-tab-item"
            :class="{
              active: route.path === link.path || (link.isAdmin && route.path.startsWith('/admin')),
              'admin-link': link.isAdmin,
            }"
          >
            <i class="bi" :class="link.icon"></i>
            <span>{{ link.label }}</span>
          </router-link>
        </nav>

        <!-- Right: Actions & Profile -->
        <div class="d-flex align-items-center gap-2">
          <!-- Theme Toggle -->
          <button
            type="button"
            class="theme-toggle-btn"
            @click="themeStore.toggleTheme"
            :title="isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'"
          >
            <i class="bi" :class="isDark ? 'bi-moon-fill' : 'bi-sun-fill'"></i>
          </button>

          <!-- User dropdown / Auth button -->
          <div v-if="authStore.isAuthenticated" class="dropdown">
            <button
              class="user-pill-btn dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <div class="user-avatar-sm">
                {{ (authStore.user?.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
              </div>
              <span class="d-none d-md-inline text-main fw-semibold small">
                {{ authStore.user?.fullName || authStore.user?.username }}
              </span>
              <span v-if="authStore.isAdmin" class="badge-admin-tag d-none d-md-inline">
                Admin
              </span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border hairline-border py-2" style="border-radius: var(--radius-md); min-width: 220px;">
              <li class="px-3 py-2 small hairline-border-bottom">
                <div class="fw-semibold text-main">{{ authStore.user?.fullName || authStore.user?.username }}</div>
                <div class="text-muted small text-truncate">@{{ authStore.user?.username }} • {{ authStore.user?.email }}</div>
                <div class="mt-1 d-flex gap-1">
                  <span class="badge" :class="authStore.isAdmin ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary'">
                    {{ authStore.isAdmin ? 'QUẢN TRỊ VIÊN' : 'THÀNH VIÊN' }}
                  </span>
                </div>
              </li>
              <li v-if="authStore.isAdmin">
                <router-link to="/admin/dashboard" class="dropdown-item small py-2 fw-semibold text-primary">
                  <i class="bi bi-shield-check me-2"></i> Bảng điều khiển Quản trị
                </router-link>
              </li>
              <li>
                <router-link to="/library" class="dropdown-item small py-2">
                  <i class="bi bi-collection me-2 text-secondary"></i> Thư viện của tôi
                </router-link>
              </li>
              <li>
                <router-link to="/history" class="dropdown-item small py-2">
                  <i class="bi bi-clock-history me-2 text-secondary"></i> Lịch sử nghe
                </router-link>
              </li>
              <li>
                <router-link to="/settings" class="dropdown-item small py-2">
                  <i class="bi bi-gear me-2 text-secondary"></i> Cài đặt tài khoản
                </router-link>
              </li>
              <li><hr class="dropdown-divider my-1 hairline-border" /></li>
              <li>
                <button class="dropdown-item small py-2 text-danger" @click="handleLogout">
                  <i class="bi bi-box-arrow-right me-2"></i> Đăng xuất
                </button>
              </li>
            </ul>
          </div>

          <button
            v-else
            type="button"
            class="btn-login-pill"
            @click="emit('open-auth')"
          >
            <i class="bi bi-person"></i>
            <span>Đăng nhập</span>
          </button>

            <!-- Mobile Menu Hamburger Button -->
            <button
              class="theme-toggle-btn d-lg-none"
              type="button"
              @click="isMobileMenuOpen = !isMobileMenuOpen"
              aria-label="Mở menu điều hướng"
            >
              <i class="bi" :class="isMobileMenuOpen ? 'bi-x-lg' : 'bi-list fs-5'"></i>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Mobile Drawer Backdrop -->
    <transition name="fade">
      <div
        v-if="isMobileMenuOpen"
        class="mobile-drawer-backdrop d-lg-none"
        @click="isMobileMenuOpen = false"
      ></div>
    </transition>

    <!-- Mobile Drawer Sidebar -->
    <transition name="slide-drawer">
      <div v-if="isMobileMenuOpen" class="mobile-drawer-panel d-lg-none">
        <!-- Header of Drawer -->
        <div class="d-flex align-items-center justify-content-between p-3 hairline-border-bottom">
          <div class="d-flex align-items-center gap-2">
            <div class="logo-box" style="width: 32px; height: 32px;">
              <i class="bi bi-soundwave text-white small"></i>
            </div>
            <span class="logo-title" style="font-size: 16.5px;">LsmVoice</span>
            <span class="badge-tag">Mobile</span>
          </div>
          <button
            type="button"
            class="theme-toggle-btn"
            @click="isMobileMenuOpen = false"
            aria-label="Đóng menu"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <!-- User Profile Card in Drawer -->
        <div class="p-3 hairline-border-bottom" style="background: var(--surface-soft);">
          <div v-if="authStore.isAuthenticated" class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2.5 overflow-hidden">
              <div class="user-avatar-sm" style="width: 38px; height: 38px; font-size: 14px;">
                {{ (authStore.user?.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
              </div>
              <div class="overflow-hidden">
                <div class="fw-semibold text-main small text-truncate">
                  {{ authStore.user?.fullName || authStore.user?.username }}
                </div>
                <div class="text-muted small text-truncate" style="font-size: 11px;">
                  @{{ authStore.user?.username }}
                </div>
              </div>
            </div>
            <span class="badge" :class="authStore.isAdmin ? 'badge-admin-tag' : 'badge-neutral'">
              {{ authStore.isAdmin ? 'Admin' : 'Thành viên' }}
            </span>
          </div>
          <div v-else>
            <button
              type="button"
              class="btn-primary-action w-100"
              style="height: 42px;"
              @click="emit('open-auth'); isMobileMenuOpen = false;"
            >
              <i class="bi bi-person me-1"></i>
              <span>Đăng nhập / Đăng ký</span>
            </button>
          </div>
        </div>

        <!-- Navigation Links List (Touch friendly) -->
        <div class="p-2 flex-grow-1 overflow-y-auto">
          <div class="text-muted text-uppercase px-3 py-2 fw-bold" style="font-size: 11px; letter-spacing: 0.05em;">
            Danh mục tính năng
          </div>
          <router-link
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="mobile-nav-item"
            :class="{ active: route.path === link.path || (link.isAdmin && route.path.startsWith('/admin')) }"
            @click="isMobileMenuOpen = false"
          >
            <i class="bi me-2.5 fs-5" :class="link.icon"></i>
            <span class="fw-medium">{{ link.label }}</span>
            <span v-if="link.isAdmin" class="badge-admin-tag ms-2" style="font-size: 10px;">Admin</span>
            <i class="bi bi-chevron-right ms-auto opacity-50 small"></i>
          </router-link>
        </div>

        <!-- Bottom Drawer Actions -->
        <div class="p-3 hairline-border-top d-flex align-items-center justify-content-between gap-2" style="background: var(--surface);">
          <button
            type="button"
            class="btn-secondary-action flex-fill"
            style="height: 40px; font-size: 13px;"
            @click="themeStore.toggleTheme"
          >
            <i class="bi me-1.5" :class="isDark ? 'bi-moon-fill' : 'bi-sun-fill'"></i>
            <span>{{ isDark ? 'Giao diện Tối' : 'Giao diện Sáng' }}</span>
          </button>

          <button
            v-if="authStore.isAuthenticated"
            type="button"
            class="btn-danger-action"
            style="height: 40px; width: 44px; padding: 0;"
            @click="handleLogout(); isMobileMenuOpen = false;"
            title="Đăng xuất"
          >
            <i class="bi bi-box-arrow-right fs-6"></i>
          </button>
        </div>
      </div>
    </transition>
  </template>

<style scoped>
.ui8-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  z-index: 1040;
  backdrop-filter: blur(8px);
}

.logo-box {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--violet) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(120, 150, 255, 0.3);
}

.logo-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.badge-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  background: var(--primary-soft);
  color: var(--primary);
  border: 1px solid var(--primary-border);
}

.badge-admin-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--violet-soft);
  color: var(--violet);
  border: 1px solid var(--violet-border);
}

.nav-center-pill {
  background: var(--surface-soft);
  border-radius: var(--radius-pill);
  padding: 3px;
  border: 1px solid var(--border);
}

.nav-tab-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 550;
  text-decoration: none;
  transition: all 0.15s ease;
}

.nav-tab-item:hover {
  color: var(--text-primary);
}

.nav-tab-item.active {
  background: var(--surface);
  color: var(--primary);
  font-weight: 600;
  box-shadow: var(--shadow-xs);
  border: 1px solid var(--border-subtle);
}

.theme-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-toggle-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--border-focus);
}

.user-pill-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px 3px 4px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.15s ease;
}

.user-pill-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-focus);
}

.user-avatar-sm {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--primary-border);
}

.btn-login-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-login-pill:hover {
  background: var(--surface-hover);
  border-color: var(--primary);
  color: var(--primary);
}

/* --- Mobile Drawer Specific Styles --- */
.mobile-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(11, 13, 20, 0.65);
  backdrop-filter: blur(5px);
  z-index: 1050;
}

.mobile-drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 84%;
  max-width: 320px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-float);
  z-index: 1060;
  display: flex;
  flex-direction: column;
}

.mobile-nav-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14.5px;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.mobile-nav-item:hover,
.mobile-nav-item.active {
  background: var(--primary-soft);
  color: var(--primary);
}

.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-drawer-enter-from,
.slide-drawer-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
