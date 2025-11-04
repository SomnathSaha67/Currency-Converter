# **Simple Currency Converter (Flask web app)**
A minimal, beginner-friendly Flask web application for real-time and historical currency conversion, using robust public exchange-rate providers.

## **Features**
Real-time and historical conversion (any major currency, any date available)

Swap and instantly reverse currency direction

Two-data-provider fallback (frankfurter.app and exchangerate.host)

Modern, responsive UI — clear results next to inputs

Docker & cloud ready (Render, Railway, Heroku)

## **Folder & File Overview**
### File/Folder	and their Purpose
app.py:	Flask backend and API logic
templates/index.html:	Frontend HTML & styles
static/main.js:	Frontend JS, conversion logic
requirements.txt:	Python dependencies list
Dockerfile, Procfile	Deployment-ready configuration
.gitignore:	Common file exclusions
## **Quick Local Setup**
Clone repository

text
git clone https://github.com/SomnathSaha67/Currency-Converter.git
cd Currency-Converter
Create & activate venv

text
python3 -m venv venv
source venv/bin/activate            # macOS/Linux
.\venv\Scripts\Activate.ps1         # Windows
Install dependencies

text
pip install -r requirements.txt
Launch the server

text
python app.py
Browse: http://127.0.0.1:5000

API Endpoints
GET /api/symbols
All supported currencies, plus provider.

GET /api/convert?from=USD&to=EUR&amount=100[&date=YYYY-MM-DD]
Live or historical conversion.

JSON example:

json
{
  "success": true,
  "provider": "frankfurter.app",
  "data": {
    "query": { "from": "USD", "to": "INR", "amount": 100 },
    "info": { "rate": 88.71 },
    "result": 8871.00
  }
}
Docker Quickstart
text
docker build -t currency-converter .
docker run -p 5000:5000 currency-converter
Troubleshooting
If dependencies break, re-run: pip install -r requirements.txt

App not loading? Check browser JS console and backend via curl

If API providers are down, retry or use a different network.

## **Next Step Ideas**
Add a historical rate chart (with Chart.js/Plotly)

Alerts/notifications for rate targets

Save favorites or conversion history

UI upgrades, test suite, future PWA

## **Attribution**
Data from frankfurter.app and exchangerate.host.


Ready for deployment and easy upgrades!
Pull requests, feedback, and suggestions always welcome.
