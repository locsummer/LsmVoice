import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchHistory, removeHistory, wipeHistory, GuestStorage } from '../services/api.js';

export const useHistoryStore = defineStore('history', () => {
  const historyList = ref([]);
  const isLoading = ref(false);
  const searchQuery = ref('');

  const filteredHistory = computed(() => {
    if (!searchQuery.value || !searchQuery.value.trim()) {
      return historyList.value;
    }
    const q = searchQuery.value.toLowerCase().trim();
    return historyList.value.filter(
      (h) => (h.title && h.title.toLowerCase().includes(q)) || (h.voice_name && h.voice_name.toLowerCase().includes(q))
    );
  });

  const totalListenedDuration = computed(() => {
    return historyList.value.reduce((acc, h) => acc + (h.last_position || 0), 0);
  });

  const loadHistory = async () => {
    isLoading.value = true;
    try {
      const res = await fetchHistory();
      historyList.value = res.data.history || [];
    } catch (_) {
      historyList.value = GuestStorage.getHistory();
    } finally {
      isLoading.value = false;
    }
  };

  const deleteItem = async (id) => {
    try {
      await removeHistory(id);
    } catch (_) {}
    GuestStorage.deleteHistoryItem(id);
    historyList.value = historyList.value.filter((h) => h.id !== id);
  };

  const clearAll = async () => {
    try {
      await wipeHistory();
    } catch (_) {}
    GuestStorage.clearHistory();
    historyList.value = [];
  };

  return {
    historyList,
    isLoading,
    searchQuery,
    filteredHistory,
    totalListenedDuration,
    loadHistory,
    deleteItem,
    clearAll,
  };
});
