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

document.getElementById('convertBtn').addEventListener('click', () => {
  setTimeout(() => {
    const res = document.getElementById('resultArea').textContent;
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const amt = document.getElementById('amount').value;
    const date = document.getElementById('date').value;
    let resultNum = res.match(/= ([\d\.]+)/);
    if (resultNum && resultNum[1]) {
      saveHistory({ amt, from, to, date, result: resultNum[1] });
    }
  }, 430); // Give UI time to update
});

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
