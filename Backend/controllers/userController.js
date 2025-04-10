const User = require('../models/User'); // Fix: Remove Customer model import
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');  // Add mongoose import
const logger = require('../utils/logger');  // Add logger import
const jwt = require('jsonwebtoken'); // Add this import

// Export all functions using the same pattern
const registerCustomer = async (req, res) => {
  try {
    const { userType } = req.body;
    
    // Special handling for agent registration
    if (userType === 'agent') {
      const { name, userId, password, phoneNumber } = req.body;
      
      // Validate required fields for agent
      if (!name || !userId || !password || !phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields for agent registration'
        });
      }

      const newAgent = new User({
        name,
        userId,
        email: userId, // Use userId as email
        phone: phoneNumber, // Store phoneNumber in phone field
        password,
        userType: 'agent',
        isActive: true,
        // Remove PAN and Aadhaar for agents
        firstName: name.split(' ')[0] || 'Agent',
        lastName: name.split(' ').slice(1).join(' ') || name
      });

      const agent = await newAgent.save();
      
      return res.status(201).json({
        success: true,
        message: 'Agent registered successfully',
        user: agent
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      aadhaar,
      pan,
      address,
      photoUrl
    } = req.body;

    // Enhanced photo URL validation
    if (photoUrl) {
      if (!photoUrl.startsWith('data:image/') && !photoUrl.startsWith('http')) {
        return res.status(400).json({ 
          message: 'Invalid photo format. Please provide a valid image.' 
        });
      }

      // If it's a data URL, validate base64 format
      if (photoUrl.startsWith('data:image/')) {
        const [header, base64] = photoUrl.split(',');
        if (!header.includes('base64') || !base64) {
          return res.status(400).json({ 
            message: 'Invalid image data format.' 
          });
        }
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Use User model instead of Customer
    const newUser = await User.create({
      ...req.body,
      userType: 'customer',
      kycStatus: 'pending'
    });

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      userType: user.userType,
      email: user.email 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

const login = async (req, res) => {
  try {
    const { email, password, pan } = req.body;
    let user;
    
    if (pan) {
      user = await User.findOne({ pan: pan.toUpperCase() });
    } else {
      user = await User.findOne({ email });
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const isValid = user.phone === password || 
                   await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate token with proper id field and additional security
    const token = jwt.sign(
      { 
        _id: user._id,  // Make sure to use _id not id
        userType: user.userType,
        email: user.email,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { 
        expiresIn: '24h',
        algorithm: 'HS256'
      }
    );

    // Set token in response header as well
    res.header('Authorization', `Bearer ${token}`);
    res.header('x-auth-token', token);

    // Remove sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      data: {
        token,
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed. Please try again.' 
    });
  }
};

const verifyPan = async (req, res) => {
  try {
    const { pan } = req.body;

    // Remove hardcoded CORS headers - they're now handled by the cors middleware
    if (!pan) {
      return res.status(400).json({
        success: false,
        message: 'PAN number is required'
      });
    }
    
    console.log('Verifying PAN:', pan.toUpperCase());
    const user = await User.findOne({ pan: pan.toUpperCase() });
    
    if (user) {
      const maskedPhone = user.phone.slice(-4);
      return res.json({
        success: true,
        phone: maskedPhone,
        user: {
          email: user.email,
          phone: user.phone
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: 'No account found with this PAN number. Please check and try again.',
      isNewUser: false
    });
  } catch (error) {
    console.error('PAN verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying PAN. Please try again later.'
    });
  }
};

// Modified getMe function with improved token handling
const getMe = async (req, res) => {
  try {
    const token = req.header('Authorization')?.split(' ')[1];
    
    console.log('GetMe token debug:', { 
      hasToken: !!token,
      tokenStart: token?.substring(0, 20)
    });

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your-secret-key'
      );

      const user = await User.findById(decoded._id)
        .select('-password')
        .lean();

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Send back user data with same token
      res.json({
        success: true,
        user: {
          ...user,
          token // Include original token
        }
      });
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, phone, address } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify user has permission to update this profile
    if (req.user.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    // Check if email or phone is already taken by another user
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: userId } },
        { $or: [{ email }, { phone }] }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Email or phone number already in use'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, email, phone, address },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: error.message });
  }
};

const logout = async (req, res) => {
  try {
    // Simple logout - client will handle token removal
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
};

// Export all functions together
module.exports = {
  registerCustomer,
  login,
  verifyPan,
  getMe, // Now this will work
  updateUser,
  logout
};
