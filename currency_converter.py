#!/usr/bin/env python3
"""
Simple CLI Currency Converter using https://exchangerate.host (no API key).
Usage examples:
  python currency_converter.py --from USD --to EUR --amount 100
  python currency_converter.py --list
  python currency_converter.py --from GBP --to INR --amount 50 --date 2023-01-01
"""
import argparse
import sys
import requests

BASE_URL = "https://api.exchangerate.host"


def get_symbols():
    """Return mapping of currency code -> description."""
    url = f"{BASE_URL}/symbols"
    resp = requests.get(url, timeout=8)
    resp.raise_for_status()
    data = resp.json()
    return data.get("symbols", {})


def convert(from_currency, to_currency, amount, date=None):
    """
    Convert amount from from_currency to to_currency.
    If date is provided (YYYY-MM-DD), the conversion will use historical rates.
    Returns the parsed JSON response.
    """
    params = {
        "from": from_currency.upper(),
        "to": to_currency.upper(),
        "amount": amount,
    }
    if date:
        params["date"] = date  # exchangerate.host accepts a 'date' query param
    url = f"{BASE_URL}/convert"
    resp = requests.get(url, params=params, timeout=8)
    resp.raise_for_status()
    return resp.json()


def list_currencies():
    symbols = get_symbols()
    if not symbols:
        print("No symbols found.")
        return
    # sort by code
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
    args = parser.parse_args()

    if args.list:
        try:
            list_currencies()
        except requests.RequestException as e:
            print("Network error while fetching currency list:", e, file=sys.stderr)
            sys.exit(1)
        return

    if not args.from_currency or not args.to_currency:
        parser.print_help()
        print("\nEither use --list or provide both --from and --to currency codes.", file=sys.stderr)
        sys.exit(1)

    try:
        data = convert(args.from_currency, args.to_currency, args.amount, date=args.date)
    except requests.RequestException as e:
        print("Network error during conversion:", e, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)

    # The API returns fields like: success, query, info (rate), result
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