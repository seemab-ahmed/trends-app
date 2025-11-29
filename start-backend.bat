@echo off
echo ========================================
echo   Trend Financial Prediction Platform
echo ========================================
echo.
echo Starting Backend Server...
echo.

set NODE_ENV=development
set DATABASE_URL=postgresql://postgres:erXKZIzQTMZHWCHbbgLHnAzYDljXdrIe@hopper.proxy.rlwy.net:26012/railway
set JWT_SECRET=your-secret-key-change-this-in-production
set PORT=3002
set FRONTEND_URL=http://localhost:5173
set BASE_URL=http://localhost:5173
set FROM_EMAIL=noreply@trend-app.com
set BREVO_API_KEY=your-brevo-api-key
set FIREBASE_PROJECT_ID=trend-60388
set EXCHANGERATE_API_KEY=535d82b57fa2cdc35abd9f96

echo Backend will run on: http://localhost:3002
echo Frontend should run on: http://localhost:5173
echo.
echo Press Ctrl+C to stop the server
echo.

npx tsx server/index.ts
