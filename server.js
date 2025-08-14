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
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL
    : 'http://localhost:3000',
  credentials: true
}));

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
});

module.exports = app;
