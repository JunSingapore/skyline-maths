// Mai's study widget（Scriptable 用・マイの iPad だけ）
// 設計：段12_ウィジェット_設計.md。入れ方：Scriptable に新しいスクリプトを作ってこの全文を貼る → ホーム画面にウィジェット（中）を置き、このスクリプトを選ぶ
// 鍵は iPad の中で作って Keychain に置く（DB にはハッシュだけ）。初回はウィジェットに6桁コードが出る → 親が親ページで入れる
// 読むだけ：ポイントは付けない。今日・昨日・今週はサーバー（シンガポール）の日付、表情の時間帯だけ iPad の時計

const SUPA_URL = "https://hbkhyxtmxfhfnorumzlr.supabase.co";
const SUPA_KEY = "sb_publishable_T0SLJV_Tljb4dCejIAU1xA_k81Ig3RE";   // 公開用キー（書いてよい）
const IMG_BASE = "https://junsingapore.github.io/skyline-maths/widget/";
const OPEN_URL = "https://junsingapore.github.io/rooftop-english/";
const KEY_NAME = "mai-study-widget-key";
const CACHE_FILE = "mai-study-widget-cache.json";
const IMG_VERSION = "2";            // 絵を描き直したら上げる（iPad の保存分を取り直す）
const ROTATE_FROM = "2026-11-09";   // この週（月曜）＝えんちゃん、翌週＝こうちゃん、…と交互

// ===== 決め方（Scriptable の外でもテストできる部分：test-widget.js が下の印の手前まで読む）=====

function ymdLocal(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// シンガポールの日付（サーバーの「今日」と同じ基準。日本にいても日付の判定はこちら）
function sgDate(d) { return new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
function mondayOf(ymd) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
// 週替わりのキャラ（週はサーバーの週。取れないときは iPad の日付の週）
function charFor(week) {
  const n = Math.round((Date.parse(mondayOf(week) + "T00:00:00Z") - Date.parse(ROTATE_FROM + "T00:00:00Z")) / (7 * 86400000));
  return ((n % 2) + 2) % 2 === 0 ? "en" : "koh";
}

// 何を出すか。fresh＝今取れた結果 / cache＝前回取れた結果 / failed＝今回取れなかった理由 / now＝iPad の時刻
// 返す：{ mode: "status"|"stale"|"unknown"|"pair"|"again"|"busy", pose, data }
function decide(o) {
  const hour = o.now.getHours();
  if (o.pair) {   // 登録待ち（コードを出す）
    return { mode: o.pair.again ? "again" : "pair", pose: "normal", pair: o.pair };
  }
  if (o.failed === "busy") return { mode: "busy", pose: "err" };
  if (o.fresh) {
    const s = o.fresh;
    let pose;
    if (s.today_done) pose = "done";
    else if (hour >= 17 && !s.yesterday_done) pose = "crash";   // 朝は昨日やっていなくてもふだんの顔
    else if (hour < 17) pose = "normal";
    else if (hour < 20) pose = "wait";
    else pose = "roll";
    return { mode: "status", pose: pose, data: s };
  }
  // 取れなかった：前回が「同じ日付のやった」ならそのまま。それ以外は「？」（間違えて「まだ」と言わない）
  const c = o.cache && o.cache.data;
  if (c && c.today_done && c.today === sgDate(o.now)) return { mode: "stale", pose: "done", data: c };
  return { mode: "unknown", pose: "err", data: c || null };
}

// 今週の丸（ノルマの数だけ。やった日は ●）
function dots(n, goal) {
  const g = Math.max(goal || 3, 1), k = Math.min(n || 0, g);
  return "●".repeat(k) + "○".repeat(g - k) + (n > g ? "+" : "");
}
function streakText(n) { return n > 0 ? "🔥 " + n + "-week streak" : "🔥 Start a streak!"; }
function hm(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function updatedText(iso, now) {
  if (!iso) return "";
  const d = new Date(iso);
  return "updated " + (ymdLocal(d) === ymdLocal(now) ? "" : (d.getMonth() + 1) + "/" + d.getDate() + " ") + hm(iso);
}
// 文字の行（中サイズ）
function lines(v, cache, now) {
  if (v.mode === "pair" || v.mode === "again") {
    return [v.mode === "again" ? "Please register again" : "Widget code", v.pair.code.replace(/(\d{3})(\d{3})/, "$1 $2"),
            "Ask Mom or Dad", "until " + hm(v.pair.expires_at)];
  }
  if (v.mode === "busy") return ["Hmm…", "Please wait", "and try later", ""];
  if (v.mode === "unknown") return ["?", "Can't check now", "", cache && cache.fetched_at ? "last " + updatedText(cache.fetched_at, now).replace("updated ", "") : ""];
  const s = v.data;
  return [s.today_done ? "Today ✓" : "Not yet today",
          "EN " + dots(s.days_en, s.goal) + "  MA " + dots(s.days_ma, s.goal),
          streakText(s.streak),
          updatedText(v.mode === "stale" ? cache.fetched_at : now.toISOString(), now)];
}

// ===== ここから下は iPad（Scriptable）で動く部分 =====

async function rpc(name, args) {
  const r = new Request(SUPA_URL + "/rest/v1/rpc/" + name);
  r.method = "POST";
  r.timeoutInterval = 15;
  r.headers = { "apikey": SUPA_KEY, "Content-Type": "application/json" };
  r.body = JSON.stringify(args);
  const body = await r.loadJSON();
  const code = r.response && r.response.statusCode;
  if (code !== 200) throw new Error("http " + code);
  return body;
}

function newKey() {   // UUID 2つ＝ランダム244ビット・64桁の16進
  return (UUID.string() + UUID.string()).replace(/-/g, "").toLowerCase();
}
function getKey() {
  if (Keychain.contains(KEY_NAME)) return Keychain.get(KEY_NAME);
  const k = newKey();
  Keychain.set(KEY_NAME, k);
  return k;
}

const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "mai-study-widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
function readCache() {
  try { const p = fm.joinPath(dir, CACHE_FILE); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; }
}
function writeCache(c) { fm.writeString(fm.joinPath(dir, CACHE_FILE), JSON.stringify(c)); }

async function image(who, pose) {
  const p = fm.joinPath(dir, who + "_" + pose + "_v" + IMG_VERSION + ".png");
  if (fm.fileExists(p)) return fm.readImage(p);
  try {
    const r = new Request(IMG_BASE + who + "_" + pose + ".png?v=" + IMG_VERSION);
    r.timeoutInterval = 15;
    const img = await r.loadImage();
    fm.writeImage(p, img);
    return img;
  } catch (e) { return null; }
}

async function getState() {
  const now = new Date();
  let cache = readCache();
  let key = getKey();
  try {
    let s = await rpc("widget_status", { p_key: key });
    if (s && s.ok) {
      writeCache({ fetched_at: now.toISOString(), data: s });
      return { v: decide({ fresh: s, now }), cache, now };
    }
    let again = false;
    if (s && (s.reason === "revoked" || s.reason === "invalid")) {
      // 無効にされた鍵は捨てて、新しい鍵で登録し直す（前の結果は出さない）
      Keychain.remove(KEY_NAME); key = getKey(); again = true;
      writeCache({}); cache = null;   // 前の結果は出さない（このあと通信に失敗しても）
    }
    const p = await rpc("widget_pair_start", { p_key: key });
    if (p && p.ok && p.registered) {   // 登録できた直後
      s = await rpc("widget_status", { p_key: key });
      if (s && s.ok) { writeCache({ fetched_at: now.toISOString(), data: s }); return { v: decide({ fresh: s, now }), cache, now }; }
    }
    if (p && p.ok && p.code) return { v: decide({ pair: { code: p.code, expires_at: p.expires_at, again }, now }), cache, now };
    if (p && p.reason === "revoked") { Keychain.remove(KEY_NAME); writeCache({}); }
    return { v: decide({ failed: "busy", now }), cache, now };
  } catch (e) {
    return { v: decide({ failed: "network", cache, now }), cache, now };
  }
}

async function build(family) {
  const { v, cache, now } = await getState();
  const week = (v.data && v.data.week) || mondayOf(sgDate(now));
  const who = charFor(week);
  const w = new ListWidget();
  w.backgroundColor = new Color("#4fc8c2");   // いつもターコイズ（ダークモードでも。クリームだと白い毛の境目が消えたため 11/9 純子さん）
  w.url = OPEN_URL;
  w.refreshAfterDate = new Date(now.getTime() + 15 * 60 * 1000);
  const ink = new Color("#2b2420");
  const sub = new Color("#1e4f4c");   // ターコイズ地で読める濃い青緑
  const L = lines(v, cache, now);
  const img = await image(who, v.pose);

  if (family === "small") {
    w.setPadding(8, 8, 8, 8);
    if (img) { const i = w.addImage(img); i.imageSize = new Size(70, 83); i.centerAlignImage(); }
    w.addSpacer(2);
    const t = w.addText(v.mode === "status" || v.mode === "stale" ? (v.data.today_done ? "Today ✓" : "Not yet")
                        : v.mode === "pair" || v.mode === "again" ? L[1] : L[0]);
    t.font = Font.boldRoundedSystemFont(16); t.textColor = ink; t.centerAlignText(); t.minimumScaleFactor = 0.6; t.lineLimit = 1;
    if (v.data && (v.mode === "status" || v.mode === "stale")) {
      const f = w.addText("🔥 " + v.data.streak); f.font = Font.regularRoundedSystemFont(13); f.textColor = sub; f.centerAlignText();
    }
    return w;
  }

  w.setPadding(10, 12, 10, 14);
  const row = w.addStack();
  row.centerAlignContent();
  if (img) { const i = row.addImage(img); i.imageSize = new Size(108, 128); }
  row.addSpacer(10);
  const col = row.addStack();
  col.layoutVertically();
  const big = v.mode === "pair" || v.mode === "again";
  const sizes = big ? [15, 30, 14, 12] : [22, 16, 15, 12];
  L.forEach(function (s, k) {
    if (!s) return;
    const t = col.addText(s);
    t.font = k === 0 || (big && k === 1) ? Font.boldRoundedSystemFont(sizes[k]) : Font.regularRoundedSystemFont(sizes[k]);
    if (k === 1 && !big) t.font = Font.mediumMonospacedSystemFont(sizes[k]);
    t.textColor = k === 3 ? sub : ink;
    t.lineLimit = 1; t.minimumScaleFactor = 0.6;
    if (k < 3) col.addSpacer(4);
  });
  row.addSpacer();
  return w;
}

if (typeof Keychain !== "undefined") {
  const family = config.widgetFamily || "medium";
  const w = await build(family);
  if (config.runsInWidget) Script.setWidget(w);
  else if (family === "small") await w.presentSmall();
  else await w.presentMedium();
  Script.complete();
}
