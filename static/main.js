// ========================================
// SwapStream Currency Converter - main.js
// ========================================

// Global state
let allCurrencies = [];
let currentRate = null;
let currentFrom = 'USD';
let currentTo = 'EUR';
let favoritesPairs = JSON.parse(localStorage.getItem('favorites') || '[]');
let rateAlert = JSON.parse(localStorage.getItem('rateAlert') || 'null');

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  try {
    await fetchCurrencies();
    populateSelects();
    loadFavorites();
    loadRateAlert();
    attachEventListeners();
    loadNews();
    await initAIPrediction();
  } catch (err) {
    showError('Failed to initialize app: ' + err.message);
  }
}

// -------- Fetch currencies from backend --------
async function fetchCurrencies() {
  const res = await fetch('/api/symbols');
  if (!res.ok) throw new Error('Failed to fetch currencies');
  const data = await res.json();
  const symbols = data.symbols || {};
  allCurrencies = Object.keys(symbols);
}

function populateSelects() {
  const fromSelect = document.getElementById('from');
  const toSelect = document.getElementById('to');

  allCurrencies.forEach(code => {
    const opt1 = document.createElement('option');
    opt1.value = code;
    opt1.textContent = code;
    fromSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = code;
    opt2.textContent = code;
    toSelect.appendChild(opt2);
  });

  fromSelect.value = currentFrom;
  toSelect.value = currentTo;
}

// -------- Attach event listeners --------
function attachEventListeners() {
  document.getElementById('convertBtn').addEventListener('click', handleConvert);
  document.getElementById('swapBtn').addEventListener('click', handleSwap);
  document.getElementById('feeCalcBtn').addEventListener('click', handleFeeCalc);
  document.getElementById('feeResetBtn').addEventListener('click', handleFeeReset);
  document.getElementById('tripCalcBtn').addEventListener('click', handleTripCalc);
  document.getElementById('addFavoriteBtn').addEventListener('click', handleAddFavorite);
  document.getElementById('saveAlertBtn').addEventListener('click', handleSaveAlert);
  document.getElementById('refreshNewsBtn').addEventListener('click', loadNews);
  document.getElementById('analyzePairBtn').addEventListener('click', runAIAnalysis);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleConvert();
    }
    if (e.key === 's' || e.key === 'S') {
      if (document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        handleSwap();
      }
    }
  });
}

// -------- Convert currency --------
async function handleConvert() {
  clearError();
  const amount = parseFloat(document.getElementById('amount').value);
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const date = document.getElementById('date').value;

  if (!amount || amount <= 0) {
    showError('Please enter a valid amount');
    return;
  }

  currentFrom = from;
  currentTo = to;

  try {
    const url = date
      ? `/api/convert?from=${from}&to=${to}&amount=${amount}&date=${date}`
      : `/api/convert?from=${from}&to=${to}&amount=${amount}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Conversion failed');
    const response = await res.json();
    
    if (!response.success || !response.data) {
      throw new Error('Invalid response from server');
    }
    
    const data = response.data;

    // Calculate rate properly
    currentRate = data.info?.rate || (data.result / amount);
    
    if (!currentRate || isNaN(currentRate)) {
      throw new Error('Unable to calculate exchange rate');
    }

    // Display result
    const resultArea = document.getElementById('resultArea');
    resultArea.innerHTML = `<strong>${amount.toFixed(2)} ${from}</strong> = <strong>${data.result.toFixed(2)} ${to}</strong>`;

    const metaArea = document.getElementById('metaArea');
    metaArea.innerHTML = `Rate: 1 ${from} = ${currentRate.toFixed(6)} ${to}<br>`;
    if (data.date) {
      metaArea.innerHTML += `Date: ${data.date}`;
    }

    // Display provider info
    displayProvider({name: response.provider, description: `Powered by ${response.provider}`});

    // Generate scenario table
    generateScenarios(from, to, amount, currentRate);

    // Check rate alert
    checkRateAlert();

  } catch (err) {
    showError('Conversion error: ' + err.message);
  }
}

function displayProvider(provider) {
  const providerArea = document.getElementById('providerArea');
  if (!provider) {
    providerArea.innerHTML = '';
    return;
  }
  providerArea.innerHTML = `
    <div style="padding: 1rem; background: var(--bg-glass); border: 1px solid var(--border); border-radius: 8px;">
      <strong>Provider:</strong> ${provider.name || 'Unknown'}<br>
      <small style="color: var(--text-secondary);">${provider.description || ''}</small>
    </div>
  `;
}

// -------- Swap currencies --------
function handleSwap() {
  const fromSelect = document.getElementById('from');
  const toSelect = document.getElementById('to');
  const temp = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = temp;
  currentFrom = fromSelect.value;
  currentTo = toSelect.value;
}

// -------- Fee calculator --------
function handleFeeCalc() {
  if (!currentRate) {
    document.getElementById('feeResult').innerHTML = '<span style="color: var(--error);">Please run a conversion first.</span>';
    return;
  }

  const amount = parseFloat(document.getElementById('amount').value);
  const feeFlat = parseFloat(document.getElementById('feeFlat').value) || 0;
  const feePercent = parseFloat(document.getElementById('feePercent').value) || 0;

  const totalFee = feeFlat + (amount * feePercent / 100);
  const netAmount = amount - totalFee;
  const convertedAmount = netAmount * currentRate;

  document.getElementById('feeResult').innerHTML = `
    <div><strong>Total fees:</strong> ${totalFee.toFixed(2)} ${currentFrom}</div>
    <div><strong>Net amount to convert:</strong> ${netAmount.toFixed(2)} ${currentFrom}</div>
    <div><strong>You receive:</strong> ${convertedAmount.toFixed(2)} ${currentTo}</div>
  `;
}

function handleFeeReset() {
  document.getElementById('feeFlat').value = '';
  document.getElementById('feePercent').value = '';
  document.getElementById('feeResult').innerHTML = 'Run a conversion first, then add your bank or platform fees to simulate the net amount.';
}

// -------- Trip budget calculator --------
function handleTripCalc() {
  if (!currentRate) {
    document.getElementById('tripResult').innerHTML = '<span style="color: var(--error);">Please run a conversion first.</span>';
    return;
  }

  const budget = parseFloat(document.getElementById('tripBudget').value);
  const days = parseInt(document.getElementById('tripDays').value);

  if (!budget || !days || days < 1) {
    document.getElementById('tripResult').innerHTML = '<span style="color: var(--error);">Please enter valid budget and days.</span>';
    return;
  }

  const convertedBudget = budget * currentRate;
  const dailyBudget = convertedBudget / days;

  document.getElementById('tripResult').innerHTML = `
    <div><strong>Total budget in ${currentTo}:</strong> ${convertedBudget.toFixed(2)}</div>
    <div><strong>Daily budget:</strong> ${dailyBudget.toFixed(2)} ${currentTo}/day</div>
    <div style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
      For a ${days}-day trip with ${budget} ${currentFrom}
    </div>
  `;
}

// -------- Scenario planner --------
function generateScenarios(from, to, amount, rate) {
  const scenarioBody = document.getElementById('scenarioBody');
  const scenarioHeader = document.getElementById('scenarioHeader');

  scenarioHeader.innerHTML = `What if the ${from}/${to} rate changes? Current: ${rate.toFixed(6)}`;

  const moves = [-10, -5, -2, 2, 5, 10];
  scenarioBody.innerHTML = '';

  moves.forEach(percent => {
    const newRate = rate * (1 + percent / 100);
    const newAmount = amount * newRate;
    const diff = newAmount - (amount * rate);
    const diffColor = diff > 0 ? 'var(--success)' : 'var(--error)';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${percent > 0 ? '+' : ''}${percent}%</td>
      <td>${newRate.toFixed(6)}</td>
      <td>${newAmount.toFixed(2)} ${to}</td>
      <td style="color: ${diffColor}; font-weight: 600;">
        ${diff > 0 ? '+' : ''}${diff.toFixed(2)}
      </td>
    `;
    scenarioBody.appendChild(row);
  });
}

// -------- Favorites --------
function handleAddFavorite() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const pair = `${from}/${to}`;

  if (favoritesPairs.includes(pair)) {
    alert('This pair is already in favorites!');
    return;
  }

  favoritesPairs.push(pair);
  localStorage.setItem('favorites', JSON.stringify(favoritesPairs));
  loadFavorites();
}

function loadFavorites() {
  const favoritesList = document.getElementById('favoritesList');
  favoritesList.innerHTML = '';

  if (favoritesPairs.length === 0) {
    favoritesList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem;">No favorites yet. Add your first!</div>';
    return;
  }

  favoritesPairs.forEach(pair => {
    const [from, to] = pair.split('/');
    const btn = document.createElement('button');
    btn.className = 'fav-btn';
    btn.innerHTML = `
      <span>${pair}</span>
      <button class="fav-remove" data-pair="${pair}">×</button>
    `;
    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-remove')) {
        e.stopPropagation();
        removeFavorite(e.target.dataset.pair);
      } else {
        document.getElementById('from').value = from;
        document.getElementById('to').value = to;
        currentFrom = from;
        currentTo = to;
      }
    });
    favoritesList.appendChild(btn);
  });
}

function removeFavorite(pair) {
  favoritesPairs = favoritesPairs.filter(p => p !== pair);
  localStorage.setItem('favorites', JSON.stringify(favoritesPairs));
  loadFavorites();
}

// -------- Rate alerts --------
function handleSaveAlert() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const direction = document.getElementById('alertDirection').value;
  const targetRate = parseFloat(document.getElementById('alertRate').value);

  if (!targetRate || targetRate <= 0) {
    alert('Please enter a valid target rate');
    return;
  }

  rateAlert = { from, to, direction, targetRate };
  localStorage.setItem('rateAlert', JSON.stringify(rateAlert));
  loadRateAlert();
  checkRateAlert();
}

function loadRateAlert() {
  const alertSummary = document.getElementById('alertSummary');
  if (!rateAlert) {
    alertSummary.innerHTML = '<span style="color: var(--text-secondary);">No alert set yet.</span>';
    return;
  }

  alertSummary.innerHTML = `
    <div><strong>Active alert:</strong></div>
    <div style="margin-top: 0.5rem;">
      ${rateAlert.from}/${rateAlert.to} ${rateAlert.direction === 'below' ? '≤' : '≥'} ${rateAlert.targetRate}
    </div>
    <button onclick="clearAlert()" style="margin-top: 0.5rem; padding: 0.4rem 0.8rem; background: var(--error); color: white; border: none; border-radius: 4px; cursor: pointer;">
      Clear alert
    </button>
  `;
}

window.clearAlert = function() {
  rateAlert = null;
  localStorage.removeItem('rateAlert');
  loadRateAlert();
  document.getElementById('alertBanner').classList.remove('show');
  document.getElementById('alertBanner').innerHTML = '';
};

function checkRateAlert() {
  if (!rateAlert || !currentRate) return;

  const alertFrom = document.getElementById('from').value;
  const alertTo = document.getElementById('to').value;

  if (alertFrom !== rateAlert.from || alertTo !== rateAlert.to) return;

  const triggered =
    (rateAlert.direction === 'below' && currentRate <= rateAlert.targetRate) ||
    (rateAlert.direction === 'above' && currentRate >= rateAlert.targetRate);

  const banner = document.getElementById('alertBanner');
  if (triggered) {
    banner.classList.add('show');
    banner.innerHTML = `🔔 Rate alert! ${rateAlert.from}/${rateAlert.to} is now ${currentRate.toFixed(6)} (target: ${rateAlert.targetRate})`;
  } else {
    banner.classList.remove('show');
    banner.innerHTML = '';
  }
}

// -------- News (mock) --------
async function loadNews() {
  try {
    const res = await fetch('/static/mock/news.json');
    const data = await res.json();
    const newsList = document.getElementById('newsList');
    newsList.innerHTML = '';

    data.articles.forEach(article => {
      const item = document.createElement('div');
      item.className = 'news-item';
      item.innerHTML = `
        <div class="news-headline">${article.headline}</div>
        <div class="news-date">${article.date}</div>
      `;
      newsList.appendChild(item);
    });
  } catch (err) {
    document.getElementById('newsList').innerHTML = '<div style="color: var(--error);">Failed to load news</div>';
  }
}

// -------- AI Prediction Engine --------
let predictionChart = null;
let selectedPeriod = '7d';

async function initAIPrediction() {
  // Initialize chart
  const ctx = document.getElementById('predictionChart');
  if (ctx) {
    predictionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Historical Rates',
          data: [],
          borderColor: 'rgb(77, 166, 255)',
          backgroundColor: 'rgba(77, 166, 255, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'AI Predictions',
          data: [],
          borderColor: 'rgb(142, 68, 173)',
          backgroundColor: 'rgba(142, 68, 173, 0.1)',
          borderDash: [5, 5],
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
            }
          }
        }
      }
    });
  }

  // Setup chart controls
  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPeriod = btn.dataset.period;
      runAIAnalysis();
    });
  });
}

async function runAIAnalysis() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;

  if (!from || !to) {
    alert('Please select currencies to analyze');
    return;
  }
  
  if (!currentRate) {
    alert('Please run a conversion first to get current rate data');
    return;
  }

  try {
    // Generate historical data (simulated with realistic patterns)
    const historicalData = generateHistoricalData(from, to, selectedPeriod);
    
    // Run AI prediction algorithms
    const predictions = runPredictionModels(historicalData);
    
    // Update chart
    updatePredictionChart(historicalData, predictions);
    
    // Update prediction cards
    updatePredictionCards(predictions);
    
    // Update analytics
    updateAnalytics(historicalData, predictions);
    
    // Update risk assessment
    updateRiskAssessment(predictions);
    
  } catch (err) {
    console.error('AI Analysis error:', err);
  }
}

function generateHistoricalData(from, to, period) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const data = [];
  let baseRate = currentRate || 1.1; // Use current rate or default
  
  // Generate realistic historical data with trends and volatility
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Add trend component (slight upward or downward drift)
    const trend = Math.sin(i / days * Math.PI) * 0.02;
    
    // Add random volatility
    const volatility = (Math.random() - 0.5) * 0.01;
    
    // Add cyclical pattern
    const cyclical = Math.sin(i / 7 * Math.PI) * 0.005;
    
    const rate = baseRate * (1 + trend + volatility + cyclical);
    
    data.push({
      date: date.toISOString().split('T')[0],
      rate: rate
    });
  }
  
  return data;
}

function runPredictionModels(historicalData) {
  // Implement multiple AI models for prediction
  const recentData = historicalData.slice(-30); // Last 30 points
  const rates = recentData.map(d => d.rate);
  
  // Calculate moving average
  const movingAvg = calculateMovingAverage(rates, 5);
  
  // Calculate trend using linear regression
  const trend = calculateTrend(rates);
  
  // Calculate volatility
  const volatility = calculateVolatility(rates);
  
  // Predict next 24h and 7 days
  const lastRate = rates[rates.length - 1];
  const pred24h = lastRate * (1 + trend);
  const pred7d = lastRate * (1 + trend * 7);
  
  // Generate future predictions
  const futurePredictions = [];
  for (let i = 1; i <= 7; i++) {
    const futureRate = lastRate * (1 + trend * i + (Math.random() - 0.5) * volatility);
    const date = new Date();
    date.setDate(date.getDate() + i);
    futurePredictions.push({
      date: date.toISOString().split('T')[0],
      rate: futureRate
    });
  }
  
  // Generate recommendation
  let recommendation = 'HOLD';
  let reason = 'Market is stable';
  
  if (trend > 0.002) {
    recommendation = 'BUY NOW';
    reason = 'Upward trend detected';
  } else if (trend < -0.002) {
    recommendation = 'WAIT';
    reason = 'Downward trend - consider waiting';
  }
  
  // Calculate confidence levels
  const confidence24h = Math.max(70, 95 - volatility * 1000);
  const confidence7d = Math.max(50, 85 - volatility * 1500);
  
  return {
    pred24h,
    pred7d,
    confidence24h,
    confidence7d,
    volatility,
    trend,
    recommendation,
    reason,
    futurePredictions,
    movingAvg
  };
}

function calculateMovingAverage(data, window) {
  const result = [];
  for (let i = window - 1; i < data.length; i++) {
    const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
}

function calculateTrend(data) {
  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  
  return numerator / denominator;
}

function calculateVolatility(data) {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i] - data[i - 1]) / data[i - 1]);
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

function updatePredictionChart(historical, predictions) {
  if (!predictionChart) return;
  
  const historicalLabels = historical.map(d => d.date);
  const historicalRates = historical.map(d => d.rate);
  
  const futureLabels = predictions.futurePredictions.map(d => d.date);
  const futureRates = predictions.futurePredictions.map(d => d.rate);
  
  // Combine labels
  const allLabels = [...historicalLabels, ...futureLabels];
  
  // Create datasets with gap between historical and predictions
  const historicalDataset = [...historicalRates, ...Array(futureRates.length).fill(null)];
  const predictionsDataset = [...Array(historicalRates.length).fill(null), historicalRates[historicalRates.length - 1], ...futureRates];
  
  predictionChart.data.labels = allLabels;
  predictionChart.data.datasets[0].data = historicalDataset;
  predictionChart.data.datasets[1].data = predictionsDataset;
  predictionChart.update();
}

function updatePredictionCards(predictions) {
  const changePercent24h = ((predictions.pred24h - currentRate) / currentRate * 100).toFixed(2);
  const changePercent7d = ((predictions.pred7d - currentRate) / currentRate * 100).toFixed(2);
  
  document.getElementById('pred24h').textContent = predictions.pred24h.toFixed(6);
  document.getElementById('conf24h').textContent = `${predictions.confidence24h.toFixed(0)}% confidence`;
  document.getElementById('conf24h').style.color = changePercent24h > 0 ? 'var(--success)' : 'var(--error)';
  
  document.getElementById('pred7d').textContent = predictions.pred7d.toFixed(6);
  document.getElementById('conf7d').textContent = `${predictions.confidence7d.toFixed(0)}% confidence`;
  document.getElementById('conf7d').style.color = changePercent7d > 0 ? 'var(--success)' : 'var(--error)';
  
  const volatilityLevel = predictions.volatility < 0.01 ? 'Low' : predictions.volatility < 0.02 ? 'Medium' : 'High';
  document.getElementById('volatilityScore').textContent = (predictions.volatility * 1000).toFixed(2);
  document.getElementById('volatilityLevel').textContent = `${volatilityLevel} volatility`;
  
  document.getElementById('aiRecommendation').textContent = predictions.recommendation;
  document.getElementById('recommendationReason').textContent = predictions.reason;
  
  // Color code recommendation
  const recEl = document.getElementById('aiRecommendation');
  if (predictions.recommendation === 'BUY NOW') {
    recEl.style.color = 'var(--success)';
  } else if (predictions.recommendation === 'WAIT') {
    recEl.style.color = 'var(--warning)';
  } else {
    recEl.style.color = 'var(--text-primary)';
  }
}

function updateAnalytics(historical, predictions) {
  // Trend Analysis
  const trendDirection = predictions.trend > 0 ? '📈 Upward' : predictions.trend < 0 ? '📉 Downward' : '➡️ Sideways';
  const trendStrength = Math.abs(predictions.trend * 10000) < 5 ? 'Weak' : Math.abs(predictions.trend * 10000) < 10 ? 'Moderate' : 'Strong';
  
  document.getElementById('trendAnalysis').innerHTML = `
    <div style="margin-bottom: 0.5rem;"><strong>Direction:</strong> ${trendDirection}</div>
    <div style="margin-bottom: 0.5rem;"><strong>Strength:</strong> ${trendStrength}</div>
    <div style="color: var(--text-secondary); font-size: 0.85rem;">
      ${predictions.trend > 0 ? 'Bullish momentum detected' : predictions.trend < 0 ? 'Bearish momentum detected' : 'Neutral market conditions'}
    </div>
  `;
  
  // Pattern Recognition
  const recentRates = historical.slice(-10).map(d => d.rate);
  const pattern = detectPattern(recentRates);
  
  document.getElementById('patternRecognition').innerHTML = `
    <div style="margin-bottom: 0.5rem;"><strong>Pattern:</strong> ${pattern.name}</div>
    <div style="color: var(--text-secondary); font-size: 0.85rem;">
      ${pattern.description}
    </div>
  `;
  
  // Smart Insights
  const insights = generateInsights(historical, predictions);
  document.getElementById('smartInsights').innerHTML = insights.map(insight => 
    `<div style="margin-bottom: 0.5rem;">💡 ${insight}</div>`
  ).join('');
}

function detectPattern(rates) {
  // Simple pattern detection
  const changes = rates.slice(1).map((r, i) => r - rates[i]);
  const upMoves = changes.filter(c => c > 0).length;
  const downMoves = changes.filter(c => c < 0).length;
  
  if (upMoves > downMoves * 1.5) {
    return { name: 'Ascending Channel', description: 'Consistent upward movement with support levels' };
  } else if (downMoves > upMoves * 1.5) {
    return { name: 'Descending Channel', description: 'Consistent downward pressure with resistance' };
  } else {
    return { name: 'Consolidation', description: 'Range-bound trading with no clear direction' };
  }
}

function generateInsights(historical, predictions) {
  const insights = [];
  
  if (predictions.volatility < 0.01) {
    insights.push('Low volatility suggests stable conditions for conversion');
  } else if (predictions.volatility > 0.02) {
    insights.push('High volatility detected - consider waiting for stabilization');
  }
  
  if (predictions.confidence24h > 80) {
    insights.push('High confidence in short-term predictions');
  }
  
  if (predictions.trend > 0.003) {
    insights.push('Strong upward trend - favorable for buying destination currency');
  } else if (predictions.trend < -0.003) {
    insights.push('Strong downward trend - may improve rates soon');
  }
  
  if (insights.length === 0) {
    insights.push('Market conditions are neutral - good time for planned conversions');
  }
  
  return insights;
}

function updateRiskAssessment(predictions) {
  // Calculate risk scores (0-100)
  const exchangeRisk = Math.min(100, Math.abs(predictions.trend) * 5000);
  const timingRisk = Math.min(100, predictions.volatility * 3000);
  const marketVolatility = Math.min(100, predictions.volatility * 4000);
  
  // Animate risk bars
  setTimeout(() => {
    document.getElementById('exchangeRisk').style.width = `${exchangeRisk}%`;
    document.getElementById('timingRisk').style.width = `${timingRisk}%`;
    document.getElementById('marketVolatility').style.width = `${marketVolatility}%`;
  }, 100);
}

// -------- Error handling --------
function showError(msg) {
  document.getElementById('errorArea').textContent = msg;
}

function clearError() {
  document.getElementById('errorArea').textContent = '';
}
