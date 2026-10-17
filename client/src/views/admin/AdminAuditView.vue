<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { adminGetAuditLogs } from '../../services/api.js';
import { useNotificationStore } from '../../stores/notificationStore.js';

const notification = useNotificationStore();

const isLoading = ref(true);
const logs = ref([]);
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
});

const actionFilter = ref('');

const loadLogs = async (page = 1, silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await adminGetAuditLogs({
      page,
      limit: pagination.value.limit,
      action: actionFilter.value || undefined,
    });
    const data = res.data?.data || res.data || res;
    if (data?.logs) {
      logs.value = data.logs;
      pagination.value = data.pagination;
    }
  } catch (err) {
    if (!silent) notification.error(err.message || 'Không thể tải nhật ký quản trị.');
  } finally {
    if (!silent) isLoading.value = false;
  }
};

let auditPollTimer = null;

watch(actionFilter, () => {
  loadLogs(1);
});

onMounted(() => {
  loadLogs(1);
  // Tự động kiểm tra và làm mới nhật ký kiểm toán mỗi 15 giây
  auditPollTimer = setInterval(() => {
    loadLogs(pagination.value.page, true);
  }, 15000);
});

onUnmounted(() => {
  clearInterval(auditPollTimer);
});

const getActionLabel = (action) => {
  switch (action) {
    case 'user_registered':
      return { text: 'Thành viên mới đăng ký', class: 'badge-primary-pill' };
    case 'system_bootstrap':
      return { text: 'Khởi tạo hệ thống', class: 'badge-neutral' };
    case 'lock_user':
    case 'lock_account':
      return { text: 'Khóa mềm (Tạm ngưng)', class: 'badge-warning-pill' };
    case 'unlock_user':
    case 'unlock_account':
      return { text: 'Mở khóa tài khoản', class: 'badge-success-pill' };
    case 'delete_account':
    case 'delete_user':
      return { text: 'Khóa cứng (Xóa vĩnh viễn)', class: 'badge-danger-pill' };
    case 'change_role':
      return { text: 'Thay đổi vai trò', class: 'badge-violet-pill' };
    case 'revoke_sessions':
      return { text: 'Thu hồi phiên đăng nhập', class: 'badge-neutral' };
    case 'resend_verification':
      return { text: 'Gửi lại email xác minh', class: 'badge-primary-pill' };
    default:
      return { text: action, class: 'badge-neutral' };
  }
};

const formatDetails = (rawDetails) => {
  if (!rawDetails) return '—';
  try {
    const parsed = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : rawDetails;
    if (parsed.message) return parsed.message;
    if (parsed.reason) return `Lý do: ${parsed.reason}`;
    if (parsed.oldRole && parsed.newRole) return `Từ "${parsed.oldRole}" sang "${parsed.newRole}"`;
    if (parsed.deletedUser) return `Đã xóa vĩnh viễn: @${parsed.deletedUser.username} (${parsed.deletedUser.email})`;
    return JSON.stringify(parsed);
  } catch {
    return String(rawDetails);
  }
};

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
          <h1 class="page-title mb-0" style="font-size: 19px;">Nhật ký Thao tác Quản trị</h1>
        </div>
        <span class="badge-neutral" style="font-size: 11px;">
          {{ pagination.total }} bản ghi
        </span>
      </div>

      <!-- Admin Submenu Pills -->
      <div class="d-flex align-items-center gap-1.5 flex-wrap">
        <router-link to="/admin/dashboard" class="admin-tab-pill">
          <i class="bi bi-speedometer2 me-1.5"></i> Tổng quan
        </router-link>
        <router-link to="/admin/customers" class="admin-tab-pill">
          <i class="bi bi-people me-1.5"></i> Quản lý Khách hàng
        </router-link>
        <router-link to="/admin/logins" class="admin-tab-pill">
          <i class="bi bi-clock-history me-1.5"></i> Nhật ký Đăng nhập
        </router-link>
        <router-link to="/admin/audit" class="admin-tab-pill active">
          <i class="bi bi-journal-text me-1.5"></i> Nhật ký Quản trị
        </router-link>
        <button
          class="btn btn-outline-secondary btn-sm rounded-pill ms-1 px-3"
          style="height: 32px; font-size: 12.5px;"
          @click="loadLogs(pagination.page, false)"
          :disabled="isLoading"
          title="Làm mới danh sách"
        >
          <i class="bi bi-arrow-clockwise me-1" :class="{ 'spin-icon': isLoading }"></i>
          <span>Làm mới</span>
        </button>
      </div>
    </div>

    <!-- Bộ lọc hành động quản trị -->
    <div class="panel-white p-3 mb-4">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <label class="control-label mb-0 small text-muted">Lọc theo hành vi:</label>
          <select v-model="actionFilter" class="form-select form-select-sm" style="height: 38px; min-width: 220px;">
            <option value="">Tất cả thao tác can thiệp</option>
            <option value="user_registered">Thành viên mới đăng ký</option>
            <option value="lock_user">Khóa mềm (Tạm ngưng)</option>
            <option value="unlock_user">Mở khóa tài khoản</option>
            <option value="delete_account">Khóa cứng (Xóa vĩnh viễn)</option>
            <option value="change_role">Thay đổi quyền (Role)</option>
            <option value="revoke_sessions">Thu hồi phiên đăng nhập</option>
            <option value="resend_verification">Gửi lại email xác minh</option>
          </select>
        </div>

        <button
          v-if="actionFilter"
          class="btn btn-link btn-sm text-primary p-0 text-decoration-none small fw-semibold"
          @click="actionFilter = ''"
        >
          <i class="bi bi-arrow-counterclockwise me-1"></i> Xem tất cả
        </button>
      </div>
    </div>

    <!-- Bảng nhật ký quản trị -->
    <div class="panel-white p-0 mb-4 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 custom-admin-table">
          <thead>
            <tr>
              <th scope="col" class="ps-4">Thời gian</th>
              <th scope="col">Quản trị viên thực hiện</th>
              <th scope="col">Hành động can thiệp</th>
              <th scope="col">Tài khoản đích</th>
              <th scope="col">Chi tiết thay đổi</th>
              <th scope="col" class="pe-4">Địa chỉ IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-5 text-muted">
                <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                Đang tải nhật ký kiểm toán quản trị...
              </td>
            </tr>

            <tr v-else-if="logs.length === 0">
              <td colspan="6" class="text-center py-5 text-muted">
                <i class="bi bi-shield-check fs-2 d-block mb-2 text-secondary opacity-50"></i>
                Chưa có thao tác quản trị nào được ghi nhận.
              </td>
            </tr>

            <tr v-else v-for="l in logs" :key="l.id">
              <!-- Thời gian -->
              <td class="ps-4 small text-main fw-medium text-nowrap">
                {{ formatDate(l.created_at) }}
              </td>

              <!-- Admin Email -->
              <td>
                <div class="fw-semibold text-main small">{{ l.admin_email }}</div>
                <div class="text-muted" style="font-size: 11px;">ID #{{ l.admin_id }}</div>
              </td>

              <!-- Hành động -->
              <td>
                <span :class="getActionLabel(l.action).class">
                  {{ getActionLabel(l.action).text }}
                </span>
              </td>

              <!-- Khách hàng đích -->
              <td>
                <div class="text-main small">{{ l.target_user_email || '—' }}</div>
                <div v-if="l.target_user_id" class="text-muted" style="font-size: 11px;">
                  User ID: {{ l.target_user_id }}
                </div>
              </td>

              <!-- Chi tiết -->
              <td class="small text-secondary" style="max-width: 380px;">
                {{ formatDetails(l.details) }}
              </td>

              <!-- IP -->
              <td class="pe-4 small font-monospace text-muted">
                {{ l.ip_address || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <div class="p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 hairline-border-top" style="background: var(--surface-soft);">
        <span class="small text-muted">
          Trang <strong>{{ pagination.page }}</strong> / <strong>{{ pagination.totalPages }}</strong>
          (Tổng số <strong>{{ pagination.total }}</strong> bản ghi)
        </span>
        <div class="btn-group btn-group-sm">
          <button
            class="btn btn-outline-secondary"
            :disabled="pagination.page <= 1 || isLoading"
            @click="loadLogs(pagination.page - 1)"
          >
            <i class="bi bi-chevron-left me-1"></i> Trang trước
          </button>
          <button
            class="btn btn-outline-secondary"
            :disabled="pagination.page >= pagination.totalPages || isLoading"
            @click="loadLogs(pagination.page + 1)"
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
