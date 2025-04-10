const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Only attempt file logging in non-serverless environments
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  // Ensure logs directory exists
  const fs = require('fs');
  try {
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
    
    logger.add(new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }));
    logger.add(new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }));
  } catch (error) {
    console.warn('File logging disabled - using console only:', error.message);
  }
}

module.exports = logger;
