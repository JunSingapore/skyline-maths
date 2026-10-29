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

  /* ── 分数のたし算・ひき算・帯分数（W8 追加） ── */
  function lcm(a, b) { return a / gcd(a, b) * b; }
  function red(n, d) { var g = gcd(n, d); return [n / g, d / g]; }           // 約分
  function coprimeTop(b) { for (;;) { var a = rnd(1, b - 1); if (gcd(a, b) === 1) return a; } }
  function frS(f) { return f[0] + "/" + f[1]; }                              // [n,d] → "n/d"
  function mixS(w, n, d) { return w + " " + n + "/" + d; }
  function toMixed(n, d) { return [Math.floor(n / d), n % d, d]; }           // 仮分数 → [整数, 分子, 分母]
  // 2つの分数の分母をそろえる途中式
  function commonSteps(A, B, op) {
    var L = lcm(A[1], B[1]), ka = L / A[1], kb = L / B[1];
    var s = [];
    if (A[1] === B[1]) return s;
    s.push("A common multiple of " + A[1] + " and " + B[1] + " is " + L + ".");
    var ch = [];
    if (ka > 1) ch.push(frS(A) + " = " + (A[0] * ka) + "/" + L + "  (× " + ka + ")");
    if (kb > 1) ch.push(frS(B) + " = " + (B[0] * kb) + "/" + L + "  (× " + kb + ")");
    s.push(ch.join(",  "));
    return s;
  }

  // A, B は [分子, 分母]。op は "+" か "−"
  function fopValue(A, B, op) {
    var L = lcm(A[1], B[1]), n = A[0] * (L / A[1]) + (op === "+" ? 1 : -1) * B[0] * (L / B[1]);
    return { n: n, L: L };
  }
  // 分母の組を選ぶ：related＝一方が他方の倍数／unlike＝どちらも割り切れない
  function denPair(rel) {
    for (;;) {
      var b, d;
      if (rel) { b = rnd(2, 6); d = b * rnd(2, 4); if (d > 24) continue; if (Math.random() < 0.5) { var t = b; b = d; d = t; } }
      else { b = rnd(2, 10); d = rnd(2, 12); if (b === d || b % d === 0 || d % b === 0 || lcm(b, d) > 40) continue; }
      return [b, d];
    }
  }
  // 結果が真分数（0 < x < 1）になるたし算・ひき算
  function fopMake(id, rel) {
    return function (prefTag) {
      var tag = prefTag || pick(["add", "sub"]), op = tag === "add" ? "+" : "−";
      for (;;) {
        var dd = denPair(rel), A = [coprimeTop(dd[0]), dd[0]], B = [coprimeTop(dd[1]), dd[1]];
        if (op === "−" && A[0] * B[1] <= B[0] * A[1]) { var t = A; A = B; B = t; }
        var v = fopValue(A, B, op);
        if (v.n <= 0 || v.n >= v.L) continue;
        var r = red(v.n, v.L);
        var steps = commonSteps(A, B, op);
        steps.push((A[0] * v.L / A[1]) + "/" + v.L + " " + op + " " + (B[0] * v.L / B[1]) + "/" + v.L + " = " + v.n + "/" + v.L + "  (only the tops change)");
        if (r[1] !== v.L) steps.push("Simplify: " + v.n + "/" + v.L + " = " + frS(r));
        return { type: id, tag: tag, kind: "fop", A: A, B: B, op: op, out: "frac",
          text: frS(A) + " " + op + " " + frS(B), fields: ["n", "m"], answer: { n: r[0], m: r[1] }, steps: steps };
      }
    };
  }
  // たし算で 1 を超える → 帯分数で答える
  function fopOverMake(id) {
    return function () {
      for (;;) {
        var dd = denPair(Math.random() < 0.3), A = [coprimeTop(dd[0]), dd[0]], B = [coprimeTop(dd[1]), dd[1]];
        var v = fopValue(A, B, "+");
        if (v.n <= v.L || v.n % v.L === 0) continue;
        var r = red(v.n, v.L), mx = toMixed(r[0], r[1]);
        var steps = commonSteps(A, B, "+");
        steps.push((A[0] * v.L / A[1]) + "/" + v.L + " + " + (B[0] * v.L / B[1]) + "/" + v.L + " = " + v.n + "/" + v.L);
        if (r[1] !== v.L) steps.push("Simplify: " + v.n + "/" + v.L + " = " + frS(r));
        steps.push(frS(r) + " is more than 1:  " + r[0] + " ÷ " + r[1] + " = " + mx[0] + " remainder " + mx[1] + "  →  " + mixS(mx[0], mx[1], mx[2]));
        return { type: id, tag: null, kind: "fop", A: A, B: B, op: "+", out: "mixed",
          text: frS(A) + " + " + frS(B), fields: ["w", "n", "m"], answer: { w: mx[0], n: mx[1], m: mx[2] }, steps: steps };
      }
    };
  }
  // 帯分数どうしのたし算・ひき算（答えは整数部分 1 以上の帯分数）
  function mopMake(id, op) {
    return function (prefTag) {
      var tag = op === "+" ? (prefTag || pick(["plain", "carry"])) : (prefTag || pick(["plain", "borrow"]));
      for (;;) {
        var dd = denPair(Math.random() < 0.4);
        if (lcm(dd[0], dd[1]) > 24) continue;
        var A = [coprimeTop(dd[0]), dd[0]], B = [coprimeTop(dd[1]), dd[1]];
        var w1 = rnd(1, 4), w2 = rnd(1, 3);
        var v = fopValue(A, B, op), L = v.L;
        var cross = op === "+" ? v.n > L : v.n < 0;           // 繰り上がり／繰り下がり
        if (v.n === 0 || v.n === L) continue;
        if (cross !== (tag !== "plain")) continue;
        if (op === "−") { w1 = w2 + rnd(cross ? 2 : 1, 3); }
        var total = (w1 * L + A[0] * L / A[1]) + (op === "+" ? 1 : -1) * (w2 * L + B[0] * L / B[1]);
        if (total <= L || total % L === 0) continue;
        var r = red(total, L), mx = toMixed(r[0], r[1]);
        var steps = commonSteps(A, B, op);
        if (op === "+") {
          steps.push("Wholes: " + w1 + " + " + w2 + " = " + (w1 + w2) + ".  Fractions: " + (A[0] * L / A[1]) + "/" + L + " + " + (B[0] * L / B[1]) + "/" + L + " = " + v.n + "/" + L);
          if (cross) steps.push(v.n + "/" + L + " is more than 1, so carry 1 whole to the wholes.");
        } else if (!cross) {
          steps.push("Wholes: " + w1 + " − " + w2 + " = " + (w1 - w2) + ".  Fractions: " + (A[0] * L / A[1]) + "/" + L + " − " + (B[0] * L / B[1]) + "/" + L + " = " + v.n + "/" + L);
        } else {
          steps.push((A[0] * L / A[1]) + "/" + L + " is smaller than " + (B[0] * L / B[1]) + "/" + L + ", so borrow 1 whole:  " + mixS(w1, A[0] * L / A[1], L) + " = " + mixS(w1 - 1, A[0] * L / A[1] + L, L));
          steps.push("Wholes: " + (w1 - 1) + " − " + w2 + " = " + (w1 - 1 - w2) + ".  Fractions: " + (A[0] * L / A[1] + L) + "/" + L + " − " + (B[0] * L / B[1]) + "/" + L + " = " + (v.n + L) + "/" + L);
        }
        steps.push("Answer: " + mixS(mx[0], mx[1], mx[2]) + (r[1] !== L ? "  (simplified)" : ""));
        return { type: id, tag: tag, kind: "mop", A: [w1, A[0], A[1]], B: [w2, B[0], B[1]], op: op, out: "mixed",
          text: mixS(w1, A[0], A[1]) + " " + op + " " + mixS(w2, B[0], B[1]), fields: ["w", "n", "m"],
          answer: { w: mx[0], n: mx[1], m: mx[2] }, steps: steps };
      }
    };
  }
  // 仮分数 ⇄ 帯分数
  function convMake(id, dir) {
    return function () {
      var d = rnd(2, 12), a = coprimeTop(d), w = rnd(1, 9), N = w * d + a;
      if (dir === "toMixed") return { type: id, tag: null, kind: "conv", dir: dir, N: N, D: d, out: "mixed",
        text: N + "/" + d, fields: ["w", "n", "m"], answer: { w: w, n: a, m: d },
        steps: ["How many " + d + "s are in " + N + "?  " + N + " ÷ " + d + " = " + w + " remainder " + a + ".",
          w + " wholes, and " + a + " " + d + (a === 1 ? "" : "s") + " left over  →  " + mixS(w, a, d)] };
      return { type: id, tag: null, kind: "conv", dir: dir, W: w, A: a, D: d, out: "frac",
        text: mixS(w, a, d), fields: ["n", "m"], answer: { n: N, m: d },
        steps: [w + " wholes = (" + w + " × " + d + ")/" + d + " = " + (w * d) + "/" + d,
          (w * d) + " + " + a + " = " + N + "  →  " + N + "/" + d] };
    };
  }

  // 答えの値（分数）を [分子, 分母] で
  function target(p) { var a = p.answer; return p.out === "mixed" ? [a.w * a.m + a.n, a.m] : [a.n, a.m]; }
  function wcheck(p, inp) {
    var mixed = p.out === "mixed";
    var w = mixed ? num(inp.w) : 0, n = num(inp.n), m = num(inp.m);
    if (n == null || m == null || w == null) return { status: "incomplete", hint: mixed ? H("Fill in all three boxes: the whole number, the top and the bottom.", "整数・分子・分母の3つを入れてね。") : H("Fill in the top and the bottom.", "分子と分母の両方を入れてね。") };
    if (m === 0) return { status: "incomplete", hint: H("The bottom number can’t be 0.", "分母は0にできないよ。") };
    var a = p.answer, T = target(p), vn = w * m + n;
    var same = vn * T[1] === T[0] * m;
    if (same) {
      if (mixed) {
        if (w === a.w && n === a.n && m === a.m) return { status: "correct" };
        if (n >= m) return { status: "wrong", code: "improper-part", hint: H("Right value — but the fraction part is 1 or more. Turn it into wholes.", "値は合っているよ。でも分数の部分が1以上だね。整数にくり上げよう。") };
        return { status: "wrong", code: "not-simplest", hint: H("Right value — can the fraction part be simplified?", "値は合っているよ。分数の部分はまだ約分できるかな？") };
      }
      if (n === a.n && m === a.m) return { status: "correct" };
      return { status: "wrong", code: "not-simplest", hint: p.kind === "conv" ? H("Right value — keep the same bottom number as the mixed number.", "値は合っているよ。分母は帯分数と同じにしよう。") : H("Right value — but it can be simplified. Is there a number that divides both?", "値は合っているよ。でも約分できるかな？") };
    }
    // よくある間違い
    if (p.kind === "fmd" || p.kind === "fword") return fmdWrong(p, vn, m);
    if (p.kind === "fop" || p.kind === "mop") {
      var A = p.kind === "mop" ? [p.A[1], p.A[2]] : p.A, B = p.kind === "mop" ? [p.B[1], p.B[2]] : p.B;
      var sg = p.op === "+" ? 1 : -1, L = lcm(A[1], B[1]);
      var fn = mixed ? n : vn, fm = m;
      if (p.kind === "mop" && p.op === "−" && p.tag === "borrow") {
        var sw = p.A[0] - p.B[0], sf = red(B[0] * L / B[1] - A[0] * L / A[1], L);
        if (w === sw && n * sf[1] === m * sf[0]) return { status: "wrong", code: "swapped", hint: H("The first fraction is smaller than the second, so you can’t take it away directly. Borrow 1 whole first.", "ひかれる方の分数が小さいね。そのままは引けないので、整数から1をかりてこよう。") };
      }
      if (p.kind === "mop" && mixed && n * T[1] === (T[0] % T[1]) * m && w !== a.w) return { status: "wrong", code: "wholes", hint: H("The fraction part is right — check the whole number" + (p.tag === "carry" ? " (did you carry 1?)" : p.tag === "borrow" ? " (did you take away the 1 you borrowed?)" : "") + ".", "分数の部分は合っているよ。整数の部分を見直そう" + (p.tag === "carry" ? "（くり上げた1を足した？）" : p.tag === "borrow" ? "（かりた1をひいた？）" : "") + "。") };
      var added = fm === A[1] + B[1] && (p.op === "+" || fn === Math.abs(A[0] + sg * B[0]));
      if (added || (p.op === "−" && fm === Math.abs(A[1] - B[1]) && fm > 0)) return { status: "wrong", code: "add-across", hint: H("It looks like you " + (added ? "added" : "subtracted") + " the bottom numbers. Make the bottoms the same first — then only the tops change.", "分母どうしを" + (added ? "足" : "引") + "したかな？ まず分母をそろえて、計算するのは分子だけだよ。") };
      if (fm === L && (fn === A[0] + sg * B[0] || fn === Math.abs(A[0] + sg * B[0]))) return { status: "wrong", code: "tops-not-changed", hint: H("Good common denominator! When the bottom changes, the top must change by the same ×.", "共通の分母はいいね！ 分母を何倍かしたら、分子も同じだけかけよう。") };
      return { status: "wrong", code: "other", hint: H("Find a common multiple of " + A[1] + " and " + B[1] + ", change both fractions, then " + (p.op === "+" ? "add" : "subtract") + " the tops.", A[1] + " と " + B[1] + " の公倍数で分母をそろえて、分子だけ計算しよう。") };
    }
    if (p.dir === "toImp") {
      if (n === p.W + p.A) return { status: "wrong", code: "added-whole", hint: H("Each whole is " + p.D + "/" + p.D + ". How many " + p.D + "ths are in " + p.W + " wholes?", "1は " + p.D + "/" + p.D + " だよ。" + p.W + " は " + p.D + " 分のいくつかな？") };
      if (n === p.W * p.D) return { status: "wrong", code: "forgot-top", hint: H("You turned the wholes into " + p.D + "ths — now add the top of the fraction part too.", "整数の部分は直せたね。分数の部分の分子も足そう。") };
      return { status: "wrong", code: "other", hint: H("Multiply the whole number by the bottom, then add the top.", "整数 × 分母 ＋ 分子 だよ。") };
    }
    // toMixed
    if (m === p.D && n < m && w !== a.w) return { status: "wrong", code: "wholes", hint: H("How many times does " + p.D + " go into " + p.N + "?", p.N + " の中に " + p.D + " はいくつ入るかな？") };
    return { status: "wrong", code: "other", hint: H("Divide the top by the bottom: the answer is the wholes, the remainder is the new top.", "分子 ÷ 分母：商が整数、余りが新しい分子だよ。") };
  }

  /* ── 分数のかけ算・わり算と文章題（W9 追加） ── */
  // 演算の値。A, B は [分子, 分母]（整数は [k, 1]）。結果は約分前の [分子, 分母]
  function fmdValue(A, B, op) {
    if (op === "×") return [A[0] * B[0], A[1] * B[1]];
    if (op === "÷") return [A[0] * B[1], A[1] * B[0]];
    return [A[0] * B[1] + (op === "+" ? 1 : -1) * B[0] * A[1], A[1] * B[1]];
  }
  function opS(f) { return f[1] === 1 ? String(f[0]) : frS(f); }
  // 結果 [分子, 分母] → 答え（約分し、1を超えたら帯分数）
  function fmdAnswer(v) {
    var r = red(v[0], v[1]);
    if (r[0] > r[1]) { var mx = toMixed(r[0], r[1]); return { out: "mixed", fields: ["w", "n", "m"], answer: { w: mx[0], n: mx[1], m: mx[2] }, r: r }; }
    return { out: "frac", fields: ["n", "m"], answer: { n: r[0], m: r[1] }, r: r };
  }
  function fmdSteps(A, B, op) {
    var v = fmdValue(A, B, op), r = red(v[0], v[1]), s = [];
    if (op === "×") {
      if (B[1] === 1) s.push(B[0] + " is the same as " + B[0] + "/1.");
      s.push("Tops: " + A[0] + " × " + B[0] + " = " + v[0] + ".  Bottoms: " + A[1] + " × " + B[1] + " = " + v[1] + ".  → " + frS(v));
    } else if (op === "÷") {
      var flip = [B[1], B[0]];
      s.push("Keep " + frS(A) + ", change ÷ to ×, flip " + opS(B) + " to " + frS(flip) + ".");
      s.push(frS(A) + " × " + frS(flip) + " = " + v[0] + "/" + v[1]);
    } else {
      s = commonSteps(A, B, op);
      var L = lcm(A[1], B[1]), f = fopValue(A, B, op);
      s.push((A[0] * L / A[1]) + "/" + L + " " + op + " " + (B[0] * L / B[1]) + "/" + L + " = " + f.n + "/" + L);
      v = [f.n, L]; r = red(f.n, L);
    }
    if (r[1] !== v[1]) s.push("Simplify: " + frS(v) + " = " + frS(r));
    if (r[0] > r[1]) { var mx = toMixed(r[0], r[1]); s.push(frS(r) + " is more than 1:  " + r[0] + " ÷ " + r[1] + " = " + mx[0] + " remainder " + mx[1] + "  →  " + mixS(mx[0], mx[1], mx[2])); }
    return s;
  }
  function properFrac(dmin, dmax) { var d = rnd(dmin, dmax); return [coprimeTop(d), d]; }
  // shape: "ff"＝分数×分数／"fw"＝分数×整数（答えは帯分数）。"÷" の "ff" は答えが真分数になる組
  function fmdMake(id, op, shape) {
    return function () {
      for (;;) {
        var A = properFrac(2, 10), B = shape === "fw" ? [rnd(2, 9), 1] : properFrac(2, 10);
        if (op === "÷" && shape === "fw" && B[0] > 6) continue;
        var v = fmdValue(A, B, op), r = red(v[0], v[1]);
        if (r[1] === 1) continue;                                   // 割り切れて整数になるものは出さない
        if (op === "×" && shape === "fw" && r[0] < r[1]) continue;  // 整数をかける型は 1 を超えるものだけ
        if (op === "÷" && shape === "ff" && (A[0] * B[1] >= B[0] * A[1] || A[1] === B[1])) continue;
        if (op === "×" && shape === "ff" && A[1] === B[1] && A[0] === B[0]) continue;
        var ans = fmdAnswer(v);
        return { type: id, tag: null, kind: "fmd", A: A, B: B, op: op, out: ans.out,
          text: opS(A) + " " + op + " " + opS(B), fields: ans.fields, answer: ans.answer, steps: fmdSteps(A, B, op) };
      }
    };
  }
  // 文章題。名前は入れない。tag＝使う計算
  var STORIES = {
    div: function () { var A = properFrac(2, 9), k = rnd(2, 5); return { A: A, B: [k, 1], op: "÷", unit: "m",
      story: "A ribbon is " + frS(A) + " m long. It is cut into " + k + " equal pieces. How long is each piece?" }; },
    mul: function () { var A = properFrac(2, 8), k = rnd(3, 9); return { A: A, B: [k, 1], op: "×", unit: "cups",
      story: "One cake needs " + frS(A) + " of a cup of sugar. How many cups of sugar are needed for " + k + " cakes?" }; },
    of: function () { var A = properFrac(2, 6), B = properFrac(2, 6); return { A: A, B: B, op: "×", unit: "of the garden",
      story: frS(A) + " of a garden is grass. Flowers grow on " + frS(B) + " of the grass. What fraction of the whole garden has flowers?" }; },
    add: function () { var A = properFrac(2, 8), B = properFrac(2, 8); return { A: A, B: B, op: "+", unit: "km",
      story: "A walker goes " + frS(A) + " km in the morning and " + frS(B) + " km in the afternoon. How far is that altogether?" }; }
  };
  function wordMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["div", "mul", "of", "add"]);
      for (;;) {
        var st = STORIES[tag](), v = fmdValue(st.A, st.B, st.op), r = red(v[0], v[1]);
        if (r[1] === 1 || r[0] <= 0) continue;
        if ((tag === "mul" || tag === "add") && r[0] < r[1]) continue;   // 1 を超えて帯分数で答える
        if (st.op === "+" && st.A[1] === st.B[1]) continue;
        var ans = fmdAnswer(v), steps = ["Calculation: " + opS(st.A) + " " + st.op + " " + opS(st.B)].concat(fmdSteps(st.A, st.B, st.op));
        return { type: id, tag: tag, kind: "fword", A: st.A, B: st.B, op: st.op, out: ans.out, unit: st.unit, story: st.story,
          text: st.story, fields: ans.fields, answer: ans.answer, steps: steps };
      }
    };
  }
  // かけ算・わり算・文章題のよくある間違い（値が正解と違うとき）
  function fmdWrong(p, vn, m) {
    var A = p.A, B = p.B;
    function is(f) { return f[1] !== 0 && vn * f[1] === f[0] * m; }
    var word = p.kind === "fword";
    if (p.op === "+") {
      if (is([A[0] + B[0], A[1] + B[1]])) return { status: "wrong", code: "add-across", hint: H("It looks like you added the bottom numbers. Make the bottoms the same first — then only the tops change.", "分母どうしを足したかな？ まず分母をそろえて、計算するのは分子だけだよ。") };
      return { status: "wrong", code: "other", hint: H("Find a common multiple of " + A[1] + " and " + B[1] + ", change both fractions, then add the tops.", A[1] + " と " + B[1] + " の公倍数で分母をそろえて、分子だけ足そう。") };
    }
    if (word && p.op === "×" && B[1] === 1 && is([A[0], A[1] * B[0]])) return { status: "wrong", code: "wrong-op", hint: H("Each cake needs the same amount, and there are more cakes — should the total be bigger or smaller?", "ケーキが増えると、砂糖は増える？減る？ どの計算か考えてみよう。") };
    if (word && p.op === "÷" && is([A[0] * B[0], A[1]])) return { status: "wrong", code: "wrong-op", hint: H("The pieces are shorter than the whole ribbon — should your answer be bigger or smaller?", "1本ずつはもとのリボンより短いはずだね。どの計算か考えてみよう。") };
    if (p.op === "×") {
      if (B[1] === 1) {
        if (is(A)) return { status: "wrong", code: "both-times", hint: H("Did you multiply the bottom by " + B[0] + " too? Think of " + B[0] + " as " + B[0] + "/1.", "分母にも " + B[0] + " をかけたかな？ " + B[0] + " は " + B[0] + "/1 と考えよう。") };
        return { status: "wrong", code: "other", hint: H("Think of " + B[0] + " as " + B[0] + "/1. Multiply the tops, multiply the bottoms, then simplify.", B[0] + " を " + B[0] + "/1 と考えて、分子どうし・分母どうしをかけ、最後に約分しよう。") };
      }
      if (is([A[0] + B[0], A[1] + B[1]])) return { status: "wrong", code: "added", hint: H("It looks like you added. For ×, multiply the tops together and the bottoms together.", "足し算をしたかな？ かけ算は、分子どうし・分母どうしをかけるよ。") };
      var L = lcm(A[1], B[1]);
      if (A[1] !== B[1] && is([(A[0] * L / A[1]) * (B[0] * L / B[1]), L])) return { status: "wrong", code: "common-den", hint: H("No common denominator is needed for ×. Multiply the tops and the bottoms as they are.", "かけ算では分母をそろえなくていいよ。そのまま分子どうし・分母どうしをかけよう。") };
      return { status: "wrong", code: "other", hint: H("Top × top, bottom × bottom — then simplify.", "分子 × 分子、分母 × 分母。そのあと約分できるかな？") };
    }
    // ÷
    if (B[1] === 1) {
      if (is([A[0] * B[0], A[1]])) return { status: "wrong", code: "multiplied", hint: H("Dividing by " + B[0] + " should make it smaller. ÷ " + B[0] + " is the same as × 1/" + B[0] + ".", B[0] + " で割ると小さくなるはずだね。÷ " + B[0] + " は × 1/" + B[0] + " と同じだよ。") };
      return { status: "wrong", code: "other", hint: H("÷ " + B[0] + " is the same as × 1/" + B[0] + ". Multiply the bottom number by " + B[0] + ".", "÷ " + B[0] + " は × 1/" + B[0] + " と同じ。分母に " + B[0] + " をかけてみよう。") };
    }
    if (is([A[0] * B[0], A[1] * B[1]])) return { status: "wrong", code: "no-flip", hint: H("It looks like you multiplied straight across. For ÷, flip the second fraction first.", "そのままかけたかな？ わり算は、2つ目の分数をひっくり返してからかけるよ。") };
    if (is([A[1] * B[0], A[0] * B[1]])) return { status: "wrong", code: "flip-first", hint: H("Keep the FIRST fraction as it is — flip only the second one.", "ひっくり返すのは2つ目の分数だけ。1つ目はそのままだよ。") };
    return { status: "wrong", code: "other", hint: H("Keep the first fraction, change ÷ to ×, flip the second, then simplify.", "1つ目はそのまま、÷ を × に、2つ目をひっくり返す。最後に約分しよう。") };
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
    "frac-equiv-down": { en: "Equivalent fractions (divide)", ja: "同値分数（割る）", make: equivMake("frac-equiv-down", "down"), check: equivCheck, tags: ["find-num", "find-den"] },
    "frac-addsub-related": { en: "Add & subtract (one bottom is a multiple of the other)", ja: "分数のたし算・ひき算（一方の分母にそろえる）", make: fopMake("frac-addsub-related", true), check: wcheck, tags: ["add", "sub"] },
    "frac-addsub-unlike": { en: "Add & subtract (find a common denominator)", ja: "分数のたし算・ひき算（公倍数でそろえる）", make: fopMake("frac-addsub-unlike", false), check: wcheck, tags: ["add", "sub"] },
    "frac-add-over-one": { en: "Adding fractions to more than 1", ja: "答えが1を超えるたし算（帯分数で）", make: fopOverMake("frac-add-over-one"), check: wcheck },
    "frac-to-mixed":    { en: "Improper fraction → mixed number", ja: "仮分数 → 帯分数", make: convMake("frac-to-mixed", "toMixed"), check: wcheck },
    "mixed-to-improper": { en: "Mixed number → improper fraction", ja: "帯分数 → 仮分数", make: convMake("mixed-to-improper", "toImp"), check: wcheck },
    "mixed-add":        { en: "Adding mixed numbers", ja: "帯分数のたし算", make: mopMake("mixed-add", "+"), check: wcheck, tags: ["plain", "carry"] },
    "mixed-sub":        { en: "Subtracting mixed numbers", ja: "帯分数のひき算", make: mopMake("mixed-sub", "−"), check: wcheck, tags: ["plain", "borrow"] },
    "frac-mul":         { en: "Multiplying fractions", ja: "分数 × 分数", make: fmdMake("frac-mul", "×", "ff"), check: wcheck },
    "frac-mul-whole":   { en: "Fraction × whole number", ja: "分数 × 整数（帯分数で）", make: fmdMake("frac-mul-whole", "×", "fw"), check: wcheck },
    "frac-div-whole":   { en: "Fraction ÷ whole number", ja: "分数 ÷ 整数", make: fmdMake("frac-div-whole", "÷", "fw"), check: wcheck },
    "frac-div":         { en: "Dividing by a fraction", ja: "分数 ÷ 分数（ひっくり返してかける）", make: fmdMake("frac-div", "÷", "ff"), check: wcheck },
    "frac-word":        { en: "Fraction word problems", ja: "分数の文章題", make: wordMake("frac-word"), check: wcheck, tags: ["div", "mul", "of", "add"] }
  };

  var G = { TYPES: TYPES, gcd: gcd, fmt: fmt, num: num, divSteps: divSteps };
  if (typeof module !== "undefined" && module.exports) module.exports = G; else root.MATH_GEN = G;
})(this);
