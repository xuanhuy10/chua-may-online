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

## 6. Các file
- `server.js` – web server + phòng chơi chung (WebSocket) + lưu bảng vàng vào `data/board.json`.
- `public/index.html` – game.
- `public/net.js` – lớp nối game với server.
- Đổi số người tối đa: biến môi trường `MAX_PLAYERS` (mặc định 150). Đổi cổng: `PORT`.
