import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Admin from '../src/models/Admin.js';
import { connectDB } from '../src/config/db.js';
import { validatePasswordStrength } from '../src/utils/passwordValidator.js';
import { logError } from '../src/utils/logger.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    const name = process.env.ADMIN_NAME?.trim();
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error('ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured.');
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`ADMIN_PASSWORD is not strong enough: ${passwordValidation.message}`);
    }

    await connectDB();

    const otherSuperAdmin = await Admin.findOne({ email: { $ne: email }, role: 'SUPER_ADMIN' });
    if (otherSuperAdmin) {
      throw new Error('A Super Admin account already exists. Use its configured email to update that account.');
    }

    const existingAdmin = await Admin.findOne({ email });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (existingAdmin) {
      existingAdmin.name = name;
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.role = 'SUPER_ADMIN';
      existingAdmin.isActive = true;
      existingAdmin.isEmailVerified = true;
      existingAdmin.approvalStatus = 'Approved';
      existingAdmin.verificationToken = undefined;
      existingAdmin.verificationTokenExpires = undefined;
      existingAdmin.tokenVersion = (existingAdmin.tokenVersion ?? 0) + 1;
      await existingAdmin.save();
      console.log('Super Admin account updated successfully with role SUPER_ADMIN.');
    } else {
      await Admin.create({
        name,
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        isEmailVerified: true,
        approvalStatus: 'Approved',
      });
      console.log('Super Admin account seeded successfully with role SUPER_ADMIN.');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logError('Failed to seed admin account.', error);
    process.exit(1);
  }
};

seedAdmin();
