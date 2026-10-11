Dream V3 全市場掃描版｜GitHub Pages 靜態網站

檔案：index.html、app.js、style.css

替換步驟：
1. 開啟 GitHub 專案：https://github.com/cilddie1981-ux/dream-trading
2. 依序打開 index.html、app.js、style.css，分別按 Edit。
3. 每個檔案都把原內容全選刪除，貼上 ZIP 內同名檔案的完整內容。
4. 每個檔案按 Commit changes。
5. 等 GitHub Pages 部署完成後，開啟：
   https://cilddie1981-ux.github.io/dream-trading/?v=3
6. 等頁面自動載入，或按「更新全市場資料」，再按「執行 Dream 全市場掃描」。

重要限制：
- 行情來自 TWSE / TPEx 官方公開 API，可能延遲、暫停或因瀏覽器 CORS 限制而無法讀取。
- 若官方 API 無法連線，可用「載入行情 CSV」匯入；欄位至少需要股票代號、名稱、收盤價、開盤價、最高價、最低價、成交量、漲跌欄位。英文欄位建議使用 Code,Name,ClosingPrice,OpeningPrice,HighestPrice,LowestPrice,TradeVolume,Change。
- V3 用最新可取得的單日行情做初篩，不是歷史 K 線趨勢分析。支撐、壓力、停損及目標價是單日區間代理值，不可直接當成實際交易指令。
- 這個版本不會自動下單，也不保證所有瀏覽器或官方 API 一定能成功連線。
