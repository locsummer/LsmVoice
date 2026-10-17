<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import {
  adminGetCustomers,
  adminGetCustomerDetails,
  adminUpdateCustomerStatus,
  adminUpdateCustomerRole,
  adminDeleteCustomer,
  adminRevokeCustomerSessions,
  adminResendCustomerVerification,
} from '../../services/api.js';
import { useNotificationStore } from '../../stores/notificationStore.js';
import { useAuthStore } from '../../stores/authStore.js';

const notification = useNotificationStore();
const authStore = useAuthStore();

const isLoading = ref(true);
const customers = ref([]);
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
});

// Filters
const search = ref('');
const roleFilter = ref('');
const statusFilter = ref('');
const verifiedFilter = ref('');
const sortBy = ref('newest');

const hasActiveFilters = computed(() => {
  return !!(search.value.trim() || roleFilter.value || statusFilter.value || verifiedFilter.value !== '' || sortBy.value !== 'newest');
});

const clearFilters = () => {
  search.value = '';
  roleFilter.value = '';
  statusFilter.value = '';
  verifiedFilter.value = '';
  sortBy.value = 'newest';
};

// Customer Detail Modal
const selectedCustomer = ref(null);
const isLoadingDetails = ref(false);
const showDetailModal = ref(false);

// Action Dialogs / Confirmations
const isActionLoading = ref(false);
let refreshTimer = null;

const loadCustomers = async (page = 1, silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await adminGetCustomers({
      page,
      limit: pagination.value.limit,
      search: search.value.trim() || undefined,
      role: roleFilter.value || undefined,
      status: statusFilter.value || undefined,
      is_email_verified: verifiedFilter.value !== '' ? verifiedFilter.value : undefined,
      sortBy: sortBy.value,
    });
    const data = res.data?.data || res.data || res;
    if (data?.customers) {
      customers.value = data.customers;
      pagination.value = data.pagination;
    }
  } catch (err) {
    if (!silent) notification.error(err.message || 'Không thể tải danh sách khách hàng.');
  } finally {
    if (!silent) isLoading.value = false;
  }
};

let searchDebounceTimeout = null;
watch([search, roleFilter, statusFilter, verifiedFilter, sortBy], () => {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    loadCustomers(1);
  }, 250);
});

onMounted(() => {
  loadCustomers(1);
  // Tự động kiểm tra và làm mới danh sách thành viên mỗi 15 giây
  refreshTimer = setInterval(() => {
    if (!showDetailModal.value) {
      loadCustomers(pagination.value.page, true);
    }
  }, 15000);
});

onUnmounted(() => {
  clearInterval(refreshTimer);
});

// Xem chi tiết khách hàng
const openDetailsModal = async (customerId) => {
  isLoadingDetails.value = true;
  showDetailModal.value = true;
  selectedCustomer.value = null;
  try {
    const res = await adminGetCustomerDetails(customerId);
    const data = res.data?.data || res.data || res;
    if (data) {
      selectedCustomer.value = {
        ...data,
        user: data.customer || data.user || {},
        sessions: data.activeSessions || data.sessions || [],
      };
    }
  } catch (err) {
    notification.error(err.message || 'Không thể tải chi tiết người dùng.');
    showDetailModal.value = false;
  } finally {
    isLoadingDetails.value = false;
  }
};

// Khóa mềm / Mở khóa tài khoản
const handleToggleLock = async (customer) => {
  if (customer.id === authStore.user?.id || customer.username === authStore.user?.username) {
    notification.warning('Bạn không thể tự khóa tài khoản của chính mình.');
    return;
  }
  if (customer.role === 'admin') {
    notification.warning('Không thể khóa tài khoản có vai trò Quản trị viên (Admin).');
    return;
  }

  const isLocking = customer.status !== 'locked';
  const actionText = isLocking ? 'Khóa mềm tài khoản' : 'Mở khóa tài khoản';

  const confirmed = await notification.askConfirm({
    title: `${actionText}?`,
    message: isLocking
      ? `Bạn có chắc chắn muốn KHÓA MỀM tài khoản "${customer.username}" (${customer.email})? Người dùng này sẽ bị thu hồi toàn bộ phiên đăng nhập ngay lập tức.`
      : `Bạn có muốn mở khóa cho tài khoản "${customer.username}" để họ có thể đăng nhập bình thường?`,
    confirmText: isLocking ? 'Khóa mềm' : 'Mở khóa',
    cancelText: 'Hủy',
    type: isLocking ? 'danger' : 'info',
  });

  if (!confirmed) return;

  isActionLoading.value = true;
  try {
    const newStatus = isLocking ? 'locked' : 'active';
    await adminUpdateCustomerStatus(customer.id, {
      status: newStatus,
      reason: isLocking ? 'Quản trị viên thao tác khóa mềm thủ công' : 'Quản trị viên mở khóa',
    });
    notification.success(`Đã ${actionText.toLowerCase()} "${customer.username}" thành công.`);
    await loadCustomers(pagination.value.page);
    if (selectedCustomer.value && (selectedCustomer.value.user?.id === customer.id || selectedCustomer.value.customer?.id === customer.id)) {
      if (selectedCustomer.value.user) selectedCustomer.value.user.status = newStatus;
      if (selectedCustomer.value.customer) selectedCustomer.value.customer.status = newStatus;
    }
  } catch (err) {
    notification.error(err.message || `Lỗi khi thực hiện ${actionText.toLowerCase()}.`);
  } finally {
    isActionLoading.value = false;
  }
};

// Khóa cứng: Xóa luôn tài khoản vĩnh viễn khỏi hệ thống
const handleDeleteCustomer = async (customer) => {
  if (customer.id === authStore.user?.id || customer.username === authStore.user?.username) {
    notification.warning('Bạn không thể tự xóa tài khoản quản trị của chính mình.');
    return;
  }
  if (customer.role === 'admin') {
    notification.warning('Không thể xóa tài khoản Quản trị viên (Admin). Vui lòng hạ quyền xuống User trước nếu thực sự cần xóa.');
    return;
  }

  const confirmed = await notification.askConfirm({
    title: 'Xác nhận KHÓA CỨNG (Xóa luôn tài khoản)?',
    message: `CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "${customer.username}" (${customer.email})?\n\nToàn bộ dữ liệu của người dùng này (thư viện sách, lịch sử nghe, tệp âm thanh và phiên đăng nhập) sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu. Thao tác này KHÔNG THỂ HOÀN TÁC!`,
    confirmText: 'Xóa vĩnh viễn (Khóa cứng)',
    cancelText: 'Hủy',
    type: 'danger',
  });

  if (!confirmed) return;

  isActionLoading.value = true;
  try {
    await adminDeleteCustomer(customer.id);
    notification.success(`Đã xóa vĩnh viễn tài khoản "${customer.username}" khỏi hệ thống.`);
    if (showDetailModal.value && (selectedCustomer.value?.user?.id === customer.id || selectedCustomer.value?.customer?.id === customer.id)) {
      showDetailModal.value = false;
      selectedCustomer.value = null;
    }
    await loadCustomers(pagination.value.page);
  } catch (err) {
    notification.error(err.message || 'Không thể xóa tài khoản người dùng.');
  } finally {
    isActionLoading.value = false;
  }
};

// Đổi vai trò (User <-> Admin)
const handleChangeRole = async (customer) => {
  if (customer.id === authStore.user?.id) {
    notification.warning('Bạn không thể tự hạ quyền quản trị của chính mình.');
    return;
  }

  const newRole = customer.role === 'admin' ? 'user' : 'admin';
  const roleName = newRole === 'admin' ? 'QUẢN TRỊ VIÊN (Admin)' : 'THÀNH VIÊN (User)';

  const confirmed = await notification.askConfirm({
    title: `Thay đổi quyền người dùng?`,
    message: `Bạn có chắc muốn đổi vai trò của "${customer.username}" thành ${roleName}?`,
    confirmText: 'Đổi quyền',
    cancelText: 'Hủy',
    type: newRole === 'admin' ? 'warning' : 'info',
  });

  if (!confirmed) return;

  isActionLoading.value = true;
  try {
    await adminUpdateCustomerRole(customer.id, { role: newRole });
    notification.success(`Đã chuyển vai trò của "${customer.username}" thành ${roleName}.`);
    await loadCustomers(pagination.value.page);
    if (selectedCustomer.value && (selectedCustomer.value.user?.id === customer.id || selectedCustomer.value.customer?.id === customer.id)) {
      if (selectedCustomer.value.user) selectedCustomer.value.user.role = newRole;
      if (selectedCustomer.value.customer) selectedCustomer.value.customer.role = newRole;
    }
  } catch (err) {
    notification.error(err.message || 'Không thể thay đổi quyền tài khoản.');
  } finally {
    isActionLoading.value = false;
  }
};

// Thu hồi tất cả phiên đăng nhập
const handleRevokeSessions = async (customer) => {
  const confirmed = await notification.askConfirm({
    title: 'Thu hồi toàn bộ phiên đăng nhập?',
    message: `Đăng xuất tài khoản "${customer.username}" khỏi tất cả các thiết bị và trình duyệt đang mở?`,
    confirmText: 'Thu hồi phiên',
    cancelText: 'Hủy',
    type: 'danger',
  });

  if (!confirmed) return;

  isActionLoading.value = true;
  try {
    await adminRevokeCustomerSessions(customer.id);
    notification.success(`Đã thu hồi toàn bộ phiên đăng nhập của "${customer.username}".`);
    if (showDetailModal.value && selectedCustomer.value) {
      await openDetailsModal(customer.id);
    }
  } catch (err) {
    notification.error(err.message || 'Lỗi khi thu hồi phiên đăng nhập.');
  } finally {
    isActionLoading.value = false;
  }
};

// Gửi lại email xác minh
const handleResendVerification = async (customer) => {
  isActionLoading.value = true;
  try {
    const res = await adminResendCustomerVerification(customer.id);
    notification.success(res.data?.message || `Đã gửi lại mã xác minh tới email ${customer.email}.`);
  } catch (err) {
    notification.error(err.message || 'Không thể gửi lại email xác minh.');
  } finally {
    isActionLoading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Chưa có';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
          <h1 class="page-title mb-0" style="font-size: 19px;">Quản lý Khách hàng</h1>
        </div>
        <span class="badge-neutral" style="font-size: 11px;">
          {{ pagination.total }} tài khoản
        </span>
      </div>

      <!-- Admin Submenu Pills (Horizontal swipe on phone) -->
      <div class="d-flex align-items-center gap-1.5 flex-wrap admin-tabs-scroll">
        <router-link to="/admin/dashboard" class="admin-tab-pill">
          <i class="bi bi-speedometer2 me-1.5"></i> Tổng quan
        </router-link>
        <router-link to="/admin/customers" class="admin-tab-pill active">
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
          @click="loadCustomers(pagination.page, false)"
          :disabled="isLoading"
          title="Làm mới danh sách"
        >
          <i class="bi bi-arrow-clockwise me-1" :class="{ 'spin-icon': isLoading }"></i>
          <span>Làm mới</span>
        </button>
      </div>
    </div>

    <!-- Thanh tìm kiếm và bộ lọc đồng nhất (Unified SaaS Filter Bar) -->
    <div class="panel-white p-3 mb-4">
      <div class="row g-2 align-items-center">
        <!-- Ô tìm kiếm -->
        <div class="col-12 col-md-4">
          <div class="input-group">
            <span class="input-group-text bg-transparent border-end-0 text-muted ps-3">
              <i class="bi bi-search"></i>
            </span>
            <input
              v-model="search"
              type="text"
              class="form-control border-start-0 ps-1"
              style="height: 38px;"
              placeholder="Tìm theo username, email, tên..."
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

        <!-- Bộ lọc vai trò -->
        <div class="col-6 col-sm-4 col-md-2">
          <select v-model="roleFilter" class="form-select form-select-sm" style="height: 38px;">
            <option value="">Tất cả vai trò</option>
            <option value="user">USER (Thành viên)</option>
            <option value="admin">ADMIN (Quản trị)</option>
          </select>
        </div>

        <!-- Bộ lọc trạng thái -->
        <div class="col-6 col-sm-4 col-md-2">
          <select v-model="statusFilter" class="form-select form-select-sm" style="height: 38px;">
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
        </div>

        <!-- Bộ lọc xác minh -->
        <div class="col-6 col-sm-4 col-md-2">
          <select v-model="verifiedFilter" class="form-select form-select-sm" style="height: 38px;">
            <option value="">Xác minh email</option>
            <option value="1">Đã xác minh</option>
            <option value="0">Chưa xác minh</option>
          </select>
        </div>

        <!-- Sắp xếp -->
        <div class="col-6 col-sm-4 col-md-2">
          <select v-model="sortBy" class="form-select form-select-sm" style="height: 38px;">
            <option value="newest">Mới đăng ký</option>
            <option value="oldest">Cũ nhất</option>
            <option value="last_login">Đăng nhập gần nhất</option>
            <option value="most_active">Nhiều đăng nhập nhất</option>
          </select>
        </div>
      </div>

      <!-- Nút xóa bộ lọc nếu đang áp dụng -->
      <div v-if="hasActiveFilters" class="d-flex align-items-center gap-2 mt-2.5 pt-2 hairline-border-top">
        <span class="small text-muted">Đang áp dụng bộ lọc tùy chỉnh</span>
        <button class="btn btn-link btn-sm text-primary p-0 text-decoration-none small fw-semibold" @click="clearFilters">
          <i class="bi bi-arrow-counterclockwise me-1"></i> Đặt lại bộ lọc
        </button>
      </div>
    </div>

    <!-- Bảng dữ liệu khách hàng (Modern SaaS Table) -->
    <div class="panel-white p-0 mb-4 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 custom-admin-table">
          <thead>
            <tr>
              <th scope="col" class="ps-4">Tài khoản & Họ tên</th>
              <th scope="col">Email & Xác minh</th>
              <th scope="col">Vai trò</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Đăng nhập gần nhất</th>
              <th scope="col">Ngày tạo</th>
              <th scope="col" class="text-end pe-4">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5 text-muted">
                <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                Đang tải danh sách thành viên...
              </td>
            </tr>

            <tr v-else-if="customers.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-people fs-2 d-block mb-2 text-secondary opacity-50"></i>
                Không tìm thấy khách hàng nào phù hợp với bộ lọc.
              </td>
            </tr>

            <tr v-else v-for="c in customers" :key="c.id">
              <!-- Tài khoản & Tên -->
              <td class="ps-4">
                <div class="d-flex align-items-center gap-2.5">
                  <div class="user-avatar-sm">
                    {{ (c.full_name || c.username || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="fw-semibold text-main text-truncate" style="max-width: 170px;">
                      {{ c.full_name || c.username }}
                    </div>
                    <div class="small text-muted">@{{ c.username }}</div>
                  </div>
                </div>
              </td>

              <!-- Email -->
              <td>
                <div class="text-main small">{{ c.email }}</div>
                <span v-if="c.is_email_verified" class="badge-success-pill" style="font-size: 10.5px;">
                  <i class="bi bi-check-circle me-1"></i> Đã xác minh
                </span>
                <span v-else class="badge-warning-pill" style="font-size: 10.5px;">
                  <i class="bi bi-exclamation-circle me-1"></i> Chưa xác minh
                </span>
              </td>

              <!-- Vai trò -->
              <td>
                <span
                  class="badge rounded-pill"
                  :class="c.role === 'admin' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary'"
                  style="font-size: 11px; font-weight: 600;"
                >
                  {{ c.role === 'admin' ? 'ADMIN' : 'USER' }}
                </span>
              </td>

              <!-- Trạng thái -->
              <td>
                <span v-if="c.status === 'active'" class="badge-success-pill">
                  Hoạt động
                </span>
                <span v-else-if="c.status === 'locked'" class="badge-danger-pill">
                  Bị khóa
                </span>
                <span v-else class="badge-neutral">
                  {{ c.status }}
                </span>
              </td>

              <!-- Đăng nhập cuối -->
              <td class="small text-muted">
                {{ formatDate(c.last_login_at) }}
                <div v-if="c.successful_logins_count" class="text-success small mt-0.5">
                  <i class="bi bi-check2"></i> {{ c.successful_logins_count }} lần thành công
                </div>
              </td>

              <!-- Ngày tạo -->
              <td class="small text-muted">
                {{ formatDate(c.created_at) }}
              </td>

              <!-- Thao tác -->
              <td class="text-end pe-4">
                <div class="dropdown">
                  <button
                    class="btn btn-sm btn-outline-secondary rounded-pill"
                    style="width: 30px; height: 30px; padding: 0;"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    title="Menu thao tác"
                  >
                    <i class="bi bi-three-dots-vertical"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end shadow-sm border hairline-border py-1.5" style="border-radius: var(--radius-md); min-width: 200px;">
                    <li>
                      <button class="dropdown-item small py-2" @click="openDetailsModal(c.id)">
                        <i class="bi bi-eye me-2 text-primary"></i> Xem chi tiết
                      </button>
                    </li>
                    <li v-if="!c.is_email_verified">
                      <button class="dropdown-item small py-2" @click="handleResendVerification(c)">
                        <i class="bi bi-envelope-check me-2 text-info"></i> Gửi lại email xác minh
                      </button>
                    </li>
                    <li v-if="c.id !== authStore.user?.id">
                      <button class="dropdown-item small py-2" @click="handleChangeRole(c)">
                        <i class="bi bi-person-badge me-2 text-warning"></i>
                        {{ c.role === 'admin' ? 'Hạ quyền xuống User' : 'Nâng quyền lên Admin' }}
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item small py-2" @click="handleRevokeSessions(c)">
                        <i class="bi bi-box-arrow-right me-2 text-secondary"></i> Đăng xuất mọi thiết bị
                      </button>
                    </li>
                    <li><hr class="dropdown-divider my-1 hairline-border" /></li>

                    <!-- Phân quyền bảo vệ: Tài khoản của chính Admin -->
                    <li v-if="c.id === authStore.user?.id">
                      <span class="dropdown-item small py-2 text-muted fst-italic">
                        <i class="bi bi-shield-check me-2 text-primary"></i> Tài khoản của bạn
                      </span>
                    </li>

                    <!-- Phân quyền bảo vệ: Tài khoản Admin khác -->
                    <li v-else-if="c.role === 'admin'">
                      <span class="dropdown-item small py-2 text-muted fst-italic">
                        <i class="bi bi-shield-lock me-2 text-warning"></i> Quản trị viên (Được bảo vệ)
                      </span>
                    </li>

                    <!-- Tài khoản thông thường (User): Cho phép Khóa mềm & Khóa cứng -->
                    <template v-else>
                      <!-- Xóa mềm (Khóa tài khoản / Mở khóa) -->
                      <li>
                        <button
                          class="dropdown-item small py-2"
                          :class="c.status === 'locked' ? 'text-success' : 'text-warning'"
                          @click="handleToggleLock(c)"
                        >
                          <i class="bi me-2" :class="c.status === 'locked' ? 'bi-unlock' : 'bi-lock'"></i>
                          {{ c.status === 'locked' ? 'Mở khóa tài khoản' : 'Khóa mềm (Tạm ngưng)' }}
                        </button>
                      </li>

                      <!-- Khóa cứng (Xóa luôn tài khoản) -->
                      <li>
                        <button
                          class="dropdown-item small py-2 text-danger"
                          @click="handleDeleteCustomer(c)"
                        >
                          <i class="bi bi-trash3 me-2 text-danger"></i>
                          Khóa cứng (Xóa luôn tài khoản)
                        </button>
                      </li>
                    </template>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang (Pagination) -->
      <div class="p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 hairline-border-top" style="background: var(--surface-soft);">
        <span class="small text-muted">
          Hiển thị trang <strong>{{ pagination.page }}</strong> trên tổng số <strong>{{ pagination.totalPages }}</strong> trang
          (tổng <strong>{{ pagination.total }}</strong> khách hàng)
        </span>
        <div class="btn-group btn-group-sm">
          <button
            class="btn btn-outline-secondary"
            :disabled="pagination.page <= 1 || isLoading"
            @click="loadCustomers(pagination.page - 1)"
          >
            <i class="bi bi-chevron-left me-1"></i> Trang trước
          </button>
          <button
            class="btn btn-outline-secondary"
            :disabled="pagination.page >= pagination.totalPages || isLoading"
            @click="loadCustomers(pagination.page + 1)"
          >
            Trang tiếp <i class="bi bi-chevron-right ms-1"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Chi tiết khách hàng (SaaS Detail Modal) -->
    <div
      v-if="showDetailModal"
      class="modal-backdrop fade show"
      style="z-index: 1050;"
      @click="showDetailModal = false"
    ></div>

    <div
      v-if="showDetailModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="z-index: 1055;"
      role="dialog"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content modal-content-clean">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold text-main d-flex align-items-center gap-2">
              <span class="badge-primary-pill"><i class="bi bi-person-lines-fill"></i></span>
              Chi tiết tài khoản khách hàng
            </h5>
            <button type="button" class="btn-close" @click="showDetailModal = false"></button>
          </div>

          <div class="modal-body p-4">
            <div v-if="isLoadingDetails" class="text-center py-5 text-muted">
              <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
              Đang tải chi tiết khách hàng...
            </div>

            <div v-else-if="selectedCustomer">
              <!-- Header info user -->
              <div class="d-flex align-items-center justify-content-between p-3.5 rounded-3 mb-4 panel-sub">
                <div class="d-flex align-items-center gap-3">
                  <div class="user-avatar-sm" style="width: 44px; height: 44px; font-size: 18px;">
                    {{ (selectedCustomer.user.full_name || selectedCustomer.user.username || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <h4 class="mb-0 fw-bold text-main" style="font-size: 16px;">
                      {{ selectedCustomer.user.full_name || selectedCustomer.user.username }}
                    </h4>
                    <span class="small text-muted">@{{ selectedCustomer.user.username }} • {{ selectedCustomer.user.email }}</span>
                  </div>
                </div>

                <div class="d-flex align-items-center gap-2">
                  <span
                    class="badge rounded-pill"
                    :class="selectedCustomer.user.role === 'admin' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary'"
                  >
                    {{ selectedCustomer.user.role === 'admin' ? 'ADMIN' : 'USER' }}
                  </span>
                  <span v-if="selectedCustomer.user.status === 'active'" class="badge-success-pill">
                    Hoạt động
                  </span>
                  <span v-else class="badge-danger-pill">
                    Bị khóa
                  </span>
                </div>
              </div>

              <!-- Thống kê tổng hợp -->
              <div class="row g-3 mb-4">
                <div class="col-sm-4">
                  <div class="p-3 rounded-3 border text-center" style="background: var(--surface-soft);">
                    <div class="small text-muted">Phiên đang hoạt động</div>
                    <div class="fs-4 fw-bold text-main mt-0.5">{{ selectedCustomer.sessions?.length || 0 }}</div>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="p-3 rounded-3 border text-center" style="background: var(--surface-soft);">
                    <div class="small text-muted">Lịch sử đăng nhập</div>
                    <div class="fs-4 fw-bold text-main mt-0.5">{{ selectedCustomer.recentLogins?.length || 0 }} lần</div>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="p-3 rounded-3 border text-center" style="background: var(--surface-soft);">
                    <div class="small text-muted">Ngày khởi tạo</div>
                    <div class="small fw-semibold text-main mt-2">{{ formatDate(selectedCustomer.user.created_at) }}</div>
                  </div>
                </div>
              </div>

              <!-- Danh sách các phiên đang hoạt động -->
              <div class="mb-4">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="fw-bold text-main mb-0" style="font-size: 14px;">Các phiên đăng nhập đang hoạt động</h6>
                  <button
                    v-if="selectedCustomer.sessions?.length > 0"
                    class="btn btn-outline-danger btn-sm rounded-pill"
                    style="font-size: 12px;"
                    @click="handleRevokeSessions(selectedCustomer.user)"
                  >
                    <i class="bi bi-box-arrow-right me-1"></i> Đăng xuất tất cả phiên
                  </button>
                </div>

                <div v-if="!selectedCustomer.sessions || selectedCustomer.sessions.length === 0" class="small text-muted p-3 text-center border rounded-2" style="background: var(--surface-soft);">
                  Hiện không có phiên đăng nhập nào đang hoạt động.
                </div>

                <div v-else class="list-group list-group-flush border rounded-2 overflow-hidden">
                  <div
                    v-for="s in selectedCustomer.sessions"
                    :key="s.id"
                    class="list-group-item d-flex justify-content-between align-items-center py-2.5"
                    style="background: transparent; color: var(--text-primary);"
                  >
                    <div>
                      <div class="small fw-semibold text-main">
                        <i class="bi bi-display me-1 text-primary"></i> {{ s.ip_address || 'Địa chỉ IP' }}
                      </div>
                      <div class="small text-muted text-truncate" style="max-width: 420px; font-size: 11.5px;">
                        {{ s.user_agent || 'Trình duyệt không xác định' }}
                      </div>
                    </div>
                    <div class="text-end small text-muted" style="font-size: 11.5px;">
                      Hoạt động: {{ formatDate(s.last_active_at) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 5 lần đăng nhập gần nhất -->
              <div>
                <h6 class="fw-bold text-main mb-2" style="font-size: 14px;">5 lần đăng nhập gần nhất</h6>
                <div v-if="!selectedCustomer.recentLogins || selectedCustomer.recentLogins.length === 0" class="small text-muted p-3 text-center border rounded-2" style="background: var(--surface-soft);">
                  Chưa có lịch sử đăng nhập nào được ghi nhận.
                </div>
                <div v-else class="table-responsive rounded-2 border overflow-hidden">
                  <table class="table table-sm align-middle mb-0 custom-admin-table" style="font-size: 12px;">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Phương thức</th>
                        <th>Trạng thái</th>
                        <th>IP & Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="log in selectedCustomer.recentLogins" :key="log.id">
                        <td>{{ formatDate(log.created_at) }}</td>
                        <td><span class="badge-neutral">{{ log.method }}</span></td>
                        <td>
                          <span v-if="log.status === 'success'" class="text-success fw-bold">Thành công</span>
                          <span v-else class="text-danger fw-bold">Thất bại</span>
                        </td>
                        <td class="text-muted">
                          {{ log.ip_address }} {{ log.failure_reason ? `(${log.failure_reason})` : '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer border-0 pt-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2" v-if="selectedCustomer && selectedCustomer.user">
              <!-- Nút Khóa mềm / Mở khóa -->
              <button
                v-if="selectedCustomer.user.id !== authStore.user?.id && selectedCustomer.user.role !== 'admin'"
                type="button"
                class="btn btn-sm rounded-pill"
                :class="selectedCustomer.user.status === 'locked' ? 'btn-outline-success' : 'btn-outline-warning'"
                :disabled="isActionLoading"
                @click="handleToggleLock(selectedCustomer.user)"
              >
                <i class="bi me-1" :class="selectedCustomer.user.status === 'locked' ? 'bi-unlock' : 'bi-lock'"></i>
                {{ selectedCustomer.user.status === 'locked' ? 'Mở khóa' : 'Khóa mềm (Tạm ngưng)' }}
              </button>

              <!-- Nút Khóa cứng (Xóa luôn tài khoản) -->
              <button
                v-if="selectedCustomer.user.id !== authStore.user?.id && selectedCustomer.user.role !== 'admin'"
                type="button"
                class="btn btn-outline-danger btn-sm rounded-pill"
                :disabled="isActionLoading"
                @click="handleDeleteCustomer(selectedCustomer.user)"
              >
                <i class="bi bi-trash3 me-1"></i> Khóa cứng (Xóa luôn tài khoản)
              </button>

              <span v-else-if="selectedCustomer.user.id === authStore.user?.id" class="text-muted small fst-italic">
                <i class="bi bi-shield-check text-primary me-1"></i> Tài khoản của bạn (Không thể tự khóa/xóa)
              </span>

              <span v-else-if="selectedCustomer.user.role === 'admin'" class="text-muted small fst-italic">
                <i class="bi bi-shield-lock text-warning me-1"></i> Tài khoản Quản trị viên được bảo vệ
              </span>
            </div>

            <button type="button" class="btn btn-secondary btn-sm rounded-pill px-4 ms-auto" @click="showDetailModal = false">
              Đóng
            </button>
          </div>
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
