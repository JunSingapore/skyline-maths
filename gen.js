/* 算数アプリ — 問題の型（generator）・判定・手がかり
 * ブラウザでは window.MATH_GEN、Node では require("./gen.js") で使う（検算テスト test.js 用）。
 * ルール：
 *  - 型の id は一度付けたら変えない（進捗が型 id に紐づく）
 *  - 手がかりは断定しない（「〜かな？」）。答えそのものは言わない
 *  - 判定の順番：入力確認 → 正解 → 具体的な誤りパターン → 一般的な確かめ
 */
(function (root) {
  "use strict";

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function hasInnerZero(n) { return String(n).indexOf("0") >= 0; }
  function H(en, ja) { return { en: en, ja: ja }; }

  // 入力（文字列）→ 整数。空・数字以外は null
  function num(v) {
    if (v == null) return null;
    v = String(v).replace(/[,\s]/g, "");
    return /^\d{1,9}$/.test(v) ? parseInt(v, 10) : null;
  }

  /* ── かけ算 4桁×2桁 ── */
  function mulPair(withZero) {
    for (var tries = 0; tries < 1000; tries++) {
      var a = rnd(1000, 9999), b = rnd(12, 99);
      if (b % 10 === 0 || b === 11) continue;
      var s = String(a).slice(1);                    // 百・十・一の位
      var z = s.indexOf("0") >= 0;
      if (withZero ? (s[0] !== "0" && s[1] !== "0") : z) continue;  // zero型は百か十の位に0
      return { a: a, b: b };
    }
    return { a: withZero ? 3047 : 3476, b: 27 };
  }
  function mulMake(id, withZero) {
    return function () {
      var p = mulPair(withZero), a = p.a, b = p.b, t = Math.floor(b / 10), u = b % 10;
      return {
        type: id, tag: null, kind: "mul", a: a, b: b,
        text: fmt(a) + " × " + b,
        fields: ["x"], answer: { x: a * b },
        steps: [
          fmt(a) + " × " + u + " = " + fmt(a * u),
          fmt(a) + " × " + (t * 10) + " = " + fmt(a * t * 10),
          fmt(a * u) + " + " + fmt(a * t * 10) + " = " + fmt(a * b)
        ]
      };
    };
  }
  function mulCheck(p, inp) {
    var x = num(inp.x);
    if (x == null) return { status: "incomplete", hint: H("Type your answer first.", "まず答えを入れてね。") };
    var a = p.a, t = Math.floor(p.b / 10), u = p.b % 10;
    if (x === a * p.b) return { status: "correct" };
    if (x === a * u + a * t) return { status: "wrong", code: "tens-zero", hint: H("On the row where you multiply by the tens digit, did you put a 0 in the ones column first?", "十の位をかける段で、一の位に0を置いてから始めたかな？") };
    if (x === a * u || x === a * t * 10 || x === a * t) return { status: "wrong", code: "one-row", hint: H("Did you work out both rows and add them together?", "2つの段を両方出して、足したかな？") };
    return { status: "wrong", code: "other", hint: H("Try it in two rows: " + fmt(a) + " × " + u + ", and " + fmt(a) + " × " + (t * 10) + ". Then add them.", fmt(a) + " × " + u + " と " + fmt(a) + " × " + (t * 10) + " の2段に分けて、最後に足してみよう。") };
  }

  /* ── 長いわり算（商と余りをいつも2枠で聞く。割り切れる問題は余り0） ── */
  function divSteps(D, d) {
    var ds = String(D), cur = 0, started = false, out = [];
    for (var i = 0; i < ds.length; i++) {
      cur = cur * 10 + (+ds[i]);
      var q = Math.floor(cur / d);
      if (!started && q === 0) continue;
      started = true;
      var rem = cur - q * d;
      out.push(cur + " ÷ " + d + " = " + q + (q === 0 ? "  → write 0 in the answer" : "  (" + q + " × " + d + " = " + (q * d) + ", " + cur + " − " + (q * d) + " = " + rem + ")") +
        (i < ds.length - 1 ? ", bring down " + ds[i + 1] : ""));
      cur = rem;
    }
    return out;
  }
  function divMake(id, opt) {
    return function (prefTag) {
      var want = prefTag || (opt.tags && Math.random() < 0.35 ? "zero" : "plain");
      for (var tries = 0; tries < 5000; tries++) {
        var d = rnd(12, 99);
        if (d % 10 === 0) continue;
        var qMin = Math.max(2, Math.ceil(opt.min / d)), qMax = Math.floor(opt.max / d);
        if (qMin > qMax) continue;
        var q = rnd(qMin, qMax);
        if (q % 100 === 0) continue;   // 6,100 ÷ 61 = 100 のような易しすぎる問題は除く
        var r = opt.exact ? 0 : rnd(1, d - 1);
        var D = d * q + r;
        if (D < opt.min || D > opt.max) continue;
        var tag = opt.tags ? (hasInnerZero(q) ? "zero" : "plain") : null;
        if (opt.tags && tag !== want) continue;
        var steps = divSteps(D, d);
        steps.push("Check: " + fmt(q) + " × " + d + (r ? " + " + r : "") + " = " + fmt(D));
        return {
          type: id, tag: tag, kind: "div", D: D, d: d,
          text: fmt(D) + " ÷ " + d,
          fields: ["q", "r"], answer: { q: q, r: r }, steps: steps
        };
      }
      throw new Error("divMake failed: " + id);
    };
  }
  function divCheck(p, inp) {
    var q = num(inp.q), r = num(inp.r);
    if (q == null || r == null) return { status: "incomplete", hint: H("Fill in both boxes. If it divides exactly, the remainder is 0.", "2つの枠を両方入れてね。割り切れるときは余り0。") };
    var Q = p.answer.q, R = p.answer.r;
    if (q === Q && r === R) return { status: "correct" };
    if (r >= p.d) return { status: "wrong", code: "rem-too-big", hint: H("Your remainder is " + r + ", but the divisor is " + p.d + ". Can " + p.d + " go in one more time?", "余り " + r + " が割る数 " + p.d + " 以上になっているよ。もう1回割れるかな？") };
    if (hasInnerZero(Q) && !hasInnerZero(q) && String(Q).replace(/0/g, "") === String(q)) return { status: "wrong", code: "missing-zero", hint: H("When the number you bring down is too small to divide, do you need to write a 0 in the answer?", "下ろした数が割る数より小さいとき、商に0を立てる必要があるかな？") };
    if (q === Q) return { status: "wrong", code: "rem-wrong", hint: H("Your answer is right — check the last subtraction for the remainder.", "商は合っているよ。最後の引き算（余り）を見直そう。") };
    return { status: "wrong", code: "check", hint: H("Check it: " + fmt(q) + " × " + p.d + " + " + r + " should make " + fmt(p.D) + ". Does it?", "確かめ算：" + fmt(q) + " × " + p.d + " + " + r + " が " + fmt(p.D) + " になるかな？") };
  }

  /* ── 分数 ── */
  function simplest(maxDen) {
    for (;;) { var b = rnd(2, maxDen), a = rnd(1, b - 1); if (gcd(a, b) === 1) return { a: a, b: b }; }
  }
  function simpMake(id, ks) {
    return function () {
      var s = simplest(12), k = pick(ks), N = s.a * k, M = s.b * k;
      var g = gcd(N, M);
      return {
        type: id, tag: null, kind: "simp", N: N, M: M,
        text: N + "/" + M,
        fields: ["n", "m"], answer: { n: s.a, m: s.b },
        steps: [N + " and " + M + " can both be divided by " + g + " (the highest common factor).",
          N + " ÷ " + g + " = " + s.a + ",  " + M + " ÷ " + g + " = " + s.b + "  →  " + s.a + "/" + s.b,
          "Dividing in smaller steps is fine too — just keep going until nothing else divides both."]
      };
    };
  }
  function simpCheck(p, inp) {
    var n = num(inp.n), m = num(inp.m);
    if (n == null || m == null) return { status: "incomplete", hint: H("Fill in the top and the bottom.", "分子と分母の両方を入れてね。") };
    if (m === 0) return { status: "incomplete", hint: H("The bottom number can’t be 0.", "分母は0にできないよ。") };
    if (n === p.answer.n && m === p.answer.m) return { status: "correct" };
    if (n * p.M === m * p.N) {
      if (n === p.N && m === p.M) return { status: "wrong", code: "unchanged", hint: H("That’s the same fraction. Find a number that divides both " + p.N + " and " + p.M + ".", p.N + " と " + p.M + " の両方を割れる数を探そう。") };
      return { status: "wrong", code: "not-simplest", hint: H("Right value — but it can be simplified further. Is there still a number that divides both?", "値は合っているよ。でも、もう少し約分できるかな？ 両方を割れる数がまだある？") };
    }
    return { status: "wrong", code: "value-changed", hint: H("The fraction’s value changed. Divide the top and the bottom by the same number.", "値が変わってしまったよ。分子と分母を同じ数で割ろう。") };
  }

  // 同値分数：p1/q1 = p2/q2 の1か所が空欄
  function equivMake(id, dir) {
    return function (prefTag) {
      var tag = prefTag || pick(["find-num", "find-den"]);
      var s = simplest(12), L, R;
      if (dir === "up") { var k = rnd(2, 9); L = [s.a, s.b]; R = [s.a * k, s.b * k]; }
      else {   // 割る数が整数になるように j は K の約数
        var K, j; do { K = rnd(2, 12); j = rnd(1, K - 1); } while (K % j !== 0);
        L = [s.a * K, s.b * K]; R = [s.a * j, s.b * j];
      }
      var missing = tag === "find-num" ? 0 : 1;
      var known = 1 - missing;
      var op = dir === "up" ? "×" : "÷", f = dir === "up" ? R[known] / L[known] : L[known] / R[known];
      return {
        type: id, tag: tag, kind: "equiv", L: L, R: R, missing: missing, dir: dir,
        text: L[0] + "/" + L[1] + " = " + (missing === 0 ? "?/" + R[1] : R[0] + "/?"),
        fields: ["x"], answer: { x: R[missing] },
        steps: [L[known] + " " + op + " " + f + " = " + R[known] + (known === 1 ? "  (bottom)" : "  (top)"),
          "Do the same to the " + (missing === 0 ? "top" : "bottom") + ": " + L[missing] + " " + op + " " + f + " = " + R[missing]]
      };
    };
  }
  function equivCheck(p, inp) {
    var x = num(inp.x);
    if (x == null) return { status: "incomplete", hint: H("Type the missing number.", "空いているところの数を入れてね。") };
    if (p.missing === 1 && x === 0) return { status: "incomplete", hint: H("The bottom number can’t be 0.", "分母は0にできないよ。") };
    if (x === p.answer.x) return { status: "correct" };
    var m = p.missing, k = 1 - m;
    var additive = p.L[m] + (p.R[k] - p.L[k]);
    if (additive !== p.answer.x && x === additive) return { status: "wrong", code: "additive", hint: H("It looks like you added or took away. Equivalent fractions need the same × or ÷ on top and bottom.", "足し算・引き算でそろえたかな？ 同値分数は、分子と分母を同じ数でかける（割る）よ。") };
    var op = p.dir === "up" ? "×" : "÷";
    return { status: "wrong", code: "other", hint: H(p.L[k] + " " + op + " ? = " + p.R[k] + ". Then do the same to the other number.", p.L[k] + " " + op + " ? = " + p.R[k] + " を考えて、もう一方にも同じことをしよう。") };
  }

  /* ── 型の一覧（id は変えない） ── */
  var TYPES = {
    "mul-4by2":       { en: "4-digit × 2-digit", ja: "4桁×2桁", make: mulMake("mul-4by2", false), check: mulCheck },
    "mul-4by2-zero":  { en: "4-digit × 2-digit (with a 0 inside)", ja: "4桁×2桁（途中に0）", make: mulMake("mul-4by2-zero", true), check: mulCheck },
    "div-3by2-rem":   { en: "3-digit ÷ 2-digit", ja: "3桁÷2桁（余りあり）", make: divMake("div-3by2-rem", { min: 100, max: 999, exact: false }), check: divCheck },
    "div-4by2-exact": { en: "Long division (4-digit ÷ 2-digit)", ja: "4桁÷2桁（割り切れる）", make: divMake("div-4by2-exact", { min: 1000, max: 9999, exact: true, tags: true }), check: divCheck, tags: ["plain", "zero"] },
    "div-4by2-rem":   { en: "Long division with a remainder", ja: "4桁÷2桁（余りあり）", make: divMake("div-4by2-rem", { min: 1000, max: 9999, exact: false, tags: true }), check: divCheck, tags: ["plain", "zero"] },
    "frac-simplify":  { en: "Simplifying fractions", ja: "約分", make: simpMake("frac-simplify", [2, 3, 5, 7]), check: simpCheck },
    "frac-simplify-big": { en: "Simplifying fractions (more than one step)", ja: "約分（何回か割る）", make: simpMake("frac-simplify-big", [4, 6, 8, 9, 10, 12]), check: simpCheck },
    "frac-equiv-up":  { en: "Equivalent fractions (multiply)", ja: "同値分数（かける）", make: equivMake("frac-equiv-up", "up"), check: equivCheck, tags: ["find-num", "find-den"] },
    "frac-equiv-down": { en: "Equivalent fractions (divide)", ja: "同値分数（割る）", make: equivMake("frac-equiv-down", "down"), check: equivCheck, tags: ["find-num", "find-den"] }
  };

  var G = { TYPES: TYPES, gcd: gcd, fmt: fmt, num: num, divSteps: divSteps };
  if (typeof module !== "undefined" && module.exports) module.exports = G; else root.MATH_GEN = G;
})(this);
