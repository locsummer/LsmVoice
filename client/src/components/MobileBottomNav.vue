<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';

const route = useRoute();
const authStore = useAuthStore();

const navItems = computed(() => {
  const items = [
    {
      to: '/',
      label: 'Studio',
      icon: 'bi-mic',
      activeIcon: 'bi-mic-fill',
      activeMatch: (p) => p === '/',
    },
    {
      to: '/library',
      label: 'Thư viện',
      icon: 'bi-collection-play',
      activeIcon: 'bi-collection-play-fill',
      activeMatch: (p) => p.startsWith('/library'),
    },
    {
      to: '/history',
      label: 'Lịch sử',
      icon: 'bi-clock-history',
      activeIcon: 'bi-clock-history',
      activeMatch: (p) => p.startsWith('/history'),
    },
    {
      to: '/settings',
      label: 'Cài đặt',
      icon: 'bi-gear',
      activeIcon: 'bi-gear-fill',
      activeMatch: (p) => p.startsWith('/settings'),
    },
  ];

  if (authStore.isAdmin) {
    items.push({
      to: '/admin/dashboard',
      label: 'Quản trị',
      icon: 'bi-shield-check',
      activeIcon: 'bi-shield-fill-check',
      activeMatch: (p) => p.startsWith('/admin'),
      isAdmin: true,
    });
  }

  return items;
});
</script>

<template>
  <nav class="mobile-bottom-nav d-lg-none" aria-label="Thanh điều hướng di động">
    <div class="bottom-nav-container">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-tab"
        :class="{
          'is-active': item.activeMatch(route.path),
          'is-admin': item.isAdmin,
        }"
      >
        <div class="tab-icon-wrapper">
          <i
            class="bi"
            :class="item.activeMatch(route.path) ? item.activeIcon : item.icon"
          ></i>
          <span v-if="item.activeMatch(route.path)" class="tab-active-dot"></span>
        </div>
        <span class="tab-label">{{ item.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1040;
  background: var(--surface);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding-bottom: max(6px, env(safe-area-inset-bottom, 6px));
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06);
  user-select: none;
  -webkit-user-select: none;
}

[data-bs-theme="dark"] .mobile-bottom-nav {
  background: rgba(29, 33, 48, 0.92);
  border-top-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.35);
}

.bottom-nav-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 56px;
  max-width: 600px;
  margin: 0 auto;
  padding: 0 4px;
}

.bottom-nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--text-muted);
  padding: 6px 0;
  gap: 3px;
  border-radius: 12px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  -webkit-tap-highlight-color: transparent;
  position: relative;
}

.bottom-nav-tab:active {
  transform: scale(0.92);
  color: var(--primary);
}

.tab-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  line-height: 1;
  height: 22px;
  transition: transform 0.2s ease;
}

.tab-label {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.1px;
  transition: color 0.15s ease, font-weight 0.15s ease;
}

/* Active State */
.bottom-nav-tab.is-active {
  color: var(--primary);
}

.bottom-nav-tab.is-active .tab-icon-wrapper {
  transform: translateY(-1px);
}

.bottom-nav-tab.is-active .tab-label {
  font-weight: 600;
  color: var(--primary);
}

.tab-active-dot {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 6px var(--primary);
}

/* Admin Tab Special Accent */
.bottom-nav-tab.is-admin.is-active {
  color: #7950F2;
}

.bottom-nav-tab.is-admin.is-active .tab-active-dot {
  background: #7950F2;
  box-shadow: 0 0 6px #7950F2;
}
</style>
