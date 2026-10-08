import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Admin from '../src/models/Admin.js';
import { connectDB } from '../src/config/db.js';
import { validatePasswordStrength } from '../src/utils/passwordValidator.js';
import { logError } from '../src/utils/logger.js';

dotenv.config();

interface SuperAdminConfig {
  name: string;
  email: string;
  password: string;
}

const getSuperAdminConfigs = (): SuperAdminConfig[] => {
  const numberedIndexes = [...new Set(
    Object.keys(process.env)
      .map((key) => key.match(/^SUPER_ADMIN_(\d+)_(?:NAME|EMAIL|PASSWORD)$/)?.[1])
      .filter((index): index is string => Boolean(index))
      .map(Number)
  )].sort((a, b) => a - b);

  if (numberedIndexes.length === 0) {
    const legacy = {
      name: process.env.ADMIN_NAME?.trim(),
      email: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
      password: process.env.ADMIN_PASSWORD,
    };
    if (!legacy.name || !legacy.email || !legacy.password) {
      throw new Error('Configure SUPER_ADMIN_1_NAME, SUPER_ADMIN_1_EMAIL, and SUPER_ADMIN_1_PASSWORD (or the legacy ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD).');
    }
    return [legacy as SuperAdminConfig];
  }

  const configs = numberedIndexes.map((index) => {
    const prefix = `SUPER_ADMIN_${index}`;
    const name = process.env[`${prefix}_NAME`]?.trim();
    const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${prefix}_PASSWORD`];
    if (!name || !email || !password) {
      throw new Error(`${prefix}_NAME, ${prefix}_EMAIL, and ${prefix}_PASSWORD must all be configured.`);
    }
    return { name, email, password };
  });

  if (numberedIndexes.some((index, position) => index !== position + 1)) {
    throw new Error('Numbered Super Admin settings must be sequential, starting at SUPER_ADMIN_1.');
  }

  const emails = configs.map(({ email }) => email);
  if (new Set(emails).size !== emails.length) {
    throw new Error('Each configured Super Admin must have a unique email address.');
  }
  return configs;
};

const seedAdmin = async () => {
  try {
    const accounts = getSuperAdminConfigs();
    accounts.forEach(({ password }, index) => {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password for configured Super Admin ${index + 1} is not strong enough: ${passwordValidation.message}`);
      }
    });

    await connectDB();

    let promotedCount = 0;
    for (const { name, email, password } of accounts) {
      const existingAdmin = await Admin.findOne({ email });

      const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
      if (existingAdmin) {
        if (existingAdmin.role !== 'SUPER_ADMIN') promotedCount += 1;
        existingAdmin.role = 'SUPER_ADMIN';
        existingAdmin.name = name;
        existingAdmin.passwordHash = passwordHash;
        existingAdmin.isActive = true;
        existingAdmin.isEmailVerified = true;
        existingAdmin.approvalStatus = 'Approved';
        existingAdmin.verificationToken = undefined;
        existingAdmin.verificationTokenExpires = undefined;
        existingAdmin.tokenVersion = (existingAdmin.tokenVersion ?? 0) + 1;
        await existingAdmin.save();
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
      }
    }

    const configuredEmails = accounts.map(({ email }) => email);
    const removal = await Admin.deleteMany({
      role: 'SUPER_ADMIN',
      email: { $nin: configuredEmails },
    });
    console.log(`Configured ${accounts.length} Super Admin account(s); promoted ${promotedCount} existing staff account(s); removed ${removal.deletedCount} unconfigured Super Admin account(s). Other Teacher/CR accounts and all unrelated data were not changed.`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logError('Failed to sync Super Admin accounts.', error);
    process.exit(1);
  }
};

seedAdmin();
