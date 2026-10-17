<script setup>
import { watch, ref, nextTick } from 'vue';
import { usePlayerStore } from '../stores/playerStore.js';

const playerStore = usePlayerStore();

watch(
  () => playerStore.currentChunkIndex,
  async (newIndex) => {
    await nextTick();
    const el = document.getElementById(`sync-chunk-${newIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
);

const handleChunkClick = (index) => {
  playerStore.playChunk(index);
};
</script>

<template>
  <div v-if="playerStore.chunks && playerStore.chunks.length > 0" class="panel-white p-4">
    <div class="d-flex align-items-center justify-content-between mb-3 pb-2 hairline-border-bottom">
      <div class="d-flex align-items-center gap-2">
        <h3 class="section-title mb-0" style="font-size: 16px;">Văn bản đồng bộ</h3>
        <span class="badge-primary-pill">{{ playerStore.chunks.length }} phân đoạn</span>
      </div>
      <span class="text-muted small" style="font-size: 12.5px;">
        Nhấp chọn đoạn bất kỳ để nhảy tới vị trí phát
      </span>
    </div>

    <!-- Danh sách các đoạn văn bản -->
    <div class="sync-container" style="max-height: 380px; overflow-y: auto;">
      <div class="d-flex flex-column gap-2 pe-1">
        <div
          v-for="(chunk, idx) in playerStore.chunks"
          :key="idx"
          :id="`sync-chunk-${idx}`"
          class="sync-chunk-card transition-all"
          :class="{ active: playerStore.currentChunkIndex === idx }"
          @click="handleChunkClick(idx)"
        >
          <div class="d-flex align-items-baseline gap-2">
            <span class="chunk-index font-monospace flex-shrink-0">
              #{{ idx + 1 }}
            </span>
            <div class="flex-grow-1 chunk-text">
              {{ chunk.text }}
            </div>
            <span
              v-if="playerStore.currentChunkIndex === idx"
              class="badge-primary-pill flex-shrink-0"
              style="font-size: 11px;"
            >
              <i class="bi bi-soundwave me-1"></i> Đang đọc
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sync-chunk-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sync-chunk-card:hover {
  background: var(--surface-soft);
  border-color: #D3DEFD;
}

.sync-chunk-card.active {
  background: #EAF1FF;
  border-color: #B4CEFF;
  box-shadow: 0 2px 10px rgba(66, 133, 244, 0.1);
}

.chunk-index {
  font-size: 11.5px;
  color: var(--text-muted);
  min-width: 28px;
}

.chunk-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

.sync-chunk-card.active .chunk-text {
  color: var(--primary-hover);
  font-weight: 550;
}
</style>
