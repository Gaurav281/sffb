import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

// Load env vars
dotenv.config();

const seedAdmin = async () => {
  const connUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/battleplay';
  
  try {
    console.log('Connecting to database...');
    await mongoose.connect(connUri);
    console.log('Database connected successfully.');

    const adminUsername = 'admin';
    const adminEmail = 'admin@gmail.com';

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { username: adminUsername },
        { email: adminEmail }
      ]
    });

    if (existingAdmin) {
      console.log(`Admin user already exists! Username: ${existingAdmin.username}. Resetting password and ensuring role is admin...`);
      existingAdmin.password = 'adminpassword123'; // User.js pre-save hook will re-hash this
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log('Admin user password and role reset successfully.');
      process.exit(0);
    }

    console.log('Creating default admin user...');
    
    // Create new admin user
    const admin = await User.create({
      name: 'Battle Play Admin',
      username: adminUsername,
      email: adminEmail,
      phone: '9999999999',
      password: 'adminpassword123', // User.js pre-save hook will hash this using bcrypt
      role: 'admin',
      wallet: {
        deposited: 1000, // Pre-funded for testing admin dashboard features
        winning: 0
      }
    });

    console.log('----------------------------------------');
    console.log('Admin Account Created Successfully!');
    console.log(`Username: ${admin.username}`);
    console.log(`Gmail:    ${admin.email}`);
    console.log('Password: adminpassword123');
    console.log('Role:     admin');
    console.log('----------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  }
};

seedAdmin();
