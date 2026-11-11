#!/usr/bin/env node
// 運行情報フィード生成: JR西日本公式 JSON を第一ソースに status.json を作る。
// 公式が取得・解析できないときだけ Yahoo!路線情報にフォールバックする。
// 使い方: node feed/fetch-status.js <出力先 status.json>
const fs = require('fs');
const path = require('path');
const ST = require(fs.existsSync(path.join(__dirname, 'status.js')) ? './status.js' : '../src/status.js');
const UA = { 'User-Agent': 'Mozilla/5.0' };

async function get(url, ms) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res;
}
async function official() {
  for (let i = 0; i < 3; i++) {
    try {
      const data = await (await get(ST.OFFICIAL_URL, 20000)).json();
      const parsed = ST.parseOfficial(data, ST.todayJST(new Date()));
      if (parsed) return parsed;
      console.error('official: unexpected shape');
    } catch (e) { console.error('official:', e.message); }
    await new Promise(r => setTimeout(r, 3000));
  }
  return null;
}
async function yahoo() {
  try { return ST.parseYahoo(await (await get(ST.YAHOO_URL, 15000)).text()); }
  catch (e) { console.error('yahoo:', e.message); return null; }
}
(async () => {
  const out = process.argv[2] || 'status.json';
  const st = (await official()) || (await yahoo());
  if (!st) { console.error('both sources failed; leaving previous status.json untouched'); process.exit(1); }
  st.fetchedAt = new Date().toISOString();
  fs.writeFileSync(out, JSON.stringify(st, null, 1) + '\n');
  console.log(`${st.source} ${st.state} createdAt=${st.createdAt} details=${st.details.length}`);
})();
