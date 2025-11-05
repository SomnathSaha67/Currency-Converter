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

async function populate() {
  const amountEl = document.getElementById('amount');
  const fromEl = document.getElementById('from');
  const toEl = document.getElementById('to');
  const resultArea = document.getElementById('resultArea');
  const metaArea = document.getElementById('metaArea');
  const dateEl = document.getElementById('date');

  resultArea.textContent = 'Loading currencies…';
  try {
    const data = await fetchSymbols();
    if (!data.success) {
      resultArea.textContent = 'Failed to load currencies: ' + (data.error || 'unknown');
      metaArea.textContent = JSON.stringify(data.detail || {});
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
    fromEl.value = 'USD' in symbols ? 'USD' : codes[0];
    toEl.value = 'EUR' in symbols ? 'EUR' : (codes.length > 1 ? codes[1] : codes[0]);
    resultArea.textContent = '';
    metaArea.textContent = 'Provider: ' + data.provider;
  } catch (err) {
    resultArea.textContent = 'Network or server error while loading currencies.';
    metaArea.textContent = String(err);
  }

  document.getElementById('convertBtn').addEventListener('click', async () => {
    const from = fromEl.value;
    const to = toEl.value;
    const amount = amountEl.value || '1';
    const date = dateEl.value;
    resultArea.textContent = 'Converting…';
    metaArea.textContent = '';
    try {
      let url = `/api/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`;
      if (date) url += `&date=${encodeURIComponent(date)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.success) {
        resultArea.textContent = 'Conversion failed: ' + (j.error || 'unknown');
        metaArea.textContent = '';
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
        resultArea.textContent = `${amt} ${fr} = ${result.toFixed(6)} ${toCode}`;
        metaArea.textContent = `Rate: 1 ${fr} = ${rate.toFixed(6)} ${toCode}  (provider: ${provider})`;
      } else {
        resultArea.textContent = `${amt} ${fr} = ${result} ${toCode}  (provider: ${provider})`;
      }
      // Save conversion to history
      saveHistory({
        amt, from, to, date,
        result: (result !== undefined && result !== null)
          ? (rate ? result.toFixed(6) : result)
          : resultArea.textContent
      });
      // Update dashboard + live chart on every conversion
      fetchLivePairRate();
      fetchHistoryTrend();
    } catch (err) {
      resultArea.textContent = 'Error performing conversion.';
      metaArea.textContent = String(err);
    }
  });

  document.getElementById('swapBtn').addEventListener('click', () => {
    const tmp = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = tmp;
  });
}

populate();

// --- History/Dashboard ---

function saveHistory(record) {
  const key = 'currencyHistory';
  const history = JSON.parse(localStorage.getItem(key)) || [];
  history.unshift(record);
  if (history.length > 15) history.length = 15;
  localStorage.setItem(key, JSON.stringify(history));
}
function loadHistory() {
  return JSON.parse(localStorage.getItem('currencyHistory')) || [];
}
function showDashboard() {
  const listEl = document.getElementById('historyList');
  const history = loadHistory();
  listEl.innerHTML = '';
  if (!history.length) {
    listEl.innerHTML = "<li>No conversions yet.</li>";
    if (window.dashboardChart) window.dashboardChart.destroy();
    return;
  }
  for (const item of history) {
    const li = document.createElement('li');
    li.textContent = `${item.amt} ${item.from} → ${item.to} = ${item.result} (${item.date || 'latest'})`;
    listEl.appendChild(li);
  }
  // --- Chart favorites
  const pairs = {};
  for (const item of history) {
    const pair = item.from + "→" + item.to;
    pairs[pair] = (pairs[pair] || 0) + 1;
  }
  if (window.dashboardChart) window.dashboardChart.destroy();
  const ctx = document.getElementById('historyChart').getContext('2d');
  window.dashboardChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(pairs),
      datasets: [{
        label: "Most Used Pairs",
        data: Object.values(pairs),
        backgroundColor: "rgba(76,255,208,0.37)",
        borderColor: "rgba(70,200,220,0.8)",
        borderWidth: 1.5,
      }]
    },
    options: {scales: {y:{beginAtZero:true, ticks:{color:'#b8faff'}}}, plugins:{legend:{labels:{color:'#b2f4e3'}}}}
  });
}

document.getElementById('dashboardBtn').addEventListener('click', function() {
  const sect = document.getElementById('dashboardSection');
  sect.style.display = (sect.style.display === 'none' ? 'block' : 'none');
  if (sect.style.display === 'block') showDashboard();
});

// --- Live Rate/History Trend for Most Used Pair ---

function getMostUsedPair() {
  const history = JSON.parse(localStorage.getItem('currencyHistory') || '[]');
  const pairs = {};
  for (const item of history) {
    const key = item.from + "_" + item.to;
    pairs[key] = (pairs[key] || 0) + 1;
  }
  let max = 0, maxPair = ['INR', 'USD'];
  for (const k in pairs)
    if (pairs[k] > max) [max, maxPair] = [pairs[k], k.split('_')];
  return maxPair;
}

async function fetchLivePairRate() {
  const [from, to] = getMostUsedPair();
  const valEl = document.getElementById('liveRateValue');
  const metaEl = document.getElementById('liveRateMeta');
  if (!valEl || !metaEl) return;
  try {
    const res = await fetch(`/api/convert?from=${from}&to=${to}&amount=1`);
    const data = await res.json();
    if (data && data.success && data.data && data.data.result) {
      valEl.textContent =
        `1 ${from} = ${Number(data.data.result).toFixed(3)} ${to}`;
      metaEl.textContent =
        `Last updated: ${new Date().toLocaleString()}`;
    } else {
      valEl.textContent = "--";
      metaEl.textContent = "No data";
    }
  } catch (err) {
    valEl.textContent = "--";
    metaEl.textContent = "Error loading live rate";
  }
}
fetchLivePairRate();
setInterval(fetchLivePairRate, 120000);

let chartInst = null;
async function fetchHistoryTrend() {
  const [from, to] = getMostUsedPair();
  const chartEl = document.getElementById('historyTrendChart');
  const metaEl = document.getElementById('historyTrendMeta');
  if (!chartEl || !metaEl) return;
  try {
    const now = new Date();
    const lastYear = new Date(now.getFullYear()-1, now.getMonth(), now.getDate());
    const start = lastYear.toISOString().slice(0,10);
    const end = now.toISOString().slice(0,10);
    const url = `/api/history?from=${from}&to=${to}&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.success && data.data && data.data.rates) {
      const dates = Object.keys(data.data.rates).sort();
      const pts = dates.map(date=>data.data.rates[date][to]);
      const ctx = chartEl.getContext('2d');
      if (chartInst) chartInst.destroy();
      chartInst = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates.map(d => d.slice(0,7)),
          datasets: [{label:`${from}/${to} 1Y Trend`,data: pts,borderColor:"#90ffdc",backgroundColor:"rgba(60,255,215,0.042)",tension:0.14}]
        },
        options: {
          responsive:true, plugins:{legend:{labels:{color:'#cee'}}},
          scales:{
            y:{beginAtZero:false,grid:{color:"#232333"},ticks:{color:"#b8ffe2"}},
            x:{grid:{color:"#232333"},ticks:{color:"#bccfff",maxTicksLimit:7}}
          }
        }
      });
      metaEl.textContent =
        `Trend for most used pair: ${from} → ${to}`;
    }
  } catch (e) {
    metaEl.textContent =
      "No history data for this pair or error fetching data!";
  }
}
fetchHistoryTrend();
window.addEventListener('storage', fetchHistoryTrend);

// --- Accessibility Enhancement ---
['amount','from','to','date','convertBtn','swapBtn','dashboardBtn'].forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('keypress',e=>{
    if(e.key==="Enter" || e.keyCode===13){el.click();}
  });
});
let errorEl = document.createElement('div');
errorEl.id = "errorArea"; errorEl.setAttribute("aria-live", "assertive");
document.body.appendChild(errorEl);
document.getElementById('convertBtn').addEventListener('click', ()=>{
  const amt = document.getElementById('amount').value;
  if (!amt || isNaN(Number(amt)) || Number(amt)<=0) {
    errorEl.textContent = "Please enter a valid, positive amount for conversion.";
    document.getElementById('amount').focus();
  } else {
    errorEl.textContent = "";
  }
});
