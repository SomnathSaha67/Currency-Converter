***

# Currency Converter

A minimal, modern web currency converter built with Flask and vanilla JavaScript. Convert currencies instantly, with real-time and historical rates, now presented as a full-screen, responsive app with polished UI and micro-interactions for a better user experience.

New feature highlights:
- Interactive historical charts (mock) replaced by a high-impact "Market Movers" module with mini-sparklines. 📈
- Live rate fetch: a "Fetch Live" control was added to update top movers from the conversion API (`/api/convert`) so movers can show up-to-date rates (useful for demoing USD/INR jumping to real values). 🔁
- News & Insights panel (mocked feed) with summarized headlines and tags—cached for offline-friendly demos. 📰
- Mocked datasets and local caching to ensure a flawless, fast demo experience.
- New landing design: updated hero, brand 'SwapStream' and visual assets; converter lives as an embedded demo under the hero.

Next steps: integrate a live news API and wire historical rates to a real data source or SSE feed for production-ready realtime charts.


***

## Features

- **Instant conversion** for all major world currencies  
- **Real-time and historical rates** (choose any date)  
- **No-scroll, single-screen layout** for maximum usability  
- **Modern responsive UI:**  
  - Centered bold title and tagline  
  - Clean, high-visibility input row and result display  
  - Swap currencies instantly  
  - Shows data provider for transparency  
- **100% browser-based UI**—no external UI libraries, just CSS  
- **Provider fallback** (Frankfurter & exchangerate.host) for reliability

***

## File Structure

| File/Folder             | Purpose                                |
|-------------------------|----------------------------------------|
| `app.py`                | Flask backend and API logic            |
| `templates/index.html`  | HTML UI (no dashboards, just converter)|
| `static/style.css`      | Custom modern styling, high contrast   |
| `static/main.js`        | UI interactivity and conversion logic  |
| `requirements.txt`      | Python package dependencies            |    |

***

## Quick Setup

### 1. Clone the Repository
```sh
git clone https://github.com/your-username/currency-converter.git
cd currency-converter
```

### 2. Create and Activate a Virtual Environment
- **macOS/Linux:**
  ```sh
  python3 -m venv venv
  source venv/bin/activate
  ```
- **Windows:**
  ```sh
  python -m venv venv
  .\venv\Scripts\activate
  ```

### 3. Install Dependencies
```sh
pip install -r requirements.txt
```

### 4. Run the App
```sh
python app.py
```
Visit [http://127.0.0.1:5000](http://127.0.0.1:5000/) in your browser.

***

## API Endpoints

- **GET `/api/symbols`** – List all supported currencies, including description and data provider.
- **GET `/api/convert?from=USD&to=EUR&amount=100[&date=YYYY-MM-DD]`** – Convert between currencies, with optional historical date.

***


***

## Attributions

Rates/data:  
- [frankfurter.app](https://www.frankfurter.app/)  
- [exchangerate.host](https://exchangerate.host/)

***

## Suggestions & Next Steps

- Add dark/light mode or custom accent colors for your brand
- Optionally expand to show trending pairs or favorites
- Mobile-first refinements always welcome

***

**Built by Somnath Saha | Minimal, visible, and lightning-fast.**