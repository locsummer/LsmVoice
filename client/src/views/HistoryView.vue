<script setup>
import { onMounted } from 'vue';
import { useHistoryStore } from '../stores/historyStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

const emit = defineEmits(['notify']);

const historyStore = useHistoryStore();
const playerStore = usePlayerStore();
const notification = useNotificationStore();

onMounted(() => {
  historyStore.loadHistory();
});

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN');
};

const handleResume = (item) => {
  playerStore.loadTrack({
    title: item.title,
    voiceName: item.voice_name,
    audioUrl: item.job_id ? `/audio/job_${item.job_id}_full.mp3` : playerStore.currentAudioUrl,
    libraryId: item.library_id,
    jobId: item.job_id,
    resumePosition: item.last_position || 0,
    autoPlay: true,
  });
  emit('notify', {
    type: 'success',
    message: `Tiếp tục nghe "${item.title}" tại ${formatTime(item.last_position)}.`,
  });
};

const handleDelete = async (id) => {
  try {
    await historyStore.deleteItem(id);
    emit('notify', { type: 'info', message: 'Đã xóa bản ghi khỏi lịch sử.' });
  } catch (err) {
    emit('notify', { type: 'danger', message: err.message });
  }
};

const handleClearAll = async () => {
  const confirmed = await notification.askConfirm({
    title: 'Xóa toàn bộ lịch sử?',
    message: 'Toàn bộ danh sách bài nghe và vị trí phát đã lưu sẽ bị xóa sạch khỏi lịch sử cá nhân.',
    confirmText: 'Xóa toàn bộ',
    cancelText: 'Hủy',
    type: 'danger',
  });
  if (confirmed) {
    try {
      await historyStore.clearAll();
      notification.info('Đã xóa toàn bộ lịch sử nghe thành công.');
    } catch (err) {
      notification.error(err.message);
    }
  }
};
</script>

<template>
  <div class="container-fluid px-2 px-sm-3 px-lg-4 py-3 py-lg-4" style="max-width: 1480px;">
    <!-- Header -->
    <div class="panel-white p-3 p-md-4 mb-3 mb-md-4 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
      <div>
        <h1 class="page-title mb-1">Lịch sử nghe & Thống kê</h1>
        <p class="section-desc mb-0">
          Ghi nhận tiến trình phát âm thanh, tự động khôi phục vị trí dừng và thống kê thời lượng.
        </p>
      </div>

      <button
        v-if="historyStore.historyList.length > 0"
        class="btn-secondary-action text-danger"
        @click="handleClearAll"
      >
        <i class="bi bi-trash3 me-1"></i>
        <span>Xóa toàn bộ</span>
      </button>
    </div>

    <!-- 3 Thẻ thống kê Dashboard UI8 -->
    <div class="row g-2.5 g-md-4 mb-3 mb-md-4">
      <div class="col-12 col-sm-6 col-md-4">
        <div class="panel-white p-3 p-md-4 d-flex align-items-center gap-3">
          <div class="stat-icon-box bg-primary-soft text-primary">
            <i class="bi bi-headphones fs-4"></i>
          </div>
          <div>
            <div class="control-label mb-1">Tổng số lượt nghe</div>
            <div class="h3 fw-bold text-main mb-0">
              {{ historyStore.historyList.length }}
            </div>
            <div class="text-muted small mt-0.5" style="font-size: 11.5px;">Các phiên đã khởi tạo</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4">
        <div class="panel-white p-3 p-md-4 d-flex align-items-center gap-3">
          <div class="stat-icon-box text-violet" style="background: var(--violet-soft); color: var(--violet);">
            <i class="bi bi-hourglass-split fs-4"></i>
          </div>
          <div>
            <div class="control-label mb-1">Thời lượng đã nghe</div>
            <div class="h3 fw-bold text-main mb-0">
              {{ Math.round(historyStore.totalListenedDuration / 60) }} <span class="h6 fw-normal text-muted">phút</span>
            </div>
            <div class="text-muted small mt-0.5" style="font-size: 11.5px;">Tổng thời gian phát audio</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-12 col-md-4">
        <div class="panel-white p-3 p-md-4 d-flex align-items-center gap-3">
          <div class="stat-icon-box" style="background: var(--success-soft); color: var(--success);">
            <i class="bi bi-check2-circle fs-4"></i>
          </div>
          <div>
            <div class="control-label mb-1">Tác phẩm hoàn thành</div>
            <div class="h3 fw-bold text-main mb-0">
              {{ historyStore.historyList.filter((h) => h.completed).length }}
            </div>
            <div class="text-muted small mt-0.5" style="font-size: 11.5px;">Đã nghe trọn vẹn</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tìm kiếm trong lịch sử -->
    <div class="panel-white p-3 mb-4">
      <div class="input-group">
        <span class="input-group-text bg-transparent border-0 text-muted ps-3">
          <i class="bi bi-search"></i>
        </span>
        <input
          v-model="historyStore.searchQuery"
          type="text"
          class="form-control border-0 bg-transparent text-main"
          placeholder="Tìm trong lịch sử theo tiêu đề hoặc tên giọng đọc..."
        />
      </div>
    </div>

    <!-- Trạng thái trống -->
    <div
      v-if="historyStore.filteredHistory.length === 0"
      class="panel-white text-center py-5 px-3 my-4"
    >
      <div class="mb-3 text-muted opacity-50">
        <i class="bi bi-clock-history fs-1 text-primary"></i>
      </div>
      <h3 class="section-title mb-2">Chưa có lịch sử nghe</h3>
      <p class="section-desc mb-4" style="max-width: 460px; margin-left: auto; margin-right: auto;">
        Khi bạn phát các bản đọc audio, hệ thống sẽ tự động ghi nhớ vị trí và cập nhật dữ liệu tại đây.
      </p>
      <router-link to="/" class="btn-primary-action text-decoration-none">
        Bắt đầu nghe ngay
      </router-link>
    </div>

    <!-- Bảng danh sách lịch sử -->
    <div v-else class="panel-white overflow-hidden">
      <div class="table-responsive">
        <table class="table align-middle mb-0" style="color: var(--text-primary); background: transparent;">
          <thead style="background: var(--surface-soft);">
            <tr class="hairline-border-bottom">
              <th class="ps-4 py-3 control-label">Tiêu đề tác phẩm</th>
              <th class="py-3 control-label">Giọng đọc</th>
              <th class="py-3 control-label">Tiến độ phát</th>
              <th class="py-3 control-label">Thời điểm nghe</th>
              <th class="py-3 control-label">Trạng thái</th>
              <th class="text-end pe-4 py-3 control-label">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in historyStore.filteredHistory"
              :key="item.id"
              class="hairline-border-bottom transition-all"
            >
              <td class="ps-4 py-3 fw-semibold text-main text-truncate" style="max-width: 280px;">
                {{ item.title }}
              </td>
              <td class="py-3 small text-muted">
                {{ item.voice_name || 'Mặc định' }}
              </td>
              <td class="py-3 small font-monospace text-muted">
                {{ formatTime(item.last_position) }} / {{ formatTime(item.total_duration) }}
              </td>
              <td class="py-3 small text-muted">
                {{ formatDate(item.last_listened_at) }}
              </td>
              <td class="py-3">
                <span
                  class="badge-neutral"
                  :style="item.completed ? 'color: var(--success); background: var(--success-soft); border-color: rgba(69,167,122,0.3);' : ''"
                >
                  {{ item.completed ? 'Đã hoàn thành' : 'Đang nghe dở' }}
                </span>
              </td>
              <td class="text-end pe-4 py-3">
                <div class="d-inline-flex align-items-center gap-2">
                  <button
                    class="btn-primary-action"
                    style="height: 36px; padding: 0 14px; font-size: 13px;"
                    @click="handleResume(item)"
                  >
                    <i class="bi bi-play-circle-fill"></i>
                    <span>Nghe tiếp</span>
                  </button>
                  <button
                    class="btn-ghost-action p-2 text-danger"
                    @click="handleDelete(item.id)"
                    title="Xóa khỏi lịch sử"
                  >
                    <i class="bi bi-trash3"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-icon-box {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
