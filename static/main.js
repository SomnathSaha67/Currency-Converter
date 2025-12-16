// ----- Helpers -----
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

function createBatchSkeleton(from, amount, count = 8) {
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
  for (let i = 0; i < count; i++) {
    table += `
      <tr class="batch-skeleton-row">
        <td><span class="batch-skeleton-chip skeleton-pulse"></span></td>
        <td><span class="batch-skeleton-text skeleton-pulse"></span></td>
        <td><span class="batch-skeleton-text skeleton-pulse"></span></td>
        <td><span class="batch-skeleton-text skeleton-pulse"></span></td>
      </tr>
    `;
  }
  table += `
      </tbody>
    </table>
  </div>`;
  return table;
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

// Simple debounce so we don't spam the server while typing
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// LocalStorage helpers for favorites and alerts
const FAV_KEY = 'converter_favorites_v1';
const ALERT_KEY = 'converter_alerts_v1';

// Tiny toast utility for micro-feedback
function showToast(message, type = 'info', timeout = 2400) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live','polite');
    container.style.position = 'fixed';
    container.style.right = '18px';
    container.style.top = '18px';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'mini-toast mini-toast-' + type;
  el.textContent = message;
  el.style.margin = '6px 0';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '10px';
  el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.22)';
  el.style.background = type === 'success' ? 'linear-gradient(90deg,#6bfcbc,#47a1ff)' : 'rgba(0,0,0,0.6)';
  el.style.color = '#fff';
  el.style.fontWeight = '700';
  el.style.opacity = '0';
  el.style.transform = 'translateY(-6px)';
  container.appendChild(el);
  requestAnimationFrame(() => { el.style.transition = 'all 320ms ease'; el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 360);
  }, timeout);
}


function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch {
    // ignore
  }
}

function loadAlerts() {
  try {
    const raw = localStorage.getItem(ALERT_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function saveAlerts(alerts) {
  try {
    localStorage.setItem(ALERT_KEY, JSON.stringify(alerts));
  } catch {
    // ignore
  }
}

function pairKey(from, to) {
  return `${from}→${to}`;
}

// This function will be assigned later, so auto-convert handlers can call it
let runConversion = null;

// Store last successful live rate info
let lastRateInfo = {
  from: null,
  to: null,
  rate: null,      // number, rate for 1 from -> to
  updatedAt: null  // Date object
};

// Cache last gross conversion result (for fee simulator)
let lastConversionGross = {
  amountFrom: null,
  amountTo: null,
  fromCode: null,
  toCode: null
};

async function populate() {
  const amountEl = document.getElementById('amount');
  const fromEl = document.getElementById('from');
  const toEl = document.getElementById('to');
  const resultArea = document.getElementById('resultArea');
  const metaArea = document.getElementById('metaArea');
  const dateEl = document.getElementById('date');
  const errorEl = document.getElementById('errorArea');
  const providerArea = document.getElementById('providerArea');

  const favListEl = document.getElementById('favoritesList');
  const alertRateEl = document.getElementById('alertRate');
  const alertDirectionEl = document.getElementById('alertDirection');
  const alertBannerEl = document.getElementById('alertBanner');
  const alertSummaryEl = document.getElementById('alertSummary');

  const scenarioBodyEl = document.getElementById('scenarioBody');
  const scenarioHeaderEl = document.getElementById('scenarioHeader');

  // Trip helper elements
  const tripBudgetEl = document.getElementById('tripBudget');
  const tripDaysEl = document.getElementById('tripDays');
  const tripCalcBtn = document.getElementById('tripCalcBtn');
  const tripResultEl = document.getElementById('tripResult');

  // Fee simulator elements
  const feeFlatEl = document.getElementById('feeFlat');
  const feePercentEl = document.getElementById('feePercent');
  const feeCalcBtn = document.getElementById('feeCalcBtn');
  const feeResetBtn = document.getElementById('feeResetBtn');
  const feeResultEl = document.getElementById('feeResult');

  resultArea.textContent = 'Loading currencies…';
  metaArea.textContent = '';
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

  // render favorites from storage
  function renderFavorites() {
    const favs = loadFavorites();
    favListEl.innerHTML = '';
    if (!favs.length) {
      favListEl.textContent = 'No favorites yet.';
      return;
    }
    favs.forEach(({ from, to }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'favorite-chip';
      btn.textContent = `${from} → ${to}`;
      btn.addEventListener('click', () => {
        fromEl.value = from;
        toEl.value = to;
        if (runConversion) runConversion();
      });
      favListEl.appendChild(btn);
    });
  }

  renderFavorites();

  // render alert summary text
  function renderAlertSummary() {
    const alerts = loadAlerts();
    const key = pairKey(fromEl.value, toEl.value);
    const a = alerts[key];
    if (!a || !a.rate || isNaN(a.rate)) {
      alertSummaryEl.textContent = 'No alert set for this pair.';
      return;
    }
    alertSummaryEl.textContent =
      `Alert when rate ${a.direction === 'above' ? '≥' : '≤'} ${a.rate} (${fromEl.value}→${toEl.value}).`;
  }

  renderAlertSummary();

  function updateAlertBanner(currentRate) {
    const alerts = loadAlerts();
    const key = pairKey(fromEl.value, toEl.value);
    const a = alerts[key];
    if (!a || !a.rate || isNaN(a.rate) || typeof currentRate !== 'number') {
      alertBannerEl.style.display = 'none';
      alertBannerEl.textContent = '';
      return;
    }
    const target = Number(a.rate);
    let show = false;
    let msg = '';
    if (a.direction === 'below' && currentRate <= target) {
      show = true;
      msg = `Good time to convert: current rate ${currentRate.toFixed(6)} ≤ your target ${target}.`;
    } else if (a.direction === 'above' && currentRate >= target) {
      show = true;
      msg = `Good time to convert: current rate ${currentRate.toFixed(6)} ≥ your target ${target}.`;
    }
    if (show) {
      alertBannerEl.textContent = msg;
      alertBannerEl.style.display = 'block';
    } else {
      alertBannerEl.style.display = 'none';
      alertBannerEl.textContent = '';
    }
  }

  // Scenario planner
  function updateScenarioTable(baseAmount, baseRate, fromCode, toCode) {
    if (!scenarioBodyEl || !scenarioHeaderEl) return;
    if (typeof baseRate !== 'number' || !isFinite(baseRate)) {
      scenarioBodyEl.innerHTML = '';
      scenarioHeaderEl.textContent = 'Scenario planner will appear when a valid live rate is available.';
      return;
    }

    const amount = Number(baseAmount);
    if (!amount || !isFinite(amount)) {
      scenarioBodyEl.innerHTML = '';
      scenarioHeaderEl.textContent = 'Scenario planner will appear when a valid live rate is available.';
      return;
    }

    const deltas = [-0.10, -0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05, 0.10];
    const labels = {
      '-0.10': '-10%',
      '-0.05': '-5%',
      '-0.03': '-3%',
      '-0.02': '-2%',
      '-0.01': '-1%',
      '0': 'Current rate',
      '0.01': '+1%',
      '0.02': '+2%',
      '0.03': '+3%',
      '0.05': '+5%',
      '0.10': '+10%'
    };

    const currentAmountDest = amount * baseRate;
    let rows = '';

    deltas.forEach(d => {
      const newRate = baseRate * (1 + d);
      const newAmount = amount * newRate;
      const diff = newAmount - currentAmountDest;

      let moveClass = '';
      if (d < 0) {
        moveClass = 'scenario-move-loss';
      } else if (d > 0) {
        moveClass = 'scenario-move-gain';
      }

      const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
      const absDiff = Math.abs(diff);

      rows += `
        <tr>
          <td class="${moveClass}">${labels[String(d)]}</td>
          <td>${newRate.toFixed(6)} ${toCode}/${fromCode}</td>
          <td>${newAmount.toFixed(6)} ${toCode}</td>
          <td>${sign}${absDiff.toFixed(6)} ${toCode} vs now</td>
        </tr>
      `;
    });
    scenarioBodyEl.innerHTML = rows;
    scenarioHeaderEl.textContent =
      `If the rate for ${fromCode}→${toCode} moves, your ${amount} ${fromCode} would convert to (compared to the current rate):`;
  }

  // Trip helper calculation
  function calculateTripBudget() {
    if (!tripBudgetEl || !tripDaysEl || !tripResultEl) return;

    const totalBudget = parseFloat(tripBudgetEl.value);
    const days = parseInt(tripDaysEl.value, 10);

    if (!totalBudget || totalBudget <= 0 || !days || days <= 0) {
      tripResultEl.textContent = "Enter a positive trip budget and number of days.";
      return;
    }

    const fromCode = fromEl.value;
    const toCode = toEl.value;

    if (toCode === "ALL") {
      tripResultEl.textContent = "Trip helper works when a single destination currency is selected, not ALL.";
      return;
    }

    if (
      !lastRateInfo.rate ||
      typeof lastRateInfo.rate !== 'number' ||
      lastRateInfo.from !== fromCode ||
      lastRateInfo.to !== toCode
    ) {
      tripResultEl.textContent = "Run a conversion first to get a live rate for this pair.";
      return;
    }

    const rate = lastRateInfo.rate;
    const totalDestination = totalBudget * rate;
    const perDayDestination = totalDestination / days;

    tripResultEl.innerHTML =
      `<span class="trip-result-strong">${totalBudget.toFixed(2)} ${fromCode}</span> over ${days} day(s) is ` +
      `<span class="trip-result-strong">${totalDestination.toFixed(2)} ${toCode}</span> in total, ` +
      `around <span class="trip-result-strong">${perDayDestination.toFixed(2)} ${toCode}</span> per day.`;
  }

  // Fee simulator calculation
  function calculateFees() {
    if (!feeResultEl) return;

    const fromCode = fromEl.value;
    const toCode = toEl.value;

    if (toCode === "ALL") {
      feeResultEl.textContent = "Fee simulator works when a single destination currency is selected, not ALL.";
      return;
    }

    if (
      lastConversionGross.amountFrom == null ||
      lastConversionGross.amountTo == null ||
      lastConversionGross.fromCode !== fromCode ||
      lastConversionGross.toCode !== toCode
    ) {
      feeResultEl.textContent = "Run a conversion first to get a base amount, then apply fees.";
      return;
    }

    const flatFee = parseFloat(feeFlatEl.value || "0");
    const percentFee = parseFloat(feePercentEl.value || "0");

    if ((isNaN(flatFee) || flatFee < 0) || (isNaN(percentFee) || percentFee < 0)) {
      feeResultEl.textContent = "Enter non-negative values for fees.";
      return;
    }

    const grossFrom = lastConversionGross.amountFrom;
    const grossTo = lastConversionGross.amountTo;

    const percentAmount = grossFrom * (percentFee / 100);
    const totalFeeFrom = flatFee + percentAmount;

    if (totalFeeFrom >= grossFrom) {
      feeResultEl.textContent = "Total fees cannot be equal to or exceed the original amount.";
      return;
    }

    const netFrom = grossFrom - totalFeeFrom;

    if (!lastRateInfo.rate || typeof lastRateInfo.rate !== 'number') {
      feeResultEl.textContent = "Live rate missing for this pair. Convert again to use fee simulator.";
      return;
    }

    const rate = lastRateInfo.rate;
    const netTo = netFrom * rate;

    const effectiveRate = netTo / grossFrom;

    feeResultEl.innerHTML =
      `<span class="fee-strong">Before fees:</span> ${grossFrom.toFixed(2)} ${fromCode} → ${grossTo.toFixed(2)} ${toCode}. ` +
      `<br><span class="fee-strong">Fees:</span> ${flatFee.toFixed(2)} ${fromCode} flat + ` +
      `${percentFee.toFixed(2)}% = ${totalFeeFrom.toFixed(2)} ${fromCode} total. ` +
      `<br><span class="fee-strong">After fees:</span> ${netFrom.toFixed(2)} ${fromCode} → ` +
      `${netTo.toFixed(2)} ${toCode}. ` +
      `<br><span class="fee-strong">Effective rate:</span> 1 ${fromCode} = ${effectiveRate.toFixed(6)} ${toCode} (vs raw ${rate.toFixed(6)}).`;
  }

  function resetFees() {
    if (feeFlatEl) feeFlatEl.value = "";
    if (feePercentEl) feePercentEl.value = "";
    if (feeResultEl) {
      feeResultEl.textContent =
        "Run a conversion first, then add your bank or platform fees to simulate the net amount.";
    }
  }

  // Core conversion logic
  runConversion = async () => {
    const from = fromEl.value;
    const to = toEl.value;
    const amount = amountEl.value || '1';
    const date = dateEl.value;

    if (!from || !to) return;

    // loading state
    resultArea.textContent = 'Converting…';
    metaArea.textContent = '';
    errorEl.textContent = '';
    alertBannerEl.style.display = 'none';
    alertBannerEl.textContent = '';
    updateScenarioTable(null, null, from, to);

    lastRateInfo = { from: null, to: null, rate: null, updatedAt: null };
    lastConversionGross = { amountFrom: null, amountTo: null, fromCode: null, toCode: null };
    if (tripResultEl) {
      tripResultEl.textContent = "";
    }
    resetFees();

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      errorEl.textContent = "Please enter a valid, positive amount for conversion.";
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

      // skeleton while loading batch
      resultArea.innerHTML = createBatchSkeleton(from, amount, Math.min(batchCodes.length, 10));
      providerArea.textContent = "Provider: Loading…";
      metaArea.innerHTML = "";

      const promises = batchCodes.map(code => {
        let url = `/api/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(code)}&amount=${encodeURIComponent(amount)}`;
        if (date) url += `&date=${encodeURIComponent(date)}`;
        return fetch(url)
          .then(r => r.json())
          .then(j => {
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
      updateScenarioTable(null, null, from, to);
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
        // insert spans for animated numbers
        resultArea.innerHTML = `
          <div class="result-main">
            <span class="amt-from">${amt} ${fr}</span> = <span class="amt-to" data-target="${Number(result)}">${Number(result).toFixed(6)}</span> ${toCode}
          </div>
          <div class="result-rate">
            Rate: 1 ${fr} = <span class="rate" data-target="${Number(rate)}">${Number(rate).toFixed(6)}</span> ${toCode}
          </div>
        `;

        // small entrance micro-interaction
        const resultBox = document.getElementById('resultBox');
        if (resultBox) {
          resultBox.classList.add('result-animate-in');
          setTimeout(() => resultBox.classList.remove('result-animate-in'), 600);
        }

        // Animated numbers (respect reduced motion)
        function animateNumber(node, from, to, decimals = 6, duration = 650) {
          const preferReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (preferReduced) {
            node.textContent = Number(to).toFixed(decimals);
            return;
          }
          const start = performance.now();
          const s = Number(from);
          const e = Number(to);
          function step(now) {
            const p = Math.min(1, (now - start) / duration);
            const cur = s + (e - s) * (1 - Math.pow(1 - p, 2));
            node.textContent = Number(cur).toFixed(decimals);
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }

        const amtToEl = resultArea.querySelector('.amt-to');
        const rateEl = resultArea.querySelector('.rate');
        if (amtToEl) animateNumber(amtToEl, 0, Number(amtToEl.dataset.target), 6, 700);
        if (rateEl) animateNumber(rateEl, 0, Number(rateEl.dataset.target), 6, 700);

        const now = new Date();
        lastRateInfo = {
          from: fr,
          to: toCode,
          rate: typeof rate === 'number' ? rate : Number(rate),
          updatedAt: now
        };

        lastConversionGross = {
          amountFrom: Number(amt),
          amountTo: typeof result === 'number' ? result : Number(result),
          fromCode: fr,
          toCode: toCode
        };

        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        metaArea.textContent = `Last updated at ${timeStr} (${provider}).`;

        updateAlertBanner(lastRateInfo.rate);
        updateScenarioTable(amt, lastRateInfo.rate, fr, toCode);

        // focus for screen readers and keyboard users
        if (resultArea) {
          resultArea.setAttribute('tabindex', '-1');
          resultArea.focus({ preventScroll: true });
        }
      } else {
        resultArea.innerHTML = `
          <div class="result-main">
            ${amt} ${fr} = ${result} ${toCode}
          </div>`;
        metaArea.textContent = '';
        updateScenarioTable(null, null, fr, toCode);
      }
      providerArea.textContent = "Provider: " + provider;
    } catch (err) {
      resultArea.textContent = 'Error performing conversion.';
      metaArea.textContent = String(err);
      providerArea.textContent = "";
      updateScenarioTable(null, null, from, to);
    }
  };

  // Button click
  document.getElementById('convertBtn').addEventListener('click', () => {
    if (runConversion) runConversion();
  });

  // Swap button
  document.getElementById('swapBtn').addEventListener('click', () => {
    const tmp = fromEl.value;
    fromEl.value = toEl.value !== "ALL" ? toEl.value : tmp;
    toEl.value = tmp;
    if (runConversion) runConversion();
    renderAlertSummary();
  });

  // Add to favorites
  document.getElementById('addFavoriteBtn').addEventListener('click', () => {
    const from = fromEl.value;
    const to = toEl.value;
    if (!from || !to || to === 'ALL') return;
    const favs = loadFavorites();
    const exists = favs.some(f => f.from === from && f.to === to);
    if (!exists) {
      favs.unshift({ from, to });
      if (favs.length > 5) favs.pop();
      saveFavorites(favs);
      renderFavorites();
      showToast('Added to favorites', 'success');
    } else {
      showToast('Already in favorites', 'info');
    }
  });

  // Save alert
  document.getElementById('saveAlertBtn').addEventListener('click', () => {
    const from = fromEl.value;
    const to = toEl.value;
    if (!from || !to || to === 'ALL') return;
    const rateVal = parseFloat(alertRateEl.value);
    if (!rateVal || rateVal <= 0) return;
    const dir = alertDirectionEl.value === 'above' ? 'above' : 'below';
    const alerts = loadAlerts();
    alerts[pairKey(from, to)] = { rate: rateVal, direction: dir };
    saveAlerts(alerts);
    renderAlertSummary();
    showToast('Alert saved', 'success');
  });

  // Auto-convert: debounce
  const debouncedAutoConvert = debounce(() => {
    if (runConversion) runConversion();
  }, 600);

  // Pair changes
  fromEl.addEventListener('change', () => {
    debouncedAutoConvert();
    renderAlertSummary();
  });
  toEl.addEventListener('change', () => {
    debouncedAutoConvert();
    renderAlertSummary();
  });

  // Amount & date changes
  amountEl.addEventListener('input', debouncedAutoConvert);
  dateEl.addEventListener('change', debouncedAutoConvert);

  // Trip helper
  if (tripCalcBtn) {
    tripCalcBtn.addEventListener('click', calculateTripBudget);
  }

  // Fee simulator buttons
  if (feeCalcBtn) {
    feeCalcBtn.addEventListener('click', calculateFees);
  }
  if (feeResetBtn) {
    feeResetBtn.addEventListener('click', resetFees);
  }

  // Keyboard: Enter on inputs triggers convert
  ['amount', 'from', 'to', 'date'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keypress', e => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (runConversion) runConversion();
      }
    });
  });

  // Global keyboard shortcuts: Ctrl+Enter -> convert, 's' -> swap (when not typing in input)
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName.toLowerCase();
    const isInputLike = tag === 'input' || tag === 'select' || tag === 'textarea';

    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (runConversion) runConversion();
    }

    if (!isInputLike && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      const swapBtn = document.getElementById('swapBtn');
      if (swapBtn) swapBtn.click();
    }
  });
}

// Initial populate
document.addEventListener('DOMContentLoaded', populate);

// ----- (7) Financial Tips -----
const tips = [
  "Diversify your savings across different strong currencies.",
  "Check for hidden conversion fees when exchanging money.",
  "Plan international payments when the currency is strongest.",
  "Monitor currency trends before large conversions.",
  "Small daily fluctuations can add up for big transactions—watch volatility.",
  "Set exchange rate alerts if you need a specific rate soon.",
  "Understand how inflation affects currency value long-term.",
  "Favor online transfers for lower fees, but compare rates first."
];
let tipNum = 0;
function showTip() {
  document.getElementById('financialTip').textContent = tips[tipNum];
}
document.getElementById('tipBlock').addEventListener('click', () => {
  tipNum = (tipNum + 1) % tips.length;
  showTip();
});
document.addEventListener('DOMContentLoaded', showTip);

// ----- (8) TradingView indices ticker -----
document.addEventListener('DOMContentLoaded', function () {
  const tvDiv = document.getElementById('tradingview-widget');
  if (!tvDiv) return;
  tvDiv.innerHTML = `<iframe src="https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#%7B%22symbols%22%3A%5B%7B%22proName%22%3A%22FOREXCOM%3AEURUSD%22%2C%22title%22%3A%22EUR%2FUSD%22%7D%2C%7B%22proName%22%3A%22OANDA%3AUSDINR%22%2C%22title%22%3A%22USD%2FINR%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDEUR%22%2C%22title%22%3A%22USD%2FEUR%22%7D%2C%7B%22proName%22%3A%22NASDAQ%3ANDS%22%2C%22title%22%3A%22NASDAQ%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AGBPUSD%22%2C%22title%22%3A%22GBP%2FUSD%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDJPY%22%2C%22title%22%3A%22USD%2FJPY%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDCAD%22%2C%22title%22%3A%22USD%2FCAD%22%7D%2C%7B%22proName%22%3A%22BITSTAMP%3ABTCUSD%22%2C%22title%22%3A%22BTC%2FUSD%22%7D%5D%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22displayMode%22%3A%22adaptive%22%2C%22locale%22%3A%22en%22%7D"
    width="100%" height="48" style="border:none;overflow:hidden;" allowtransparency="true"></iframe>`;
});
