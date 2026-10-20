<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLibraryStore } from '../stores/libraryStore.js';
import { useTtsStore } from '../stores/ttsStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import { getAudioDownloadUrl } from '../services/api.js';
import SaveWorkModal from '../components/SaveWorkModal.vue';

const emit = defineEmits(['notify']);

const router = useRouter();
const libraryStore = useLibraryStore();
const ttsStore = useTtsStore();
const playerStore = usePlayerStore();
const notification = useNotificationStore();

const showSaveModal = ref(false);
const activeWorkItem = ref({});

onMounted(() => {
  libraryStore.loadItems();
});

const handleOpenInStudio = (item) => {
  ttsStore.title = item.title;
  ttsStore.text = item.content;
  if (item.voice_id) ttsStore.selectedVoiceId = item.voice_id;
  if (item.speed) ttsStore.speed = item.speed;
  router.push('/');
  notification.info(`Đã mở "${item.title}" trong phòng thu Studio.`);
};

const handleListenNow = (item) => {
  if (item.audio_url) {
    playerStore.loadTrack({
      title: item.title,
      voiceName: item.voice_id,
      audioUrl: item.audio_url,
      libraryId: item.id,
      resumePosition: item.last_position || 0,
      autoPlay: true,
    });
    notification.success(
      `Đang phát "${item.title}"${
        item.last_position > 0 ? ` từ vị trí ${Math.round(item.last_position)}s` : ''
      }.`
    );
  } else {
    handleOpenInStudio(item);
  }
};

const handleOpenEdit = (item) => {
  activeWorkItem.value = {
    id: item.id,
    title: item.title,
    content: item.content,
    category: item.category,
    author: item.author,
    description: item.description,
    voiceId: item.voice_id,
    speed: item.speed,
    audioUrl: item.audio_url,
    duration: item.duration,
    status: item.status,
  };
  showSaveModal.value = true;
};

const handleCreateNew = () => {
  activeWorkItem.value = {
    title: '',
    content: '',
    category: 'Tiểu thuyết',
    author: '',
    description: '',
    voiceId: ttsStore.selectedVoiceId || 'vi-VN-HoaiMyNeural',
    speed: 1.0,
    audioUrl: null,
    duration: 0,
    status: 'text_saved',
  };
  showSaveModal.value = true;
};

const handleDownloadAudio = (item) => {
  if (!item.audio_url) return;
  const downloadUrl = getAudioDownloadUrl(item.audio_url, item.title);
  window.open(downloadUrl, '_blank');
  notification.success(`Đang bắt đầu tải tệp audio cho "${item.title}".`);
};

const handleDelete = async (item) => {
  const confirmed = await notification.askConfirm({
    title: 'Xóa tác phẩm khỏi thư viện?',
    message: `Bạn có chắc chắn muốn xóa "${item.title}"? Toàn bộ văn bản và file ghi âm sẽ bị xóa vĩnh viễn khỏi thư viện cá nhân.`,
    confirmText: 'Xóa tác phẩm',
    cancelText: 'Hủy',
    type: 'danger',
  });

  if (confirmed) {
    try {
      await libraryStore.deleteItem(item.id);
      notification.info(`Đã xóa "${item.title}" khỏi thư viện.`);
    } catch (err) {
      notification.error('Không thể xóa tác phẩm: ' + err.message);
    }
  }
};
</script>

<template>
  <div class="container-fluid px-2 px-sm-3 px-lg-4 py-3 py-lg-4" style="max-width: 1480px;">
    <!-- Tiêu đề trang & Nút thêm mới -->
    <div class="panel-white p-3 p-md-4 mb-3 mb-md-4 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
      <div>
        <h1 class="page-title mb-1">Thư viện của tôi</h1>
        <p class="section-desc mb-0">
          Quản lý toàn bộ danh sách tác phẩm, tiểu thuyết và tài liệu văn bản đã lưu trữ.
        </p>
      </div>

      <div class="d-flex align-items-center gap-2 w-100 w-sm-auto">
        <button
          type="button"
          class="btn-secondary-action flex-fill flex-sm-grow-0"
          @click="handleCreateNew"
        >
          <i class="bi bi-file-earmark-plus"></i>
          <span>Thêm mới</span>
        </button>

        <router-link to="/" class="btn-primary-action text-decoration-none flex-fill flex-sm-grow-0 text-center">
          <i class="bi bi-mic"></i>
          <span>Phòng thu</span>
        </router-link>
      </div>
    </div>

    <!-- Thanh tìm kiếm và bộ lọc (UI8 White Panel) -->
    <div class="panel-white p-2.5 p-sm-3 mb-3 mb-md-4">
      <div class="row g-2 align-items-center">
        <!-- Ô tìm kiếm -->
        <div class="col-md-6">
          <div class="input-group">
            <span class="input-group-text bg-transparent border-0 text-muted ps-3">
              <i class="bi bi-search"></i>
            </span>
            <input
              v-model="libraryStore.searchQuery"
              type="text"
              class="form-control border-0 bg-transparent text-main"
              placeholder="Tìm kiếm tác phẩm theo tiêu đề, tác giả hoặc nội dung..."
            />
          </div>
        </div>

        <!-- Thể loại -->
        <div class="col-md-3">
          <select v-model="libraryStore.selectedCategory" class="form-select form-select-sm">
            <option value="all">Tất cả thể loại</option>
            <option v-for="cat in libraryStore.categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>

        <!-- Sắp xếp -->
        <div class="col-md-3">
          <select v-model="libraryStore.sortBy" class="form-select form-select-sm">
            <option value="newest">Sắp xếp: Mới nhất</option>
            <option value="oldest">Sắp xếp: Cũ nhất</option>
            <option value="longest">Sắp xếp: Dài nhất</option>
            <option value="recent_listened">Sắp xếp: Nghe gần đây</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Trạng thái trống -->
    <div
      v-if="libraryStore.filteredItems.length === 0"
      class="panel-white text-center py-5 px-3 my-4"
    >
      <div class="mb-3 text-muted opacity-50">
        <i class="bi bi-collection-play fs-1 text-primary"></i>
      </div>
      <h3 class="section-title mb-2">Thư viện của bạn đang trống</h3>
      <p class="section-desc mb-4" style="max-width: 480px; margin-left: auto; margin-right: auto;">
        Hãy quay lại trang phòng thu để nhập văn bản, chọn giọng đọc tiếng Việt và lưu trữ tác phẩm để nghe bất cứ lúc nào.
      </p>
      <div class="d-flex justify-content-center gap-2">
        <button class="btn-secondary-action" @click="handleCreateNew">
          <i class="bi bi-file-earmark-plus"></i> Thêm tác phẩm
        </button>
        <router-link to="/" class="btn-primary-action text-decoration-none">
          <i class="bi bi-mic"></i> Đến phòng thu
        </router-link>
      </div>
    </div>

    <!-- Danh sách thẻ nội dung thư viện (Lưới 2-3 cột) -->
    <div v-else class="row g-4">
      <div
        v-for="item in libraryStore.filteredItems"
        :key="item.id"
        class="col-md-6 col-lg-4"
      >
        <div class="panel-white h-100 p-4 d-flex flex-column justify-content-between transition-all library-card">
          <div>
            <!-- Header thẻ: Thể loại + Trạng thái Audio + Menu -->
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div class="d-flex align-items-center gap-1.5 flex-wrap">
                <span class="badge-violet-pill">
                  {{ item.category || 'Chung' }}
                </span>
                <span
                  v-if="item.audio_url || item.status === 'audio_ready'"
                  class="badge-success-pill"
                  title="Tác phẩm đã có file âm thanh hoàn chỉnh"
                >
                  <i class="bi bi-music-note-beamed me-1"></i> Có audio
                </span>
                <span
                  v-else
                  class="badge-neutral"
                  title="Tác phẩm bản thảo dạng văn bản"
                >
                  <i class="bi bi-file-earmark-text me-1"></i> Bản thảo
                </span>
              </div>

              <!-- Thao tác nhanh -->
              <div class="dropdown">
                <button
                  class="btn-ghost-action p-1 text-muted"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title="Thao tác"
                >
                  <i class="bi bi-three-dots fs-5"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm border hairline-border py-1" style="border-radius: var(--radius-sm);">
                  <li>
                    <button class="dropdown-item small py-2" @click="handleOpenInStudio(item)">
                      <i class="bi bi-pencil-square me-2 text-primary"></i> Mở trong Studio
                    </button>
                  </li>
                  <li>
                    <button class="dropdown-item small py-2" @click="handleOpenEdit(item)">
                      <i class="bi bi-sliders me-2 text-muted"></i> Sửa thông tin & Phân loại
                    </button>
                  </li>
                  <li v-if="item.audio_url">
                    <button class="dropdown-item small py-2" @click="handleDownloadAudio(item)">
                      <i class="bi bi-download me-2 text-success"></i> Tải file MP3
                    </button>
                  </li>
                  <li><hr class="dropdown-divider my-1 hairline-border" /></li>
                  <li>
                    <button class="dropdown-item small py-2 text-danger" @click="handleDelete(item)">
                      <i class="bi bi-trash3 me-2"></i> Xóa tác phẩm
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Tiêu đề tác phẩm -->
            <h3 class="h5 fw-semibold mb-1 text-main text-truncate" :title="item.title">
              {{ item.title }}
            </h3>

            <!-- Tác giả nếu có -->
            <div v-if="item.author" class="text-muted small mb-2 d-flex align-items-center gap-1" style="font-size: 12.5px;">
              <i class="bi bi-person text-secondary"></i>
              <span>Tác giả: <strong class="text-main">{{ item.author }}</strong></span>
            </div>

            <!-- Mô tả ngắn nếu có -->
            <p
              v-if="item.description"
              class="text-muted small mb-2 fst-italic"
              style="font-size: 12.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"
            >
              {{ item.description }}
            </p>

            <!-- Đoạn trích văn bản -->
            <p
              class="text-muted small mb-3"
              style="min-height: 40px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px;"
            >
              {{ item.content }}
            </p>

            <!-- Metadata: ký tự, giọng đọc, thời lượng, tốc độ -->
            <div class="d-flex flex-wrap gap-2 text-muted small mb-3 pt-2 hairline-border-top" style="font-size: 11.5px;">
              <span><i class="bi bi-fonts me-1"></i>{{ item.char_count?.toLocaleString('vi-VN') || 0 }} ký tự</span>
              <span v-if="item.duration > 0"><i class="bi bi-clock me-1"></i>{{ Math.round(item.duration) }}s</span>
              <span v-if="item.speed"><i class="bi bi-speedometer2 me-1"></i>{{ item.speed }}x</span>
              <span v-if="item.voice_id" class="text-truncate" style="max-width: 140px;">
                <i class="bi bi-person-voice me-1"></i>{{ item.voice_id }}
              </span>
            </div>
          </div>

          <!-- Nút hành động -->
          <div class="d-flex gap-2 pt-2">
            <button
              class="btn-primary-action flex-grow-1 justify-content-center"
              @click="handleListenNow(item)"
            >
              <i class="bi bi-play-circle-fill"></i>
              <span>{{ item.audio_url ? 'Nghe ngay' : 'Tạo audio' }}</span>
            </button>

            <!-- Tải file MP3 trực tiếp nếu đã có audio -->
            <button
              v-if="item.audio_url"
              class="btn-secondary-action"
              style="padding: 0 12px;"
              @click="handleDownloadAudio(item)"
              title="Tải tệp MP3 về thiết bị"
            >
              <i class="bi bi-download text-success"></i>
            </button>

            <!-- Nút chỉnh sửa -->
            <button
              class="btn-secondary-action"
              style="padding: 0 12px;"
              @click="handleOpenEdit(item)"
              title="Chỉnh sửa phân loại và thông tin"
            >
              <i class="bi bi-sliders"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Phân loại & Lưu trữ / Chỉnh sửa tác phẩm -->
    <SaveWorkModal
      :show="showSaveModal"
      :initialData="activeWorkItem"
      @close="showSaveModal = false"
      @saved="libraryStore.loadItems()"
    />
  </div>
</template>

<style scoped>
.library-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-float);
}
</style>
