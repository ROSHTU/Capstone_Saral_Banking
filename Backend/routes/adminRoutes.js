const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { resyncAllServices } = require('../utils/serviceStatusSync');

// Add resync endpoint for admin use
router.post('/resync-services', adminAuth, async (req, res) => {
  try {
    const updatedCount = await resyncAllServices();
    
    if (updatedCount >= 0) {
      res.json({
        success: true,
        message: `Successfully resynced ${updatedCount} service assignments`,
        count: updatedCount
      });
    } else {
      throw new Error('Resync operation failed');
    }
  } catch (error) {
    console.error('Error in service resync:', error);
    res.status(500).json({
      success: false,
      message: 'Error resyncing services',
      error: error.message
    });
  }
});

module.exports = router;