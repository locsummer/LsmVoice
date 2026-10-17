<script setup>
import { ref } from 'vue';

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['apply-changes', 'close']);

const findText = ref('');
const replaceText = ref('');
const replaceCount = ref(0);
const historyStack = ref([]);

const currentWorkingText = ref(props.text);

const pushHistory = () => {
  historyStack.value.push(currentWorkingText.value);
};

const handleUndo = () => {
  if (historyStack.value.length > 0) {
    currentWorkingText.value = historyStack.value.pop();
  }
};

const cleanExtraSpaces = () => {
  pushHistory();
  const cleaned = currentWorkingText.value
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
  currentWorkingText.value = cleaned;
};

const normalizeLineBreaks = () => {
  pushHistory();
  const normalized = currentWorkingText.value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  currentWorkingText.value = normalized;
};

const splitLongParagraphs = () => {
  pushHistory();
  const paragraphs = currentWorkingText.value.split(/\n+/);
  const result = [];

  for (const p of paragraphs) {
    if (p.length > 600) {
      const sentences = p.match(/[^.?!…]+[.?!…]+["']?/g);
      if (sentences && sentences.length > 1) {
        let currentP = '';
        for (const s of sentences) {
          if (currentP.length + s.length > 400) {
            if (currentP) result.push(currentP.trim());
            currentP = s;
          } else {
            currentP += (currentP ? ' ' : '') + s;
          }
        }
        if (currentP) result.push(currentP.trim());
      } else {
        result.push(p);
      }
    } else {
      result.push(p);
    }
  }

  currentWorkingText.value = result.join('\n\n');
};

const fixPunctuation = () => {
  pushHistory();
  let fixed = currentWorkingText.value
    .replace(/\s+([,.:;!?])/g, '$1')
    .replace(/([,.:;!?])([A-Za-zÀ-ỹ0-9])/g, '$1 $2')
    .replace(/\.{3,}/g, '…')
    .replace(/^[-\u2013]\s*/gm, '— ');

  currentWorkingText.value = fixed;
};

const handleFindAndReplace = () => {
  if (!findText.value) return;
  pushHistory();
  const regex = new RegExp(escapeRegex(findText.value), 'g');
  const matches = currentWorkingText.value.match(regex);
  replaceCount.value = matches ? matches.length : 0;
  currentWorkingText.value = currentWorkingText.value.replace(regex, replaceText.value);
};

const removeBrackets = () => {
  pushHistory();
  const withoutNotes = currentWorkingText.value
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  currentWorkingText.value = withoutNotes;
};

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const applyAndClose = () => {
  emit('apply-changes', currentWorkingText.value);
};
</script>

<template>
  <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(32, 34, 56, 0.45); backdrop-filter: blur(4px); z-index: 1060;">
    <div class="modal-dialog modal-dialog-centered" style="max-width: 660px;">
      <div class="modal-content modal-content-clean p-2">
        <div class="modal-header hairline-border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
          <h5 class="section-title mb-0" style="font-size: 16px;">
            Công cụ chuẩn hóa văn bản
          </h5>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body p-4">
          <!-- Các nút thao tác nhanh -->
          <div class="mb-4">
            <div class="control-label mb-2">Thao tác nhanh</div>
            <div class="d-flex flex-wrap gap-2">
              <button type="button" class="btn-secondary-action" style="height: 38px; padding: 0 14px; font-size: 13px;" @click="cleanExtraSpaces">
                Xóa khoảng trắng thừa
              </button>
              <button type="button" class="btn-secondary-action" style="height: 38px; padding: 0 14px; font-size: 13px;" @click="normalizeLineBreaks">
                Chuẩn hóa xuống dòng
              </button>
              <button type="button" class="btn-secondary-action" style="height: 38px; padding: 0 14px; font-size: 13px;" @click="splitLongParagraphs">
                Tách đoạn dài
              </button>
              <button type="button" class="btn-secondary-action" style="height: 38px; padding: 0 14px; font-size: 13px;" @click="fixPunctuation">
                Sửa dấu câu
              </button>
              <button type="button" class="btn-secondary-action" style="height: 38px; padding: 0 14px; font-size: 13px;" @click="removeBrackets">
                Bỏ chú thích () []
              </button>
              <button
                type="button"
                class="btn-ghost-action"
                style="height: 38px;"
                :disabled="historyStack.length === 0"
                @click="handleUndo"
              >
                <i class="bi bi-arrow-counterclockwise"></i>
                <span>Hoàn tác ({{ historyStack.length }})</span>
              </button>
            </div>
          </div>

          <!-- Tìm kiếm và Thay thế -->
          <div class="panel-sub p-3 mb-4 rounded-3">
            <div class="control-label mb-2">Tìm kiếm & Thay thế</div>
            <div class="row g-2 align-items-center">
              <div class="col-md-5">
                <input
                  v-model="findText"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Từ cần tìm..."
                />
              </div>
              <div class="col-md-5">
                <input
                  v-model="replaceText"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Thay bằng từ mới..."
                />
              </div>
              <div class="col-md-2">
                <button
                  type="button"
                  class="btn-primary-action w-100"
                  style="height: 38px; font-size: 13px;"
                  :disabled="!findText"
                  @click="handleFindAndReplace"
                >
                  Thay thế
                </button>
              </div>
            </div>
            <div v-if="replaceCount > 0" class="small mt-2" style="color: var(--success);">
              Đã thay thế {{ replaceCount }} vị trí.
            </div>
          </div>

          <!-- Xem trước -->
          <div>
            <div class="d-flex justify-content-between align-items-center mb-1 text-muted small">
              <span>Xem trước kết quả</span>
              <span>{{ currentWorkingText.length.toLocaleString('vi-VN') }} ký tự</span>
            </div>
            <textarea
              v-model="currentWorkingText"
              class="form-control font-monospace"
              style="height: 140px; font-size: 13px; line-height: 1.5;"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer hairline-border-top px-4 py-3 d-flex justify-content-end gap-2">
          <button type="button" class="btn-secondary-action" style="height: 40px; padding: 0 16px;" @click="emit('close')">Hủy</button>
          <button type="button" class="btn-primary-action" style="height: 40px; padding: 0 20px;" @click="applyAndClose">
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
