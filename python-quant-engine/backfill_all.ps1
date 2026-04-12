# backfill_all.ps1
$env:PGPASSWORD="postgres"
$env:PGUSER="postgres"
$env:PGHOST="localhost"
$env:PGPORT="5432"
$env:PGDATABASE="traderetro_raw"

# The exact list of equity tickers from your React UI
$tickers = @(
    "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "AXISBANK.NS", # Banking
    "TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS",           # IT
    "RELIANCE.NS", "ONGC.NS",                                # Energy
    "HINDUNILVR.NS", "ITC.NS",                               # FMCG
    "BAJFINANCE.NS",                                         # Finance
    "BHARTIARTL.NS"                                          # Telecom
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Initiating TradeRetro 10-Year Bulk Backfill" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($ticker in $tickers) {
    Write-Host "`n[*] Starting ingestion for $ticker..." -ForegroundColor Yellow
    
    # Call your Python CLI for each ticker
    .\.venv\Scripts\python.exe src\ingestion\fetch_ohlcv.py --symbol $ticker --period 10y
    
    # CRITICAL: 3-second delay to prevent Yahoo Finance from IP-banning you
    Write-Host "[!] Sleeping for 3 seconds to respect rate limits..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3 
}

Write-Host "`n[+] Bulk Backfill Successfully Completed!" -ForegroundColor Green