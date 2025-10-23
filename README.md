```markdown
# Simple Currency Converter Web App

This is a minimal Flask web app that converts currencies in real time using public providers.

Features
- Uses frankfurter.app as primary provider and exchangerate.host as fallback.
- Serves a simple UI that lists worldwide currencies and converts amounts.
- Caches currency list in memory for one hour to reduce API calls.

Quick start (local)
1. Install Python 3.8+ and create a virtual environment (recommended):
   python -m venv venv
   source venv/bin/activate   # macOS / Linux
   .\venv\Scripts\Activate.ps1  # Windows PowerShell

2. Install dependencies:
   pip install -r requirements.txt

3. Run the app:
   export FLASK_APP=app.py
   export FLASK_ENV=development   # optional for auto-reload
   flask run

   Or run directly:
   python app.py

4. Open http://127.0.0.1:5000 in your browser.

Project layout
- app.py                -> Flask backend and API endpoints
- templates/index.html  -> Frontend HTML
- static/main.js        -> Frontend JavaScript
- requirements.txt
- README.md

Notes & next steps
- This implementation uses in-memory cache for symbols; for production use a persistent cache (Redis) or store in a DB.
- To scale, add server-side caching for conversion results and rate limiting to protect providers.
- For production deployment consider Docker and services like Railway, Render, or Heroku.
- If you want, I can:
  - provide a Dockerfile and deployment instructions,
  - add unit tests for the conversion functions,
  - add user-facing features (history, favorites, CSV export),
  - or switch the frontend to React/Vue for richer UX.
```