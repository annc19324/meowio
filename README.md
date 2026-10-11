# 🐱 Meow.io - Multiplayer Casual Action Game

> **Đồ án EPU**: Game multiplayer thời gian thực chủ đề loài mèo, thu thập ánh sáng và đại chiến cào móng vuốt.

---

## 🌟 1. Điểm nổi bật & Gameplay

- **2 Chế độ chơi ngay ở Menu**:
  - 🌐 **ONLINE**: Đấu mạng thời gian thực với người chơi và bot qua Socket.io.
  - 🤖 **OFFLINE**: Chơi cục bộ trên máy với Bot, **Ping 0ms, không cần kết nối mạng**.
- **Tối ưu hóa siêu mượt (Zero-Lag 60-120 FPS)**:
  - Loại bỏ các bộ lọc `shadowBlur` tốn CPU, chuyển sang kỹ thuật vẽ glow đa tầng siêu tốc.
  - Phân mảnh không gian dạng lưới (**Spatial Partitioning Grid 600x600**).
  - Thuật toán **Area-of-Interest (AoI)**: Chỉ gửi dữ liệu trong tầm nhìn người chơi.
  - Chuẩn hóa mạng 20 Ticks/giây và dữ liệu thức ăn dạng mảng nén siêu nhẹ.
- **Tự động nhận diện Web & App**:
  - Khi chơi trên **Web**: Xuất hiện nút **"📱 Tải App Android (.APK)"**.
  - Khi chơi trong **Android App**: Nút tải app **tự động biến mất hoàn toàn**.
- **Bản đồ khổng lồ 10.000 x 10.000 px** đi kèm **Radar Minimap 🗺️** hiển thị vị trí bản thân và Boss Top 1.
- **Cơ chế Cào móng vuốt 🐾**, Tăng tốc Stamina ⚡, Hộp Pate 🥫, Xúc xắc Dice 🎲 và Shop Skin.

---

## 🚀 2. Chạy thử trên máy cục bộ (Localhost)

```bash
cd d:\doan_EPU\Meow
npm start
```
Mở trình duyệt truy cập: 👉 **`http://localhost:3000`**

---

## ☁️ 3. Hướng dẫn Triển khai (Deploy)

### A. Triển khai Backend lên Render.com (Khuyên dùng)
Dự án đã có sẵn file cấu hình [`render.yaml`](file:///d:/doan_EPU/Meow/render.yaml):
1. Đẩy code lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy Meow.io"
   git push origin main
   ```
2. Đăng nhập [Render.com](https://render.com) -> Chọn **New Web Service** -> Chọn Repo GitHub của bạn.
3. Thiết lập:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Nhấn **Deploy**! Render sẽ cấp cho bạn một domain HTTPS miễn phí (ví dụ: `https://meow-io.onrender.com`).

---

### B. Triển khai Frontend lên Vercel
Dự án đã có sẵn file cấu hình [`vercel.json`](file:///d:/doan_EPU/Meow/vercel.json):
1. Cài đặt Vercel CLI (hoặc import repo vào Vercel Dashboard):
   ```bash
   npm i -g vercel
   vercel
   ```
2. Nếu deploy Frontend trên Vercel còn Backend chạy trên Render:
   - Trong file `public/index.html`, bạn có thể thêm biến cấu hình trước thẻ script:
     ```html
     <script>window.MEOW_SERVER_URL = "https://your-backend.onrender.com";</script>
     ```

---

## 📱 4. Mở và Build App bằng Android Studio

Dự án đã có sẵn thư mục [`android/`](file:///d:/doan_EPU/Meow/android):
1. Mở **Android Studio**.
2. Chọn **Open** -> Chọn đường dẫn thư mục: `d:\doan_EPU\Meow\android`.
3. Đợi Android Studio đồng bộ Gradle xong (khoảng 1-2 phút).
4. Mở file [`MainActivity.java`](file:///d:/doan_EPU/Meow/android/app/src/main/java/com/epu/meowio/MainActivity.java):
   - Đổi `GAME_URL = "https://your-domain.onrender.com";` (hoặc giữ `http://10.0.2.2:3000` nếu đang test máy ảo Android Emulator trên PC).
5. Nhấn menu **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
6. Android Studio sẽ xuất ra file `app-debug.apk` để bạn cài vào bất kỳ điện thoại Android nào!
   - Ứng dụng chạy mượt mà toàn màn hình (Fullscreen Immersive), tự ẩn thanh trạng thái và tự động ẩn nút "Tải App".
