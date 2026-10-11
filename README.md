# Dream 框架交易工具

一個可部署到 **GitHub Pages** 的繁體中文靜態網頁，用來依 Dream 交易紀律整理台股交易框架。

## 功能

- 輸入股票代號、收盤價、支撐、壓力與防守／停損價。
- 根據帳戶資金與單筆風險比例，估算風險預算與部位股數。
- 用 1R、2R 試算第一、第二目標價。
- 以走勢斜率提示動能是否減弱。
- 以順風／中性／逆風紅綠燈調整部位建議。
- 手機與桌面版響應式介面。

## 在 GitHub 上執行（GitHub Pages）

1. 解壓縮此專案。
2. 在 GitHub 建立一個新的 repository。
3. 將解壓後的所有檔案上傳至 repository 根目錄（包含 `.github` 資料夾）。
4. 開啟 repository 的 **Settings → Pages**。
5. 在 **Build and deployment** 中選擇 **Deploy from a branch**。
6. Branch 選 `main`、資料夾選 `/ (root)`，按 **Save**。
7. 等待部署完成後，從 Pages 顯示的網址開啟網站。

本專案附有 GitHub Actions 工作流程 `.github/workflows/pages.yml`，也可在 Settings → Pages 將來源改為 **GitHub Actions**。

## 本機執行

直接用瀏覽器開啟 `index.html` 即可。若要使用本機 HTTP 伺服器，可執行：

```bash
python -m http.server 8000
```

接著瀏覽 `http://localhost:8000`。

## 計算邏輯與限制

- 單筆風險預算 = 帳戶資金 × 單筆最大風險比例。
- 每股風險 = 預計進場價 − 停損價（多單情境）。
- 風險股數上限 = 單筆風險預算 ÷ 每股風險。
- 第一目標 = 進場價 + 1R；第二目標 = 進場價 + 2R。
- 逆風時將試算部位縮至 25%；中性時縮至 50%。這是可自行調整的示範規則，不是普遍適用的投資定律。
- 目前不連接即時行情 API，請手動輸入並核對行情。未計入交易成本、滑價、跳空與流動性。

## 免責聲明

本工具僅供教育、研究、紀律檢查與試算，不構成投資、法律或稅務建議。任何交易決策與風險由使用者自行承擔。
