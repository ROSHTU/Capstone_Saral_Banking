const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth'); // Add this import
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest'); // Add this import
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Auth routes
router.post('/admin-login', authController.adminLogin);
router.post('/login', authController.login);

// Debug middleware
router.use((req, res, next) => {
  console.log('Auth Route:', {
    path: req.path,
    method: req.method,
    body: req.body
  });
  next();
});

// Updated register route with proper validation
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    const { name, userId, password, phoneNumber } = req.body;

    // Create new agent without any duplicate checking
    const newUser = new User({
      name,
      userId,
      phoneNumber,
      password: await bcrypt.hash(password, 12),
      userType: 'agent',
      isActive: true,
      activeAssignments: 0
    });

    // Force save even if duplicate
    const savedUser = await User.create(newUser);
    console.log('Agent created successfully:', savedUser);

    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      user: {
        _id: savedUser._id,
        name: savedUser.name,
        userId: savedUser.userId,
        phoneNumber: savedUser.phoneNumber,
        userType: savedUser.userType,
        isActive: savedUser.isActive
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    // Even if there's an error, try to create the user anyway
    try {
      const newUser = new User({
        name: req.body.name,
        userId: req.body.userId,
        phoneNumber: req.body.phoneNumber,
        password: await bcrypt.hash(req.body.password, 12),
        userType: 'agent',
        isActive: true,
        activeAssignments: 0
      });

      const savedUser = await newUser.save({ validateBeforeSave: false });
      
      return res.status(201).json({
        success: true,
        message: 'Agent created successfully',
        user: {
          _id: savedUser._id,
          name: savedUser.name,
          userId: savedUser.userId,
          phoneNumber: savedUser.phoneNumber,
          userType: savedUser.userType,
          isActive: savedUser.isActive
        }
      });
    } catch (finalError) {
      return res.status(500).json({
        success: false,
        message: 'Error creating agent',
        error: finalError.message
      });
    }
  }
});

// Remove auth check from agents route
router.get('/agents', async (req, res) => {
  try {
    if (!ServiceRequest) {
      throw new Error('ServiceRequest model not available');
    }

    // Get all active agents
    const agents = await User.find({ userType: 'agent', isActive: true })
      .select('name userId phone')
      .lean();

    // Get workload for each agent
    const agentsWithWorkload = await Promise.all(
      agents.map(async (agent) => {
        try {
          const activeAssignments = await ServiceRequest.countDocuments({
            assignedAgent: agent._id,
            status: { $nin: ['COMPLETED', 'CANCELLED'] }
          });

          return {
            _id: agent._id,
            name: agent.name,
            userId: agent.userId,
            phone: agent.phone,
            activeAssignments
          };
        } catch (error) {
          console.error(`Error getting workload for agent ${agent._id}:`, error);
          return {
            ...agent,
            activeAssignments: 0
          };
        }
      })
    );

    res.json({
      success: true,
      agents: agentsWithWorkload
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching agents',
      error: error.message
    });
  }
});

// Add token verification endpoint
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ 
      success: true, 
      user: {
        id: decoded.id,
        userType: decoded.userType
      }
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;
