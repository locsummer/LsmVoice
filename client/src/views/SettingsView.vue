<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/authStore.js';
import { useThemeStore } from '../stores/themeStore.js';
import { useTtsStore } from '../stores/ttsStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import {
  authRequestEmailVerification,
  authVerifyEmailVerification,
  authRequestPasswordChangeOtp,
  authVerifyPasswordChangeOtp,
  authConfirmPasswordChange,
} from '../services/api.js';

const emit = defineEmits(['notify', 'open-auth']);

const authStore = useAuthStore();
const themeStore = useThemeStore();
const ttsStore = useTtsStore();
const notification = useNotificationStore();

// Thông tin hồ sơ
const fullName = ref(authStore.user?.fullName || '');
const showFullEmail = ref(false);
const isUpdatingProfile = ref(false);

// Xác minh email qua OTP
const isSendingEmailVerifyOtp = ref(false);
const showEmailVerifyInput = ref(false);
const emailVerifyOtp = ref('');
const isVerifyingEmail = ref(false);

// Đổi mật khẩu qua OTP
const passwordStep = ref('idle'); // 'idle' | 'otp_sent' | 'submitting'
const isSendingPasswordOtp = ref(false);
const passwordOtp = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
};

const displayEmail = computed(() => {
  if (!authStore.user?.email) return '';
  return showFullEmail.value ? authStore.user.email : maskEmail(authStore.user.email);
});

// Cập nhật họ tên
const handleUpdateUser = async () => {
  if (!fullName.value.trim()) {
    notification.warning('Vui lòng nhập họ và tên của bạn.');
    return;
  }
  isUpdatingProfile.value = true;
  try {
    await authStore.updateProfile({
      fullName: fullName.value.trim(),
    });
    notification.success('Cập nhật thông tin tài khoản thành công.');
  } catch (err) {
    notification.error(err.message || 'Không thể cập nhật hồ sơ.');
  } finally {
    isUpdatingProfile.value = false;
  }
};

// Gửi yêu cầu mã OTP xác minh email
const handleRequestEmailVerification = async () => {
  isSendingEmailVerifyOtp.value = true;
  try {
    const res = await authRequestEmailVerification();
    notification.success(res.data?.message || 'Mã OTP xác minh email đã được gửi vào hòm thư của bạn.');
    showEmailVerifyInput.value = true;
  } catch (err) {
    notification.error(err.message || 'Không thể gửi mã xác minh email.');
  } finally {
    isSendingEmailVerifyOtp.value = false;
  }
};

// Xác nhận mã OTP xác minh email
const handleConfirmEmailVerification = async () => {
  if (!emailVerifyOtp.value || emailVerifyOtp.value.trim().length !== 6) {
    notification.warning('Vui lòng nhập đủ 6 chữ số mã OTP xác minh.');
    return;
  }
  isVerifyingEmail.value = true;
  try {
    const res = await authVerifyEmailVerification({ otp: emailVerifyOtp.value.trim() });
    notification.success(res.data?.message || 'Xác minh email thành công!');
    showEmailVerifyInput.value = false;
    emailVerifyOtp.value = '';
    await authStore.checkProfile();
  } catch (err) {
    notification.error(err.message || 'Mã OTP xác minh không hợp lệ hoặc đã hết hạn.');
  } finally {
    isVerifyingEmail.value = false;
  }
};

// BƯỚC 1: Gửi mã OTP đổi mật khẩu
const handleRequestPasswordOtp = async () => {
  isSendingPasswordOtp.value = true;
  try {
    const res = await authRequestPasswordChangeOtp();
    notification.success(res.data?.message || 'Mã OTP đổi mật khẩu đã được gửi đến email của bạn.');
    passwordStep.value = 'otp_sent';
  } catch (err) {
    notification.error(err.message || 'Không thể gửi mã OTP đổi mật khẩu.');
  } finally {
    isSendingPasswordOtp.value = false;
  }
};

// BƯỚC 2 & 3: Xác minh OTP & Cập nhật mật khẩu mới
const handleConfirmPasswordChange = async () => {
  if (!passwordOtp.value || passwordOtp.value.trim().length !== 6) {
    notification.warning('Vui lòng nhập chính xác mã OTP 6 số nhận được từ email.');
    return;
  }
  if (!newPassword.value || newPassword.value.length < 6) {
    notification.warning('Mật khẩu mới phải có tối thiểu 6 ký tự.');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    notification.warning('Mật khẩu mới và xác nhận mật khẩu không trùng khớp.');
    return;
  }

  passwordStep.value = 'submitting';
  try {
    // 1. Xác minh OTP lấy challenge token
    const verifyRes = await authVerifyPasswordChangeOtp({ otp: passwordOtp.value.trim() });
    const challengeToken = verifyRes.data?.challengeToken || verifyRes.data?.data?.challengeToken || verifyRes.challengeToken;
    if (!challengeToken) {
      throw new Error('Không nhận được mã xác thực đổi mật khẩu.');
    }

    // 2. Xác nhận đổi mật khẩu với challenge token
    const confirmRes = await authConfirmPasswordChange({
      challengeToken,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value,
    });

    if (confirmRes.data?.token) {
      localStorage.setItem('lsm_token', confirmRes.data.token);
      if (authStore.token) authStore.token = confirmRes.data.token;
    }

    notification.success(confirmRes.message || confirmRes.data?.message || 'Đổi mật khẩu thành công! Email cảnh báo đã được gửi.');
    // Reset form
    passwordStep.value = 'idle';
    passwordOtp.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (err) {
    notification.error(err.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mã OTP.');
    passwordStep.value = 'otp_sent';
  }
};

// Đăng xuất khỏi tất cả các thiết bị
const handleLogoutAll = async () => {
  const confirmed = await notification.askConfirm({
    title: 'Đăng xuất khỏi tất cả thiết bị?',
    message: 'Toàn bộ phiên đăng nhập đang hoạt động trên các máy tính và điện thoại khác sẽ bị vô hiệu hóa ngay lập tức.',
    confirmText: 'Đăng xuất tất cả',
    cancelText: 'Hủy thao tác',
    type: 'danger',
  });

  if (confirmed) {
    try {
      await authStore.logoutAll();
      notification.info('Đã đăng xuất khỏi tất cả các thiết bị thành công.');
    } catch (err) {
      notification.error(err.message || 'Lỗi khi đăng xuất khỏi các thiết bị.');
    }
  }
};

const handleClearCache = async () => {
  const confirmed = await notification.askConfirm({
    title: 'Xóa dữ liệu bộ nhớ tạm?',
    message: 'Bạn có chắc chắn muốn xóa toàn bộ bản nháp và lịch sử khách tạm thời trên trình duyệt này?',
    confirmText: 'Xóa dữ liệu',
    cancelText: 'Hủy',
    type: 'danger',
  });
  if (confirmed) {
    localStorage.removeItem('lsm_draft');
    localStorage.removeItem('lsm_guest_history');
    notification.info('Đã xóa dữ liệu tạm trên trình duyệt thành công.');
  }
};
</script>

<template>
  <div class="container-fluid px-3 px-lg-4 py-4" style="max-width: 960px;">
    <!-- Tiêu đề trang -->
    <div class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 class="page-title mb-1">Cài đặt & Tài khoản</h1>
          <p class="section-desc mb-0">
            Quản lý thông tin hồ sơ, bảo mật tài khoản 2 lớp, tùy chỉnh giọng đọc và hệ thống.
          </p>
        </div>
        <div v-if="authStore.isAdmin">
          <router-link to="/admin/dashboard" class="btn-primary-action text-decoration-none">
            <i class="bi bi-speedometer2 me-1"></i> Bảng điều khiển Quản trị
          </router-link>
        </div>
      </div>
    </div>

    <!-- Mục 1: Thông tin tài khoản -->
    <div class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div class="d-flex align-items-center gap-2">
          <span class="badge-primary-pill"><i class="bi bi-person"></i></span>
          <h2 class="section-title mb-0">Hồ sơ người dùng</h2>
        </div>
        <div v-if="authStore.isAuthenticated" class="d-flex align-items-center gap-2">
          <span class="badge rounded-pill" :class="authStore.user?.role === 'admin' ? 'bg-primary' : 'bg-secondary'">
            {{ authStore.user?.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'THÀNH VIÊN' }}
          </span>
        </div>
      </div>

      <div v-if="authStore.isAuthenticated">
        <div class="row g-3">
          <!-- Tên đăng nhập (Username) -->
          <div class="col-md-6">
            <label class="form-label control-label mb-1">Tên đăng nhập (Username)</label>
            <div class="input-group">
              <span class="input-group-text bg-transparent border-end-0 text-muted">@</span>
              <input
                :value="authStore.user?.username || 'user'"
                type="text"
                class="form-control border-start-0 bg-transparent text-main"
                disabled
              />
            </div>
            <div class="small text-muted mt-1">Tên đăng nhập cố định định danh tài khoản của bạn.</div>
          </div>

          <!-- Email & Trạng thái xác minh -->
          <div class="col-md-6">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <label class="form-label control-label mb-0">Email đăng ký</label>
              <button
                type="button"
                class="btn btn-link btn-sm text-decoration-none p-0 text-muted small"
                @click="showFullEmail = !showFullEmail"
              >
                <i class="bi" :class="showFullEmail ? 'bi-eye-slash' : 'bi-eye'"></i>
                {{ showFullEmail ? 'Ẩn bớt' : 'Hiện đầy đủ' }}
              </button>
            </div>
            <div class="input-group">
              <input :value="displayEmail" type="text" class="form-control bg-transparent text-main" disabled />
              <span class="input-group-text bg-transparent">
                <span v-if="authStore.user?.isEmailVerified" class="text-success small fw-semibold">
                  <i class="bi bi-check-circle-fill me-1"></i> Đã xác minh
                </span>
                <span v-else class="text-warning small fw-semibold">
                  <i class="bi bi-exclamation-circle-fill me-1"></i> Chưa xác minh
                </span>
              </span>
            </div>

            <!-- Nút gửi mã xác minh nếu chưa verify -->
            <div v-if="!authStore.user?.isEmailVerified" class="mt-2">
              <div v-if="!showEmailVerifyInput" class="d-flex align-items-center gap-2">
                <button
                  class="btn btn-outline-primary btn-sm rounded-pill"
                  :disabled="isSendingEmailVerifyOtp"
                  @click="handleRequestEmailVerification"
                >
                  <i class="bi bi-envelope-check me-1"></i>
                  {{ isSendingEmailVerifyOtp ? 'Đang gửi mã...' : 'Xác minh email ngay' }}
                </button>
                <span class="small text-muted">Bảo vệ tài khoản và nhận thông báo khôi phục</span>
              </div>

              <!-- Form nhập OTP xác minh email -->
              <div v-else class="p-3 mt-2 rounded-3" style="background: var(--surface-soft); border: 1px dashed var(--accent-blue);">
                <div class="small fw-semibold text-main mb-2">Nhập mã OTP 6 số đã gửi tới hòm thư của bạn:</div>
                <div class="d-flex align-items-center gap-2">
                  <input
                    v-model="emailVerifyOtp"
                    type="text"
                    maxlength="6"
                    placeholder="••••••"
                    class="form-control form-control-sm text-center fw-bold letter-spacing-2"
                    style="max-width: 140px; font-size: 16px;"
                  />
                  <button
                    class="btn btn-primary btn-sm rounded-pill px-3"
                    :disabled="isVerifyingEmail || emailVerifyOtp.length !== 6"
                    @click="handleConfirmEmailVerification"
                  >
                    {{ isVerifyingEmail ? 'Đang kiểm tra...' : 'Xác nhận' }}
                  </button>
                  <button
                    class="btn btn-link btn-sm text-muted text-decoration-none"
                    @click="showEmailVerifyInput = false"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Họ và tên -->
          <div class="col-md-6">
            <label class="form-label control-label mb-1">Họ và tên hiển thị</label>
            <input v-model="fullName" type="text" class="form-control" placeholder="Nguyễn Văn A" />
          </div>

          <div class="col-md-6 d-flex align-items-end">
            <button
              class="btn-primary-action w-100"
              :disabled="isUpdatingProfile"
              @click="handleUpdateUser"
            >
              <i class="bi bi-save me-1"></i>
              {{ isUpdatingProfile ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ' }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="p-4 rounded-3 text-center" style="background: var(--surface-soft); border: 1px solid var(--border);">
        <p class="text-secondary small mb-3">
          Bạn đang sử dụng hệ thống ở chế độ Khách. Đăng nhập để đồng bộ thư viện và lịch sử nghe trên đám mây.
        </p>
        <button class="btn-primary-action mx-auto" @click="emit('open-auth')">
          Đăng nhập hoặc Đăng ký
        </button>
      </div>
    </div>

    <!-- Mục 2: Đổi mật khẩu an toàn qua OTP -->
    <div v-if="authStore.isAuthenticated" class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="badge-violet-pill"><i class="bi bi-shield-lock"></i></span>
        <h2 class="section-title mb-0">Bảo mật & Đổi mật khẩu qua OTP</h2>
      </div>

      <p class="small text-muted mb-4">
        Để bảo vệ an toàn cho tài khoản, việc thay đổi mật khẩu yêu cầu xác thực bằng mã OTP 6 số được gửi trực tiếp đến địa chỉ email đã đăng ký.
      </p>

      <div v-if="passwordStep === 'idle'" class="p-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-3" style="background: var(--surface-soft); border: 1px solid var(--border);">
        <div>
          <div class="fw-semibold text-main small">Đổi mật khẩu tài khoản</div>
          <div class="text-muted small">Hệ thống sẽ gửi mã OTP bảo mật có hiệu lực trong 5 phút đến email của bạn.</div>
        </div>
        <button
          class="btn btn-outline-primary rounded-pill px-4"
          :disabled="isSendingPasswordOtp"
          @click="handleRequestPasswordOtp"
        >
          <i class="bi bi-key me-1"></i>
          {{ isSendingPasswordOtp ? 'Đang gửi mã OTP...' : 'Yêu cầu mã OTP đổi mật khẩu' }}
        </button>
      </div>

      <!-- Biểu mẫu nhập OTP & mật khẩu mới -->
      <div v-else class="p-4 rounded-3" style="background: var(--surface-soft); border: 1px solid var(--border);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="small fw-bold text-primary">
            <i class="bi bi-envelope-open me-1"></i> Mã OTP đã được gửi đến {{ displayEmail }}
          </span>
          <button
            class="btn btn-link btn-sm text-muted p-0 text-decoration-none small"
            @click="passwordStep = 'idle'"
          >
            Hủy thao tác
          </button>
        </div>

        <div class="alert alert-info py-2 px-3 small mb-3 border-0 rounded-3" style="background: rgba(99, 102, 241, 0.08); color: #4338ca;">
          <i class="bi bi-info-circle me-1"></i> <strong>Mẹo:</strong> Nếu không thấy mã OTP trong Hộp thư đến, vui lòng kiểm tra thư mục <strong>Thư rác (Spam)</strong> hoặc mục <strong>Quảng cáo / Cập nhật</strong> trong Gmail của bạn.
        </div>

        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label control-label mb-1">Mã OTP (6 chữ số) *</label>
            <input
              v-model="passwordOtp"
              type="text"
              maxlength="6"
              name="set_sec_otp"
              id="set_sec_otp"
              autocomplete="off"
              inputmode="numeric"
              placeholder="••••••"
              class="form-control text-center fw-bold letter-spacing-2"
              style="font-size: 18px;"
            />
          </div>

          <div class="col-md-4">
            <label class="form-label control-label mb-1">Mật khẩu mới *</label>
            <div class="input-group">
              <input
                v-model="newPassword"
                type="text"
                class="form-control font-monospace"
                :style="!showNewPassword ? '-webkit-text-security: disc; text-security: disc;' : ''"
                name="set_sec_npwd"
                id="set_sec_npwd"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="Tối thiểu 6 ký tự"
              />
              <button
                type="button"
                class="input-group-text bg-transparent border-start-0 text-muted"
                @click="showNewPassword = !showNewPassword"
              >
                <i class="bi" :class="showNewPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
              </button>
            </div>
          </div>

          <div class="col-md-4">
            <label class="form-label control-label mb-1">Xác nhận mật khẩu mới *</label>
            <div class="input-group">
              <input
                v-model="confirmPassword"
                type="text"
                class="form-control font-monospace border-end-0"
                :style="!showConfirmPassword ? '-webkit-text-security: disc; text-security: disc;' : ''"
                name="set_sec_cpwd"
                id="set_sec_cpwd"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="Nhập lại mật khẩu"
              />
              <button
                type="button"
                class="input-group-text bg-transparent border-start-0 text-muted"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <i class="bi" :class="showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
              </button>
            </div>
          </div>

          <div class="col-12 d-flex justify-content-between align-items-center mt-3 pt-2 hairline-border-top">
            <button
              class="btn btn-link btn-sm text-secondary text-decoration-none p-0"
              :disabled="isSendingPasswordOtp"
              @click="handleRequestPasswordOtp"
            >
              <i class="bi bi-arrow-repeat me-1"></i> Gửi lại mã OTP
            </button>

            <button
              class="btn-primary-action"
              :disabled="passwordStep === 'submitting' || !passwordOtp || !newPassword || !confirmPassword"
              @click="handleConfirmPasswordChange"
            >
              <i class="bi bi-check2-circle me-1"></i>
              {{ passwordStep === 'submitting' ? 'Đang xác minh & cập nhật...' : 'Xác nhận cập nhật mật khẩu' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mục 3: Quản lý phiên đăng nhập & Thiết bị -->
    <div v-if="authStore.isAuthenticated" class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="badge-primary-pill"><i class="bi bi-devices"></i></span>
        <h2 class="section-title mb-0">Quản lý phiên đăng nhập</h2>
      </div>

      <div class="d-flex justify-content-between align-items-center py-2 flex-wrap gap-3">
        <div>
          <div class="fw-semibold text-main small">Đăng xuất khỏi tất cả các thiết bị</div>
          <div class="small text-muted">
            Thu hồi toàn bộ token đăng nhập trên tất cả các trình duyệt và thiết bị khác nếu bạn nghi ngờ có phiên truy cập bất thường.
          </div>
        </div>
        <button
          class="btn btn-outline-danger btn-sm rounded-pill px-3 py-2 fw-semibold"
          @click="handleLogoutAll"
        >
          <i class="bi bi-box-arrow-left me-1"></i> Đăng xuất tất cả thiết bị
        </button>
      </div>
    </div>

    <!-- Mục 4: Cài đặt giao diện & phát -->
    <div class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="badge-violet-pill"><i class="bi bi-palette"></i></span>
        <h2 class="section-title mb-0">Giao diện & Trải nghiệm</h2>
      </div>

      <div class="d-flex justify-content-between align-items-center py-3 hairline-border-bottom">
        <div>
          <div class="fw-semibold text-main">Chế độ tối (Dark Mode)</div>
          <div class="small text-muted">Tối ưu cho mắt khi làm việc và đọc truyện ban đêm</div>
        </div>
        <div class="form-check form-switch m-0">
          <input
            class="form-check-input fs-5"
            type="checkbox"
            role="switch"
            :checked="themeStore.currentTheme === 'dark'"
            @change="themeStore.toggleTheme"
          />
        </div>
      </div>

      <div class="d-flex justify-content-between align-items-center py-3 hairline-border-bottom">
        <div>
          <div class="fw-semibold text-main">Giọng đọc mặc định</div>
          <div class="small text-muted">Giọng được tự động chọn khi khởi động phòng thu</div>
        </div>
        <select v-model="ttsStore.selectedVoiceId" class="form-select form-select-sm" style="max-width: 220px;">
          <option v-for="v in ttsStore.voices" :key="v.id" :value="v.id">
            {{ v.name }} ({{ v.gender === 'female' ? 'Nữ' : 'Nam' }})
          </option>
        </select>
      </div>

      <div class="d-flex justify-content-between align-items-center py-3">
        <div>
          <div class="fw-semibold text-danger">Xóa bộ nhớ đệm (Cache)</div>
          <div class="small text-muted">Xóa toàn bộ bản nháp và dữ liệu tạm thời trên trình duyệt này</div>
        </div>
        <button class="btn-secondary-action text-danger" style="height: 38px; padding: 0 16px;" @click="handleClearCache">
          Xóa bộ nhớ đệm
        </button>
      </div>
    </div>

    <!-- Mục 5: Thông tin phần mềm -->
    <div class="panel-white p-4">
      <h2 class="section-title mb-2" style="font-size: 16px;">Thông tin phần mềm</h2>
      <p class="small text-secondary mb-1">
        LsmVoice v1.0.0 Pro • Nền tảng tổng hợp giọng nói tiếng Việt cao cấp & Quản trị tài khoản đa tầng.
      </p>
      <p class="small text-muted mb-0">
        Kiến trúc: Vue 3 Composition API, Node.js, Express, SQLite, Microsoft Edge Neural TTS, Azure Speech, FPT.AI và Viettel AI.
      </p>
    </div>
  </div>
</template>

<style scoped>
.letter-spacing-2 {
  letter-spacing: 0.25rem;
}
</style>
