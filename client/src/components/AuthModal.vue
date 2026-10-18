<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import {
  authRequestPasswordResetOtp,
  authVerifyPasswordResetOtp,
  authConfirmPasswordReset,
} from '../services/api.js';

const emit = defineEmits(['close', 'authenticated']);

const router = useRouter();
const authStore = useAuthStore();
const notification = useNotificationStore();

// 'login' | 'register' | 'forgot'
const activeTab = ref('login');

// Sub-mode đăng nhập: 'password' (mặc định) | 'otp'
const loginMode = ref('password');
const loginStep = ref(1); // 1: nhập username + email, 2: nhập OTP

// OTP Timer
const otpCountdown = ref(300); // 5 phút = 300s
let countdownTimer = null;

// Form Đăng nhập
const loginUsername = ref('');
const loginEmail = ref('');
const loginOtp = ref('');
const loginPassword = ref('');
const showLoginPassword = ref(false);
const rememberMe = ref(false);
const loginErrors = reactive({
  username: '',
  email: '',
  otp: '',
  password: '',
  general: '',
});

// Form Đăng ký
const regUsername = ref('');
const regEmail = ref('');
const regFullName = ref('');
const agreeTerms = ref(false);
const regErrors = reactive({
  username: '',
  email: '',
  terms: '',
  general: '',
});
const regSuccessMessage = ref('');
const registeredInitialPassword = ref('');
const copyPasswordSuccess = ref(false);

const copyPassword = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyPasswordSuccess.value = true;
    notification.success('Đã sao chép mật khẩu vào bộ nhớ tạm!');
    setTimeout(() => {
      copyPasswordSuccess.value = false;
    }, 2000);
  } catch (_) {
    notification.info(`Mật khẩu: ${text}`);
  }
};

// Form Quên mật khẩu
const forgotStep = ref(1); // 1: nhập email, 2: nhập OTP & mật khẩu mới
const forgotEmail = ref('');
const forgotOtp = ref('');
const forgotResetToken = ref('');
const forgotNewPassword = ref('');
const forgotConfirmPassword = ref('');
const showForgotNewPassword = ref(false);
const forgotErrors = reactive({
  email: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
  general: '',
});

const isSubmitting = ref(false);
const resendCooldown = ref(0);
let resendTimer = null;

const startResendCooldown = (seconds = 30) => {
  clearInterval(resendTimer);
  resendCooldown.value = seconds;
  resendTimer = setInterval(() => {
    if (resendCooldown.value > 0) {
      resendCooldown.value--;
    } else {
      clearInterval(resendTimer);
    }
  }, 1000);
};

const startOtpTimer = () => {
  clearInterval(countdownTimer);
  otpCountdown.value = 300;
  countdownTimer = setInterval(() => {
    if (otpCountdown.value > 0) {
      otpCountdown.value--;
    } else {
      clearInterval(countdownTimer);
    }
  }, 1000);
  startResendCooldown(30); // Giới hạn đúng 30 giây gửi lại mã theo yêu cầu người dùng
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

onUnmounted(() => {
  clearInterval(countdownTimer);
  clearInterval(resendTimer);
});

const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Chống tắt nhầm modal khi người dùng kéo chuột bôi đen văn bản tràn ra ngoài
let isMouseDownOnBackdrop = false;

const handleBackdropMouseDown = (e) => {
  isMouseDownOnBackdrop = e.target === e.currentTarget;
};

const handleBackdropMouseUp = (e) => {
  // Chỉ đóng khi cả mousedown và mouseup đều diễn ra trực tiếp trên nền backdrop ngoài modal
  if (isMouseDownOnBackdrop && e.target === e.currentTarget) {
    emit('close');
  }
  isMouseDownOnBackdrop = false;
};

// Đảm bảo khi mở modal mọi ô nhập liệu đều hoàn toàn trống, không tự ý điền
const clearAllFormFields = () => {
  loginUsername.value = '';
  loginPassword.value = '';
  loginEmail.value = '';
  loginOtp.value = '';
  regUsername.value = '';
  regEmail.value = '';
  regFullName.value = '';
  agreeTerms.value = false;
  rememberMe.value = false;
  forgotEmail.value = '';
  forgotOtp.value = '';
  forgotNewPassword.value = '';
  forgotConfirmPassword.value = '';
};

onMounted(() => {
  clearAllFormFields();
  // Xóa bất kỳ dữ liệu autofill nào do trình duyệt tự ý điền sau khi DOM mount
  setTimeout(clearAllFormFields, 50);
  setTimeout(clearAllFormFields, 150);
  setTimeout(clearAllFormFields, 300);
});

// Xóa sạch thông báo lỗi và dữ liệu tạm khi người dùng chuyển đổi qua lại giữa các tab
watch(activeTab, () => {
  clearAllFormFields();
  loginErrors.username = '';
  loginErrors.password = '';
  loginErrors.email = '';
  loginErrors.otp = '';
  loginErrors.general = '';
  regErrors.username = '';
  regErrors.email = '';
  regErrors.terms = '';
  regErrors.general = '';
  forgotErrors.email = '';
  forgotErrors.otp = '';
  forgotErrors.newPassword = '';
  forgotErrors.confirmPassword = '';
  forgotErrors.general = '';
});

// -------------------------------------------------------------
// XỬ LÝ ĐĂNG KÝ
// -------------------------------------------------------------
const handleRegister = async () => {
  regErrors.username = '';
  regErrors.email = '';
  regErrors.terms = '';
  regErrors.general = '';
  regSuccessMessage.value = '';

  let hasError = false;

  const cleanUser = regUsername.value.trim().toLowerCase();
  if (!cleanUser) {
    regErrors.username = 'Vui lòng nhập tên đăng nhập.';
    hasError = true;
  } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
    regErrors.username = 'Tên đăng nhập từ 3 đến 30 ký tự, chỉ gồm chữ, số và gạch dưới.';
    hasError = true;
  }

  const cleanEmail = regEmail.value.trim().toLowerCase();
  if (!cleanEmail) {
    regErrors.email = 'Vui lòng nhập địa chỉ email.';
    hasError = true;
  } else if (!validateEmail(cleanEmail)) {
    regErrors.email = 'Địa chỉ email không đúng định dạng (ví dụ: name@gmail.com).';
    hasError = true;
  }

  if (!agreeTerms.value) {
    regErrors.terms = 'Bạn cần đồng ý với điều khoản dịch vụ để tiếp tục.';
    hasError = true;
  }

  if (hasError) return;

  isSubmitting.value = true;
  try {
    const res = await authStore.register({
      username: cleanUser,
      email: cleanEmail,
      fullName: regFullName.value.trim() || cleanUser,
    });

    regSuccessMessage.value = res.message || 'Đăng ký thành công! Mật khẩu ban đầu đã được gửi qua email.';
    registeredInitialPassword.value = '';
    // Giữ trống hoàn toàn các trường, không tự ý điền thông tin
    loginUsername.value = '';
    loginPassword.value = '';
    loginMode.value = 'password';
    notification.success('Đăng ký tài khoản thành công! Mật khẩu đã được gửi về email của bạn.');
  } catch (err) {
    regErrors.general = err.message || 'Không thể đăng ký tài khoản. Vui lòng thử lại.';
  } finally {
    isSubmitting.value = false;
  }
};

// -------------------------------------------------------------
// XỬ LÝ ĐĂNG NHẬP (OTP & MẬT KHẨU)
// -------------------------------------------------------------
const handleRequestLoginOtp = async () => {
  loginErrors.username = '';
  loginErrors.email = '';
  loginErrors.general = '';

  let hasError = false;
  if (!loginUsername.value.trim()) {
    loginErrors.username = 'Vui lòng nhập tên đăng nhập.';
    hasError = true;
  }
  if (!loginEmail.value.trim()) {
    loginErrors.email = 'Vui lòng nhập email đã đăng ký.';
    hasError = true;
  } else if (!validateEmail(loginEmail.value.trim())) {
    loginErrors.email = 'Email không hợp lệ.';
    hasError = true;
  }

  if (hasError) return;

  isSubmitting.value = true;
  try {
    const res = await authStore.requestLoginOtp({
      username: loginUsername.value.trim(),
      email: loginEmail.value.trim(),
    });
    loginStep.value = 2;
    startOtpTimer();
    notification.info(res.message || 'Mã OTP đã được gửi đến email của bạn.');
  } catch (err) {
    loginErrors.general = err.message || 'Không thể gửi mã xác thực. Vui lòng kiểm tra lại thông tin.';
  } finally {
    isSubmitting.value = false;
  }
};

const handleVerifyLoginOtp = async () => {
  loginErrors.otp = '';
  loginErrors.general = '';

  if (!loginOtp.value.trim()) {
    loginErrors.otp = 'Vui lòng nhập mã OTP 6 chữ số.';
    return;
  }

  isSubmitting.value = true;
  try {
    const data = await authStore.verifyLoginOtp({
      username: loginUsername.value.trim(),
      email: loginEmail.value.trim(),
      otp: loginOtp.value.trim(),
      rememberMe: rememberMe.value,
    });

    notification.success(`Chào mừng trở lại, ${data.user.fullName || data.user.username}!`);
    emit('authenticated', data.user);
    emit('close');

    if (data.user.role === 'admin' || data.redirectTo === '/admin/dashboard') {
      router.push('/admin/dashboard');
    }
  } catch (err) {
    loginErrors.otp = err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.';
  } finally {
    isSubmitting.value = false;
  }
};

const handleLoginPassword = async () => {
  loginErrors.username = '';
  loginErrors.password = '';
  loginErrors.general = '';

  let hasError = false;
  if (!loginUsername.value.trim()) {
    loginErrors.username = 'Vui lòng nhập tên đăng nhập hoặc email.';
    hasError = true;
  }
  if (!loginPassword.value) {
    loginErrors.password = 'Vui lòng nhập mật khẩu.';
    hasError = true;
  }

  if (hasError) return;

  isSubmitting.value = true;
  try {
    const data = await authStore.loginWithPassword({
      identifier: loginUsername.value.trim(),
      password: loginPassword.value,
      rememberMe: rememberMe.value,
    });

    notification.success(`Đăng nhập thành công! Chào ${data.user.fullName || data.user.username}`);
    emit('authenticated', data.user);
    emit('close');

    if (data.user.role === 'admin') {
      router.push('/admin/dashboard');
    }
  } catch (err) {
    loginErrors.general = err.message || 'Thông tin đăng nhập không chính xác.';
  } finally {
    isSubmitting.value = false;
  }
};

// -------------------------------------------------------------
// XỬ LÝ QUÊN MẬT KHẨU
// -------------------------------------------------------------
const handleRequestResetOtp = async () => {
  forgotErrors.email = '';
  forgotErrors.general = '';

  if (!forgotEmail.value.trim() || !validateEmail(forgotEmail.value.trim())) {
    forgotErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await authRequestPasswordResetOtp({ email: forgotEmail.value.trim() });
    forgotStep.value = 2;
    forgotOtp.value = '';
    forgotNewPassword.value = '';
    forgotConfirmPassword.value = '';
    startOtpTimer();
    notification.info(res.message || 'Mã xác thực khôi phục mật khẩu đã được gửi đến email.');
  } catch (err) {
    forgotErrors.general = err.message;
  } finally {
    isSubmitting.value = false;
  }
};

const handleConfirmReset = async () => {
  forgotErrors.otp = '';
  forgotErrors.newPassword = '';
  forgotErrors.confirmPassword = '';
  forgotErrors.general = '';

  let hasError = false;
  if (!forgotOtp.value.trim()) {
    forgotErrors.otp = 'Vui lòng nhập mã OTP.';
    hasError = true;
  }
  if (!forgotNewPassword.value || forgotNewPassword.value.length < 6) {
    forgotErrors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
    hasError = true;
  }
  if (forgotNewPassword.value !== forgotConfirmPassword.value) {
    forgotErrors.confirmPassword = 'Xác nhận mật khẩu không khớp.';
    hasError = true;
  }

  if (hasError) return;

  isSubmitting.value = true;
  try {
    // Bước verify OTP
    const verifyRes = await authVerifyPasswordResetOtp({
      email: forgotEmail.value.trim(),
      otp: forgotOtp.value.trim(),
    });

    forgotResetToken.value = verifyRes.data?.resetToken || verifyRes.data?.data?.resetToken || verifyRes.resetToken;

    // Bước confirm password reset
    const confirmRes = await authConfirmPasswordReset({
      email: forgotEmail.value.trim(),
      resetToken: forgotResetToken.value,
      newPassword: forgotNewPassword.value,
      confirmPassword: forgotConfirmPassword.value,
    });

    notification.success(confirmRes.message || 'Đặt lại mật khẩu thành công!');
    activeTab.value = 'login';
    loginMode.value = 'password';
    loginUsername.value = '';
    loginPassword.value = '';
    forgotStep.value = 1;
    forgotOtp.value = '';
    forgotNewPassword.value = '';
    forgotConfirmPassword.value = '';
  } catch (err) {
    forgotErrors.general = err.message || 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại OTP.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(32, 34, 56, 0.45); backdrop-filter: blur(4px); z-index: 1070;"
    @mousedown="handleBackdropMouseDown"
    @mouseup="handleBackdropMouseUp"
  >
    <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
      <div class="modal-content modal-content-clean p-2">
        <!-- Header Modal & Tabs -->
        <div class="modal-header hairline-border-bottom px-4 pt-3 pb-2 d-flex flex-column align-items-stretch">
          <div class="d-flex align-items-center justify-content-between w-100 mb-3">
            <div class="d-flex align-items-center gap-2">
              <div class="logo-box" style="width: 32px; height: 32px; border-radius: 8px;">
                <i class="bi bi-shield-lock text-white" style="font-size: 14px;"></i>
              </div>
              <span class="fw-bold text-main" style="font-size: 16px;">Tài khoản LsmVoice</span>
            </div>
            <button type="button" class="btn-close" @click="emit('close')"></button>
          </div>

          <!-- Tab Bar Pill -->
          <div class="d-flex p-1 bg-surface-soft rounded-3 w-100">
            <button
              type="button"
              class="tab-pill-btn flex-grow-1"
              :class="{ active: activeTab === 'login' }"
              @click="activeTab = 'login'"
            >
              Đăng nhập
            </button>
            <button
              type="button"
              class="tab-pill-btn flex-grow-1"
              :class="{ active: activeTab === 'register' }"
              @click="activeTab = 'register'"
            >
              Đăng ký
            </button>
          </div>
        </div>

        <div class="modal-body p-4">
          <!-- ======================================================== -->
          <!-- TAB 1: ĐĂNG NHẬP (MẬT KHẨU / OTP) -->
          <!-- ======================================================== -->
          <div v-if="activeTab === 'login'">
            <!-- Alert lỗi tổng quát nếu có -->
            <div v-if="loginErrors.general" class="alert-box-danger mb-3">
              <i class="bi bi-exclamation-circle-fill me-2"></i>
              <span>{{ loginErrors.general }}</span>
            </div>

            <!-- CHẾ ĐỘ 1: ĐĂNG NHẬP BẰNG MẬT KHẨU (MẶC ĐỊNH & DUY NHẤT YÊU CẦU USERNAME + PASSWORD) -->
            <div v-if="loginMode === 'password'">
              <!-- Thông báo nếu vừa đăng ký xong -->
              <div v-if="regSuccessMessage" class="alert alert-success d-flex align-items-center py-2 px-3 mb-3 small rounded-3">
                <i class="bi bi-check-circle-fill fs-5 me-2 text-success"></i>
                <div>
                  <strong>Mật khẩu đã gửi về email!</strong> Vui lòng nhập mật khẩu nhận được trong hộp thư để đăng nhập.
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label control-label mb-1">Tên đăng nhập <span class="text-danger">*</span></label>
                <input
                  v-model="loginUsername"
                  type="text"
                  name="sec_usr_input"
                  id="sec_usr_input"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  class="form-control"
                  placeholder="Nhập tên đăng nhập của bạn"
                  :class="{ 'is-invalid': !!loginErrors.username }"
                  @keyup.enter="handleLoginPassword"
                />
                <div v-if="loginErrors.username" class="field-error-text">
                  {{ loginErrors.username }}
                </div>
              </div>

              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label control-label mb-0">Mật khẩu <span class="text-danger">*</span></label>
                  <button
                    type="button"
                    class="btn btn-link p-0 text-decoration-none small"
                    style="color: var(--primary);"
                    @click="activeTab = 'forgot'"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div class="input-group">
                  <input
                    v-model="loginPassword"
                    type="text"
                    name="sec_pwd_input"
                    id="sec_pwd_input"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    class="form-control font-monospace"
                    :style="!showLoginPassword ? '-webkit-text-security: disc; text-security: disc;' : ''"
                    placeholder="Mật khẩu nhận được từ email"
                    :class="{ 'is-invalid': !!loginErrors.password }"
                    @keyup.enter="handleLoginPassword"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary input-addon-btn"
                    @click="showLoginPassword = !showLoginPassword"
                  >
                    <i class="bi" :class="showLoginPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                  </button>
                </div>
                <div v-if="loginErrors.password" class="field-error-text">
                  {{ loginErrors.password }}
                </div>
              </div>

              <div class="d-flex align-items-center justify-content-between mb-4">
                <div class="form-check">
                  <input
                    id="chk_sec_remember"
                    v-model="rememberMe"
                    type="checkbox"
                    autocomplete="off"
                    class="form-check-input"
                  />
                  <label for="chk_sec_remember" class="form-check-label small text-muted">
                    Ghi nhớ đăng nhập
                  </label>
                </div>
              </div>

              <button
                type="button"
                class="btn-primary-action w-100 justify-content-center"
                :disabled="isSubmitting"
                @click="handleLoginPassword"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-box-arrow-in-right me-2"></i>
                <span>Đăng nhập</span>
              </button>

              <div class="text-center mt-3 pt-2 hairline-border-top">
                <button
                  type="button"
                  class="btn btn-link p-0 small text-decoration-none text-muted"
                  @click="loginMode = 'otp'; loginStep = 1;"
                >
                  <i class="bi bi-shield-check me-1 text-primary"></i> Hoặc đăng nhập bằng mã OTP qua Email
                </button>
              </div>
            </div>

            <!-- CHẾ ĐỘ 2: ĐĂNG NHẬP BẰNG MÃ OTP QUA EMAIL (TÙY CHỌN) -->
            <div v-else>
              <!-- Bước 1: Nhập Tên đăng nhập và Email để gửi OTP -->
              <div v-if="loginStep === 1">
                <div class="mb-3">
                  <label class="form-label control-label mb-1">Tên đăng nhập</label>
                  <input
                    v-model="loginUsername"
                    type="text"
                    name="otp_sec_usr"
                    id="otp_sec_usr"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    class="form-control"
                    placeholder="ví dụ: tranvanan"
                    :class="{ 'is-invalid': !!loginErrors.username }"
                    @keyup.enter="handleRequestLoginOtp"
                  />
                  <div v-if="loginErrors.username" class="field-error-text">
                    {{ loginErrors.username }}
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label control-label mb-1">Email đã đăng ký</label>
                  <input
                    v-model="loginEmail"
                    type="email"
                    name="otp_sec_mail"
                    id="otp_sec_mail"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    class="form-control"
                    placeholder="name@example.com"
                    :class="{ 'is-invalid': !!loginErrors.email }"
                    @keyup.enter="handleRequestLoginOtp"
                  />
                  <div v-if="loginErrors.email" class="field-error-text">
                    {{ loginErrors.email }}
                  </div>
                  <div class="text-muted small mt-1" style="font-size: 12px;">
                    Mã OTP 6 chữ số sẽ được gửi trực tiếp đến hòm thư này.
                  </div>
                </div>

                <div class="d-flex align-items-center justify-content-between mb-4">
                  <div class="form-check">
                    <input
                      id="chk_otp_remember"
                      v-model="rememberMe"
                      type="checkbox"
                      autocomplete="off"
                      class="form-check-input"
                    />
                    <label for="chk_otp_remember" class="form-check-label small text-muted">
                      Ghi nhớ đăng nhập
                    </label>
                  </div>
                  <button
                    type="button"
                    class="btn btn-link p-0 text-decoration-none small"
                    style="color: var(--primary);"
                    @click="activeTab = 'forgot'"
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="button"
                  class="btn-primary-action w-100 justify-content-center"
                  :disabled="isSubmitting"
                  @click="handleRequestLoginOtp"
                >
                  <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-send-check me-2"></i>
                  <span>Nhận mã OTP đăng nhập</span>
                </button>

                <div class="text-center mt-3 pt-2 hairline-border-top">
                  <button
                    type="button"
                    class="btn btn-link p-0 small text-decoration-none text-muted"
                    @click="loginMode = 'password'"
                  >
                    <i class="bi bi-key me-1 text-primary"></i> Quay lại đăng nhập bằng Tên đăng nhập & Mật khẩu
                  </button>
                </div>
              </div>

              <!-- Bước 2: Nhập mã OTP đã nhận qua Email -->
              <div v-else>
                <div class="text-center mb-3">
                  <div class="fw-semibold text-main">Nhập mã OTP xác thực</div>
                  <div class="text-muted small">
                    Mã đã gửi đến <strong>{{ loginEmail }}</strong>
                  </div>
                </div>

                <div class="mb-3">
                  <input
                    v-model="loginOtp"
                    type="text"
                    maxlength="6"
                    class="form-control text-center fs-4 fw-bold letter-spacing-lg"
                    placeholder="------"
                    :class="{ 'is-invalid': !!loginErrors.otp }"
                    @keyup.enter="handleVerifyLoginOtp"
                  />
                  <div v-if="loginErrors.otp" class="field-error-text text-center mt-1">
                    {{ loginErrors.otp }}
                  </div>
                </div>

                <div class="d-flex align-items-center justify-content-between small text-muted mb-4">
                  <span>Mã hết hạn sau: <strong class="text-primary">{{ formatTime(otpCountdown) }}</strong></span>
                  <button
                    type="button"
                    class="btn btn-link p-0 small text-decoration-none"
                    :disabled="resendCooldown > 0 || isSubmitting"
                    @click="handleRequestLoginOtp"
                  >
                    <span v-if="resendCooldown > 0">Gửi lại mã (sau {{ resendCooldown }}s)</span>
                    <span v-else>Gửi lại mã OTP</span>
                  </button>
                </div>

                <div class="d-flex gap-2">
                  <button
                    type="button"
                    class="btn-secondary-action"
                    @click="loginStep = 1"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    class="btn-primary-action flex-grow-1 justify-content-center"
                    :disabled="isSubmitting"
                    @click="handleVerifyLoginOtp"
                  >
                    <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check-circle-fill me-2"></i>
                    <span>Xác minh & Đăng nhập</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ======================================================== -->
          <!-- TAB 2: ĐĂNG KÝ TÀI KHOẢN (Username + Email) -->
          <!-- ======================================================== -->
          <div v-else-if="activeTab === 'register'">
            <!-- Trạng thái đăng ký thành công -->
            <div v-if="regSuccessMessage" class="text-center py-2">
              <div class="success-icon-box mb-3 mx-auto">
                <i class="bi bi-shield-fill-check fs-2 text-success"></i>
              </div>
              <h5 class="section-title mb-1">Đăng ký thành công!</h5>
              <p class="section-desc mb-3" style="font-size: 13.5px;">
                Tài khoản của bạn đã được khởi tạo thành công trên hệ thống LsmVoice.
              </p>

              <div class="card p-3 mb-3 text-start border-0 shadow-sm" style="background: rgba(99, 102, 241, 0.08); border-radius: 12px;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="small text-muted">Tên đăng nhập:</span>
                  <span class="fw-bold font-monospace text-primary fs-6">{{ regUsername }}</span>
                </div>

                <div class="small text-muted mt-2 pt-2 border-top">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="bi bi-envelope-check-fill text-success fs-5"></i>
                    <span class="text-main fw-semibold">Mật khẩu khởi tạo đã được gửi đến email:</span>
                  </div>
                  <div class="p-2 px-3 bg-white rounded border fw-bold text-primary font-monospace mb-2 user-select-all">
                    {{ regEmail }}
                  </div>
                  <div class="text-secondary" style="font-size: 13px;">
                    Vì lý do bảo mật, mật khẩu đăng nhập ban đầu chỉ được gửi duy nhất về hòm thư này. Vui lòng mở email để lấy mật khẩu đăng nhập vào phòng thu LsmVoice.
                  </div>
                  <div class="text-warning-emphasis mt-2" style="font-size: 12px;">
                    <i class="bi bi-info-circle me-1"></i> <em>Lưu ý: Nếu không thấy trong Hộp thư đến, vui lòng kiểm tra thêm thư mục <strong>Spam / Thư rác</strong> hoặc mục <strong>Quảng cáo / Cập nhật</strong> trong Gmail của bạn.</em>
                  </div>
                </div>
              </div>

              <div class="d-flex flex-column gap-2">
                <button
                  type="button"
                  class="btn-primary-action w-100 justify-content-center"
                  @click="activeTab = 'login'; loginMode = 'password'; loginUsername = ''; loginPassword = '';"
                >
                  <i class="bi bi-box-arrow-in-right me-2"></i>
                  <span>Chuyển sang Đăng nhập</span>
                </button>
                <button
                  type="button"
                  class="btn btn-link btn-sm text-muted text-decoration-none"
                  @click="regSuccessMessage = ''; registeredInitialPassword = ''; clearAllFormFields();"
                >
                  <i class="bi bi-person-plus me-1"></i> Đăng ký tài khoản khác
                </button>
              </div>
            </div>

            <!-- Biểu mẫu đăng ký -->
            <div v-else>
              <div v-if="regErrors.general" class="alert-box-danger mb-3">
                <i class="bi bi-exclamation-circle-fill me-2"></i>
                <span>{{ regErrors.general }}</span>
              </div>

              <div class="mb-3">
                <label class="form-label control-label mb-1">Tên đăng nhập <span class="text-danger">*</span></label>
                <input
                  v-model="regUsername"
                  type="text"
                  name="reg_sec_usr"
                  id="reg_sec_usr"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  class="form-control"
                  placeholder="ví dụ: viet_anh99"
                  :class="{ 'is-invalid': !!regErrors.username }"
                />
                <div v-if="regErrors.username" class="field-error-text">
                  {{ regErrors.username }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label control-label mb-1">Địa chỉ Email <span class="text-danger">*</span></label>
                <input
                  v-model="regEmail"
                  type="email"
                  name="reg_sec_mail"
                  id="reg_sec_mail"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  class="form-control"
                  placeholder="name@example.com"
                  :class="{ 'is-invalid': !!regErrors.email }"
                />
                <div v-if="regErrors.email" class="field-error-text">
                  {{ regErrors.email }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label control-label mb-1">Họ và tên (Tùy chọn)</label>
                <input
                  v-model="regFullName"
                  type="text"
                  name="reg_sec_fname"
                  id="reg_sec_fname"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  class="form-control"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div class="alert-box-info mb-3">
                <i class="bi bi-info-circle me-1 text-primary"></i>
                <span>Mật khẩu ban đầu sẽ được hệ thống sinh ngẫu nhiên an toàn và gửi trực tiếp qua email.</span>
              </div>

              <div class="form-check mb-4">
                <input
                  id="agreeTermsCheck"
                  v-model="agreeTerms"
                  type="checkbox"
                  class="form-check-input"
                  :class="{ 'is-invalid': !!regErrors.terms }"
                />
                <label for="agreeTermsCheck" class="form-check-label small text-muted">
                  Tôi đồng ý với <a href="#" class="text-decoration-none">Điều khoản dịch vụ</a> và <a href="#" class="text-decoration-none">Chính sách bảo mật</a> của LsmVoice.
                </label>
                <div v-if="regErrors.terms" class="field-error-text">
                  {{ regErrors.terms }}
                </div>
              </div>

              <button
                type="button"
                class="btn-primary-action w-100 justify-content-center"
                :disabled="isSubmitting"
                @click="handleRegister"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-person-plus-fill me-2"></i>
                <span>Đăng ký tài khoản</span>
              </button>
            </div>
          </div>

          <!-- ======================================================== -->
          <!-- TAB 3: QUÊN MẬT KHẨU / KHÔI PHỤC TÀI KHOẢN -->
          <!-- ======================================================== -->
          <div v-else-if="activeTab === 'forgot'">
            <div class="d-flex align-items-center gap-2 mb-3">
              <button
                type="button"
                class="btn-ghost-action p-1 text-muted"
                @click="activeTab = 'login'"
              >
                <i class="bi bi-arrow-left fs-5"></i>
              </button>
              <h5 class="section-title mb-0" style="font-size: 16px;">Khôi phục tài khoản</h5>
            </div>

            <div v-if="forgotErrors.general" class="alert-box-danger mb-3">
              <i class="bi bi-exclamation-circle-fill me-2"></i>
              <span>{{ forgotErrors.general }}</span>
            </div>

            <!-- Bước 1: Nhập email gửi OTP -->
            <div v-if="forgotStep === 1">
              <p class="text-muted small mb-3">
                Nhập địa chỉ email liên kết với tài khoản LsmVoice của bạn. Hệ thống sẽ gửi mã OTP bảo mật để đặt lại mật khẩu mới.
              </p>
              <div class="mb-4">
                <label class="form-label control-label mb-1">Địa chỉ Email</label>
                <input
                  v-model="forgotEmail"
                  type="email"
                  name="fgt_sec_mail"
                  id="fgt_sec_mail"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  class="form-control"
                  placeholder="name@example.com"
                  :class="{ 'is-invalid': !!forgotErrors.email }"
                  @keyup.enter="handleRequestResetOtp"
                />
                <div v-if="forgotErrors.email" class="field-error-text">
                  {{ forgotErrors.email }}
                </div>
              </div>

              <button
                type="button"
                class="btn-primary-action w-100 justify-content-center"
                :disabled="isSubmitting"
                @click="handleRequestResetOtp"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-send me-2"></i>
                <span>Gửi mã khôi phục</span>
              </button>
            </div>

            <!-- Bước 2: Nhập OTP và mật khẩu mới -->
            <div v-else>
              <div class="mb-3">
                <label class="form-label control-label mb-1">Mã OTP (Đã gửi về email)</label>
                <input
                  v-model="forgotOtp"
                  type="text"
                  maxlength="6"
                  name="fgt_sec_otp"
                  id="fgt_sec_otp"
                  autocomplete="off"
                  inputmode="numeric"
                  class="form-control letter-spacing-lg fw-bold"
                  placeholder="------"
                  :class="{ 'is-invalid': !!forgotErrors.otp }"
                />
                <div v-if="forgotErrors.otp" class="field-error-text">
                  {{ forgotErrors.otp }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label control-label mb-1">Mật khẩu mới</label>
                <div class="input-group">
                  <input
                    v-model="forgotNewPassword"
                    type="text"
                    class="form-control font-monospace"
                    :style="!showForgotNewPassword ? '-webkit-text-security: disc; text-security: disc;' : ''"
                    placeholder="Tối thiểu 6 ký tự"
                    name="fgt_sec_newpwd"
                    id="fgt_sec_newpwd"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    :class="{ 'is-invalid': !!forgotErrors.newPassword }"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary input-addon-btn"
                    @click="showForgotNewPassword = !showForgotNewPassword"
                  >
                    <i class="bi" :class="showForgotNewPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                  </button>
                </div>
                <div v-if="forgotErrors.newPassword" class="field-error-text">
                  {{ forgotErrors.newPassword }}
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label control-label mb-1">Xác nhận mật khẩu mới</label>
                <input
                  v-model="forgotConfirmPassword"
                  type="text"
                  style="-webkit-text-security: disc; text-security: disc;"
                  class="form-control font-monospace"
                  placeholder="Nhập lại mật khẩu mới"
                  name="fgt_sec_cfmpwd"
                  id="fgt_sec_cfmpwd"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  :class="{ 'is-invalid': !!forgotErrors.confirmPassword }"
                />
                <div v-if="forgotErrors.confirmPassword" class="field-error-text">
                  {{ forgotErrors.confirmPassword }}
                </div>
              </div>

              <div class="d-flex align-items-center justify-content-between small text-muted mb-4">
                <span>Mã hết hạn sau: <strong class="text-primary">{{ formatTime(otpCountdown) }}</strong></span>
                <button
                  type="button"
                  class="btn btn-link p-0 small text-decoration-none"
                  :disabled="resendCooldown > 0 || isSubmitting"
                  @click="handleRequestResetOtp"
                >
                  <span v-if="resendCooldown > 0">Gửi lại mã (sau {{ resendCooldown }}s)</span>
                  <span v-else>Gửi lại mã khôi phục</span>
                </button>
              </div>

              <button
                type="button"
                class="btn-primary-action w-100 justify-content-center"
                :disabled="isSubmitting"
                @click="handleConfirmReset"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-shield-check me-2"></i>
                <span>Xác nhận mật khẩu mới</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-pill-btn {
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.18s ease;
}

.tab-pill-btn.active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: var(--shadow-xs);
}

.input-addon-btn {
  border-color: var(--border) !important;
  background-color: var(--surface-input) !important;
  color: var(--text-secondary) !important;
}

.field-error-text {
  font-size: 12px;
  color: var(--danger);
  margin-top: 4px;
}

.alert-box-danger {
  background-color: var(--danger-soft);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-sm);
  color: var(--danger);
  padding: 10px 14px;
  font-size: 13px;
  display: flex;
  align-items: center;
}

.alert-box-info {
  background-color: var(--success-soft);
  border: 1px solid var(--success-border);
  border-radius: var(--radius-sm);
  color: var(--success);
  padding: 10px 14px;
  font-size: 12.5px;
  line-height: 1.45;
}

.success-icon-box {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--success-soft);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
}

.letter-spacing-lg {
  letter-spacing: 6px;
}
</style>
