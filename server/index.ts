import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authRoutes } from './routes/auth.js';
import { searchRoutes } from './routes/search.js';
import { historyRoutes } from './routes/history.js';
import { appointmentRoutes } from './routes/appointments.js';
import { insuranceRoutes } from './routes/insurance.js';
import { reviewsRoutes } from './routes/reviews.js';
import { analyticsRoutes } from './routes/analytics.js';
import { monetizationRoutes } from './routes/monetization.js';
import { securityHeaders, rateLimit } from './middleware/security.js';
import { initDatabase } from './db/index.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
// Default port for local development
const DEFAULT_PORT = 3001;
const PORT = process.env.PORT || DEFAULT_PORT;

// Configure CORS to allow multiple origins
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://yodoc.netlify.app',
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

// Merge default origins with environment origins, removing duplicates
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

// Log allowed origins on startup
console.log('🌐 CORS Configuration:');
console.log('   Allowed origins:', allowedOrigins);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('⚠️  CORS: Request with no origin - allowing');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow all origins
      console.log(`✅ CORS: Development mode - allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked origin: ${origin}`);
      console.warn(`   Allowed origins:`, allowedOrigins);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Security middleware
app.use(securityHeaders);

// Rate limiting
app.use('/api/', rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
app.use('/api/search/', rateLimit(20, 60 * 1000)); // 20 searches per minute
app.use('/api/appointments/', rateLimit(10, 60 * 1000)); // 10 bookings per minute

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'AI Physician Search API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: {
        signup: 'POST /api/auth/signup',
        signin: 'POST /api/auth/signin',
        me: 'GET /api/auth/me',
      },
      search: {
        physicians: 'POST /api/search/physicians',
      },
      history: {
        list: 'GET /api/history',
        delete: 'DELETE /api/history/:id',
        clear: 'DELETE /api/history',
      },
      appointments: {
        availability: 'POST /api/appointments/availability',
        book: 'POST /api/appointments/book',
      },
      insurance: {
        verify: 'POST /api/insurance/verify',
        plans: 'GET /api/insurance/plans',
      },
      reviews: {
        list: 'GET /api/reviews/:doctorNpi',
        create: 'POST /api/reviews',
      },
      analytics: {
        metrics: 'GET /api/analytics/metrics?timeRange=7d|30d|90d',
      },
      monetization: {
        subscription: 'GET /api/monetization/subscription',
        upgrade: 'POST /api/monetization/subscription/upgrade',
        referral: {
          generate: 'POST /api/monetization/referral/generate',
          apply: 'POST /api/monetization/referral/apply',
          stats: 'GET /api/monetization/referral/stats',
        },
        practice: 'GET /api/monetization/practice/features',
        enterprise: 'POST /api/monetization/enterprise/inquiry',
      },
    },
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/monetization', monetizationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔄 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized');
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown handler for Railway and other platforms
    const gracefulShutdown = (signal: string) => {
      console.log(`\n📛 Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        console.log('👋 Goodbye!');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

startServer();

