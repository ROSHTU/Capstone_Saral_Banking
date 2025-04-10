require('dotenv').config();
const mongoose = require('mongoose');
const AdminAgent = require('../models/AdminAgent');

const seedData = [
  {
    userId: 'Manas',
    password: 'admin@123',
    name: 'Manas Lohe',
    phoneNumber: '9876543210',
    userType: 'admin'
  },
  {
    userId: 'Shivam',
    password: 'admin@123',
    name: 'Shivam Rawat',
    phoneNumber: '9876543211',
    userType: 'admin'
  },
  {
    userId: 'Roshtu',
    password: 'agent@123',
    name: 'Roshtu Kuthiala',
    phoneNumber: '9876543212',
    userType: 'agent'
  },
  {
    userId: 'agent002',
    password: 'agent@456',
    name: 'Lisa Agent',
    phoneNumber: '9876543213',
    userType: 'agent'
  }
];

const seedAdminAgent = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await AdminAgent.deleteMany({});
    console.log('Cleared existing admin and agent data');

    // Insert new data
    const created = await AdminAgent.create(seedData);
    console.log('Created admin and agent users:', created.length);

    console.log('\nTest Credentials:');
    console.log('Admin - userId: admin001, password: admin@123');
    console.log('Agent - userId: agent001, password: agent@123');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedAdminAgent();
