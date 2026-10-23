# Web Game Bài 3D FPS — Tiến Lên Miền Nam (Cartoon Edition)

Game bài 3D phong cách hoạt hình (stylized cartoon) chạy trực tiếp trên trình duyệt web với góc nhìn thứ nhất (First-Person View / FPS). Hệ thống multiplayer hỗ trợ 2–4 người chơi mỗi bàn với luật chơi Tiến Lên Miền Nam đếm lá tiêu chuẩn.

---

## 🌟 Tính năng nổi bật

- **Góc nhìn thứ nhất (FPS Camera)**: Ngồi tại bàn chơi, camera lia nhẹ tự nhiên theo chuyển động chuột (mouse parallax).
- **Đồ họa Cartoon 3D Stylized**: Bàn gỗ bo tròn, mặt nỉ xanh ngọc bích, ánh sáng mềm mại, đổ bóng chân thực tối ưu WebGL.
- **Tự sinh Texture bài (Zero-asset dependency)**: Toàn bộ 52 lá bài hoạt hình và mặt lưng hoa văn hoàng gia được vẽ tự động bằng Canvas API với độ nét cao, không phụ thuộc vào ảnh tĩnh bên ngoài.
- **Hiệu ứng mượt mà (GSAP)**: Bài xòe hình quạt (fan-out), chia bài bay từ cọc về tay, đánh bài lướt ra giữa bàn, thu bài khi hết vòng.
- **Tương tác trực quan**: Bấm chọn bài nhô lên mượt mà, tự động lọc tổ hợp hợp lệ để kích hoạt nút "Đánh bài".
- **Server-Authoritative Realtime**: Toàn bộ luật chơi, chia bài, kiểm tra vòng lượt và bảo vệ bài riêng tư được quản lý tại backend Cloudflare Durable Objects.
- **Cơ chế chống treo bàn (Turn Timeout 15s)**: Tự động đếm ngược 15 giây mỗi lượt; nếu người chơi AFK hoặc mất mạng, hệ thống tự động Bỏ lượt hoặc đánh quân bài nhỏ nhất hợp lệ thông qua Durable Objects Alarms API.
- **Âm thanh Synthesizer độc quyền**: Toàn bộ âm thanh chia bài, đặt bài, chuông hết giờ, fanfare chiến thắng được tạo trực tiếp bằng Web Audio API, tích hợp bảng cài đặt âm lượng và bật/tắt BGM/SFX.
- **Chi phí triển khai 0đ**: Tận dụng Free Tier của Vercel (Frontend) và Cloudflare Workers + WebSocket Hibernation (Backend).

---

## 🏗️ Cấu trúc Monorepo

```text
web-game-bai-3d/
├── apps/
│   ├── client/                  # Frontend WebGL App (Vite, Three.js, GSAP, HTML/CSS)
│   │   ├── src/
│   │   │   ├── audio/           # SoundEffects Web Audio procedural synthesizer
│   │   │   ├── game3d/          # Scene, FPSCamera, Table, CardMesh, HandManager
│   │   │   ├── network/         # WebSocket client
│   │   │   ├── ui/              # UIManager, screens, HUD, scoreboard, settings
│   │   │   └── main.ts
│   │   └── index.html
│   └── server/                  # Backend Cloudflare Workers & Durable Objects
│       ├── src/
│       │   ├── game/            # Deck, Combinations, Compare, TienLenRule
│       │   ├── lobby/           # LobbyDO (quản lý danh sách phòng, quick join)
│       │   ├── room/            # RoomDO (WebSocket hibernation, turn alarm)
│       │   └── index.ts         # Worker router
│       ├── tests/               # Bộ Unit Test Vitest cho toàn bộ luật chơi
│       └── wrangler.toml        # Cấu hình Cloudflare Durable Objects
├── packages/
│   └── shared/                  # Thư viện dùng chung giữa Client & Server
│       └── src/
│           ├── cards.ts         # Khởi tạo card, suit, rank, weight
│           ├── protocol.ts      # Toàn bộ danh mục gói tin WebSocket
│           └── types.ts         # Models, Snapshot, Scoreboard, RoomSummary
├── package.json
└── tsconfig.base.json
```

---

## 🚀 Hướng dẫn cài đặt và chạy thử nghiệm

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Chạy Kiểm Thử (Unit Tests)
Kiểm tra toàn bộ 25 bài test cho luật chơi Tiến Lên Miền Nam, xáo bài, nhận diện tổ hợp, chặt Heo/Hàng và tính điểm thối:
```bash
npm run test
```

### 3. Kiểm tra kiểu dữ liệu (Typecheck)
```bash
npm run typecheck
```

### 4. Build sản phẩm (Production Build)
```bash
npm run build
```

### 5. Chạy ứng dụng cục bộ (Local Dev)
- **Chạy Frontend (Client)**:
```bash
npm run dev:client
```
Truy cập `http://localhost:3000` trên trình duyệt.

- **Chạy Backend (Cloudflare Worker)**:
```bash
npm run dev:server
```
Backend lắng nghe tại `http://localhost:8787`.

---

## ☁️ Hướng dẫn triển khai (Deployment)

### 1. Frontend lên Vercel
1. Kết nối repository GitHub với Vercel.
2. Cấu hình dự án:
   - **Root Directory**: `apps/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Deploy!

### 2. Backend lên Cloudflare Workers
1. Đăng nhập tài khoản Cloudflare:
```bash
npx wrangler login
```
2. Deploy backend và Durable Objects:
```bash
cd apps/server
npx wrangler deploy
```
3. Lấy URL được cấp (vd: `web-game-bai-3d-server.<subdomain>.workers.dev`) và cấu hình vào Frontend.

---

## 📜 Quy tắc luật chơi (TLMN Đếm Lá)

1. **Thứ tự độ lớn**: `3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2` (quân 2 lớn nhất).
2. **Thứ tự chất**: `Bích (♠) < Chuồn (♣) < Rô (♦) < Cơ (♥)`.
3. **Nước đi đầu tiên**: Bắt buộc phải chứa `3 Bích (3♠)` trong ván đầu tiên. Ván sau người về Nhất được quyền đi đầu.
4. **Quy tắc chặt Hàng & Heo**:
   - `1 Heo`: Bị chặt bởi 3 đôi thông, Tứ quý, 4 đôi thông.
   - `Đôi Heo`: Bị chặt bởi Tứ quý, 4 đôi thông.
   - `3 đôi thông`: Bị chặt bởi 3 đôi thông lớn hơn, Tứ quý, 4 đôi thông.
   - `Tứ quý`: Bị chặt bởi Tứ quý lớn hơn, 4 đôi thông.
   - `4 đôi thông`: Chặt được bất kỳ lúc nào không cần theo vòng.
5. **Đếm lá & Phạt**:
   - Ván kết thúc ngay khi có người đầu tiên đánh hết bài trên tay.
   - Người còn bài bị trừ điểm theo số lá còn lại.
   - Thối Heo đen (+1 lá), Heo đỏ (+2 lá), 3 đôi thông (+2 lá), Tứ quý (+3 lá), 4 đôi thông (+4 lá).
   - Cóng (không đánh được lá nào suốt ván): Phạt 26 lá.
