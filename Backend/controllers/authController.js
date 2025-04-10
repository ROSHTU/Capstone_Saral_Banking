const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Fallback secret for development
const FALLBACK_SECRET = 'temporary_development_secret_key_123';

exports.adminLogin = async (req, res) => {
  try {
    const { userId, password } = req.body;
    console.log('Admin login attempt:', { userId });

    const user = await User.findOne({ 
      userId, 
      userType: 'admin',
      isActive: true 
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || '958452e9cd5fc45b53f98fca76c32439a1b0f41a9b0dc420959f3b9b923938f8';
    console.log('Using JWT Secret:', JWT_SECRET);

    const token = jwt.sign(
      { 
        id: user._id,
        userType: 'admin',
        userId: user.userId,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Generated token:', token);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        userType: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      details: error.message
    });
  }
};

// Regular login method for all users
exports.login = async (req, res) => {
  try {
    const { userId, password } = req.body;
    
    const user = await User.findOne({ userId, isActive: true })
      .select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Enhanced token with more user information
    const token = jwt.sign(
      { 
        id: user._id,
        userType: user.userType,
        userId: user.userId,
        permissions: user.userType === 'admin' ? ['all'] : 
                    user.userType === 'agent' ? ['read', 'update'] : 
                    ['read']
      },
      process.env.JWT_SECRET || FALLBACK_SECRET,
      { expiresIn: '24h' }
    );

    // Set token in response header
    res.header('Authorization', `Bearer ${token}`);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        userType: user.userType,
        permissions: user.userType === 'admin' ? ['all'] : 
                    user.userType === 'agent' ? ['read', 'update'] : 
                    ['read']
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login'
    });
  }
};
