import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: 'ADMIN';
  };
  student?: {
    id: string;
    name: string;
    email: string;
    rollNumber: string;
    role: 'STUDENT';
  };
}

export const authenticateAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'default_secret_key_change_in_production_12345';

    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: 'ADMIN' | 'STUDENT' };

    if (!decoded || decoded.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
      return;
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      res.status(401).json({ success: false, message: 'Invalid token: Admin account not found.' });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      email: admin.email,
      role: 'ADMIN',
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Authentication token has expired. Please log in again.' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid or malformed authentication token.' });
  }
};

export const authenticateStudent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication token required. Please log in as a student.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'default_secret_key_change_in_production_12345';

    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: 'ADMIN' | 'STUDENT' };

    if (!decoded || decoded.role !== 'STUDENT') {
      res.status(403).json({ success: false, message: 'Access denied. Student authentication required.' });
      return;
    }

    const student = await Student.findById(decoded.id);
    if (!student) {
      res.status(401).json({ success: false, message: 'Invalid token: Student account not found.' });
      return;
    }

    if (!student.isEmailVerified) {
      res.status(403).json({ success: false, message: 'Please verify your email address before continuing.' });
      return;
    }

    req.student = {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      role: 'STUDENT',
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid or expired student authentication token.' });
  }
};
