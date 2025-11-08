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
    fromEl.value = toEl.value;
    toEl.value = tmp;
  });
}

// Accessibility: Enter-key shortcut for controls
['amount','from','to','date','convertBtn','swapBtn'].forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('keypress',e=>{
    if(e.key==="Enter" || e.keyCode===13){el.click();}
  });
});
document.addEventListener('DOMContentLoaded', populate);

// Theme toggle and accent color logic
(function() {
  const themeBtn = document.getElementById('themeToggleBtn');
  const accentPicker = document.getElementById('accentPicker');
  const root = document.documentElement;
  // Restore preferences
  function applyTheme(theme) {
    if (theme === "light") document.body.classList.add('light');
    else document.body.classList.remove('light');
    themeBtn.textContent = theme === "light" ? "☀️" : "🌙";
    themeBtn.classList.toggle('active', theme === "light");
  }
  function applyAccent(color) {
    if(color) {
      document.body.classList.add('custom-accent');
      root.style.setProperty('--user-accent', color);
      accentPicker.value = color;
    } else {
      document.body.classList.remove('custom-accent');
      root.style.removeProperty('--user-accent');
      accentPicker.value = "#6bfcbc";
    }
  }
  const userTheme = localStorage.getItem('themeMode') || "dark";
  applyTheme(userTheme);
  themeBtn.addEventListener('click', function() {
    const next = document.body.classList.contains('light') ? "dark" : "light";
    localStorage.setItem('themeMode', next);
    applyTheme(next);
  });
  // Accent logic
  const lastAccent = localStorage.getItem('accentColor');
  if (lastAccent) applyAccent(lastAccent);
  accentPicker.addEventListener('input', function() {
    localStorage.setItem('accentColor', accentPicker.value);
    applyAccent(accentPicker.value);
  });
})();
