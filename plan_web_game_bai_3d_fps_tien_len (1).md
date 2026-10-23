# Kế hoạch phát triển Web Game Bài 3D FPS — Tiến Lên Miền Nam

## 1. Mục tiêu và phạm vi dự án

Xây dựng game bài 3D chạy trực tiếp trên trình duyệt web, mang lại góc nhìn thứ nhất (FPS) chân thực như đang ngồi trực tiếp quanh bàn chơi. Camera đặt cố định tại ghế ngồi của người chơi và lia nhẹ tự nhiên theo con trỏ chuột. Game đi theo phong cách đồ họa hoạt hình (stylized cartoon / low-poly), ưu tiên tải nhanh, hiệu năng mượt mà, chi phí hạ tầng 0 đồng (tận dụng triệt để Free Tier của Vercel và Cloudflare Workers).

### 1.1. Phạm vi mục tiêu ban đầu (MVP)
- **Tựa game**: Tiến Lên Miền Nam (TLMN) đếm lá — chuẩn luật phổ thông.
- **Quy mô thử nghiệm**: 5–10 người chơi đồng thời (CCU) trên toàn hệ thống, phân bổ trên nhiều bàn.
- **Số người mỗi bàn**: 2 đến 4 người chơi.
- **Góc nhìn camera**: Cố định tại ghế ngồi của người chơi (First-Person View), lia nhẹ theo chuyển động chuột (tối đa ±15°), không hỗ trợ di chuyển WASD tự do.
- **Phong cách đồ họa**: Stylized low-poly / cartoon, ánh sáng mềm, màu sắc tươi sáng, tối ưu cho WebGL.
- **Hạ tầng triển khai**:
  - Frontend: Vercel (Static Web Hosting).
  - Backend Realtime: Cloudflare Workers + Durable Objects (WebSocket Serverless có state).
- **Nguyên tắc MVP**: Hoàn thiện trọn vẹn luồng chơi 1 ván bài từ đầu đến cuối; loại bỏ hoàn toàn các tính năng phụ như chat, bạn bè, shop, nạp tiền hay bảng xếp hạng.

---

## 2. Trải nghiệm người dùng và luồng màn hình

Tránh đưa người chơi thẳng vào bàn 3D khi vừa vào trang. Trải nghiệm cần có bước đệm màn hình sảnh (Lobby) nhẹ nhàng bằng HTML/CSS phủ trên nền 3D nhẹ, giúp tải trang tức thì và dễ thao tác.

```text
[Mở Web] ──> [Màn hình Welcome / Lobby]
                 ├── Nhập tên hiển thị (Nickname)
                 ├── Bảng Cài đặt (Âm thanh, Đồ họa)
                 ├── Duyệt danh sách phòng (Room Browser) ──> [Vào phòng]
                 ├── Nhập mã phòng (Join by Code) ─────────> [Vào phòng]
                 └── Vào nhanh (Quick Join) ───────────────> [Vào phòng]
                                                                  │
                                                     [Bàn chơi 3D FPS]
                                                                  │
                                           [Chờ đủ người / Sẵn sàng]
                                                                  │
                                                 [Ván đấu bắt đầu]
```

### 2.1. Màn hình Welcome & Sảnh chờ (Lobby)
Bố cục giao diện HTML/CSS phủ trên nền canvas WebGL:
- **Header**: Logo game dạng hoạt hình, lời chào và ô nhập/sửa nhanh Nickname (lưu `localStorage`, không yêu cầu đăng ký/đăng nhập ở bản MVP).
- **Hành động chính**:
  - **Tạo phòng mới**: Tạo phòng với tên tùy ý, tự sinh mã phòng ngắn (6 ký tự ngẫu nhiên).
  - **Nhập mã phòng**: Ô nhập mã phòng kèm nút "Vào phòng" nhanh.
  - **Vào nhanh (Quick Join)**: Hệ thống tự động ghép vào phòng đang ở trạng thái chờ còn trống ghế.
- **Danh sách phòng (Room Browser)**:
  - Hiển thị danh sách phòng do Server (`LobbyDO`) trả về theo thời gian thực.
  - Mỗi thẻ phòng gồm: Tên phòng, Mã phòng, Số người hiện có (vd: 2/4), Trạng thái (Đang chờ / Đang chơi).
  - Nút "Tham gia" (bị vô hiệu hóa nếu phòng đã đầy hoặc đang chơi).
  - Thanh tìm kiếm phòng theo tên (lọc tức thì).
- **Nút Cài đặt**: Mở popup điều chỉnh âm lượng tổng, nhạc nền (BGM), hiệu ứng âm thanh (SFX) và chất lượng đồ họa (Thấp/Cao).

### 2.2. Bàn chơi 3D (In-game FPS View)
- Khi tham gia phòng thành công, giao diện chuyển mượt sang khung cảnh 3D tại vị trí ghế được phân bổ.
- **Hiển thị tại bàn**:
  - Mặt bàn gỗ cartoon bo tròn, ánh sáng dịu.
  - 3 vị trí ngồi của đối thủ hiển thị avatar cartoon tĩnh và bảng tên, số lượng lá bài đối thủ đang cầm trên tay (úp mặt bài).
  - Cọc bài giữa bàn hiển thị các lượt đánh gần nhất.
- **Khu vực bài trên tay (Player Hand)**:
  - Xòe quạt tự nhiên ở góc dưới màn hình.
  - Hỗ trợ thao tác click/chạm để đẩy lá bài nhô lên (Highlight/Select), click lần nữa để hạ xuống.
  - Nút hành động nổi trên UI 2D: **Đánh bài** (chỉ sáng khi tổ hợp bài chọn hợp lệ để đè bài trên bàn) và **Bỏ lượt** (Pass).
- **Đồng hồ đếm ngược (Turn Timer)**: Vòng tròn thời gian 15 giây hiển thị ngay trên đầu người chơi đang tới lượt.

---

## 3. Kiến trúc hệ thống tổng thể

```text
                     ┌─────────────────────────────────────────┐
                     │       Frontend: Vite + TypeScript       │
                     │  Three.js (3D Scene) + GSAP (Animation) │
                     │       HTML/CSS UI Overlay (Tailored)    │
                     └────────────────────┬────────────────────┘
                                          │
                                 WebSocket Messages
                                          │
                     ┌────────────────────▼────────────────────┐
                     │            Cloudflare Worker            │
                     │     HTTP Gateway / WS Routing Entry     │
                     └─────────┬─────────────────────┬─────────┘
                               │                     │
                     ┌─────────▼────────┐   ┌────────▼─────────┐
                     │     LobbyDO      │   │     RoomDO       │
                     │ (Durable Object) │   │ (Durable Object) │
                     │  - Quản lý phòng │   │  - State ván đấu │
                     │  - Quick join    │   │  - Turn & Alarms │
                     │  - Broadcast list│   │  - Validate luật │
                     └──────────────────┘   └──────────────────┘
```

### 3.1. Nguyên tắc kiến trúc cốt lõi
1. **Server-Authoritative tuyệt đối**: Client chỉ là màn hình hiển thị (Dumb Terminal). Server chịu trách nhiệm xáo bài, chia bài, xác định lượt, kiểm tra tính hợp lệ của nước đi và tính điểm kết thúc.
2. **Bảo mật thông tin bài (Anti-Cheat)**: Server tuyệt đối không gửi dữ liệu các lá bài của người chơi A cho người chơi B. Người B chỉ nhận được thông tin: `"Người A còn 7 lá bài"`.
3. **Mỗi phòng là một Durable Object riêng biệt (`RoomDO`)**: Đảm bảo state ván đấu được cô lập, nhất quán mạnh (strong consistency), không sợ race-condition.
4. **Điều phối phòng trung tâm (`LobbyDO`)**: Một Durable Object chuyên trách theo dõi danh sách tất cả các phòng đang mở, hỗ trợ người chơi tìm kiếm phòng và vào nhanh (`QUICK_JOIN`) mà không cần database ngoài.
5. **Giao tiếp tối giản qua WebSocket**: Chỉ trao đổi sự kiện hành động gameplay (vd: `PLAY_CARDS`, `PASS_TURN`) và state thay đổi. Tuyệt đối không gửi tọa độ 3D liên tục qua mạng.

---

## 4. Stack công nghệ chi tiết

| Thành phần | Công nghệ lựa chọn | Lý do và vai trò |
|---|---|---|
| **Ngôn ngữ** | TypeScript (toàn bộ) | Kiểu dữ liệu chặt chẽ từ Frontend đến Backend, dùng chung models |
| **Monorepo Tool** | npm workspaces | Quản lý `client`, `server`, và `shared` chung 1 git repo |
| **Frontend Framework** | Vite + Vanilla TypeScript + HTML/CSS | Cực nhẹ, không overhead framework, tải trang dưới 1 giây |
| **3D Engine** | Three.js (r160+) | Tiêu chuẩn dựng hình 3D WebGL, cộng đồng lớn, ổn định |
| **Animation Engine** | GSAP (GreenSock) | Điều khiển đường bay của lá bài, chuyển động camera và hiệu ứng xòe bài mượt mà |
| **Backend Runtime** | Cloudflare Workers | Edge runtime toàn cầu, độ trễ thấp, chi phí 0đ ở mức thử nghiệm |
| **Realtime & State** | Cloudflare Durable Objects | Lưu state phòng trong bộ nhớ, hỗ trợ WebSocket Hibernation tiết kiệm chi phí |
| **Hẹn giờ lượt chơi** | Durable Objects Alarms API | Đảm bảo đếm ngược lượt chính xác, tự động xử lý khi người chơi AFK/timeout |
| **Storage phòng** | DO SQLite Storage | Lưu snapshot ván đấu để hỗ trợ phục hồi sau sự cố |
| **Frontend Hosting** | Vercel | CI/CD tự động từ GitHub, CDN toàn cầu miễn phí |
| **Quản lý deploy** | Cloudflare Wrangler | CLI quản lý build và deploy Worker & Durable Objects |

---

## 5. Quy tắc luật Tiến Lên Miền Nam (TLMN) — Đếm lá

Để đảm bảo không xảy ra mâu thuẫn trong quá trình lập trình, bộ luật được chốt cứng như sau:

### 5.1. Khởi tạo và thứ tự bài
- Sử dụng bộ bài Tây 52 lá tiêu chuẩn.
- **Thứ tự độ lớn giá trị bài**: `3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2` (quân 2 lớn nhất).
- **Thứ tự chất bài**: `Bích (♠) < Chuồn (♣) < Rô (♦) < Cơ (♥)`.
- Mỗi ván có từ 2 đến 4 người chơi; mỗi người được chia đúng 13 lá bài.
- **Xác định người đi đầu**:
  - Ván đầu tiên: Người có `3 Bích (3♠)` được đi trước (bắt buộc nước đi đầu phải chứa 3♠).
  - Các ván tiếp theo: Người về Nhất ván trước được quyền đi đầu tiên.

### 5.2. Các tổ hợp bài hợp lệ
1. **Bài lẻ (Rác)**: 1 lá bài đơn lẻ.
2. **Đôi**: 2 lá cùng giá trị (so sánh chất của lá lớn hơn).
3. **Sám cô**: 3 lá cùng giá trị.
4. **Sảnh**: Từ 3 lá liên tiếp trở lên (không phân biệt chất, sảnh không chứa quân 2, sảnh lớn nhất kết thúc bằng quân A: vd `10-J-Q-K-A`).
5. **Hàng đặc biệt (Dùng để chặt)**:
   - **3 đôi thông**: 3 đôi có giá trị liên tiếp nhau (vd: Đôi 7, Đôi 8, Đôi 9).
   - **Tứ quý**: 4 lá bài cùng giá trị.
   - **4 đôi thông**: 4 đôi có giá trị liên tiếp nhau.

### 5.3. Quy tắc chặt bài và đè vòng
- Bài đánh ra đè bài trước phải **cùng thể loại và lớn hơn** (lá bài cao nhất của tổ hợp lớn hơn lá bài cao nhất của tổ hợp trước). Ngoại trừ các trường hợp chặt hàng:
  - **Chặt 1 Heo (quân 2)**: Bị chặt bởi 3 đôi thông, Tứ quý, hoặc 4 đôi thông.
  - **Chặt Đôi Heo**: Bị chặt bởi Tứ quý hoặc 4 đôi thông.
  - **Chặt 3 đôi thông**: Bị chặt bởi 3 đôi thông lớn hơn, Tứ quý, hoặc 4 đôi thông.
  - **Chặt Tứ quý**: Bị chặt bởi Tứ quý lớn hơn hoặc 4 đôi thông.
  - **Chặt 4 đôi thông**: Bị chặt bởi 4 đôi thông lớn hơn (đặc biệt: 4 đôi thông được chặt **bất cứ lúc nào**, không cần theo vòng).
- **Bỏ lượt (Pass)**: Trong một vòng chơi, nếu người chơi chọn bỏ lượt thì sẽ mất quyền đánh cho đến khi vòng chơi đó kết thúc.
- **Hết vòng**: Khi tất cả những người chơi khác đều bỏ lượt, người đánh tổ hợp cuối cùng sẽ được quyền bắt đầu một vòng chơi mới với tổ hợp tùy ý.

### 5.4. Kết thúc ván và xử lý đặc biệt
- **Điều kiện thắng**: Ván đấu kết thúc ngay khi có người đầu tiên đánh hết 13 lá bài trên tay (Luật đếm lá).
- **Xử lý Cóng (Cháy bài)**: Người chơi không đánh ra được bất kỳ lá bài nào trong suốt cả ván đấu khi có người đã về Nhất.
- **Thối Heo / Hàng**: Khi ván đấu kết thúc, người chơi còn giữ Heo hoặc Hàng trên tay sẽ bị tính điểm phạt bổ sung.

---

## 6. Xử lý thời gian thực, AFK và ngắt kết nối

### 6.1. Turn Timeout (Đếm ngược 15 giây)
Để tránh tình trạng ván đấu bị đóng băng khi có người chơi rời màn hình:
1. Mỗi khi chuyển lượt cho một người chơi, `RoomDO` kích hoạt Alarm sau 15 giây (`state.storage.setAlarm(Date.now() + 15000)`).
2. Khi Alarm kích hoạt mà người chơi chưa gửi hành động:
   - Nếu đang có bài đè trên bàn: Hệ thống tự động phát hành động **BỎ LƯỢT (AUTO_PASS)**.
   - Nếu người đó là người mở vòng mới: Hệ thống tự động **đánh lá bài rác nhỏ nhất**.
3. Nếu người chơi tự đánh bài trước khi hết hạn, `RoomDO` hủy hoặc dời Alarm sang lượt của người tiếp theo.

### 6.2. Xử lý ngắt kết nối và Reconnect
1. Khi WebSocket bị đứt kết nối (mất mạng, F5 trình duyệt):
   - `RoomDO` đánh dấu người chơi đó là `DISCONNECTED` và bắt đầu bộ đếm chờ 30 giây.
   - Ván đấu vẫn tiếp diễn; khi đến lượt người bị disconnect, hệ thống tự động xử lý auto-pass/auto-play theo cơ chế Turn Timeout.
2. Khi người chơi kết nối lại:
   - Gửi yêu cầu `RECONNECT` kèm `playerId` và `roomId`.
   - `RoomDO` gửi lại toàn bộ `FullSnapshot`: các lá bài hiện có trên tay người chơi, trạng thái các người chơi khác, tổ hợp đang có trên bàn, thời gian còn lại của lượt hiện tại.

### 6.3. Tối ưu chi phí bằng WebSocket Hibernation API
Để không tiêu hao CPU Duration trên Cloudflare Workers khi phòng đang chờ người:
- Sử dụng `ctx.acceptWebSocket(ws)` của Cloudflare Durable Objects.
- Khi không có dữ liệu gửi/nhận, Worker tự động ngủ và không bị tính phí.
- Worker chỉ tỉnh dậy khi nhận được message qua hàm `webSocketMessage()` hoặc khi Alarm hẹn giờ lượt kích hoạt.

---

## 7. Thiết kế đồ họa 3D, Camera và Tương tác bài

### 7.1. Cấu hình Camera góc nhìn thứ nhất (FPS)
- Đặt camera ở độ cao vừa tầm mắt người ngồi (tương đương `y: 1.6m`, góc chúc xuống mặt bàn khoảng `25°–30°`).
- **Lia chuột (Mouse Parallax)**:
  - Bắt sự kiện di chuyển chuột trên màn hình, ánh xạ thành góc xoay nhẹ của camera (ngang tối đa `±12°`, dọc `±8°`).
  - Sử dụng phép nội suy mượt (lerp / damp) để chuyển động mượt mà, không bị giật hay gây chóng mặt.
  - Vô hiệu hóa hiệu ứng lia chuột trên màn hình cảm ứng di động.

### 7.2. Tương tác với bài trên tay (Player Hand)
Có 2 phương án hiển thị được hỗ trợ linh hoạt:
- **Phương án chuẩn WebGL (3D Hand)**:
  - Các lá bài là các Mesh 3D mỏng xòe hình quạt cong nhẹ trước mắt người chơi.
  - Sử dụng cơ chế **Raycasting trên Proxy Hitbox** phẳng thay vì raycast trực tiếp trên mesh bài cong để đảm bảo chọn bài chính xác 100%, không bị click nhầm lá bài lớp dưới.
  - Khi lá bài được click chọn, dùng GSAP nâng nhẹ bài lên khoảng `2-3 cm` theo trục Y cục bộ.
- **Chế độ Mobile/Màn hình nhỏ**:
  - Tự động hạ thanh bài xuống dạng khay phẳng 2.5D ở cạnh dưới màn hình để ngón tay dễ bấm và vuốt chọn nhiều lá cùng lúc.

### 7.3. Các hiệu ứng chuyển động bài (GSAP Animations)
- `DEAL`: Bài từ cọc giữa bàn bay lần lượt về từng ghế ngồi kèm âm thanh chia bài.
- `FAN_OUT`: Bài của người chơi tự động sắp xếp theo thứ tự độ lớn tăng dần và xòe đều thành hình quạt.
- `PLAY_CARDS`: Các lá bài được chọn gom lại và lướt nhanh ra giữa bàn, hạ cánh có độ nảy nhẹ (bounce/settle).
- `COLLECT_CARDS`: Gom các lá bài của vòng trước vào góc cọc bài đã đánh khi vòng mới bắt đầu.

---

## 8. Cấu trúc thư mục dự án (Monorepo)

```text
web-game-bai-3d/
├── apps/
│   ├── client/                          # Frontend WebGL App
│   │   ├── public/
│   │   │   ├── assets/
│   │   │   │   ├── cards/              # Textures 52 lá bài hoạt hình
│   │   │   │   ├── avatars/            # Avatar tĩnh cartoon
│   │   │   │   └── audio/              # SFX: chia bài, đánh bài, hết giờ
│   │   │   └── favicon.ico
│   │   ├── src/
│   │   │   ├── ui/                     # UI HTML/CSS Overlay
│   │   │   │   ├── screens/            # WelcomeScreen, LobbyScreen, GameHUD
│   │   │   │   ├── components/         # RoomCard, Timer, ActionButtons, Modal
│   │   │   │   └── settings/           # Audio/Graphics manager
│   │   │   ├── game3d/                 # Three.js Core
│   │   │   │   ├── scene/              # Scene, Lighting, Table, Environment
│   │   │   │   ├── camera/             # FPSCamera, ParallaxController
│   │   │   │   ├── cards/              # CardMesh, HandLayout, CardPicker
│   │   │   │   └── animations/         # GSAP Timeline: Deal, Play, Clear
│   │   │   ├── network/                # WebSocket Client & Message Dispatcher
│   │   │   ├── state/                  # Client Game State Store
│   │   │   └── main.ts                 # Điểm khởi chạy ứng dụng
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   └── server/                          # Backend Cloudflare Workers
│       ├── src/
│       │   ├── index.ts                # Worker Entry & Route Handlers
│       │   ├── lobby/
│       │   │   └── LobbyDO.ts          # Quản lý danh sách phòng & Quick Join
│       │   ├── room/
│       │   │   ├── RoomDO.ts           # Game loop & WebSocket Hibernation
│       │   │   └── TurnTimer.ts        # Quản lý DO Alarms
│       │   ├── game/
│       │   │   ├── Deck.ts             # Tạo & xáo bộ bài
│       │   │   ├── Combinations.ts     # Nhận diện Đôi, Sám, Sảnh, Đôi thông...
│       │   │   ├── Compare.ts          # So sánh độ lớn giữa 2 tổ hợp bài
│       │   │   └── TienLenRule.ts      # Toàn bộ quy tắc TLMN đếm lá
│       │   └── tests/                  # Unit test cho toàn bộ logic game
│       ├── package.json
│       ├── tsconfig.json
│       └── wrangler.toml               # Cấu hình bindings cho Durable Objects
│
├── packages/
│   └── shared/                         # Dùng chung Client & Server
│       ├── src/
│       │   ├── cards.ts                # Định nghĩa Suit, Rank, Card interface
│       │   ├── protocol.ts             # Các mã gói tin Client <-> Server
│       │   └── types.ts                # RoomState, PlayerPublicInfo, GamePhase
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                        # Root npm workspaces
├── tsconfig.base.json
└── README.md
```

---

## 9. Danh mục Protocol (Giao tiếp WebSocket)

Được định nghĩa tập trung trong `packages/shared/src/protocol.ts`:

### 9.1. Giao tiếp Sảnh (Client <-> LobbyDO)
| Message Type | Nguồn | Mô tả |
|---|---|---|
| `GET_ROOMS` | Client -> Server | Yêu cầu danh sách các phòng đang mở |
| `ROOM_LIST_UPDATE` | Server -> Client | Cập nhật danh sách phòng theo thời gian thực |
| `CREATE_ROOM` | Client -> Server | Yêu cầu tạo phòng mới (kèm tên phòng) |
| `ROOM_CREATED` | Server -> Client | Trả về ID và mã phòng vừa tạo |
| `QUICK_JOIN` | Client -> Server | Yêu cầu tự động ghép vào 1 phòng đang chờ |

### 9.2. Giao tiếp trong ván chơi (Client <-> RoomDO)
| Message Type | Nguồn | Dữ liệu kèm theo | Mô tả |
|---|---|---|---|
| `JOIN_ROOM` | Client | `{ roomId, playerName }` | Người chơi tham gia vào phòng |
| `PLAYER_JOINED` | Server | `{ player: PlayerPublicInfo }` | Thông báo có người mới vào ghế |
| `GAME_START` | Server | `{ dealerId, firstTurnId }` | Bắt đầu ván đấu |
| `DEAL_HAND` | Server | `{ cards: Card[] }` | Gửi 13 lá bài **riêng** cho người nhận |
| `TURN_START` | Server | `{ turnPlayerId, timeoutMs }` | Bắt đầu lượt của ai, đếm ngược bao nhiêu giây |
| `PLAY_CARDS` | Client | `{ cardIds: string[] }` | Người chơi gửi yêu cầu đánh các lá bài |
| `CARDS_PLAYED` | Server | `{ playerId, cards: Card[] }` | Thông báo hợp lệ, cho các máy khác hiển thị |
| `PASS_TURN` | Client | `{}` | Người chơi chủ động bấm Bỏ lượt |
| `TURN_PASSED` | Server | `{ playerId }` | Thông báo người chơi đã bỏ lượt |
| `ROUND_RESET` | Server | `{ winnerId }` | Tất cả bỏ lượt, dọn bài trên bàn, bắt đầu vòng mới |
| `GAME_OVER` | Server | `{ winnerId, scoreboard, penalty }` | Kết thúc ván, tổng kết bài còn lại và thối heo |
| `RECONNECT` | Client | `{ roomId, playerId }` | Khôi phục ván đấu khi vừa rớt mạng |
| `FULL_STATE_SYNC` | Server | `RoomFullSnapshot` | Gửi lại toàn bộ snapshot khi reconnect |

---

## 10. Lộ trình triển khai chi tiết (5 Giai đoạn)

Tổng thời lượng dự kiến: **14–22 ngày làm việc** cho 1 lập trình viên Fullstack.

```text
  [P0: Setup Monorepo] (1 ngày)
           │
           ▼
  [P1: Core Rules & Tests] (2–3 ngày) ──> Đảm bảo luật chuẩn 100% bằng Unit Test
           │
           ▼
  [P2: 3D Scene & Cards Prototype] (3–5 ngày) ──> Dựng bàn, bài, xòe bài, GSAP
           │
           ▼
  [P3: Backend Cloudflare DO & Realtime] (3–5 ngày) ──> LobbyDO, RoomDO, Alarms
           │
           ▼
  [P4: Ghép nối Multiplayer & Reconnect] (3–4 ngày) ──> Test 2-4 tab trình duyệt
           │
           ▼
  [P5: Hoàn thiện UI Lobby & Production Deploy] (2–4 ngày) ──> Vercel + Wrangler
```

### Chi tiết từng giai đoạn:

#### Giai đoạn P0: Thiết lập Monorepo & Khung dự án (Ước lượng: 1 ngày)
- Khởi tạo repo với `npm workspaces` gồm: `apps/client`, `apps/server`, `packages/shared`.
- Thiết lập TypeScript strict mode, cấu hình alias dùng chung.
- Dựng khung Vite cho client và cấu hình `wrangler.toml` cho server.

#### Giai đoạn P1: Xây dựng Luật Tiến Lên Miền Nam & Unit Test (Ước lượng: 2–3 ngày)
- Hoàn thiện `Deck.ts`: Khởi tạo 52 lá bài, xáo bài chuẩn thuật toán Fisher–Yates.
- Xây dựng `Combinations.ts`: Kiểm tra Đơn, Đôi, Sám, Sảnh, 3 đôi thông, Tứ quý, 4 đôi thông.
- Xây dựng `Compare.ts`: So sánh độ lớn giữa 2 tổ hợp và logic chặt Heo/Hàng.
- Xây dựng `TienLenRule.ts`: Toàn bộ vòng chơi, bỏ lượt, cóng, thối heo.
- Viết bộ Unit Test (Vitest / Jest) đạt độ phủ test >90% cho các trường hợp biên của luật.

#### Giai đoạn P2: Dựng Scene 3D & Hiệu ứng bài (Ước lượng: 3–5 ngày)
- Dựng Scene Three.js: Bàn gỗ cartoon, ghế ngồi, ánh sáng ambient + directional dịu nhẹ.
- Thiết lập FPS Camera: Góc nhìn ghế ngồi, lia nhẹ theo chuột (mouse parallax).
- Tạo Mesh bài 3D có gắn texture chất lượng cao nhưng dung lượng nhẹ.
- Lập trình thuật toán xòe bài hình quạt (Fan layout) tự động theo số lượng bài còn trên tay.
- Tích hợp GSAP: Animation chia bài từ cọc bay về tay, animation đánh bài lướt ra giữa bàn.
- Lập trình cơ chế chọn bài: Bấm để nhô lên, bấm lại để hạ xuống.

#### Giai đoạn P3: Backend Cloudflare DO & Realtime Engine (Ước lượng: 3–5 ngày)
- Viết `LobbyDO`: Tiếp nhận kết nối lấy danh sách phòng, tạo phòng, tìm phòng, vào nhanh.
- Viết `RoomDO`:
  - Tiếp nhận WebSocket kết nối phòng qua WebSocket Hibernation API.
  - Quản lý danh sách người chơi trong phòng (tối đa 4).
  - Tích hợp `TienLenRule.ts` từ giai đoạn P1 vào luồng game của phòng.
  - Tích hợp `TurnTimer.ts` dùng DO Alarms để đếm ngược 15s và xử lý auto-pass/auto-play.

#### Giai đoạn P4: Tích hợp Multiplayer & Đồng bộ thời gian thực (Ước lượng: 3–4 ngày)
- Kết nối Client WebSocket vào `RoomDO`.
- Triển khai cơ chế che giấu bài: Client chỉ nhận 13 lá của chính mình, các đối thủ chỉ nhận số lượng bài.
- Đồng bộ hóa hoạt ảnh: Khi người A đánh bài -> Server broadcast -> Người B, C, D thấy bài người A bay ra giữa bàn.
- Xử lý mất mạng / F5: Gửi `FULL_STATE_SYNC` để khôi phục lại trạng thái bàn chơi ngay lập tức.
- Kiểm thử nhiều tab trình duyệt song song (2 đến 4 người chơi).

#### Giai đoạn P5: Hoàn thiện UI Sảnh, Cài đặt & Triển khai Production (Ước lượng: 2–4 ngày)
- Dựng giao diện HTML/CSS: Màn hình Welcome, Bảng danh sách phòng, Modal tạo phòng, Cài đặt âm thanh.
- Tích hợp âm thanh (SFX): Tiếng chia bài, tiếng đặt bài xuống bàn, tiếng chuông báo hết giờ.
- Kiểm tra hiệu năng và tối ưu hóa WebGL: Đảm bảo chạy mượt mà ổn định ở 60 FPS trên máy tính thông thường.
- Deploy:
  - Frontend lên **Vercel**.
  - Backend lên **Cloudflare Workers**.
- Kiểm thử môi trường thật trên nhiều thiết bị (Desktop Chrome/Safari, Laptop).

---

## 11. Hướng dẫn triển khai miễn phí (Free Tier Deployment)

### 11.1. Frontend trên Vercel
1. Đẩy mã nguồn lên kho chứa GitHub cá nhân.
2. Đăng nhập Vercel, chọn **Add New Project** và chọn kho chứa GitHub.
3. Thiết lập thông số dự án:
   - **Root Directory**: `apps/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Cấu hình biến môi trường:
   - `VITE_WS_BACKEND_URL`: `wss://<worker-name>.<your-subdomain>.workers.dev`
5. Nhấn **Deploy**.

### 11.2. Backend trên Cloudflare Workers
1. Đăng ký tài khoản Cloudflare miễn phí và cài đặt công cụ Wrangler: `npm install -g wrangler`.
2. Đăng nhập tài khoản: `npx wrangler login`.
3. Kiểm tra file `apps/server/wrangler.toml`:
```toml
name = "web-game-bai-3d-server"
main = "src/index.ts"
compatibility_date = "2024-04-01"

[durable_objects]
bindings = [
  { name = "LOBBY", class_name = "LobbyDO" },
  { name = "ROOMS", class_name = "RoomDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["LobbyDO", "RoomDO"]
```
4. Thực hiện lệnh deploy:
```bash
cd apps/server
npx wrangler deploy
```
5. Sao chép địa chỉ Worker URL được cấp và gắn vào biến môi trường của Frontend trên Vercel.

---

## 12. Bảng kiểm tra nghiệm thu MVP (Acceptance Criteria Checklist)

- [ ] **Màn hình sảnh**: Mở web thấy màn hình chào, sửa được Nickname, xem danh sách phòng trực tiếp từ server.
- [ ] **Tạo và vào phòng**: Tạo phòng mới sinh mã 6 số; người khác nhập mã hoặc bấm trong danh sách đều vào đúng phòng.
- [ ] **Vào nhanh (Quick Join)**: Bấm nút là tự động tìm được phòng còn trống ghế.
- [ ] **Cài đặt**: Thanh trượt âm lượng và nút bật/tắt âm thanh hoạt động chuẩn, nhớ cấu hình trên trình duyệt.
- [ ] **Không gian 3D**: Bàn chơi cartoon, góc nhìn thứ nhất (FPS) lia chuột tự nhiên, ánh sáng mềm đẹp mắt.
- [ ] **Hiệu ứng bài**: Bài chia bay về tay, xòe quạt cong đều, bấm chọn bài nhô lên mượt mà.
- [ ] **Bảo mật**: Kiểm tra Network Tab chỉ thấy bài của chính mình, không soi được bài đối thủ.
- [ ] **Luật Tiến Lên Miền Nam**:
  - [ ] Nhận diện chuẩn Đơn, Đôi, Sám, Sảnh, Đôi thông, Tứ quý.
  - [ ] Chặt Heo và Chặt Hàng đúng quy tắc.
  - [ ] Người chơi khác bỏ lượt thì mất quyền đánh cho đến hết vòng.
  - [ ] Về Nhất thì ván dừng (đếm lá), tính phạt Heo/Hàng nếu còn cầm trên tay.
- [ ] **Thời gian & AFK**: Hết 15 giây tự động Bỏ lượt hoặc đánh bài nhỏ nhất, không làm treo ván đấu.
- [ ] **Ngắt kết nối**: F5 hoặc mất mạng vào lại phòng vẫn giữ nguyên bài và vị trí ghế.
- [ ] **Triển khai**: Chạy thành công trên Vercel và Cloudflare Workers với chi phí hoàn toàn 0 đồng.
