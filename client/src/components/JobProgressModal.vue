<script setup>
import { computed } from 'vue';
import { useTtsStore } from '../stores/ttsStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

const emit = defineEmits(['close', 'notify']);

const ttsStore = useTtsStore();
const playerStore = usePlayerStore();
const notification = useNotificationStore();

const job = computed(() => ttsStore.activeJob);

const isDone = computed(
  () =>
    job.value &&
    (job.value.status === 'completed' ||
      job.value.status === 'failed' ||
      job.value.status === 'cancelled')
);

const isSuccess = computed(() => job.value && job.value.status === 'completed');

const getStatusText = (status) => {
  switch (status) {
    case 'completed':
      return 'Hoàn thành';
    case 'processing':
      return 'Đang đọc...';
    case 'failed':
      return 'Lỗi';
    case 'pending':
    default:
      return 'Đang chờ';
  }
};

const handleRetryChunk = async (chunkId) => {
  try {
    await ttsStore.retryChunk(chunkId);
    emit('notify', {
      type: 'info',
      message: 'Đang thử lại đoạn văn bản này...',
    });
  } catch (err) {
    emit('notify', {
      type: 'danger',
      message: err.message || 'Không thể tạo lại đoạn âm thanh.',
    });
  }
};

const handleCancel = async () => {
  const confirmed = await notification.askConfirm({
    title: 'Dừng chuyển đổi audio?',
    message: 'Bạn có chắc chắn muốn dừng quá trình đọc audio cho tác phẩm này? Các đoạn chưa đọc sẽ bị hủy.',
    confirmText: 'Dừng tác vụ',
    cancelText: 'Tiếp tục đọc',
    type: 'warning',
  });
  if (confirmed) {
    try {
      await ttsStore.cancelJob();
    } catch (err) {
      emit('notify', { type: 'danger', message: err.message });
    }
  }
};

const handlePlayNow = () => {
  if (!job.value) return;

  const chunksList = (job.value.chunks || []).map((c) => ({
    index: c.chunk_index,
    text: c.text,
    audioUrl: c.audio_url,
    duration: c.duration,
  }));

  playerStore.loadTrack({
    title: job.value.title,
    voiceName: job.value.voice?.name,
    audioUrl: job.value.mergedAudioUrl || (chunksList[0] ? chunksList[0].audioUrl : ''),
    chunksList,
    jobId: job.value.id,
    autoPlay: true,
  });

  emit('close');
};
</script>

<template>
  <div v-if="job" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(32, 34, 56, 0.45); backdrop-filter: blur(4px); z-index: 1070;">
    <div class="modal-dialog modal-dialog-centered" style="max-width: 540px;">
      <div class="modal-content modal-content-clean p-2">
        <!-- Header -->
        <div class="modal-header hairline-border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <span
              v-if="!isDone"
              class="spinner-border spinner-border-sm text-primary"
              role="status"
            ></span>
            <i v-else-if="isSuccess" class="bi bi-check-circle-fill text-success fs-5"></i>
            <i v-else class="bi bi-exclamation-circle-fill text-danger fs-5"></i>
            <h5 class="section-title mb-0" style="font-size: 16px;">
              {{ isSuccess ? 'Tạo audio thành công' : isDone ? 'Quá trình kết thúc' : 'Đang chuyển đổi văn bản...' }}
            </h5>
          </div>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <!-- Body -->
        <div class="modal-body p-4">
          <!-- Metadata -->
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div class="fw-semibold text-main text-truncate" style="font-size: 14.5px; max-width: 320px;">
                {{ job.title }}
              </div>
              <div class="text-muted small mt-1">
                Giọng: {{ job.voice?.name }} • {{ job.totalChars?.toLocaleString('vi-VN') }} ký tự
              </div>
            </div>
            <span class="badge-primary-pill font-monospace" style="font-size: 12.5px;">
              {{ job.completedChunks }}/{{ job.totalChunks }} đoạn ({{ job.percentage }}%)
            </span>
          </div>

          <!-- Progress track -->
          <div class="mb-4">
            <div class="progress" style="height: 6px; border-radius: 999px; background: #E9E9F2;">
              <div
                class="progress-bar"
                :class="job.status === 'failed' ? 'bg-danger' : 'bg-primary'"
                :style="{ width: `${job.percentage}%`, borderRadius: '999px' }"
              ></div>
            </div>
          </div>

          <!-- Danh sách các chunk -->
          <div>
            <div class="control-label mb-2">Tiến trình từng phân đoạn</div>
            <div class="panel-sub rounded-3 overflow-hidden" style="max-height: 220px; overflow-y: auto;">
              <div
                v-for="chunk in job.chunks"
                :key="chunk.id"
                class="d-flex align-items-center justify-content-between py-2 px-3 hairline-border-bottom"
              >
                <div class="d-flex align-items-center gap-2 overflow-hidden me-2" style="max-width: 75%;">
                  <span class="text-muted font-monospace small">#{{ chunk.chunk_index + 1 }}</span>
                  <span class="text-truncate text-secondary small">{{ chunk.text }}</span>
                </div>

                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                  <span
                    class="badge-neutral"
                    :style="chunk.status === 'completed' ? 'color: var(--success);' : ''"
                    style="font-size: 11px;"
                  >
                    {{ getStatusText(chunk.status) }}
                  </span>
                  <button
                    v-if="chunk.status === 'failed'"
                    type="button"
                    class="btn-ghost-action text-danger py-0 px-2"
                    style="font-size: 11px;"
                    @click="handleRetryChunk(chunk.id)"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer hairline-border-top px-4 py-3 d-flex justify-content-between align-items-center">
          <div>
            <button
              v-if="!isDone"
              type="button"
              class="btn-ghost-action text-danger"
              @click="handleCancel"
            >
              Hủy tác vụ
            </button>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button
              type="button"
              class="btn-secondary-action"
              style="height: 40px; padding: 0 16px;"
              @click="emit('close')"
            >
              Đóng
            </button>

            <button
              v-if="job.completedChunks > 0"
              type="button"
              class="btn-primary-action"
              style="height: 40px; padding: 0 18px;"
              @click="handlePlayNow"
            >
              <i class="bi bi-play-circle-fill"></i>
              <span>{{ isSuccess ? 'Bắt đầu nghe' : 'Nghe các đoạn đã sẵn sàng' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
