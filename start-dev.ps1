# Trend App - Development Startup Script
# This script sets environment variables and starts the backend server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Trend Financial Prediction Platform  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:NODE_ENV = "development"
$env:DATABASE_URL = "postgresql://postgres:erXKZIzQTMZHWCHbbgLHnAzYDljXdrIe@hopper.proxy.rlwy.net:26012/railway"
$env:JWT_SECRET = "your-secret-key-change-this-in-production"
$env:PORT = "3002"
$env:FRONTEND_URL = "http://localhost:5173"
$env:BASE_URL = "http://localhost:5173"
$env:FROM_EMAIL = "noreply@trend-app.com"
$env:BREVO_API_KEY = "your-brevo-api-key"
$env:FIREBASE_PROJECT_ID = "trend-60388"
$env:EXCHANGERATE_API_KEY = "535d82b57fa2cdc35abd9f96"

Write-Host "✓ Environment configured" -ForegroundColor Green
Write-Host "  Database: Railway PostgreSQL" -ForegroundColor Gray
Write-Host "  Backend Port: 3002" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Yellow
Write-Host ""

# Start the server
npx tsx server/index.ts
