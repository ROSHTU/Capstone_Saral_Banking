require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const feedbackRoutes = require('./routes/feedback');

const app = express();

// Environment checks
console.log('Environment Check:', {
  nodeEnv: process.env.NODE_ENV,
  jwtSecretLength: process.env.JWT_SECRET?.length || 0,
  jwtSecret: process.env.JWT_SECRET?.substring(0, 10) + '...'
});

console.log('Server starting in:', process.env.NODE_ENV || 'development', 'mode');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 50000 }));

// Updated CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://saralbank.vercel.app', 'https://saralbe.vercel.app']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
};

// Apply CORS middleware first
app.use(cors(corsOptions));

// Add OPTIONS handling for preflight requests
app.options('*', cors(corsOptions));

// Debug middleware
app.use((req, res, next) => {
  console.log('API Request:', {
    method: req.method,
    url: req.originalUrl,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    },
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token or no token provided'
    });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed'
    });
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// CORS error handling
app.use((err, req, res, next) => {
  if (err.message.includes('not allowed by CORS')) {
    console.error('CORS Error:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed',
      origin: req.headers.origin
    });
  }
  next(err);
});

// Add error logging for CORS issues
app.use((req, res, next) => {
  res.on('error', (error) => {
    if (error.message.includes('CORS')) {
      console.error('CORS Error:', {
        origin: req.headers.origin,
        method: req.method,
        path: req.path,
        error: error.message
      });
    }
  });
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

app.use('/api/feedback', feedbackRoutes);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/tickets', require('./routes/tickets'));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running!', documentation: '/api' });
});

// 404 Handler
app.use('*', (req, res) => {
  console.log('404 Not Found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Server startup
const startServer = async () => {
  try {
    await connectDB();
    if (!process.env.VERCEL) {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    }
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
