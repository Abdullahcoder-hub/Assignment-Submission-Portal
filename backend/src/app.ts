import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import studentAuthRoutes from './routes/studentAuthRoutes.js';
import adminSettingsRoutes from './routes/adminSettingsRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === frontendUrl || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (GET /health)
app.use('/', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/student', studentAuthRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Requested API endpoint not found.' });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
