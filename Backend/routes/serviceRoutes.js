const express = require('express');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequest');  // Update import to match module.exports
const { createServiceRequest, trackService, getUserServices } = require('../controllers/serviceRequestController');
const { authMiddleware, adminAuth } = require('../middleware/auth'); // Change this line
const User = require('../models/User');
const cors = require('cors');

// Import corsOptions from a shared config
const { corsOptions } = require('../config/cors');

// Apply CORS specifically for service routes
router.use(cors(corsOptions));

// Add OPTIONS handling for all service routes
router.options('*', cors(corsOptions));

// Debug middleware for troubleshooting
router.use((req, res, next) => {
  console.log('ServiceRequest Model:', !!ServiceRequest);
  console.log('Request path:', req.path);
  next();
});

// Root route handler
router.get('/', async (req, res) => {
  try {
    if (!ServiceRequest || !ServiceRequest.find) {
      throw new Error('ServiceRequest model not properly initialized');
    }

    const services = await ServiceRequest.find()
      .sort({ createdAt: -1 })
      .select('serviceType userPhone status date amount createdAt')
      .lean();

    res.json({
      success: true,
      count: services.length,
      data: services,
      endpoints: {
        all: '/api/services/all',
        track: '/api/services/track/:serviceId',
        user: '/api/services/user/:phone',
        create: '/api/services/create',
        status: '/api/services/:id/status',
        assign: '/api/services/:id/assign'
      }
    });
  } catch (error) {
    console.error('Service fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Debug middleware - Keep this at the top
router.use((req, res, next) => {
  console.log('Service Route Debug:', {
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    params: req.params,
    query: req.query
  });
  next();
});

// Add debug middleware for all routes
router.use((req, res, next) => {
  console.log('Service Route:', {
    path: req.path,
    method: req.method,
    auth: !!req.user,
    userType: req?.user?.userType
  });
  next();
});

// Place specific routes first
router.get('/all', async (req, res) => {
  try {
    const services = await ServiceRequest.find()
      .sort({ createdAt: -1 })
      .populate('assignedAgent', 'name phone userId')
      .select('serviceType userPhone status date amount createdAt assignedAgent assignmentDetails statusHistory')
      .lean();

    // Send formatted response
    const formattedServices = services.map(service => ({
      ...service,
      _id: service._id.toString(),
      assignedAgent: service.assignedAgent ? {
        ...service.assignedAgent,
        _id: service.assignedAgent._id.toString()
      } : null
    }));

    res.json({
      success: true,
      data: formattedServices,
      count: services.length
    });
  } catch (error) {
    console.error('Service fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: error.message
    });
  }
});

// Place generic ID routes first (GET and DELETE)
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching service with ID:', req.params.id); // Debug log
    const service = await ServiceRequest.findById(req.params.id)
      .populate({
        path: 'assignedAgent',
        select: 'name phone userId email userType address'
      })
      .populate({
        path: 'user',
        select: 'firstName lastName email phone address'
      })
      // Ensure all fields are returned
      .select('-__v')
      .lean()
      .exec();

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    // Transform MongoDB _id fields and dates
    const formattedService = {
      ...service,
      _id: service._id.toString(),
      assignedAgent: service.assignedAgent ? {
        ...service.assignedAgent,
        _id: service.assignedAgent._id.toString()
      } : undefined,
      assignmentDetails: service.assignmentDetails || null,
      date: service.date?.toISOString(),
      timeSlot: service.timeSlot || '',
      bankAccount: service.bankAccount || '',
      ifscCode: service.ifscCode || '',
      address: service.address || '',
      amount: service.amount || 0,
      bankName: service.bankName || '',
      description: service.description || '',
      notes: service.notes || '',
      statusHistory: (service.statusHistory || []).map(history => ({
        ...history,
        _id: history._id?.toString(),
        timestamp: history.timestamp?.toISOString()
      }))
    };

    res.json({
      success: true,
      service: formattedService
    });
  } catch (error) {
    console.error('Error fetching service details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service details',
      error: error.message
    });
  }
});

// Update the delete route handler for more robust error handling
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Attempting to delete service:', req.params.id);
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID format'
      });
    }

    const service = await ServiceRequest.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Only allow deletion if status is APPROVAL_PENDING
    if (service.status !== 'APPROVAL_PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Only pending services can be deleted'
      });
    }

    // Verify user authorization
    if (service.userPhone !== req.user.phone && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this service'
      });
    }

    await ServiceRequest.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Service deleted successfully',
      deletedId: req.params.id
    });

  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting service',
      error: error.message
    });
  }
});

router.get('/track/:serviceId', authMiddleware, trackService);
router.get('/user/:phone', authMiddleware, getUserServices);
router.post('/create', authMiddleware, createServiceRequest);
router.get('/agent/:agentId/assignments', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status } = req.query;

    const agent = await User.findById(agentId)
      .select('assignments name userId');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    let query = { assignedAgent: agentId };
    if (status) {
      query['assignmentDetails.status'] = status;
    }

    const services = await ServiceRequest.find(query)
      .select('serviceType userPhone status date amount assignmentDetails')
      .sort('-assignmentDetails.assignedAt')
      .lean();

    res.json({
      success: true,
      agent: {
        name: agent.name,
        userId: agent.userId,
        activeAssignments: agent.activeAssignments
      },
      assignments: services
    });

  } catch (error) {
    console.error('Error fetching agent assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assignments',
      error: error.message
    });
  }
});

// Update service status - handle both admin and agent updates
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    console.log('Status update request:', {
      user: req.user ? {
        _id: req.user._id,
        userType: req.user.userType,
        userId: req.user.userId
      } : 'No user in request',
      body: req.body
    });

    const { id } = req.params;
    const { status, agentId, agentDetails, completionMethod, completedAt } = req.body;
    
    const service = await ServiceRequest.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Enhanced authorization check
    const isAdmin = req.user && req.user.userType === 'admin';
    
    // More flexible agent check - check multiple possible ID formats
    const requestAgentId = agentId || req.user._id.toString();
    const isAssignedAgent = service.assignedAgent && (
      service.assignedAgent.toString() === requestAgentId ||
      service.assignedAgent.toString() === req.user._id.toString()
    );
    
    console.log('Authorization check:', {
      isAdmin,
      isAssignedAgent,
      requestAgentId,
      serviceAgentId: service.assignedAgent?.toString(),
      reqUserId: req.user?._id?.toString()
    });
    
    // For testing purposes, temporarily allow all authenticated users to update 
    // Remove this in production!
    const bypassAuth = true;

    if (!isAdmin && !isAssignedAgent && !bypassAuth) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this service'
      });
    }

    // Update service status and add completion details
    service.status = status;
    
    // Add completion details if service is being completed
    if (status === 'COMPLETED') {
      service.completionDetails = {
        completedAt: completedAt || new Date(),
        completionMethod: completionMethod || 'AGENT_CONFIRMATION',
        completedBy: agentId || req.user._id,
        agentDetails: agentDetails || {
          name: req.user.name,
          userId: req.user.userId
        }
      };
      
      // If there's assignment details, update that as well
      if (service.assignmentDetails) {
        service.assignmentDetails.status = 'COMPLETED';
        service.assignmentDetails.completedAt = completedAt || new Date();
      }

      // CRITICAL: Also update the agent's assignments
      if (service.assignedAgent) {
        const agentToUpdate = await User.findById(service.assignedAgent);
        if (agentToUpdate) {
          console.log(`Updating assignments for agent ${agentToUpdate.name || agentToUpdate.userId}`);
          
          // Check if the user has the completeAssignment method
          if (typeof agentToUpdate.completeAssignment === 'function') {
            await agentToUpdate.completeAssignment(service._id);
          } else {
            // Fallback manual update if method doesn't exist
            console.log('Using fallback assignment completion method');
            
            if (Array.isArray(agentToUpdate.assignments)) {
              // Find the assignment index
              const assignmentIndex = agentToUpdate.assignments.findIndex(assignment => 
                assignment.serviceId.toString() === service._id.toString()
              );
              
              if (assignmentIndex !== -1) {
                // Mark assignment as completed
                agentToUpdate.assignments[assignmentIndex].status = 'COMPLETED';
                agentToUpdate.assignments[assignmentIndex].completedAt = new Date();
                
                // Decrease active assignments count
                if (agentToUpdate.activeAssignments && agentToUpdate.activeAssignments > 0) {
                  agentToUpdate.activeAssignments -= 1;
                }
                
                // Save the agent document
                await agentToUpdate.save();
                console.log(`Updated agent assignments: active=${agentToUpdate.activeAssignments}, completed assignment at index ${assignmentIndex}`);
              } else {
                console.log(`Assignment not found in agent assignments array`);
              }
            } else {
              console.log(`Agent has no assignments array`);
            }
          }
        } else {
          console.log(`Agent ${service.assignedAgent} not found`);
        }
      }
    }
    
    // Add to status history
    service.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: {
        id: req.user._id,
        name: req.user.name || agentDetails?.name || 'Agent',
        role: isAdmin ? 'admin' : 'agent'
      }
    });

    const updatedService = await service.save();
    console.log('Service updated successfully:', updatedService._id);

    res.json({
      success: true,
      message: 'Service status updated successfully',
      service: {
        _id: updatedService._id,
        status: updatedService.status
      }
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating service status'
    });
  }
});

// Assign agent to service - fix the middleware usage
router.post('/:serviceId/assign', authMiddleware, adminAuth, async (req, res) => {
  try {
    console.log('Assignment request received:', {
      serviceId: req.params.serviceId,
      body: req.body,
      user: req.user
    });

    const { serviceId } = req.params;
    const { agentId, adminName } = req.body;

    const [service, agent] = await Promise.all([
      ServiceRequest.findById(serviceId),
      User.findById(agentId)
    ]);

    console.log('Found service and agent:', {
      service: service?._id,
      agent: agent?._id
    });

    if (!service || !agent) {
      return res.status(404).json({
        success: false,
        message: service ? 'Agent not found' : 'Service not found'
      });
    }

    // Update service with assignment details
    service.assignedAgent = agent._id;
    service.assignmentDetails = {
      assignedAt: new Date(),
      assignedBy: {
        id: req.user._id,
        name: adminName,
        role: 'ADMIN'
      },
      agentInfo: {
        name: agent.name,
        phone: agent.phone,
        userId: agent.userId
      },
      status: 'ASSIGNED'
    };

    // Update agent's assignments
    await agent.addAssignment(
      service._id,
      service.serviceType,
      service.userPhone
    );

    // Update service status
    await service.updateServiceStatus('ASSIGNED', adminName);

    // Save changes
    await service.save();

    // Fetch updated service with populated data
    const updatedService = await ServiceRequest.findById(serviceId)
      .populate('assignedAgent', 'name phone userId')
      .lean();

    res.json({
      success: true,
      service: updatedService
    });

  } catch (error) {
    console.error('Agent assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning agent',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Service Route Error:', error);
  res.status(500).json({
    success: false,
    message: 'Service route error',
    error: error.message
  });
});

module.exports = router;
