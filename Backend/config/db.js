const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async (retries = 5) => {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
  
  try {
    if (!mongoURI) {
      logger.error('MongoDB URI not found');
      throw new Error('MongoDB URI is not defined');
    }

    // Simplified connection options for Vercel
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      maxPoolSize: 10,
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
      directConnection: false
    };

    logger.info({
      message: `MongoDB connection attempt ${6 - retries} of 5`,
      environment: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      host: mongoURI.split('@')[1]?.split('/')[0]
    });

    const conn = await mongoose.connect(mongoURI, options);

    logger.info({
      message: 'MongoDB Connected',
      host: conn.connection.host,
      database: conn.connection.name,
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    const isTimeoutError = error.message.includes('Server selection timed out');
    const isAuthError = error.message.includes('Authentication failed');

    logger.error({
      message: 'MongoDB connection failed',
      errorType: isTimeoutError ? 'TIMEOUT' : isAuthError ? 'AUTH' : 'UNKNOWN',
      error: error.message,
      environment: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    });

    if (retries > 0) {
      const delay = Math.min((6 - retries) * 5000, 15000);
      logger.info(`Retrying in ${delay/1000}s... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retries - 1);
    }

    throw new Error(`Failed to connect to MongoDB after 5 attempts: ${error.message}`);
  }
};

module.exports = connectDB;
