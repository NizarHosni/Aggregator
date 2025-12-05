import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { searchRoutes } from './routes/search.js';
import { appointmentRoutes } from './routes/appointments.js';
import { insuranceRoutes } from './routes/insurance.js';
import { reviewsRoutes } from './routes/reviews.js';
import { authRoutes } from './routes/auth.js';
import { historyRoutes } from './routes/history.js';
import { favoritesRoutes } from './routes/favorites.js';
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

// Log rate limit configuration
const isDev = process.env.NODE_ENV === 'development';
console.log('🚦 Rate Limiting:');
console.log(`   General API: ${isDev ? '10,000' : '200'} requests per 15 minutes`);
console.log(`   Search API: ${isDev ? '1,000' : '50'} requests per minute`);
console.log(`   Appointments: ${isDev ? '500' : '20'} requests per minute`);

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
app.use(cookieParser());

// Security middleware
app.use(securityHeaders);

// Rate limiting - very generous for development, adjust for production
const isDevelopment = process.env.NODE_ENV === 'development';
app.use('/api/', rateLimit(isDevelopment ? 10000 : 200, 15 * 60 * 1000)); // Dev: 10k per 15min, Prod: 200 per 15min
app.use('/api/search/', rateLimit(isDevelopment ? 1000 : 50, 60 * 1000)); // Dev: 1000/min, Prod: 50/min
app.use('/api/appointments/', rateLimit(isDevelopment ? 500 : 20, 60 * 1000)); // Dev: 500/min, Prod: 20/min

// Root endpoint - redirect to API info
app.get('/', (req, res) => {
  res.json({
    message: 'YoDoc Healthcare Search API',
    version: '2.0.0',
    status: 'online',
    documentation: '/api',
    health: '/api/health',
    endpoints: {
      health: '/api/health',
      search: {
        physicians: 'POST /api/search/physicians',
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
    },
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'YoDoc Healthcare Search API - Core Search Only',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      search: {
        physicians: 'POST /api/search/physicians',
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
    },
  });
});

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/favorites', favoritesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting YoDoc Healthcare Search API...');
    console.log('📦 Version: 3.0.0 - With Stack Auth');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
      console.log('');
      console.log('🔍 Features:');
      console.log('   - Physician Search (GPT-4 + NPPES + Google Places)');
      console.log('   - Appointment Booking');
      console.log('   - Insurance Verification');
      console.log('   - Reviews & Ratings');
      console.log('   - Stack Auth Authentication');
      console.log('   - Database-synced History & Favorites');
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
