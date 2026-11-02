// Chùa Mây Online - server: phục vụ trang game + phòng chơi chung qua WebSocket.
// Chạy: npm install && npm start  → mở http://localhost:3000
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 150;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm", ".mp4": "video/mp4" };

// ---- file tĩnh ----
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/healthz") { res.writeHead(200); return res.end("ok"); }
  if (url.startsWith("/_blob/")) url = "/audio/" + path.basename(url.slice(7));   // file tụng kinh
  if (url === "/") url = "/index.html";
  const file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Không tìm thấy"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": url.startsWith("/audio/") ? "public, max-age=3600" : "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
});

// ---- phòng chơi chung: mỗi người giữ một "presence" (vị trí, trạng thái, tin nhắn), server chuyển cho mọi người ----
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 });
const clients = new Map();   // ws -> { id, presence, alive, budget }
let nextId = 1;
// ---- bảng vàng công đức: lưu trong data/board.json ----
const DATA = path.join(__dirname, "data"), BOARD_FILE = path.join(DATA, "board.json");
let board = {}; try { board = JSON.parse(fs.readFileSync(BOARD_FILE, "utf8")) || {}; } catch (e) {}
let boardSaveT = 0, boardSendT = 0;
const boardTop = () => Object.entries(board).map(([id, v]) => Object.assign({ id }, v)).sort((a, b) => b.m - a.m).slice(0, 50);
function boardChanged() {
  if (!boardSaveT) boardSaveT = setTimeout(() => { boardSaveT = 0; fs.mkdirSync(DATA, { recursive: true }); fs.writeFile(BOARD_FILE, JSON.stringify(board), () => {}); }, 2000);
  if (!boardSendT) boardSendT = setTimeout(() => { boardSendT = 0; broadcast({ t: "board", docs: boardTop() }); }, 1000);
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcast = (msg, except) => { const s = JSON.stringify(msg); for (const ws of clients.keys()) if (ws !== except && ws.readyState === 1) ws.send(s); };

wss.on("connection", ws => {
  if (clients.size >= MAX_PLAYERS) { send(ws, { t: "full" }); return ws.close(); }
  const c = { id: "p" + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6), presence: {}, alive: true, budget: 60, last: Date.now() };
  clients.set(ws, c);
  send(ws, { t: "hello", you: c.id, board: boardTop(), peers: [...clients.values()].filter(o => o !== c && Object.keys(o.presence).length).map(o => ({ peer: o.id, presence: o.presence })) });
  ws.on("pong", () => { c.alive = true; });
  ws.on("message", raw => {
    // giới hạn tốc độ: ~40 tin/giây
    const now = Date.now(); c.budget = Math.min(80, c.budget + (now - c.last) * 0.04); c.last = now;
    if (c.budget < 1) return; c.budget -= 1;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m && m.t === "board_set" && typeof m.id === "string" && /^[\w-]{3,40}$/.test(m.id) && m.v) {
      const v = m.v, old = board[m.id];
      board[m.id] = { n: String(v.n || "").slice(0, 16), m: Math.max(0, Math.min(1e7, +v.m || 0)), lv: Math.max(0, Math.min(20, v.lv | 0)), t: Date.now() };
      return boardChanged();
    }
    if (!m || m.t !== "presence" || typeof m.patch !== "object" || !m.patch) return;
    const next = Object.assign({}, c.presence);
    for (const [k, v] of Object.entries(m.patch)) { if (v === null) delete next[k]; else next[k] = v; }
    if (JSON.stringify(next).length > 4096) return;   // giống giới hạn 4 KB của bản trên Claude
    c.presence = next;
    broadcast({ t: "peer", peer: c.id, presence: next }, ws);
  });
  ws.on("close", () => { clients.delete(ws); broadcast({ t: "left", peer: c.id }); });
});
setInterval(() => { for (const [ws, c] of clients) { if (!c.alive) { ws.terminate(); continue; } c.alive = false; try { ws.ping(); } catch (e) {} } }, 30000);

server.listen(PORT, () => console.log("Chùa Mây Online đang chạy: http://localhost:" + PORT));
