// Chùa Mây Online - server: phục vụ trang game + phòng chơi chung (WebSocket) + quản trị bài kinh + bảng vàng.
// Chạy: npm install && npm start  → mở http://localhost:3000
// Biến môi trường:
//   ADMIN_KEY     mã quản trị (bắt buộc nên đặt; nếu bỏ trống server tự tạo và in ra log)
//   GITHUB_TOKEN  token GitHub (quyền Contents: Read and write trên repo) để lưu file tụng, lời kinh, bảng vàng lâu dài
//   GITHUB_REPO   ví dụ "xuanhuy10/chua-may-online" ; dữ liệu nằm ở nhánh "data" (không làm Render deploy lại)
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const DATA = path.join(__dirname, "data"), BLOBS = path.join(DATA, "blobs"), STATE_FILE = path.join(DATA, "state.json");
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 150;
const MAX_UPLOAD = 30 * 1024 * 1024;
fs.mkdirSync(BLOBS, { recursive: true });
let ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();
if (!ADMIN_KEY) { const f = path.join(DATA, "admin-key.txt"); try { ADMIN_KEY = fs.readFileSync(f, "utf8").trim(); } catch (e) {} if (!ADMIN_KEY) { ADMIN_KEY = crypto.randomBytes(9).toString("base64url"); fs.writeFileSync(f, ADMIN_KEY); } console.log("Mã quản trị (đặt ADMIN_KEY để đổi): " + ADMIN_KEY); }
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm", ".mp4": "video/mp4", ".flac": "audio/flac" };

// ---- trạng thái chung: bài kinh (file + lời) và bảng vàng ----
let state = { audio: {}, board: {}, garden: {}, wishes: {} };
try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch (e) {}
// file tụng đặt sẵn trong public/audio (manifest.json) dùng khi bài đó chưa có file do quản trị tải lên
try { const man = JSON.parse(fs.readFileSync(path.join(PUB, "audio", "manifest.json"), "utf8")); for (const [sid, f] of Object.entries(man)) if (f && !(state.audio[sid] && state.audio[sid].id)) state.audio[sid] = Object.assign({}, state.audio[sid], { id: path.basename(f), name: path.basename(f) }); } catch (e) {}
const SID_RE = /^[a-z0-9_]{1,24}$/, BLOB_RE = /^[a-f0-9]{20}\.[a-z0-9]{1,5}$/;
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
function cleanAudio(v) { const o = {}; if (typeof v.id === "string" && v.id) o.id = clip(path.basename(v.id), 60); if (v.name) o.name = clip(v.name, 60); if (v.lyr) o.lyr = clip(v.lyr, 20000); if (v.t) o.t = clip(v.t, 40); if (v.d) o.d = clip(v.d, 60); if (v.src) o.src = clip(v.src, 120); return o; }
const audioDocs = () => Object.entries(state.audio).map(([id, v]) => ({ id, data: v }));   // mã bài tách riêng (v.id là mã file)
const wishDocs = () => Object.entries(state.wishes || {}).map(([id, v]) => ({ id, data: v }));
const gardenDocs = () => Object.entries(state.garden || {}).map(([id, v]) => ({ id, data: v }));
const boardTop = () => Object.entries(state.board).map(([id, v]) => Object.assign({ id }, v)).sort((a, b) => b.m - a.m).slice(0, 50);
let saveT = 0, boardSendT = 0;
function changed(kind) {
  if (!saveT) saveT = setTimeout(() => { saveT = 0; fs.writeFile(STATE_FILE, JSON.stringify(state), () => {}); gh.queue("state.json", Buffer.from(JSON.stringify(state)), kind === "board" || kind === "garden" ? 120000 : kind === "wishes" ? 20000 : 5000); }, 1500);
  if (kind === "garden") return broadcast({ t: "garden", docs: gardenDocs() });
  if (kind === "wishes") return broadcast({ t: "wishes", docs: wishDocs() });
  if (kind === "board") { if (!boardSendT) boardSendT = setTimeout(() => { boardSendT = 0; broadcast({ t: "board", docs: boardTop() }); }, 1000); }
  else broadcast({ t: "audio", docs: audioDocs() });
}

// ---- lưu lâu dài vào GitHub (nhánh "data") để Render miễn phí khởi động lại không mất dữ liệu ----
const gh = (() => {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO, BR = "data";
  const on = !!(token && /^[\w.-]+\/[\w.-]+$/.test(repo || ""));
  const api = async (p, opt = {}) => { const r = await fetch((process.env.GITHUB_API || "https://api.github.com") + "/repos/" + repo + p, Object.assign({}, opt, { headers: Object.assign({ Authorization: "Bearer " + token, "User-Agent": "chua-may", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, opt.headers || {}) })); return r; };
  const pending = new Map(); let timer = 0, busy = false;
  async function commit(files) {
    let parent = null, baseTree = null; const ref = await api("/git/ref/heads/" + BR);
    if (ref.ok) { parent = (await ref.json()).object.sha; baseTree = (await (await api("/git/commits/" + parent)).json()).tree.sha; }
    const tree = []; for (const [p, buf] of files) { const b = await api("/git/blobs", { method: "POST", body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }) }); if (!b.ok) throw new Error("blob " + b.status); tree.push({ path: p, mode: "100644", type: "blob", sha: (await b.json()).sha }); }
    const t = await api("/git/trees", { method: "POST", body: JSON.stringify(baseTree ? { base_tree: baseTree, tree } : { tree }) }); if (!t.ok) throw new Error("tree " + t.status);
    const c = await api("/git/commits", { method: "POST", body: JSON.stringify({ message: "Lưu dữ liệu chùa (" + files.map(f => f[0]).join(", ").slice(0, 80) + ")", tree: (await t.json()).sha, parents: parent ? [parent] : [] }) }); if (!c.ok) throw new Error("commit " + c.status);
    const sha = (await c.json()).sha, u = parent ? await api("/git/refs/heads/" + BR, { method: "PATCH", body: JSON.stringify({ sha }) }) : await api("/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + BR, sha }) });
    if (!u.ok) throw new Error("ref " + u.status);
  }
  async function flush() { timer = 0; if (busy) { timer = setTimeout(flush, 3000); return; } if (!pending.size) return; busy = true; const files = [...pending]; pending.clear(); try { await commit(files); console.log("Đã lưu lên GitHub: " + files.map(f => f[0]).join(", ")); } catch (e) { console.error("Lưu GitHub lỗi:", e.message); files.forEach(([p, b]) => { if (!pending.has(p)) pending.set(p, b); }); timer = setTimeout(flush, 30000); } busy = false; }
  return {
    on,
    async flushNow() { if (timer) clearTimeout(timer); if (pending.size && !busy) await flush(); },
    queue(p, buf, delay) { if (!on) return; pending.set(p, buf); if (timer) clearTimeout(timer); timer = setTimeout(flush, delay || 5000); },
    async get(p) { if (!on) return null; const r = await api("/contents/" + p + "?ref=" + BR, { headers: { Accept: "application/vnd.github.raw" } }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; }
  };
})();
if (gh.on) gh.get("state.json").then(buf => { if (!buf) return; try { const s = JSON.parse(buf.toString("utf8")); state.audio = Object.assign({}, s.audio || {}, state.audio); for (const [k, v] of Object.entries(s.board || {})) if (!state.board[k] || (state.board[k].m || 0) < (v.m || 0)) state.board[k] = v; state.garden = Object.assign({}, s.garden || {}, state.garden); state.wishes = Object.assign({}, s.wishes || {}, state.wishes); fs.writeFile(STATE_FILE, JSON.stringify(state), () => {}); broadcast({ t: "audio", docs: audioDocs() }); broadcast({ t: "board", docs: boardTop() }); console.log("Đã nạp dữ liệu chùa từ GitHub"); } catch (e) {} }).catch(e => console.error("Nạp GitHub lỗi:", e.message));
else console.log("Chưa đặt GITHUB_TOKEN/GITHUB_REPO: dữ liệu chỉ lưu trên ổ đĩa server.");

// ---- HTTP ----
const isAdmin = req => { const k = String(req.headers["x-admin-key"] || ""); const a = Buffer.from(k), b = Buffer.from(ADMIN_KEY); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
function readBody(req, limit) { return new Promise((ok, bad) => { const parts = []; let n = 0; req.on("data", c => { n += c.length; if (n > limit) { bad(new Error("too_large")); req.destroy(); } else parts.push(c); }); req.on("end", () => ok(Buffer.concat(parts))); req.on("error", bad); }); }
function sendFile(res, file, type, cache) { fs.stat(file, (err, st) => { if (err || !st.isFile()) { res.writeHead(404); return res.end("Không tìm thấy"); } res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": cache }); fs.createReadStream(file).pipe(res); }); }
const failed = {};
async function api(req, res, url) {
  if (url === "/api/admin/check") return json(res, isAdmin(req) ? 200 : 403, { ok: isAdmin(req) });
  if (!isAdmin(req)) return json(res, 403, { code: "not_granted" });
  if (url === "/api/upload" && req.method === "POST") {
    let buf; try { buf = await readBody(req, MAX_UPLOAD); } catch (e) { return json(res, 413, { code: "too_large" }); }
    if (buf.length < 100) return json(res, 400, { code: "empty" });
    const name = clip(decodeURIComponent(String(req.headers["x-file-name"] || "file")), 80), ext = (path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin").slice(0, 6);
    const id = crypto.randomBytes(10).toString("hex") + ext; fs.writeFileSync(path.join(BLOBS, id), buf); gh.queue("blobs/" + id, buf, 2000);
    return json(res, 200, { id, url: "/_blob/" + id, sizeBytes: buf.length });
  }
  let m = /^\/api\/audio\/([a-z0-9_]{1,24})$/.exec(url);
  if (m && req.method === "PUT") { let v; try { v = JSON.parse((await readBody(req, 64 * 1024)).toString("utf8")); } catch (e) { return json(res, 400, { code: "bad_json" }); } state.audio[m[1]] = cleanAudio(v || {}); changed("audio"); return json(res, 200, { ok: true }); }
  if (m && req.method === "DELETE") { delete state.audio[m[1]]; changed("audio"); return json(res, 200, { ok: true }); }
  m = /^\/api\/wishes\/([\w-]{3,40})$/.exec(url);
  if (m && req.method === "DELETE") { if (state.wishes) delete state.wishes[m[1]]; changed("wishes"); return json(res, 200, { ok: true }); }
  m = /^\/api\/board\/([\w-]{3,40})$/.exec(url);
  if (m && req.method === "DELETE") { delete state.board[m[1]]; changed("board"); return json(res, 200, { ok: true }); }
  return json(res, 404, { code: "not_found" });
}
const server = http.createServer((req, res) => {
  let url; try { url = decodeURIComponent((req.url || "/").split("?")[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === "/healthz") { res.writeHead(200); return res.end("ok"); }
  if (url.startsWith("/api/")) return api(req, res, url).catch(e => json(res, 500, { code: "error" }));
  if (url.startsWith("/_blob/")) {   // file tụng: tải lên qua quản trị (data/blobs, sao lưu GitHub) hoặc đặt sẵn trong public/audio
    const id = path.basename(url.slice(7)), type = TYPES[path.extname(id).toLowerCase()] || "application/octet-stream", local = path.join(BLOBS, id);
    if (fs.existsSync(local)) return sendFile(res, local, type, "public, max-age=86400");
    if (!BLOB_RE.test(id) || !gh.on || failed[id] > Date.now()) return sendFile(res, path.join(PUB, "audio", id), type, "public, max-age=3600");
    return gh.get("blobs/" + id).then(buf => { if (!buf) { failed[id] = Date.now() + 60000; res.writeHead(404); return res.end(); } fs.writeFileSync(local, buf); sendFile(res, local, type, "public, max-age=86400"); }).catch(() => { res.writeHead(502); res.end(); });
  }
  if (url === "/") url = "/index.html";
  const file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  sendFile(res, file, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", url.startsWith("/audio/") ? "public, max-age=3600" : "no-cache");
});

// ---- phòng chơi chung: mỗi người giữ một "presence" (vị trí, trạng thái, tin nhắn), server chuyển cho mọi người ----
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 });
const clients = new Map();
let nextId = 1;
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcast = (msg, except) => { const s = JSON.stringify(msg); for (const ws of clients.keys()) if (ws !== except && ws.readyState === 1) ws.send(s); };
wss.on("connection", ws => {
  if (clients.size >= MAX_PLAYERS) { send(ws, { t: "full" }); return ws.close(); }
  const c = { id: "p" + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6), presence: {}, alive: true, budget: 60, last: Date.now() };
  clients.set(ws, c);
  send(ws, { t: "hello", you: c.id, board: boardTop(), audio: audioDocs(), garden: gardenDocs(), wishes: wishDocs(), peers: [...clients.values()].filter(o => o !== c && Object.keys(o.presence).length).map(o => ({ peer: o.id, presence: o.presence })) });
  ws.on("pong", () => { c.alive = true; });
  ws.on("message", raw => {
    const now = Date.now(); c.budget = Math.min(80, c.budget + (now - c.last) * 0.04); c.last = now;   // ~40 tin/giây
    if (c.budget < 1) return; c.budget -= 1;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m && m.t === "board_set" && typeof m.id === "string" && /^[\w-]{3,40}$/.test(m.id) && m.v) {
      const v = m.v; state.board[m.id] = { n: clip(v.n, 16), m: Math.max(0, Math.min(1e7, +v.m || 0)), lv: Math.max(0, Math.min(20, v.lv | 0)), w: Math.max(0, v.w | 0), wm: Math.max(0, Math.min(1e7, +v.wm || 0)), t: Date.now() };
      return changed("board");
    }
    if (m && m.t === "wish_set" && typeof m.id === "string" && /^[\w-]{3,40}$/.test(m.id) && m.v && typeof m.v.s === "string" && m.v.s.trim()) {   // lời nguyện treo trên cây bồ đề
      state.wishes = state.wishes || {}; state.wishes[m.id] = { n: clip(m.v.n, 16), s: clip(m.v.s.trim(), 140), t: Date.now() };
      const ks = Object.keys(state.wishes); if (ks.length > 300) ks.sort((a, b) => state.wishes[a].t - state.wishes[b].t).slice(0, ks.length - 300).forEach(k => delete state.wishes[k]);
      return changed("wishes");
    }
    if (m && m.t === "garden_set" && typeof m.id === "string" && /^(p[0-5]|bodhi)$/.test(m.id) && m.v && typeof m.v === "object") {   // vườn rau chung: ai trong chùa cũng gieo, tưới, thu hoạch được
      const v = m.v; state.garden[m.id] = { c: v.c == null ? null : Math.max(0, Math.min(3, v.c | 0)), t: +v.t || 0, w: Math.min(Date.now() + 5000, +v.w || 0), n: Math.max(0, Math.min(99999, v.n | 0)) };
      return changed("garden");
    }
    if (!m || m.t !== "presence" || typeof m.patch !== "object" || !m.patch) return;
    const next = Object.assign({}, c.presence);
    for (const [k, v] of Object.entries(m.patch)) { if (v === null) delete next[k]; else next[k] = v; }
    if (JSON.stringify(next).length > 4096) return;
    c.presence = next;
    broadcast({ t: "peer", peer: c.id, presence: next }, ws);
  });
  ws.on("close", () => { clients.delete(ws); broadcast({ t: "left", peer: c.id }); });
});
setInterval(() => { for (const [ws, c] of clients) { if (!c.alive) { ws.terminate(); continue; } c.alive = false; try { ws.ping(); } catch (e) {} } }, 30000);
process.on("SIGTERM", () => { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); if (gh.on) gh.queue("state.json", Buffer.from(JSON.stringify(state)), 1); Promise.race([gh.flushNow(), new Promise(r => setTimeout(r, 8000))]).finally(() => process.exit(0)); });
server.listen(PORT, () => console.log("Chùa Mây Online đang chạy: http://localhost:" + PORT));
