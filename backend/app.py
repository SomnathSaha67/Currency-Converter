from flask import Flask, jsonify, request, render_template
import requests
import time
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

FRANKFURTER = "https://api.frankfurter.app"
EXCHANGERATE = "https://api.exchangerate.host"

# Simple in-memory cache for currency symbols
CACHE = {
    "symbols": None,
    "symbols_ts": 0
}
SYMBOLS_TTL = 3600  # seconds

def fetch_symbols():
    """
    Return (symbols_dict_or_None, provider_name_or_empty, raw_response)
    symbols format: { "USD": {"description": "United States Dollar"}, ... }
    """
    now = time.time()
    if CACHE["symbols"] and (now - CACHE["symbols_ts"] < SYMBOLS_TTL):
        return CACHE["symbols"], "cache", {"cached": True}
    # Try Frankfurter first
    try:
        r = requests.get(f"{FRANKFURTER}/currencies", timeout=8)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data:
            normalized = {code: {"description": name} for code, name in data.items()}
            CACHE["symbols"] = normalized
            CACHE["symbols_ts"] = now
            return normalized, "frankfurter.app", data
    except Exception as e:
        primary_err = str(e)
    # Fallback to exchangerate.host
    try:
        r = requests.get(f"{EXCHANGERATE}/symbols", timeout=8)
        r.raise_for_status()
        data = r.json()
        symbols = data.get("symbols") if isinstance(data, dict) else None
        if symbols:
            CACHE["symbols"] = symbols
            CACHE["symbols_ts"] = now
            return symbols, "exchangerate.host", data
    except Exception as e:
        fallback_err = str(e)
    # Nothing worked
    raw = {"primary_error": locals().get("primary_err", None), "fallback_error": locals().get("fallback_err", None)}
    return None, "", raw

def convert_via_frankfurter(from_currency, to_currency, amount, date=None):
    path = date if date else "latest"
    params = {"from": from_currency.upper(), "to": to_currency.upper()}
    try:
        r = requests.get(f"{FRANKFURTER}/{path}", params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
        rates = data.get("rates", {})
        rate = rates.get(to_currency.upper())
        if rate is None:
            return None
        result = float(rate) * float(amount)
        synthesized = {
            "success": True,
            "query": {"from": from_currency.upper(), "to": to_currency.upper(), "amount": float(amount)},
            "info": {"rate": float(rate)},
            "result": float(result),
            "provider": "frankfurter.app",
            "raw": data
        }
        return synthesized
    except Exception:
        return None

def convert_via_exchangerate(from_currency, to_currency, amount, date=None):
    params = {"from": from_currency.upper(), "to": to_currency.upper(), "amount": amount}
    if date:
        params["date"] = date
    try:
        r = requests.get(f"{EXCHANGERATE}/convert", params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("result") is not None:
            data["provider"] = "exchangerate.host"
            return data
    except Exception:
        return None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/symbols")
def api_symbols():
    symbols, provider, raw = fetch_symbols()
    if symbols is None:
        return jsonify({"success": False, "error": "Unable to fetch currency list", "detail": raw}), 500
    return jsonify({"success": True, "provider": provider, "symbols": symbols})

@app.route("/api/convert")
def api_convert():
    from_currency = request.args.get("from", type=str)
    to_currency = request.args.get("to", type=str)
    amount = request.args.get("amount", type=float, default=1.0)
    date = request.args.get("date", type=str, default=None)

    if not from_currency or not to_currency:
        return jsonify({"success": False, "error": "Missing 'from' or 'to' query parameters"}), 400
    # Try providers in order
    data = convert_via_frankfurter(from_currency, to_currency, amount, date=date)
    if data:
        return jsonify({"success": True, "provider": "frankfurter.app", "data": data})
    data2 = convert_via_exchangerate(from_currency, to_currency, amount, date=date)
    if data2:
        return jsonify({"success": True, "provider": "exchangerate.host", "data": data2})
    return jsonify({"success": False, "error": "Both providers failed. Try again later or check network."}), 502

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
