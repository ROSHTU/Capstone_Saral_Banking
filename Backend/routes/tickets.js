const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth, softAuth } = require('../middleware/auth');
const jwt = require('jsonwebtoken'); // Add this import
const Ticket = require('../models/Ticket');

// Debug middleware with enhanced logging
router.use((req, res, next) => {
  console.log('Ticket Route Debug:', {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    params: req.params,
    query: req.query
  });
  next();
});

// IMPORTANT: Route order matters! More specific routes first
// Get tickets by user ID - Allow access even without auth
router.get('/user/:userId', softAuth, async (req, res) => {
  try {
    console.log('Finding tickets for userId:', req.params.userId);
    
    const tickets = await Ticket.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .lean();

    console.log(`Found ${tickets.length} tickets for user ${req.params.userId}`);
    
    res.json({
      success: true,
      tickets,
      authenticated: !!req.user
    });
  } catch (error) {
    console.error('Error in /user/:userId route:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user tickets',
      error: error.message
    });
  }
});

// Get all tickets (admin only)
router.get('/', authMiddleware, adminAuth, async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .lean();

    res.json({
      success: true,
      tickets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message
    });
  }
});

// Modify Create ticket route to be more permissive
router.post('/', async (req, res) => {
  try {
    let userId = null;
    let userName = 'Anonymous';
    let userEmail = 'anonymous@example.com';
    let userPhone = 'Not provided';

    // Try to get user info from token if present
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded._id || decoded.id);
        if (user) {
          userId = user._id;
          userName = `${user.firstName} ${user.lastName}`;
          userEmail = user.email;
          userPhone = user.phone;
        }
      } catch (tokenError) {
        console.log('Token verification failed, continuing with provided data');
      }
    }

    // Use provided data or fallback to token data
    const ticketData = {
      userId: req.body.userId || userId,
      userName: req.body.userName || userName,
      email: req.body.email || userEmail,
      contactNo: req.body.contactNo || userPhone,
      message: req.body.message,
      type: req.body.type,
      status: 'open',
      priority: req.body.priority || 'medium',
      metadata: req.body.metadata || {},
      createdAt: new Date()
    };

    const ticket = await Ticket.create(ticketData);
    
    res.status(201).json({
      success: true,
      ticket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating ticket'
    });
  }
});

// Get ticket by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('userId', 'name email')
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      ticket
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket',
      error: error.message
    });
  }
});

// Update ticket status (admin only)
router.patch('/:id/status', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'name email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      ticket
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating ticket status',
      error: error.message
    });
  }
});

// Delete ticket (admin only)
router.delete('/:id', authMiddleware, adminAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting ticket',
      error: error.message
    });
  }
});

module.exports = router;
