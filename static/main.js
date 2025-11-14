async function fetchSymbols() {
  const res = await fetch('/api/symbols');
  return res.json();
}
function createOption(code, text) {
  const o = document.createElement('option');
  o.value = code;
  o.textContent = `${code} — ${text}`;
  return o;
}
function createBatchTable(results, from, amount) {
  let table = `
  <div class="batch-table-glass">
    <table class="batch-table">
      <thead>
        <tr>
          <th>Currency</th>
          <th>Amount</th>
          <th>Rate (1 ${from})</th>
          <th>Provider</th>
        </tr>
      </thead>
      <tbody>
  `;
  for (const r of results) {
    table += `<tr>
      <td><span class="batch-code">${r.to}</span></td>
      <td><span class="batch-result">${r.result}</span></td>
      <td><span class="batch-rate">${r.rate === "N/A" ? "N/A" : r.rate}</span></td>
      <td><span class="batch-provider">${r.provider}</span></td>
    </tr>`;
  }
  table += `
      </tbody>
    </table>
  </div>`;
  return table;
}

async function populate() {
  const amountEl = document.getElementById('amount');
  const fromEl = document.getElementById('from');
  const toEl = document.getElementById('to');
  const resultArea = document.getElementById('resultArea');
  const metaArea = document.getElementById('metaArea');
  const dateEl = document.getElementById('date');
  const errorEl = document.getElementById('errorArea');
  const providerArea = document.getElementById('providerArea');

  resultArea.textContent = 'Loading currencies…';
  try {
    const data = await fetchSymbols();
    if (!data.success) {
      resultArea.textContent = 'Failed to load currencies: ' + (data.error || 'unknown');
      metaArea.textContent = JSON.stringify(data.detail || {});
      providerArea.textContent = "";
      return;
    }
    const symbols = data.symbols;
    const codes = Object.keys(symbols).sort();
    fromEl.innerHTML = '';
    toEl.innerHTML = '';
    codes.forEach(code => {
      const desc = symbols[code].description || '';
      fromEl.appendChild(createOption(code, desc));
      toEl.appendChild(createOption(code, desc));
    });
    const allOption = document.createElement('option');
    allOption.value = "ALL";
    allOption.textContent = "ALL — All Currencies";
    toEl.insertBefore(allOption, toEl.firstChild);
    fromEl.value = 'USD' in symbols ? 'USD' : codes[0];
    toEl.value = 'EUR' in symbols ? 'EUR' : (codes.length > 1 ? codes[1] : codes[0]);
    resultArea.textContent = '';
    metaArea.textContent = '';
    providerArea.textContent = "Provider: " + data.provider;
  } catch (err) {
    resultArea.textContent = 'Network or server error while loading currencies.';
    metaArea.textContent = String(err);
    providerArea.textContent = "";
  }
  document.getElementById('convertBtn').addEventListener('click', async () => {
    const from = fromEl.value;
    const to = toEl.value;
    const amount = amountEl.value || '1';
    const date = dateEl.value;
    resultArea.textContent = 'Converting…';
    metaArea.textContent = '';
    errorEl.textContent = '';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      errorEl.textContent = "Please enter a valid, positive amount for conversion.";
      amountEl.focus();
      resultArea.textContent = '';
      return;
    }
    if (to === "ALL") {
      const data = await fetchSymbols();
      if (!data.success) {
        errorEl.textContent = "Could not load currency symbols.";
        return;
      }
      const batchCodes = Object.keys(data.symbols).filter(code => code !== from);
      const promises = batchCodes.map(code => {
        let url = `/api/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(code)}&amount=${encodeURIComponent(amount)}`;
        if (date) url += `&date=${encodeURIComponent(date)}`;
        return fetch(url).then(r => r.json()).then(j => {
          if (!j.success || !j.data) {
            return { to: code, result: "Error", rate: "N/A", provider: "N/A" };
          }
          return {
            to: code,
            result: j.data.result ? j.data.result.toFixed(6) : "Error",
            rate: j.data.info && j.data.info.rate ? j.data.info.rate.toFixed(6) : "N/A",
            provider: j.provider || ""
          };
        }).catch(() => ({
          to: code,
          result: "Error",
          rate: "N/A",
          provider: "N/A"
        }));
      });
      const batchResults = await Promise.all(promises);
      resultArea.innerHTML = createBatchTable(batchResults, from, amount);
      providerArea.textContent = "Provider: Multiple";
      metaArea.innerHTML = "";
      return;
    }
    try {
      let url = `/api/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`;
      if (date) url += `&date=${encodeURIComponent(date)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.success) {
        resultArea.textContent = 'Conversion failed: ' + (j.error || 'unknown');
        providerArea.textContent = '';
        return;
      }
      const provider = j.provider || (j.data && j.data.provider) || '';
      const data = j.data || {};
      const amt = data.query && data.query.amount ? data.query.amount : amount;
      const fr = data.query && data.query.from ? data.query.from : from;
      const toCode = data.query && data.query.to ? data.query.to : to;
      const result = data.result;
      const rate = data.info && data.info.rate ? data.info.rate : null;
      if (rate !== null) {
        resultArea.innerHTML = `
          <div class="result-main">
            ${amt} ${fr} = ${result.toFixed(6)} ${toCode}
          </div>
          <div class="result-rate">
            Rate: 1 ${fr} = ${rate.toFixed(6)} ${toCode}
          </div>
        `;
        metaArea.innerHTML = "";
      } else {
        resultArea.innerHTML = `
          <div class="result-main">
            ${amt} ${fr} = ${result} ${toCode}
          </div>`;
        metaArea.innerHTML = "";
      }
      providerArea.textContent = "Provider: " + provider;
    } catch (err) {
      resultArea.textContent = 'Error performing conversion.';
      metaArea.textContent = String(err);
      providerArea.textContent = "";
    }
  });
  document.getElementById('swapBtn').addEventListener('click', () => {
    const tmp = fromEl.value;
    fromEl.value = toEl.value !== "ALL" ? toEl.value : tmp;
    toEl.value = tmp;
  });
}
['amount','from','to','date','convertBtn','swapBtn'].forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('keypress',e=>{
    if(e.key==="Enter" || e.keyCode===13){el.click();}
  });
});
document.addEventListener('DOMContentLoaded', populate);

// ----- (1) CHART: Historical exchange trend -----
let chartInst = null;
async function renderCurrencyChart() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const days = document.getElementById('chartPeriod').value;
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  const dt = new Date(now); dt.setDate(dt.getDate() - days);
  const startDate = dt.toISOString().split('T')[0];
  const url = `https://api.exchangerate.host/timeseries?start_date=${startDate}&end_date=${endDate}&base=${from}&symbols=${to}`;
  const r = await fetch(url); const data = await r.json();
  const labels = []; const rates = [];
  for (let d in data.rates) {
    labels.push(d); rates.push(data.rates[d][to]);
  }
  const ctx = document.getElementById('currencyChart').getContext('2d');
  if (chartInst) chartInst.destroy();
  if (rates.length > 0 && rates.every(x => typeof x === 'number' && isFinite(x))) {
    chartInst = new Chart(ctx, {
      type: 'line', data: {labels: labels, datasets:[{label:`${from}→${to}`,data: rates,borderColor:'#6bfcbc',fill:false}]},
      options: {scales:{x:{display:false},y:{beginAtZero:false}}, plugins:{legend:{display:false}}}
    });
    const min = Math.min(...rates), max = Math.max(...rates), avg = rates.reduce((a,b)=>a+b,0)/rates.length;
    const volatility = ((max-min)/avg*100).toFixed(2);
    document.getElementById('chartStats').innerHTML =
      `High: ${max.toFixed(4)}, Low: ${min.toFixed(4)}, Avg: ${avg.toFixed(4)}, Volatility: ${volatility}%`;
  } else {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    document.getElementById('chartStats').innerHTML = "No historical data available for this currency pair.";
  }
}
document.getElementById('chartPeriod').addEventListener('change', renderCurrencyChart);
document.getElementById('from').addEventListener('change', renderCurrencyChart);
document.getElementById('to').addEventListener('change', renderCurrencyChart);
document.addEventListener('DOMContentLoaded', renderCurrencyChart);

// ----- (7) Financial Tips -----
const tips = [
  "Diversify your savings across different strong currencies.",
  "Check for hidden conversion fees when exchanging money.",
  "Plan international payments when the currency is strongest.",
  "Monitor currency charts to spot trends before converting.",
  "Small daily fluctuations can add up for big transactions—watch volatility.",
  "Set exchange rate alerts if you need a specific rate soon.",
  "Understand how inflation affects currency value long-term.",
  "Favor online transfers for lower fees, but compare rates first."
];
let tipNum = 0;
function showTip() {
  document.getElementById('financialTip').textContent = tips[tipNum];
}
document.getElementById('tipBlock').addEventListener('click', ()=>{ tipNum = (tipNum+1)%tips.length; showTip(); });
document.addEventListener('DOMContentLoaded', showTip);

// ----- (8) TradingView indices ticker -----
document.addEventListener('DOMContentLoaded', function(){
  const tvDiv = document.getElementById('tradingview-widget');
  tvDiv.innerHTML = `<iframe src="https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#%7B%22symbols%22%3A%5B%7B%22proName%22%3A%22FOREXCOM%3AEURUSD%22%2C%22title%22%3A%22EUR%2FUSD%22%7D%2C%7B%22proName%22%3A%22OANDA%3AUSDINR%22%2C%22title%22%3A%22USD%2FINR%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDEUR%22%2C%22title%22%3A%22USD%2FEUR%22%7D%2C%7B%22proName%22%3A%22NASDAQ%3ANDS%22%2C%22title%22%3A%22NASDAQ%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AGBPUSD%22%2C%22title%22%3A%22GBP%2FUSD%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDJPY%22%2C%22title%22%3A%22USD%2FJPY%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDCAD%22%2C%22title%22%3A%22USD%2FCAD%22%7D%2C%7B%22proName%22%3A%22BITSTAMP%3ABTCUSD%22%2C%22title%22%3A%22BTC%2FUSD%22%7D%5D%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22displayMode%22%3A%22adaptive%22%2C%22locale%22%3A%22en%22%7D"
    width="100%" height="48" style="border:none;overflow:hidden;" allowtransparency="true"></iframe>`;
});
