// ...existing imports...

router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch recent services
    const recentServices = await ServiceRequest.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch recent tickets
    const recentTickets = await Ticket.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch notifications
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch account status
    const accountStatus = await User.findById(userId)
      .select('status lastLogin twoFactorEnabled');

    res.json({
      success: true,
      data: {
        recentServices,
        recentTickets,
        notifications,
        accountStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
});

// ...existing code...
