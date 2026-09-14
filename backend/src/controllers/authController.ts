import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { AuthRequest } from '../middleware/auth.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide both email and password.' });
      return;
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'default_secret_key_change_in_production_12345';
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      secret,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const admin = await Admin.findById(req.admin.id).select('-passwordHash');
    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin profile not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
};
