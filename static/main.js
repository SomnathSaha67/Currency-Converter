// Simple frontend JS to populate currency selects and call /api/convert
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
    // sensible defaults
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
    resultArea.textContent = 'Converting…';
    metaArea.textContent = '';
    try {
      const r = await fetch(`/api/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`);
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
        metaArea.textContent = `Rate: 1 ${fr} = ${rate.toFixed(6)} ${toCode}  (provider: ${provider})`;
      } else {
        resultArea.textContent = `${amt} ${fr} = ${result} ${toCode}  (provider: ${provider})`;
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