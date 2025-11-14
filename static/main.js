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

// NEWS BLOCK
async function fetchCurrencyNews() {
  const apiKey = '6cae3a3a4bee4776b3e1fc998237d7f3';
  const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&apiKey=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const newsList = document.getElementById('newsList');
    newsList.innerHTML = '';
    if (data.articles && data.articles.length > 0) {
      data.articles.slice(0, 8).forEach(article => {
        let li = document.createElement('li');
        li.innerHTML = `<a href="${article.url}" target="_blank">${article.title}</a>
          <span style="color:#7a8fae;font-size:.95em"> (${article.source.name})</span>`;
        newsList.appendChild(li);
      });
    } else {
      newsList.innerHTML = "<li>No recent news found.</li>";
    }
  } catch (e) {
    document.getElementById('newsList').innerHTML = "<li>Could not load news.</li>";
  }
}
document.addEventListener('DOMContentLoaded', fetchCurrencyNews);
