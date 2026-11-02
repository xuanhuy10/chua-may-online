/* Lớp kết nối cho bản tự chạy server: giả lập window.claude.use("room" | "user" | "db" | "assets")
   để mã game dùng chung với bản trên Claude. Không cần tài khoản: mỗi trình duyệt tự có một mã ngẫu nhiên.
   Quản trị: nhập mã quản trị (ADMIN_KEY) trong mục Âm thanh để thêm bài kinh, tải file tụng, sửa lời, xóa bảng vàng. */
(function () {
  "use strict";
  const LSget = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, LSset = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  let uid = LSget("chuamay.server.uid"); if (!uid) { uid = "u" + Math.random().toString(36).slice(2, 12); LSset("chuamay.server.uid", uid); }
  let adminKey = LSget("chuamay.server.admin") || "";

  // ----- dữ liệu chung từ server: bài kinh + bảng vàng (đẩy qua WebSocket) -----
  const coll = { audio: { docs: [], hs: [] }, board: { docs: [], hs: [] } };
  function emit(name) { const c = coll[name], snap = { docs: c.docs.map(d => ({ id: d.id, data: () => Object.assign({}, d.data && typeof d.data === "object" ? d.data : d) })) }; c.hs.forEach(h => { try { h(snap); } catch (e) { console.error(e); } }); }
  function setColl(name, docs) { if (!Array.isArray(docs)) return; coll[name].docs = docs.filter(d => d && typeof d.id === "string"); emit(name); }

  // ----- room: presence qua WebSocket, tự nối lại khi rớt mạng -----
  const peers = new Map(); let snapshot = Object.freeze([]); const peerHandlers = [], connHandlers = [];
  let ws = null, isOpen = false, mine = {}, pending = null, flushT = 0, backoff = 1000, firstHello = true;
  function emitPeers(joined, left, updated) { snapshot = Object.freeze([...peers.values()]); const ch = { peers: snapshot, joined, left, updated }; peerHandlers.forEach(h => { try { h(ch); } catch (e) { console.error(e); } }); }
  function mk(id, presence) { return Object.freeze({ peer: id, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false, presence: Object.freeze(presence || {}), updatedAt: Date.now() }); }
  function setConn(v) { if (isOpen === v) return; isOpen = v; connHandlers.forEach(h => { try { h(v); } catch (e) {} }); }
  function connect() {
    const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
    try { ws = new WebSocket(url); } catch (e) { return retry(); }
    ws.onopen = () => { backoff = 1000; setConn(true); if (Object.keys(mine).length) raw({ t: "presence", patch: mine }); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === "board") setColl("board", m.docs);
      else if (m.t === "audio") setColl("audio", m.docs);
      else if (m.t === "hello") {
        setColl("board", m.board); setColl("audio", m.audio);
        const left = [...peers.values()]; peers.clear(); const joined = (m.peers || []).map(p => { const o = mk(p.peer, p.presence); peers.set(p.peer, o); return o; }); emitPeers(joined, firstHello ? [] : left, []); firstHello = false;
      }
      else if (m.t === "peer") { const had = peers.has(m.peer), o = mk(m.peer, m.presence); peers.set(m.peer, o); emitPeers(had ? [] : [o], [], had ? [o] : []); }
      else if (m.t === "left") { const o = peers.get(m.peer); if (o) { peers.delete(m.peer); emitPeers([], [o], []); } }
      else if (m.t === "full") console.warn("Chùa đã đủ người");
    };
    ws.onclose = () => { setConn(false); retry(); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  function retry() { setTimeout(connect, backoff); backoff = Math.min(15000, backoff * 1.7); }
  function raw(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
  function flush() { flushT = 0; if (!pending) return; const p = pending; pending = null; raw({ t: "presence", patch: p }); }
  const room = Object.freeze({
    presence(patch) {
      for (const [k, v] of Object.entries(patch || {})) { if (v === null) delete mine[k]; else mine[k] = v; }
      pending = Object.assign(pending || {}, patch); if (!flushT) flushT = setTimeout(flush, 50);   // gộp ~20 lần/giây
      return Promise.resolve();
    },
    peers() { return snapshot; },
    onPeers(h) { peerHandlers.push(h); Promise.resolve().then(() => h({ peers: snapshot, joined: snapshot, left: [], updated: [] })); return () => { const i = peerHandlers.indexOf(h); if (i >= 0) peerHandlers.splice(i, 1); }; },
    connected() { return isOpen; },
    onConnection(h) { connHandlers.push(h); return () => { const i = connHandlers.indexOf(h); if (i >= 0) connHandlers.splice(i, 1); }; }
  });
  connect();

  // ----- gọi API quản trị (kèm mã quản trị) -----
  async function adminFetch(url, opt) {
    const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ "x-admin-key": adminKey }, (opt && opt.headers) || {}) }));
    if (r.status === 403) throw { code: "not_granted" }; if (r.status === 413) throw { code: "too_large" }; if (!r.ok) throw { code: "error_" + r.status };
    return r.json();
  }
  const checkKey = k => fetch("/api/admin/check", { method: "POST", headers: { "x-admin-key": k } }).then(r => r.ok).catch(() => false);

  // ----- user: mã riêng của trình duyệt này; quyền quản trị khi có mã đúng -----
  const user = Object.freeze({
    id: () => Promise.resolve(uid),
    canEdit: () => adminKey ? checkKey(adminKey).then(ok => { if (!ok) { adminKey = ""; LSset("chuamay.server.admin", null); } return ok; }) : Promise.resolve(false),
    isOwner: () => false,
    adminLogin: async k => { const ok = await checkKey(String(k || "")); if (ok) { adminKey = String(k); LSset("chuamay.server.admin", adminKey); } return ok; }
  });

  // ----- db: "audio" (bài kinh: file + lời) và "board" (bảng vàng) -----
  const db = Object.freeze({
    collection(name) {
      return { onSnapshot(cb) { const c = coll[name]; if (!c) return () => {}; c.hs.push(cb); if (c.docs.length) Promise.resolve().then(() => emit(name)); return () => { const i = c.hs.indexOf(cb); if (i >= 0) c.hs.splice(i, 1); }; } };
    },
    doc(p) {
      const m = /^(audio|board)\/([\w-]{1,40})$/.exec(String(p));
      return {
        set(v) {
          if (!m) return Promise.reject({ code: "not_granted" });
          if (m[1] === "board") { raw({ t: "board_set", id: m[2], v }); return Promise.resolve(); }
          return adminFetch("/api/audio/" + m[2], { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v || {}) }).then(() => {});
        },
        delete() { if (!m) return Promise.reject({ code: "not_granted" }); return adminFetch("/api/" + m[1] + "/" + m[2], { method: "DELETE" }).then(() => {}); }
      };
    }
  });

  // ----- assets: tải file tụng lên server (chỉ quản trị) -----
  const assets = Object.freeze({
    upload(blob) { return adminFetch("/api/upload", { method: "POST", headers: { "x-file-name": encodeURIComponent((blob && blob.name) || "file.mp3"), "Content-Type": (blob && blob.type) || "application/octet-stream" }, body: blob }); }
  });

  const caps = { room, user, db, assets };
  window.claude = Object.freeze({ use: name => Promise.resolve(caps[name] || null) });
})();
