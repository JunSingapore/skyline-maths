/* learn-cloud.js — Rooftop English / Skyline Maths 共通のクラウド保存（Supabase）
 * 設計：learning-cloud/DESIGN.md（段5）。読み込めない・オフラインでも学習は普通にできる（記録は未送信キューに溜まるだけ）。
 * 使い方（各アプリ）：
 *   LearnCloud.init({ app, getState, setState, canApply })
 *   LearnCloud.answer(item, ok)   … 各問の初回回答
 *   LearnCloud.round(unit)        … 1回を最後までやった（時間切れ終了も含む）
 *   LearnCloud.saveState()        … 学習状態をクラウドへ（回の終わり・リセット・読み込み後）
 *   LearnCloud.badgeHTML() / panelHTML()  … 未登録時の登録コード／保護者メモ内の状態表示
 *   LearnCloud.summaryHTML()      … 連続週・今週あと何日・ポイント（トップの一番上。段7〜8）
 *   LearnCloud.rewardsHTML()      … ごほうびの一覧と申請（トップの下の方。段9）
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;   // テスト用（node test-cloud.js）
  else root.LearnCloud = factory({
    storage: (function () { try { return root.localStorage; } catch (e) { return null; } })(),
    locks: root.navigator && root.navigator.locks,
    document: root.document,
    window: root,
    loadLib: null
  });
})(typeof window !== "undefined" ? window : this, function (env) {
  "use strict";
  var SUPA_URL = "https://hbkhyxtmxfhfnorumzlr.supabase.co";
  var SUPA_KEY = "sb_publishable_T0SLJV_Tljb4dCejIAU1xA_k81Ig3RE";   // 公開用キー（アプリに書いてよい）
  var LIB_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
  var LIB_SRI = "sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R";
  var PARENT_URL = "https://junsingapore.github.io/skyline-maths/parent.html";

  var Q = "learn-cloud-q:";            // 未送信の1行＝1キー（タブ同士で読み書きが衝突しない）
  var K_UID = "learn-cloud-uid";       // 最後に使った匿名UID＝キューの行の持ち主
  var K_REG = "learn-cloud-reg";       // { uid }：この UID は登録済み
  var K_PAIR = "learn-cloud-pair";     // { uid, code, expires_at }：表示中の登録コード（タブ間で共有）
  var K_BASE = "learn-cloud-base:";    // + app → { uid, v }：手元の状態の元になったサーバー版番号
  var K_SYNC = "learn-cloud-sync";     // { sent, snap: { app: 時刻 } }：最後に同期した時刻
  var K_SUM = "learn-cloud-sum";       // { uid, at, data }：最後に受け取った child_summary（開いた瞬間に出す）
  var K_SENT = "learn-cloud-sent";     // { uid, dates: ["app|日付"] }：送ったがまだ集計に入っていない回（取り直すまで表示に足す）
  var K_ASK = "learn-cloud-ask";       // { uid, ids: { ごほうびid: 申請id } }：返事待ちの申請 id（開き直しても同じ申請になる）
  var SUM_EVERY = 120000;              // 何も送っていなくても、これより古ければ取り直す（親の承認・ノルマ変更・週替わり）
  var SUM_TRUST = 600000;              // これより新しい集計なら、今週はサーバーの週（シンガポール日付）を正とする
  var AUTH_KEY = "learn-cloud-child-auth";   // 子ども側のログイン保存場所（親ページとは別）
  var BATCH = 500;                     // push_events の上限と同じ
  var APPS = ["rooftop-english", "skyline-maths"];

  var ls = env.storage, doc = env.document, win = env.window;
  var hooks = null, app = null, client = null, libState = "idle";
  var st = { uid: null, registered: false, pair: null, error: null, busy: false, dropped: 0, snapPending: true, snapHeld: false };
  var TAB = Math.random().toString(36).slice(2);   // このタブ（このページ読み込み）の印
  var flushTimer = null, snapTimer = null;
  var sumMsg = "";

  /* ── 小道具 ── */
  function now() { return env.now ? env.now() : Date.now(); }
  function get(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { ls.setItem(k, v); }   // 例外は呼び出し側で扱う
  function del(k) { try { ls.removeItem(k); } catch (e) {} }
  function getJSON(k) { try { var v = get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function setJSON(k, v) { try { set(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function keys() { var out = []; try { for (var i = 0; i < ls.length; i++) out.push(ls.key(i)); } catch (e) {} return out; }
  function withLock(name, fn) {
    if (env.locks && env.locks.request) return env.locks.request(name, fn);
    return Promise.resolve().then(fn);   // Web Locks の無い古い端末：1タブ前提でそのまま
  }
  function uuid() {
    var c = (win && win.crypto) || (typeof crypto !== "undefined" ? crypto : null);
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function online() { return !(win && win.navigator && win.navigator.onLine === false); }
  function notRegistered(err) { return !!err && err.code === "42501"; }

  /* ── 未送信キュー ── */
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // サーバー（push_events）は形の悪い行を黙って捨てるので、送る前に同じ基準で確かめる
  function validRow(r) {
    return !!r && UUID_RE.test(r.id) && /^\d{4}-\d{2}-\d{2}$/.test(r.local_date) &&
      APPS.indexOf(r.app) >= 0 && (r.kind === "answer" || r.kind === "round");
  }
  function enqueue(kind, item, ok) {
    if (!app) return;
    var d = new Date(now());
    var row = { id: uuid(), app: app, kind: kind, item: item == null ? null : String(item).slice(0, 200),
      ok: typeof ok === "boolean" ? ok : null, local_date: ymd(d), answered_at: d.toISOString(), uid: get(K_UID) };
    try { set(Q + row.id, JSON.stringify(row)); } catch (e) { st.dropped++; }   // 容量切れ：数だけ数えて保護者メモに出す
    scheduleFlush(3000);
  }
  function pending() {
    var out = [];
    keys().forEach(function (k) {
      if (!k || k.indexOf(Q) !== 0) return;
      var r = getJSON(k);
      if (r && r.id === k.slice(Q.length)) out.push(r); else del(k);   // 壊れた行は捨てる
    });
    return out.sort(function (a, b) { return a.answered_at < b.answered_at ? -1 : a.answered_at > b.answered_at ? 1 : 0; });
  }
  // 持ち主の UID が今と違う行＝前の登録の記録。自動では送らない（別の子へ入るのを防ぐ）
  function mine(r) { return r.uid == null || r.uid === st.uid; }
  function held() { return st.uid ? pending().filter(function (r) { return !mine(r); }) : []; }
  function adoptHeld() {
    held().forEach(function (r) { r.uid = st.uid; setJSON(Q + r.id, r); });
    if (st.snapHeld) { setJSON(K_BASE + app, { uid: st.uid, v: 0, tab: TAB }); st.snapHeld = false; st.snapPending = true; }
    scheduleFlush(0);
  }
  function strip(r) { return { id: r.id, app: r.app, kind: r.kind, item: r.item, ok: r.ok, local_date: r.local_date, answered_at: r.answered_at }; }

  function flush() {
    if (!client || !st.registered || !st.uid) return Promise.resolve();
    return withLock("learn-cloud-outbox", async function () {
      for (;;) {
        var rows = pending().filter(function (r) {
          if (!mine(r)) return false;
          if (validRow(r)) return true;
          del(Q + r.id); return false;
        });
        if (!rows.length) return;
        var batch = rows.slice(0, BATCH);
        var res = await client.rpc("push_events", { p_rows: batch.map(strip) });
        if (res.error) {
          if (notRegistered(res.error)) setRegistered(false);
          throw res.error;
        }
        var sent = getJSON(K_SENT), sd = sent && sent.uid === st.uid ? sent.dates : [];
        batch.forEach(function (r) { var k = r.app + "|" + r.local_date; if (r.kind === "round" && sd.indexOf(k) < 0) sd.push(k); });
        setJSON(K_SENT, { uid: st.uid, dates: sd.slice(-14) });   // 集計を取り直すまで、送った回の日も今週に出す
        batch.forEach(function (r) { del(Q + r.id); });   // 送った行だけ消す（送信中に積まれた行は残る）
        markSync("sent");
        st.sentSince = true;   // 送れた → 集計（ポイント・連続）を取り直す
        if (rows.length <= BATCH) return;
      }
    });
  }

  /* ── 学習状態の合わせ方（別の iPad が先に保存していた時） ── */
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function isEmpty(s) {
    return !s || (!Object.keys(s.items || {}).length && !(s.sessions || []).length && !(s.days || []).length);
  }
  function merge(local, remote) {
    if (!remote || typeof remote !== "object") return clone(local);
    if (!local || typeof local !== "object") return clone(remote);
    var lr = +local.resetAt || 0, rr = +remote.resetAt || 0;
    if (lr !== rr) return clone(lr > rr ? local : remote);   // リセットの世代が違えば混ぜない（新しい世代を採る）
    if (isEmpty(local)) return clone(remote);                // 手元が空＝復元
    // 既知の限界：同じ問題を2台で同じ回数ずつ進めると片方の箱だけ残る／follow は予約ごとの消化を追えない。
    // 回数の正本はクラウドの events（親ページ）なので、ここは「欠けない・壊れない」までにしている
    var out = clone(local);
    Object.keys(remote).forEach(function (k) {
      var a = local[k], b = remote[k];
      if (a === undefined) { out[k] = clone(b); return; }
      if (typeof a === "number" && typeof b === "number") out[k] = Math.max(a, b);   // round・spoken など
    });
    // 問題ごと：答えた回数（seen）が多い方。同じなら手元
    var items = clone(local.items || {}), ri = remote.items || {};
    Object.keys(ri).forEach(function (id) {
      var a = items[id], b = ri[id];
      var bs = (b && b.seen) || 0, as = a ? a.seen || 0 : -1;
      if (bs > as || (bs === as && b && (b.last || "") > (a.last || ""))) items[id] = clone(b);   // 同数なら最後にやった日が新しい方
    });
    out.items = items;
    if (Array.isArray(local.days) || Array.isArray(remote.days)) {
      var days = {};
      (local.days || []).concat(remote.days || []).forEach(function (d) { if (typeof d === "string") days[d] = 1; });
      out.days = Object.keys(days).sort().slice(-400);
    }
    if (Array.isArray(local.sessions) || Array.isArray(remote.sessions)) {
      var seen = {}, list = [];
      (local.sessions || []).concat(remote.sessions || []).forEach(function (x) {
        if (!x) return;
        var k = x.t != null ? "t" + x.t : "j" + JSON.stringify(x);   // t＝回の開始時刻（ms）
        if (!seen[k]) { seen[k] = 1; list.push(x); }
      });
      list.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
      out.sessions = clone(list.slice(-300));
    }
    // 学習メソッドの記録（シール・Sam のノート・出た回数）は両方を合わせる（消さない）
    if (local.coach || remote.coach) {
      var CO = (win && win.Coach) || (typeof require === "function" ? (function () { try { return require("./coach.js"); } catch (e) { return null; } })() : null);
      if (CO) out.coach = CO.mergeCoach(local.coach, remote.coach);
    }
    // follow（次回の確認予約）は手元のまま：和集合にすると消化済みの予約が蘇る
    return out;
  }

  function syncSnapshot() {
    if (!client || !hooks || !st.registered || !st.uid) return Promise.resolve();
    st.snapPending = true;   // 成功するまで「未保存」（失敗しても次の確認でやり直す）
    return withLock("learn-cloud-snap:" + app, async function () {
      var base0 = getJSON(K_BASE + app);
      if (base0 && base0.uid !== st.uid) { st.snapHeld = true; return; }   // 前の登録の状態：別の子へ混ぜない（保護者メモで明示的に引き継ぐ）
      for (var i = 0; i < 3; i++) {
        if (!hooks.canApply()) { st.snapPending = true; return; }   // 問題を解いている最中は触らない（回の終わりにやり直す）
        var base = getJSON(K_BASE + app);
        // 別のタブが保存した版番号は、このタブの状態の元ではない → 0 で出して必ず合わせる（古いタブが上書きしない）
        var v = base && base.uid === st.uid && base.tab === TAB ? base.v : 0;
        var res = await client.rpc("save_snapshot", { p_app: app, p_state: hooks.getState(), p_base_version: v });
        if (res.error) {
          if (notRegistered(res.error)) setRegistered(false);
          throw res.error;
        }
        var r = res.data || {};
        if (r.ok) { setJSON(K_BASE + app, { uid: st.uid, v: r.version, tab: TAB }); st.snapPending = false; markSync(app); return; }
        if (!hooks.canApply()) { st.snapPending = true; return; }
        // 別の iPad（または前の登録）が先に保存していた → 合わせてから、その版を元にもう一度
        if (r.state) hooks.setState(merge(hooks.getState(), r.state));
        setJSON(K_BASE + app, { uid: st.uid, v: r.version || 0, tab: TAB });
      }
    });
  }

  function markSync(what) {
    var s = getJSON(K_SYNC) || {}; s.snap = s.snap || {};
    if (what === "sent") s.sent = new Date(now()).toISOString(); else s.snap[what] = new Date(now()).toISOString();
    setJSON(K_SYNC, s);
  }

  /* ── ログイン（匿名）と iPad 登録 ── */
  function setRegistered(ok) {
    st.registered = ok;
    if (ok) { setJSON(K_REG, { uid: st.uid }); del(K_PAIR); st.pair = null; }
    else del(K_REG);
  }
  // 匿名ログインはタブ同士で1本ずつ（2つのアプリを同時に開いても UID が2つにならない）
  function ensureSession() {
    return withLock("learn-cloud-auth", async function () {
      var hadStored = !!get(AUTH_KEY);
      var r = await client.auth.getSession();
      var s = r && r.data && r.data.session;
      if (!s) {
        if (hadStored && get(AUTH_KEY)) throw r.error || new Error("session refresh failed");   // 通信の失敗で新しい UID を作らない
        var a = await client.auth.signInAnonymously();
        if (a.error) throw a.error;
        s = a.data.session;
      }
      return s.user.id;
    });
  }
  async function checkRegistered() {
    var r = await client.rpc("push_events", { p_rows: [] });   // 空の送信＝登録済みかどうかの確認
    if (!r.error) return true;
    if (notRegistered(r.error)) return false;
    throw r.error;
  }
  // 表示中のコードはタブ間で共有。有効な間は出し直さない（出し直すと前のコードが無効になる）
  function ensurePairing() {
    return withLock("learn-cloud-pair", async function () {
      var p = getJSON(K_PAIR);
      if (p && p.uid === st.uid && Date.parse(p.expires_at) - now() > 60000) return p;
      var r = await client.rpc("request_pairing");
      if (r.error) throw r.error;
      if (r.data && r.data.registered) { setRegistered(true); return null; }
      p = { uid: st.uid, code: r.data.code, expires_at: r.data.expires_at };
      setJSON(K_PAIR, p);
      return p;
    });
  }

  async function tick() {
    if (st.busy || !client || !online()) return;
    st.busy = true;
    try {
      st.uid = await ensureSession();
      if (get(K_UID) !== st.uid) {
        // 初めての UID：持ち主なしの行（まだ一度もログインしていない時の記録）はそのまま送れる
        try { set(K_UID, st.uid); } catch (e) {}
      }
      var reg = getJSON(K_REG);
      if (!st.registered) st.registered = !!(reg && reg.uid === st.uid);
      if (!st.registered && await checkRegistered()) setRegistered(true);
      if (!st.registered) st.pair = await ensurePairing();
      if (st.registered) { await flush(); await syncSnapshot(); await refreshSummary(false); }
      st.error = null;
    } catch (e) {
      st.error = (e && (e.message || e.code)) || String(e);
    } finally {
      st.busy = false;
      paint();
    }
  }

  function scheduleFlush(ms) {
    if (!env.timers && !win) return;
    var T = env.timers || win;
    if (flushTimer) T.clearTimeout(flushTimer);
    flushTimer = T.setTimeout(function () { flushTimer = null; tick(); }, ms);
  }

  /* ── ライブラリ（版固定・SRI つき）。失敗しても学習は止めない ── */
  function loadLib() {
    if (env.loadLib) return env.loadLib();
    return new Promise(function (resolve, reject) {
      if (win.supabase && win.supabase.createClient) return resolve(win.supabase);
      var s = doc.createElement("script");
      s.src = LIB_SRC; s.integrity = LIB_SRI; s.crossOrigin = "anonymous"; s.async = true;
      s.onload = function () { win.supabase && win.supabase.createClient ? resolve(win.supabase) : reject(new Error("no supabase")); };
      s.onerror = function () { s.remove(); reject(new Error("library load failed")); };
      doc.head.appendChild(s);
    });
  }
  function start() {
    if (client || libState === "loading") return;
    libState = "loading";
    loadLib().then(function (lib) {
      client = env.client || lib.createClient(SUPA_URL, SUPA_KEY, {
        auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      libState = "ready";
      return tick();
    }, function (e) {
      libState = "failed";   // オンラインに戻った時・画面を開き直した時にもう一度
      st.error = e.message; paint();
    });
  }

  /* ── ポイント・連続週・救済・ごほうび（段7〜9。数えるのは全部サーバー＝03_points.sql） ── */
  function cachedSum() {
    var c = getJSON(K_SUM), reg = getJSON(K_REG);
    return c && c.data && reg && c.uid === reg.uid && (!st.uid || c.uid === st.uid) ? c.data : null;
  }
  function keepSum(data) { if (data && st.uid) setJSON(K_SUM, { uid: st.uid, at: now(), data: data }); }
  async function refreshSummary(force) {
    if (!client || !st.registered || !st.uid) return;
    var c = getJSON(K_SUM);
    if (!force && !st.sentSince && c && c.uid === st.uid && now() - c.at < SUM_EVERY) return;
    var r = await client.rpc("child_summary");
    if (r.error) { if (notRegistered(r.error)) setRegistered(false); throw r.error; }
    st.sentSince = false;
    keepSum(r.data);
    del(K_SENT);
  }
  // 子の操作（救済・申請・取り消し）。答えの summary で表示を更新
  async function act(name, args, done) {
    if (!client || !st.registered || !online()) { sumMsg = "Connect to the internet first, then try again."; paint(); return; }
    try {
      await flush();   // 未送信の回を先に届ける（救済が要らなくなることもある）
      var r = await client.rpc(name, args || {});
      if (r.error) { if (notRegistered(r.error)) setRegistered(false); throw r.error; }
      if (r.data && r.data.summary) keepSum(r.data.summary);
      sumMsg = done(r.data || {});
    } catch (e) {
      sumMsg = "Couldn't reach the server. Try again in a moment.";
    }
    paint();
  }
  function rescue() {
    return act("use_rescue", {}, function (d) {
      return d.ok ? "Streak saver used — last week is complete! 🎉"
        : d.reason === "not_needed" ? "Last week is already complete." : "Not enough streak savers left this month.";
    });
  }
  // 返事が来るまで申請 id を端末に残す＝通信が切れて押し直しても・開き直しても同じ申請（サーバーは id で1件）
  function askIds() { var a = getJSON(K_ASK); return a && a.uid === st.uid && a.ids ? a.ids : {}; }
  function setAskId(rewardId, rid) {
    var ids = askIds();
    if (rid) ids[rewardId] = rid; else delete ids[rewardId];
    setJSON(K_ASK, { uid: st.uid, ids: ids });
  }
  function ask(rewardId) {
    var rid = askIds()[rewardId];
    if (!rid) { rid = uuid(); setAskId(rewardId, rid); }
    return act("request_reward", { p_id: rid, p_reward: rewardId }, function (d) {
      setAskId(rewardId, null);   // 返事が来た（成功でも断りでも）＝この id は使い終わり
      if (d.ok) return "Asked! A grown-up will check it.";
      return d.reason === "not_enough" ? "Not enough points yet." : d.reason === "too_many" ? "You can have 3 requests waiting at a time." : "That reward isn't available now.";
    });
  }
  function cancelAsk(id) { return act("cancel_request", { p_id: id }, function (d) { return d.ok ? "Request cancelled." : ""; }); }

  function mondayOf(d) { var x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function sumAge() { var c = getJSON(K_SUM); return c && c.at ? now() - c.at : Infinity; }
  // 表示用：サーバーの集計＋まだ送れていない今週の回（手元）。週が替わった後の古い集計は今週分を出さない
  function view() {
    var s = cachedSum();
    if (!s) return null;
    var fresh = sumAge() < SUM_TRUST && s.week;
    // 新しい集計ならサーバーの週・今日を正とする（日本の月曜0時台＝シンガポールはまだ日曜、のずれを出さない）
    var mon = fresh ? new Date(s.week + "T12:00:00") : mondayOf(now()), week = ymd(mon);
    var today = fresh && s.today ? s.today : ymd(new Date(now()));
    var same = s.week === week;
    var gap = same ? 0 : Math.round((mon - new Date(s.week + "T12:00:00")) / 604800000);   // 集計から何週たったか
    // 教科別（04）：英語・算数それぞれノルマ日数で達成。切り替え前の週・04 未実行のサーバーは合計で数える
    var perSub = !!s.per_subject_from && week >= s.per_subject_from;
    var real = {}, rescueD = {}, sync = {}, byApp = {};
    APPS.forEach(function (a) { byApp[a] = { real: {}, sync: {} }; });
    if (same) {
      (s.real_days || []).forEach(function (d) { real[d] = 1; });
      (s.rescue_days || []).forEach(function (d) { rescueD[d] = 1; });
      var rb = s.real_days_by_app || {};
      APPS.forEach(function (a) { (rb[a] || []).forEach(function (d) { byApp[a].real[d] = 1; }); });
    }
    var days = [];
    for (var i = 0; i < 7; i++) { var x = new Date(mon); x.setDate(mon.getDate() + i); days.push(ymd(x)); }
    var sent = getJSON(K_SENT), reg = getJSON(K_REG);
    var local = pending().filter(function (r) { return mine(r) && r.kind === "round"; }).map(function (r) { return { a: r.app, d: r.local_date }; })
      .concat((sent && reg && sent.uid === reg.uid ? sent.dates || [] : []).map(function (k) {
        var p = String(k).split("|"); return p.length === 2 ? { a: p[0], d: p[1] } : { a: null, d: p[0] };
      }));
    local.forEach(function (x) {
      if (days.indexOf(x.d) < 0 || x.d > today) return;
      if (!real[x.d]) sync[x.d] = 1;
      if (x.a && byApp[x.a] && !byApp[x.a].real[x.d]) byApp[x.a].sync[x.d] = 1;
    });
    function count(r, y) { return days.filter(function (d) { return r[d] || rescueD[d] || y[d]; }).length; }
    var goal = s.goal || 3, subs = null, done;
    if (perSub) {
      subs = APPS.map(function (a) {
        var b = byApp[a], n = count(b.real, b.sync);
        return { app: a, real: b.real, sync: b.sync, done: n, left: Math.max(goal - n, 0), todayDone: !!(b.real[today] || b.sync[today]) };
      });
      done = Math.min(subs[0].done, subs[1].done);
    } else done = count(real, sync);
    var streak = same ? s.streak : (gap === 1 && s.achieved ? s.streak : 0);   // 1週前に達成していた連続だけ引き継ぐ
    return { s: s, days: days, today: today, real: real, rescue: rescueD, sync: sync, done: done, goal: goal, subs: subs,
      left: Math.max(goal - done, 0), achieved: done >= goal, streak: streak || 0,
      todayDone: !!(real[today] || sync[today]), todayPts: s.today === today ? s.today_points || 0 : 0,
      syncing: Object.keys(sync).length > 0 || (subs || []).some(function (x) { return Object.keys(x.sync).length > 0; }),
      offer: same ? s.rescue_offer : null,
      bonus: same ? s.next_bonus : gap === 1 && s.achieved ? Math.min((s.streak || 0) * 5 + 10, 50) : 10 };
  }
  function summaryInner() {
    var v = view();
    if (!v) return "";
    var s = v.s, WD = ["M", "T", "W", "T", "F", "S", "S"], h = "";
    var risk = !v.streak && v.offer && v.offer.keeps ? v.offer.keeps : 0;   // 救済すればつながる連続
    h += '<div class="lc-top"><div class="lc-big"><b>' + (v.streak ? "🔥 " + v.streak : risk ? "🔥 " + risk + "?" : "0") + "</b><span>" +
      (risk ? "week streak — save it below!" : v.streak === 1 ? "week streak" : v.streak ? "weeks in a row" : "week streak — start one this week!") + '</span></div>' +
      '<div class="lc-big lc-right"><b>' + (s.balance || 0) + "</b><span>points</span></div></div>";
    function row(real, sync, label) {
      return '<ol class="lc-days" aria-label="' + (label ? label + " this week" : "This week") + '">' + (label ? '<li class="lc-lab">' + label + "</li>" : "") + v.days.map(function (d, i) {
        var c = real[d] ? "on" : sync[d] ? "on sync" : v.rescue[d] ? "saver" : "";
        return '<li class="' + c + (d === v.today ? " now" : "") + '"><i>' + (real[d] || sync[d] ? "★" : v.rescue[d] ? "♥" : "") + "</i>" + WD[i] + "</li>";
      }).join("") + "</ol>";
    }
    var NAME = { "rooftop-english": "English", "skyline-maths": "Maths" };
    if (v.subs) v.subs.forEach(function (x) { h += row(x.real, x.sync, NAME[x.app]); });
    else h += row(v.real, v.sync, "");
    var bonus = v.bonus || 10;
    h += '<p class="lc-line">' + (v.achieved
      ? "This week's goal is done! " + (v.syncing ? "(+" + bonus + " bonus when it syncs)" : "+" + bonus + " bonus points 🎉")
      : v.subs
        ? "This week " + v.subs.map(function (x) { return NAME[x.app] + " <b>" + x.done + " / " + v.goal + "</b>" + (x.left ? "" : " ✓"); }).join(" · ") +
          " — " + v.subs.filter(function (x) { return x.left; }).map(function (x) { return "<b>" + x.left + " more</b> " + NAME[x.app]; }).join(" + ") + " · bonus +" + bonus
        : "This week <b>" + v.done + " / " + v.goal + "</b> days — <b>" + v.left + " more</b> to go" + (v.left === 1 ? "!" : "") + " · bonus +" + bonus) + "</p>";
    var todayTxt = v.subs
      ? "Today: " + v.subs.map(function (x) { return NAME[x.app] + (x.todayDone ? " ✓" : " — not yet"); }).join(" · ") + (v.todayPts ? " · " + v.todayPts + " pts" : "")
      : v.todayDone ? "Today: done ✓" + (v.todayPts ? " · " + v.todayPts + " pts" : "") : "Today: not yet — one round lights up today";
    h += '<p class="lc-line small">' + todayTxt + (v.syncing ? ' · <span class="muted">syncing…</span>' : "") + "</p>";
    if (v.offer) {
      h += '<div class="lc-offer"><p>Last week needed ' + v.offer.need + " more day" + (v.offer.need > 1 ? "s" : "") + ". " +
        (v.offer.keeps ? "Use " + (v.offer.need > 1 ? v.offer.need + " streak savers" : "a streak saver") + " to keep your " + v.offer.keeps + "-week streak?" : "Use " + (v.offer.need > 1 ? v.offer.need + " streak savers" : "a streak saver") + " to finish last week?") +
        ' <span class="muted">(' + s.rescues_left + " left this month)</span></p>" +
        '<button class="btn ghost small" data-lc="rescue">Use ' + (v.offer.need > 1 ? v.offer.need + " savers" : "saver") + " ♥</button></div>";
    }
    // 親が手で付けたポイント（06）：いちばん新しい1件と今週の合計
    var mg = (s.manual || [])[0], MK = { chore: "Helping at home", piano: "Piano practice", violin: "Violin practice", song: "Song passed" };
    if (mg && MK[mg.kind]) h += '<p class="lc-line small">👏 From Mum &amp; Dad: <b>+' + (mg.amount | 0) + "</b> " + MK[mg.kind] + (mg.memo ? " (" + esc(mg.memo) + ")" : "") +
      (s.manual_week > mg.amount ? ' <span class="muted">· this week +' + (s.manual_week | 0) + "</span>" : "") + "</p>";
    var rw = (s.rewards || []).slice().sort(function (a, b) { return a.cost - b.cost; });
    var avail = s.available || 0, can = rw.filter(function (r) { return r.cost <= avail; }), next = rw.filter(function (r) { return r.cost > avail; })[0];
    if (can.length) h += '<p class="lc-line small">🎁 You can ask for a reward — see below.</p>';
    else if (next) h += '<p class="lc-line small">🎁 Next reward: ' + esc(next.title) + " — <b>" + (next.cost - avail) + " pts</b> to go</p>";
    if (sumMsg) h += '<p class="lc-line small" role="status">' + esc(sumMsg) + "</p>";
    return h;
  }
  function rewardsInner() {
    var v = view();
    if (!v || !(v.s.rewards || []).length && !(v.s.requests || []).length) return "";
    var s = v.s, avail = s.available || 0;
    var waiting = (s.requests || []).filter(function (r) { return r.status === "requested"; }).length;
    var h = '<h3>Rewards</h3><p class="small muted">You have <b>' + avail + '</b> points to use.</p><ul class="lc-rw">';
    (s.rewards || []).forEach(function (r) {
      var ok = r.cost <= avail && waiting < 3;
      h += "<li><span>" + esc(r.title) + ' <span class="muted">· ' + r.cost + " pts</span></span>" +
        '<button class="btn ghost small" data-lc="ask" data-id="' + esc(r.id) + '"' + (ok ? "" : " disabled") + ">Ask</button></li>";
    });
    h += "</ul>";
    var reqs = (s.requests || []).filter(function (r) { return r.status !== "cancelled"; });
    if (reqs.length) {
      h += '<ul class="lc-rw">' + reqs.map(function (r) {
        var t = r.status === "requested" ? "waiting for a grown-up" : r.status === "approved" ? "yes! 🎉" : "not this time";
        return "<li><span>" + esc(r.title) + ' <span class="muted">· ' + r.cost + " pts — " + t + "</span></span>" +
          (r.status === "requested" ? '<button class="btn ghost small" data-lc="cancel" data-id="' + esc(r.id) + '">Cancel</button>' : "") + "</li>";
      }).join("") + "</ul>";
    }
    return h;
  }
  var CSS = ".lc-sum:empty,.lc-rewards:empty{display:none}" +
    ".lc-sum{background:var(--surface,#fff);border:2px solid var(--lamp,#F0A43A);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}" +
    ".lc-top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}" +
    ".lc-big b{display:block;font-size:34px;line-height:1.1;font-family:var(--display,inherit)}.lc-big span{font-size:14px;color:var(--muted,#586577)}.lc-right{text-align:right}" +
    ".lc-days{list-style:none;display:flex;gap:6px;margin:0;padding:0}.lc-days li{flex:1;text-align:center;font-size:12px;color:var(--muted,#586577)}" +
    ".lc-days i{display:block;height:30px;line-height:30px;border-radius:8px;background:var(--ground,#ECEFF3);font-style:normal;font-size:16px;margin-bottom:2px}" +
    ".lc-days .lc-lab{flex:0 0 58px;align-self:center;text-align:left;font-size:13px;font-weight:700;color:var(--ink,#1A2130);padding-bottom:16px}" +
    ".lc-days .on i{background:var(--lamp,#F0A43A);color:var(--on-slate,#fff)}.lc-days .sync i{opacity:.6}" +
    ".lc-days .saver i{background:var(--lamp-soft,#FCEBD0);color:var(--lamp-ink,#8A5200)}.lc-days .now{font-weight:700;color:var(--ink,#1A2130)}.lc-days .now i{outline:2px solid var(--ink,#1A2130);outline-offset:1px}" +
    ".lc-line{margin:0}.lc-offer{background:var(--lamp-soft,#FCEBD0);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}.lc-offer p{margin:0}" +
    ".lc-rewards{display:flex;flex-direction:column;gap:6px}.lc-rewards h3,.lc-rewards p{margin:0}" +
    ".lc-rw{list-style:none;margin:0;padding:0}.lc-rw li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,#D2D9E2)}" +
    ".lc-sum button:disabled,.lc-rewards button:disabled{opacity:.4;cursor:default}";
  function ensureStyle() {
    if (!doc || !doc.getElementById || doc.getElementById("lc-style")) return;
    var el = doc.createElement("style"); el.id = "lc-style"; el.textContent = CSS; doc.head.appendChild(el);
  }
  function summaryHTML() { ensureStyle(); return '<section class="lc-sum" aria-label="Streak and points">' + summaryInner() + "</section>"; }
  function rewardsHTML() { ensureStyle(); return '<section class="lc-rewards">' + rewardsInner() + "</section>"; }

  /* ── 表示 ── */
  function fmt(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function badgeInner() {
    if (st.registered || !st.pair) return "";
    return 'iPad 登録コード <b style="letter-spacing:.12em">' + esc(st.pair.code) + "</b>（おうちの人が親ページで入力）";
  }
  function badgeHTML() { return '<p class="lc-badge small muted" style="text-align:center;margin:8px 0 0">' + badgeInner() + "</p>"; }
  function panelInner() {
    var s = getJSON(K_SYNC) || {}, n = st.uid ? pending().filter(mine).length : pending().length, h = held().length;
    var line = !client ? (libState === "failed" ? "接続の部品を読み込めませんでした（オフライン？）。学習記録はこの iPad に溜めて、つながったら送ります。" : "接続の準備中…")
      : st.registered ? "この iPad は登録済みです。"
      : st.pair ? "未登録です。親ページ（下のリンク）で登録コード <b>" + esc(st.pair.code) + "</b> を入力してください（" + fmt(st.pair.expires_at) + " まで有効）。"
      : "未登録です（確認中）。";
    var out = "<p>" + line + "</p><p class=\"note\">未送信 " + n + " 件 ・ 最後に送った記録 " + fmt(s.sent) + " ・ 学習状態の保存 " + fmt(s.snap && s.snap[app]) + "</p>";
    if (st.error && client) out += '<p class="note">直近の通信エラー：' + esc(st.error) + "（つながれば自動で再送します）</p>";
    if (st.dropped) out += '<p class="note" role="alert">⚠ 容量不足で ' + st.dropped + " 件を保存できませんでした。</p>";
    if (h || st.snapHeld) out += '<p class="note">前の登録のときの' + (h ? "未送信が " + h + " 件" : "学習状態が") + 'あります。この iPad の記録として送ってよければ押してください。</p><div class="row"><button class="btn ghost small" data-lc="adopt">この iPad の記録として送る</button></div>';
    out += '<p class="note">親ページ：<a style="color:inherit" href="' + PARENT_URL + '">' + PARENT_URL.replace("https://", "") + "</a>（親のスマホで開く）。リセットしても、クラウドの学習履歴（親ページ）は残ります。</p>";
    return out;
  }
  function panelHTML() { return '<section class="panel"><h3>クラウド保存</h3><div class="lc-panel">' + panelInner() + "</div></section>"; }
  function paint() {
    if (!doc || !doc.querySelectorAll) return;
    Array.prototype.forEach.call(doc.querySelectorAll(".lc-badge"), function (el) { el.innerHTML = badgeInner(); });
    Array.prototype.forEach.call(doc.querySelectorAll(".lc-panel"), function (el) { el.innerHTML = panelInner(); });
    Array.prototype.forEach.call(doc.querySelectorAll(".lc-sum"), function (el) { el.innerHTML = summaryInner(); });
    Array.prototype.forEach.call(doc.querySelectorAll(".lc-rewards"), function (el) { el.innerHTML = rewardsInner(); });
  }

  /* ── 入口 ── */
  function init(h) {
    if (hooks || !h || APPS.indexOf(h.app) < 0 || !ls) return;
    hooks = h; app = h.app;
    if (win && win.addEventListener) {
      win.addEventListener("online", function () { if (libState === "failed") { libState = "idle"; start(); } else tick(); });
      if (doc) doc.addEventListener("visibilitychange", function () {
        if (doc.visibilityState === "hidden") { flush().catch(function () {}); syncSnapshot().catch(function () {}); }
        else if (libState === "failed") { libState = "idle"; start(); }
        else tick();
      });
      doc.addEventListener("click", function (e) {
        var el = e.target.closest && e.target.closest("[data-lc]");
        if (!el) return;
        var what = el.getAttribute("data-lc"), rid = el.getAttribute("data-id");
        if (what === "adopt") { adoptHeld(); paint(); }
        else if (what === "rescue") { el.disabled = true; rescue(); }
        else if (what === "ask" && rid) {
          var rw = ((cachedSum() || {}).rewards || []).filter(function (r) { return r.id === rid; })[0];
          if (rw && (!win.confirm || win.confirm("Ask for \u201c" + rw.title + "\u201d (" + rw.cost + " points)?"))) { el.disabled = true; ask(rid); }
        }
        else if (what === "cancel" && rid) { el.disabled = true; cancelAsk(rid); }
      });
      win.setInterval(function () {   // 未登録の間は登録されたか、未送信があれば再送を確かめる
        if (doc.visibilityState === "hidden") return;
        if (!st.registered || pending().length || (st.snapPending && !st.snapHeld) || sumAge() > SUM_EVERY) tick();
      }, 30000);
    }
    start();
  }

  return {
    init: init,
    answer: function (item, ok) { enqueue("answer", item, ok); },
    round: function (unit) { enqueue("round", unit, null); },
    saveState: function () {
      if (!env.timers && !win) return;
      var T = env.timers || win;
      if (snapTimer) T.clearTimeout(snapTimer);
      snapTimer = T.setTimeout(function () { snapTimer = null; if (st.registered) syncSnapshot().catch(function (e) { st.error = e.message || e.code; }).then(paint); }, 1500);
    },
    badgeHTML: badgeHTML,
    panelHTML: panelHTML,
    summaryHTML: summaryHTML,
    rewardsHTML: rewardsHTML,
    // テスト用
    _t: { tick: tick, flush: flush, sync: syncSnapshot, merge: merge, pending: pending, held: held, adoptHeld: adoptHeld, st: st, validRow: validRow, start: start,
      refresh: refreshSummary, rescue: rescue, ask: ask, cancel: cancelAsk, view: view, summaryInner: summaryInner, rewardsInner: rewardsInner }
  };
});
