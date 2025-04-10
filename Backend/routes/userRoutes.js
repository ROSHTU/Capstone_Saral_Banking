const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth } = require('../middleware/auth');
const User = require('../models/User');
const userController = require('../controllers/userController'); // Add this import

// Debug middleware
router.use((req, res, next) => {
  console.log('User Route:', req.path);
  next();
});

// Order matters! Place specific routes before parametric routes
router.get('/me', userController.getMe);  // Move /me before /:id
router.post('/verify-pan', userController.verifyPan);
router.post('/register', userController.registerCustomer);
router.post('/login', userController.login);
router.post('/logout', userController.logout);

// Get users with filter
router.get('/', adminAuth, async (req, res) => {
  try {
    const { userType } = req.query;
    const query = userType ? { userType } : {};

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// Get user by ID
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// Delete user (admin only)
router.delete('/:userId', authMiddleware, adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// Update user (admin only)
router.put('/:userId', authMiddleware, adminAuth, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Don't allow password updates through this route

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
});

module.exports = router;
