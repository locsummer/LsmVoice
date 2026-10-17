import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  fetchLibrary,
  saveToLibrary,
  updateLibrary,
  removeLibrary,
  fetchCategories,
  createCategory as apiCreateCategory,
  GuestStorage,
} from '../services/api.js';

export const useLibraryStore = defineStore('library', () => {
  const items = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const searchQuery = ref('');
  const selectedCategory = ref('all');
  const sortBy = ref('newest');

  const defaultCategoriesList = [
    'Tiểu thuyết',
    'Truyện ngắn',
    'Ngôn tình',
    'Trinh thám',
    'Kinh dị',
    'Tâm lý - tình cảm',
    'Kiếm hiệp - tiên hiệp',
    'Khoa học viễn tưởng',
    'Truyện đời sống',
    'Tin tức',
    'Học tập',
    'Tài liệu',
    'Khác',
  ];

  const availableCategories = ref([...defaultCategoriesList]);

  const categories = computed(() => {
    const set = new Set([...availableCategories.value]);
    items.value.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  });

  const filteredItems = computed(() => {
    let list = [...items.value];

    if (searchQuery.value && searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.title && i.title.toLowerCase().includes(q)) ||
          (i.content && i.content.toLowerCase().includes(q)) ||
          (i.author && i.author.toLowerCase().includes(q))
      );
    }

    if (selectedCategory.value !== 'all') {
      list = list.filter((i) => i.category === selectedCategory.value);
    }

    if (sortBy.value === 'oldest') {
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy.value === 'longest') {
      list.sort((a, b) => (b.char_count || 0) - (a.char_count || 0));
    } else if (sortBy.value === 'recent_listened') {
      list.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  });

  const loadCategories = async () => {
    try {
      const res = await fetchCategories();
      if (res.data && res.data.categories && res.data.categories.length > 0) {
        availableCategories.value = res.data.categories;
      }
    } catch (_) {
      // Dùng danh sách mặc định nếu chưa kết nối được
    }
  };

  const addCustomCategory = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    try {
      const res = await apiCreateCategory({ name: trimmed });
      if (!availableCategories.value.includes(trimmed)) {
        availableCategories.value.push(trimmed);
      }
      return res.data;
    } catch (_) {
      if (!availableCategories.value.includes(trimmed)) {
        availableCategories.value.push(trimmed);
      }
      return { name: trimmed };
    }
  };

  const loadItems = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      await loadCategories();
      const res = await fetchLibrary();
      items.value = res.data.items || [];
    } catch (_) {
      // Fallback sang guest storage
      items.value = GuestStorage.getLibrary();
    } finally {
      isLoading.value = false;
    }
  };

  const addItem = async (itemData) => {
    try {
      const res = await saveToLibrary(itemData);
      items.value.unshift(res.data);
      return res.data;
    } catch (err) {
      const saved = GuestStorage.saveLibraryItem(itemData);
      items.value = saved;
      return itemData;
    }
  };

  const editItem = async (id, itemData) => {
    try {
      const res = await updateLibrary(id, itemData);
      const index = items.value.findIndex((i) => i.id === id);
      if (index >= 0) items.value[index] = res.data;
      return res.data;
    } catch (_) {
      const saved = GuestStorage.saveLibraryItem({ ...itemData, id });
      items.value = saved;
      return itemData;
    }
  };

  const deleteItem = async (id) => {
    try {
      await removeLibrary(id);
    } catch (_) {
      // Bỏ qua lỗi server nếu là guest
    }
    GuestStorage.deleteLibraryItem(id);
    items.value = items.value.filter((i) => i.id !== id);
  };

  return {
    items,
    isLoading,
    error,
    searchQuery,
    selectedCategory,
    sortBy,
    categories,
    availableCategories,
    filteredItems,
    loadCategories,
    addCustomCategory,
    loadItems,
    addItem,
    editItem,
    deleteItem,
  };
});
