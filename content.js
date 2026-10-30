/* 算数アプリ — 単元データ
 * 毎週金曜のニュースレター要約（knowledge/weeks/ の Maths 欄）から AI が更新する。
 * ルール：
 *  - 型の id（gen.js の TYPES）は一度付けたら変えない（進捗が型 id に紐づく）
 *  - 名前・学校名など個人が特定できる情報は入れない
 *  - unit.status: "next"=今週・来週の予習 / "review"=やった単元の復習 / "bank"=いつでも
 *  - mix: 1回（Start）の配分。単元 id と問題数。short は合計8問、long は合計14問
 */
window.MATH_CONTENT = {
  version: "2026-10-30",
  appName: "Skyline Maths",

  units: [
    {
      id: "m-measure",
      status: "next",
      when: "Week of 2 Nov",
      title: "Perimeter, area & volume",
      ja: "測定（周の長さ・長方形/L字・平行四辺形・三角形の面積・直方体の体積）",
      types: ["meas-perimeter", "meas-area-rect", "meas-area-para", "meas-area-tri", "meas-volume"],
      source: "Michaelmas W10 ニュースレター（10/30・/news/13302）：分数の四則を続けつつ測定へ。perimeter, area, volume, formulae, parallelograms, triangles, cuboids, cm³, m³"
    },
    {
      id: "m-measure-word",
      status: "next",
      when: "Week of 2 Nov",
      title: "Measurement word problems",
      ja: "測定の文章題（PMC 風：面積から辺・正方形・立方体を詰める・フェンス代）",
      types: ["meas-word"],
      source: "Michaelmas W10 ニュースレター（10/30・/news/13302）：PMC（Primary Mathematics Challenge）向けの文章題練習を継続"
    },
    {
      id: "m-frac-muldiv",
      status: "review",
      when: "Week of 26 Oct",
      title: "Multiplying & dividing fractions",
      ja: "分数のかけ算・わり算（整数との計算・ひっくり返してかける）",
      types: ["frac-mul", "frac-mul-whole", "frac-div-whole", "frac-div"],
      source: "Michaelmas W9 ニュースレター（10/23・/news/13125）：約分・同値分数を終え、分数の四則演算を使った式（仮分数・帯分数を含む）へ"
    },
    {
      id: "m-frac-word",
      status: "review",
      when: "Week of 26 Oct",
      title: "Fraction word problems",
      ja: "分数の文章題（たし算・かけ算・わり算・〜の〜）",
      types: ["frac-word"],
      source: "Michaelmas W9 ニュースレター（10/23・/news/13125）：分数の文章題・チャレンジ問題"
    },
    {
      id: "m-frac-addsub",
      status: "review",
      when: "After half term · 19 Oct",
      title: "Adding & subtracting fractions",
      ja: "分母の違う分数のたし算・ひき算",
      types: ["frac-addsub-related", "frac-addsub-unlike", "frac-add-over-one"],
      source: "Michaelmas W8 ニュースレター（10/9）：休み明けは分母の違う分数のたし算・ひき算（公倍数で共通分母・約分）"
    },
    {
      id: "m-mixed",
      status: "review",
      when: "After half term · 19 Oct",
      title: "Mixed numbers",
      ja: "仮分数・帯分数とその計算",
      types: ["frac-to-mixed", "mixed-to-improper", "mixed-add", "mixed-sub"],
      source: "Michaelmas W8 ニュースレター（10/9）：仮分数・帯分数を含む計算、多段階の文章題"
    },
    {
      id: "m-longdiv",
      status: "review",
      when: "Week of 5 Oct",
      title: "Long division",
      ja: "長いわり算（4桁÷2桁・余りあり）",
      types: ["div-4by2-exact", "div-4by2-rem", "div-3by2-rem"],
      source: "Michaelmas W7 ニュースレター（10/2）：長いわり算（筆算）を正確に → その後、分数の復習"
    },
    {
      id: "m-fractions",
      status: "review",
      when: "Week of 5 Oct",
      title: "Simplifying & equivalent fractions",
      ja: "約分・同値分数",
      types: ["frac-simplify", "frac-simplify-big", "frac-equiv-up", "frac-equiv-down"],
      source: "Michaelmas W7 ニュースレター（10/2）：約分、約数・倍数を使って同値分数を見つける"
    },
    {
      id: "m-mult",
      status: "review",
      when: "Earlier this term",
      title: "Long multiplication",
      ja: "4桁×2桁のかけ算",
      types: ["mul-4by2", "mul-4by2-zero"],
      source: "わり算の確かめ算・筆算の土台として（ニュースレター W7 の長いわり算の前提）"
    }
  ],

  mix: {
    short: [["m-measure", 3], ["m-measure-word", 1], ["m-frac-muldiv", 2], ["m-frac-word", 1], ["m-mixed", 1]],
    long: [["m-measure", 6], ["m-measure-word", 2], ["m-frac-muldiv", 2], ["m-frac-word", 2], ["m-frac-addsub", 1], ["m-mixed", 1]]
  }
};
