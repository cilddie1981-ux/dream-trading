'use strict';
const $ = id => document.getElementById(id);
const SOURCES = {
  TWSE: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  TPEx: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes'
};
let marketData = [];
let scanRows = [];
let lastUpdated = '';

function number(value) {
  if (value === null || value === undefined) return NaN;
  const s = String(value).replace(/[,，\s]/g, '').replace(/％/g, '').replace(/%/g, '').replace(/^\+/, '');
  if (!s || s === '--' || s === '---' || s === 'X' || s === '除權息') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function normalizeKey(k) { return String(k).toLowerCase().replace(/[\s_\-（）()：:％%]/g, ''); }
function getField(row, aliases) {
  const entries = Object.entries(row || {});
  const normalized = entries.map(([k,v]) => [normalizeKey(k), v]);
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const exact = normalized.find(([k]) => k === target);
    if (exact) return exact[1];
  }
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const partial = normalized.find(([k]) => k.includes(target));
    if (partial) return partial[1];
  }
  return undefined;
}
function mapRow(row, market) {
  const code = String(getField(row, ['Code','股票代號','證券代號','SecuritiesCompanyCode','公司代號','代號','SecuritiesCode']) ?? '').trim();
  const name = String(getField(row, ['Name','股票名稱','證券名稱','CompanyName','公司名稱','名稱']) ?? '').trim();
  const close = number(getField(row, ['ClosingPrice','Close','收盤價','當日收盤價','成交價','收盤']));
  const open = number(getField(row, ['OpeningPrice','Open','開盤價','開盤']));
  const high = number(getField(row, ['HighestPrice','High','最高價','最高']));
  const low = number(getField(row, ['LowestPrice','Low','最低價','最低']));
  const change = number(getField(row, ['Change','漲跌','漲跌價差','漲跌金額','PriceChange']));
  const volumeKey = Object.keys(row || {}).find(k => ['tradevolume','成交股數','成交量','volume','成交股數(股)','成交量(股)','成交張數'].includes(normalizeKey(k))) || '';
  const volumeRaw = number(getField(row, ['TradeVolume','成交股數','成交量','Volume','成交股數(股)','成交量(股)','成交張數']));
  const volumeLots = Number.isFinite(volumeRaw) ? (normalizeKey(volumeKey).includes('張') ? volumeRaw : volumeRaw / 1000) : 0;
  const date = String(getField(row, ['Date','資料日期','日期','交易日期']) ?? '').trim();
  if (!code || !Number.isFinite(close) || close <= 0 || !/^[0-9A-Za-z]{2,8}$/.test(code)) return null;
  return { code, name: name || code, market, close, open, high, low, change, volumeLots, date, raw: row };
}
async function fetchJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('資料格式不是 JSON 陣列');
  return data;
}
async function fetchMarket() {
  setStatus('正在向官方公開資料來源取得行情…', 'yellow');
  const tasks = Object.entries(SOURCES).map(async ([market, url]) => {
    try {
      const rows = await fetchJSON(url);
      const mapped = rows.map(row => mapRow(row, market)).filter(Boolean);
      if (!mapped.length) throw new Error('回傳資料中找不到可辨識的行情欄位');
      return { market, rows: mapped, error: '' };
    } catch (e) {
      return { market, rows: [], error: `${market}：${e.message}` };
    }
  });
  const results = await Promise.all(tasks);
  const merged = results.flatMap(x => x.rows);
  const unique = new Map();
  merged.forEach(row => unique.set(`${row.market}:${row.code}`, row));
  marketData = [...unique.values()];
  lastUpdated = new Date().toLocaleString('zh-TW', { hour12: false });
  const failed = results.filter(x => x.error).map(x => x.error);
  if (!marketData.length) {
    setStatus('無法取得行情。可能是網路、官方 API 暫時不可用或瀏覽器跨網域限制。' + failed.join('；'), 'red');
    return;
  }
  const marketCounts = results.filter(x => x.rows.length).map(x => `${x.market === 'TWSE' ? '上市' : '上櫃'} ${x.rows.length} 檔`).join('；');
  setStatus(`資料載入完成：${marketCounts}。更新時間：${lastUpdated}。${failed.length ? '未成功來源：' + failed.join('；') : ''}`, failed.length ? 'yellow' : 'green');
  runScan();
}
function setStatus(message, type) {
  const el = $('loadStatus');
  if (el) { el.className = `status ${type || 'yellow'}`; el.textContent = message; }
}
function evaluate(row, capital, riskPct) {
  const range = Number.isFinite(row.high) && Number.isFinite(row.low) && row.high >= row.low ? row.high - row.low : 0;
  const closePos = range > 0 ? Math.max(0, Math.min(1, (row.close - row.low) / range)) : 0.5;
  const pct = Number.isFinite(row.change) && row.close - row.change > 0 ? row.change / (row.close - row.change) * 100 : 0;
  let score = 0;
  score += Math.round(closePos * 35);
  if (pct >= 4) score += 35;
  else if (pct >= 2) score += 30;
  else if (pct >= 0.5) score += 24;
  else if (pct >= 0) score += 17;
  else if (pct >= -1) score += 8;
  if (row.volumeLots >= 5000) score += 30;
  else if (row.volumeLots >= 2000) score += 25;
  else if (row.volumeLots >= 1000) score += 20;
  else if (row.volumeLots >= 500) score += 15;
  else score += 5;
  score = Math.min(100, score);
  const support = Number.isFinite(row.low) && row.low > 0 ? row.low : row.close * 0.97;
  const resistance = Number.isFinite(row.high) && row.high > 0 ? row.high : row.close * 1.03;
  const stop = Math.max(0.01, support - Math.max(range * 0.5, row.close * 0.01));
  const riskPerShare = Math.max(0.01, row.close - stop);
  const riskBudget = Math.max(0, capital * riskPct / 100);
  let shares = Math.floor(Math.min(riskBudget / riskPerShare, capital / row.close) / 1000) * 1000;
  const status = pct < -1 ? '單日轉弱觀察' : closePos >= 0.75 && pct > 0 ? '收盤偏強觀察' : pct >= 0 ? '中性偏多觀察' : '弱勢觀察';
  const notes = [];
  if (closePos >= 0.75) notes.push('收盤位於當日區間上緣。');
  else if (closePos <= 0.25) notes.push('收盤靠近當日低點，需留意賣壓。');
  if (pct >= 2) notes.push('單日漲幅偏強，避免無條件追價。');
  if (pct < 0) notes.push('單日收跌，需確認走勢是否轉弱。');
  if (row.volumeLots < 500) notes.push('成交量較低，注意流動性。');
  if (score >= 75) notes.push('列入高分候選，仍須用多日 K 線確認框架。');
  return { ...row, pct, closePos, support, resistance, stop, target1: row.close + riskPerShare, target2: row.close + 2 * riskPerShare, shares, score, status, notes };
}
function runScan() {
  if (!marketData.length) {
    setStatus('目前沒有可掃描的行情資料。請先按「更新全市場資料」或載入 CSV。', 'red');
    return;
  }
  const minPrice = number($('minPrice').value) || 0;
  const minVolume = number($('minVolume').value) || 0;
  const minScore = number($('minScore').value) || 0;
  const marketFilter = $('marketFilter').value;
  const capital = number($('capital').value);
  const riskPct = number($('riskPct').value);
  if (!(capital > 0) || !(riskPct > 0)) {
    setStatus('帳戶資金與單筆風險比例必須大於 0。', 'red');
    return;
  }
  const eligible = marketData.filter(r => r.close >= minPrice && r.volumeLots >= minVolume && (marketFilter === 'all' || r.market === marketFilter));
  scanRows = eligible.map(r => evaluate(r, capital, riskPct)).filter(r => r.score >= minScore).sort((a,b) => b.score-a.score || b.pct-a.pct);
  const limit = $('limit').value === 'all' ? scanRows.length : Number($('limit').value);
  render(scanRows.slice(0, limit), eligible.length);
}
function money(n) { return Number.isFinite(n) ? n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 }) : '—'; }
function fmt(n) { return Number.isFinite(n) ? n.toLocaleString('zh-TW', { maximumFractionDigits: 2 }) : '—'; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function render(rows, eligibleCount) {
  const dateSet = [...new Set(rows.map(r => r.date).filter(Boolean))];
  const dateText = dateSet.length === 1 ? `資料日期欄位：${dateSet[0]}` : '資料日期依來源欄位提供';
  $('summary').innerHTML = `<h2>2｜Dream 共振排名</h2>
  <div class="summary-cards"><div class="card"><div class="label">行情資料筆數</div><div class="value">${marketData.length.toLocaleString()} 檔</div></div><div class="card"><div class="label">符合價格／成交量條件</div><div class="value">${eligibleCount.toLocaleString()} 檔</div></div><div class="card"><div class="label">符合分數門檻</div><div class="value">${scanRows.length.toLocaleString()} 檔</div></div></div>
  <p class="muted small">${esc(dateText)}；頁面更新時間：${esc(lastUpdated || 'CSV 匯入')}</p>
  ${rows.length ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>排名</th><th>股票</th><th>市場</th><th>分數</th><th>收盤</th><th>漲跌幅估算</th><th>成交量（張）</th><th>支撐代理</th><th>突破觀察</th><th>防守代理</th><th>目標 1R</th><th>目標 2R</th><th>部位試算</th><th>判讀</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${esc(r.code)} ${esc(r.name)}</strong></td><td>${r.market==='TWSE'?'上市':'上櫃'}</td><td><strong>${r.score}/100</strong></td><td>${money(r.close)}</td><td class="${r.pct>=0?'positive':'negative'}">${r.pct>=0?'+':''}${fmt(r.pct)}%</td><td>${Math.round(r.volumeLots).toLocaleString('zh-TW')}</td><td>${money(r.support)}</td><td>${money(r.resistance)}</td><td>${money(r.stop)}</td><td>${money(r.target1)}</td><td>${money(r.target2)}</td><td>${r.shares.toLocaleString('zh-TW')} 股</td><td><span class="badge ${r.score>=75?'green':r.score>=60?'yellow':'red'}">${esc(r.status)}</span><br><small>${esc(r.notes.join(' '))}</small></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">沒有股票符合目前條件。可降低最低成交量、最低收盤價或分數門檻。</p>'}
  <p class="muted small">突破觀察＝當日最高價，不代表已確認突破；支撐與停損是單日估算。目標價以收盤價與估算風險距離計算，不能直接視為交易建議。</p>`;
}
function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if (lines.length < 2) throw new Error('CSV 至少要有標題列與一列資料');
  const parseLine = line => { const out=[]; let cur='', quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"' && line[i+1]==='"' && quoted){cur+='"';i++;} else if(ch==='"'){quoted=!quoted;} else if(ch===','&&!quoted){out.push(cur.trim());cur='';} else cur+=ch;} out.push(cur.trim()); return out; };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line=>{const cells=parseLine(line); const obj={}; headers.forEach((h,i)=>obj[h]=cells[i]??''); return obj;});
}
async function importCSV(file) {
  try {
    const raw = parseCSV(await file.text());
    const mapped = raw.map(r => mapRow(r, String(getField(r,['market','市場']) || 'TWSE').toUpperCase().includes('TP') ? 'TPEx' : 'TWSE')).filter(Boolean);
    if (!mapped.length) throw new Error('CSV 欄位無法辨識。請使用 Code/Name/ClosingPrice/OpeningPrice/HighestPrice/LowestPrice/TradeVolume/Change 等欄位。');
    marketData = mapped;
    lastUpdated = 'CSV 匯入 ' + new Date().toLocaleString('zh-TW',{hour12:false});
    setStatus(`CSV 匯入完成：${marketData.length} 檔。`, 'green');
    runScan();
  } catch(e) { setStatus('CSV 匯入失敗：' + e.message, 'red'); }
}
function exportCSV() {
  if (!scanRows.length) { setStatus('目前沒有掃描結果可匯出，請先執行掃描。', 'yellow'); return; }
  const headers = ['排名','代號','名稱','市場','分數','收盤價','漲跌幅估算(%)','成交量(張)','支撐代理','突破觀察','防守代理','目標1R','目標2R','部位試算(股)','狀態'];
  const rows = scanRows.map((r,i)=>[i+1,r.code,r.name,r.market,r.score,r.close,r.pct,r.volumeLots,r.support,r.resistance,r.stop,r.target1,r.target2,r.shares,r.status]);
  const csv = [headers,...rows].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='Dream_V3_全市場掃描結果.csv'; a.click(); URL.revokeObjectURL(url);
}
function init() {
  $('refreshBtn').addEventListener('click', fetchMarket);
  $('scanBtn').addEventListener('click', runScan);
  $('csvFile').addEventListener('change', e => { if (e.target.files?.[0]) importCSV(e.target.files[0]); });
  $('exportBtn').addEventListener('click', exportCSV);
  ['minPrice','minVolume','minScore','marketFilter','limit','capital','riskPct'].forEach(id => $(id).addEventListener('change', () => { if (marketData.length) runScan(); }));
  fetchMarket();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
