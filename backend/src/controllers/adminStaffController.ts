import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Admin, { StaffRole } from '../models/Admin.js';
import Class from '../models/Class.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { AuthRequest } from '../middleware/auth.js';
import { validatePasswordStrength } from '../utils/passwordValidator.js';

/**
 * 1. GET ALL STAFF ACCOUNTS (Super Admin)
 */
export const getStaffMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedRoles = ['TEACHER', 'CR', 'CR_ASSISTANT'];
    const requestedRole = typeof req.query.role === 'string' ? req.query.role.toUpperCase() : undefined;
    if (requestedRole && !allowedRoles.includes(requestedRole)) {
      res.status(400).json({ success: false, message: 'Unsupported staff role filter.' });
      return;
    }
    const filter = {
      role: requestedRole && allowedRoles.includes(requestedRole)
        ? requestedRole
        : { $in: allowedRoles },
    };

    const staff = await Admin.find(filter)
      .select('-passwordHash -verificationToken -verificationTokenExpires')
      .populate('assignedClassId', 'name semester section')
      .sort({ name: 1 })
      .lean();

    const staffAccounts = staff.map((account) => ({ ...account, id: account._id.toString() }));
    res.status(200).json({ success: true, count: staffAccounts.length, staff: staffAccounts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch staff members.' });
  }
};

export const updateStaffApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Approval status must be Approved or Rejected.' });
      return;
    }

    const staff = await Admin.findById(req.params.id);
    if (!staff || !['TEACHER', 'CR', 'CR_ASSISTANT'].includes(staff.role)) {
      res.status(404).json({ success: false, message: 'Staff account not found.' });
      return;
    }

    if (status === 'Approved' && staff.isEmailVerified === false) {
      res.status(400).json({ success: false, message: 'The staff member must verify their email before approval.' });
      return;
    }

    if (status === 'Approved' && ['CR', 'CR_ASSISTANT'].includes(staff.role) && !staff.assignedClassId) {
      res.status(400).json({ success: false, message: `Assign a class to this ${staff.role} before approval.` });
      return;
    }

    // Enforce 1 active CR and 1 active Assistant per class
    if (status === 'Approved' && staff.role === 'CR' && staff.assignedClassId) {
      const existingClass = await Class.findById(staff.assignedClassId);
      if (existingClass?.crId && existingClass.crId.toString() !== staff._id.toString()) {
        const activeCR = await Admin.findOne({ _id: existingClass.crId, isActive: true, approvalStatus: 'Approved' });
        if (activeCR) {
          res.status(400).json({ success: false, message: 'This class already has an active CR.' });
          return;
        }
      }
      await Class.findByIdAndUpdate(staff.assignedClassId, { crId: staff._id });
    } else if (status === 'Approved' && staff.role === 'CR_ASSISTANT' && staff.assignedClassId) {
      const existingClass = await Class.findById(staff.assignedClassId);
      if (existingClass?.assistantId && existingClass.assistantId.toString() !== staff._id.toString()) {
        const activeAsst = await Admin.findOne({ _id: existingClass.assistantId, isActive: true, approvalStatus: 'Approved' });
        if (activeAsst) {
          res.status(400).json({ success: false, message: 'This class already has an active CR Assistant.' });
          return;
        }
      }
      await Class.findByIdAndUpdate(staff.assignedClassId, { assistantId: staff._id });
    }

    staff.approvalStatus = status;
    await staff.save();
    res.status(200).json({
      success: true,
      message: `${staff.name}'s account request was ${status.toLowerCase()}.`,
      approvalStatus: staff.approvalStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update staff approval.' });
  }
};

/**
 * 3. UPDATE STAFF ACCOUNT (Super Admin)
 */
export const updateStaffMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, role, assignedClassId, isActive, newPassword } = req.body;

    const staff = await Admin.findById(id);
    if (!staff || !['TEACHER', 'CR', 'CR_ASSISTANT'].includes(staff.role)) {
      res.status(404).json({ success: false, message: 'Staff account not found.' });
      return;
    }

    const previousRole = staff.role;
    const previousClassId = staff.assignedClassId;
    if (name) staff.name = name.trim();
    if (role !== undefined) {
      if (!['TEACHER', 'CR', 'CR_ASSISTANT'].includes(role)) {
        res.status(400).json({ success: false, message: 'Staff role must be Teacher, CR, or CR Assistant.' });
        return;
      }
      staff.role = role as StaffRole;
    }
    if (isActive !== undefined) staff.isActive = Boolean(isActive);

    if (assignedClassId !== undefined) {
      if (previousRole === 'CR' && previousClassId) {
        await Class.findOneAndUpdate({ _id: previousClassId, crId: staff._id }, { $unset: { crId: 1 } });
      } else if (previousRole === 'CR_ASSISTANT' && previousClassId) {
        await Class.findOneAndUpdate({ _id: previousClassId, assistantId: staff._id }, { $unset: { assistantId: 1 } });
      }
      if (assignedClassId) {
        staff.assignedClassId = assignedClassId;
        if (staff.role === 'CR') {
          await Class.findByIdAndUpdate(assignedClassId, { crId: staff._id });
        } else if (staff.role === 'CR_ASSISTANT') {
          await Class.findByIdAndUpdate(assignedClassId, { assistantId: staff._id });
        }
      } else {
        staff.assignedClassId = undefined;
      }
    } else if (previousClassId) {
      if (previousRole === 'CR' && staff.role !== 'CR') {
        await Class.findOneAndUpdate({ _id: previousClassId, crId: staff._id }, { $unset: { crId: 1 } });
        staff.assignedClassId = undefined;
      } else if (previousRole === 'CR_ASSISTANT' && staff.role !== 'CR_ASSISTANT') {
        await Class.findOneAndUpdate({ _id: previousClassId, assistantId: staff._id }, { $unset: { assistantId: 1 } });
        staff.assignedClassId = undefined;
      }
    }

    if (newPassword) {
      const passVal = validatePasswordStrength(newPassword);
      if (!passVal.isValid) {
        res.status(400).json({ success: false, message: passVal.message });
        return;
      }
      const salt = await bcrypt.genSalt(10);
      staff.passwordHash = await bcrypt.hash(newPassword, salt);
      staff.tokenVersion = (staff.tokenVersion ?? 0) + 1;
    }

    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Staff account updated successfully.',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        assignedClassId: staff.assignedClassId,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update staff account.' });
  }
};

/**
 * 4. DELETE STAFF ACCOUNT
 */
export const deleteStaffMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (req.admin?.id === id) {
      res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
      return;
    }

    const staff = await Admin.findById(id);
    if (!staff || !['TEACHER', 'CR', 'CR_ASSISTANT'].includes(staff.role)) {
      res.status(404).json({ success: false, message: 'Staff account not found.' });
      return;
    }

    await Promise.all([
      TeacherAssignment.deleteMany({ teacherId: id }),
      Class.updateMany({ crId: id }, { $unset: { crId: 1 } }),
      Class.updateMany({ assistantId: id }, { $unset: { assistantId: 1 } }),
      Admin.findByIdAndDelete(id),
    ]);

    res.status(200).json({
      success: true,
      message: `Staff account "${staff.name}" (${staff.role}) deleted successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete staff account.' });
  }
};

/**
 * 5. DIRECT EMAIL DECISION FOR STAFF ACCOUNT (Super Admin 1-Click Approval from Email)
 */
export const decideStaffApprovalByEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || '');
    const decision = String(req.params.decision || '').toLowerCase();
    const token = String(req.params.token || '');

    if (!id || !decision || !token || !['approve', 'reject'].includes(decision)) {
      res.status(400).send(`
        <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;background:#f8fafc;">
          <div style="max-width:480px;margin:auto;background:#fff;padding:32px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <h2 style="color:#dc2626;">Invalid Decision Link</h2>
            <p style="color:#64748b;">The approval link parameters are invalid or corrupted.</p>
          </div>
        </body></html>
      `);
      return;
    }

    const staff = await Admin.findById(id);
    if (!staff) {
      res.status(404).send(`
        <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;background:#f8fafc;">
          <div style="max-width:480px;margin:auto;background:#fff;padding:32px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <h2 style="color:#dc2626;">Account Not Found</h2>
            <p style="color:#64748b;">This staff registration record could not be found or has already been removed.</p>
          </div>
        </body></html>
      `);
      return;
    }

    if (staff.approvalToken !== token) {
      res.status(403).send(`
        <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;background:#f8fafc;">
          <div style="max-width:480px;margin:auto;background:#fff;padding:32px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <h2 style="color:#dc2626;">Unauthorized Action</h2>
            <p style="color:#64748b;">The security token for this decision link is invalid or has expired.</p>
          </div>
        </body></html>
      `);
      return;
    }

    const newStatus = decision === 'approve' ? 'Approved' : 'Rejected';
    staff.approvalStatus = newStatus;
    staff.approvalToken = undefined;
    staff.approvalTokenExpires = undefined;

    // If CR or CR Assistant, check and link class
    if (newStatus === 'Approved' && staff.assignedClassId) {
      if (staff.role === 'CR') {
        await Class.findByIdAndUpdate(staff.assignedClassId, { crId: staff._id });
      } else if (staff.role === 'CR_ASSISTANT') {
        await Class.findByIdAndUpdate(staff.assignedClassId, { assistantId: staff._id });
      }
    }

    await staff.save();

    const portalUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Decision Recorded</title></head>
      <body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 40px; text-align: center; color: #1e293b;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 36px; border-radius: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <div style="font-size: 48px; margin-bottom: 12px;">${decision === 'approve' ? '🎉' : '✕'}</div>
          <h2 style="color: ${decision === 'approve' ? '#16a34a' : '#dc2626'}; margin-top: 0;">
            Staff Account ${newStatus}
          </h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            <strong>${staff.name}</strong> (${staff.email}) has been successfully <strong>${newStatus.toLowerCase()}</strong> for the <strong>${staff.role}</strong> role.
          </p>
          <div style="margin-top: 28px;">
            <a href="${portalUrl}/admin/login" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 10px; text-decoration: none; display: inline-block; font-size: 14px;">
              Open Admin Portal &rarr;
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;background:#f8fafc;">
        <div style="max-width:480px;margin:auto;background:#fff;padding:32px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <h2 style="color:#dc2626;">Server Error</h2>
          <p style="color:#64748b;">Could not process decision at this time. Please try via the dashboard.</p>
        </div>
      </body></html>
    `);
  }
};
