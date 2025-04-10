const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: function() {
      return this.userType !== 'agent';
    },
    trim: true
  },
  lastName: {
    type: String,
    required: function() {
      return this.userType !== 'agent';
    },
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
    // Removed unique: true from here
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['admin', 'agent', 'customer'],
    required: true
  },
  address: String,
  photoUrl: String,
  kycStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  pan: {
    type: String,
    uppercase: true,
    required: function() {
      return this.userType === 'customer'; // Only required for customers
    },
    sparse: true
  },
  aadhaar: {
    type: String,
    required: function() {
      return this.userType === 'customer'; // Only required for customers
    },
    validate: {
      validator: function(v) {
        // Skip validation for non-customers
        if (this.userType !== 'customer') return true;
        return v.length === 12;
      },
      message: 'Aadhaar must be exactly 12 digits'
    },
    sparse: true
  },
  name: {
    type: String,
    required: function() {
      return this.userType === 'agent';
    }
  },
  userId: {
    type: String,
    required: function() {
      return this.userType === 'agent';
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },

  // Add assignments tracking for agents
  assignments: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest'
    },
    assignedAt: Date,
    status: {
      type: String,
      enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'ASSIGNED'
    },
    serviceType: String,
    customerPhone: String
  }],

  activeAssignments: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  collection: 'users' // Explicitly set collection name
});

// Define all indexes in one place - no duplicates
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ pan: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
userSchema.index({ aadhaar: 1 }, { unique: true, sparse: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});

// Add a method to get user profile
userSchema.methods.getProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Add password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Add method to update assignments
userSchema.methods.addAssignment = function(serviceId, serviceType, customerPhone) {
  if (!this.assignments) {
    this.assignments = [];
  }
  
  this.assignments.push({
    serviceId,
    assignedAt: new Date(),
    status: 'ASSIGNED',
    serviceType,
    customerPhone
  });
  
  this.activeAssignments = this.assignments.filter(
    a => !['COMPLETED', 'CANCELLED'].includes(a.status)
  ).length;
  
  return this.save();
};

// Add the completeAssignment method to the schema
userSchema.methods.completeAssignment = async function(serviceId) {
  try {
    console.log(`Completing assignment ${serviceId} for user ${this.name || this.userId}`);
    
    if (!this.assignments) {
      this.assignments = [];
    }
    
    // Find the assignment index
    const assignmentIndex = this.assignments.findIndex(assignment => 
      assignment.serviceId && assignment.serviceId.toString() === serviceId.toString()
    );
    
    if (assignmentIndex === -1) {
      console.log(`Assignment ${serviceId} not found for user ${this.userId}`);
      return false;
    }
    
    // Update assignment status
    this.assignments[assignmentIndex].status = 'COMPLETED';
    this.assignments[assignmentIndex].completedAt = new Date();
    
    // Decrement active assignments count
    if (this.activeAssignments && this.activeAssignments > 0) {
      this.activeAssignments -= 1;
    }
    
    // Increment completed assignments count if it exists
    if (typeof this.completedAssignments === 'number') {
      this.completedAssignments += 1;
    } else {
      this.completedAssignments = 1;
    }
    
    await this.save();
    console.log(`Assignment ${serviceId} completed successfully for user ${this.userId}`);
    return true;
  } catch (error) {
    console.error(`Error completing assignment for user ${this.userId}:`, error);
    throw error;
  }
};

const User = mongoose.model('User', userSchema, 'users');

module.exports = User;
