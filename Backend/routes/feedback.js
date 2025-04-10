const express = require('express');
const router = express.Router();
const Feedback = require('../models/sentiment');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('Processing feedback submission:', {
      body: req.body,
      user: req.user?._id
    });

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Create feedback with verified user data
    const feedbackData = {
      ...req.body,
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userPhone: req.user.phone
    };

    const feedback = await Feedback.create(feedbackData);
    
    console.log('Feedback saved:', feedback._id);

    res.status(201).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
});

module.exports = router;
