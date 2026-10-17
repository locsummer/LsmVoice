# LsmVoice – Nền Tảng Đọc Văn Bản Thành Giọng Nói Tiếng Việt Chuyên Nghiệp

![LsmVoice Banner](https://img.shields.io/badge/LsmVoice-TTS%20Vietnamese-2563eb?style=for-the-badge&logo=soundcharts&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-v22-green?style=flat-square)
![Vue 3](https://img.shields.io/badge/Vue-3.5-brightgreen?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-6.1-purple?style=flat-square)
![SQLite](https://img.shields.io/badge/SQLite-Database-blue?style=flat-square)
![Bootstrap 5](https://img.shields.io/badge/Bootstrap-5.3-violet?style=flat-square)

**LsmVoice** là nền tảng web chuyên nghiệp chuyển đổi văn bản dài thành audio giọng đọc tiếng Việt chuẩn ba miền (Bắc, Trung, Nam), tích hợp công nghệ trí tuệ nhân tạo thần kinh (Neural TTS). Hệ thống được thiết kế tối ưu cho nhu cầu đọc truyện dài, tiểu thuyết, sách nói, tin tức báo chí và tài liệu văn phòng với giới hạn lên đến **50.000 ký tự** cho mỗi tác phẩm.

---

## 🌟 Tính Năng Nổi Bật

### 1. Giới hạn 50.000 ký tự & Phân đoạn thông minh (Smart Chunking)
- **Bộ đếm thời gian thực:** Hiển thị `12.500 / 50.000 ký tự` kèm thanh tiến trình trực quan đổi màu.
- **Bảo vệ ngữ nghĩa câu:** Thuật toán phân đoạn tự động nhận biết đoạn văn, câu kết thúc bằng `.` `?` `!` `…` và hội thoại `—`, tuyệt đối không bao giờ ngắt giữa một từ ngữ hoặc làm mất dấu câu.
- **Tự động lưu nháp (Auto-Save Draft):** Tự động lưu nội dung vào `LocalStorage`, không lo mất văn bản khi vô tình tải lại trang hoặc mất mạng.
- **Trích xuất tệp tài liệu:** Hỗ trợ tải tệp `.txt`, `.docx` (qua Mammoth) và `.pdf` (qua PDF-Parse) kèm cảnh báo nhận diện file scan ảnh.

### 2. Hệ thống giọng đọc tiếng Việt đa dạng
- **Đa vùng miền & giới tính:** Hỗ trợ giọng Nam miền Bắc, Nữ miền Bắc, Nam miền Nam, Nữ miền Nam, Nam/Nữ miền Trung.
- **Chất giọng Neural tự nhiên:** Phát âm tiếng Việt chuẩn xác, rõ dấu thanh (ngang, huyền, sắc, hỏi, ngã, nặng), ngắt nghỉ theo dấu phẩy và chấm.
- **Nghe thử (Preview):** Mỗi giọng đọc đều có thẻ đại diện, thông tin vùng miền, mô tả ngắn và nút nghe thử trực tiếp.
- **Tùy biến tham số âm thanh:** Tinh chỉnh Tốc độ đọc (0.5x – 2.0x), Cao độ giọng (Pitch: -20Hz đến +20Hz) và Âm lượng (0% – 100%).

### 3. Hỗ trợ đa nhà cung cấp TTS (Multi-Provider Architecture)
- **Microsoft Edge Neural TTS (Mặc định):** Giọng đọc thần kinh tự nhiên chuẩn Microsoft (Hoài My, Nam Minh, Đà Lạt), **hoạt động ngay lập tức 100% miễn phí** mà không yêu cầu đăng ký API Key trả phí!
- **Microsoft Azure Speech:** Kết nối trực tiếp dịch vụ Azure Cognitive Services Speech qua SSML và REST API.
- **FPT.AI Voice:** Tích hợp API nền tảng FPT.AI (Ban Mai, Lê Minh, Thu Minh, Mỹ An, Gia Huy).
- **Viettel AI:** Tích hợp API Viettel AI Voice với đầy đủ các giọng đọc thương mại.
- **Chế độ Demo Synthesizer:** Bộ sinh âm thanh nội bộ phục vụ kiểm thử kỹ thuật và quy trình.

### 4. Quản lý tác vụ dài & Hàng đợi bất đồng bộ (Job Queue)
- Xử lý các đoạn văn bản theo mức độ đồng thời an toàn (`CONCURRENT_CHUNK_LIMIT = 2`) để tránh vượt hạn mức tốc độ (Rate Limit).
- Theo dõi trạng thái từng đoạn: *Đang chờ*, *Đang tạo*, *Thành công*, *Thất bại*.
- **Thử lại cục bộ (Chunk Retry):** Nếu một đoạn bị lỗi kết nối, chỉ cần bấm nút "Thử lại" đoạn đó mà không cần tạo lại các đoạn đã hoàn tất.
- **Hủy tác vụ an toàn:** Hỗ trợ hủy tiến trình tạo audio bất cứ lúc nào.
- **Ghép nối âm thanh:** Tự động hợp nhất các đoạn MP3 thành một file audio liền mạch hoàn chỉnh.

### 5. Trình phát Audio chuyên nghiệp (HTML5 Audio Player)
- Gắn cố định chân trang (Sticky Persistent Player) hoạt động xuyên suốt khi duyệt qua Thư viện, Lịch sử hay Cài đặt.
- **Thanh tua chính xác:** Hỗ trợ HTTP 206 Partial Content cho phép kéo tua mượt mà không bị gián đoạn.
- **Điều khiển tiện lợi:** Phát/Tạm dừng, Tua lùi 10s, Tua tới 10s, Chuyển đoạn trước/kế tiếp, Lặp lại (tắt / lặp 1 bài / lặp toàn bộ).
- **Phím tắt bàn phím tiện ích:**
  - `Space`: Phát / Tạm dừng
  - `←` / `→`: Tua -10 giây / +10 giây
  - `↑` / `↓`: Tăng / Giảm âm lượng
  - `M`: Bật / Tắt tiếng (Mute)
- **Lưu vị trí nghe (Resume Bookmark):** Tự động ghi nhớ thời gian nghe gần nhất để tiếp tục phát lại chính xác vị trí đang nghe dở.

### 6. Đồng bộ văn bản với giọng đọc (Text-Audio Sync)
- Hiển thị danh sách các đoạn văn bản tương ứng với audio.
- Tự động đánh dấu (highlight) đoạn văn đang được đọc và cuộn mượt mà đến vị trí tương ứng.
- Cho phép nhấp chuột vào bất kỳ đoạn văn bản nào để nhảy audio đến phát ngay đoạn đó.

### 7. Thư viện nội dung cá nhân & Lịch sử nghe
- Quản lý danh sách tác phẩm theo thể loại, ngày tạo, số ký tự hoặc thời điểm nghe gần nhất.
- Hoạt động linh hoạt ở cả **Chế độ Khách (Guest Mode qua LocalStorage)** lẫn **Tài khoản người dùng (SQLite DB + JWT + bcrypt)**.
- Thống kê tổng số lượt nghe, thời lượng đã nghe và số tác phẩm đã hoàn thành.

### 8. Xuất bản & Tải xuống audio
- Tải file MP3 hoàn chỉnh hợp nhất toàn bộ nội dung.
- Tải riêng từng đoạn MP3 lẻ.
- Xuất văn bản gốc thành file `.txt`.

---

## 🏗️ Cấu Trúc Dự Án

```
d:\Doc Audio\
├── client/                     # Frontend Vue 3 + Vite
│   ├── public/
│   │   └── favicon.svg         # Icon ứng dụng
│   ├── src/
│   │   ├── assets/
│   │   │   └── styles.css      # Hệ thống CSS Light/Dark theme & giao diện
│   │   ├── components/
│   │   │   ├── Navbar.vue           # Thanh điều hướng trên cùng
│   │   │   ├── TextInputArea.vue    # Khung nhập văn bản, đếm 50k, tải file
│   │   │   ├── TextToolsModal.vue   # Công cụ chuẩn hóa chữ, xóa khoảng trắng, tìm/thay thế
│   │   │   ├── VoiceSelector.vue    # Bộ chọn giọng tiếng Việt & tham số tốc độ/cao độ
│   │   │   ├── JobProgressModal.vue # Theo dõi tiến trình tạo đoạn audio & thử lại
│   │   │   ├── AudioPlayer.vue      # Trình phát audio chuyên nghiệp chân trang
│   │   │   ├── SyncTextDisplay.vue  # Đồng bộ bôi đen văn bản theo giọng đọc
│   │   │   ├── AudioExporter.vue    # Cửa sổ tải xuống MP3/TXT
│   │   │   ├── AuthModal.vue        # Cửa sổ đăng nhập / đăng ký
│   │   │   └── ToastNotification.vue# Hệ thống thông báo nổi tiếng Việt
│   │   ├── router/
│   │   │   └── index.js             # Bộ định tuyến Vue Router
│   │   ├── services/
│   │   │   └── api.js               # Axios API Client & LocalStorage Guest Fallback
│   │   ├── stores/
│   │   │   ├── authStore.js         # Quản lý phiên đăng nhập & JWT
│   │   │   ├── ttsStore.js          # Quản lý văn bản 50k, danh sách giọng, tiến trình job
│   │   │   ├── playerStore.js       # Quản lý HTML5 Audio, seek, playlist, phím tắt
│   │   │   ├── libraryStore.js      # Thư viện tác phẩm cá nhân
│   │   │   ├── historyStore.js      # Lịch sử nghe & đánh dấu bookmark
│   │   │   └── themeStore.js        # Giao diện Sáng / Tối (Light / Dark)
│   │   ├── views/
│   │   │   ├── StudioView.vue       # Phòng thu chính chuyển văn bản
│   │   │   ├── LibraryView.vue      # Quản lý thư viện tác phẩm
│   │   │   ├── HistoryView.vue      # Xem lịch sử nghe & thống kê
│   │   │   ├── GuideView.vue        # Hướng dẫn sử dụng & phím tắt
│   │   │   └── SettingsView.vue     # Cài đặt hệ thống & hồ sơ
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend Node.js Express + SQLite
│   ├── src/
│   │   ├── config/
│   │   │   └── constants.js    # Giới hạn hệ thống & danh mục giọng tiếng Việt chuẩn
│   │   ├── controllers/
│   │   │   ├── authController.js    # Đăng ký, đăng nhập, JWT bcrypt
│   │   │   ├── ttsController.js     # Danh sách giọng, preview, job queue, streaming 206
│   │   │   ├── libraryController.js # CRUD thư viện cá nhân
│   │   │   ├── historyController.js # Ghi nhận lịch sử nghe & bookmark
│   │   │   └── uploadController.js  # Xử lý trích xuất tệp TXT, DOCX, PDF
│   │   ├── db/
│   │   │   └── database.js     # Kết nối SQLite & Tự động tạo bảng
│   │   ├── middleware/
│   │   │   └── authMiddleware.js # Kiểm tra quyền JWT (bắt buộc / tùy chọn)
│   │   ├── routes/
│   │   │   └── api.js          # Khai báo tuyến đường API
│   │   ├── services/
│   │   │   ├── audioService.js      # Ghép file MP3/WAV & tự động dọn dẹp file tạm
│   │   │   ├── chunkService.js      # Thuật toán ngắt đoạn văn bản theo câu & dấu câu
│   │   │   ├── fileParserService.js # Trích xuất văn bản từ TXT, DOCX, PDF
│   │   │   ├── jobService.js        # Quản lý hàng đợi tạo audio & retry
│   │   │   ├── ttsService.js        # Lớp điều phối đa nhà cung cấp TTS
│   │   │   └── providers/
│   │   │       ├── baseProvider.js    # Giao diện chuẩn cho TTS Provider
│   │   │       ├── edgeProvider.js    # Microsoft Edge Neural TTS (Hoài My, Nam Minh)
│   │   │       ├── azureProvider.js   # Microsoft Azure Cognitive Speech REST API
│   │   │       ├── fptProvider.js     # FPT.AI Voice API v5
│   │   │       ├── viettelProvider.js # Viettel AI Voice API
│   │   │       └── demoProvider.js    # Demo Synthesizer kiểm thử
│   │   └── index.js            # Khởi động máy chủ Express, CORS, Rate Limit
│   ├── storage/
│   │   ├── audio/              # Thư mục lưu trữ file audio tạo ra
│   │   ├── uploads/            # Thư mục lưu tệp tải lên tạm thời
│   │   └── lsmvoice.sqlite     # Cơ sở dữ liệu SQLite
│   ├── test/
│   │   ├── chunkService.test.js    # Kiểm thử giới hạn 50k & chia đoạn
│   │   ├── ttsAndJob.test.js       # Kiểm thử giọng đọc, preview, job queue
│   │   ├── authAndLibrary.test.js  # Kiểm thử xác thực, bảo mật phân quyền
│   │   └── runAll.js               # Bộ chạy toàn bộ kiểm thử
│   ├── .env.example
│   ├── .env
│   └── package.json
│
├── package.json                # Monorepo runner điều khiển cả Frontend & Backend
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Trên Windows

### 1. Yêu cầu hệ thống
- Hệ điều hành: Windows 10 / 11 (hoặc Linux / macOS).
- **Node.js**: Phiên bản 18+ (khuyên dùng Node.js 20 hoặc 22 LTS).
- **npm**: Đi kèm theo Node.js.

### 2. Cài đặt các gói phụ thuộc
Mở PowerShell hoặc Command Prompt tại thư mục dự án `d:\Doc Audio`:

```powershell
# Cài đặt tự động toàn bộ dependencies cho Root, Backend và Frontend
npm run install:all
```

*(Hoặc cài đặt thủ công từng phần nếu muốn: `npm install`, sau đó vào `server` chạy `npm install`, vào `client` chạy `npm install`)*.

### 3. Cấu hình biến môi trường
Tệp `server/.env` đã được tạo sẵn với cấu hình mặc định tối ưu:

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=lsmvoice_jwt_secret_dev_key_change_in_production_998877

MAX_TEXT_LENGTH=50000
CHUNK_SIZE_LIMIT=1200
CONCURRENT_CHUNK_LIMIT=2
DEFAULT_TTS_PROVIDER=edge

# Microsoft Azure Speech API (tùy chọn)
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=southeastasia

# FPT.AI Voice API (tùy chọn)
FPT_AI_API_KEY=

# Viettel AI Voice API (tùy chọn)
VIETTEL_AI_TOKEN=

CLEANUP_TEMP_FILES_HOURS=24
```

> **Ghi chú quan trọng:** Với cấu hình mặc định `DEFAULT_TTS_PROVIDER=edge`, bạn có thể **sử dụng ngay lập tức mà không cần bất kỳ API key nào**. Hệ thống sẽ tự động phát giọng đọc tiếng Việt thần kinh cực kỳ tự nhiên của Hoài My và Nam Minh!

### 4. Khởi chạy ứng dụng (Chế độ phát triển)
Chỉ cần chạy lệnh sau tại thư mục gốc:

```powershell
npm run dev
```

Lệnh này sẽ khởi động song song cả 2 dịch vụ:
- **Backend API:** `http://localhost:5000`
- **Frontend Web UI:** `http://localhost:5173`

Mở trình duyệt web và truy cập vào **`http://localhost:5173`** để bắt đầu trải nghiệm LsmVoice!

---

## 🔑 Hướng Dẫn Lấy API Key Cho Các Nhà Cung Cấp

Nếu bạn muốn kết nối thêm các nhà cung cấp thương mại khác:

### 1. Microsoft Azure Speech
1. Truy cập [Azure Portal](https://portal.azure.com/) và tạo dịch vụ **Speech Services**.
2. Chọn gói **F0 (Free)** để nhận 0.5 triệu ký tự miễn phí mỗi tháng.
3. Lấy `Key 1` và `Region` (ví dụ `southeastasia`).
4. Điền vào `server/.env`:
   ```env
   AZURE_SPEECH_KEY=khoa_azure_cua_ban
   AZURE_SPEECH_REGION=southeastasia
   ```

### 2. FPT.AI Text to Speech
1. Đăng ký tài khoản tại [FPT.AI Console](https://console.fpt.ai/).
2. Tạo ứng dụng mới và bật dịch vụ **Text to Speech v5**.
3. Sao chép API Key và dán vào `server/.env`:
   ```env
   FPT_AI_API_KEY=khoa_fpt_cua_ban
   ```

### 3. Viettel AI
1. Đăng ký tài khoản tại [Viettel AI Open Platform](https://viettelgroup.ai/).
2. Tạo API Token cho dịch vụ tổng hợp giọng nói.
3. Điền vào `server/.env`:
   ```env
   VIETTEL_AI_TOKEN=token_viettel_cua_ban
   ```

---

## 🧪 Chạy Kiểm Thử Tự Động (Automated Testing)

Dự án đi kèm bộ kiểm thử tự động toàn diện bao quát 12 trường hợp kiểm thử cốt lõi (giới hạn 50.000 ký tự, dấu tiếng Việt, phân đoạn thông minh, hàng đợi job, hủy job, mã hóa bcrypt và phân quyền cách ly dữ liệu):

```powershell
npm test
```

Kết quả mong đợi:
```
# tests 12
# suites 3
# pass 12
# fail 0
```

---

## 🚢 Triển Khai Lên Máy Chủ Production

### Bước 1: Build mã nguồn Frontend
```powershell
cd client
npm run build
```
Thư mục `client/dist` sẽ chứa toàn bộ tài nguyên web tĩnh đã được tối ưu nén gzip.

### Bước 2: Thiết lập môi trường Production cho Backend
Trong tệp `server/.env`:
```env
NODE_ENV=production
PORT=5000
```
Khi đặt `NODE_ENV=production`, máy chủ Express sẽ tự động phục vụ trực tiếp các file tĩnh từ `client/dist` và điều hướng URL Single Page Application (SPA).

### Bước 3: Chạy tiến trình nền với PM2
```powershell
npm install -g pm2
cd server
pm2 start src/index.js --name "lsmvoice"
pm2 save
pm2 startup
```

---

## 🛠️ Xử Lý Các Sự Cố Thường Gặp (Troubleshooting)

| Sự cố | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Cổng 5000 bị chiếm dụng** | Một tiến trình khác đang dùng cổng 5000 | Đổi `PORT=5001` trong `server/.env` và cập nhật cổng tương ứng trong `client/vite.config.js`. |
| **Không nghe thấy tiếng khi bấm Nghe thử** | Âm lượng hệ thống tắt hoặc trình duyệt chặn âm thanh tự động | Kiểm tra thanh âm lượng trên máy tính và biểu tượng loa trên tab trình duyệt. |
| **Lỗi 401 khi dùng Azure / FPT** | API Key sai hoặc hết hạn mức | Kiểm tra lại khóa trong `server/.env` hoặc chuyển về dịch vụ Edge Neural miễn phí. |
| **Tệp PDF không trích xuất được chữ** | Tệp PDF là bản scan dạng ảnh chụp | Phần mềm sẽ hiển thị cảnh báo; vui lòng sao chép văn bản dạng chữ hoặc dùng tài liệu có lớp chữ (text layer). |
| **Văn bản vượt quá 50.000 ký tự** | Độ dài nội dung vượt mức cho phép | Hệ thống sẽ tự động cắt bớt về 50.000 ký tự hoặc chia bài viết thành các chương nhỏ hơn. |

---

## 📜 Bản Quyền & Giấy Phép
Dự án được phát triển theo giấy phép **MIT License**. Bạn hoàn toàn có thể tự do mở rộng, tùy biến và tích hợp vào các hệ thống sách nói, truyện audio của riêng mình.
