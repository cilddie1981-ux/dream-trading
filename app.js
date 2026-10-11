const $ = id => document.getElementById(id);

const defaults = [
  { symbol: "2303 聯電", slope: "rising", light: "green" },
  { symbol: "2408 南亞科", slope: "steady", light: "neutral" },
  { symbol: "2492 華新科", slope: "flat", light: "red" }
];

const money = n => Number.isFinite(n)
  ? n.toLocaleString("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 2 })
  : "—";
const fmt = n => Number.isFinite(n) ? n.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "—";

const slopeOpts = [
  ["rising", "上升加速"],
  ["steady", "斜率持平"],
  ["flat", "走平／動能減弱"],
  ["falling", "轉弱／下跌"]
];
const lightOpts = [
  ["green", "順風／持續獲利"],
  ["neutral", "中性／訊號不明"],
  ["red", "逆風／連續停損"]
];

let rowId = 0;

function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

function selectOptions(options, selected) {
  return options.map(([value, label]) =>
    `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`
  ).join("");
}

function addRow(data = {}) {
  const body = $("stockRows");
  if (!body) return;

  const tr = document.createElement("tr");
  tr.dataset.id = String(++rowId);
  tr.innerHTML = `
    <td><input class="symbol" aria-label="股票代號或名稱" placeholder="例如 2303 聯電" value="${esc(data.symbol || "")}"></td>
    <td><input class="close" aria-label="收盤價" type="number" min="0" step="0.01" placeholder="收盤價"></td>
    <td><input class="support" aria-label="支撐" type="number" min="0" step="0.01" placeholder="支撐"></td>
    <td><input class="resistance" aria-label="壓力" type="number" min="0" step="0.01" placeholder="壓力"></td>
    <td><input class="stop" aria-label="停損價" type="number" min="0" step="0.01" placeholder="停損價"></td>
    <td><select class="slope" aria-label="斜率">${selectOptions(slopeOpts, data.slope || "steady")}</select></td>
    <td><select class="light" aria-label="交易狀態">${selectOptions(lightOpts, data.light || "neutral")}</select></td>
    <td><button type="button" class="remove">移除</button></td>`;

  tr.querySelector(".remove").addEventListener("click", () => tr.remove());
  body.appendChild(tr);
}

function error(message) {
  const summary = $("summary");
  if (summary) {
    summary.innerHTML = `<h2>2｜模型共振排名</h2><div class="status red"><strong>無法評分</strong> ${esc(message)}</div>`;
  }
}

function scan() {
  const capital = Number($("capital")?.value);
  const riskPct = Number($("riskPct")?.value);
  const minScore = Number($("minScore")?.value);

  if (!(capital > 0 && riskPct > 0)) {
    error("請輸入大於 0 的帳戶資金與單筆風險比例。");
    return;
  }

  const rows = [...$("stockRows").querySelectorAll("tr")].map(tr => {
    const get = cls => tr.querySelector("." + cls).value.trim();
    return {
      symbol: get("symbol"),
      close: Number(get("close")),
      support: Number(get("support")),
      resistance: Number(get("resistance")),
      stop: Number(get("stop")),
      slope: get("slope"),
      light: get("light")
    };
  }).filter(row => row.symbol);

  if (!rows.length) {
    error("請至少新增一檔股票並輸入代號或名稱。");
    return;
  }

  const all = rows.map(row => evaluate(row, capital, riskPct)).sort((a, b) => b.score - a.score);
  const visible = all.filter(row => row.score >= minScore);
  const valid = visible.filter(row => row.valid && !row.invalidated);

  $("summary").innerHTML = `
    <h2>2｜模型共振排名</h2>
    <div class="summary-cards">
      <div class="card"><div class="label">輸入候選股</div><div class="value">${rows.length} 檔</div></div>
      <div class="card"><div class="label">達門檻名單</div><div class="value">${visible.length} 檔</div></div>
      <div class="card"><div class="label">框架尚有效</div><div class="value">${valid.length} 檔</div></div>
    </div>
    ${visible.length ? `
      <div class="table-wrap"><table class="result-table">
        <thead><tr><th>排名</th><th>股票</th><th>共振分數</th><th>收盤價</th><th>框架區間</th><th>狀態</th><th>參考進場</th><th>停損</th><th>目標 1R</th><th>目標 2R</th><th>部位試算</th></tr></thead>
        <tbody>${visible.map((row, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(row.symbol)}</strong></td>
            <td><strong>${row.score}/100</strong><br><small>${row.score >= 70 ? "高共振" : row.score >= 55 ? "中度共振" : "低共振"}</small></td>
            <td>${money(row.close)}</td>
            <td>${fmt(row.support)} — ${fmt(row.resistance)}</td>
            <td><span class="badge ${!row.valid || row.invalidated ? "red" : row.score >= 70 ? "green" : "yellow"}">${esc(row.status)}</span></td>
            <td>${row.valid ? money(row.close) : "—"}</td>
            <td>${money(row.stop)}</td>
            <td>${row.valid ? money(row.target1) : "—"}</td>
            <td>${row.valid ? money(row.target2) : "—"}</td>
            <td>${row.valid ? row.shares.toLocaleString("zh-TW") + " 股<br><small>" + money(row.shares * row.close) + "</small>" : "—"}</td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<p class="empty">沒有股票達到目前門檻。請降低門檻或檢查輸入資料。</p>`}
    <h3>個股判讀與執行紀律</h3>
    ${visible.map(row => `<div class="status ${!row.valid || row.invalidated ? "red" : row.score >= 70 ? "green" : "yellow"}"><strong>${esc(row.symbol)}｜${row.score} 分</strong> ${row.notes.map(esc).join(" ")}</div>`).join("")}
    <p class="muted small">收盤價僅作為參考進場價，不代表建議立即買進。部位為整張簡化試算，未計交易成本、滑價、跳空或流動性。</p>`;
}

function evaluate(row, capital, riskPct) {
  const valid = row.close > 0 && row.support > 0 &&
    row.resistance > row.support && row.stop > 0 && row.stop < row.close;
  const invalidated = valid && (row.close <= row.support || row.close <= row.stop);
  let score = 0;
  const notes = [];

  if (!valid) {
    notes.push("資料不完整或不合理，請確認收盤價、支撐、壓力與停損。");
  } else {
    const position = (row.close - row.support) / (row.resistance - row.support);
    if (invalidated) notes.push("價格跌破支撐或防守價，框架失效，防守優先。");
    else if (position < 0.25) { score += 40; notes.push("價格靠近框架支撐，仍需確認止跌訊號。"); }
    else if (position < 0.65) { score += 36; notes.push("價格位於框架中段，區間位置相對平衡。"); }
    else if (position < 0.85) { score += 24; notes.push("價格偏近壓力，上檔空間可能縮小。"); }
    else { score += 12; notes.push("價格接近框架壓力，留意追價風險。"); }
  }

  const slopeScores = { rising: 30, steady: 20, flat: 8, falling: 0 };
  const slopeNotes = {
    rising: "斜率上升加速。",
    steady: "斜率持平，持續追蹤推升速度。",
    flat: "斜率走平、動能減弱，評估減碼或出場。",
    falling: "斜率轉弱，防守優先。"
  };
  score += slopeScores[row.slope] ?? 0;
  notes.push(slopeNotes[row.slope] || "");

  const lightScores = { green: 30, neutral: 17, red: 0 };
  const lightNotes = {
    green: "交易狀態順風，但仍須遵守風險上限。",
    neutral: "交易狀態中性，降低部位並等待訊號。",
    red: "交易狀態逆風，縮小部位或觀望。"
  };
  score += lightScores[row.light] ?? 0;
  notes.push(lightNotes[row.light] || "");

  if (invalidated) score = Math.min(score, 20);

  const perShare = row.close - row.stop;
  const riskBudget = capital * riskPct / 100;
  let shares = valid && perShare > 0 ? Math.floor(riskBudget / perShare) : 0;
  if (row.light === "neutral") shares = Math.floor(shares * 0.5);
  if (row.light === "red") shares = Math.floor(shares * 0.25);
  shares = Math.floor(Math.min(shares, Math.floor(capital / (row.close || 1))) / 1000) * 1000;
  if (row.slope === "flat") shares = Math.floor(shares * 0.5 / 1000) * 1000;
  if (row.slope === "falling" || invalidated) shares = 0;

  const status = !valid ? "資料不足" : invalidated ? "框架失效" :
    row.slope === "falling" ? "斜率轉弱" : row.slope === "flat" ? "動能減弱" :
    row.light === "red" ? "逆風縮部位" : score >= 70 ? "高共振觀察" : "一般觀察";

  return {
    ...row, valid, invalidated, score, status, notes, shares,
    target1: row.close + perShare,
    target2: row.close + 2 * perShare
  };
}

/* Use event delegation so the add button continues to work even if the script
   is loaded early or the page's other handlers are changed. */
function initDreamScanner() {
  const addButton = $("addRow");
  const scanButton = $("scanBtn");

  if (addButton && !addButton.dataset.bound) {
    addButton.dataset.bound = "true";
    addButton.addEventListener("click", event => {
      event.preventDefault();
      addRow({});
    });
  }

  if (scanButton && !scanButton.dataset.bound) {
    scanButton.dataset.bound = "true";
    scanButton.addEventListener("click", event => {
      event.preventDefault();
      scan();
    });
  }

  if ($("stockRows") && $("stockRows").children.length === 0) {
    defaults.forEach(addRow);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDreamScanner, { once: true });
} else {
  initDreamScanner();
}
