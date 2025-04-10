const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Change to required
  },
  userName: {
    type: String,
    required: true
  },
  contactNo: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['general', 'technical', 'billing', 'service']
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Add pre-save middleware to ensure user exists
ticketSchema.pre('save', async function(next) {
  if (!this.userId) {
    throw new Error('User ID is required');
  }
  
  const User = mongoose.model('User');
  const user = await User.findById(this.userId);
  
  if (!user) {
    throw new Error('Invalid user ID');
  }
  
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
