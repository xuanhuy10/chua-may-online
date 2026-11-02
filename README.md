# Chùa Mây Online – bản tự chạy server (gửi link là vào, không cần tài khoản)

## 1. Chạy thử trên máy tính
1. Cài Node.js bản 18 trở lên: https://nodejs.org
2. Giải nén thư mục này, mở Terminal / PowerShell trong thư mục, rồi gõ:
   ```
   npm install
   npm start
   ```
3. Mở trình duyệt: http://localhost:3000

## 2. Chơi chung trong cùng mạng Wi-Fi
- Xem IP máy tính (Windows: `ipconfig`, ví dụ 192.168.1.10).
- Điện thoại cùng Wi-Fi mở: `http://192.168.1.10:3000`
- Nếu không vào được, cho phép Node.js qua Windows Firewall.

## 3. Gửi link cho bạn bè ở xa (nhanh nhất, miễn phí)
Cài cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), để `npm start` đang chạy, mở cửa sổ khác gõ:
```
cloudflared tunnel --url http://localhost:3000
```
Nó in ra link dạng `https://xxxx.trycloudflare.com`. Gửi link đó cho mọi người là vào chùa được, chạy được trên điện thoại. Link sống khi máy bạn còn bật.

## 4. Đưa lên mạng chạy 24/7 (Render, gói miễn phí)
1. Đưa thư mục này lên một repo GitHub.
2. Vào https://render.com → New → Web Service → chọn repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Render cho link `https://ten-cua-ban.onrender.com`. Gói miễn phí sẽ ngủ khi không ai vào, lần đầu mở chờ khoảng 30–60 giây.
   Lưu ý: gói miễn phí không giữ file lâu dài, bảng vàng có thể bị xóa khi server khởi động lại.

## 5. Thêm file tụng kinh
Chỉ dùng file do bạn tự thu âm hoặc có giấy phép dùng tự do.
1. Chép file (mp3/m4a/ogg) vào `public/audio/`, ví dụ `batnha.mp3`.
2. Sửa `public/audio/manifest.json`:
   ```json
   {"batnha":"batnha.mp3","daibi":"","adida":""}
   ```
Để trống thì game dùng giọng đọc tiếng Việt của máy.

## 6. Quản trị chùa (thêm bài kinh, file tụng, lời kinh, bảng vàng)
1. Lấy **mã quản trị**: trên Render vào service `chua-may-online` → **Environment** → dòng `ADMIN_KEY` (bấm con mắt để xem). Chạy trên máy thì mã in ra cửa sổ server, hoặc tự đặt: `set ADMIN_KEY=ma-cua-ban` trước `npm start`.
2. Trong game bấm nút loa (Âm thanh) → kéo xuống mục **Quản trị chùa** → nhập mã → Đăng nhập. Nút khiên (Quản trị) hiện ra.
3. Trong Quản trị:
   - **Thêm bài kinh mới**: gõ tên → Thêm bài.
   - **Tải file tụng**: chọn file mp3/m4a/mp4/webm (tối đa 30 MB) cho từng bài.
   - **Lời & canh lời**: dán lời kinh (mỗi dòng một câu) → Lưu lời. Muốn chữ chạy khớp tiếng tụng: bấm *Bắt đầu canh lời*, nghe file và bấm *Dòng tiếp* (hoặc phím cách) đúng lúc mỗi câu bắt đầu → *Nghe thử* → *Lưu lời*.
   - **Bảng vàng**: xóa từng người hoặc xóa toàn bộ.

### Giữ dữ liệu lâu dài trên Render miễn phí
Render miễn phí xóa ổ đĩa mỗi lần server ngủ dậy. Để không mất file tụng, lời kinh, bảng vàng, server lưu chúng vào nhánh `data` của repo GitHub:
1. Vào https://github.com/settings/personal-access-tokens/new → *Repository access*: Only select repositories → chọn `chua-may-online` → *Permissions* → *Contents*: **Read and write** → Generate token.
2. Trên Render: service `chua-may-online` → **Environment** → thêm `GITHUB_TOKEN` = token vừa tạo (đã có sẵn `GITHUB_REPO`) → Save. Render tự khởi động lại.
Nhánh `data` không làm Render deploy lại.

## 7. Đời sống trong chùa (giống nhau ở mọi máy)
- **Giờ, mùa, thời tiết**: 1 ngày trong game = 20 phút thật; mỗi mùa 3 ngày game (1 giờ thật); thời tiết đổi mỗi buổi. Tính theo đồng hồ nên mọi người thấy như nhau.
- **Trống, chiêng**: khi có người lạy Phật hoặc thắp hương, hai vị NPC đánh trống chiêng theo nhịp. Người chơi cũng tự đánh được.
- **Phát cơm**: lấy mâm cơm ở Nhà Trai, mang cho người có biểu tượng bát cơm. Giúp càng nhiều thì chuông chùa càng lớn (5 bậc).
- **Quét sân**: lá rụng theo mùa, cả chùa quét chung, có phần trăm sân sạch. Quét cùng người khác được gấp đôi công đức.
- **Mời & nhóm**: trong danh sách người, bấm Mời… để rủ cùng làm; gõ @tên trong chat để gọi. Làm cùng người trong nhóm được thêm 50% công đức.
- **Việc chùa** (nút trên thanh hành động):
  - **Vườn rau**: 6 luống chung cho cả chùa. Gieo hạt theo mùa → múc nước ở giếng → tưới (mỗi lần cách nhau ít nhất 1 phút) → 3 lần tưới là chín → thu hoạch → mang rau vào bếp.
  - **Cây bồ đề**: tưới để cây lớn dần (chung cho cả chùa).
  - **Nấu ăn tập thể**: 4 việc Rửa rau, Nhóm bếp, Nấu, Bày mâm; tiến độ chung theo từng bữa (mỗi buổi trong game). Nấu xong được thưởng, đông người thưởng nhiều hơn, rồi bưng mâm đi phát.
  - **Phát cơm**: bưng mâm cho người xin ăn, hoặc chạm vào người chơi khác để mời cơm.
  - **Tập thể dục**: động tác theo nhịp chung của đồng hồ; bấm nút Nhịp đúng lúc, càng đều và càng đông người càng nhiều công đức.
  - NPC sư quét sân và cô tưới vườn làm việc quanh chùa.
- **Bảng vàng**: có xếp hạng tuần này và tổng công đức.
- Ghi công và giấy phép: xem `LICENSES.md` và trong game ở Âm thanh → Ghi công & bản quyền.

## 8. Các file
- `server.js` – web server + phòng chơi chung (WebSocket) + lưu bảng vàng vào `data/board.json`.
- `public/index.html` – game.
- `public/net.js` – lớp nối game với server.
- Đổi số người tối đa: biến môi trường `MAX_PLAYERS` (mặc định 150). Đổi cổng: `PORT`.
