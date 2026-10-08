import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Class from '../models/Class.js';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { AuthRequest } from '../middleware/auth.js';
import { generateRandomJoinCode } from '../utils/joinCode.js';

const findAvailableClassStaff = (id: string, role: 'CR' | 'CR_ASSISTANT', classId?: mongoose.Types.ObjectId) =>
  Admin.findOne({
    _id: id,
    role,
    isActive: true,
    approvalStatus: 'Approved',
    assignedClassId: classId ? { $in: [null, classId] } : null,
  });

/**
 * 1. GET ALL CLASSES
 */
export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '')) {
      filter._id = req.admin?.assignedClassId || null;
    }

    const classes = await Class.find(filter)
      .populate('crId', 'name email role isActive approvalStatus')
      .populate('assistantId', 'name email role isActive approvalStatus')
      .sort({ semester: 1, section: 1 })
      .lean();

    // Attach student count for each class
    const classIds = classes.map((c) => c._id);
    const studentCounts = await Student.aggregate([
      { $match: { classId: { $in: classIds } } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(studentCounts.map((sc) => [sc._id.toString(), sc.count]));

    const result = classes.map((c) => ({
      ...c,
      studentCount: countMap.get(c._id.toString()) || 0,
    }));

    res.status(200).json({ success: true, count: result.length, classes: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch classes.' });
  }
};

/**
 * 2. GET CLASS BY ID
 */
export const getClassById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const classDoc = await Class.findById(id)
      .populate('crId', 'name email role')
      .populate('assistantId', 'name email role')
      .lean();
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }

    const studentCount = await Student.countDocuments({ classId: id });
    const teacherAssignments = await TeacherAssignment.find({ classId: id, isActive: true })
      .populate('teacherId', 'name email')
      .populate('subjectId', 'name code')
      .lean();

    res.status(200).json({
      success: true,
      class: {
        ...classDoc,
        studentCount,
        teacherAssignments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch class details.' });
  }
};

/**
 * 3. CREATE CLASS (Admin / Super Admin)
 */
export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { semester, section, name, crId } = req.body;

    if (!semester || !section) {
      res.status(400).json({ success: false, message: 'Semester and Section are required.' });
      return;
    }

    const cleanSemester = semester.trim();
    const cleanSection = section.trim().toUpperCase();
    const cleanName = name?.trim() || `${cleanSemester} ${cleanSection}`;

    // Check existing class with same semester and section
    const existing = await Class.findOne({ semester: cleanSemester, section: cleanSection });
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Class "${cleanSemester} ${cleanSection}" already exists.`,
      });
      return;
    }

    // Generate class access codes here; assigned CRs manage them after creation.
    let joinCode = generateRandomJoinCode();
    const codeExists = await Class.findOne({ joinCode });
    if (codeExists) {
      joinCode = generateRandomJoinCode();
    }

    let assignedCrId = undefined;
    if (crId) {
      const crUser = await findAvailableClassStaff(crId, 'CR');
      if (!crUser) {
        res.status(400).json({ success: false, message: 'Choose an approved CR who is not assigned to another class.' });
        return;
      }
      assignedCrId = crUser._id;
    }

    let assignedAssistantId = undefined;
    if (req.body.assistantId) {
      const assistantUser = await findAvailableClassStaff(req.body.assistantId, 'CR_ASSISTANT');
      if (!assistantUser) {
        res.status(400).json({ success: false, message: 'Choose an approved CR Assistant who is not assigned to another class.' });
        return;
      }
      assignedAssistantId = assistantUser._id;
    }

    const newClass = await Class.create({
      name: cleanName,
      semester: cleanSemester,
      section: cleanSection,
      joinCode,
      isJoinCodeActive: true,
      crId: assignedCrId,
      assistantId: assignedAssistantId,
      isActive: true,
    });

    if (assignedCrId) {
      await Admin.findByIdAndUpdate(assignedCrId, { assignedClassId: newClass._id, role: 'CR' });
    }
    if (assignedAssistantId) {
      await Admin.findByIdAndUpdate(assignedAssistantId, { assignedClassId: newClass._id, role: 'CR_ASSISTANT' });
    }

    const populated = await Class.findById(newClass._id)
      .populate('crId', 'name email role')
      .populate('assistantId', 'name email role');
    res.status(201).json({
      success: true,
      message: `Class "${newClass.name}" created successfully.`,
      class: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create class.' });
  }
};

/**
 * 4. UPDATE CLASS (Admin / Super Admin)
 */
export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { semester, section, name, crId, assistantId, isActive } = req.body;

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }

    if (semester && section) {
      const cleanSem = semester.trim();
      const cleanSec = section.trim().toUpperCase();
      const conflict = await Class.findOne({
        _id: { $ne: id },
        semester: cleanSem,
        section: cleanSec,
      });
      if (conflict) {
        res.status(400).json({ success: false, message: `Another class already exists with ${cleanSem} ${cleanSec}.` });
        return;
      }
      classDoc.semester = cleanSem;
      classDoc.section = cleanSec;
    }

    if (name) classDoc.name = name.trim();
    if (isActive !== undefined) classDoc.isActive = Boolean(isActive);

    if (crId !== undefined) {
      if (crId) {
        const crUser = await findAvailableClassStaff(crId, 'CR', classDoc._id);
        if (!crUser) {
          res.status(400).json({ success: false, message: 'Choose an approved CR who is not assigned to another class.' });
          return;
        }
        if (classDoc.crId && classDoc.crId.toString() !== crUser._id.toString()) {
          await Admin.findOneAndUpdate(
            { _id: classDoc.crId, assignedClassId: classDoc._id },
            { $unset: { assignedClassId: 1 } }
          );
        }
        classDoc.crId = crUser._id as any;
        await Admin.findByIdAndUpdate(crUser._id, { assignedClassId: classDoc._id, role: 'CR' });
      } else {
        if (classDoc.crId) {
          await Admin.findByIdAndUpdate(classDoc.crId, { assignedClassId: undefined });
        }
        classDoc.crId = undefined;
      }
    }

    if (assistantId !== undefined) {
      if (assistantId) {
        const asstUser = await findAvailableClassStaff(assistantId, 'CR_ASSISTANT', classDoc._id);
        if (!asstUser) {
          res.status(400).json({ success: false, message: 'Choose an approved CR Assistant who is not assigned to another class.' });
          return;
        }
        if (classDoc.assistantId && classDoc.assistantId.toString() !== asstUser._id.toString()) {
          await Admin.findOneAndUpdate(
            { _id: classDoc.assistantId, assignedClassId: classDoc._id },
            { $unset: { assignedClassId: 1 } }
          );
        }
        classDoc.assistantId = asstUser._id as any;
        await Admin.findByIdAndUpdate(asstUser._id, { assignedClassId: classDoc._id, role: 'CR_ASSISTANT' });
      } else {
        if (classDoc.assistantId) {
          await Admin.findByIdAndUpdate(classDoc.assistantId, { assignedClassId: undefined });
        }
        classDoc.assistantId = undefined;
      }
    }

    await classDoc.save();

    const populated = await Class.findById(classDoc._id)
      .populate('crId', 'name email role')
      .populate('assistantId', 'name email role');
    res.status(200).json({
      success: true,
      message: 'Class updated successfully.',
      class: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update class.' });
  }
};

/**
 * 5. REGENERATE CLASS JOIN CODE
 */
export const regenerateClassJoinCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }

    if (!['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') || req.admin?.assignedClassId !== id) {
      res.status(403).json({ success: false, message: 'Only the CR assigned to this class can manage its join code.' });
      return;
    }

    let newCode = generateRandomJoinCode();
    while (await Class.exists({ joinCode: newCode })) {
      newCode = generateRandomJoinCode();
    }

    classDoc.joinCode = newCode;
    classDoc.isJoinCodeActive = true;
    await classDoc.save();

    res.status(200).json({
      success: true,
      message: 'Class join code regenerated successfully.',
      joinCode: newCode,
      isJoinCodeActive: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to regenerate join code.' });
  }
};

export const updateClassJoinCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const code = String(req.body.joinCode || '').trim().toUpperCase();
    if (!['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') || req.admin?.assignedClassId !== id) {
      res.status(403).json({ success: false, message: 'Only the CR assigned to this class can change its join code.' });
      return;
    }
    if (!/^[A-Z0-9-]{4,32}$/.test(code)) {
      res.status(400).json({ success: false, message: 'Join code must be 4–32 characters using letters, numbers, or hyphens.' });
      return;
    }
    const existing = await Class.findOne({ joinCode: code, _id: { $ne: id } });
    if (existing) {
      res.status(400).json({ success: false, message: 'That join code is already used by another class.' });
      return;
    }
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }
    classDoc.joinCode = code;
    classDoc.isJoinCodeActive = true;
    await classDoc.save();
    res.status(200).json({ success: true, message: 'Class join code updated.', joinCode: code, isJoinCodeActive: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update class join code.' });
  }
};

/**
 * 6. TOGGLE CLASS JOIN CODE ACTIVE STATUS
 */
export const toggleClassJoinCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }

    if (!['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') || req.admin?.assignedClassId !== id) {
      res.status(403).json({ success: false, message: 'Only the CR assigned to this class can manage its join code.' });
      return;
    }

    classDoc.isJoinCodeActive = !classDoc.isJoinCodeActive;
    await classDoc.save();

    res.status(200).json({
      success: true,
      message: `Join code ${classDoc.isJoinCodeActive ? 'enabled' : 'disabled'} successfully.`,
      joinCode: classDoc.joinCode,
      isJoinCodeActive: classDoc.isJoinCodeActive,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle join code.' });
  }
};

/**
 * 7. GET STUDENTS OF A CLASS (CR, Assistant, Teacher assigned, Admin)
 */
export const getClassStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }

    // Security check:
    if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') && req.admin?.assignedClassId !== id) {
      res.status(403).json({ success: false, message: 'Access denied: You can only view students from your own class.' });
      return;
    }
    if (req.admin?.role === 'TEACHER') {
      const hasAssignment = await TeacherAssignment.exists({ teacherId: req.admin.id, classId: id, isActive: true });
      if (!hasAssignment) {
        res.status(403).json({ success: false, message: 'Access denied: Teacher is not assigned to this class.' });
        return;
      }
    }

    const students = await Student.find({ classId: id })
      .select('name rollNumber email isEmailVerified createdAt')
      .sort({ rollNumber: 1 })
      .lean();

    res.status(200).json({
      success: true,
      class: { id: classDoc._id, name: classDoc.name, semester: classDoc.semester, section: classDoc.section },
      count: students.length,
      students,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch class students.' });
  }
};
