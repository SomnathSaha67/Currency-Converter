#!/usr/bin/env python3
"""
Simple CLI Currency Converter using https://exchangerate.host (no API key).

Usage examples:
  python currency_converter.py --from USD --to EUR --amount 100
  python currency_converter.py --list
  python currency_converter.py --list --verbose
  python currency_converter.py --from GBP --to INR --amount 50 --date 2023-01-01
"""
import argparse
import sys
import requests
from requests.exceptions import RequestException

BASE_URL = "https://api.exchangerate.host"


def get_symbols():
    """Return tuple (symbols_dict_or_None, raw_json_or_text, status_code)."""
    url = f"{BASE_URL}/symbols"
    try:
        resp = requests.get(url, timeout=8)
    except RequestException as e:
        # Network-level error (DNS, connection, TLS, proxy, etc.)
        return None, f"Network error: {e}", None

    status = resp.status_code
    try:
        data = resp.json()
    except ValueError:
        # Response wasn't JSON
        return None, resp.text, status

    symbols = data.get("symbols")
    return symbols, data, status


def convert(from_currency, to_currency, amount, date=None):
    params = {
        "from": from_currency.upper(),
        "to": to_currency.upper(),
        "amount": amount,
    }
    if date:
        params["date"] = date
    url = f"{BASE_URL}/convert"
    resp = requests.get(url, params=params, timeout=8)
    resp.raise_for_status()
    return resp.json()


def list_currencies(verbose=False):
    symbols, raw, status = get_symbols()
    if not symbols:
        print("No symbols found.")
        # Provide helpful diagnostics
        if status is None:
            print("Possible network problem (unable to reach exchangerate.host).")
        else:
            print(f"HTTP status: {status}")
        if verbose:
            print("\n-- Raw response or error detail --")
            # raw may be dict or string
            if isinstance(raw, dict):
                import json
                print(json.dumps(raw, indent=2, sort_keys=True))
            else:
                print(raw)
        print("\nChecks & suggestions:")
        print("- Do you have an active internet connection?")
        print("- Are you behind a proxy / corporate firewall that blocks https://api.exchangerate.host ?")
        print("- Try running: curl https://api.exchangerate.host/symbols  (or open that URL in your browser)")
        return

    for code in sorted(symbols.keys()):
        desc = symbols[code].get("description", "")
        print(f"{code}\t- {desc}")


def main():
    parser = argparse.ArgumentParser(description="Simple CLI currency converter")
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
        data = convert(args.from_currency, args.to_currency, args.amount, date=args.date)
    except RequestException as e:
        print("Network error during conversion:", e, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)

    if not data:
        print("No response data received.", file=sys.stderr)
        sys.exit(1)

    if "result" not in data or data.get("result") is None:
        print("Conversion failed or returned no result. Response:", data, file=sys.stderr)
        sys.exit(1)

    amount = data.get("query", {}).get("amount", args.amount)
    from_code = data.get("query", {}).get("from", args.from_currency.upper())
    to_code = data.get("query", {}).get("to", args.to_currency.upper())
    result = data.get("result")
    rate = data.get("info", {}).get("rate")

    if rate:
        print(f"{amount} {from_code} = {result:.6f} {to_code}   (rate: 1 {from_code} = {rate:.6f} {to_code})")
    else:
        print(f"{amount} {from_code} = {result:.6f} {to_code}")


if __name__ == "__main__":
    main()