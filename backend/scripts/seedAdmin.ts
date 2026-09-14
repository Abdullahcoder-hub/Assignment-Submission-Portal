import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Admin from '../src/models/Admin.js';
import { connectDB } from '../src/config/db.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const name = process.env.ADMIN_NAME || 'Class Representative';
    const email = (process.env.ADMIN_EMAIL || 'admin@portal.com').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';

    if (!email || !password) {
      console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in environment variables.');
      process.exit(1);
    }

    const existingAdmin = await Admin.findOne({ email });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (existingAdmin) {
      existingAdmin.name = name;
      existingAdmin.passwordHash = passwordHash;
      await existingAdmin.save();
      console.log(`✅ Admin account updated successfully: ${email}`);
    } else {
      await Admin.create({
        name,
        email,
        passwordHash,
        role: 'ADMIN',
      });
      console.log(`✅ Admin account seeded successfully: ${email}`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin account:', error);
    process.exit(1);
  }
};

seedAdmin();
