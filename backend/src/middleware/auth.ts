import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin, { StaffRole } from '../models/Admin.js';
import Student from '../models/Student.js';
import { getJwtSecret } from '../config/security.js';

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
    assignedClassId?: string;
  };
  student?: {
    id: string;
    name: string;
    email: string;
    rollNumber: string;
    classId?: string;
    role: 'STUDENT';
  };
}

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
};

/**
 * Super Admin or Admin only
 */
export const authenticateAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (!decoded || decoded.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, message: 'Access denied. Super Admin privileges required.' });
      return;
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.role !== 'SUPER_ADMIN' || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Invalid token: Admin account not found or inactive.' });
      return;
    }

    if (admin.isEmailVerified === false || admin.approvalStatus === 'Pending' || admin.approvalStatus === 'Rejected') {
      res.status(403).json({ success: false, message: 'Super Admin account is not authorized.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      assignedClassId: admin.assignedClassId?.toString(),
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

/**
 * Teacher only
 */
export const authenticateTeacher = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (!decoded || decoded.role !== 'TEACHER') {
      res.status(403).json({ success: false, message: 'Access denied. Teacher privileges required.' });
      return;
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.role !== decoded.role || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Invalid token: Teacher account not found or inactive.' });
      return;
    }

    if (admin.isEmailVerified === false || admin.approvalStatus === 'Pending' || admin.approvalStatus === 'Rejected') {
      res.status(403).json({ success: false, message: 'This staff account is not approved or email verified.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      assignedClassId: admin.assignedClassId?.toString(),
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

/**
 * CR or CR Assistant only (For Assignment & Class data management)
 */
export const authenticateCR = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (!decoded || !['CR', 'CR_ASSISTANT'].includes(decoded.role)) {
      res.status(403).json({ success: false, message: 'Access denied. Class Representative (CR) privileges required.' });
      return;
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.role !== decoded.role || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Invalid token: Account not found or inactive.' });
      return;
    }

    if (admin.isEmailVerified === false || admin.approvalStatus === 'Pending' || admin.approvalStatus === 'Rejected') {
      res.status(403).json({ success: false, message: 'This staff account is not approved or email verified.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      assignedClassId: admin.assignedClassId?.toString(),
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

/**
 * Super Admin, Admin, Teacher, CR, or CR Assistant
 */
export const authenticateStaff = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (!decoded || !['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(decoded.role)) {
      res.status(403).json({ success: false, message: 'Access denied. Staff privileges required.' });
      return;
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.role !== decoded.role || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Invalid token: Account not found or inactive.' });
      return;
    }

    if (admin.isEmailVerified === false || admin.approvalStatus === 'Pending' || admin.approvalStatus === 'Rejected') {
      res.status(403).json({ success: false, message: 'This staff account is not approved or email verified.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      assignedClassId: admin.assignedClassId?.toString(),
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

/**
 * Authenticate Student
 */
export const authenticateStudent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required. Please log in as a student.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: 'STUDENT' | StaffRole;
      tokenVersion?: number;
    };

    if (!decoded || decoded.role !== 'STUDENT') {
      res.status(403).json({ success: false, message: 'Access denied. Student authentication required.' });
      return;
    }

    const student = await Student.findById(decoded.id);
    if (!student) {
      res.status(401).json({ success: false, message: 'Invalid token: Student account not found.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (student.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
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
      classId: student.classId?.toString(),
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

/**
 * Authenticate Student OR Staff/Admin (For viewing submission files, shared resources, etc.)
 */
export const authenticateStudentOrAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (['SUPER_ADMIN', 'TEACHER', 'CR', 'CR_ASSISTANT'].includes(decoded.role)) {
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.isActive && admin.role === decoded.role) {
        if (admin.isEmailVerified === false || admin.approvalStatus === 'Pending' || admin.approvalStatus === 'Rejected') {
          res.status(403).json({ success: false, message: 'This staff account is not approved or email verified.' });
          return;
        }
        if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
          res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
          return;
        }
        req.admin = {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
          assignedClassId: admin.assignedClassId?.toString(),
        };
        next();
        return;
      }
    } else if (decoded.role === 'STUDENT') {
      const student = await Student.findById(decoded.id);
      if (student) {
        if ((decoded.tokenVersion ?? 0) !== (student.tokenVersion ?? 0)) {
          res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
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
          classId: student.classId?.toString(),
          role: 'STUDENT',
        };
        next();
        return;
      }
    }
    res.status(401).json({ success: false, message: 'Account not found or invalid token.' });
  } catch (error: any) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
};

/**
 * Strict Middleware: Explicitly blocks Teachers from all Assignment operations.
 * If a Teacher calls any assignment endpoint, return 403 Forbidden immediately.
 */
export const forbidTeacher = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as { role?: string };
        if (decoded && decoded.role === 'TEACHER') {
          res.status(403).json({
            success: false,
            message: 'Access denied: Teachers are not authorized to manage or view assignments.',
          });
          return;
        }
      } catch {
        // Token invalid/expired - let downstream auth middleware handle
      }
    }
    next();
  } catch {
    next();
  }
};

/**
 * Super Admin or CR / CR Assistant only (For Assignment management)
 */
export const authenticateCROrSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (decoded?.role === 'TEACHER') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Teachers are not authorized to manage assignments.',
      });
      return;
    }

    if (!decoded || !['SUPER_ADMIN', 'CR', 'CR_ASSISTANT'].includes(decoded.role)) {
      res.status(403).json({ success: false, message: 'Access denied. Administrative privileges required.' });
      return;
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.role !== decoded.role || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Invalid token: Account not found or inactive.' });
      return;
    }

    if (admin.isEmailVerified === false || admin.approvalStatus === 'Pending' || admin.approvalStatus === 'Rejected') {
      res.status(403).json({ success: false, message: 'Account is not approved or email verified.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      assignedClassId: admin.assignedClassId?.toString(),
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

/**
 * Optional Auth - Populates req.admin or req.student if a valid token is present
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: StaffRole | 'STUDENT';
      tokenVersion?: number;
    };

    if (decoded.role === 'STUDENT') {
      const student = await Student.findById(decoded.id);
      if (student && student.isEmailVerified) {
        req.student = {
          id: student._id.toString(),
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          classId: student.classId?.toString(),
          role: 'STUDENT',
        };
      }
    } else {
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.isActive && admin.approvalStatus === 'Approved') {
        req.admin = {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
          assignedClassId: admin.assignedClassId?.toString(),
        };
      }
    }
  } catch {
    // Ignore invalid/expired tokens for optional auth
  }
  next();
};


