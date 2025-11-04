# Simple Currency Converter (Flask web app)

A minimal, beginner-friendly Flask web application for real-time and historical currency conversion, using robust public exchange-rate providers.

---

## Features

- Real-time and historical conversion (any major currency, any date available)
- Swap and instantly reverse currency direction
- Provider fallback (frankfurter.app and exchangerate.host)
- Modern, responsive UI (side-by-side result, attractive headings)
- Docker & cloud ready (Render, Railway, Heroku support)
- Attribution for data sources always shown

---

## Folder & File Overview

| File/Folder             | Purpose                        |
|-------------------------|-------------------------------|
| `app.py`                | Flask backend and API logic    |
| `templates/index.html`  | Frontend HTML & styles         |
| `static/main.js`        | Frontend JS (conversions/UI)   |
| `requirements.txt`      | Python dependencies            |
| `Dockerfile`, `Procfile`| Deployment config              |
| `.gitignore`            | Exclusions for repo/venv/tmp   |

---

## Quick Local Setup

1. **Clone repository:**
    ```
    git clone https://github.com/SomnathSaha67/Currency-Converter.git
    cd Currency-Converter
    ```
2. **Create & activate venv:**
    - macOS/Linux:
      ```
      python3 -m venv venv
      source venv/bin/activate
      ```
    - Windows:
      ```
      python -m venv venv
      .\venv\Scripts\Activate.ps1
      ```
3. **Install dependencies:**
    ```
    pip install -r requirements.txt
    ```
4. **Run the app:**
    ```
    python app.py
    ```
    Visit: [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## API Endpoints

- **GET `/api/symbols`**
  - Returns all supported currencies, and provider name.
- **GET `/api/convert?from=USD&to=EUR&amount=100[&date=YYYY-MM-DD]`**
  - Returns conversion (current or by date).

**JSON Example:**
{
"success": true,
"provider": "frankfurter.app",
"data": {
"query": { "from": "USD", "to": "INR", "amount": 100 },
"info": { "rate": 88.71 },
"result": 8871.00
}
}

- **List currencies:**
curl "http://127.0.0.1:5000/api/symbols"

- **Convert:**
curl "http://127.0.0.1:5000/api/convert?from=USD&to=EUR&amount=100"


---

## Deploy with Docker

Build:
docker build -t currency-converter .
Run:
docker run -p 5000:5000 currency-converter


---

## Troubleshooting

- If dependencies break: `pip install -r requirements.txt`
- Blank frontend? Check DevTools and try curl to backend.
- API provider error? Try again later or different network.

---

## Attribution

- Rates/data: [frankfurter.app](https://www.frankfurter.app/) and [exchangerate.host](https://exchangerate.host)

---

## Next Steps & Future Ideas

- Add exchange rate chart (Chart.js/Plotly, etc.)
- User alert if rate meets a threshold
- Save favorites/conversion history
- Full mobile/PWA support
- UI/branding upgrades and testing

---


**PRs and suggestions welcome!**
