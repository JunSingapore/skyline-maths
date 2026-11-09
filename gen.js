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

  /* ── 測定：周の長さ・面積・体積（W10 追加） ── */
  // 答えは整数1つ（field x）。fig＝図のデータ（index.html が SVG で描く・縮尺どおりではない）
  var U2 = { cm: "cm²", m: "m²" }, U3 = { cm: "cm³", m: "m³", mm: "mm³" };
  function measP(id, tag, shape, d, unit, ans, steps, extra) {
    var p = { type: id, tag: tag, kind: "meas", shape: shape, d: d, unit: unit, fields: ["x"], answer: { x: ans }, steps: steps };
    for (var k in extra || {}) p[k] = extra[k];
    if (!p.text) p.text = measText(p);
    return p;
  }
  // 図形問題の文字版（結果画面・保護者メモで、どの問題か分かるように）
  function measText(p) {
    var d = p.d, u = p.u || "cm", q = { perimeter: "Perimeter", area: "Area", volume: "Volume" }[p.ask];
    if (p.shape === "rect") return q + " of a rectangle " + d.w + " " + u + " × " + d.h + " " + u;
    if (p.shape === "lshape") return q + " of an L-shape (" + d.W + " × " + d.H + " with a " + d.a + " × " + d.b + " corner cut out)";
    if (p.shape === "para") return "Area of a parallelogram: base " + d.b + " cm, height " + d.h + " cm, slanted side " + d.s + " cm";
    if (p.shape === "tri") return "Area of a triangle: base " + d.b + " cm, height " + d.h + " cm" + (d.s ? ", slanted side " + d.s + " cm" : "") + (p.tag === "obtuse" ? " (height outside)" : "");
    return "Volume of a cuboid " + d.l + " × " + d.w + " × " + d.h + " " + u;
  }
  // 周の長さ：rect＝長方形／lshape＝L字（2辺が書いていない）
  function perimMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["rect", "lshape"]);
      if (tag === "rect") {
        var w = rnd(4, 25), h = rnd(3, 18); if (w === h) h++;
        return measP(id, tag, "rect", { w: w, h: h }, "cm", 2 * (w + h), [
          "Perimeter = all the way round: " + w + " + " + h + " + " + w + " + " + h,
          "= 2 × (" + w + " + " + h + ") = 2 × " + (w + h) + " = " + 2 * (w + h) + " cm"], { ask: "perimeter" });
      }
      var L = lshape();
      return measP(id, tag, "lshape", L, "cm", 2 * (L.W + L.H), [
        "The unmarked sides: " + L.W + " − " + (L.W - L.a) + " = " + L.a + " and " + L.H + " − " + (L.H - L.b) + " = " + L.b + ".",
        "All the way round: " + L.W + " + " + L.H + " + " + (L.W - L.a) + " + " + L.b + " + " + L.a + " + " + (L.H - L.b) + " = " + 2 * (L.W + L.H) + " cm",
        "(Shortcut: it is the same as the big rectangle, 2 × (" + L.W + " + " + L.H + ").)"], { ask: "perimeter" });
    };
  }
  // L字：W×H の右上から a×b を切り取った形。図に書くのは W・H・上の辺(W−a)・右の辺(H−b)
  function lshape() {
    var W = rnd(8, 20), H = rnd(6, 16), a = rnd(2, W - 3), b = rnd(2, H - 3);
    return { W: W, H: H, a: a, b: b };
  }
  function areaRectMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["rect", "lshape"]);
      if (tag === "rect") {
        var w = rnd(4, 25), h = rnd(3, 15); if (w === h) h++;
        return measP(id, tag, "rect", { w: w, h: h }, "cm²", w * h, ["Area = length × width = " + w + " × " + h + " = " + w * h + " cm²"], { ask: "area" });
      }
      var L = lshape(), big = L.W * L.H, cut = L.a * L.b;
      return measP(id, tag, "lshape", L, "cm²", big - cut, [
        "The missing corner is " + L.W + " − " + (L.W - L.a) + " = " + L.a + " wide and " + L.H + " − " + (L.H - L.b) + " = " + L.b + " tall.",
        "Big rectangle: " + L.W + " × " + L.H + " = " + big + ".  Missing corner: " + L.a + " × " + L.b + " = " + cut + ".",
        big + " − " + cut + " = " + (big - cut) + " cm²  (or split it into two rectangles)"], { ask: "area" });
    };
  }
  // 斜めの辺 s：水平のずれ √(s²−h²) が底辺の 0.2〜0.8 倍に収まる整数（図と数字が矛盾しない）。無ければ null
  function slantSide(b, h) {
    var ok = [];
    for (var s = h + 1; s * s <= h * h + 0.64 * b * b; s++) if (s * s >= h * h + 0.04 * b * b) ok.push(s);
    return ok.length ? pick(ok) : null;
  }
  function areaParaMake(id) {
    return function () {
      var b, h, s;
      do { b = rnd(4, 15); h = rnd(3, 12); s = slantSide(b, h); } while (s == null);
      return measP(id, null, "para", { b: b, h: h, s: s }, "cm²", b * h, [
        "Area of a parallelogram = base × perpendicular height (the dashed line, not the slanted side).",
        b + " × " + h + " = " + b * h + " cm²"], { ask: "area" });
    };
  }
  // 三角形：right＝直角三角形／slant＝高さが点線（斜めの辺も書いてある）／obtuse＝鈍角で高さが外（底辺をのばした先）
  function areaTriMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["right", "slant", "obtuse"]);
      for (;;) {
        var b = rnd(4, 20), h = rnd(3, 16);
        if ((b * h) % 2) continue;
        var d = { b: b, h: h };
        if (tag !== "right") { d.s = slantSide(b, h); if (d.s == null) continue; }
        return measP(id, tag, "tri", d, "cm²", b * h / 2, [
          "Area of a triangle = base × height ÷ 2 (it is half of a rectangle)." + (tag === "obtuse" ? " The height can be outside the triangle — it is still the straight-up distance to the top." : ""),
          b + " × " + h + " = " + b * h + ",  " + b * h + " ÷ 2 = " + b * h / 2 + " cm²"], { ask: "area" });
      }
    };
  }
  function volMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["cm", "m", "mm"]);
      for (;;) {
        var l = tag === "cm" ? rnd(3, 15) : tag === "mm" ? rnd(5, 30) : rnd(2, 9), w = tag === "cm" ? rnd(2, 10) : tag === "mm" ? rnd(3, 20) : rnd(2, 8), h = tag === "cm" ? rnd(2, 12) : tag === "mm" ? rnd(2, 10) : rnd(2, 6);
        if (l === w && w === h) continue;
        return measP(id, tag, "cuboid", { l: l, w: w, h: h }, U3[tag], l * w * h, [
          "Volume = length × width × height",
          l + " × " + w + " = " + l * w + ",  " + l * w + " × " + h + " = " + l * w * h + " " + U3[tag]], { ask: "volume", u: tag });
      }
    };
  }
  // 単位の換算（答えは整数）。tag：length＝長さ／area＝面積（cm²・m²・mm²）／volume＝体積（cm³・m³・mm³・litre）
  // [大きい単位, 小さい単位, 何倍, 1辺あたりの倍（面積・体積の説明用）]
  var CONV = {
    length: [["m", "cm", 100], ["km", "m", 1000], ["cm", "mm", 10]],
    area: [["m²", "cm²", 10000, 100], ["cm²", "mm²", 100, 10]],
    volume: [["m³", "cm³", 1000000, 100], ["cm³", "mm³", 1000, 10], ["litres", "cm³", 1000]],
    mass: [["kg", "g", 1000], ["tonnes", "kg", 1000]],
    time: [["hours", "minutes", 60], ["minutes", "seconds", 60], ["days", "hours", 24], ["weeks", "days", 7]]
  };
  function convMeasMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(id === "meas-convert-mt" ? ["mass", "time"] : ["length", "area", "volume"]), c = pick(CONV[tag]);
      var down = tag === "length" || tag === "mass" || tag === "time" ? Math.random() < 0.5 : Math.random() < 0.75;   // down＝大きい単位 → 小さい単位（かける）
      var v = tag === "volume" && c[2] === 1000000 ? rnd(2, 9) : tag === "time" ? rnd(2, c[2] === 7 ? 9 : 12) : rnd(2, tag === "length" ? 60 : 25);
      var big = c[0], small = c[1], k = c[2], one = "1 " + big.replace(/^(litre|tonne|hour|minute|day|week)s$/, "$1") + " = " + fmt(k) + " " + small;
      var su = small.replace(/[²³]/, ""), bu = big.replace(/[²³]/, "");
      var why = c[3] ? "  (a 1 " + bu + (tag === "volume" ? " cube" : " square") + " is " + c[3] + " " + su + " × " + c[3] + " " + su + (tag === "volume" ? " × " + c[3] + " " + su : "") + ")" : "";
      var from = down ? v : v * k, ans = down ? v * k : v;
      return measP(id, tag, null, { v: from, k: k, side: c[3] || null, down: down }, down ? small : big, ans,
        [one + why, down ? fmt(v) + " × " + fmt(k) + " = " + fmt(ans) + " " + small : fmt(v * k) + " ÷ " + fmt(k) + " = " + ans + " " + big],
        { conv: { v: from, from: down ? big : small, to: down ? small : big }, text: fmt(from) + " " + (down ? big : small) + " = ? " + (down ? small : big) });
    };
  }
  // 測定の文章題（PMC 風・名前なし）
  var MSTORIES = {
    "missing-side": function () {
      var w = rnd(3, 12), h = rnd(4, 15), A = w * h;
      return { unit: "cm", ans: h, d: { A: A, w: w },
        story: "A rectangle has an area of " + A + " cm². One side is " + w + " cm long. How long is the other side?",
        steps: ["Area = length × width, so the other side = area ÷ " + w + ".", A + " ÷ " + w + " = " + h + " cm"] };
    },
    square: function () {
      var s = rnd(3, 15), P = 4 * s;
      return { unit: "cm²", ans: s * s, d: { P: P, s: s },
        story: "A square has a perimeter of " + P + " cm. What is its area?",
        steps: ["A square has 4 equal sides: " + P + " ÷ 4 = " + s + " cm each.", "Area = " + s + " × " + s + " = " + s * s + " cm²"] };
    },
    cubes: function () {
      var k = pick([2, 2, 3]), a = rnd(2, 5), b = rnd(2, 4), c = rnd(1, 3);
      var L = a * k, W = b * k, Hh = c * k;
      return { unit: "cubes", ans: a * b * c, d: { k: k, L: L, W: W, H: Hh },
        story: "A box measures " + L + " cm by " + W + " cm by " + Hh + " cm inside. How many " + k + " cm cubes fit inside exactly?",
        steps: ["Along each edge: " + L + " ÷ " + k + " = " + a + ",  " + W + " ÷ " + k + " = " + b + ",  " + Hh + " ÷ " + k + " = " + c + ".",
          a + " × " + b + " × " + c + " = " + a * b * c + " cubes"] };
    },
    fence: function () {
      var l = rnd(5, 20), w = rnd(3, 12), c = rnd(2, 9); if (l === w) l++;
      return { unit: "£", pre: true, ans: 2 * (l + w) * c, d: { l: l, w: w, c: c },
        story: "A rectangular garden is " + l + " m long and " + w + " m wide. Fencing costs £" + c + " per metre. How much does it cost to fence all the way round?",
        steps: ["Distance round: 2 × (" + l + " + " + w + ") = " + 2 * (l + w) + " m.", 2 * (l + w) + " × £" + c + " = £" + 2 * (l + w) * c] };
    }
  };
  function mwordMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["missing-side", "square", "cubes", "fence"]), st;
      do st = MSTORIES[tag](); while (new RegExp("(^|[^0-9])" + st.ans + "([^0-9]|$)").test(st.story));   // 答えの数が文中に出るものは出さない
      return measP(id, tag, null, st.d, st.unit, st.ans, st.steps, { story: st.story, text: st.story, pre: !!st.pre });
    };
  }

  // 測定のよくある間違い：[値, code, 手がかり]（答えと同じ値のものは使わない）
  function measTraps(p) {
    var d = p.d, t = [];
    function T_(v, code, en, ja) { t.push([v, code, H(en, ja)]); }
    var areaVsPerim = H("That looks like the " + (p.ask === "area" ? "perimeter (all the way round)" : "area (the space inside)") + ". Which one does the question ask for?",
      (p.ask === "area" ? "周の長さ（まわり）" : "面積（中の広さ）") + "を出したかな？ 聞かれているのはどっち？");
    if (p.type === "meas-perimeter") {
      if (p.tag === "rect") {
        t.push([d.w * d.h, "area-not-perimeter", areaVsPerim]);
        T_(d.w + d.h, "half", "Did you add just two sides? A rectangle has four sides — go all the way round.", "2辺だけ足したかな？ 長方形の辺は4つ。ぐるっと一周しよう。");
      } else {
        T_(d.W + d.H + (d.W - d.a) + (d.H - d.b), "missing-sides", "Did you add every side? Two sides have no number on them — work them out too.", "数字が書いていない辺が2つあるよ。長さを考えて、それも足そう。");
        t.push([d.W * d.H - d.a * d.b, "area-not-perimeter", areaVsPerim]);
      }
    } else if (p.type === "meas-area-rect") {
      if (p.tag === "rect") {
        t.push([2 * (d.w + d.h), "perimeter-not-area", areaVsPerim]);
        T_(d.w + d.h, "added", "For area, multiply — don’t add.", "面積はかけ算だよ。足すのではなく、かけよう。");
      } else {
        T_(d.W * d.H, "whole-box", "Is that the whole big rectangle? A corner is missing — what should happen to it?", "大きな長方形全体の面積かな？ 欠けている角はどうする？");
        T_(d.W * d.H - (d.W - d.a) * (d.H - d.b), "wrong-corner", "Check the size of the missing corner: how wide and how tall is it?", "欠けている角の、たてと横の長さをもう一度考えよう。");
        t.push([2 * (d.W + d.H), "perimeter-not-area", areaVsPerim]);
      }
    } else if (p.type === "meas-area-para") {
      T_(d.b * d.s, "slant", "Use the height that is straight up (the dashed line), not the slanted side.", "斜めの辺ではなく、まっすぐの高さ（点線）を使おう。");
      if ((d.b * d.h) % 2 === 0) T_(d.b * d.h / 2, "halved", "No ÷ 2 for a parallelogram — that is for triangles.", "平行四辺形は ÷2 しないよ（÷2 は三角形）。");
      T_(2 * (d.b + d.s), "perimeter-not-area", "That looks like the distance all the way round. Area is base × height.", "まわりの長さを出したかな？ 面積は 底辺 × 高さ だよ。");
    } else if (p.type === "meas-area-tri") {
      T_(d.b * d.h, "no-half", "A triangle is half of a rectangle. Did you remember to halve?", "三角形は長方形の半分だよ。÷2 したかな？");
      if (d.s) { T_(d.b * d.s, "slant", "Use the height that is straight up (the dashed line), not the slanted side.", "斜めの辺ではなく、まっすぐの高さ（点線）を使おう。");
        if ((d.b * d.s) % 2 === 0) T_(d.b * d.s / 2, "slant", "Use the height that is straight up (the dashed line), not the slanted side.", "斜めの辺ではなく、まっすぐの高さ（点線）を使おう。"); }
    } else if (p.type === "meas-volume") {
      T_(d.l + d.w + d.h, "added", "For volume, multiply all three lengths.", "体積は3つの長さをかけるよ。");
      [d.l * d.w, d.l * d.h, d.w * d.h].forEach(function (v) { T_(v, "two-dims", "That uses only two lengths (that is an area). Volume needs all three.", "2つの長さだけだと面積になるよ。体積は3つ全部かけよう。"); });
    } else if (p.type === "meas-convert" || p.type === "meas-convert-mt") {
      var f = d.down ? function (k) { return d.v * k; } : function (k) { return d.v % k === 0 ? d.v / k : -1; };
      T_(d.down ? (d.v % d.k === 0 ? d.v / d.k : -1) : d.v * d.k, "wrong-way", "Check the direction: is the new unit bigger or smaller? Should the number get bigger or smaller?", "単位が大きくなる？小さくなる？ 数は増える？減る？ 向きを確かめよう。");
      if (d.side) { T_(f(d.side), "length-factor", "That uses the length change. For " + (p.tag === "area" ? "area, it happens in 2 directions" : "volume, it happens in 3 directions") + ".", "それは長さの換算だね。" + (p.tag === "area" ? "面積はたて・横の2方向" : "体積はたて・横・高さの3方向") + "に効くよ。");
        if (p.tag === "volume") T_(f(d.side * d.side), "length-factor", "That is only 2 directions. Volume has 3: length, width and height.", "それは2方向分だね。体積はたて・横・高さの3方向だよ。"); }
      if (p.tag === "time") { if (d.k !== 100) T_(f(100), "time-100", "Time does not work in 100s! How many minutes in an hour? Seconds in a minute? Hours in a day? Days in a week?", "時間は100ずつではないよ。1時間＝60分、1分＝60秒、1日＝24時間、1週間＝7日。"); }
      else [10, 100, 1000].forEach(function (k) { if (k !== d.k) T_(f(k), "wrong-factor", "Check how many small units make one big unit.", "大きい単位1つは、小さい単位いくつ分か確かめよう。"); });
    } else if (p.tag === "missing-side") {
      T_(d.A - d.w, "subtracted", "Area is length × width. Which number times " + d.w + " makes the area?", "面積＝たて × 横。" + d.w + " に何をかけると面積になるかな？");
      T_(d.A * d.w, "multiplied", "The other side must be shorter than the area number. Try dividing.", "答えは面積の数より小さいはず。わり算を考えよう。");
    } else if (p.tag === "square") {
      T_(d.s, "side-only", "Could that be just one side? The question asks for the area.", "それは1辺の長さかな？ 聞かれているのは面積だよ。");
      T_(d.P * d.P, "perimeter-squared", "First find one side: a square has 4 equal sides.", "まず1辺を出そう。正方形の辺は4つとも同じ長さだよ。");
      T_((d.P / 2) * (d.P / 2), "half", "A square has 4 equal sides, not 2. Find one side first.", "正方形の辺は4つ。まず1辺の長さを出そう。");
    } else if (p.tag === "cubes") {
      T_(d.L * d.W * d.H, "cm-cubes", "Did you count 1 cm cubes? These cubes are " + d.k + " cm long — how many fit along each edge?", "1cmの立方体で数えたかな？ この立方体は1辺 " + d.k + " cm。それぞれの辺に何個並ぶかな？");
      if ((d.L * d.W * d.H) % d.k === 0) T_(d.L * d.W * d.H / d.k, "divided-once", "Divide each edge by " + d.k + " first, then multiply.", "先にそれぞれの辺を " + d.k + " で割ってから、かけよう。");
    } else if (p.tag === "fence") {
      T_(d.l * d.w * d.c, "area", "A fence goes round the edge. Did you use the area instead of the distance round?", "フェンスはまわりに立てるもの。面積ではなく周の長さを使おう。");
      T_((d.l + d.w) * d.c, "half", "Go all the way round: there are four sides.", "まわりは4辺あるよ。ぐるっと一周しよう。");
      T_(2 * (d.l + d.w), "no-cost", "Is that the length of the fence? The question asks for the cost.", "それはフェンスの長さかな？ 聞かれているのは値段だよ。");
    }
    return t;
  }
  var MGEN = {
    perimeter: H("Perimeter is the distance all the way round. Add every side.", "周の長さは、まわりをぐるっと一周した長さ。全部の辺を足そう。"),
    area: H("Area = length × width. For other shapes, check the formula.", "面積は たて × 横。形によって公式を確かめよう。"),
    para: H("Area of a parallelogram = base × perpendicular height.", "平行四辺形の面積 ＝ 底辺 × 高さ。"),
    tri: H("Area of a triangle = base × height ÷ 2.", "三角形の面積 ＝ 底辺 × 高さ ÷ 2。"),
    lshape: H("Split the shape into two rectangles, or take the missing corner away from the big rectangle.", "2つの長方形に分けるか、大きな長方形から欠けた角をひこう。"),
    volume: H("Volume = length × width × height.", "体積 ＝ たて × 横 × 高さ。"),
    conv: H("How many small units make one big unit? Going to a smaller unit, the number gets bigger.", "大きい単位1つは小さい単位いくつ分かな？ 小さい単位にすると、数は大きくなるよ。"),
    word: H("Read it again. What do you know, and what are you asked to find? Try one step at a time.", "もう一度読もう。分かっていることは？ 聞かれていることは？ 1つずつ進めよう。")
  };
  function measCheck(p, inp) {
    var x = num(inp.x);
    if (x == null) return { status: "incomplete", hint: H("Type your answer in the box.", "答えを入れてね。") };
    if (x === p.answer.x) return { status: "correct" };
    // 換算の向き違い：小さい単位へ→数は増える／大きい単位へ→数は減る（入力の桁数制限があっても判定できるように値の大小で見る）
    if (p.conv && (p.d.down ? x <= p.d.v : x >= p.d.v)) return { status: "wrong", code: "wrong-way", hint: H("Check the direction: is the new unit bigger or smaller? Should the number get bigger or smaller?", "単位が大きくなる？小さくなる？ 数は増える？減る？ 向きを確かめよう。") };
    var tr = measTraps(p);
    for (var i = 0; i < tr.length; i++) if (tr[i][0] === x && tr[i][0] !== p.answer.x) return { status: "wrong", code: tr[i][1], hint: tr[i][2] };
    var g = p.conv ? MGEN.conv : !p.shape ? MGEN.word : p.shape === "para" ? MGEN.para : p.shape === "tri" ? MGEN.tri : p.shape === "cuboid" ? MGEN.volume
      : p.ask === "perimeter" ? MGEN.perimeter : p.shape === "lshape" ? MGEN.lshape : MGEN.area;
    return { status: "wrong", code: "other", hint: g };
  }

  /* ── PMC 風（Primary Mathematics Challenge 対策・2026-11-08 追加） ── */
  // 2018年11月の過去問で落とした種類（数え上げの重なり・比・倍数の判定・面積から辺・周期と公倍数）。
  // kind は "meas"（文章題＋整数1つ＋単位）を流用。手がかりは PMC 専用（pmcTraps / PGEN）。名前は入れない
  function digitCounts(N, dg) {   // 1〜N で数字 dg を含む数の個数（contain）と、dg が出てくる回数（occ）
    var c = 0, o = 0;
    for (var i = 1; i <= N; i++) { var k = String(i).split(String(dg)).length - 1; o += k; if (k) c++; }
    return { contain: c, occ: o };
  }
  function choose(n, k) { var r = 1; for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); }
  function lineWays(n, k) { return k < 0 || n - k + 1 < k ? 0 : choose(n - k + 1, k); }   // 一列に n 席、隣り合わずに k 人
  function isPal(x) { var s = String(x); return s === s.split("").reverse().join(""); }
  function digitSum(x) { return String(x).split("").reduce(function (a, c) { return a + +c; }, 0); }
  // L 桁の回文を大きい順（dir="largest"）か小さい順に見て、ok を満たす最初のもの
  function palSearch(L, dir, ok) {
    var lo = Math.pow(10, L - 1), hi = Math.pow(10, L) - 1, half = Math.ceil(L / 2);
    var hlo = Math.pow(10, half - 1), hhi = Math.pow(10, half) - 1;
    for (var h = dir === "largest" ? hhi : hlo; dir === "largest" ? h >= hlo : h <= hhi; h += dir === "largest" ? -1 : 1) {
      var s = String(h), x = +(s + s.slice(0, L - half).split("").reverse().join(""));
      if (x >= lo && x <= hi && ok(x)) return x;
    }
    return -1;
  }
  var FRAC_W = { 2: "a half", 3: "a third", 4: "a quarter", 5: "a fifth" };
  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // 解説（steps）は H(英, 日) の配列。実際の数字で「試した → だめ／合格」を並べる（2026-11-09 詳しく）
  var JDAYS = ["月", "火", "水", "木", "金", "土", "日"];
  var FRAC_J = { 2: "2分の1", 3: "3分の1", 4: "4分の1", 5: "5分の1" };
  var THINGS_J = { cars: "車", bikes: "自転車", lorries: "トラック", "red beads": "赤いビーズ", "blue beads": "青いビーズ", apples: "りんご", pears: "なし" };
  // 長い試行リストは「最初の2つ … 最後の1つ」に縮める
  function shortList(arr, max) { max = max || 6; return arr.length <= max ? arr : arr.slice(0, 2).concat(["…"], arr.slice(arr.length - (max - 3))); }
  // (r−2) + (r−3) + … + 1
  function downSum(top) { var a = []; for (var i = top; i >= 1; i--) a.push(i); return a.length > 5 ? a.slice(0, 3).join(" + ") + " + … + 1" : a.join(" + "); }
  function sumStr(x) { return String(x).split("").join(" + ") + " = " + digitSum(x); }
  function m3(s) { return s % 3 === 0 ? "✓ (" + s + " = 3 × " + s / 3 + ")" : "✗"; }
  function m9(s) { return s % 9 === 0 ? "✓ (" + s + " = 9 × " + s / 9 + ")" : "✗"; }
  var PSTORIES = {
    count: {
      digit: function () {
        var N = pick([100, 100, 200]), dg = rnd(1, 9), mode = pick(["contain", "avoid"]), c = digitCounts(N, dg);
        var dd = String(dg) + dg, ans = mode === "contain" ? c.contain : N - c.contain;
        var steps = [
          H("Start with 1 to 99. Numbers with " + dg + " in the ONES place: " + dg + ", 1" + dg + ", 2" + dg + ", … , 9" + dg + " → 10 numbers.",
            "まず 1〜99 で考える。一の位が " + dg + "：" + dg + "、1" + dg + "、2" + dg + "、…、9" + dg + " → 10個。"),
          H("Numbers with " + dg + " in the TENS place: " + dg + "0, " + dg + "1, … , " + dg + "9 → 10 numbers.",
            "十の位が " + dg + "：" + dg + "0、" + dg + "1、…、" + dg + "9 → 10個。"),
          H(dd + " is in BOTH lists. It has two " + dg + "s, but it is only ONE number. So 10 + 10 − 1 = 19 numbers from 1 to 99.",
            dd + " は両方のリストに入っている。" + dg + " が2つあっても、数としては1つ。だから 10 ＋ 10 − 1 ＝ 19個（1〜99）。")
        ];
        var tot = 19;
        if (N === 100) {
          if (dg === 1) { tot += 1; steps.push(H("100 has a 1 too: 19 + 1 = 20.", "100 にも 1 がある：19 ＋ 1 ＝ 20個。")); }
          else steps.push(H("100 has no " + dg + ", so it is still 19.", "100 には " + dg + " がないので、19個のまま。"));
        } else if (dg === 1) {
          tot += 100;
          steps.push(H("100 to 199: EVERY number starts with 1 → 100 more numbers. 200 has no 1. 19 + 100 = 119.",
            "100〜199：全部の数が 1 で始まる → 100個ふえる。200 には 1 がない。19 ＋ 100 ＝ 119個。"));
        } else {
          tot += 19 + (dg === 2 ? 1 : 0);
          steps.push(H("100 to 199 works just like 1 to 99 → 19 more." + (dg === 2 ? " And 200 has a 2 → 1 more. 19 + 19 + 1 = 39." : " 200 has no " + dg + ". 19 + 19 = 38."),
            "100〜199 も 1〜99 と同じ → また19個。" + (dg === 2 ? "200 にも 2 がある → 1個。19 ＋ 19 ＋ 1 ＝ 39個。" : "200 には " + dg + " がない。19 ＋ 19 ＝ 38個。")));
        }
        if (mode === "avoid") steps.push(H("The question asks for numbers WITHOUT a " + dg + ": " + N + " − " + tot + " = " + ans + ".",
          "聞かれているのは " + dg + " が“入っていない”数：" + N + " − " + tot + " ＝ " + ans + "。"));
        return { unit: "numbers", ans: ans, d: { N: N, dg: dg, mode: mode }, chk: tot === c.contain,
          story: mode === "contain"
            ? "How many of the whole numbers from 1 to " + N + " have at least one digit " + dg + " in them?"
            : "A street has houses numbered 1 to " + N + ". Someone wants a house whose number does NOT have the digit " + dg + " in it. How many houses can they choose from?",
          steps: steps };
      },
      pairs: function () {
        var n = rnd(5, 12), ans = n * (n - 1) / 2;
        return { unit: "handshakes", ans: ans, d: { n: n },
          story: n + " children meet at a party. Every child shakes hands with every other child exactly once. How many handshakes are there?",
          steps: [H("Try it small first: 4 children A, B, C, D. Handshakes: AB, AC, AD, BC, BD, CD → 6. (BA is the same as AB.)",
              "まず小さい数で：4人（A・B・C・D）なら AB、AC、AD、BC、BD、CD → 6回。（BA は AB と同じ）"),
            H("Each child shakes " + (n - 1) + " hands (everyone except themselves): " + n + " × " + (n - 1) + " = " + n * (n - 1) + ".",
              "1人が握手するのは自分以外の " + (n - 1) + " 人：" + n + " × " + (n - 1) + " ＝ " + n * (n - 1) + "。"),
            H("But every handshake has TWO people, so it was counted twice: " + n * (n - 1) + " ÷ 2 = " + ans + ".",
              "でも1回の握手には2人いるので、2回ずつ数えている：" + n * (n - 1) + " ÷ 2 ＝ " + ans + "。"),
            H("Another way: the 1st child shakes " + (n - 1) + " new hands, the 2nd " + (n - 2) + " new, … , the last 0 new: " + downSum(n - 1) + " = " + ans + ".",
              "別の数え方：1人目は新しく " + (n - 1) + " 回、2人目は " + (n - 2) + " 回、…、最後の人は0回：" + downSum(n - 1) + " ＝ " + ans + "。")] };
      },
      circle: function () {
        var nk = pick([[6, 2], [7, 2], [8, 2], [7, 3], [8, 3], [9, 3]]), n = nk[0], k = nk[1];
        var ans = lineWays(n - 3, k - 1) + lineWays(n - 1, k), r = n - 3, steps;
        if (k === 2) steps = [
          H("Give the first popper to any friend: " + n + " choices.", "1つ目のクラッカーをだれかに渡す：" + n + " 通り。"),
          H("The second popper can’t go to that friend or to the 2 friends next to them. " + n + " − 3 = " + (n - 3) + " choices.",
            "2つ目は、その人と両どなりの2人には渡せない。" + n + " − 3 ＝ " + (n - 3) + " 通り。"),
          H(n + " × " + (n - 3) + " = " + n * (n - 3) + ". But “Ann then Ben” and “Ben then Ann” are the same way, so each way was counted twice.",
            n + " × " + (n - 3) + " ＝ " + n * (n - 3) + "。でも「Aさん→Bさん」と「Bさん→Aさん」は同じ渡し方なので、2回ずつ数えている。"),
          H(n * (n - 3) + " ÷ 2 = " + ans + ".", n * (n - 3) + " ÷ 2 ＝ " + ans + "。")];
        else steps = [
          H("Give the first popper to any friend: " + n + " choices. The 2 friends next to them can’t have one.",
            "1つ目をだれかに渡す：" + n + " 通り。その両どなりの2人はもらえない。"),
          H("That leaves " + n + " − 3 = " + r + " friends, and they now sit in a ROW (the circle is broken).",
            "残りは " + n + " − 3 ＝ " + r + " 人。この人たちは一列に並んでいる（輪が切れている）。"),
          H("Choose 2 of these " + r + " in a row, not next to each other. The 1st friend in the row can pair with " + (r - 2) + " friends further along (not the one right next to them); the 2nd friend with " + (r - 3) + "; … → " + downSum(r - 2) + " = " + (r - 1) * (r - 2) / 2 + ".",
            "一列の " + r + " 人から、となり合わない2人を選ぶ。列の1番目の人と組めるのは、それより右の（となりを除く）" + (r - 2) + " 人。2番目の人は " + (r - 3) + " 人、… → " + downSum(r - 2) + " ＝ " + (r - 1) * (r - 2) / 2 + "。"),
          H(n + " × " + (r - 1) * (r - 2) / 2 + " = " + n * (r - 1) * (r - 2) / 2 + ". Each way has 3 poppers, and we could have started from any of the 3, so each way was counted 3 times.",
            n + " × " + (r - 1) * (r - 2) / 2 + " ＝ " + n * (r - 1) * (r - 2) / 2 + "。1つの渡し方には3人いて、だれから数え始めても同じになるので、3回ずつ数えている。"),
          H(n * (r - 1) * (r - 2) / 2 + " ÷ 3 = " + ans + ".", n * (r - 1) * (r - 2) / 2 + " ÷ 3 ＝ " + ans + "。")];
        return { unit: "ways", ans: ans, d: { n: n, k: k }, chk: (k === 2 ? n * (n - 3) / 2 : n * (r - 1) * (r - 2) / 6) === ans,
          story: n + " friends sit round a circular table. " + k + " of them get a party popper, but no two friends sitting next to each other both get one. In how many different ways can the poppers be given out?",
          steps: steps };
      }
    },
    ratio: {
      one: function () {
        var n = rnd(2, 5), k = rnd(3, 9), A = (n + 1) * k, B = n * k, T = A + B, th = pick([["cars", "bikes"], ["red beads", "blue beads"], ["apples", "pears"]]);
        var jA = THINGS_J[th[0]], jB = THINGS_J[th[1]], Cap = th[0][0].toUpperCase() + th[0].slice(1);
        return { unit: th[0], ans: A, d: { n: n, k: k, T: T, ask: "A" },
          story: "There are " + FRAC_W[n] + " more " + th[0] + " than " + th[1] + ". There are " + T + " " + th[0] + " and " + th[1] + " altogether. How many " + th[0] + " are there?",
          steps: [H("Draw the " + th[1] + " as " + n + " equal boxes. “" + FRAC_W[n] + " more” means one more box: the " + th[0] + " are " + (n + 1) + " boxes.",
              jB + "を同じ大きさの箱 " + n + " 個でかく。「" + FRAC_J[n] + "多い」は箱が1個多いということ：" + jA + "は " + (n + 1) + " 個。"),
            H("So " + th[0] + " : " + th[1] + " = " + (n + 1) + " : " + n + " (NOT 1 : " + n + ").", "だから " + jA + "：" + jB + " ＝ " + (n + 1) + "：" + n + "（1：" + n + " ではない）。"),
            H("Altogether there are " + (n + 1) + " + " + n + " = " + (2 * n + 1) + " boxes, and they hold " + T + ". One box = " + T + " ÷ " + (2 * n + 1) + " = " + k + ".",
              "箱は全部で " + (n + 1) + " ＋ " + n + " ＝ " + (2 * n + 1) + " 個、合計は " + T + "。箱1個 ＝ " + T + " ÷ " + (2 * n + 1) + " ＝ " + k + "。"),
            H(Cap + ": " + (n + 1) + " boxes × " + k + " = " + A + ".", jA + "：" + (n + 1) + " 個 × " + k + " ＝ " + A + "。"),
            H("Check: " + th[1] + " = " + B + ". " + FRAC_W[n][0].toUpperCase() + FRAC_W[n].slice(1) + " of " + B + " is " + k + ", and " + B + " + " + k + " = " + A + " ✓",
              "確かめ：" + jB + "は " + B + "。" + B + " の" + FRAC_J[n] + "は " + k + "、" + B + " ＋ " + k + " ＝ " + A + " ✓")] };
      },
      chain: function () {
        var n = rnd(2, 5), m = rnd(2, 5), a = (n + 1) * (m + 1), b = n * (m + 1), c = n * m, S = a + b + c;
        var k = S <= 60 ? pick([2, 3]) : 2, ask = pick(["A", "C"]), ans = (ask === "A" ? a : c) * k, T = S * k;
        var th = ["cars", "bikes", "lorries"];
        return { unit: ask === "A" ? th[0] : th[2], ans: ans, d: { n: n, m: m, k: k, T: T, ask: ask },
          story: "In a car park there are " + FRAC_W[n] + " more cars than bikes, and " + FRAC_W[m] + " more bikes than lorries. There are " + T + " vehicles altogether. How many " + (ask === "A" ? "cars" : "lorries") + " are there?",
          steps: [H("“" + FRAC_W[n] + " more cars than bikes”: bikes " + n + " boxes, cars " + (n + 1) + " boxes. Cars : bikes = " + (n + 1) + " : " + n + ".",
              "「車は自転車より" + FRAC_J[n] + "多い」：自転車 " + n + " 箱、車 " + (n + 1) + " 箱。車：自転車 ＝ " + (n + 1) + "：" + n + "。"),
            H("“" + FRAC_W[m] + " more bikes than lorries”: lorries " + m + " boxes, bikes " + (m + 1) + " boxes. Bikes : lorries = " + (m + 1) + " : " + m + ".",
              "「自転車はトラックより" + FRAC_J[m] + "多い」：トラック " + m + " 箱、自転車 " + (m + 1) + " 箱。自転車：トラック ＝ " + (m + 1) + "：" + m + "。"),
            H("The bikes are " + n + " in one ratio and " + (m + 1) + " in the other — but they are the SAME bikes. Make both " + b + " (" + n + " × " + (m + 1) + "):",
              "自転車が片方では " + n + "、もう片方では " + (m + 1) + "。でも同じ自転車なので、どちらも " + b + "（" + n + " × " + (m + 1) + "）にそろえる："),
            H("cars : bikes = " + (n + 1) + " : " + n + " → × " + (m + 1) + " → " + a + " : " + b + ".   bikes : lorries = " + (m + 1) + " : " + m + " → × " + n + " → " + b + " : " + c + ".",
              "車：自転車 ＝ " + (n + 1) + "：" + n + " → × " + (m + 1) + " → " + a + "：" + b + "。自転車：トラック ＝ " + (m + 1) + "：" + m + " → × " + n + " → " + b + "：" + c + "。"),
            H("Cars : bikes : lorries = " + a + " : " + b + " : " + c + ". One set = " + a + " + " + b + " + " + c + " = " + S + ". " + T + " ÷ " + S + " = " + k + " sets.",
              "車：自転車：トラック ＝ " + a + "：" + b + "：" + c + "。1組 ＝ " + S + " 台。" + T + " ÷ " + S + " ＝ " + k + " 組。"),
            H((ask === "A" ? "Cars: " + a : "Lorries: " + c) + " × " + k + " = " + ans + ".   Check: " + a * k + " + " + b * k + " + " + c * k + " = " + T + " ✓",
              (ask === "A" ? "車：" + a : "トラック：" + c) + " × " + k + " ＝ " + ans + "。確かめ：" + a * k + " ＋ " + b * k + " ＋ " + c * k + " ＝ " + T + " ✓")] };
      }
    },
    multiple: {
      last: function () {
        for (;;) {
          var pre = rnd(10, 99), dir = pick(["largest", "smallest"]), ok6 = -1, ok3 = -1;
          for (var i = 0; i <= 9; i++) { var dg = dir === "largest" ? i : 9 - i, x = pre * 10 + dg; if (x % 6 === 0) ok6 = dg; if (x % 3 === 0) ok3 = dg; }
          if (ok6 <= 0 || ok6 === ok3 || ok6 === (dir === "largest" ? 8 : 0)) continue;
          var tries = [], cands = dir === "largest" ? [8, 6, 4, 2, 0] : [0, 2, 4, 6, 8];
          for (var j = 0; j < cands.length; j++) {
            var v = pre * 10 + cands[j], s = digitSum(v);
            tries.push(H("□ = " + cands[j] + ": " + v + " → " + sumStr(v) + " " + m3(s), "□ ＝ " + cands[j] + "：" + v + " → " + sumStr(v) + " " + m3(s)));
            if (cands[j] === ok6) break;
          }
          return { unit: "", ans: ok6, d: { pos: "last", pre: pre, dir: dir },
            story: "The three-digit number " + pre + "□ is a multiple of 6. What is the " + dir + " digit that can go in the box?",
            steps: [H("6 = 2 × 3, so a multiple of 6 must pass TWO tests: it is even, AND its digits add up to a multiple of 3.",
                "6 ＝ 2 × 3 なので、6の倍数は2つのテストに合格する：偶数であること、そして各位の和が3の倍数であること。"),
              H("□ is the last digit, so it must be even: 0, 2, 4, 6 or 8. Try them " + (dir === "largest" ? "from the biggest" : "from the smallest") + ":",
                "□ は一の位なので偶数：0・2・4・6・8。" + (dir === "largest" ? "大きい方" : "小さい方") + "から試す：")]
              .concat(tries, [H("The " + dir + " digit is " + ok6 + ". Check: " + (pre * 10 + ok6) + " ÷ 6 = " + (pre * 10 + ok6) / 6 + " ✓",
                (dir === "largest" ? "一番大きい" : "一番小さい") + "数字は " + ok6 + "。確かめ：" + (pre * 10 + ok6) + " ÷ 6 ＝ " + (pre * 10 + ok6) / 6 + " ✓")]) };
        }
      },
      middle: function () {
        for (;;) {
          var a = rnd(1, 9), c = pick([0, 2, 4, 6, 8]), dir = pick(["largest", "smallest"]), best = -1;
          for (var i = 0; i <= 9; i++) { var dg = dir === "largest" ? i : 9 - i; if ((a * 100 + dg * 10 + c) % 6 === 0) best = dg; }
          if (best <= 0 || best === (dir === "largest" ? 9 : 0)) continue;
          var tries = [];
          for (var t = dir === "largest" ? 9 : 0; ; t += dir === "largest" ? -1 : 1) {
            var v = a * 100 + t * 10 + c, s = digitSum(v);
            tries.push(H("□ = " + t + ": " + v + " → " + sumStr(v) + " " + m3(s), "□ ＝ " + t + "：" + v + " → " + sumStr(v) + " " + m3(s)));
            if (t === best) break;
          }
          return { unit: "", ans: best, d: { pos: "middle", a: a, c: c, dir: dir },
            story: "The three-digit number " + a + "□" + c + " is a multiple of 6. What is the " + dir + " digit that can go in the box?",
            steps: [H("A multiple of 6 must be even AND its digits must add up to a multiple of 3.", "6の倍数は、偶数で、しかも各位の和が3の倍数。"),
              H("It ends in " + c + ", so it is already even. Only the digit sum is left to check.", "一の位が " + c + " なので、もう偶数。あとは各位の和だけ確かめる。"),
              H("Try □ " + (dir === "largest" ? "from 9 downwards" : "from 0 upwards") + ":", "□ を" + (dir === "largest" ? " 9 から小さい方へ" : " 0 から大きい方へ") + "試す：")]
              .concat(shortList(tries, 7).map(function (x) { return x === "…" ? H("…", "…") : x; }),
                [H("The " + dir + " digit is " + best + ". Check: " + (a * 100 + best * 10 + c) + " ÷ 6 = " + (a * 100 + best * 10 + c) / 6 + " ✓",
                  (dir === "largest" ? "一番大きい" : "一番小さい") + "数字は " + best + "。確かめ：" + (a * 100 + best * 10 + c) + " ÷ 6 ＝ " + (a * 100 + best * 10 + c) / 6 + " ✓")]) };
        }
      },
      palindrome: function () {
        var L = pick([4, 5, 6]), m = pick([6, 6, 9]), dir = pick(["largest", "smallest"]), no9 = dir === "largest" && Math.random() < 0.4;
        var ok = function (x) { return x % m === 0 && (!no9 || String(x).indexOf("9") < 0); };
        var ans = palSearch(L, dir, ok), shape = { 4: "ABBA", 5: "ABCBA", 6: "ABCCBA" }[L];
        // 表示用の試行：「A は偶数」「9 なし」で最初から外れるものは飛ばし、各位の和だけで判定する
        var tries = [], hit = false;
        palSearch(L, dir, function (x) {
          if (m === 6 && x % 2) return false;
          if (no9 && String(x).indexOf("9") >= 0) return false;
          var s = digitSum(x), good = s % (m === 6 ? 3 : 9) === 0;
          tries.push(H(x + ": " + sumStr(x) + " " + (m === 6 ? m3(s) : m9(s)), x + "：" + sumStr(x) + " " + (m === 6 ? m3(s) : m9(s))));
          if (good) hit = x === ans;
          return good;
        });
        var first = m === 6 ? (dir === "largest" ? 8 : 2) : (dir === "largest" ? (no9 ? 8 : 9) : 1);
        var steps = [H("A " + L + "-digit palindrome has the pattern " + shape + ": the first digit and the last digit are the same, and so on.",
            L + "けたの回文は " + shape + " の形。最初と最後の数字が同じ（2番目と最後から2番目も同じ…）。")];
        if (m === 6) steps.push(
          H("Multiple of 6 = even AND digits add up to a multiple of 3.", "6の倍数 ＝ 偶数 で、各位の和が3の倍数。"),
          H("A is also the LAST digit, so A must be even. " + (dir === "largest" ? "Biggest even A = 8 (9 would make it odd)." : "Smallest even A = 2 (A can’t be 0)."),
            "A は一の位でもあるので偶数。" + (dir === "largest" ? "一番大きい偶数は A ＝ 8（9 だと奇数になる）。" : "一番小さい偶数は A ＝ 2（A は 0 にできない）。")));
        if (m === 6 && no9) steps.push(H("No 9s are allowed, so skip any palindrome with a 9 in it.", "9 は使えないので、9 が入っている回文は飛ばす。"));
        else steps.push(H("Multiple of 9 = digits add up to 9, 18, 27, 36 … Start with A = " + first + (no9 ? " (no 9s allowed)" : "") + ".",
          "9の倍数 ＝ 各位の和が 9・18・27・36 …。A ＝ " + first + " から始める" + (no9 ? "（9 は使えない）" : "") + "。"));
        steps.push(H("Now try the palindromes " + (dir === "largest" ? "from the biggest, going down" : "from the smallest, going up") + ", and add up the digits:",
          "回文を" + (dir === "largest" ? "大きい順" : "小さい順") + "に試して、各位の和を出す："));
        steps = steps.concat(shortList(tries, 6).map(function (x) { return x === "…" ? H("…", "…") : x; }));
        steps.push(H("The first one that passes is " + ans + ". Check: " + ans + " ÷ " + m + " = " + ans / m + " ✓",
          "最初に合格するのは " + ans + "。確かめ：" + ans + " ÷ " + m + " ＝ " + ans / m + " ✓"));
        return { unit: "", ans: ans, d: { L: L, m: m, dir: dir, no9: no9 }, chk: hit,
          story: "A palindrome reads the same forwards and backwards, like 2552. What is the " + dir + " " + ["", "", "", "", "four", "five", "six"][L] + "-digit palindrome that is a multiple of " + m + (no9 ? " and has no digit 9" : "") + "?",
          steps: steps };
      }
    },
    area: {
      twice: function () {
        var w = rnd(2, 9), A = 2 * w * w;
        return { unit: "m", ans: 2 * w, d: { w: w, A: A },
          story: "A rectangular room is twice as long as it is wide. Its area is " + A + " m². How long is the room?",
          steps: [H("Draw it: twice as long as wide = two squares side by side.", "図をかく：長さが幅の2倍 ＝ 正方形が2つ横に並んだ形。"),
            H("Each square: " + A + " ÷ 2 = " + w * w + " m².", "正方形1つ：" + A + " ÷ 2 ＝ " + w * w + " m²。"),
            H("Which number times itself makes " + w * w + "? " + w + " × " + w + " = " + w * w + ", so each square is " + w + " m on each side. That is the width.",
              "同じ数を2回かけて " + w * w + " になるのは？ " + w + " × " + w + " ＝ " + w * w + "。だから正方形の1辺は " + w + " m。これが幅。"),
            H("Length = two squares = 2 × " + w + " = " + 2 * w + " m.", "長さ ＝ 正方形2つ分 ＝ 2 × " + w + " ＝ " + 2 * w + " m。"),
            H("Check: " + 2 * w + " × " + w + " = " + A + " m² ✓", "確かめ：" + 2 * w + " × " + w + " ＝ " + A + " m² ✓")] };
      },
      next: function () {
        var w = rnd(2, 8), A = 2 * w * w, x; do x = rnd(2, 9); while (x === w || x === 2 * w);
        var B = 2 * w * x;
        return { unit: "m", ans: x, d: { w: w, A: A, B: B, x: x },
          story: "Room 1 is twice as long as it is wide, with an area of " + A + " m². Room 2 is a rectangle next to it, sharing Room 1’s LONG wall. Room 2 has an area of " + B + " m². How wide is Room 2 (the side that is not shared)?",
          steps: [H("Room 1 is two squares: " + A + " ÷ 2 = " + w * w + " m² each, and " + w + " × " + w + " = " + w * w + ".",
              "Room 1 は正方形2つ：1つ " + A + " ÷ 2 ＝ " + w * w + " m²、" + w + " × " + w + " ＝ " + w * w + "。"),
            H("So Room 1 is " + w + " m wide and " + 2 * w + " m long.", "だから Room 1 は幅 " + w + " m、長さ " + 2 * w + " m。"),
            H("Room 2 shares the LONG wall, so one side of Room 2 is " + 2 * w + " m.", "Room 2 は“長い”壁を共有しているので、Room 2 の1辺は " + 2 * w + " m。"),
            H("Area = side × side, so the other side = " + B + " ÷ " + 2 * w + " = " + x + " m.", "面積 ＝ たて × よこ なので、もう1辺 ＝ " + B + " ÷ " + 2 * w + " ＝ " + x + " m。"),
            H("Check: " + 2 * w + " × " + x + " = " + B + " m² ✓", "確かめ：" + 2 * w + " × " + x + " ＝ " + B + " m² ✓")] };
      },
      outline: function () {
        var w = rnd(2, 8), A = 2 * w * w, x; do x = rnd(2, 9); while (x === w || x === 2 * w);
        var B = 2 * w * x, P = 2 * (2 * w + w + x);
        return { unit: "m", ans: P, d: { w: w, A: A, B: B, x: x },
          story: "Room 1 is twice as long as it is wide, with an area of " + A + " m². Room 2 shares Room 1’s LONG wall, and the two rooms together make one big rectangle. Room 2 has an area of " + B + " m². What is the perimeter of the big rectangle?",
          steps: [H("Room 1 is two squares of " + w * w + " m² (" + w + " × " + w + "), so it is " + w + " m by " + 2 * w + " m.",
              "Room 1 は " + w * w + " m² の正方形2つ（" + w + " × " + w + "）なので、" + w + " m × " + 2 * w + " m。"),
            H("Room 2 shares the " + 2 * w + " m wall: its other side is " + B + " ÷ " + 2 * w + " = " + x + " m.",
              "Room 2 は " + 2 * w + " m の壁を共有：もう1辺は " + B + " ÷ " + 2 * w + " ＝ " + x + " m。"),
            H("Put them together: the big rectangle is " + 2 * w + " m long and " + w + " + " + x + " = " + (w + x) + " m wide.",
              "2つを合わせると、大きな長方形は長さ " + 2 * w + " m、幅 " + w + " ＋ " + x + " ＝ " + (w + x) + " m。"),
            H("The shared wall is now INSIDE the big rectangle, so it is not part of the perimeter.", "共有している壁は大きな長方形の“内側”なので、周の長さには入らない。"),
            H("Perimeter = " + 2 * w + " + " + (w + x) + " + " + 2 * w + " + " + (w + x) + " = " + P + " m.", "周の長さ ＝ " + 2 * w + " ＋ " + (w + x) + " ＋ " + 2 * w + " ＋ " + (w + x) + " ＝ " + P + " m。")] };
      }
    },
    cycle: {
      lcm: function () {
        for (;;) {
          var s = [2, 3, 4, 5, 6, 8, 9, 10, 12], a = pick(s), b = pick(s), c = pick(s);
          if (a === b || b === c || a === c) continue;
          var L = lcm(lcm(a, b), c);
          if (L > 60 || L === a * b * c || L === Math.max(a, b, c)) continue;
          var ctx = pick([["Three lights flash together right now. One flashes every ", " seconds, one every ", " seconds and one every ", " seconds. After how many seconds will they next all flash together?", "seconds"],
            ["Three buses leave the bus station together at 8 a.m. One leaves every ", " minutes, one every ", " minutes and one every ", " minutes. After how many minutes will all three next leave together?", "minutes"]]);
          var mx = Math.max(a, b, c), others = [a, b, c].filter(function (v) { return v !== mx; }), tries = [];
          for (var v = mx; v <= L; v += mx) {
            var bad = others.filter(function (o) { return v % o; });
            tries.push(bad.length ? H(v + ": not in the " + bad[0] + " times table ✗", v + "：" + bad[0] + " の段にない ✗") : H(v + ": in the " + others[0] + " and " + others[1] + " times tables too ✓", v + "：" + others[0] + " の段にも " + others[1] + " の段にもある ✓"));
          }
          return { unit: ctx[4], ans: L, d: { a: a, b: b, c: c },
            story: ctx[0] + a + ctx[1] + b + ctx[2] + c + ctx[3],
            steps: [H("They all happen together again at a number that is in the " + a + ", " + b + " AND " + c + " times tables (a common multiple). We want the FIRST one.",
                "3つがまたそろうのは、" + a + "・" + b + "・" + c + " のどの段にも出てくる数（公倍数）のとき。知りたいのは“最初”の1つ。"),
              H("Count up in the biggest, " + mx + "s, and check each one:", "一番大きい " + mx + " の段で数えて、1つずつ確かめる：")]
              .concat(shortList(tries, 7).map(function (x) { return x === "…" ? H("…", "…") : x; }),
                [H("The first one is " + L + ". (" + a + " × " + b + " × " + c + " = " + a * b * c + " also works, but it is not the FIRST time.)",
                  "最初は " + L + "。（" + a + " × " + b + " × " + c + " ＝ " + a * b * c + " でもそろうけれど、“最初”ではない）")]) };
        }
      },
      weekday: function () {
        for (;;) {
          var s = [2, 3, 4, 6], a = pick(s), b = pick(s); if (a === b) continue;
          var L = lcm(a, b), w = rnd(1, 6), t = L; while (t % 7 !== w) t += L;   // L は 7 の倍数にならない＝必ず答えがある
          if (L % 7 === w || t === w || t > 60) continue;
          var tries = [];
          for (var v = L; v <= t; v += L) tries.push(H("Day " + v + " → " + DAYS[v % 7] + (v === t ? " ✓" : " ✗"), v + " 日後 → " + JDAYS[v % 7] + "曜日" + (v === t ? " ✓" : " ✗")));
          return { unit: "days", ans: t, d: { a: a, b: b, w: w },
            story: "Today is Monday. Three people water the plants today: one waters them every day, one every " + a + " days and one every " + b + " days. A fourth person only waters them on " + DAYS[w] + "s. In how many days’ time will all four next water the plants on the same day?",
            steps: [H("The every-day person is there every day, so we can forget about them.", "毎日の人はいつでもいるので、考えなくてよい。"),
              H("Every " + a + " days and every " + b + " days: they meet on the " + a + " and " + b + " times tables together → day " + L + ", " + 2 * L + ", " + 3 * L + " …",
                a + " 日ごとと " + b + " 日ごと：両方の段に出てくる日 → " + L + "、" + 2 * L + "、" + 3 * L + " … 日後。"),
              H("Find the day of the week: today is day 0 (Monday), and every 7 days it is Monday again. Divide by 7 and look at the remainder (0 = Mon, 1 = Tue, 2 = Wed …).",
                "曜日の出し方：今日＝0日後（月曜日）、7日ごとにまた月曜日。7でわったあまりを見る（0＝月、1＝火、2＝水 …）。")]
              .concat(shortList(tries, 7).map(function (x) { return x === "…" ? H("…", "…") : x; }),
                [H("The first " + DAYS[w] + " is day " + t + ". Check: " + t + " ÷ 7 = " + Math.floor(t / 7) + " r " + w + " → " + DAYS[w] + " ✓",
                  "最初の" + JDAYS[w] + "曜日は " + t + " 日後。確かめ：" + t + " ÷ 7 ＝ " + Math.floor(t / 7) + " あまり " + w + " → " + JDAYS[w] + "曜日 ✓")]) };
        }
      }
    }
  };
  function pmcMake(id, fam) {
    return function (prefTag) {
      var tag = prefTag || pick(Object.keys(PSTORIES[fam])), st;
      do st = PSTORIES[fam][tag](); while (fam !== "multiple" && new RegExp("(^|[^0-9])" + st.ans + "([^0-9]|$)").test(st.story));   // 答えの数が文中に出るものは出さない（倍数の □ は除く）
      return measP(id, tag, null, st.d, st.unit, st.ans, st.steps, { story: st.story, text: st.story, pmc: fam, chk: st.chk });
    };
  }
  // PMC のよくある間違い：[値, code, 手がかり]
  function pmcTraps(p) {
    var d = p.d, t = [];
    function T_(v, code, en, ja) { t.push([v, code, H(en, ja)]); }
    if (p.type === "pmc-count") {
      if (p.tag === "digit") {
        var c = digitCounts(d.N, d.dg), dd = String(d.dg) + d.dg;
        if (d.mode === "contain") {
          T_(c.occ, "double-count", "Did you count " + dd + " twice? It has two " + d.dg + "s, but it is only one number.", dd + " を2回数えたかな？ " + d.dg + " が2つあっても、数としては1つだよ。");
          T_(d.N - c.contain, "opposite", "Is that the numbers WITHOUT a " + d.dg + "? Read the question again.", d.dg + " が入って“いない”数を数えたかな？ もう一度問題を読もう。");
        } else {
          T_(d.N - c.occ, "double-count", "Did you take away " + dd + " twice? It has two " + d.dg + "s, but it is only one house.", dd + " を2回ひいたかな？ " + d.dg + " が2つあっても、家は1軒だよ。");
          T_(c.contain, "opposite", "Is that the houses WITH a " + d.dg + "? The question asks for the ones without.", d.dg + " が入って“いる”家を数えたかな？ 聞かれているのは入っていない家だよ。");
        }
      } else if (p.tag === "pairs") {
        T_(d.n * (d.n - 1), "double-count", "Did you count each handshake twice? When A shakes B’s hand, that is the same handshake as B shaking A’s.", "握手を2回ずつ数えたかな？ AとBの握手と、BとAの握手は同じ1回だよ。");
        T_(d.n * d.n, "self", "Can a child shake their own hand? Each child shakes " + (d.n - 1) + " hands.", "自分とは握手しないよね。1人が握手するのは " + (d.n - 1) + " 人だよ。");
      } else {
        T_(2 * p.answer.x, "double-count", "That is exactly double. The same group of friends is only ONE way — did you count some groups twice?", "ちょうど2倍になっているよ。同じ人たちの組み合わせは1通りだよ。同じ組を2回数えていないかな？");
        T_(lineWays(d.n, d.k), "ends", "Remember it is a circle: the first and last friend sit next to each other too.", "丸いテーブルだから、最初の人と最後の人もとなり同士だよ。");
      }
    } else if (p.type === "pmc-ratio") {
      if (p.tag === "one") {
        T_(d.n * d.k, "other-one", "Is that the smaller group? Check which one the question asks for.", "それは少ない方の数かな？ 聞かれているのはどっち？");
        if (d.T % (d.n + 1) === 0) T_(d.T / (d.n + 1), "ratio-1n", "“" + FRAC_W[d.n] + " more” is not 1 : " + d.n + ". For every " + d.n + " of one, there are " + (d.n + 1) + " of the other.", "「" + d.n + "分の1多い」は 1：" + d.n + " ではないよ。" + d.n + " 個に対して " + (d.n + 1) + " 個だよ。");
        if (d.T % 2 === 0) T_(d.T / 2, "halves", "Half each would mean the same number of both. But one group is bigger.", "半分ずつだと同じ数になるよ。でも片方の方が多いんだよね。");
      } else {
        var a = (d.n + 1) * (d.m + 1) * d.k, b = d.n * (d.m + 1) * d.k, c2 = d.n * d.m * d.k;
        T_(b, "other-one", "Is that the number of bikes? Check which vehicle the question asks for.", "それは自転車の数かな？ 聞かれている乗り物をもう一度確かめよう。");
        T_(d.ask === "A" ? c2 : a, "other-one", "Is that the " + (d.ask === "A" ? "lorries" : "cars") + "? Check which vehicle the question asks for.", "それは" + (d.ask === "A" ? "トラック" : "車") + "の数かな？ 聞かれている乗り物をもう一度確かめよう。");
      }
    } else if (p.type === "pmc-multiple") {
      if (p.tag === "last") {
        var big = d.dir !== "smallest", o3 = -1; for (var g = 0; g <= 9; g++) { var gg = big ? g : 9 - g; if ((d.pre * 10 + gg) % 3 === 0) o3 = gg; }
        T_(o3, "only-3", "That makes a multiple of 3 — but is it even? A multiple of 6 must be both.", "3の倍数にはなっているね。でも偶数かな？ 6の倍数は両方そろわないとだめだよ。");
        T_(big ? 8 : 0, "only-even", (big ? "8" : "0") + " makes it even — but do the digits add up to a multiple of 3?", (big ? "8" : "0") + " なら偶数だね。でも各位の和は3の倍数になっている？");
      } else if (p.tag === "middle") {
        T_(d.dir === "smallest" ? 0 : 9, "only-even", "It is already even. Now check: do the digits add up to a multiple of 3?", "もう偶数にはなっているね。各位の和は3の倍数になっている？");
      } else {
        var dirOk = function (f) { return palSearch(d.L, d.dir, function (x) { return f(x) && (!d.no9 || String(x).indexOf("9") < 0); }); };
        if (d.m === 6) {
          T_(dirOk(function (x) { return x % 2 === 0; }), "only-even", "That is even — but do its digits add up to a multiple of 3?", "偶数にはなっているね。でも各位の和は3の倍数かな？");
          T_(dirOk(function (x) { return x % 3 === 0; }), "only-3", "That is a multiple of 3 — but is it even?", "3の倍数にはなっているね。でも偶数かな？");
        } else T_(dirOk(function (x) { return x % 3 === 0; }), "only-3", "Its digits add up to a multiple of 3. For 9, they must add up to a multiple of 9.", "各位の和は3の倍数だね。9の倍数なら、和が9の倍数になっていないとだめだよ。");
        if (d.no9) T_(palSearch(d.L, d.dir, function (x) { return x % d.m === 0; }), "has-9", "Check the digits: the question says no 9s.", "数字を見直そう。9は使えないんだよ。");
      }
    } else if (p.type === "pmc-area-side") {
      if (p.tag === "twice") {
        T_(d.w, "width", "Is that the width? The question asks how LONG the room is.", "それは幅かな？ 聞かれているのは長さだよ。");
        T_(d.A / 2, "half-area", "Half the area is the area of one square — what is the length of its side?", "面積の半分は正方形1つ分の面積だね。その1辺の長さは？");
      } else if (p.tag === "next") {
        if (d.B % d.w === 0) T_(d.B / d.w, "short-wall", "Room 2 shares the LONG wall of Room 1. How long is that wall?", "共有しているのは Room 1 の“長い”壁だよ。その長さは？");
        T_(2 * d.w, "shared-wall", "That is the shared wall. The question asks for the other side of Room 2.", "それは共有している壁の長さだね。聞かれているのは Room 2 のもう1辺だよ。");
      } else {
        T_(6 * d.w + 2 * (2 * d.w + d.x), "middle-wall", "Did you add both rooms’ perimeters? The wall in the middle is inside the big rectangle.", "2つの部屋のまわりを足したかな？ 真ん中の壁は大きな長方形の内側だよ。");
        T_(d.A + d.B, "area", "That is the area. Perimeter is the distance all the way round.", "それは面積だね。周の長さは、まわりをぐるっと一周した長さだよ。");
        T_(6 * d.w, "room1", "That is Room 1 on its own. Include Room 2 as well.", "それは Room 1 だけのまわりだね。Room 2 も入れよう。");
      }
    } else if (p.type === "pmc-cycle") {
      if (p.tag === "lcm") {
        T_(d.a * d.b * d.c, "product", "Multiplying always works — but is it the FIRST time? Look for a smaller common multiple.", "かけ算した数でもそろうね。でも“最初に”そろうのはいつかな？ もっと小さい公倍数を探そう。");
      } else {
        var L2 = lcm(d.a, d.b);
        T_(L2, "forgot-weekday", "That works for the first three — but is that day a " + DAYS[d.w] + "?", "最初の3人はそろうね。でもその日は" + ["月", "火", "水", "木", "金", "土", "日"][d.w] + "曜日かな？");
        T_(d.w, "first-weekday", "That is the first " + DAYS[d.w] + ". Do the other people water the plants that day too?", "それは最初の" + ["月", "火", "水", "木", "金", "土", "日"][d.w] + "曜日だね。ほかの人もその日に水やりする？");
        if (d.a * d.b !== L2) T_(d.a * d.b, "product", "Check the first three people again: is there a smaller common multiple of " + d.a + " and " + d.b + "?", "最初の3人を見直そう。" + d.a + " と " + d.b + " の、もっと小さい公倍数はないかな？");
      }
    }
    return t;
  }
  var PGEN = {
    count: H("Count in an organised way, and check: could anything have been counted twice?", "整理して数えよう。同じものを2回数えていないかな？"),
    ratio: H("Turn “a third more” into a ratio (3 : 4). How many are in one group? How many groups?", "「〜より3分の1多い」を比（3：4）に直そう。1組は何個？ 何組ある？"),
    multiple: H("Multiple of 6 = even AND digits add to a multiple of 3. Multiple of 9 = digits add to a multiple of 9.", "6の倍数＝偶数で、各位の和が3の倍数。9の倍数＝各位の和が9の倍数。"),
    area: H("Draw it. Twice as long as wide = two squares side by side.", "図をかこう。長さが幅の2倍＝正方形が2つ並んだ形だよ。"),
    cycle: H("Find the smallest number that fits every rule. List the days for the hardest rule and test each one.", "全部の条件に合う一番小さい数を探そう。一番きびしい条件の日を並べて、1つずつ確かめよう。")
  };
  function pmcCheck(p, inp) {
    var x = num(inp.x);
    if (x == null) return { status: "incomplete", hint: H("Type your answer in the box.", "答えを入れてね。") };
    if (x === p.answer.x) return { status: "correct" };
    var tr = pmcTraps(p);
    for (var i = 0; i < tr.length; i++) if (tr[i][0] === x && tr[i][0] !== p.answer.x) return { status: "wrong", code: tr[i][1], hint: tr[i][2] };
    return { status: "wrong", code: "other", hint: PGEN[p.pmc] };
  }

  /* ── 小数（Lent 予習） ── */
  // 値はすべて千分の一単位の整数（milli）で持つ。浮動小数は使わない
  var P10 = [1, 10, 100, 1000];
  // milli → 文字列。dp を渡すとその桁まで0を残す（10000, 2 → "10.00"）
  function decS(m, dp) {
    var f = String(m % 1000), s = fmt(Math.floor(m / 1000));
    while (f.length < 3) f = "0" + f;
    var keep = dp == null ? 0 : dp;
    while (f.length > keep && f[f.length - 1] === "0") f = f.slice(0, -1);
    return f ? s + "." + f : s;
  }
  // 入力 → milli。空・「5.」のような途中は null、小数第4位以降に0以外があれば NaN
  function dnum(v) {
    if (v == null) return null;
    v = String(v).replace(/[,\s]/g, "");
    var m = /^(\d{0,7})(?:\.(\d{0,7}))?$/.exec(v);
    if (!m || (m[1] === "" && !m[2]) || /\.$/.test(v)) return null;
    var f = m[2] || "";
    if (/[1-9]/.test(f.slice(3))) return NaN;
    return parseInt(m[1] || "0", 10) * 1000 + parseInt((f + "000").slice(0, 3), 10);
  }
  // 小数第 dp 位までの数（最後の桁は0でない）を milli で。v の範囲は呼ぶ側が決める
  function decWith(dp, lo, hi) { var v; do v = rnd(lo, hi); while (v % 10 === 0); return v * P10[3 - dp]; }
  function same(g, ans, j) { return j > 0 ? g === ans * P10[j] : g * P10[-j] === ans; }   // g が ans の 10^j 倍か
  function shifted(g, ans) { for (var j = -3; j <= 3; j++) if (j && same(g, ans, j)) return true; return false; }
  var PLACE = { tenths: [1, 100, "tenths"], hundredths: [2, 10, "hundredths"], thousandths: [3, 1, "thousandths"] };
  var DPNAME = { whole: "the nearest whole number", "1dp": "1 decimal place", "2dp": "2 decimal places" };
  var DPJA = { whole: "整数", "1dp": "小数第1位", "2dp": "小数第2位" };

  // 位の値：4.372 の「7」の値＝0.07。数字はすべて違う（同じ数字が2回出ない）
  function decPlaceMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["tenths", "hundredths", "thousandths"]), pl = PLACE[tag];
      for (;;) {
        var w = rnd(1, 99), ds = [rnd(1, 9), rnd(1, 9), rnd(1, 9)], all = String(w) + ds.join("");
        if (/(.).*\1/.test(all)) continue;
        var x = w * 1000 + ds[0] * 100 + ds[1] * 10 + ds[2], dg = ds[pl[0] - 1], xs = decS(x);
        return { type: id, tag: tag, kind: "dec", x: x, digit: dg,
          story: "What is the value of the digit " + dg + " in " + xs + "?", text: "Value of the " + dg + " in " + xs,
          fields: ["x"], answer: { x: dg * pl[1] },
          steps: ["In " + xs + ", the " + dg + " is in the " + pl[2] + " column (" + ["1st", "2nd", "3rd"][pl[0] - 1] + " place after the point).",
            dg + " " + pl[2] + " = " + decS(dg * pl[1])] };
      }
    };
  }
  // × ÷ 10・100・1000。tag：mul／div（10・100）・1000（×÷1000 は別に追う）
  function decX10Make(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["mul", "div", "1000"]);
      var op = tag === "1000" ? pick(["×", "÷"]) : tag === "mul" ? "×" : "÷", k = tag === "1000" ? 1000 : pick([10, 100]);
      for (;;) {
        var dp = rnd(1, 3), small = decWith(dp, 11, dp === 3 ? 9999 : 999);   // 小さい方の数
        var x = op === "×" ? small : small * k, ans = op === "×" ? small * k : small;
        if (decS(x).replace(/,/g, "").length > 7 || decS(ans).replace(/,/g, "").length > 7) continue;
        var n = String(k).length - 1;
        return { type: id, tag: tag, kind: "dec", op: op, k: k, x: x,
          text: decS(x) + " " + op + " " + fmt(k), fields: ["x"], answer: { x: ans },
          steps: [op + " " + fmt(k) + ": the digits move " + n + " place" + (n > 1 ? "s" : "") + " to the " + (op === "×" ? "left (the number gets bigger)." : "right (the number gets smaller)."),
            decS(x) + " " + op + " " + fmt(k) + " = " + decS(ans)] };
      }
    };
  }
  // 丸め：小数第3位までの数を 整数／小数第1位／小数第2位 に（5 は切り上げ）
  var RUNIT = { whole: 1000, "1dp": 100, "2dp": 10 }, RDP = { whole: 0, "1dp": 1, "2dp": 2 };
  function decRoundMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["whole", "1dp", "2dp"]), u = RUNIT[tag];
      var x = decWith(3, 1001, 99999), ans = Math.floor((x + u / 2) / u) * u;
      var nd = Math.floor(x / (u / 10)) % 10, nxt = ["tenths", "hundredths", "thousandths"][RDP[tag]];
      return { type: id, tag: tag, kind: "dec", x: x, dp: RDP[tag],
        story: "Round " + decS(x) + " to " + DPNAME[tag] + ".", text: "Round " + decS(x) + " to " + DPNAME[tag],
        fields: ["x"], answer: { x: ans },
        steps: ["Look at the next digit along (the " + nxt + "): it is " + nd + ".",
          nd >= 5 ? nd + " is 5 or more, so round up." : nd + " is less than 5, so round down (keep the digit).",
          decS(x) + " → " + decS(ans, RDP[tag])] };
    };
  }
  // 小数 × 1桁の整数（3.46 × 7）
  function decMulMake(id) {
    return function (prefTag) {
      var tag = prefTag || pick(["1dp", "2dp"]), dp = tag === "1dp" ? 1 : 2;
      var a = decWith(dp, dp === 1 ? 11 : 101, dp === 1 ? 999 : 9999), k = rnd(2, 9), v = a / P10[3 - dp];
      return { type: id, tag: tag, kind: "dec", op: "×", a: a, k: k, places: dp,
        text: decS(a) + " × " + k, fields: ["x"], answer: { x: a * k },
        steps: ["Ignore the point for now: " + fmt(v) + " × " + k + " = " + fmt(v * k) + ".",
          decS(a) + " has " + dp + " decimal place" + (dp > 1 ? "s" : "") + ", so the answer has " + dp + " too: " + decS(a * k, dp),
          "Check: about " + Math.round(a / 1000) + " × " + k + " = " + Math.round(a / 1000) * k + ", so the size looks right."] };
    };
  }
  // 整数 ÷ {2,4,5,8}、答えは小数第2位まで（余りを小数で続ける）。tag＝小数部分の種類
  function decTag(ans) { var f = ans % 1000; return f === 500 ? "half" : f % 250 === 0 ? "quarter" : "fifth"; }
  function decDivMake(id) {
    return function (prefTag) {
      for (;;) {
        var d = pick([2, 4, 5, 8]), N = rnd(11, 999);
        if (N % d === 0 || (N * 100) % d !== 0) continue;
        var ans = N * 1000 / d, tag = decTag(ans);
        if (prefTag && tag !== prefTag) continue;
        var q = Math.floor(N / d), r = N % d, st = [N + " ÷ " + d + " = " + q + " remainder " + r + ". Don’t stop — put a point after " + q + " and keep going."], cur = r, digits = "";
        while (cur) { cur *= 10; var dg = Math.floor(cur / d); st.push(cur + " ÷ " + d + " = " + dg + (cur % d ? " remainder " + (cur % d) : "") + "  → next digit " + dg); digits += dg; cur %= d; }
        st.push(N + " ÷ " + d + " = " + q + "." + digits);
        return { type: id, tag: tag, kind: "dec", op: "÷", N: N, d: d, q: q, r: r,
          text: N + " ÷ " + d, fields: ["x"], answer: { x: ans }, steps: st };
      }
    };
  }
  function decCheck(p, inp) {
    var g = dnum(inp.x);
    if (g == null) return { status: "incomplete", hint: H("Type your answer. If it ends with a point, add the digits after it.", "答えを入れてね。最後が「.」なら、そのあとの数字も入れよう。") };
    var ans = p.answer.x;
    if (g === ans) return { status: "correct" };
    if (g !== g) return { status: "wrong", code: "too-precise", hint: H("The answer needs no more than 3 decimal places.", "答えは小数第3位までだよ。") };
    function W(code, en, ja) { return { status: "wrong", code: code, hint: H(en, ja) }; }
    if (p.type === "dec-place") {
      if (g === p.digit * 1000) return W("digit", "That is the digit itself. What is it worth in its column?", "それは数字そのものだね。その位では、いくつ分の値かな？");
      if (shifted(g, ans)) return W("point", "Check which column the " + p.digit + " is in: tenths, hundredths or thousandths?", p.digit + " は 小数第何位（1/10・1/100・1/1000）の位にあるかな？");
    } else if (p.type === "dec-x10") {
      if (p.op === "×" ? g * p.k === p.x : g === p.x * p.k) return W("wrong-way", "Check the direction: should the answer be bigger or smaller than " + decS(p.x) + "?", "向きを確かめよう。答えは " + decS(p.x) + " より大きくなる？小さくなる？");
      if (shifted(g, ans)) return W("places", "Count the zeros in " + fmt(p.k) + ": that is how many places the digits move.", fmt(p.k) + " の0の数だけ、数字が動くよ。");
    } else if (p.type === "dec-round") {
      var u = RUNIT[p.tag];
      if (g === Math.floor(p.x / u) * u) return W("truncate", "Look at the next digit along. If it is 5 or more, round up.", "1つ右の数字を見よう。5以上なら切り上げだよ。");
      for (var t in RUNIT) if (t !== p.tag && g === Math.floor((p.x + RUNIT[t] / 2) / RUNIT[t]) * RUNIT[t]) return W("wrong-place", "Check which place to round to: " + DPNAME[p.tag] + ".", "どの位に丸めるか確かめよう：" + DPJA[p.tag] + "まで。");
    } else if (p.type === "dec-mul") {
      if (shifted(g, ans)) return W("point", "Count the decimal places in " + decS(p.a) + ". Your answer needs the same number.", decS(p.a) + " の小数点以下の桁数を数えよう。答えも同じ桁数になるよ。");
    } else if (p.type === "dec-div") {
      if (g === dnum(p.q + "." + p.r)) return W("remainder", "A remainder isn’t a decimal. Keep dividing: put a 0 after the point and carry on.", "余りはそのまま小数にはならないよ。小数点のあとに0をつけて、割り続けよう。");
      if (shifted(g, ans)) return W("point", "Check where the point goes: how many whole times does " + p.d + " go into " + p.N + "?", "小数点の位置を確かめよう。" + p.N + " の中に " + p.d + " は（整数で）いくつ入るかな？");
    }
    var gen = {
      "dec-place": H("Name the column first: after the point come tenths, hundredths, thousandths.", "まず位を確かめよう。小数点のあとは 1/10・1/100・1/1000 の位だよ。"),
      "dec-x10": H("× makes it bigger, ÷ makes it smaller. Move each digit one place for every 0.", "× は大きく、÷ は小さく。0 の数だけ数字が動くよ。"),
      "dec-round": H("Find the digit you are rounding to, then look at the one just after it.", "丸める位の数字を見つけて、その1つ右を見よう。"),
      "dec-mul": H("Multiply without the point, then put back the same number of decimal places.", "小数点をとってかけ算し、最後に同じ桁数だけ小数点を戻そう。"),
      "dec-div": H("Divide as usual. When you have a remainder, put a point and a 0, then keep going.", "ふつうに割って、余りが出たら小数点と0をつけて続けよう。")
    }[p.type];
    return { status: "wrong", code: "other", hint: gen };
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
    "frac-word":        { en: "Fraction word problems", ja: "分数の文章題", make: wordMake("frac-word"), check: wcheck, tags: ["div", "mul", "of", "add"] },
    "meas-perimeter":   { en: "Perimeter", ja: "周の長さ（長方形・L字）", make: perimMake("meas-perimeter"), check: measCheck, tags: ["rect", "lshape"] },
    "meas-area-rect":   { en: "Area of rectangles & L-shapes", ja: "長方形・L字の面積", make: areaRectMake("meas-area-rect"), check: measCheck, tags: ["rect", "lshape"] },
    "meas-area-para":   { en: "Area of a parallelogram", ja: "平行四辺形の面積", make: areaParaMake("meas-area-para"), check: measCheck },
    "meas-area-tri":    { en: "Area of a triangle", ja: "三角形の面積（直角・斜め・鈍角）", make: areaTriMake("meas-area-tri"), check: measCheck, tags: ["right", "slant", "obtuse"] },
    "meas-volume":      { en: "Volume of a cuboid", ja: "直方体の体積（cm³・m³・mm³）", make: volMake("meas-volume"), check: measCheck, tags: ["cm", "m", "mm"] },
    "meas-word":        { en: "Measurement word problems", ja: "測定の文章題", make: mwordMake("meas-word"), check: measCheck, tags: ["missing-side", "square", "cubes", "fence"] },
    "meas-convert":     { en: "Converting units", ja: "単位の換算（長さ・面積・体積）", make: convMeasMake("meas-convert"), check: measCheck, tags: ["length", "area", "volume"] },
    "meas-convert-mt":  { en: "Converting mass & time", ja: "単位の換算（重さ kg・g・t／時間 週・日・時・分・秒）", make: convMeasMake("meas-convert-mt"), check: measCheck, tags: ["mass", "time"] },
    "pmc-count":        { en: "Counting carefully (PMC)", ja: "数え上げ・二重に数えない（PMC）", make: pmcMake("pmc-count", "count"), check: pmcCheck, tags: ["digit", "pairs", "circle"] },
    "pmc-ratio":        { en: "“A third more” ratios (PMC)", ja: "「〜より◯分の1多い」の比（PMC）", make: pmcMake("pmc-ratio", "ratio"), check: pmcCheck, tags: ["one", "chain"] },
    "pmc-multiple":     { en: "Multiples of 6 & 9 (PMC)", ja: "6・9の倍数の見分け方・回文（PMC）", make: pmcMake("pmc-multiple", "multiple"), check: pmcCheck, tags: ["last", "middle", "palindrome"] },
    "pmc-area-side":    { en: "Sides from areas (PMC)", ja: "面積から辺を出す（PMC）", make: pmcMake("pmc-area-side", "area"), check: pmcCheck, tags: ["twice", "next", "outline"] },
    "pmc-cycle":        { en: "Repeating patterns & common multiples (PMC)", ja: "周期と公倍数・曜日（PMC）", make: pmcMake("pmc-cycle", "cycle"), check: pmcCheck, tags: ["lcm", "weekday"] },
    "dec-place":        { en: "Decimal place value", ja: "小数の位（その数字の値）", make: decPlaceMake("dec-place"), check: decCheck, tags: ["tenths", "hundredths", "thousandths"] },
    "dec-x10":          { en: "× and ÷ by 10, 100, 1000", ja: "小数 × ÷ 10・100・1000", make: decX10Make("dec-x10"), check: decCheck, tags: ["mul", "div", "1000"] },
    "dec-round":        { en: "Rounding decimals", ja: "小数の四捨五入（整数・小数第1位・第2位）", make: decRoundMake("dec-round"), check: decCheck, tags: ["whole", "1dp", "2dp"] },
    "dec-mul":          { en: "Decimal × whole number", ja: "小数 × 1桁の整数", make: decMulMake("dec-mul"), check: decCheck, tags: ["1dp", "2dp"] },
    "dec-div":          { en: "Dividing to a decimal answer", ja: "わり算の答えを小数で（余りを出さない）", make: decDivMake("dec-div"), check: decCheck, tags: ["half", "quarter", "fifth"] }
  };

  var G = { TYPES: TYPES, gcd: gcd, fmt: fmt, num: num, divSteps: divSteps, decS: decS, dnum: dnum };
  if (typeof module !== "undefined" && module.exports) module.exports = G; else root.MATH_GEN = G;
})(this);
