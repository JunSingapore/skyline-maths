/* Coach — 2アプリ共通の「学習メソッド」部品（2026-11-08）
 *  - キャラ：Sam（おばかなカワウソ・間違い探し）／Olive（頼もしいフクロウ・考える問い・ヒント・ボス案内）
 *    ※見た目・名前はあとでマイに聞いて差し替える（face() だけ直せばよい）
 *  - 考える問い：3回に2回、1回に1問、Sam と Olive が交互
 *  - 自信の申告：1回に2問だけ（どの問題で聞くかを選ぶ）
 *  - ボスバトル：金〜日、その週に出た問題から5問。シールは週1回
 * ここで作る問題・記録は、ポイント・学習日・箱（secure）に入れない（LearnCloud.answer / round を呼ばない）。
 * 状態は S.coach に置く（クラウドの状態保存にそのまま乗る）。
 */
(function (root, factory) {
  var C = factory();
  if (typeof module === "object" && module.exports) module.exports = C;
  else root.Coach = C;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function rnd(n, rand) { return Math.floor((rand || Math.random)() * n); }
  function shuffle(a, rand) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1, rand); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ── 状態 ── */
  function ensure(S) {
    var c = S.coach && typeof S.coach === "object" && !Array.isArray(S.coach) ? S.coach : {};
    c.turn = +c.turn || 0;                                    // 考える問いを出した回数（交互の順番）
    c.seen = c.seen && typeof c.seen === "object" ? c.seen : {};   // 問い id → 出た回数
    c.notebook = Array.isArray(c.notebook) ? c.notebook : [];      // Sam の間違いを直した問い id
    c.boss = c.boss && typeof c.boss === "object" ? c.boss : {};   // 週の月曜（YYYY-MM-DD）→ { tried, perfect, best }
    c.sure = Array.isArray(c.sure) ? c.sure : [];                // 自信ありで間違えた問題（次の回の確認から押し出さない）
    S.coach = c;
    return c;
  }

  /* ── 週・ボス ── */
  function weekKey(d) { var x = new Date(d || new Date()); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return ymd(x); }
  function bossOpen(d) { var w = (d || new Date()).getDay(); return w === 5 || w === 6 || w === 0; }   // 金・土・日
  // その週に答えた問題（id）。間違えたものを先に、あとはランダム
  function bossPool(sessions, wk, valid, rand) {
    var seen = {}, missed = {};
    (sessions || []).forEach(function (s) {
      if (!s || !s.d || s.d < wk || !Array.isArray(s.res)) return;
      s.res.forEach(function (r) { if (!valid || valid(r[0])) { seen[r[0]] = 1; if (!r[1]) missed[r[0]] = 1; } });
    });
    var ids = Object.keys(seen);
    var miss = shuffle(ids.filter(function (id) { return missed[id]; }), rand);
    var rest = shuffle(ids.filter(function (id) { return !missed[id]; }), rand);
    return miss.concat(rest);
  }
  var BOSS_N = 5, BOSS_MIN = 3;
  function bossRecord(S, wk, right, total) {
    var c = ensure(S), b = c.boss[wk] || { tried: 0, perfect: 0, best: 0 };
    b.tried = 1; b.best = Math.max(b.best || 0, right);
    if (total && right === total) b.perfect = 1;
    c.boss[wk] = b;
    var keys = Object.keys(c.boss).sort(); while (keys.length > 60) delete c.boss[keys.shift()];
    return b;
  }
  function stickers(S) {
    var c = ensure(S), n = 0, p = 0;
    Object.keys(c.boss).forEach(function (k) { if (c.boss[k].tried) n++; if (c.boss[k].perfect) p++; });
    return { tried: n, perfect: p };
  }

  /* ── 「自信ありで間違えた」問題を、次の回の確認予約（follow）から押し出さない ── */
  function markSure(S, key) { var c = ensure(S); c.sure = c.sure.filter(function (k) { return k !== key; }); c.sure.push(key); while (c.sure.length > 4) c.sure.shift(); }
  function clearSure(S, key) { var c = ensure(S); c.sure = c.sure.filter(function (k) { return k !== key; }); }
  // max を超えたら、守る印の無いものから古い順に外す（全部守る印なら一番古いもの）
  function trimFollow(list, keyOf, S, max) {
    var sure = ensure(S).sure;
    while (list.length > max) {
      var k = 0; while (k < list.length && sure.indexOf(keyOf(list[k])) >= 0) k++;
      list.splice(k < list.length ? k : 0, 1);
    }
    return list;
  }

  /* ── 2台の iPad の状態を合わせる（シール・ノートを消さない）。learn-cloud.js の merge から呼ぶ ── */
  function mergeCoach(a, b) {
    if (!b || typeof b !== "object") return a;
    if (!a || typeof a !== "object") return JSON.parse(JSON.stringify(b));
    var A = { coach: JSON.parse(JSON.stringify(a)) }, B = { coach: JSON.parse(JSON.stringify(b)) };
    var x = ensure(A), y = ensure(B);
    x.turn = Math.max(x.turn, y.turn);
    Object.keys(y.seen).forEach(function (id) { x.seen[id] = Math.max(+x.seen[id] || 0, +y.seen[id] || 0); });
    y.notebook.forEach(function (id) { if (x.notebook.indexOf(id) < 0) x.notebook.push(id); });
    Object.keys(y.boss).forEach(function (wk) {
      var p = x.boss[wk] || {}, q = y.boss[wk] || {};
      x.boss[wk] = { tried: Math.max(+p.tried || 0, +q.tried || 0), perfect: Math.max(+p.perfect || 0, +q.perfect || 0), best: Math.max(+p.best || 0, +q.best || 0) };
    });
    return x;
  }

  /* ── 自信の申告：1回に n 問。最初の1問は外す（慣れてから）。eligible(i) で選べる問題を絞る ── */
  function confSlots(len, n, eligible, rand) {
    var idx = [];
    for (var i = 1; i < len; i++) if (!eligible || eligible(i)) idx.push(i);
    return shuffle(idx, rand).slice(0, n || 2).sort(function (a, b) { return a - b; });
  }
  var CONF = [
    { k: "sure", en: "Sure" },
    { k: "think", en: "I think so" },
    { k: "not", en: "Not sure" }
  ];

  /* ── 考える問い ── */
  // この回に出すか：3回に2回（round が3の倍数の回は休み）
  function thinkThisRound(round) { return (round % 3) !== 0; }
  function whoNext(S) { return ensure(S).turn % 2 === 0 ? "sam" : "olive"; }
  // ctx = { recent: この回に答えた id（新しい順）, ok: 正解した id の集合 }
  function pickThink(bank, who, ctx, S, rand) {
    var c = ensure(S), recent = ctx.recent || [], ok = ctx.ok || {};
    function linkRank(e) {
      if (!e.link || !e.link.length) return 50;
      var best = 99;
      e.link.forEach(function (l) { var k = recent.indexOf(l); if (k >= 0 && k < best) best = k; });
      return best;
    }
    function eligible(e) {
      if (e.who !== who) return false;
      if (e.needOk) return e.link.some(function (l) { return ok[l]; });   // 「どう解いた？」は、その型を正解した直後だけ
      return true;
    }
    var list = (bank || []).filter(eligible);
    if (!list.length) return null;
    shuffle(list, rand);
    list.sort(function (a, b) {
      var sa = c.seen[a.id] || 0, sb = c.seen[b.id] || 0;
      // 出た回数が少ない → この回に出た型・技能につながる → それ以外
      if (sa !== sb) return sa - sb;
      return linkRank(a) - linkRank(b);
    });
    return list[0];
  }
  function pickAny(bank, S, ctx, rand) {
    var who = whoNext(S);
    return pickThink(bank, who, ctx, S, rand) || pickThink(bank, who === "sam" ? "olive" : "sam", ctx, S, rand);
  }
  function thinkDone(S, e, ok) {
    var c = ensure(S);
    c.turn++;
    c.seen[e.id] = (c.seen[e.id] || 0) + 1;
    if (e.who === "sam" && ok && c.notebook.indexOf(e.id) < 0) { c.notebook.push(e.id); if (c.notebook.length > 300) c.notebook.shift(); }
  }

  /* ── キャラの顔（仮）── */
  function face(who, mood, size) {
    size = size || 64;
    var eyes, mouth, body;
    if (who === "sam") {
      eyes = mood === "oops"
        ? '<path d="M24 34 l6 4 M24 38 l6 -4 M40 33 l7 4 M40 37 l7 -4" stroke="#2C2C2A" stroke-width="2.5" stroke-linecap="round"/>'
        : '<circle cx="27" cy="34" r="4" fill="#2C2C2A"/><circle cx="28" cy="32.5" r="1.4" fill="#fff"/><circle cx="43" cy="33" r="5" fill="#2C2C2A"/><circle cx="44.5" cy="31" r="1.6" fill="#fff"/>';
      mouth = mood === "oops" ? '<ellipse cx="35" cy="47" rx="4" ry="3" fill="#2C2C2A"/>' : '<path d="M28 45 Q35 53 42 45" fill="none" stroke="#2C2C2A" stroke-width="2.5" stroke-linecap="round"/>';
      body = '<circle cx="14" cy="16" r="7" fill="#B07A4A"/><circle cx="56" cy="16" r="7" fill="#B07A4A"/><circle cx="35" cy="36" r="26" fill="#B07A4A"/>' +
        '<ellipse cx="35" cy="44" rx="15" ry="11" fill="#E8C9A0"/><ellipse cx="35" cy="40" rx="4" ry="3" fill="#2C2C2A"/>' +
        '<circle cx="21" cy="44" r="3.5" fill="#F0997B"/><circle cx="49" cy="44" r="3.5" fill="#F0997B"/>';
    } else {
      eyes = '<circle cx="25" cy="34" r="11" fill="#fff" stroke="#3C3489" stroke-width="2.5"/><circle cx="45" cy="34" r="11" fill="#fff" stroke="#3C3489" stroke-width="2.5"/>' +
        '<line x1="34" y1="34" x2="36" y2="34" stroke="#3C3489" stroke-width="2.5"/>' +
        (mood === "think"
          ? '<circle cx="28" cy="31" r="4" fill="#2C2C2A"/><circle cx="48" cy="31" r="4" fill="#2C2C2A"/>'
          : '<circle cx="25" cy="35" r="4.5" fill="#2C2C2A"/><circle cx="26.5" cy="33.5" r="1.4" fill="#fff"/><circle cx="45" cy="35" r="4.5" fill="#2C2C2A"/><circle cx="46.5" cy="33.5" r="1.4" fill="#fff"/>');
      mouth = '<path d="M31 47 L35 54 L39 47 Z" fill="#EF9F27"/>';
      body = '<path d="M12 22 L17 6 L26 18 Z" fill="#534AB7"/><path d="M58 22 L53 6 L44 18 Z" fill="#534AB7"/><ellipse cx="35" cy="40" rx="25" ry="27" fill="#7F77DD"/>' +
        '<ellipse cx="35" cy="55" rx="13" ry="10" fill="#CECBF6"/>';
    }
    var name = who === "sam" ? "Sam" : "Olive";
    return '<svg class="coach-face" width="' + size + '" height="' + size + '" viewBox="0 0 70 70" role="img" aria-label="' + name + '">' + body + eyes + mouth + "</svg>";
  }
  function bubble(who, mood, html, extraCls) {
    return '<div class="coach-say ' + (who === "sam" ? "sam" : "olive") + (extraCls ? " " + extraCls : "") + '">' + face(who, mood, 60) +
      '<div class="coach-bubble"><p class="coach-name">' + (who === "sam" ? "Sam" : "Olive") + "</p>" + html + "</div></div>";
  }
  function sticker(perfect, size) {
    size = size || 72;
    var fill = perfect ? "#EF9F27" : "#9FE1CB", ring = perfect ? "#854F0B" : "#0F6E56";
    return '<svg class="coach-sticker" width="' + size + '" height="' + size + '" viewBox="0 0 80 80" role="img" aria-label="' + (perfect ? "Champion sticker" : "Boss sticker") + '">' +
      '<circle cx="40" cy="40" r="36" fill="' + fill + '" stroke="' + ring + '" stroke-width="4"/>' +
      '<path d="M40 16 L46 32 L63 33 L50 44 L54 61 L40 52 L26 61 L30 44 L17 33 L34 32 Z" fill="#fff" stroke="' + ring + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      (perfect ? '<text x="40" y="47" text-anchor="middle" font-size="13" font-weight="700" fill="' + ring + '" font-family="sans-serif">5/5</text>' : "") + "</svg>";
  }

  /* ── 考える問いの画面 ── */
  // e：問い。st：{ order: 選択肢の並び, pick: 選んだ番号（並び替え後）|null }
  function thinkHTML(e, st, opts) {
    opts = opts || {};
    var who = e.who, picked = st.pick != null;
    var lead = who === "sam" ? "Sam’s working" : ({ why: "What made it right?", how: "How did you think?", other: "Another way", asn: "Always, sometimes or never?", sensible: "Is it sensible?" }[e.kind] || "Think about it");
    var h = '<div class="coach-card"><p class="eyebrow">' + esc(lead) + "</p>";
    h += bubble(who, picked && who === "sam" ? "oops" : who === "olive" ? "think" : "happy", "<p>" + esc(e.say) + "</p>");
    h += '<p class="coach-q">' + esc(e.q) + "</p>";
    if (!st.order) st.order = e.a == null || e.keepOrder ? e.options.map(function (_, k) { return k; }) : shuffle(e.options.map(function (_, k) { return k; }));
    h += '<div class="coach-opts">';
    st.order.forEach(function (oi, k) {
      var cls = "coach-opt";
      if (picked) {
        if (e.a == null) cls += k === st.pick ? " chosen" : " dim";
        else if (oi === e.a) cls += " correct";
        else if (k === st.pick) cls += " wrong";
        else cls += " dim";
      }
      h += '<button class="' + cls + '" data-action="think-pick" data-k="' + k + '"' + (picked ? " disabled" : "") + ">" + esc(e.options[oi]) + "</button>";
    });
    h += "</div>";
    if (!picked && e.ja) h += st.hint ? '<div class="hintbox">' + bubble("olive", "happy", "<p>" + esc(e.ja) + "</p>", "small") + "</div>" : '<div><button class="btn ghost small" data-action="think-hint">ヒント（日本語）</button></div>';
    if (picked) {
      var oi = st.order[st.pick], ok = e.a == null ? null : oi === e.a;
      var fb = (e.fb && e.fb[oi]) || "";
      var msg;
      if (ok === null) msg = "<p>" + esc(fb || "Thinking about how you solved it makes the method stick.") + "</p>";
      else if (ok) msg = "<p><strong>" + esc(who === "sam" ? "Yes! You fixed Sam’s mistake." : "Exactly.") + "</strong> " + esc(fb) + "</p>";
      else msg = "<p><strong>Not quite.</strong> " + esc(fb) + "</p><p>The answer is <strong>" + esc(e.options[e.a]) + "</strong>.</p>";
      h += '<div class="feedback ' + (ok === false ? "no" : "ok") + '" role="status">' + msg;
      if (e.more) h += bubble("olive", "happy", "<p>" + esc(e.more) + "</p>", "small");
      if (who === "sam" && ok) h += bubble("sam", "happy", "<p>" + esc(e.thanks || "Oops! Thanks for fixing me. I’ll write it in my notebook.") + "</p>", "small");
      h += '<button class="btn primary" data-action="think-next">' + (opts.last ? "Finish" : "Next") + " →</button></div>";
    }
    return h + "</div>";
  }

  // 自信の申告のあとの一言（丸つけの後に出す）
  function confNote(conf, ok) {
    if (!conf) return "";
    if (conf === "sure" && !ok) return bubble("olive", "think", "<p>You felt sure, but it wasn’t right — that’s the most useful kind of mistake to find. It will come back first next time.</p>", "small");
    if (conf === "not" && ok) return bubble("olive", "happy", "<p>You weren’t sure, and you got it! Trust your thinking a little more.</p>", "small");
    if (conf === "sure" && ok) return "";
    return "";
  }
  function confButtonsHTML(action) {
    return '<div class="coach-conf"><p class="coach-conf-q">' + face("olive", "happy", 36) + "<span>How sure are you?</span></p><div class=\"coach-conf-row\">" +
      CONF.map(function (c) { return '<button class="btn ' + (c.k === "sure" ? "primary" : "ghost") + '" data-action="' + action + '" data-c="' + c.k + '">' + esc(c.en) + "</button>"; }).join("") + "</div></div>";
  }

  function bossCardHTML(S, poolN, d) {
    if (!bossOpen(d) || poolN < BOSS_MIN) return "";
    var wk = weekKey(d), b = ensure(S).boss[wk];
    var h = '<section class="coach-boss" aria-label="Boss of the week">' + face("olive", "happy", 64) + '<div class="coach-boss-t"><p class="eyebrow">Weekend only</p><h3>Boss of the week</h3>';
    h += "<p>" + Math.min(BOSS_N, poolN) + " questions from this week. " + (b && b.perfect ? "You’re this week’s champion!" : b ? "Best so far: " + b.best + ". Go for all of them!" : "Try it and win a sticker!") + "</p></div>";
    if (b) h += sticker(!!b.perfect, 56);
    h += '<button class="btn primary" data-action="start-boss">' + (b ? "Try again" : "Take on the boss") + "</button></section>";
    return h;
  }
  function stickerShelfHTML(S) {
    var s = stickers(S);
    if (!s.tried) return "";
    return '<p class="coach-shelf">' + sticker(false, 26) + " <strong>" + s.tried + "</strong> boss sticker" + (s.tried === 1 ? "" : "s") +
      (s.perfect ? " · " + sticker(true, 26) + " <strong>" + s.perfect + "</strong> champion" : "") +
      (ensure(S).notebook.length ? " · Sam’s notebook: <strong>" + ensure(S).notebook.length + "</strong> fixed" : "") + "</p>";
  }

  var CSS = [
    ".coach-face{flex:0 0 auto}",
    ".coach-say{display:flex;gap:12px;align-items:flex-start}",
    ".coach-say.small .coach-face{width:40px;height:40px}",
    ".coach-bubble{background:var(--surface);border:2px solid var(--line);border-radius:16px;padding:10px 14px;flex:1;min-width:0}",
    ".coach-say.sam .coach-bubble{border-color:#F0997B}",
    ".coach-say.olive .coach-bubble{border-color:#AFA9EC}",
    ".coach-bubble p{margin:0}",
    ".coach-name{font-size:13px;font-weight:700;color:var(--muted)}",
    ".coach-card{display:flex;flex-direction:column;gap:16px}",
    ".coach-q{font-size:20px;font-weight:700;margin:0}",
    ".coach-opts{display:grid;gap:10px}",
    ".coach-opt{text-align:left;min-height:56px;padding:12px 16px;border-radius:16px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:18px}",
    ".coach-opt.correct{border-color:var(--good);background:var(--good-bg)}",
    ".coach-opt.wrong{border-color:var(--bad);background:var(--bad-bg)}",
    ".coach-opt.chosen{border-color:var(--slate)}",
    ".coach-opt.dim{opacity:.6}",
    ".opt.chosen{border-color:var(--slate);box-shadow:inset 0 0 0 2px var(--slate)}",
    ".coach-conf{display:flex;flex-direction:column;gap:10px;align-items:center}",
    ".coach-conf-q{display:flex;gap:8px;align-items:center;margin:0;font-weight:700}",
    ".coach-conf-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:420px}",
    ".coach-conf-row .btn{padding:0 8px}",
    ".coach-boss{display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:var(--surface);border:2px solid #AFA9EC;border-radius:22px;padding:16px 20px}",
    ".coach-boss-t{flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px}",
    ".coach-boss-t h3,.coach-boss-t p{margin:0}",
    ".coach-shelf{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:15px;color:var(--muted);margin:0}",
    ".coach-win{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}"
  ].join("\n");
  function injectCSS(doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc || doc.getElementById("coach-css")) return;
    var s = doc.createElement("style"); s.id = "coach-css"; s.textContent = CSS; doc.head.appendChild(s);
  }

  return {
    ensure: ensure, markSure: markSure, clearSure: clearSure, trimFollow: trimFollow, mergeCoach: mergeCoach, weekKey: weekKey, bossOpen: bossOpen, bossPool: bossPool, bossRecord: bossRecord, stickers: stickers,
    BOSS_N: BOSS_N, BOSS_MIN: BOSS_MIN, confSlots: confSlots, CONF: CONF,
    thinkThisRound: thinkThisRound, whoNext: whoNext, pickThink: pickThink, pickAny: pickAny, thinkDone: thinkDone,
    face: face, bubble: bubble, sticker: sticker, thinkHTML: thinkHTML, confNote: confNote, confButtonsHTML: confButtonsHTML,
    bossCardHTML: bossCardHTML, stickerShelfHTML: stickerShelfHTML, injectCSS: injectCSS, esc: esc
  };
});
