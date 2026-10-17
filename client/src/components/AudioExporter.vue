<script setup>
import { computed } from 'vue';
import { useTtsStore } from '../stores/ttsStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { getAudioDownloadUrl } from '../services/api.js';

const emit = defineEmits(['close']);

const ttsStore = useTtsStore();
const playerStore = usePlayerStore();

const currentJob = computed(() => ttsStore.activeJob);
const trackTitle = computed(() => playerStore.currentTitle || ttsStore.title || 'audio_lsmvoice');

// Tải xuống file văn bản gốc dạng .txt
const downloadTextFile = () => {
  const content = ttsStore.text;
  if (!content) return;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(trackTitle.value)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Tải xuống file audio hợp nhất
const downloadMergedAudio = () => {
  const rawUrl = currentJob.value?.mergedAudioUrl || playerStore.currentAudioUrl;
  if (!rawUrl) return;

  const downloadUrl = getAudioDownloadUrl(rawUrl, trackTitle.value);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${sanitizeFileName(trackTitle.value)}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Tải xuống từng đoạn lẻ
const downloadChunkAudio = (chunk) => {
  if (!chunk.audioUrl && !chunk.audio_url) return;
  const url = chunk.audioUrl || chunk.audio_url;

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(trackTitle.value)}_doan_${chunk.chunk_index + 1}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const sanitizeFileName = (name) => {
  return name.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_').substring(0, 50);
};
</script>

<template>
  <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(32, 34, 56, 0.45); backdrop-filter: blur(4px); z-index: 1080;">
    <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
      <div class="modal-content modal-content-clean p-2">
        <div class="modal-header hairline-border-bottom px-4 py-3">
          <div>
            <h5 class="modal-title section-title mb-0">Xuất bản & Tải âm thanh</h5>
            <div class="small text-muted mt-1 text-truncate" style="max-width: 380px;">{{ trackTitle }}</div>
          </div>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body p-4">
          <!-- Tùy chọn 1: Tải file audio hợp nhất -->
          <div class="panel-sub p-3 mb-3 rounded-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold text-main">Tải file âm thanh MP3</div>
              <div class="small text-muted">Bản ghi đầy đủ chất lượng cao</div>
            </div>
            <button
              class="btn-primary-action"
              style="height: 40px; padding: 0 16px; font-size: 13.5px;"
              @click="downloadMergedAudio"
            >
              <i class="bi bi-download"></i>
              <span>Tải MP3</span>
            </button>
          </div>

          <!-- Tùy chọn 2: Xuất văn bản TXT -->
          <div class="panel-sub p-3 mb-3 rounded-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold text-main">Xuất văn bản gốc (.txt)</div>
              <div class="small text-muted">Lưu nội dung chữ tiếng Việt</div>
            </div>
            <button
              class="btn-secondary-action"
              style="height: 40px; padding: 0 16px; font-size: 13.5px;"
              @click="downloadTextFile"
            >
              <i class="bi bi-file-earmark-text"></i>
              <span>Tải TXT</span>
            </button>
          </div>

          <!-- Tùy chọn 3: Tải từng đoạn lẻ (nếu có chia đoạn) -->
          <div v-if="playerStore.chunks && playerStore.chunks.length > 1" class="mt-4">
            <div class="control-label mb-2">Tải từng phân đoạn đơn lẻ</div>
            <div class="panel-sub rounded-3 overflow-hidden" style="max-height: 180px; overflow-y: auto;">
              <div
                v-for="chunk in playerStore.chunks"
                :key="chunk.index"
                class="d-flex align-items-center justify-content-between py-2.5 px-3 hairline-border-bottom"
              >
                <span class="small text-main">Phân đoạn #{{ chunk.index + 1 }}</span>
                <button
                  class="btn-ghost-action py-1 px-2"
                  style="font-size: 12px;"
                  @click="downloadChunkAudio(chunk)"
                  title="Tải phân đoạn này"
                >
                  <i class="bi bi-download me-1"></i> MP3
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer hairline-border-top px-4 py-3 d-flex justify-content-end">
          <button type="button" class="btn-secondary-action" style="height: 38px; padding: 0 18px;" @click="emit('close')">Đóng</button>
        </div>
      </div>
    </div>
  </div>
</template>
