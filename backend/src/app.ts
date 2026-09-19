import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import studentAuthRoutes from './routes/studentAuthRoutes.js';
import adminSettingsRoutes from './routes/adminSettingsRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import lateRequestRoutes from './routes/lateRequestRoutes.js';
import adminStudentRoutes from './routes/adminStudentRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// High-speed response compression for mobile 4G/3G
app.use(compression());

// Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xPoweredBy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
  })
);

// CORS Configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Always allow common local dev origins in development
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:4173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev && devOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // If in dev and origin is localhost on another port, permit
      if (isDev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy: Origin ${origin} is not authorized.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Rate Limiting: Authentication Endpoints (Brute-force / Credential Stuffing Protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 auth attempts per 15 minutes per IP
  message: { success: false, message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting: File Uploads & Submissions
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // 40 uploads per 15 minutes per IP
  message: { success: false, message: 'Upload rate limit exceeded. Please wait a few minutes before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting: General API Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/auth/student', authLimiter);
app.use('/api/submissions', uploadLimiter);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (GET /health)
app.use('/', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/student', studentAuthRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/late-requests', lateRequestRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Requested API endpoint not found.' });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
