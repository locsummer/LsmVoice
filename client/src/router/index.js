import { createRouter, createWebHistory } from 'vue-router';
import StudioView from '../views/StudioView.vue';
import LibraryView from '../views/LibraryView.vue';
import HistoryView from '../views/HistoryView.vue';
import GuideView from '../views/GuideView.vue';
import SettingsView from '../views/SettingsView.vue';
import AdminDashboardView from '../views/admin/AdminDashboardView.vue';
import AdminCustomersView from '../views/admin/AdminCustomersView.vue';
import AdminLoginsView from '../views/admin/AdminLoginsView.vue';
import AdminAuditView from '../views/admin/AdminAuditView.vue';

const routes = [
  {
    path: '/',
    name: 'studio',
    component: StudioView,
  },
  {
    path: '/library',
    name: 'library',
    component: LibraryView,
  },
  {
    path: '/history',
    name: 'history',
    component: HistoryView,
  },
  {
    path: '/guide',
    name: 'guide',
    component: GuideView,
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
  },
  {
    path: '/admin',
    redirect: '/admin/dashboard',
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: AdminDashboardView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/customers',
    name: 'admin-customers',
    component: AdminCustomersView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/logins',
    name: 'admin-logins',
    component: AdminLoginsView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/audit',
    name: 'admin-audit',
    component: AdminAuditView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAdmin) {
    const token = localStorage.getItem('lsm_token') || sessionStorage.getItem('lsm_token');
    const userRaw = localStorage.getItem('lsm_user') || sessionStorage.getItem('lsm_user');
    let user = null;
    try {
      user = userRaw ? JSON.parse(userRaw) : null;
    } catch (_) {}

    if (!token || !user || user.role !== 'admin') {
      return next({ path: '/' });
    }
  }
  next();
});

export default router;
