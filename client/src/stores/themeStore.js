import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref(localStorage.getItem('lsm_theme') || 'dark');

  const applyTheme = (theme) => {
    currentTheme.value = theme;
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lsm_theme', theme);
  };

  const toggleTheme = () => {
    const next = currentTheme.value === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  };

  // Áp dụng theme lúc khởi động
  applyTheme(currentTheme.value);

  return {
    currentTheme,
    toggleTheme,
    applyTheme,
  };
});
