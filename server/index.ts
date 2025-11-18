import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authRoutes } from './routes/auth.js';
import { searchRoutes } from './routes/search.js';
import { historyRoutes } from './routes/history.js';
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
    },
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/history', historyRoutes);

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
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
    });
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

