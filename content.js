/* 算数アプリ — 単元データ
 * 毎週金曜のニュースレター要約（knowledge/weeks/ の Maths 欄）から AI が更新する。
 * ルール：
 *  - 型の id（gen.js の TYPES）は一度付けたら変えない（進捗が型 id に紐づく）
 *  - 名前・学校名など個人が特定できる情報は入れない
 *  - unit.status: "next"=今週・来週の予習 / "review"=やった単元の復習 / "bank"=いつでも
 *  - mix: 1回（Start）の配分。単元 id と問題数。short は合計8問、long は合計14問
 */
window.MATH_CONTENT = {
  version: "2026-10-03",
  appName: "Skyline Maths",

  units: [
    {
      id: "m-longdiv",
      status: "next",
      when: "This week · 5 Oct",
      title: "Long division",
      ja: "長いわり算（4桁÷2桁・余りあり）",
      types: ["div-4by2-exact", "div-4by2-rem", "div-3by2-rem"],
      source: "Michaelmas W7 ニュースレター（10/2）：長いわり算（筆算）を正確に → その後、分数の復習"
    },
    {
      id: "m-fractions",
      status: "next",
      when: "This week · 5 Oct",
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
    short: [["m-longdiv", 3], ["m-mult", 2], ["m-fractions", 3]],
    long: [["m-longdiv", 5], ["m-mult", 4], ["m-fractions", 5]]
  }
};
