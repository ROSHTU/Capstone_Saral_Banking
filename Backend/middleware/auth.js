const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || '958452e9cd5fc45b53f98fca76c32439a1b0f41a9b0dc420959f3b9b923938f8';

const authMiddleware = async (req, res, next) => {
  try {
    console.log('Auth middleware running...');
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    console.log('Verifying token...');
    const JWT_SECRET = process.env.JWT_SECRET || '958452e9cd5fc45b53f98fca76c32439a1b0f41a9b0dc420959f3b9b923938f8';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('Token decoded:', {
      id: decoded._id || decoded.id,
      userType: decoded.userType
    });

    // Find user by ID - check both potential ID fields
    const userId = decoded._id || decoded.id;
    const user = await User.findById(userId);

    if (!user) {
      console.log('User not found with ID:', userId);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User authenticated:', {
      id: user._id,
      userType: user.userType,
      userId: user.userId
    });
    
    // Attach complete user object to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid authentication',
      error: error.message
    });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    console.log('Admin auth check - headers:', req.headers);
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);

    const user = await User.findById(decoded.id);
    console.log('Found user:', user);

    if (user && decoded.userType === 'admin') {
      req.user = user;
      next();
    } else {
      console.log('Access denied - User:', user);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      details: error.message
    });
  }
};

// Middleware for checking agent access
const agentAuth = (req, res, next) => {
  if (req.userType !== 'agent' && req.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Agent privileges required.'
    });
  }
  next();
};

// Add new soft authentication middleware
const softAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
          req.userType = user.userType;
        }
      } catch (jwtError) {
        console.log('Token verification failed, continuing without auth');
      }
    }
    
    // Always continue to next middleware, even without authentication
    next();
  } catch (error) {
    console.error('Soft auth error:', error);
    // Continue anyway
    next();
  }
};

const auth = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token, access denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Token is not valid' 
    });
  }
};

module.exports = { 
  authMiddleware, 
  adminAuth, 
  agentAuth,
  softAuth,
  auth
};
