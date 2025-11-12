import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
  // All state variables
  const [symbols, setSymbols] = useState({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(1);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  // Fetch symbols on mount
  useEffect(() => {
    setLoading(true);
    axios
      .get("http://localhost:5000/api/symbols")
      .then((response) => {
        setSymbols(response.data.symbols || {});
        // Default selection: USD to EUR if available
        const codes = Object.keys(response.data.symbols || {});
        setFrom(codes.includes("USD") ? "USD" : codes[0] || "");
        setTo(codes.includes("EUR") ? "EUR" : (codes[1] || codes[0] || ""));
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load currency symbols. Make sure the backend is running.");
        setLoading(false);
      });
  }, []);

  // Swap to/from
  function handleSwap() {
    setFrom((prev) => {
      setTo(from);
      return to;
    });
    setResult("");
    setError("");
  }

  // Handle conversion
  function handleConvert(e) {
    e.preventDefault();
    setError("");
    setResult("");
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!from || !to) {
      setError("Please select both currencies.");
      return;
    }
    setConverting(true);
    axios
      .get("http://localhost:5000/api/convert", {
        params: {
          from,
          to,
          amount
        }
      })
      .then((response) => {
        if (response.data.success && response.data.data) {
          setResult(
            `${response.data.data.query.amount} ${response.data.data.query.from} = ${Number(response.data.data.result).toFixed(4)} ${response.data.data.query.to}  \nRate: 1 ${response.data.data.query.from} = ${Number(response.data.data.info.rate).toFixed(6)} ${response.data.data.query.to}`
          );
        } else {
          setError(
            response.data.error || "Conversion failed. Try again later."
          );
        }
      })
      .catch(() => {
        setError("Error connecting to backend. Check if the API is running.");
      })
      .finally(() => {
        setConverting(false);
      });
  }

  return (
    <div style={{
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #223050 0%, #1d2943 100%)",
      color: "#f5f8fd",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <h1 style={{ marginTop: 40, fontWeight: 900, fontSize: 38, color: "#fff" }}>Currency Converter</h1>

      <form onSubmit={handleConvert}
        style={{
          marginTop: 35,
          background: "#132953",
          borderRadius: 15,
          padding: 35,
          boxShadow: "0 2px 12px #22296644",
          maxWidth: 420,
          width: "100%"
        }}>
        {loading ? (
          <div>Loading currencies…</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ minWidth: 120, maxWidth: 180, fontSize: 18, borderRadius: 9, padding: "7px 13px", border: "1.5px solid #3875f4" }}
                required
                placeholder="Amount"
              />
              <select value={from} onChange={e => setFrom(e.target.value)}
                style={{ minWidth: 120, maxWidth: 180, fontSize: 17, borderRadius: 9, padding: "7px 13px", border: "1.5px solid #3875f4" }}>
                {Object.keys(symbols).map(code => (
                  <option key={code} value={code}>{code} — {symbols[code].description}</option>
                ))}
              </select>
              <button type="button" onClick={handleSwap} style={{ border: "none", background: "#27477a", color: "#6bfcbc", fontWeight: 700, fontSize: 23, borderRadius: 8, padding: "4px 15px", cursor: "pointer" }} title="Swap from/to">⇆</button>
              <select value={to} onChange={e => setTo(e.target.value)}
                style={{ minWidth: 120, maxWidth: 180, fontSize: 17, borderRadius: 9, padding: "7px 13px", border: "1.5px solid #3875f4" }}>
                {Object.keys(symbols).map(code => (
                  <option key={code} value={code}>{code} — {symbols[code].description}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={converting} style={{ padding: "12px 36px", borderRadius: 13, fontSize: 17, background: "linear-gradient(90deg, #6bfcbc 0%, #4773fa 100%)", color: "#fff", fontWeight: 900, border: "none", cursor: "pointer", boxShadow: "0 1px 8px #328fff44" }}>
              {converting ? "Converting…" : "Convert"}
            </button>
          </>
        )}
        <div style={{ color: "#f9b360", minHeight: 19, marginTop: 10 }}>{error}</div>
        <div style={{ color: "#6bfcbc", fontWeight: 700, minHeight: 25, marginTop: 16, fontSize: 19, whiteSpace: "pre-line" }}>{result}</div>
      </form>
      <div style={{ marginTop: 40, color: "#9ab0df", fontSize: 16 }}>
        Rates provided by your Flask API (Frankfurter & exchangerate.host)
      </div>
    </div>
  );
}

export default App;
