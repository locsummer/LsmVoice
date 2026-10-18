<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
  adminGetDashboardSummary,
  adminGetDashboardCharts,
  adminExportBackup,
  adminImportBackup,
} from '../../services/api.js';
import { useNotificationStore } from '../../stores/notificationStore.js';

const notification = useNotificationStore();

const isLoading = ref(true);
const isExporting = ref(false);
const isImporting = ref(false);
const restoreFileInput = ref(null);

const summary = ref({
  totalUsers: 0,
  verifiedEmailUsers: 0,
  newUsersToday: 0,
  newUsers7d: 0,
  newUsers30d: 0,
  activeUsers24h: 0,
  activeUsers7d: 0,
  totalLoginsSuccess: 0,
  totalLoginsFailed: 0,
  lockedUsers: 0,
  totalAudioJobs: 0,
  totalLibraryItems: 0,
  isUsingTurso: false,
});

const chartDays = ref(7);
const isChartLoading = ref(false);
const chartData = ref({
  registrations: [],
  loginsSuccess: [],
  loginsFailed: [],
  activeUsers: [],
  roles: [],
  emailVerification: { verified: 0, unverified: 0 },
});

let dashboardPollTimer = null;

const loadSummary = async (silent = false) => {
  try {
    const res = await adminGetDashboardSummary();
    const data = res.data?.data || res.data || res;
    if (data) {
      summary.value = data;
    }
  } catch (err) {
    if (!silent) notification.error(err.message || 'Không thể tải thống kê tổng quan.');
  }
};

const loadCharts = async (days, silent = false) => {
  chartDays.value = days;
  if (!silent) isChartLoading.value = true;
  try {
    const res = await adminGetDashboardCharts(days);
    const data = res.data?.data || res.data || res;
    if (data) {
      chartData.value = data;
    }
  } catch (err) {
    if (!silent) notification.error(err.message || 'Không thể tải dữ liệu biểu đồ.');
  } finally {
    if (!silent) isChartLoading.value = false;
  }
};

const refreshAll = async (silent = false) => {
  if (!silent) isLoading.value = true;
  await Promise.all([loadSummary(silent), loadCharts(chartDays.value, silent)]);
  if (!silent) isLoading.value = false;
};

onMounted(() => {
  refreshAll();
  // Tự động cập nhật số liệu thực tế mỗi 15 giây
  dashboardPollTimer = setInterval(() => {
    refreshAll(true);
  }, 15000);
});

onUnmounted(() => {
  clearInterval(dashboardPollTimer);
});

// Helper tính toán tỉ lệ phần trăm xác minh email
const verifiedPercentage = computed(() => {
  if (!summary.value.totalUsers) return 0;
  return Math.round((summary.value.verifiedEmailUsers / summary.value.totalUsers) * 100);
});

// Helper tính toán tỉ lệ đăng nhập thành công
const loginSuccessRate = computed(() => {
  const total = summary.value.totalLoginsSuccess + summary.value.totalLoginsFailed;
  if (!total) return 100;
  return Math.round((summary.value.totalLoginsSuccess / total) * 100);
});

// Tính toán số lượng và tỉ lệ phần trăm vai trò thực tế
const adminCount = computed(() => {
  const item = chartData.value.roles?.find((r) => r.role === 'admin');
  if (item) return Number(item.count);
  return summary.value.totalUsers > 0 ? 1 : 0;
});

const userCount = computed(() => {
  const item = chartData.value.roles?.find((r) => r.role === 'user');
  if (item) return Number(item.count);
  return Math.max(0, (summary.value.totalUsers || 0) - adminCount.value);
});

const totalRoleUsers = computed(() => {
  const sum = userCount.value + adminCount.value;
  return sum > 0 ? sum : Math.max(summary.value.totalUsers || 0, 1);
});

const userRolePercentage = computed(() => {
  if (userCount.value === 0) return 0;
  return Math.round((userCount.value / totalRoleUsers.value) * 100);
});

const adminRolePercentage = computed(() => {
  if (adminCount.value === 0) return 0;
  return Math.round((adminCount.value / totalRoleUsers.value) * 100);
});

const unverifiedEmailUsers = computed(() => {
  return Math.max(0, (summary.value.totalUsers || 0) - (summary.value.verifiedEmailUsers || 0));
});

const unverifiedPercentage = computed(() => {
  if (!summary.value.totalUsers) return 0;
  return Math.max(0, 100 - verifiedPercentage.value);
});

// SVG Chart Generator cho Đăng ký mới & Đăng nhập
const maxChartVal = computed(() => {
  const regMax = Math.max(...chartData.value.registrations.map(r => r.count), 0);
  const logMax = Math.max(...chartData.value.loginsSuccess.map(l => l.count), 0);
  return Math.max(regMax, logMax, 5);
});

// Generate SVG points cho đường biểu đồ
const getPolylinePoints = (items, maxVal, width = 600, height = 180) => {
  if (!items || items.length === 0) return '';
  if (items.length === 1) {
    const y = height - (items[0].count / maxVal) * (height - 30) - 15;
    return `0,${y} ${width},${y}`;
  }
  const step = width / (items.length - 1);
  return items.map((item, idx) => {
    const x = idx * step;
    const y = height - (item.count / maxVal) * (height - 30) - 15;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

// Generate SVG polygon cho vùng đổ bóng dưới đường biểu đồ
const getAreaPoints = (items, maxVal, width = 600, height = 180) => {
  if (!items || items.length === 0) return '';
  const polyPoints = getPolylinePoints(items, maxVal, width, height);
  return `0,${height} ${polyPoints} ${width},${height}`;
};

// Xử lý sao lưu dữ liệu toàn hệ thống
const handleExportBackup = async () => {
  isExporting.value = true;
  try {
    const res = await adminExportBackup();
    const data = res.data || res;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lsmvoice_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notification.success('Đã tải xuống tệp sao lưu dữ liệu (.json) thành công!');
  } catch (err) {
    notification.error(err.message || 'Không thể xuất bản sao lưu.');
  } finally {
    isExporting.value = false;
  }
};

const triggerRestoreFile = () => {
  if (restoreFileInput.value) {
    restoreFileInput.value.click();
  }
};

const handleFileRestore = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      isImporting.value = true;
      const backupData = JSON.parse(e.target.result);
      const res = await adminImportBackup(backupData);
      notification.success(res.data?.message || res.message || 'Khôi phục dữ liệu thành công!');
      await refreshAll(false);
    } catch (err) {
      notification.error(err.message || 'Tệp sao lưu không hợp lệ hoặc lỗi định dạng JSON.');
    } finally {
      isImporting.value = false;
      event.target.value = '';
    }
  };
  reader.readAsText(file);
};
</script>

<template>
  <div class="container-fluid px-3 px-lg-4 py-4" style="max-width: 1440px;">
    <!-- Navigation Header Quản trị (Chuẩn SaaS) -->
    <div class="admin-nav-bar p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
      <div class="d-flex align-items-center gap-3">
        <div class="d-flex align-items-center gap-2">
          <span class="live-pulse-dot" title="Hệ thống đang hoạt động theo thời gian thực"></span>
          <h1 class="page-title mb-0" style="font-size: 19px;">Trung tâm Quản trị LsmVoice</h1>
        </div>
        <span
          v-if="summary.isUsingTurso"
          class="badge bg-success-subtle text-success border border-success-subtle d-none d-md-inline-flex align-items-center rounded-pill px-2.5 py-1"
          style="font-size: 11.5px;"
        >
          <i class="bi bi-cloud-check-fill me-1"></i> Turso Cloud SQLite (Vĩnh viễn)
        </span>
        <span
          v-else
          class="badge bg-warning-subtle text-warning border border-warning-subtle d-none d-md-inline-flex align-items-center rounded-pill px-2.5 py-1"
          style="font-size: 11.5px;"
          title="Dữ liệu đang lưu tạm trên ổ đĩa của Render. Cấu hình TURSO_DATABASE_URL để lưu trữ vĩnh viễn."
        >
          <i class="bi bi-hdd-network me-1"></i> SQLite Cục bộ (Tạm thời)
        </span>
      </div>

      <!-- Admin Submenu Pills (Horizontal swipe on phone) -->
      <div class="d-flex align-items-center gap-1.5 flex-wrap admin-tabs-scroll">
        <router-link to="/admin/dashboard" class="admin-tab-pill active">
          <i class="bi bi-speedometer2 me-1.5"></i> Tổng quan
        </router-link>
        <router-link to="/admin/customers" class="admin-tab-pill">
          <i class="bi bi-people me-1.5"></i> Quản lý Khách hàng
        </router-link>
        <router-link to="/admin/logins" class="admin-tab-pill">
          <i class="bi bi-clock-history me-1.5"></i> Nhật ký Đăng nhập
        </router-link>
        <router-link to="/admin/audit" class="admin-tab-pill">
          <i class="bi bi-journal-text me-1.5"></i> Nhật ký Quản trị
        </router-link>
        <button
          class="btn btn-outline-secondary btn-sm rounded-pill ms-1 px-3"
          style="height: 32px; font-size: 12.5px;"
          @click="refreshAll(false)"
          :disabled="isLoading"
          title="Làm mới số liệu ngay"
        >
          <i class="bi bi-arrow-clockwise me-1" :class="{ 'spin-icon': isLoading }"></i>
          <span>Làm mới</span>
        </button>
      </div>
    </div>

    <!-- Hàng 1: Thẻ KPI Metrics (Tối giản, cao cấp) -->
    <div class="row g-3 mb-4">
      <!-- 1. Tổng khách hàng -->
      <div class="col-12 col-sm-6 col-xl-3">
        <div class="kpi-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="kpi-label">Tổng khách hàng</span>
            <div class="kpi-icon-box bg-primary-soft text-primary">
              <i class="bi bi-people"></i>
            </div>
          </div>
          <div class="kpi-value text-main">{{ summary.totalUsers }}</div>
          <div class="d-flex align-items-center gap-2 mt-2">
            <span class="badge-success-pill">
              <i class="bi bi-check-circle me-1"></i> {{ summary.verifiedEmailUsers }} đã xác minh ({{ verifiedPercentage }}%)
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Đăng ký mới -->
      <div class="col-12 col-sm-6 col-xl-3">
        <div class="kpi-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="kpi-label">Đăng ký mới</span>
            <div class="kpi-icon-box bg-primary-soft text-primary">
              <i class="bi bi-person-plus"></i>
            </div>
          </div>
          <div class="kpi-value text-main">
            +{{ summary.newUsersToday }}
            <span class="kpi-unit">hôm nay</span>
          </div>
          <div class="kpi-subtext mt-2">
            <span>7 ngày: <strong class="text-main">+{{ summary.newUsers7d }}</strong></span> • 
            <span>30 ngày: <strong class="text-main">+{{ summary.newUsers30d }}</strong></span>
          </div>
        </div>
      </div>

      <!-- 3. Đang hoạt động -->
      <div class="col-12 col-sm-6 col-xl-3">
        <div class="kpi-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="kpi-label">Người dùng hoạt động</span>
            <div class="kpi-icon-box bg-success-soft text-success">
              <i class="bi bi-lightning-charge"></i>
            </div>
          </div>
          <div class="kpi-value text-main">
            {{ summary.activeUsers24h }}
            <span class="kpi-unit">trong 24h</span>
          </div>
          <div class="kpi-subtext mt-2">
            <span>Hoạt động 7 ngày: <strong class="text-main">{{ summary.activeUsers7d }}</strong> tài khoản</span>
          </div>
        </div>
      </div>

      <!-- 4. Bảo mật & Đăng nhập -->
      <div class="col-12 col-sm-6 col-xl-3">
        <div class="kpi-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="kpi-label">Tỉ lệ đăng nhập</span>
            <div class="kpi-icon-box bg-warning-soft text-warning">
              <i class="bi bi-shield-lock"></i>
            </div>
          </div>
          <div class="kpi-value text-main">
            {{ loginSuccessRate }}%
            <span class="kpi-unit">thành công</span>
          </div>
          <div class="kpi-subtext mt-2 d-flex justify-content-between align-items-center">
            <span class="text-success"><i class="bi bi-check2 me-0.5"></i>{{ summary.totalLoginsSuccess }}</span>
            <span class="text-danger"><i class="bi bi-x me-0.5"></i>{{ summary.totalLoginsFailed }}</span>
            <span v-if="summary.lockedUsers > 0" class="badge-danger-pill" style="font-size: 10.5px;">
              {{ summary.lockedUsers }} bị khóa
            </span>
            <span v-else class="text-muted" style="font-size: 11px;">0 tài khoản bị khóa</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hàng 2: Time-series Charts (Real SVG Charts) -->
    <div class="row g-4 mb-4">
      <!-- Biểu đồ 1: Tăng trưởng tài khoản đăng ký theo thời gian -->
      <div class="col-lg-8">
        <div class="panel-white p-4 h-100">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h2 class="card-title mb-0.5">Tăng trưởng tài khoản đăng ký</h2>
              <span class="section-desc">Dữ liệu tài khoản đăng ký mới thực tế theo ngày</span>
            </div>
            <!-- Range Selector (7 / 30 / 90 days) -->
            <div class="btn-group btn-group-sm">
              <button
                class="btn"
                :class="chartDays === 7 ? 'btn-primary' : 'btn-outline-secondary'"
                @click="loadCharts(7)"
              >
                7 ngày
              </button>
              <button
                class="btn"
                :class="chartDays === 30 ? 'btn-primary' : 'btn-outline-secondary'"
                @click="loadCharts(30)"
              >
                30 ngày
              </button>
              <button
                class="btn"
                :class="chartDays === 90 ? 'btn-primary' : 'btn-outline-secondary'"
                @click="loadCharts(90)"
              >
                90 ngày
              </button>
            </div>
          </div>

          <!-- SVG Trend Chart -->
          <div class="chart-container py-2" style="position: relative; min-height: 220px;">
            <div v-if="isChartLoading" class="chart-loading-overlay">
              <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
            </div>

            <svg viewBox="0 0 600 200" class="w-100" style="overflow: visible;">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Grid lines -->
              <line x1="0" y1="30" x2="600" y2="30" stroke="var(--border)" stroke-dasharray="4" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="var(--border)" stroke-dasharray="4" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="var(--border)" stroke-dasharray="4" />

              <!-- Vùng đổ bóng Area -->
              <polygon
                v-if="chartData.registrations.length > 0"
                fill="url(#chartGradient)"
                :points="getAreaPoints(chartData.registrations, maxChartVal)"
              />

              <!-- Polyline đăng ký -->
              <polyline
                v-if="chartData.registrations.length > 0"
                fill="none"
                stroke="var(--primary)"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                :points="getPolylinePoints(chartData.registrations, maxChartVal)"
              />

              <!-- Circles trên đỉnh điểm dữ liệu -->
              <template v-if="chartData.registrations.length > 0">
                <circle
                  v-for="(item, idx) in chartData.registrations"
                  :key="idx"
                  :cx="(chartData.registrations.length === 1 ? 300 : (idx * (600 / (chartData.registrations.length - 1))))"
                  :cy="180 - (item.count / maxChartVal) * 150 - 15"
                  r="3.5"
                  fill="var(--surface)"
                  stroke="var(--primary)"
                  stroke-width="2.5"
                >
                  <title>{{ item.date }}: {{ item.count }} người dùng</title>
                </circle>
              </template>
            </svg>

            <!-- Trục ngày tháng hiển thị dưới cùng -->
            <div class="d-flex justify-content-between text-muted small mt-2 px-1" style="font-size: 11px;">
              <span v-if="chartData.registrations.length > 0">{{ chartData.registrations[0]?.date }}</span>
              <span v-else>Không có dữ liệu</span>
              <span v-if="chartData.registrations.length > 1">
                {{ chartData.registrations[chartData.registrations.length - 1]?.date }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Biểu đồ 2: Phân bổ & Tỉ lệ tài khoản -->
      <div class="col-lg-4">
        <div class="panel-white p-4 h-100 d-flex flex-column justify-content-between">
          <div>
            <h2 class="card-title mb-0.5">Phân bổ Vai trò & Xác minh</h2>
            <span class="section-desc">Cơ cấu người dùng và độ an toàn email</span>

            <!-- Phân bổ vai trò -->
            <div class="mt-4">
              <div class="d-flex justify-content-between small fw-semibold mb-1">
                <span class="text-secondary">Thành viên (USER)</span>
                <span class="text-main">{{ userCount }} ({{ userRolePercentage }}%)</span>
              </div>
              <div class="progress mb-3" style="height: 6px; background: var(--surface-hover);">
                <div class="progress-bar bg-primary" role="progressbar" :style="{ width: userRolePercentage + '%' }"></div>
              </div>

              <div class="d-flex justify-content-between small fw-semibold mb-1">
                <span class="text-secondary">Quản trị viên (ADMIN)</span>
                <span class="text-main">{{ adminCount }} ({{ adminRolePercentage }}%)</span>
              </div>
              <div class="progress mb-4" style="height: 6px; background: var(--surface-hover);">
                <div class="progress-bar" style="background: var(--violet);" role="progressbar" :style="{ width: adminRolePercentage + '%' }"></div>
              </div>
            </div>

            <!-- Tỉ lệ xác minh email -->
            <div class="hairline-border-top pt-3">
              <div class="d-flex justify-content-between small fw-semibold mb-1">
                <span class="text-secondary">Email đã xác minh</span>
                <span class="text-success">{{ summary.verifiedEmailUsers }} ({{ verifiedPercentage }}%)</span>
              </div>
              <div class="progress mb-3" style="height: 6px; background: var(--surface-hover);">
                <div class="progress-bar bg-success" role="progressbar" :style="{ width: verifiedPercentage + '%' }"></div>
              </div>

              <div class="d-flex justify-content-between small fw-semibold mb-1">
                <span class="text-secondary">Email chưa xác minh</span>
                <span class="text-warning">{{ unverifiedEmailUsers }} ({{ unverifiedPercentage }}%)</span>
              </div>
              <div class="progress mb-3" style="height: 6px; background: var(--surface-hover);">
                <div class="progress-bar bg-warning" role="progressbar" :style="{ width: unverifiedPercentage + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="pt-3 hairline-border-top">
            <router-link to="/admin/customers" class="btn btn-outline-primary btn-sm w-100 rounded-pill py-2">
              <i class="bi bi-people me-1"></i> Quản lý danh sách khách hàng
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Hàng 3: Phím tắt & Tài nguyên -->
    <div class="row g-3">
      <div class="col-md-4">
        <div class="panel-white p-3.5">
          <div class="d-flex align-items-center gap-3">
            <div class="kpi-icon-box bg-violet-soft text-violet fs-4">
              <i class="bi bi-soundwave"></i>
            </div>
            <div>
              <div class="kpi-label mb-0.5">Tác vụ chuyển đổi audio</div>
              <div class="fs-5 fw-bold text-main">{{ summary.totalAudioJobs }} tác vụ</div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="panel-white p-3.5">
          <div class="d-flex align-items-center gap-3">
            <div class="kpi-icon-box bg-primary-soft text-primary fs-4">
              <i class="bi bi-collection"></i>
            </div>
            <div>
              <div class="kpi-label mb-0.5">Tác phẩm lưu trữ</div>
              <div class="fs-5 fw-bold text-main">{{ summary.totalLibraryItems }} tác phẩm</div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="panel-white p-3.5">
          <div class="d-flex align-items-center gap-3">
            <div class="kpi-icon-box" :class="summary.lockedUsers > 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'" style="font-size: 20px;">
              <i class="bi" :class="summary.lockedUsers > 0 ? 'bi-shield-exclamation' : 'bi-shield-check'"></i>
            </div>
            <div>
              <div class="kpi-label mb-0.5">Tài khoản bị khóa</div>
              <div class="fs-5 fw-bold" :class="summary.lockedUsers > 0 ? 'text-danger' : 'text-main'">
                {{ summary.lockedUsers }} tài khoản
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hàng 4: Quản lý Độ bền dữ liệu & Sao lưu / Phục hồi hệ thống -->
    <div class="panel-white p-4 mt-4">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <h2 class="card-title mb-0" style="font-size: 16px;">Sao lưu & Phục hồi Cơ sở dữ liệu</h2>
            <span
              v-if="summary.isUsingTurso"
              class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5"
              style="font-size: 11px;"
            >
              <i class="bi bi-shield-check me-1"></i> Đã kích hoạt Turso Cloud (Vĩnh viễn)
            </span>
            <span
              v-else
              class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-0.5"
              style="font-size: 11px;"
            >
              <i class="bi bi-exclamation-triangle me-1"></i> SQLite Cục bộ (Tạm thời trên Render)
            </span>
          </div>
          <p class="section-desc mb-0" style="font-size: 13px;">
            Bảo vệ toàn vẹn tài khoản khách hàng, mật khẩu, tác phẩm thư viện và lịch sử nghe audio.
          </p>
        </div>

        <!-- Các nút hành động sao lưu -->
        <div class="d-flex align-items-center gap-2">
          <!-- Input ẩn để upload file sao lưu -->
          <input
            ref="restoreFileInput"
            type="file"
            accept=".json,application/json"
            class="d-none"
            @change="handleFileRestore"
          />

          <button
            type="button"
            class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5"
            :disabled="isImporting"
            @click="triggerRestoreFile"
            title="Nạp lại dữ liệu tài khoản và thư viện từ tệp sao lưu JSON"
          >
            <span v-if="isImporting" class="spinner-border spinner-border-sm me-1.5"></span>
            <i v-else class="bi bi-upload me-1.5"></i>
            <span>Khôi phục dữ liệu (.json)</span>
          </button>

          <button
            type="button"
            class="btn-primary-action"
            style="height: 34px; padding: 0 14px; font-size: 12.5px;"
            :disabled="isExporting"
            @click="handleExportBackup"
            title="Tải về tệp sao lưu toàn bộ dữ liệu hệ thống"
          >
            <span v-if="isExporting" class="spinner-border spinner-border-sm me-1.5"></span>
            <i v-else class="bi bi-download me-1.5"></i>
            <span>Tải bản sao lưu toàn bộ</span>
          </button>
        </div>
      </div>

      <!-- Hộp hướng dẫn cấu hình Cloud SQLite vĩnh viễn nếu chưa bật Turso -->
      <div v-if="!summary.isUsingTurso" class="p-3 rounded-3" style="background: var(--surface-soft); border: 1px dashed var(--border);">
        <div class="d-flex align-items-start gap-2.5">
          <i class="bi bi-info-circle-fill text-primary fs-5 mt-0.5 flex-shrink-0"></i>
          <div class="small">
            <strong class="text-main">Tại sao tài khoản bị mất khi Deploy mã mới trên Render?</strong>
            <p class="text-muted mb-2 mt-0.5" style="line-height: 1.5;">
              Dịch vụ miễn phí của Render sử dụng ổ cứng tạm thời (Ephemeral Filesystem). Mỗi khi bạn đẩy code Git mới hoặc server khởi động lại sau thời gian ngủ (Sleep), Render sẽ tạo một container mới và làm mới file SQLite.
            </p>
            <strong class="text-main">Giải pháp lưu trữ vĩnh viễn (100% Miễn phí & Độc lập):</strong>
            <ol class="text-muted mb-0 ps-3 mt-1" style="line-height: 1.6;">
              <li>Đăng ký cơ sở dữ liệu miễn phí tại <strong>turso.tech</strong> (Miễn phí 9GB, không cần thẻ tín dụng).</li>
              <li>Thêm 2 biến môi trường vào Render: <code>TURSO_DATABASE_URL</code> và <code>TURSO_AUTH_TOKEN</code>.</li>
              <li>Hệ thống LsmVoice sẽ tự động lưu dữ liệu lên Turso Cloud, không bao giờ bị mất tài khoản khi deploy nữa!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  box-shadow: var(--shadow-panel);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.kpi-card:hover {
  transform: translateY(-1px);
  border-color: var(--border-focus);
}

.kpi-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.kpi-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.kpi-subtext {
  font-size: 12px;
  color: var(--text-secondary);
}

.kpi-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

.bg-violet-soft {
  background: var(--violet-soft);
  color: var(--violet);
}

.chart-loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--surface);
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: 8px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
