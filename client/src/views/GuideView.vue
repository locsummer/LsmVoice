<template>
  <div class="container-fluid px-3 px-lg-4 py-4" style="max-width: 960px;">
    <!-- Tiêu đề trang -->
    <div class="panel-white p-4 mb-4">
      <h1 class="page-title mb-1">Hướng dẫn sử dụng LsmVoice</h1>
      <p class="section-desc mb-0">
        Cẩm nang làm chủ nền tảng chuyển đổi văn bản thành giọng nói tiếng Việt chuyên nghiệp, phím tắt và cấu hình nâng cao.
      </p>
    </div>

    <!-- Mục 1: Giới hạn ký tự & Xử lý văn bản -->
    <div class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge-primary-pill">01</span>
        <h2 class="section-title mb-0">Giới hạn 50.000 ký tự & Thuật toán phân đoạn</h2>
      </div>
      <p class="section-desc mb-3">
        Hệ thống được thiết kế chuyên biệt để xử lý văn bản dài lên đến 50.000 ký tự trong một lần nhập, phù hợp cho toàn bộ chương tiểu thuyết, tài liệu nghiên cứu hoặc bài báo.
      </p>
      <div class="d-flex flex-column gap-3 small text-secondary lh-base">
        <div class="p-3 rounded-3" style="background: var(--surface-soft); border: 1px solid var(--border);">
          <strong class="text-main d-block mb-1">Phân đoạn ngữ nghĩa an toàn:</strong>
          Văn bản được tự động chia nhỏ theo ranh giới câu và đoạn văn tiếng Việt mà không làm đứt gãy từ ngữ hoặc ngắt mạch cảm xúc của câu chuyện.
        </div>
        <div class="p-3 rounded-3" style="background: var(--surface-soft); border: 1px solid var(--border);">
          <strong class="text-main d-block mb-1">Tự động lưu bản nháp theo thời gian thực:</strong>
          Trình soạn thảo tự động đồng bộ văn bản vào bộ nhớ trình duyệt, ngăn ngừa nguy cơ mất chữ khi tải lại trang hoặc gián đoạn mạng.
        </div>
        <div class="p-3 rounded-3" style="background: var(--surface-soft); border: 1px solid var(--border);">
          <strong class="text-main d-block mb-1">Thử lại thông minh cho từng phân đoạn:</strong>
          Nếu gặp sự cố kết nối ở một đoạn cụ thể, bạn có thể tái tạo riêng đoạn đó mà không cần phải thực hiện lại toàn bộ văn bản từ đầu.
        </div>
      </div>
    </div>

    <!-- Mục 2: Hệ thống giọng đọc tiếng Việt -->
    <div class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge-violet-pill">02</span>
        <h2 class="section-title mb-0">Hệ thống giọng đọc tiếng Việt</h2>
      </div>
      <p class="section-desc mb-3">
        LsmVoice hỗ trợ các mô hình tổng hợp giọng nói thần kinh (Neural TTS) đa vùng miền và đa nhà cung cấp:
      </p>

      <div class="row g-3">
        <div class="col-md-6">
          <div class="p-3 rounded-3 h-100" style="background: var(--surface-soft); border: 1px solid var(--border);">
            <div class="fw-semibold text-main mb-1">Microsoft Edge Neural (Mặc định)</div>
            <p class="small text-secondary mb-0 lh-base">
              Mô hình AI thần kinh chất lượng cao (Hoài My, Nam Minh). Hoạt động ổn định, phát âm tự nhiên, chuẩn dấu thanh tiếng Việt và hoàn toàn sẵn sàng không cần cấu hình khóa API phức tạp.
            </p>
          </div>
        </div>

        <div class="col-md-6">
          <div class="p-3 rounded-3 h-100" style="background: var(--surface-soft); border: 1px solid var(--border);">
            <div class="fw-semibold text-main mb-1">FPT.AI & Viettel AI</div>
            <p class="small text-secondary mb-0 lh-base">
              Các mô hình giọng đọc chuyên sâu cho 3 miền Bắc, Trung, Nam (Ban Mai, Thu Minh, Lê Minh, Mỹ An). Cần cấu hình khóa API tương ứng trong tệp môi trường của máy chủ.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Mục 3: Phím tắt điều khiển -->
    <div class="panel-white p-4 mb-4">
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge-primary-pill">03</span>
        <h2 class="section-title mb-0">Phím tắt bàn phím</h2>
      </div>
      <p class="section-desc mb-3">
        Điều khiển trình phát âm thanh nhanh chóng trong khi theo dõi văn bản:
      </p>

      <div class="table-responsive rounded-3 overflow-hidden" style="border: 1px solid var(--border);">
        <table class="table align-middle mb-0" style="color: var(--text-primary); background: transparent;">
          <thead style="background: var(--surface-soft);">
            <tr class="hairline-border-bottom">
              <th class="py-2.5 ps-3 control-label" style="width: 35%;">Phím bấm</th>
              <th class="py-2.5 control-label">Thao tác</th>
            </tr>
          </thead>
          <tbody class="small">
            <tr class="hairline-border-bottom">
              <td class="py-2.5 ps-3"><kbd class="px-2 py-1 hairline-border rounded-2" style="background: var(--surface); color: var(--text-primary); font-size: 0.8rem;">Space</kbd></td>
              <td class="py-2.5 text-secondary">Phát hoặc Tạm dừng</td>
            </tr>
            <tr class="hairline-border-bottom">
              <td class="py-2.5 ps-3"><kbd class="px-2 py-1 hairline-border rounded-2" style="background: var(--surface); color: var(--text-primary); font-size: 0.8rem;">←</kbd> / <kbd class="px-2 py-1 hairline-border rounded-2" style="background: var(--surface); color: var(--text-primary); font-size: 0.8rem;">→</kbd></td>
              <td class="py-2.5 text-secondary">Tua lùi hoặc tiến 10 giây</td>
            </tr>
            <tr class="hairline-border-bottom">
              <td class="py-2.5 ps-3"><kbd class="px-2 py-1 hairline-border rounded-2" style="background: var(--surface); color: var(--text-primary); font-size: 0.8rem;">↑</kbd> / <kbd class="px-2 py-1 hairline-border rounded-2" style="background: var(--surface); color: var(--text-primary); font-size: 0.8rem;">↓</kbd></td>
              <td class="py-2.5 text-secondary">Tăng hoặc giảm âm lượng</td>
            </tr>
            <tr>
              <td class="py-2.5 ps-3"><kbd class="px-2 py-1 hairline-border rounded-2" style="background: var(--surface); color: var(--text-primary); font-size: 0.8rem;">M</kbd></td>
              <td class="py-2.5 text-secondary">Bật / Tắt âm thanh (Mute)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mục 4: Cấu hình nhà cung cấp -->
    <div class="panel-white p-4">
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge-violet-pill">04</span>
        <h2 class="section-title mb-0">Cấu hình khóa API nhà cung cấp</h2>
      </div>
      <p class="section-desc mb-3">
        Để kích hoạt giọng đọc từ Azure, FPT.AI hoặc Viettel AI, bổ sung các biến môi trường vào tệp <code>server/.env</code>:
      </p>

      <pre class="p-3 rounded-3 small font-monospace text-main mb-3" style="background: var(--surface-soft); border: 1px solid var(--border); overflow-x: auto;"><code># Microsoft Azure Speech API
AZURE_SPEECH_KEY=your_azure_subscription_key_here
AZURE_SPEECH_REGION=southeastasia

# FPT.AI Text to Speech
FPT_AI_API_KEY=your_fpt_ai_api_key_here

# Viettel AI Speech API
VIETTEL_AI_TOKEN=your_viettel_ai_token_here</code></pre>

      <div class="small text-muted d-flex align-items-center gap-1">
        <i class="bi bi-shield-lock text-primary"></i>
        <span>Lưu ý: Tất cả khóa API đều được lưu trữ an toàn tại backend và không bao giờ chuyển tiếp tới client trình duyệt.</span>
      </div>
    </div>
  </div>
</template>
