# Simple Currency Converter (Flask web app)

A minimal, beginner-friendly Flask web application that converts currencies in real time using public exchange-rate providers.

This project provides:
- A small Flask backend exposing:
  - `GET /api/symbols` — returns the list of supported currencies and a provider name.
  - `GET /api/convert?from=USD&to=EUR&amount=100[&date=YYYY-MM-DD]` — converts an amount using real-time or historical rates.
- A lightweight frontend (templates/index.html + static/main.js) that lets users pick currencies, enter an amount and see the converted result.
- Provider resilience: the app uses frankfurter.app as the primary provider and exchangerate.host as a fallback.
- Simple in-memory caching of currency symbols (one-hour TTL) to reduce external API calls.

Table of contents
- Requirements
- Quick local setup (terminal)
- Running locally (detailed)
- Example API calls
- Docker (run in container)
- Deploying (short notes)
- Troubleshooting & Tips
- Files in this repo
- License

Requirements
- Python 3.8+
- pip
- (Optional) Docker if you want to run in a container

Quick local setup (terminal — copy/paste)
1. Clone the repo (if you haven't already):
   git clone https://github.com/SomnathSaha67/Currency-Converter.git
   cd Currency-Converter

2. Create and activate a virtual environment (recommended):
   - macOS / Linux:
     python3 -m venv venv
     source venv/bin/activate
   - Windows PowerShell:
     python -m venv venv
     .\venv\Scripts\Activate.ps1

3. Install dependencies:
   pip install -r requirements.txt

4. Run the app:
   python app.py

5. Open the app in your browser:
   http://127.0.0.1:5000

Detailed run & test instructions

Activate virtual environment (if not already)
- macOS / Linux:
  source venv/bin/activate
- Windows PowerShell:
  .\venv\Scripts\Activate.ps1

Install dependencies
- pip install -r requirements.txt

Start the Flask development server
- python app.py
  or (alternative)
- export FLASK_APP=app.py
- export FLASK_ENV=development
- flask run

Note: app.py binds to 0.0.0.0:5000 by default so it is reachable from forwarded ports (Codespaces / Docker). When using `flask run` set FLASK_RUN_HOST=0.0.0.0 if you need the server reachable externally.

Open the UI
- Visit http://127.0.0.1:5000 in your browser.
- The frontend will fetch the currency list from `/api/symbols` and call `/api/convert` for conversions.

Example API calls (curl)
- List currencies:
  curl "http://127.0.0.1:5000/api/symbols"

- Convert 100 USD to EUR (latest):
  curl "http://127.0.0.1:5000/api/convert?from=USD&to=EUR&amount=100"

- Historical conversion:
  curl "http://127.0.0.1:5000/api/convert?from=GBP&to=INR&amount=10&date=2022-01-01"

Expected JSON shapes:
- /api/symbols -> {"success":true,"provider":"frankfurter.app","symbols":{ "USD":{"description":"United States Dollar"}, ...}}
- /api/convert -> {"success":true,"provider":"frankfurter.app","data":{ "success":true,"query":{...},"info":{"rate":...},"result":... }}

Docker (optional)
Build:
  docker build -t currency-converter .

Run:
  docker run -p 5000:5000 currency-converter

Open http://127.0.0.1:5000

Deploying (short)
- Render / Railway / Heroku: connect repo → set start command:
  web: gunicorn app:app --bind 0.0.0.0:$PORT
- For simple deployments, add a `Procfile` containing:
  web: gunicorn app:app --bind 0.0.0.0:$PORT
- For production, use a process manager (gunicorn) and a persistent cache (Redis) if you expect heavy traffic.

Codespaces & port forwarding notes
- If running inside GitHub Codespaces or similar cloud IDEs, start the server and then open the forwarded port shown in the Codespaces Ports panel (click the Forwarded Address).
- Make sure the app is listening on 0.0.0.0 (app.py uses `app.run(host="0.0.0.0", port=5000)`) so the forwarded port is accessible externally.

Troubleshooting & tips
- ModuleNotFoundError for flask/requests:
  Make sure your venv is active and run:
    pip install -r requirements.txt
- Frontend shows blank or currency lists not loaded:
  - Open browser DevTools (F12) and check for fetch errors or console exceptions.
  - Test backend directly: curl "http://127.0.0.1:5000/api/symbols"
- API returns provider errors or missing symbols:
  - The app tries frankfurter.app first and falls back to exchangerate.host. If both are unreachable (corporate firewall or DNS hijack), try from another network (mobile hotspot) to verify.
- Port in use:
  - Use a different port (edit app.run in app.py or set FLASK_RUN_PORT when using `flask run`).

Project file layout
- app.py               — Flask backend and API endpoints
- templates/index.html — Frontend HTML page
- static/main.js       — Frontend JavaScript
- requirements.txt     — Python dependencies (Flask, requests)
- Dockerfile           — Simple Dockerfile for local container testing
- README.md            — This file

License
- This project is provided as-is. Add a LICENSE file if you want a formal license (MIT recommended for simple projects).

Contributing / Next steps
- Add unit tests for the conversion functions.
- Add persistent logging (SQLite) to record user conversions and favorites.
- Improve UI styling (Bootstrap/Tailwind) and add a date picker for historical conversions.
- Add CI (GitHub Actions) to run tests and build Docker images on push.

If you want me to commit this README directly to your repository, I can show the exact git commands to update the file and push, or I can create a commit and open a PR for you — tell me which and I will provide the precise commands next.