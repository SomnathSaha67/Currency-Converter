# Simple CLI Currency Converter (Python)

This is a beginner-friendly currency converter using exchangerate.host (free, no API key).

Files:
- `currency_converter.py` — the main script
- `requirements.txt` — Python dependency (requests)

Quick start
1. Install Python (3.7+ recommended).
2. Create and activate a virtual environment (optional but recommended):
   - macOS / Linux:
     python3 -m venv venv
     source venv/bin/activate
   - Windows (PowerShell):
     python -m venv venv
     .\venv\Scripts\Activate.ps1
3. Install dependencies:
   pip install -r requirements.txt
4. Run examples:
   - List currencies:
     python currency_converter.py --list
   - Convert 100 USD to EUR:
     python currency_converter.py --from USD --to EUR --amount 100
   - Historical conversion (example):
     python currency_converter.py --from GBP --to INR --amount 10 --date 2022-01-01

Notes
- The script uses https://exchangerate.host which is free and doesn't require an API key.
- If you want a web or GUI front-end later, the script's `convert` function can be re-used.

Next ideas to extend this project
- Add caching to avoid repeated API calls when converting many times.
- Add a small GUI with tkinter.
- Build a Flask web app with this backend.
- Support recurring conversions and save logs to CSV/SQLite.
- Add unit tests for the conversion functions.