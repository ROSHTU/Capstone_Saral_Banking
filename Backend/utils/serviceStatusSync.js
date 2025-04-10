/**
 * Utility to synchronize service status across models
 */
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');

/**
 * Synchronize service status across models
 * @param {string} serviceId - The ID of the service to update
 * @param {string} status - The new status 
 * @returns {Promise<boolean>} - Success indicator
 */
exports.syncServiceStatus = async (serviceId, status) => {
  try {
    console.log(`Synchronizing service ${serviceId} to status: ${status}`);
    
    // Get the service
    const service = await ServiceRequest.findById(serviceId);
    if (!service) {
      console.error(`Service ${serviceId} not found`);
      return false;
    }
    
    // Update service status
    service.status = status;
    
    // If completing the service
    if (status === 'COMPLETED') {
      service.completionDetails = service.completionDetails || {};
      service.completionDetails.completedAt = service.completionDetails.completedAt || new Date();
      
      // If there's assignment details, update that as well
      if (service.assignmentDetails) {
        service.assignmentDetails.status = status;
        service.assignmentDetails.completedAt = service.assignmentDetails.completedAt || new Date();
      }
      
      // Update agent's assignments if assigned
      if (service.assignedAgent) {
        try {
          const agent = await User.findById(service.assignedAgent);
          if (agent) {
            if (typeof agent.completeAssignment === 'function') {
              await agent.completeAssignment(serviceId);
            } else {
              console.log(`Agent ${agent.userId} doesn't have completeAssignment method`);
              // Manual update
              if (Array.isArray(agent.assignments)) {
                const assignmentIndex = agent.assignments.findIndex(a => 
                  a.serviceId && a.serviceId.toString() === serviceId.toString()
                );
                
                if (assignmentIndex !== -1) {
                  agent.assignments[assignmentIndex].status = status;
                  agent.assignments[assignmentIndex].completedAt = new Date();
                  
                  if (agent.activeAssignments && agent.activeAssignments > 0) {
                    agent.activeAssignments -= 1;
                  }
                  
                  await agent.save();
                  console.log(`Manually updated agent ${agent.userId} assignment status`);
                }
              }
            }
          }
        } catch (agentError) {
          console.error(`Error updating agent assignments:`, agentError);
          // Continue even if agent update fails
        }
      }
    }
    
    // Add status history entry
    if (!service.statusHistory) {
      service.statusHistory = [];
    }
    
    service.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: {
        id: service.assignedAgent || 'system',
        name: 'System Update',
        role: 'system'
      }
    });
    
    await service.save();
    console.log(`Service ${serviceId} synchronized to status ${status}`);
    return true;
  } catch (error) {
    console.error(`Error synchronizing service status:`, error);
    return false;
  }
};

/**
 * Force resync of service statuses from ServiceRequest to User assignments
 */
exports.resyncAllServices = async () => {
  try {
    const completedServices = await ServiceRequest.find({ 
      status: 'COMPLETED',
      assignedAgent: { $exists: true }
    });
    
    let updateCount = 0;
    
    for (const service of completedServices) {
      const agentId = service.assignedAgent;
      if (!agentId) continue;
      
      const agent = await User.findById(agentId);
      if (!agent) continue;
      
      // Find assignment in agent
      if (Array.isArray(agent.assignments)) {
        const assignmentIndex = agent.assignments.findIndex(a => 
          a.serviceId && a.serviceId.toString() === service._id.toString()
        );
        
        if (assignmentIndex !== -1 && agent.assignments[assignmentIndex].status !== 'COMPLETED') {
          agent.assignments[assignmentIndex].status = 'COMPLETED';
          agent.assignments[assignmentIndex].completedAt = service.completionDetails?.completedAt || new Date();
          updateCount++;
        }
      }
      
      // Update active assignments count
      let activeCount = 0;
      if (Array.isArray(agent.assignments)) {
        activeCount = agent.assignments.filter(a => a.status !== 'COMPLETED').length;
      }
      
      if (agent.activeAssignments !== activeCount) {
        agent.activeAssignments = activeCount;
        await agent.save();
        console.log(`Updated agent ${agent.userId} active assignments to ${activeCount}`);
      }
    }
    
    console.log(`Resynced ${updateCount} service assignments`);
    return updateCount;
  } catch (error) {
    console.error(`Error in bulk service resync:`, error);
    return -1;
  }
};
