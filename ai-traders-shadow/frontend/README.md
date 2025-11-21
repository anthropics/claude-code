# AI Trader's Shadow - Frontend

**Next.js frontend for the Crypto Micro-Mentor educational paper trading platform.**

---

## 🎯 Features

### Real-Time Dashboard

- **Mood Meter** 🎭 - Visual representation of AI agent's current state
- **AI Recommendation** 🧠 - PPO model predictions (HOLD/BUY/SELL)
- **Trade Panel** 📊 - Execute paper trades
- **Portfolio Status** 💼 - Live P&L and performance metrics

### WebSocket Integration

- ✅ Persistent WebSocket connection to backend
- ✅ Real-time mood updates
- ✅ Live P&L tracking
- ✅ Automatic reconnection with exponential backoff

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 3. Start Backend (Required!)

In another terminal:
```bash
cd backend
source venv/bin/activate
python -m app.main
```

### 4. Start Development Server

```bash
npm run dev
```

Open: **http://localhost:3000**

---

## 🏗️ Architecture

### Component Structure

```
app/
├── components/
│   ├── MoodMeter.tsx           # 🎭 Core feature - AI mood visualization
│   ├── AiRecommendation.tsx    # 🧠 PPO model predictions
│   ├── TradePanel.tsx          # 📊 Execute paper trades
│   └── PortfolioStatus.tsx     # 💼 Portfolio summary
├── contexts/
│   └── WebSocketContext.tsx    # WebSocket connection manager
├── types/
│   └── index.ts                # TypeScript definitions
├── layout.tsx                  # App layout with WebSocketProvider
└── page.tsx                    # Main dashboard
```

### Data Flow

```
Backend WebSocket (/ws/1)
         │
         ├──► WebSocketContext (manages connection)
         │         │
         │         ├──► currentMood → MoodMeter
         │         ├──► currentPrediction → AiRecommendation
         │         └──► currentPortfolio → PortfolioStatus
         │
         └──► Automatic reconnection on disconnect
```

---

## 🎨 Components

### 1. MoodMeter

**Location:** `app/components/MoodMeter.tsx`

**Features:**
- Visual mood representation (emoji + color)
- Mood score gauge (0-100)
- Performance metrics (P&L, win rate, trades)
- Market conditions (volatility, liquidity)
- Human-readable analysis

**Mood States:**
- 😎 Confident (Green)
- 🤔 Cautious (Yellow)
- 😴 Fatigued (Orange)
- 🛡️ Conservative (Blue)
- 📚 Learning (Purple)

**Usage:**
```tsx
import { MoodMeter } from './components/MoodMeter';

<MoodMeter />
```

### 2. AiRecommendation

**Location:** `app/components/AiRecommendation.tsx`

**Features:**
- PPO model action predictions
- Current price display
- Action emoji indicators
- Educational disclaimer
- Auto-refresh every 60 seconds

**Actions:**
- ⏸️ HOLD - Wait for better conditions
- 🟢 BUY - Buying opportunity
- 🔴 SELL - Consider taking profit

**Usage:**
```tsx
import { AiRecommendation } from './components/AiRecommendation';

<AiRecommendation symbol="BTC-USDT" />
```

### 3. TradePanel

**Location:** `app/components/TradePanel.tsx`

**Features:**
- Symbol input
- Quantity input
- Buy/Sell buttons
- Quick action presets
- Success/error notifications

**Usage:**
```tsx
import { TradePanel } from './components/TradePanel';

<TradePanel defaultSymbol="BTC-USDT" />
```

### 4. PortfolioStatus

**Location:** `app/components/PortfolioStatus.tsx`

**Features:**
- Paper trading balance
- Total P&L (absolute + percentage)
- Total trades count
- Win rate
- Performance tips

**Usage:**
```tsx
import { PortfolioStatus } from './components/PortfolioStatus';

<PortfolioStatus />
```

---

## 🔌 WebSocket Context

**Location:** `app/contexts/WebSocketContext.tsx`

### Features

- ✅ Singleton WebSocket connection
- ✅ Automatic reconnection (exponential backoff)
- ✅ Message type routing
- ✅ React Context for data distribution
- ✅ Heartbeat ping (every 30s)

### Usage

```tsx
import { useWebSocket } from './contexts/WebSocketContext';

function MyComponent() {
  const {
    isConnected,
    connectionStatus,
    currentMood,
    currentPrediction,
    currentPortfolio,
    sendMessage,
    reconnect,
  } = useWebSocket();

  // Use real-time data
  return (
    <div>
      {isConnected ? 'Connected' : 'Disconnected'}
      {currentMood && <div>Mood: {currentMood.mood}</div>}
    </div>
  );
}
```

### Connection Status

- `connecting` - Establishing connection
- `connected` - Connected and ready
- `disconnected` - Connection lost
- `error` - Connection error

### Reconnection Logic

- Max 10 attempts
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max 30s)
- Manual reconnect available via `reconnect()` method

---

## 🎨 Styling

### Tailwind CSS

**Configuration:** `tailwind.config.js`

**Custom Colors:**
```js
colors: {
  primary: { 50, 100, 500, 600, 700 },
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
}
```

**Custom Classes:**
```css
.mood-confident    // Green gradient
.mood-cautious     // Yellow gradient
.mood-fatigued     // Orange gradient
.mood-conservative // Blue gradient
.mood-learning     // Purple gradient
```

---

## 🔧 API Integration

### REST API Calls

Using **axios** for API requests:

```tsx
import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Get prediction
const response = await axios.get(`${apiUrl}/api/v1/prediction/predict/BTC-USDT`);

// Execute trade
const response = await axios.post(`${apiUrl}/api/v1/trading/execute`, {
  symbol: 'BTC-USDT',
  side: 'buy',
  quantity: 0.001,
});

// Get portfolio
const response = await axios.get(`${apiUrl}/api/v1/trading/portfolio`);
```

### WebSocket Messages

**Outgoing:**
```json
{
  "type": "ping",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Incoming:**
```json
{
  "type": "mood_update",
  "data": {
    "mood": "confident",
    "mood_score": 75,
    "recent_pnl": 3.45,
    ...
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 🐛 Troubleshooting

### WebSocket Not Connecting

**Problem:** "WebSocket Disconnected" banner

**Causes:**
1. Backend not running
2. Wrong WebSocket URL
3. CORS issues

**Solutions:**
```bash
# Check backend is running
curl http://localhost:8000/

# Check WebSocket endpoint
wscat -c ws://localhost:8000/ws/1

# Verify .env.local
cat .env.local
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### API Calls Failing

**Problem:** "Failed to fetch prediction" or similar errors

**Solutions:**
```bash
# Check backend API
curl http://localhost:8000/api/v1/health/

# Check CORS settings in backend
# backend/app/main.py should have:
CORS_ORIGINS=["http://localhost:3000"]
```

### Components Not Updating

**Problem:** Mood/Prediction not updating in real-time

**Causes:**
1. WebSocket not connected
2. Backend not sending updates
3. Message type mismatch

**Debug:**
```tsx
// Add console logs in WebSocketContext
console.log('[WebSocket] Message received:', message);

// Check browser console for logs
// Should see: [WebSocket] Message received: mood_update
```

---

## 📦 Build & Deploy

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

**Production:**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

**Note:** Use `wss://` (secure WebSocket) in production!

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Environment Variables in Vercel:**
- Add `NEXT_PUBLIC_API_URL`
- Add `NEXT_PUBLIC_WS_URL`

---

## 🎓 Learning Resources

### Next.js
- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

### WebSocket
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Socket.IO Alternative](https://socket.io/)

### Tailwind CSS
- [Tailwind Documentation](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com/)

---

## 🤝 Contributing

Improvements welcome!

**Ideas:**
- Dark mode toggle
- Multiple symbol support
- Trade history table
- Chart integration (TradingView)
- Notification system
- Mobile responsive enhancements

---

## 📝 License

MIT License - See LICENSE file for details

---

**Dashboard is live! 🎨🚀**
