const mongoose = require('mongoose');

const serviceTrackingSchema = new mongoose.Schema({
  serviceRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true
  },
  
  status: {
    type: String,
    required: true
  },

  location: {
    type: String,
    required: true
  },

  timestamp: {
    type: Date,
    default: Date.now
  },

  notes: String,

  updatedBy: {
    type: String,
    required: true
  }
});

const ServiceTracking = mongoose.model('ServiceTracking', serviceTrackingSchema);

module.exports = ServiceTracking;
