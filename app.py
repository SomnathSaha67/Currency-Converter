from flask import Flask, jsonify, request, render_template
import requests
import time

app = Flask(__name__, static_folder="static", template_folder="templates")

FRANKFURTER = "https://api.frankfurter.app"
EXCHANGERATE = "https://api.exchangerate.host"

CACHE = {"symbols": None, "symbols_ts": 0}
SYMBOLS_TTL = 3600

def fetch_symbols():
    now = time.time()
    if CACHE["symbols"] and (now - CACHE["symbols_ts"] < SYMBOLS_TTL):
        return CACHE["symbols"], "cache", {"cached": True}
    try:
        r = requests.get(f"{FRANKFURTER}/currencies", timeout=8)
        r.raise_for_status()
        data = r.json()
        if data:
            normalized = {code: {"description": name} for code, name in data.items()}
            CACHE["symbols"] = normalized
            CACHE["symbols_ts"] = now
            return normalized, "frankfurter.app", data
    except Exception:
        pass
    try:
        r = requests.get(f"{EXCHANGERATE}/symbols", timeout=8)
        r.raise_for_status()
        data = r.json()
        symbols = data.get("symbols")
        if symbols:
            CACHE["symbols"] = symbols
            CACHE["symbols_ts"] = now
            return symbols, "exchangerate.host", data
    except Exception:
        pass
    return None, "", {}

def convert_via_frankfurter(from_currency, to_currency, amount, date=None):
    path = date if date else "latest"
    params = {"from": from_currency.upper(), "to": to_currency.upper()}
    try:
        r = requests.get(f"{FRANKFURTER}/{path}", params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
        rate = data.get("rates", {}).get(to_currency.upper())
        if rate is None:
            return None
        result = float(rate) * float(amount)
        return {
            "success": True,
            "query": {"from": from_currency.upper(), "to": to_currency.upper(), "amount": float(amount)},
            "info": {"rate": float(rate)},
            "result": float(result),
            "provider": "frankfurter.app"
        }
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
        if data.get("result") is not None:
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
        return jsonify({"success": False, "error": "Unable to fetch currency list"}), 500
    return jsonify({"success": True, "provider": provider, "symbols": symbols})

@app.route("/api/convert")
def api_convert():
    from_currency = request.args.get("from")
    to_currency = request.args.get("to")
    amount = request.args.get("amount", type=float, default=1.0)
    date = request.args.get("date", default=None)
    if not from_currency or not to_currency:
        return jsonify({"success": False, "error": "Missing 'from' or 'to' parameters"}), 400
    data = convert_via_frankfurter(from_currency, to_currency, amount, date=date)
    if data:
        return jsonify({"success": True, "provider": "frankfurter.app", "data": data})
    data2 = convert_via_exchangerate(from_currency, to_currency, amount, date=date)
    if data2:
        return jsonify({"success": True, "provider": "exchangerate.host", "data": data2})
    return jsonify({"success": False, "error": "Conversion failed."}), 502

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
