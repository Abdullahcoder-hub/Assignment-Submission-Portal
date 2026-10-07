import { Response } from 'express';
import mongoose, { HydratedDocument } from 'mongoose';
import CRApplication from '../models/CRApplication.js';
import Student from '../models/Student.js';
import Class from '../models/Class.js';
import Admin, { IAdmin } from '../models/Admin.js';
import { AuthRequest } from '../middleware/auth.js';
import { logError } from '../utils/logger.js';

/**
 * 1. STUDENT APPLIES FOR CR OR CR ASSISTANT
 * - Uses existing Student account
 * - Student must select/request a class
 * - Backend verifies Student actually belongs to that class
 * - Prevents duplicate active/pending applications
 */
export const applyForCR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const { classId, roleType = 'CR', reason } = req.body;

    if (!classId) {
      res.status(400).json({ success: false, message: 'Class selection is required.' });
      return;
    }

    if (!['CR', 'CR_ASSISTANT'].includes(roleType)) {
      res.status(400).json({ success: false, message: 'Role must be CR or CR_ASSISTANT.' });
      return;
    }

    // Verify student exists in DB
    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student account not found.' });
      return;
    }

    // Backend verification: student must actually belong to the requested class
    if (!student.classId || student.classId.toString() !== classId.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You can only apply to be CR or Assistant for your own class.',
      });
      return;
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc || !classDoc.isActive) {
      res.status(400).json({ success: false, message: 'Selected class not found or inactive.' });
      return;
    }

    // Check if the class already has an active CR or Assistant
    if (roleType === 'CR' && classDoc.crId) {
      const activeCR = await Admin.findOne({ _id: classDoc.crId, isActive: true, approvalStatus: 'Approved' });
      if (activeCR) {
        res.status(400).json({ success: false, message: 'This class already has an active CR.' });
        return;
      }
    } else if (roleType === 'CR_ASSISTANT' && classDoc.assistantId) {
      const activeAsst = await Admin.findOne({ _id: classDoc.assistantId, isActive: true, approvalStatus: 'Approved' });
      if (activeAsst) {
        res.status(400).json({ success: false, message: 'This class already has an active CR Assistant.' });
        return;
      }
    }

    // Check for existing pending application for this student
    const existingPending = await CRApplication.findOne({
      studentId: student._id,
      classId: classDoc._id,
      roleType,
      status: 'PENDING',
    });

    if (existingPending) {
      res.status(400).json({
        success: false,
        message: 'Your CR request is waiting for Super Admin approval.',
        application: existingPending,
      });
      return;
    }

    const application = await CRApplication.create({
      studentId: student._id,
      classId: classDoc._id,
      roleType,
      status: 'PENDING',
      reason: reason ? String(reason).trim() : '',
      appliedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. Waiting for Super Admin approval.',
      application,
    });
  } catch (error) {
    logError('[Apply CR Error]', error);
    res.status(500).json({ success: false, message: 'Failed to submit CR application.' });
  }
};

/**
 * 2. GET CURRENT STUDENT'S CR APPLICATION STATUS
 */
export const getMyCRApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const applications = await CRApplication.find({ studentId: req.student.id })
      .populate('classId', 'name semester section')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch CR application status.' });
  }
};

/**
 * 3. SUPER ADMIN: GET ALL CR APPLICATIONS
 */
export const getAllCRApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, classId } = req.query;
    const filter: any = {};

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(String(status).toUpperCase())) {
      filter.status = String(status).toUpperCase();
    }
    if (classId) {
      filter.classId = classId;
    }

    const applications = await CRApplication.find(filter)
      .populate('studentId', 'name email rollNumber isEmailVerified')
      .populate('classId', 'name semester section joinCode')
      .sort({ appliedAt: -1 })
      .lean();

    const requestedStatus = String(status || '').toUpperCase();
    const includeLegacyRequests = !requestedStatus || ['ALL', 'PENDING'].includes(requestedStatus);
    let legacyRequests: object[] = [];

    if (includeLegacyRequests) {
      const legacyFilter: Record<string, unknown> = {
        role: { $in: ['CR', 'CR_ASSISTANT'] },
        approvalStatus: 'Pending',
      };
      if (classId) legacyFilter.assignedClassId = classId;

      const [legacyStaff, pendingApplications] = await Promise.all([
        Admin.find(legacyFilter)
          .populate('studentId', 'name email rollNumber isEmailVerified')
          .populate('assignedClassId', 'name semester section joinCode')
          .sort({ createdAt: -1 })
          .lean(),
        CRApplication.find({ status: 'PENDING' }).select('studentId classId roleType').lean(),
      ]);
      const pendingKeys = new Set(
        pendingApplications.map((application) =>
          `${application.studentId.toString()}:${String(application.classId)}:${application.roleType}`
        )
      );

      legacyRequests = legacyStaff
        .filter((staff) => {
          const studentId = staff.studentId && typeof staff.studentId === 'object' && '_id' in staff.studentId
            ? staff.studentId._id.toString()
            : String(staff.studentId);
          const assignedClassId = staff.assignedClassId && typeof staff.assignedClassId === 'object' && '_id' in staff.assignedClassId
            ? staff.assignedClassId._id.toString()
            : String(staff.assignedClassId || '');
          return !assignedClassId || !pendingKeys.has(`${studentId}:${assignedClassId}:${staff.role}`);
        })
        .map((staff) => ({
          _id: staff._id.toString(),
          studentId: staff.studentId || {
            name: staff.name,
            email: staff.email,
            rollNumber: '',
          },
          classId: staff.assignedClassId || null,
          roleType: staff.role,
          status: 'PENDING',
          reason: '',
          appliedAt: staff.createdAt,
          legacyStaffRequest: true,
        }));
    }

    res.status(200).json({
      success: true,
      count: applications.length + legacyRequests.length,
      applications: [...applications, ...legacyRequests],
    });
  } catch (error) {
    logError('[Get CR Applications Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch CR applications.' });
  }
};

/**
 * 4. SUPER ADMIN: DECIDE CR APPLICATION (APPROVE / REJECT)
 * - Frontend cannot directly flip status.
 * - Only Super Admin can approve/reject.
 * - Enforces ONE ACTIVE CR and ONE ACTIVE ASSISTANT per class.
 * - When approved:
 *     * Links existing Student account to Admin record (or updates existing Admin record with studentId)
 *     * No duplicate student account created.
 *     * Assigns classDoc.crId or classDoc.assistantId.
 */
export const decideCRApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { decision, rejectionReason } = req.body; // 'APPROVED' | 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(String(decision).toUpperCase())) {
      res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED.' });
      return;
    }

    let application = await CRApplication.findById(id);
    let legacyStaffRequest: HydratedDocument<IAdmin> | null = null;

    if (!application) {
      legacyStaffRequest = await Admin.findOne({
        _id: id,
        role: { $in: ['CR', 'CR_ASSISTANT'] },
        approvalStatus: 'Pending',
      });
      if (!legacyStaffRequest) {
        res.status(404).json({ success: false, message: 'CR application not found.' });
        return;
      }

      if (!legacyStaffRequest.studentId || !legacyStaffRequest.assignedClassId) {
        if (String(decision).toUpperCase() === 'REJECTED') {
          legacyStaffRequest.approvalStatus = 'Rejected';
          await legacyStaffRequest.save();
          res.status(200).json({ success: true, message: 'CR request rejected.' });
          return;
        }

        const classId = req.body.classId || legacyStaffRequest.assignedClassId;
        if (!classId) {
          res.status(400).json({ success: false, message: 'Select a class before approving this CR request.' });
          return;
        }
        const targetClass = await Class.findById(classId);
        if (!targetClass || !targetClass.isActive) {
          res.status(400).json({ success: false, message: 'Select an active class for this CR request.' });
          return;
        }

        const classRoleField = legacyStaffRequest.role === 'CR' ? 'crId' : 'assistantId';
        const currentAccountId = targetClass[classRoleField]?.toString();
        if (currentAccountId && currentAccountId !== legacyStaffRequest._id.toString()) {
          const currentAccount = await Admin.findOne({
            _id: currentAccountId,
            isActive: true,
            approvalStatus: 'Approved',
          });
          if (currentAccount) {
            res.status(400).json({
              success: false,
              message: `This class already has an active ${legacyStaffRequest.role === 'CR' ? 'CR' : 'CR Assistant'}.`,
            });
            return;
          }
        }

        legacyStaffRequest.assignedClassId = targetClass._id;
        legacyStaffRequest.approvalStatus = 'Approved';
        await legacyStaffRequest.save();
        targetClass[classRoleField] = legacyStaffRequest._id;
        await targetClass.save();
        res.status(200).json({
          success: true,
          message: `${legacyStaffRequest.name} approved for ${targetClass.name}.`,
        });
        return;
      }

      if (!legacyStaffRequest.assignedClassId) {
        legacyStaffRequest.approvalStatus = 'Rejected';
        await legacyStaffRequest.save();
        res.status(200).json({ success: true, message: 'CR request rejected.' });
        return;
      }

      application = await CRApplication.create({
        studentId: legacyStaffRequest.studentId,
        classId: legacyStaffRequest.assignedClassId,
        roleType: legacyStaffRequest.role,
        status: 'PENDING',
        appliedAt: legacyStaffRequest.createdAt,
      });
    }

    if (!application) {
      res.status(404).json({ success: false, message: 'CR application not found.' });
      return;
    }

    if (application.status !== 'PENDING') {
      res.status(400).json({ success: false, message: `Application is already ${application.status}.` });
      return;
    }

    const targetClass = await Class.findById(application.classId);
    if (!targetClass) {
      res.status(404).json({ success: false, message: 'Class for this application not found.' });
      return;
    }

    const student = await Student.findById(application.studentId);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student account not found.' });
      return;
    }

    const finalDecision = String(decision).toUpperCase() as 'APPROVED' | 'REJECTED';

    if (finalDecision === 'REJECTED') {
      application.status = 'REJECTED';
      application.decidedAt = new Date();
      application.decidedBy = req.admin?.id as any;
      application.rejectionReason = rejectionReason ? String(rejectionReason).trim() : 'Rejected by Super Admin';
      await application.save();
      if (legacyStaffRequest) {
        legacyStaffRequest.approvalStatus = 'Rejected';
        await legacyStaffRequest.save();
      }

      res.status(200).json({
        success: true,
        message: `CR application rejected. Student remains a normal student.`,
        application,
      });
      return;
    }

    // IF APPROVED:
    const roleType = application.roleType; // 'CR' or 'CR_ASSISTANT'

    // Enforce 1 active CR / Assistant per class
    if (roleType === 'CR') {
      if (targetClass.crId) {
        const existingCR = await Admin.findOne({ _id: targetClass.crId, isActive: true, approvalStatus: 'Approved' });
        if (existingCR && existingCR.email !== student.email) {
          res.status(400).json({
            success: false,
            message: 'This class already has an active CR. Remove or reassign the existing CR first.',
          });
          return;
        }
      }
    } else if (roleType === 'CR_ASSISTANT') {
      if (targetClass.assistantId) {
        const existingAsst = await Admin.findOne({ _id: targetClass.assistantId, isActive: true, approvalStatus: 'Approved' });
        if (existingAsst && existingAsst.email !== student.email) {
          res.status(400).json({
            success: false,
            message: 'This class already has an active CR Assistant. Remove or reassign the existing Assistant first.',
          });
          return;
        }
      }
    }

    // Link/Sync the Student's existing credentials to Admin (Staff) collection
    // so the student logs in with the SAME verified email and password
    let adminRecord = await Admin.findOne({ email: student.email });
    if (!adminRecord) {
      adminRecord = await Admin.create({
        name: student.name,
        email: student.email,
        passwordHash: student.passwordHash || 'N/A',
        role: roleType,
        assignedClassId: targetClass._id,
        studentId: student._id,
        isActive: true,
        isEmailVerified: student.isEmailVerified,
        approvalStatus: 'Approved',
      });
    } else {
      adminRecord.role = roleType;
      adminRecord.assignedClassId = targetClass._id;
      adminRecord.studentId = student._id;
      adminRecord.isActive = true;
      adminRecord.isEmailVerified = student.isEmailVerified;
      adminRecord.approvalStatus = 'Approved';
      if (student.passwordHash) adminRecord.passwordHash = student.passwordHash;
      await adminRecord.save();
    }

    // Update Class record with approved CR or Assistant
    if (roleType === 'CR') {
      targetClass.crId = adminRecord._id as any;
    } else if (roleType === 'CR_ASSISTANT') {
      targetClass.assistantId = adminRecord._id as any;
    }
    await targetClass.save();

    // Mark application as APPROVED
    application.status = 'APPROVED';
    application.decidedAt = new Date();
    application.decidedBy = req.admin?.id as any;
    await application.save();

    res.status(200).json({
      success: true,
      message: `${student.name} is now approved as active ${roleType} for class ${targetClass.name}.`,
      application,
    });
  } catch (error) {
    logError('[Decide CR Application Error]', error);
    res.status(500).json({ success: false, message: 'Failed to process CR application decision.' });
  }
};
