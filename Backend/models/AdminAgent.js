const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminAgentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true
  },
  userType: {
    type: String,
    enum: ['admin', 'agent'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Hash password before saving
adminAgentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to check password
adminAgentSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const AdminAgent = mongoose.model('AdminAgent', adminAgentSchema);

module.exports = AdminAgent;
