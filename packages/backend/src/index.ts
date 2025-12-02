import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { tournamentRouter } from './routes/tournament';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/tournament', tournamentRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    source: 'backend'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  Commentary Dashboard BFF Server                      ║
╠═══════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}           ║
║  Environment: ${process.env.NODE_ENV || 'development'}                          ║
║  Redis: ${process.env.REDIS_URL ? 'Enabled' : 'In-memory cache'}                     ║
╚═══════════════════════════════════════════════════════╝

Available endpoints:
  GET  /health                           - Health check
  GET  /api/tournament/:slug             - Get tournament (cached)
  GET  /api/tournament/:slug?refresh=true - Get tournament (bypass cache)
  POST /api/tournament/:slug/refresh     - Bust cache & refresh
  GET  /api/tournament/:slug/cache-status - Check cache status
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
