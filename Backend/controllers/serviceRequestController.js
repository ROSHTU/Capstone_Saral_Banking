const ServiceRequest = require('../models/ServiceRequest');
const { ServiceType } = require('../models/enums');

// Debug check
console.log('ServiceRequest model in controller:', !!ServiceRequest);

const createServiceRequest = async (req, res) => {
  try {
    const { serviceType, phone, date, timeSlot, address, pensionAccountNo, ...otherData } = req.body;

    // Validate required fields
    if (!serviceType || !phone || !date || !timeSlot || !address) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Special validation for life certificate
    if (serviceType === 'LIFE_CERTIFICATE' && !pensionAccountNo) {
      return res.status(400).json({
        success: false,
        message: 'Pension Account Number is required for Life Certificate service'
      });
    }

    // Create service request with all fields at root level
    const serviceRequest = new ServiceRequest({
      serviceType,
      userPhone: phone,
      date,
      timeSlot,
      address,
      pensionAccountNo,  // Include pension account number
      bankAccount: pensionAccountNo || otherData.bankAccount || 'N/A',
      status: 'APPROVAL_PENDING',
      ...otherData
    });

    await serviceRequest.save();
    res.status(201).json({ success: true, data: serviceRequest });

  } catch (error) {
    console.error('Service Request Creation Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create service request'
    });
  }
};

const trackService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userPhone = req.user.phone;

    const service = await ServiceRequest.findOne({
      _id: serviceId,
      userPhone
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    // Filter out sensitive information
    const filteredService = {
      id: service._id,
      serviceType: service.serviceType,
      status: service.status,
      progress: service.progress,
      date: service.date,
      timeSlot: service.timeSlot,
      address: service.address,
      amount: service.amount,
      assignedAgent: service.assignedAgent ? {
        name: service.assignedAgent.name,
        phone: service.assignedAgent.phone
      } : null,
      statusHistory: service.statusHistory.map(item => ({
        status: item.status,
        timestamp: item.timestamp,
        notes: item.notes
      }))
    };

    res.json({
      success: true,
      data: filteredService
    });
  } catch (error) {
    console.error('Service Tracking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking service',
      error: error.message
    });
  }
};

const getUserServices = async (req, res) => {
  try {
    const { phone } = req.params;
    const { page = 1, limit = 10 } = req.query;

    console.log('Fetching services for phone:', phone);

    // Add validation for phone number
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const query = { userPhone: phone };
    console.log('Query:', query);

    const [services, total] = await Promise.all([
      ServiceRequest.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      ServiceRequest.countDocuments(query)
    ]);

    console.log(`Found ${services.length} services out of ${total} total`);

    // Transform the data before sending
    const transformedServices = services.map(service => ({
      id: service._id,
      serviceType: service.serviceType,
      status: service.status,
      date: service.date,
      timeSlot: service.timeSlot,
      address: service.address,
      amount: service.amount,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    }));

    res.json({
      success: true,
      data: transformedServices,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error in getUserServices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: error.message
    });
  }
};

// Fix the exports by combining all functions into a single exports object
module.exports = {
  createServiceRequest,
  trackService,
  getUserServices
};

// Remove the previous exports if they exist
// exports.getUserServices = getUserServices; // Remove this line if it exists
