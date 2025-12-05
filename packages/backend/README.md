# Commentary Dashboard - Backend (BFF)

Backend-for-Frontend (BFF) server with smart caching for the Commentary Dashboard.

## Features

- ✅ **Smart Caching** with dynamic TTL based on match states
- ✅ **Manual Cache Busting** via API endpoints
- ✅ **Interface-Based Cache System** with Redis + In-Memory fallback
- ✅ **Automatic Failover** - continues working if Redis fails
- ✅ **Rate Limit Management** for start.gg API
- ✅ **CORS** enabled for frontend integration

## Setup

### 1. Install Dependencies

From the monorepo root:
```bash
pnpm install
```

Or from this directory:
```bash
pnpm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```env
STARTGG_API_TOKEN=your_token_here  # Required
REDIS_URL=redis://localhost:6379   # Optional (uses in-memory cache if not set)
PORT=3001                           # Optional (default: 3001)
CORS_ORIGIN=http://localhost:5173  # Your frontend URL
```

### 3. Run the Server

Development mode (with auto-reload):
```bash
pnpm dev
```

Production mode:
```bash
pnpm build
pnpm start
```

## API Endpoints

### Get Tournament (Cached)
```
GET /api/tournament/:slug
```

Query parameters:
- `refresh=true` - Bypass cache and fetch fresh data

Response:
```json
{
  "data": { ...tournament data... },
  "cached": true,
  "metadata": {
    "cachedAt": 1234567890,
    "ttl": 15,
    "hasOngoingMatches": true,
    "hasRecentMatches": false,
    "counts": {
      "ongoing": 2,
      "recentlyCompleted": 0,
      "pending": 5,
      "oldCompleted": 10
    }
  }
}
```

### Refresh Tournament (Bust Cache)
```
POST /api/tournament/:slug/refresh
```

Explicitly busts cache and fetches fresh data.

### Check Cache Status
```
GET /api/tournament/:slug/cache-status
```

Response:
```json
{
  "cached": true,
  "metadata": {
    "key": "tournament:manila-madness-4",
    "ttl": 120,
    "createdAt": 1234567890,
    "expiresAt": 1234568010
  }
}
```

### Health Check
```
GET /health
```

## Smart Caching Strategy

The backend uses dynamic TTL based on tournament state:

| State | TTL | Reason |
|-------|-----|--------|
| **Live matches** (in_progress) | 15s | Needs frequent updates |
| **Recently completed** (<5 min) | 2min | Scores might still update |
| **Pending/old matches** | 10min | Low change rate |
| **Completed tournament** | 30min | Very low change rate |

This ensures:
- Live tournaments get fresh data frequently
- Completed tournaments don't waste API calls
- Optimal balance between freshness and API rate limits

## Redis Setup (Optional)

### Using Docker
```bash
docker run -d -p 6379:6379 redis:alpine
```

### Using Homebrew (macOS)
```bash
brew install redis
brew services start redis
```

If Redis is not available, the server automatically falls back to in-memory caching.

## Deployment

### Railway
```bash
# Install Railway CLI
pnpm add -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Set environment variables in Railway dashboard:
- `STARTGG_API_TOKEN`
- `REDIS_URL` (use Railway's Redis addon)

### Render
1. Connect your GitHub repo
2. Select `packages/backend` as root directory
3. Build command: `pnpm install && pnpm build`
4. Start command: `pnpm start`
5. Add environment variables in dashboard

### Vercel
```bash
vercel --cwd packages/backend
```

Note: You'll need to adapt the Express server for Vercel's serverless format.

## Development

### Project Structure
```
src/
├── index.ts           # Express server entry point
├── cache/             # Cache system (interface-based)
│   ├── ICacheService.ts          # Cache interface
│   ├── RedisCacheService.ts      # Redis implementation
│   ├── InMemoryCacheService.ts   # In-memory implementation
│   ├── FallbackCacheService.ts   # Fallback orchestrator
│   ├── factory.ts                # Factory for creating caches
│   ├── index.ts                  # Exports
│   ├── example.ts                # Usage examples
│   └── README.md                 # Cache documentation
├── startgg.ts         # start.gg API client
├── routes/
│   └── tournament.ts  # Tournament API routes
└── utils/
    └── ttl-calculator.ts  # Dynamic TTL logic
```

### Cache System

See [src/cache/README.md](./src/cache/README.md) for detailed cache architecture documentation.

**Run cache examples:**
```bash
pnpm exec tsx src/cache/example.ts
# or
npx tsx src/cache/example.ts
```

### Testing Cache Behavior

```bash
# First request (cache miss)
curl http://localhost:3001/api/tournament/manila-madness-4

# Second request (cache hit)
curl http://localhost:3001/api/tournament/manila-madness-4

# Force refresh
curl http://localhost:3001/api/tournament/manila-madness-4?refresh=true

# Bust cache
curl -X POST http://localhost:3001/api/tournament/manila-madness-4/refresh

# Check cache status
curl http://localhost:3001/api/tournament/manila-madness-4/cache-status
```

## Monitoring

The server logs all cache hits/misses and TTL decisions:

```
[CACHE HIT] manila-madness-4
[CACHE MISS] manila-madness-4 (refresh: false)
[TTL] manila-madness-4 -> 15s (ongoing: 2, recent: 0)
[CACHE BUST] manila-madness-4
```

## Troubleshooting

### "STARTGG_API_TOKEN environment variable is required"
Make sure you've created `.env` file with your token.

### "Redis connection failed"
Check if Redis is running: `redis-cli ping`
The server will fall back to in-memory cache automatically.

### CORS errors
Update `CORS_ORIGIN` in `.env` to match your frontend URL.
