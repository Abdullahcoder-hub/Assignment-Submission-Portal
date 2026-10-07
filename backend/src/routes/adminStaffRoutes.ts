import { Router } from 'express';
import {
  getStaffMembers,
  updateStaffApproval,
  updateStaffMember,
  deleteStaffMember,
  decideStaffApprovalByEmail,
} from '../controllers/adminStaffController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// 1-Click Super Admin Decision from Email (Public with secure random token)
router.get('/email-decision/:id/:decision/:token', decideStaffApprovalByEmail);

// Staff accounts may self-register; only a Super Admin can approve or manage them.
router.get('/', authenticateAdmin, getStaffMembers);
router.patch('/:id/approval', authenticateAdmin, updateStaffApproval);
router.put('/:id', authenticateAdmin, updateStaffMember);
router.delete('/:id', authenticateAdmin, deleteStaffMember);

export default router;
