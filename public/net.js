/* Lớp kết nối cho bản tự chạy server: giả lập window.claude.use("room" | "user" | "db")
   để mã game dùng chung với bản trên Claude. Không cần tài khoản: mỗi trình duyệt tự có một mã ngẫu nhiên. */
(function () {
  "use strict";
  let uid; try { uid = localStorage.getItem("chuamay.server.uid"); if (!uid) { uid = "u" + Math.random().toString(36).slice(2, 12); localStorage.setItem("chuamay.server.uid", uid); } } catch (e) { uid = "u" + Math.random().toString(36).slice(2, 12); }

  // ----- room: presence qua WebSocket, tự nối lại khi rớt mạng -----
  let boardDocs = []; const boardHandlers = [];
  function emitBoard() { const snap = { docs: boardDocs.map(d => ({ id: d.id, data: () => d })) }; boardHandlers.forEach(h => { try { h(snap); } catch (e) {} }); }
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
      if (m.t === "board") { boardDocs = m.docs || []; emitBoard(); }
      else if (m.t === "hello") { if (m.board) { boardDocs = m.board; emitBoard(); } const left = [...peers.values()]; peers.clear(); const joined = (m.peers || []).map(p => { const o = mk(p.peer, p.presence); peers.set(p.peer, o); return o; }); emitPeers(joined, firstHello ? [] : left, []); firstHello = false; }
      else if (m.t === "peer") { const had = peers.has(m.peer), o = mk(m.peer, m.presence); peers.set(m.peer, o); emitPeers(had ? [] : [o], [], had ? [o] : []); }
      else if (m.t === "left") { const o = peers.get(m.peer); if (o) { peers.delete(m.peer); emitPeers([], [o], []); } }
      else if (m.t === "full") { alert && console.warn("Chùa đã đủ người"); }
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

  // ----- user: mã riêng của trình duyệt này -----
  const user = Object.freeze({ id: () => Promise.resolve(uid), canEdit: () => Promise.resolve(false), isOwner: () => false });

  // ----- db: "audio" = danh sách file tụng kinh (public/audio/manifest.json); "board" = bảng vàng công đức lưu trên server -----
  const db = Object.freeze({
    collection(name) {
      return { onSnapshot(cb) { if (name === "board") { boardHandlers.push(cb); if (boardDocs.length) emitBoard(); return () => { const i = boardHandlers.indexOf(cb); if (i >= 0) boardHandlers.splice(i, 1); }; } if (name !== "audio") return () => {}; fetch("/audio/manifest.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).then(man => { const docs = Object.entries(man || {}).filter(([, f]) => typeof f === "string" && f).map(([k, f]) => ({ id: k, data: () => ({ id: f, name: f }) })); cb({ docs }); }).catch(() => {}); return () => {}; } };
    },
    doc(p) { return { set: v => { const mm = /^board\/(.+)$/.exec(String(p)); if (!mm) return Promise.reject({ code: "not_granted" }); raw({ t: "board_set", id: mm[1], v }); return Promise.resolve(); } }; }
  });

  const caps = { room, user, db };
  window.claude = Object.freeze({ use: name => Promise.resolve(caps[name] || null) });
})();
