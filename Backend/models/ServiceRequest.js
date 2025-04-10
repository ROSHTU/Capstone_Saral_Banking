const mongoose = require('mongoose');
const { ServiceStatus, ServiceProgress, ServiceType } = require('./enums');

const serviceRequestSchema = new mongoose.Schema({
  // Common fields across all services
  serviceType: {
    type: String,
    required: true
  },
  
  userPhone: {
    type: String,
    required: true,
    index: true
  },

  // Optional: Add a reference to user if needed
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  status: {
    type: String,
    enum: ['APPROVAL_PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'],
    default: 'APPROVAL_PENDING'
  },

  progress: {
    type: String,
    enum: Object.values(ServiceProgress),
    default: ServiceProgress.PENDING
  },

  // Scheduling details
  date: {
    type: Date,
    required: true
  },

  timeSlot: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Time slot is required'
    }
  },

  // Bank details
  bankAccount: {
    type: String,
    default: 'N/A',
    required: false  // Changed to false - no longer required for any service
  },

  bankName: String,
  ifscCode: String,

  // Address
  address: {
    type: String,
    required: true
  },

  // Service specific fields
  amount: {
    type: Number,
    default: 0
  },

  // For document service
  documentType: {
    type: String,
    required: function() {
      return ['DOCUMENT_COLLECTION', 'DOCUMENT_DELIVERY'].includes(this.serviceType);
    },
    default: function() {
      return ['DOCUMENT_COLLECTION', 'DOCUMENT_DELIVERY'].includes(this.serviceType) ? undefined : 'N/A';
    }
  },

  // For online assistance
  assistanceMode: {
    type: String,
    required: function() {
      return this.serviceType === ServiceType.ONLINE_ASSISTANCE;
    }
  },

  // For life certificate
  pensionAccountNo: {
    type: String,
    default: 'N/A',
    required: function() {
      return this.serviceType === ServiceType.LIFE_CERTIFICATE;
    }
  },

  // For new account
  accountType: {
    type: String,
    required: function() {
      return this.serviceType === ServiceType.NEW_ACCOUNT;
    }
  },

  // For new account specific fields
  bankId: {
    type: String,
    required: function() {
      return this.serviceType === 'NEW_ACCOUNT';
    }
  },

  // Admin approval tracking
  approvedBy: {
    adminId: String,
    name: String,
    timestamp: Date
  },

  // Enhanced agent assignment tracking
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  assignmentDetails: {
    assignedAt: Date,
    assignedBy: {
      id: String,
      name: String,
      role: String
    },
    agentInfo: {
      name: String,
      phone: String,
      userId: String
    },
    status: {
      type: String,
      enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    }
  },

  timestamps: {
    created: {
      type: Date,
      default: Date.now
    },
    approved: Date,
    agentAssigned: Date,
    completed: Date
  },

  // Additional tracking information
  statusHistory: [{
    status: String,
    timestamp: Date,
    updatedBy: {
      id: String,
      name: String,
      role: String  // 'ADMIN' or 'AGENT'
    },
    notes: String
  }],

  notes: String,
  description: String,
  attachments: [String]
}, {
  timestamps: true, // This adds createdAt and updatedAt automatically
  strict: false // Allow additional fields
});

// Indexes for efficient querying
serviceRequestSchema.index({ userPhone: 1, serviceType: 1 });
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ progress: 1 });
serviceRequestSchema.index({ 'timestamps.created': 1 });

// Add a compound index for better query performance
serviceRequestSchema.index({ userPhone: 1, createdAt: -1 });

// Enhanced updateStatus method
serviceRequestSchema.methods.updateStatus = function(newStatus, updatedBy, notes) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: {
      id: updatedBy.id,
      name: updatedBy.name,
      role: updatedBy.role
    },
    notes
  });

  // Update relevant timestamp and admin/agent info
  if (newStatus === ServiceStatus.APPROVED) {
    this.timestamps.approved = new Date();
    this.approvedBy = {
      adminId: updatedBy.id,
      name: updatedBy.name,
      timestamp: new Date()
    };
  } else if (newStatus === ServiceStatus.AGENT_ASSIGNED && updatedBy.role === 'ADMIN') {
    this.timestamps.agentAssigned = new Date();
    if (this.assignedAgent) {
      this.assignedAgent.assignedBy = {
        adminId: updatedBy.id,
        name: updatedBy.name
      };
    }
  }
};

// Add method to safely update status
serviceRequestSchema.methods.updateServiceStatus = async function(status, adminName) {
  if (!['APPROVAL_PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  
  this.status = status;
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.push({
    status,
    timestamp: new Date(),
    updatedBy: {
      name: adminName,
      role: 'ADMIN'
    },
    notes: `Status updated to ${status} by admin`
  });

  // Update assignment details if status is ASSIGNED
  if (status === 'ASSIGNED' && this.assignmentDetails) {
    this.assignmentDetails.status = 'ASSIGNED';
  }

  return this.save();
};

// Add method to get agent's current workload
serviceRequestSchema.statics.getAgentWorkload = async function(agentId) {
  return this.find({
    assignedAgent: agentId,
    'assignmentDetails.status': { $ne: 'COMPLETED' }
  }).count();
};

// Middleware to ensure phone number consistency
serviceRequestSchema.pre('save', async function(next) {
  if (this.isModified('userPhone')) {
    // Normalize phone number format if needed
    this.userPhone = this.userPhone.replace(/\D/g, '');
  }

  // Set default values for potentially undefined fields
  if (!this.bankAccount) this.bankAccount = 'N/A';
  if (!this.bankName) this.bankName = 'N/A';
  if (!this.ifscCode) this.ifscCode = 'N/A';
  if (!this.documentType && ['DOCUMENT_COLLECTION', 'DOCUMENT_DELIVERY'].includes(this.serviceType)) {
    this.documentType = 'N/A';
  }
  if (!this.assistanceMode && this.serviceType === 'ONLINE_ASSISTANCE') {
    this.assistanceMode = 'N/A';
  }
  if (!this.pensionAccountNo && this.serviceType === 'LIFE_CERTIFICATE') {
    this.pensionAccountNo = 'N/A';
  }

  this.updatedAt = new Date();
  next();
});

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);

module.exports = ServiceRequest;

