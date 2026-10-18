import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import router from '../router/index.js';
import {
  authRegister,
  authRequestLoginOtp,
  authVerifyLoginOtp,
  authLoginWithPassword,
  authLogout,
  authLogoutAll,
  fetchProfile,
  modifyProfile,
} from '../services/api.js';

export const useAuthStore = defineStore('auth', () => {
  const storedToken = localStorage.getItem('lsm_token') || sessionStorage.getItem('lsm_token');
  const storedUser = localStorage.getItem('lsm_user') || sessionStorage.getItem('lsm_user');

  const token = ref(storedToken || null);
  const user = ref(storedUser ? JSON.parse(storedUser) : null);
  const isLoading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value && user.value.role === 'admin');

  const saveAuthSession = (newToken, newUser, rememberMe = true) => {
    token.value = newToken;
    user.value = newUser;

    if (rememberMe) {
      localStorage.setItem('lsm_token', newToken);
      localStorage.setItem('lsm_user', JSON.stringify(newUser));
      sessionStorage.removeItem('lsm_token');
      sessionStorage.removeItem('lsm_user');
    } else {
      sessionStorage.setItem('lsm_token', newToken);
      sessionStorage.setItem('lsm_user', JSON.stringify(newUser));
      localStorage.removeItem('lsm_token');
      localStorage.removeItem('lsm_user');
    }
  };

  /**
   * Đăng ký tài khoản (Username + Email)
   */
  const register = async ({ username, email, fullName }) => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await authRegister({ username, email, fullName });
      return res;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Bước 1: Yêu cầu gửi mã OTP đăng nhập
   */
  const requestLoginOtp = async ({ username, email }) => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await authRequestLoginOtp({ username, email });
      return res;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Bước 2: Xác minh mã OTP đăng nhập
   */
  const verifyLoginOtp = async ({ username, email, otp, rememberMe = true }) => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await authVerifyLoginOtp({ username, email, otp });
      saveAuthSession(res.data.token, res.data.user, rememberMe);
      return res.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Đăng nhập bằng mật khẩu (Mật khẩu ban đầu từ email hoặc mật khẩu đã đổi)
   */
  const loginWithPassword = async ({ identifier, password, rememberMe = true }) => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await authLoginWithPassword({ identifier, password });
      saveAuthSession(res.data.token, res.data.user, rememberMe);
      return res.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Đăng xuất phiên hiện tại
   */
  const logout = async () => {
    try {
      await authLogout();
    } catch (_) {
      // Bỏ qua lỗi kết nối
    }
    token.value = null;
    user.value = null;
    localStorage.removeItem('lsm_token');
    localStorage.removeItem('lsm_user');
    sessionStorage.removeItem('lsm_token');
    sessionStorage.removeItem('lsm_user');

    // Buộc trình duyệt rời khỏi trang quản trị ngay lập tức về trang chủ
    window.location.replace('/');
  };

  /**
   * Đăng xuất khỏi tất cả các thiết bị
   */
  const logoutAll = async () => {
    try {
      await authLogoutAll();
    } catch (_) {}
    token.value = null;
    user.value = null;
    localStorage.removeItem('lsm_token');
    localStorage.removeItem('lsm_user');
    sessionStorage.removeItem('lsm_token');
    sessionStorage.removeItem('lsm_user');

    // Buộc trình duyệt rời khỏi trang quản trị ngay lập tức về trang chủ
    window.location.replace('/');
  };

  /**
   * Kiểm tra và làm mới hồ sơ người dùng
   */
  const checkProfile = async () => {
    if (!token.value) return;
    try {
      const res = await fetchProfile();
      user.value = res.data.user;
      if (localStorage.getItem('lsm_token')) {
        localStorage.setItem('lsm_user', JSON.stringify(res.data.user));
      } else {
        sessionStorage.setItem('lsm_user', JSON.stringify(res.data.user));
      }
    } catch (_) {
      logout();
    }
  };

  /**
   * Cập nhật thông tin hồ sơ
   */
  const updateProfile = async (data) => {
    isLoading.value = true;
    try {
      const res = await modifyProfile(data);
      user.value = res.data.user;
      if (localStorage.getItem('lsm_token')) {
        localStorage.setItem('lsm_user', JSON.stringify(res.data.user));
      } else {
        sessionStorage.setItem('lsm_user', JSON.stringify(res.data.user));
      }
      return res.data.user;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    token,
    user,
    isLoading,
    error,
    isAuthenticated,
    isAdmin,
    register,
    requestLoginOtp,
    verifyLoginOtp,
    loginWithPassword,
    logout,
    logoutAll,
    checkProfile,
    updateProfile,
  };
});
