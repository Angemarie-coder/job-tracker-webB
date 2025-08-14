const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://job-tracker-web-f.vercel.app',
        'https://job-tracker-web-k1muubq57-angemarie-coders-projects.vercel.app',
        process.env.FRONTEND_URL
      ].filter(Boolean)
    : 'http://localhost:3000',
  credentials: true
};

console.log('🔒 CORS Configuration:', {
  environment: process.env.NODE_ENV,
  allowedOrigins: corsOptions.origin,
  frontendUrl: process.env.FRONTEND_URL
});

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Add additional CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({
    status: 'OK',
    message: 'Job Tracker API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown'
    },
    cors: {
      allowedOrigins: corsOptions.origin,
      frontendUrl: process.env.FRONTEND_URL
    }
  });
});

// Database status endpoint
app.get('/api/db-status', (req, res) => {
  const dbState = mongoose.connection.readyState;
  let status, message;
  
  switch(dbState) {
    case 0: // disconnected
      status = 'disconnected';
      message = 'Database is disconnected';
      break;
    case 1: // connected
      status = 'connected';
      message = 'Database is connected and ready';
      break;
    case 2: // connecting
      status = 'connecting';
      message = 'Database is connecting...';
      break;
    case 3: // disconnecting
      status = 'disconnecting';
      message = 'Database is disconnecting...';
      break;
    default:
      status = 'unknown';
      message = 'Database state is unknown';
  }
  
  res.status(200).json({
    status: status,
    message: message,
    readyState: dbState,
    host: mongoose.connection.host || 'unknown',
    database: mongoose.connection.name || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS test successful',
    origin: req.headers.origin,
    allowedOrigins: corsOptions.origin,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 CORS allowed origins:`, corsOptions.origin);
  console.log(`🌐 Frontend URL env var: ${process.env.FRONTEND_URL || 'not set'}`);
});

module.exports = app;
