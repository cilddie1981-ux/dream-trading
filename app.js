const $ = (id) => document.getElementById(id);
const today = new Date();
$("tradeDate").value = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);

const money = n => Number.isFinite(n) ? n.toLocaleString("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:2}) : "—";
const price = n => Number.isFinite(n) ? n.toLocaleString("zh-TW",{maximumFractionDigits:2}) : "—";
const num = id => Number($(id).value);
const fmtCard = (label,value) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`;

$("tradeForm").addEventListener("submit", event => {
  event.preventDefault();
  const symbol = $("symbol").value.trim();
  const current = num("price"), support = num("support"), resistance = num("resistance"), stop = num("stop");
  const capital = num("capital"), riskPct = num("riskPct"), entry = $("entry").value ? num("entry") : current;
  const slope = $("slope").value, streak = $("streak").value, holding = $("holding").value;
  const results = $("results");
  if (!(support > 0 && resistance > support && current > 0 && stop > 0 && entry > 0 && capital > 0 && riskPct > 0)) {
    results.innerHTML = '<h2>2｜分析結果</h2><div class="status red"><strong>輸入資料有誤</strong>請確認價格大於 0、壓力高於支撐，且資金與風險比例有效。</div>';
    return;
  }
  const validStop = stop < entry;
  const riskPerShare = entry - stop;
  const riskBudget = capital * riskPct / 100;
  const maxSharesRisk = validStop ? Math.floor(riskBudget / riskPerShare) : 0;
  const maxSharesCapital = Math.floor(capital / entry);
  let shares = Math.max(0, Math.min(maxSharesRisk, maxSharesCapital));
  let allocationFactor = streak === "red" ? 0.25 : streak === "neutral" ? 0.5 : 1;
  shares = Math.floor(shares * allocationFactor);
  const lotShares = Math.floor(shares / 1000) * 1000;
  const target1 = entry + (entry - stop);
  const target2 = entry + 2 * (entry - stop);
  const frameworkRange = resistance - support;
  const positionRisk = validStop ? lotShares * riskPerShare : 0;
  const distanceToSupport = ((current - support) / support) * 100;
  const distanceToResistance = ((resistance - current) / current) * 100;

  let signalClass = "yellow", signalTitle = "等待確認", signalText = "價格仍需搭配框架與走勢確認，避免只因單一訊號進場。";
  if (current < support || current <= stop) {
    signalClass = "red"; signalTitle = "框架失效／防守優先";
    signalText = "價格已跌破支撐或防守價。若已持有，依事前計畫處理，不應臨時改用其他策略攤平。";
  } else if (current > resistance) {
    signalClass = "yellow"; signalTitle = "壓力突破觀察";
    signalText = "價格高於原框架壓力，需確認是否有效突破及是否有追價風險；不要直接把突破當成保證買點。";
  } else if (slope === "rising" && streak === "green" && current >= support && current <= resistance) {
    signalClass = "green"; signalTitle = "框架內順勢觀察";
    signalText = "走勢斜率向上且交易狀態順風，可依計畫評估；仍須守住停損與單筆風險上限。";
  }

  let slopeText = {
    rising: "斜率上升加速：可續看趨勢，但不代表應無上限加碼。",
    steady: "斜率持平：追蹤推升速度是否繼續減弱，避免把盤整誤判為加速。",
    flat: "斜率走平、動能減弱：依 Dream 原則評估減碼或出場，不必等待反轉 K 線。",
    falling: "斜率轉弱／下跌：提高防守優先級，避免在動能轉弱時擴大部位。"
  }[slope];
  let lightText = streak === "green" ? "綠燈：可依策略運作，但部位仍受風險上限約束。" :
    streak === "neutral" ? "黃燈：降低部位，等待市場節奏與訊號更明確。" :
    "紅燈：建議縮小部位或空倉觀望；本工具將風險計算部位再縮至 25%。";
  if (!validStop) {
    signalClass = "red"; signalTitle = "停損設定不合理";
    signalText = "多單情境下，防守／停損價應低於預計進場價。請先重新定義框架與失效位置。";
  }

  results.innerHTML = `
    <h2>2｜分析結果：${escapeHtml(symbol)}</h2>
    <div class="status ${signalClass}"><strong>${signalTitle}</strong>${signalText}</div>
    <div class="cards">
      ${fmtCard("目前／收盤價", money(current))}
      ${fmtCard("框架區間", `${price(support)} — ${price(resistance)}`)}
      ${fmtCard("進場參考價", money(entry))}
      ${fmtCard("第一目標（1R）", money(target1))}
      ${fmtCard("第二目標（2R）", money(target2))}
      ${fmtCard("預設停損價", money(stop))}
      ${fmtCard("單筆風險預算", money(riskBudget))}
      ${fmtCard("建議股數（整張）", `${lotShares.toLocaleString("zh-TW")} 股`)}
      ${fmtCard("預估投入金額", money(lotShares * entry))}
    </div>
    <div class="status ${streak === "red" || slope === "falling" || slope === "flat" ? "yellow" : "green"}"><strong>走勢斜率</strong>${slopeText}</div>
    <div class="status ${streak === "red" ? "red" : streak === "neutral" ? "yellow" : "green"}"><strong>資金紅綠燈</strong>${lightText}</div>
    <h3>執行檢查</h3>
    <ul class="detail-list">
      <li>價格相對支撐：${distanceToSupport.toFixed(2)}%；相對壓力：${distanceToResistance.toFixed(2)}%。</li>
      <li>進場至停損每股風險：${validStop ? money(riskPerShare) : "設定錯誤"}；風險計算股數上限（未套用紅綠燈折減）：${validStop ? maxSharesRisk.toLocaleString("zh-TW") : "0"} 股。</li>
      <li>框架寬度：${price(frameworkRange)}；目標價為風險倍數試算，不是價格預測或保證。</li>
      <li>${holding === "yes" ? "目前為持倉狀態：若防守框架失效，依原定規則執行，避免改變交易理由。" : "目前尚未進場：先定義失效位置與可承受損失，再決定是否下單。"}</li>
      <li>未計入手續費、交易稅、滑價、跳空與最低交易單位等因素；台股零股／整股規則請自行確認。</li>
    </ul>`;
});

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
