# HƯỚNG DẪN TRIỂN KHAI & PHÁT HÀNH ĐA THIẾT BỊ: WEB + ANDROID + IOS (LSMVOICE)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG ĐA NỀN TẢNG

Dự án **LsmVoice** đã được nâng cấp toàn diện thành nền tảng đa thiết bị hoạt động đồng bộ trên:
- **Máy tính (Desktop)**: Windows, macOS, Linux (Chrome, Firefox, Safari, Edge).
- **Điện thoại di động (Responsive Web)**: Trình duyệt di động trên Android & iOS (320px – 430px).
- **Máy tính bảng (Tablet)**: Giao diện thích ứng (768px – 1024px).
- **Ứng dụng Native Android**: Đóng gói qua **Capacitor 8**, tương thích Android 7.0 (API 24) đến Android 15/16 (API 36).
- **Ứng dụng Native iOS**: Đóng gói qua **Capacitor 8**, tương thích iOS 14+ trên iPhone và iPad.

Tất cả các nền tảng đều **dùng chung một hệ thống Backend và Cơ sở dữ liệu duy nhất**:
- **Backend API**: Node.js + Express (`https://lsmvoice.onrender.com` hoặc máy chủ tùy chỉnh qua biến môi trường `VITE_API_BASE_URL`).
- **Cơ sở dữ liệu**: Turso Cloud libSQL / SQLite lưu trữ vĩnh viễn dữ liệu người dùng, tiến trình âm thanh, thư viện và nhật ký.
- **Xác thực**: JWT Bearer token được lưu trữ an toàn và đồng bộ tự động giữa các phiên làm việc.

---

## 2. NỀN TẢNG WEB (DESKTOP, TABLET & MOBILE BROWSER)

### 2.1 Cài đặt & Khởi chạy Development
```powershell
# Cài đặt toàn bộ dependencies cho Root, Server và Client
npm run install:all

# Khởi chạy đồng thời cả Backend (port 5000) và Frontend (port 5173)
npm run dev
```

### 2.2 Build Production cho Web
```powershell
# Biên dịch gói Frontend tối ưu hóa vào thư mục client/dist/
npm run client:build
```

### 2.3 Cấu hình URL Backend theo môi trường
Frontend tự động nhận diện môi trường thông qua tệp `client/.env.production`:
```env
VITE_API_BASE_URL=https://lsmvoice.onrender.com
```
- Khi chạy trên trình duyệt Web nội bộ (`localhost:5173`), hệ thống ưu tiên sử dụng proxy reverse `/api`.
- Khi đóng gói ứng dụng di động hoặc chạy trên domain riêng, hệ thống tự động trỏ đến `https://lsmvoice.onrender.com/api`.

---

## 3. NỀN TẢNG ANDROID (SMARTPHONE & TABLET)

### 3.1 Cấu hình môi trường Android
Yêu cầu:
1. **Java Development Kit (JDK)**: JDK 21 hoặc JDK 23 (hỗ trợ `jlink`).
2. **Android SDK**: API level 33 – 36 (đường dẫn: `D:\Android\sdk` hoặc `C:\Users\Admin\AppData\Local\Android\Sdk`).
3. **Android Studio** (tùy chọn nhưng khuyến nghị để phát hành): Ladybug / Koala / Hedgehog trở lên.

### 3.2 Lệnh đồng bộ mã nguồn sang Android
Mỗi khi chỉnh sửa giao diện hoặc mã nguồn trong `client/src`, hãy thực hiện lệnh sau để cập nhật sang thư mục native Android:
```powershell
# Cách 1: Sử dụng lệnh tích hợp tại thư mục gốc
npm run client:sync

# Cách 2: Biên dịch và đồng bộ đầy đủ
npm run client:build
cd client
npx cap sync android
```

### 3.3 Mở dự án trong Android Studio
```powershell
# Mở trực tiếp thư mục android bằng Android Studio
cd client
npx cap open android
```
Hoặc mở thủ công bằng cách chọn thư mục: `d:\Doc Audio\client\android` trong Android Studio.

### 3.4 Tạo file APK cài đặt thử nghiệm (Debug APK)
```powershell
# Chạy trực tiếp bằng Gradle Wrapper (đã được cấu hình tự động)
npm run android:build
```
File APK hoàn chỉnh sẽ được tạo tại:
`client/android/app/build/outputs/apk/debug/app-debug.apk`

Để cài đặt trực tiếp lên điện thoại hoặc máy ảo Android đang kết nối:
```powershell
adb install -r client/android/app/build/outputs/apk/debug/app-debug.apk
```

### 3.5 Tạo Android App Bundle (AAB) để phát hành Google Play Store
Google Play yêu cầu định dạng `.aab` có ký số (Keystore).

#### Bước 1: Tạo khóa ký số (Keystore)
```powershell
keytool -genkey -v -keystore lsmvoice-release.jks -alias lsmvoice -keyalg RSA -keysize 2048 -validity 10000
```

#### Bước 2: Biên dịch file AAB Release
```powershell
npm run android:bundle
```
File AAB phát hành sẽ được tạo tại:
`client/android/app/build/outputs/bundle/release/app-release.aab`

#### Bước 3: Đưa lên Google Play Console
1. Truy cập [Google Play Console](https://play.google.com/console).
2. Tạo ứng dụng mới tên **LsmVoice**.
3. Điền thông tin mô tả, chụp ảnh màn hình từ điện thoại/tablet (sử dụng ảnh mẫu trong thư mục artifact).
4. Tải file `app-release.aab` lên luồng Production (hoặc Internal Testing).
5. Gửi xét duyệt theo quy trình của Google.

---

## 4. NỀN TẢNG IOS (IPHONE & IPAD)

### 4.1 Cấu hình môi trường iOS
*Lưu ý: Để build và ký số cho ứng dụng iOS chính thức, bạn cần máy tính chạy macOS và phần mềm Xcode.*

Yêu cầu:
1. **macOS**: Sonoma (14) hoặc Sequoia (15).
2. **Xcode**: Xcode 15 hoặc 16 với Command Line Tools.
3. **CocoaPods** / **Swift Package Manager**: Đã tích hợp sẵn trong cấu hình `Package.swift` của Capacitor.

### 4.2 Lệnh đồng bộ mã nguồn sang iOS
Từ máy tính của bạn (hoặc sau khi clone mã nguồn sang máy Mac):
```bash
npm run client:build
cd client
npx cap sync ios
```

### 4.3 Mở và chạy trên Xcode
```bash
# Mở Xcode Workspace
npm run ios:open
```
Hoặc mở file `client/ios/App/App.xcworkspace` trực tiếp trong Xcode.

### 4.4 Chạy trên iOS Simulator & Thiết bị thật (iPhone/iPad)
1. Trong Xcode, chọn thiết bị đích ở thanh công cụ trên cùng (ví dụ: `iPhone 16 Pro` hoặc thiết bị thật kết nối qua cáp USB).
2. Nhấn tổ hợp phím **Cmd + R** để biên dịch và chạy thử.
3. Safe Area, Notch tai thỏ, Dynamic Island và thanh điều hướng Home Bar sẽ tự động khớp hoàn hảo nhờ các biến `env(safe-area-inset-*)` đã tích hợp.

### 4.5 Ký số và phát hành lên Apple App Store
1. Đăng ký tài khoản [Apple Developer Program](https://developer.apple.com).
2. Trong Xcode, chọn mục **Signing & Capabilities**:
   - Chọn Team phát triển của bạn.
   - Bundle Identifier: `vn.lsmvoice.app`.
3. Chọn menu **Product > Archive**.
4. Sau khi quá trình Archive hoàn tất, mở cửa sổ **Organizer**, chọn bản build vừa tạo và nhấn **Distribute App**.
5. Chọn **App Store Connect** và tải bản build lên.
6. Vào trang quản trị App Store Connect, hoàn thiện mô tả, chính sách quyền riêng tư (Privacy Policy) và gửi yêu cầu xét duyệt phát hành.

---

## 5. CÁC TÍNH NĂNG NATIVE ĐÃ ĐƯỢC TÍCH HỢP TRÊN DI ĐỘNG

1. **Xử lý nút Back phần cứng (Android)**:
   - Khi có hộp thoại (Modal Đăng nhập, Modal Tải tệp, Modal Lưu trữ) đang mở: bấm Back sẽ đóng hộp thoại.
   - Khi đang ở trang con (`/library`, `/history`, `/settings`): bấm Back sẽ quay lại trang trước (`router.back()`).
   - Khi đang ở trang chủ (`/`): bấm Back sẽ thu nhỏ/thoát ứng dụng an toàn qua `@capacitor/app`.
2. **Đồng bộ Status Bar & Safe Area Inset**:
   - Tự động gán màu nền `#11131D` cho Status Bar trên cả Android & iOS.
   - Tránh hoàn toàn việc giao diện bị lẹm vào phần tai thỏ, Dynamic Island hay thanh gạt Home.
3. **Trình phát âm thanh di động (Persistent Floating Player)**:
   - Gắn cố định đáy màn hình, tự động chừa khoảng đệm an toàn `padding-bottom: calc(115px + env(safe-area-inset-bottom))` để không che khuất nội dung trang.
   - Phát âm thanh trực tiếp từ luồng mạng backend (`https://lsmvoice.onrender.com/audio/...`).
4. **Chia sẻ âm thanh & Tải tệp qua hệ thống**:
   - Tích hợp plugin `@capacitor/share`: cho phép người dùng chia sẻ trực tiếp file âm thanh qua Zalo, Messenger, Email hoặc AirDrop.
   - Hỗ trợ xuất văn bản `.txt` và tải file `.mp3` chất lượng cao.
5. **Không đòi hỏi quyền nhạy cảm**:
   - Ứng dụng chỉ yêu cầu quyền `INTERNET` và `ACCESS_NETWORK_STATE`.
   - Tuyệt đối không yêu cầu Micro, Camera, Danh bạ hay Vị trí vì tính năng chuyển văn bản thành giọng nói không cần thu âm trực tiếp từ phía người dùng.

---

## 6. DANH MỤC LỆNH NHANH (QUICK REFERENCE)

| Thao tác | Lệnh thực thi từ thư mục gốc |
| :--- | :--- |
| Chạy Web Development | `npm run dev` |
| Build Web Production | `npm run client:build` |
| Đồng bộ sang Android & iOS | `npm run client:sync` |
| Tạo APK Android cài thử | `npm run android:build` |
| Mở Android Studio | `npm run android:open` |
| Mở Xcode (trên macOS) | `npm run ios:open` |
| Kiểm thử Backend & DB | `npm test` |
