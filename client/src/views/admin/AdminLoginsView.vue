<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { adminGetLoginEvents } from '../../services/api.js';
import { useNotificationStore } from '../../stores/notificationStore.js';

const notification = useNotificationStore();

const isLoading = ref(true);
const events = ref([]);
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
});

const statusFilter = ref('');
const search = ref('');

const loadEvents = async (page = 1, silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await adminGetLoginEvents({
      page,
      limit: pagination.value.limit,
      status: statusFilter.value || undefined,
      search: search.value.trim() || undefined,
    });
    const data = res.data?.data || res.data || res;
    if (data?.events) {
      events.value = data.events;
      pagination.value = data.pagination;
    }
  } catch (err) {
    if (!silent) notification.error(err.message || 'Không thể tải nhật ký đăng nhập.');
  } finally {
    if (!silent) isLoading.value = false;
  }
};

let debounceTimeout = null;
let loginsPollTimer = null;

watch([statusFilter, search], () => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    loadEvents(1);
  }, 250);
});

onMounted(() => {
  loadEvents(1);
  // Tự động kiểm tra nhật ký đăng nhập mỗi 15 giây
  loginsPollTimer = setInterval(() => {
    loadEvents(pagination.value.page, true);
  }, 15000);
});

onUnmounted(() => {
  clearInterval(loginsPollTimer);
});

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
</script>

<template>
  <div class="container-fluid px-3 px-lg-4 py-4" style="max-width: 1440px;">
    <!-- Navigation Header Quản trị (Chuẩn SaaS) -->
    <div class="admin-nav-bar p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
      <div class="d-flex align-items-center gap-3">
        <div class="d-flex align-items-center gap-2">
          <span class="live-pulse-dot" title="Dữ liệu đồng bộ trực tiếp"></span>
          <h1 class="page-title mb-0" style="font-size: 19px;">Nhật ký Đăng nhập</h1>
        </div>
        <span class="badge-neutral" style="font-size: 11px;">
          {{ pagination.total }} sự kiện
        </span>
      </div>

      <!-- Admin Submenu Pills (Horizontal swipe on phone) -->
      <div class="d-flex align-items-center gap-1.5 flex-wrap admin-tabs-scroll w-100 w-md-auto">
        <router-link to="/admin/dashboard" class="admin-tab-pill">
          <i class="bi bi-speedometer2 me-1.5"></i> Tổng quan
        </router-link>
        <router-link to="/admin/customers" class="admin-tab-pill">
          <i class="bi bi-people me-1.5"></i> Quản lý Khách hàng
        </router-link>
        <router-link to="/admin/logins" class="admin-tab-pill active">
          <i class="bi bi-clock-history me-1.5"></i> Nhật ký Đăng nhập
        </router-link>
        <router-link to="/admin/audit" class="admin-tab-pill">
          <i class="bi bi-journal-text me-1.5"></i> Nhật ký Quản trị
        </router-link>
        <button
          class="btn btn-outline-secondary btn-sm rounded-pill ms-1 px-3"
          style="height: 32px; font-size: 12.5px;"
          @click="loadEvents(pagination.page, false)"
          :disabled="isLoading"
          title="Làm mới danh sách"
        >
          <i class="bi bi-arrow-clockwise me-1" :class="{ 'spin-icon': isLoading }"></i>
          <span>Làm mới</span>
        </button>
      </div>
    </div>

    <!-- Bộ lọc & Tìm kiếm -->
    <div class="panel-white p-3 mb-4">
      <div class="row g-2 align-items-center">
        <div class="col-12 col-md-6">
          <div class="input-group">
            <span class="input-group-text bg-transparent border-end-0 text-muted ps-3">
              <i class="bi bi-search"></i>
            </span>
            <input
              v-model="search"
              type="text"
              class="form-control border-start-0 ps-1"
              style="height: 38px;"
              placeholder="Tìm theo email, username, hoặc địa chỉ IP..."
            />
            <button
              v-if="search"
              class="btn btn-link input-group-text bg-transparent border-start-0 text-muted text-decoration-none"
              type="button"
              @click="search = ''"
            >
              <i class="bi bi-x-circle-fill"></i>
            </button>
          </div>
        </div>

        <div class="col-12 col-md-3">
          <select v-model="statusFilter" class="form-select form-select-sm" style="height: 38px;">
            <option value="">Tất cả trạng thái</option>
            <option value="success">Đăng nhập thành công</option>
            <option value="failed">Đăng nhập thất bại</option>
          </select>
        </div>

        <div class="col-12 col-md-3 text-end" v-if="search || statusFilter">
          <button class="btn btn-link btn-sm text-primary p-0 text-decoration-none small fw-semibold" @click="search = ''; statusFilter = ''">
            <i class="bi bi-arrow-counterclockwise me-1"></i> Đặt lại bộ lọc
          </button>
        </div>
      </div>
    </div>

    <!-- Bảng sự kiện đăng nhập -->
    <div class="panel-white p-0 mb-4 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 custom-admin-table">
          <thead>
            <tr>
              <th scope="col" class="ps-4">Thời gian</th>
              <th scope="col">Định danh / Tài khoản</th>
              <th scope="col">Phương thức</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Lý do thất bại</th>
              <th scope="col">Địa chỉ IP</th>
              <th scope="col" class="pe-4">Thiết bị (User-Agent)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5 text-muted">
                <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                Đang tải sự kiện đăng nhập...
              </td>
            </tr>

            <tr v-else-if="events.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-shield-check fs-2 d-block mb-2 text-secondary opacity-50"></i>
                Không có sự kiện đăng nhập nào được ghi nhận.
              </td>
            </tr>

            <tr v-else v-for="e in events" :key="e.id">
              <!-- Thời gian -->
              <td class="ps-4 small text-main fw-medium text-nowrap">
                {{ formatDate(e.created_at) }}
              </td>

              <!-- Định danh -->
              <td>
                <div class="fw-semibold text-main small">{{ e.identifier }}</div>
                <div v-if="e.username" class="text-muted" style="font-size: 11px;">
                  @{{ e.username }}
                </div>
              </td>

              <!-- Phương thức -->
              <td>
                <span class="badge-neutral" style="font-size: 11px;">
                  {{ e.method === 'otp' ? 'Mã OTP Email' : 'Mật khẩu' }}
                </span>
              </td>

              <!-- Trạng thái -->
              <td>
                <span v-if="e.status === 'success'" class="badge-success-pill">
                  <i class="bi bi-check-circle me-1"></i> Thành công
                </span>
                <span v-else class="badge-danger-pill">
                  <i class="bi bi-x-circle me-1"></i> Thất bại
                </span>
              </td>

              <!-- Lý do thất bại -->
              <td class="small text-danger">
                {{ e.failure_reason || '—' }}
              </td>

              <!-- IP -->
              <td class="small font-monospace text-muted">
                {{ e.ip_address || '—' }}
              </td>

              <!-- Thiết bị -->
              <td class="pe-4 small text-secondary text-truncate" style="max-width: 280px;" :title="e.user_agent">
                {{ e.user_agent || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <div class="p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 hairline-border-top" style="background: var(--surface-soft);">
        <span class="small text-muted">
          Trang <strong>{{ pagination.page }}</strong> / <strong>{{ pagination.totalPages }}</strong>
          (Tổng số <strong>{{ pagination.total }}</strong> sự kiện)
        </span>
        <div class="btn-group btn-group-sm">
          <button
            class="btn btn-outline-secondary"
            :disabled="pagination.page <= 1 || isLoading"
            @click="loadEvents(pagination.page - 1)"
          >
            <i class="bi bi-chevron-left me-1"></i> Trang trước
          </button>
          <button
            class="btn btn-outline-secondary"
            :disabled="pagination.page >= pagination.totalPages || isLoading"
            @click="loadEvents(pagination.page + 1)"
          >
            Trang tiếp <i class="bi bi-chevron-right ms-1"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
