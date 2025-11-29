# 🚀 Quick Start Guide - Trend Financial Prediction Platform

## ✅ Project Successfully Running!

### Current Status:
- ✅ Backend Server: **Running on http://localhost:3002**
- ✅ Frontend App: **Running on http://localhost:5173**
- ✅ Database: **Connected to Railway PostgreSQL**

---

## 🎯 How to Start the Application

### **Method 1: Manual Start (Recommended)**

**Terminal 1 - Backend:**
```powershell
$env:NODE_ENV="development"; $env:DATABASE_URL="postgresql://postgres:erXKZIzQTMZHWCHbbgLHnAzYDljXdrIe@hopper.proxy.rlwy.net:26012/railway"; $env:JWT_SECRET="your-secret-key-change-this-in-production"; $env:PORT="3002"; $env:FRONTEND_URL="http://localhost:5173"; $env:BASE_URL="http://localhost:5173"; $env:FROM_EMAIL="noreply@trend-app.com"; $env:BREVO_API_KEY="your-brevo-api-key"; $env:FIREBASE_PROJECT_ID="trend-60388"; $env:EXCHANGERATE_API_KEY="535d82b57fa2cdc35abd9f96"; npx tsx server/index.ts
```

**Terminal 2 - Frontend:**
```powershell
npm run dev:frontend
```

### **Method 2: Using NPM Scripts**

After installing dependencies, you can use:
```powershell
npm run dev:backend  # Backend on port 3002
npm run dev:frontend # Frontend on port 5173
```

---

## 🔧 Initial Setup (First Time Only)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Verify Installation
The following key dependencies should be installed:
- `cross-env` - Environment variable management
- `tsx` - TypeScript execution
- `vite` - Frontend build tool
- `express` - Backend framework
- `drizzle-orm` - Database ORM

---

## 🌐 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | React application (Vite) |
| **Backend API** | http://localhost:3002 | Express REST API |
| **Database** | Railway PostgreSQL | Cloud hosted database |

---

## 🔑 Default Credentials

### Admin Account:
- **Email:** `admin@trend-app.com`
- **Password:** `admin123`

---

## 📋 Common Commands

```powershell
# Development
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only
npm run dev              # Start both (if configured)

# Database
npm run db:push          # Push schema changes to database
npm run db:init          # Initialize database
npm run seed-admin       # Seed admin user

# Build
npm run build            # Build frontend for production
npm run start            # Start production server

# Utilities
npm run check            # TypeScript type checking
```

---

## ⚠️ Troubleshooting

### Issue: "Cannot find module 'cross-env'"
**Solution:**
```powershell
npm install cross-env tsx
```

### Issue: Port already in use
**Solution:**
- Backend uses port **3002**
- Frontend uses port **5173**
- Kill processes using these ports or change in package.json

### Issue: Database connection error
**Solution:**
- Verify internet connection (Railway database is cloud-hosted)
- Check DATABASE_URL in environment variables
- Railway database: `hopper.proxy.rlwy.net:26012`

### Issue: Frontend can't reach backend
**Solution:**
- Ensure backend is running on port 3002
- Check CORS settings in `server/index.ts`
- Verify `FRONTEND_URL=http://localhost:5173` is set

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `server/index.ts` | Backend entry point |
| `client/src/main.tsx` | Frontend entry point |
| `package.json` | Dependencies and scripts |
| `drizzle.config.ts` | Database configuration |
| `vite.config.ts` | Frontend build config |
| `start-dev.ps1` | PowerShell startup script |

---

## 🎮 Features Available

✅ User authentication (JWT-based)
✅ Financial predictions (Crypto, Stocks, Forex)
✅ Real-time price updates
✅ Leaderboard system
✅ Badge system
✅ Admin panel
✅ Email notifications
✅ Market sentiment analysis
✅ Follow system

---

## 📞 Support

For issues or questions:
1. Check terminal output for error messages
2. Review `TROUBLESHOOTING.md` if available
3. Check database connectivity
4. Verify all environment variables are set

---

**Last Updated:** November 21, 2025
**Status:** ✅ Operational
