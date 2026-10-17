<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '../stores/themeStore.js';
import { useAuthStore } from '../stores/authStore.js';

const emit = defineEmits(['open-auth']);

const route = useRoute();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const isDark = computed(() => themeStore.currentTheme === 'dark');

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
                <button class="dropdown-item small py-2 text-danger" @click="authStore.logout">
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

          <!-- Mobile Menu Drawer Toggle -->
          <div class="dropdown d-lg-none">
            <button
              class="theme-toggle-btn"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i class="bi bi-list fs-5"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border hairline-border p-2" style="border-radius: var(--radius-md); min-width: 200px;">
              <li v-for="link in navLinks" :key="link.path">
                <router-link
                  :to="link.path"
                  class="dropdown-item small py-2 rounded-2"
                  :class="{ 'fw-bold text-primary bg-primary-subtle': route.path === link.path || (link.isAdmin && route.path.startsWith('/admin')) }"
                >
                  <i class="bi me-2" :class="link.icon"></i>
                  {{ link.label }}
                </router-link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </header>
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
</style>
