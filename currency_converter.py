#!/usr/bin/env python3
"""
Simple CLI Currency Converter with provider fallback.

Primary provider: exchangerate.host (no key normally)
Fallback provider: api.frankfurter.app (no key)

Usage examples:
  python currency_converter.py --from USD --to EUR --amount 100
  python currency_converter.py --list --verbose
  python currency_converter.py --from GBP --to INR --amount 50 --date 2023-01-01
"""
import argparse
import sys
import requests
from requests.exceptions import RequestException

PRIMARY_BASE = "https://api.exchangerate.host"
FALLBACK_BASE = "https://api.frankfurter.app"


def try_primary_symbols():
    """Try exchangerate.host /symbols. Return (symbols_dict_or_None, raw, status)."""
    url = f"{PRIMARY_BASE}/symbols"
    try:
        r = requests.get(url, timeout=8)
    except RequestException as e:
        return None, f"Network error: {e}", None
    status = r.status_code
    try:
        data = r.json()
    except ValueError:
        return None, r.text, status
    # exchangerate.host normally returns {"success": true, "symbols": {...}}
    # If there's an "error" or "success" is false this is not usable.
    if isinstance(data, dict) and data.get("symbols"):
        return data.get("symbols"), data, status
    # Not the expected response
    return None, data, status


def try_fallback_symbols():
    """Try frankfurter /currencies. Return (symbols_dict_like, raw, status)."""
    url = f"{FALLBACK_BASE}/currencies"
    try:
        r = requests.get(url, timeout=8)
    except RequestException as e:
        return None, f"Network error: {e}", None
    status = r.status_code
    try:
        data = r.json()
    except ValueError:
        return None, r.text, status
    # frankfurter returns a mapping code -> full name, e.g. {"USD":"United States Dollar", ...}
    if isinstance(data, dict):
        # normalize to the same shape as exchangerate.host where each value is a dict with description
        normalized = {code: {"description": name} for code, name in data.items()}
        return normalized, data, status
    return None, data, status


def get_symbols(verbose=False):
    """Return (symbols_dict_or_None, provider_name, raw, status)."""
    symbols, raw, status = try_primary_symbols()
    if symbols:
        return symbols, "exchangerate.host", raw, status

    # Primary failed - try fallback
    symbols2, raw2, status2 = try_fallback_symbols()
    if symbols2:
        return symbols2, "frankfurter.app", raw2, status2

    # Neither worked
    # prefer returning primary raw if present
    return None, None, raw if raw is not None else raw2, status if status is not None else status2


def try_primary_convert(from_currency, to_currency, amount, date=None):
    url = f"{PRIMARY_BASE}/convert"
    params = {"from": from_currency.upper(), "to": to_currency.upper(), "amount": amount}
    if date:
        params["date"] = date
    try:
        r = requests.get(url, params=params, timeout=8)
    except RequestException as e:
        return None, f"Network error: {e}", None
    status = r.status_code
    try:
        data = r.json()
    except ValueError:
        return None, r.text, status
    # If exchangerate.host responds with success true and has result, return it
    if isinstance(data, dict) and data.get("result") is not None and data.get("success", True):
        return data, None, status
    # Not usable
    return None, data, status


def try_fallback_convert(from_currency, to_currency, amount, date=None):
    """
    Use frankfurter.app as fallback.
    frankfurter endpoints:
      - /latest?from=USD&to=EUR
      - /{date}?from=USD&to=EUR
    Response example: {"amount":1.0,"base":"USD","date":"2020-01-01","rates":{"EUR":0.9}}
    We'll compute result = rate * amount and synthesize a response similar enough to primary.
    """
    path = date if date else "latest"
    url = f"{FALLBACK_BASE}/{path}"
    params = {"from": from_currency.upper(), "to": to_currency.upper()}
    try:
        r = requests.get(url, params=params, timeout=8)
    except RequestException as e:
        return None, f"Network error: {e}", None
    status = r.status_code
    try:
        data = r.json()
    except ValueError:
        return None, r.text, status

    # frankfurter returns rates dict
    rates = data.get("rates", {})
    rate = rates.get(to_currency.upper())
    if rate is None:
        # Sometimes frankfurter requires a different base; try fetching latest base=EUR (fallback)
        return None, data, status

    result = rate * float(amount)
    # synthesize a response similar to exchangerate.host for the remainder of the script
    synthesized = {
        "success": True,
        "query": {"from": from_currency.upper(), "to": to_currency.upper(), "amount": float(amount)},
        "info": {"rate": float(rate)},
        "result": float(result),
        "provider": "frankfurter.app",
        "raw": data,
    }
    return synthesized, None, status


def list_currencies(verbose=False):
    symbols, provider, raw, status = get_symbols(verbose=verbose)
    if not symbols:
        print("No symbols found.")
        if status is None:
            print("Possible network problem (unable to reach providers).")
        else:
            print(f"HTTP status: {status}")
        if verbose:
            print("\n-- Raw response or error detail --")
            import json
            try:
                print(json.dumps(raw, indent=2, sort_keys=True))
            except Exception:
                print(raw)
        print("\nChecks & suggestions:")
        print("- Try opening https://api.exchangerate.host/symbols in your browser.")
        print("- Try opening https://api.frankfurter.app/currencies in your browser.")
        print("- Try from a different network (mobile hotspot) to rule out proxies/DNS hijack.")
        print("- Check your /etc/hosts or Windows hosts file for overrides of api.exchangerate.host.")
        return

    print(f"Using provider: {provider}")
    for code in sorted(symbols.keys()):
        desc = symbols[code].get("description", "")
        print(f"{code}\t- {desc}")


def convert(from_currency, to_currency, amount, date=None, verbose=False):
    # Try primary
    primary_data, primary_err, primary_status = try_primary_convert(from_currency, to_currency, amount, date=date)
    if primary_data:
        return primary_data, "exchangerate.host", primary_err, primary_status

    # If primary returned an error JSON (e.g., missing_access_key), include it in verbose output
    if verbose:
        print("Primary provider failed or returned unexpected response.")
        print("Primary response detail:")
        import json
        try:
            print(json.dumps(primary_err if primary_err is not None else {}, indent=2, sort_keys=True))
        except Exception:
            print(primary_err)

    # Try fallback
    fallback_data, fallback_err, fallback_status = try_fallback_convert(from_currency, to_currency, amount, date=date)
    if fallback_data:
        return fallback_data, "frankfurter.app", fallback_err, fallback_status

    # Nothing worked
    # return the last error info
    return None, None, fallback_err if fallback_err is not None else primary_err, fallback_status if fallback_status is not None else primary_status


def main():
    parser = argparse.ArgumentParser(description="Simple CLI currency converter with provider fallback")
    parser.add_argument("--from", "-f", dest="from_currency", help="Source currency code (e.g. USD)")
    parser.add_argument("--to", "-t", dest="to_currency", help="Target currency code (e.g. EUR)")
    parser.add_argument("--amount", "-a", type=float, default=1.0, help="Amount to convert (default: 1.0)")
    parser.add_argument("--date", "-d", help="Optional date (YYYY-MM-DD) for historical rates")
    parser.add_argument("--list", action="store_true", help="List supported currency codes")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show verbose diagnostics on errors")
    args = parser.parse_args()

    if args.list:
        try:
            list_currencies(verbose=args.verbose)
        except RequestException as e:
            print("Network error while fetching currency list:", e, file=sys.stderr)
            sys.exit(1)
        return

    if not args.from_currency or not args.to_currency:
        parser.print_help()
        print("\nEither use --list or provide both --from and --to currency codes.", file=sys.stderr)
        sys.exit(1)

    try:
        data, provider, error_detail, status = convert(args.from_currency, args.to_currency, args.amount, date=args.date, verbose=args.verbose)
    except RequestException as e:
        print("Network error during conversion:", e, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)

    if not data:
        print("Conversion failed or returned no result.", file=sys.stderr)
        if args.verbose:
            print("Error detail:")
            import json
            try:
                print(json.dumps(error_detail, indent=2, sort_keys=True))
            except Exception:
                print(error_detail)
        sys.exit(1)

    amount = data.get("query", {}).get("amount", args.amount)
    from_code = data.get("query", {}).get("from", args.from_currency.upper())
    to_code = data.get("query", {}).get("to", args.to_currency.upper())
    result = data.get("result")
    rate = data.get("info", {}).get("rate")

    provider_info = f" (provider: {provider})" if provider else ""
    if rate:
        print(f"{amount} {from_code} = {result:.6f} {to_code}{provider_info}   (rate: 1 {from_code} = {rate:.6f} {to_code})")
    else:
        print(f"{amount} {from_code} = {result:.6f} {to_code}{provider_info}")


if __name__ == "__main__":
    main()