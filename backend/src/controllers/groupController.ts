import { Response } from 'express';
import Group from '../models/Group.js';
import Subject from '../models/Subject.js';
import Assignment from '../models/Assignment.js';
import Student from '../models/Student.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * 1. CREATE NEW GROUP (Subject-wise)
 */
export const createGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { subjectId, assignmentId, groupName, leaderRollNumber, memberRollNumbers, members } = req.body;

    if (!subjectId || !groupName || !leaderRollNumber) {
      res.status(400).json({ success: false, message: 'Please provide subject, group name, leader, and members list.' });
      return;
    }

    const subject = await Subject.findById(subjectId);
    if (!subject || !subject.isActive) {
      res.status(400).json({ success: false, message: 'Selected subject is not available.' });
      return;
    }

    if (!assignmentId) {
      res.status(400).json({ success: false, message: 'Please select a group assignment.' });
      return;
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || !assignment.isActive) {
      res.status(400).json({ success: false, message: 'Selected group assignment is not available.' });
      return;
    }
    if (assignment.subjectId.toString() !== subject._id.toString()) {
      res.status(400).json({ success: false, message: 'Selected assignment does not belong to the selected subject.' });
      return;
    }
    if (assignment.submissionType === 'Individual') {
      res.status(400).json({
        success: false,
        message: 'Group registration is not allowed for this assignment because the CR set it to Individual Submission.',
      });
      return;
    }
    const maxLimit = assignment.maxGroupSize || 4;

    // Parse member roll numbers & names
    const memberNameMap: Record<string, string> = {};
    const rawRolls: string[] = [];

    const inputMembers = Array.isArray(members) ? members : Array.isArray(memberRollNumbers) ? memberRollNumbers : [];
    inputMembers.forEach((item: any) => {
      if (typeof item === 'string' && item.trim()) {
        rawRolls.push(item.trim());
      } else if (typeof item === 'object' && item?.rollNumber && item.rollNumber.trim()) {
        const roll = item.rollNumber.trim();
        rawRolls.push(roll);
        if (item.name && item.name.trim()) {
          memberNameMap[roll.toUpperCase()] = item.name.trim();
        }
      }
    });

    // Check if group name / number already exists for this subject assignment
    const existingName = await Group.findOne({
      subjectId: subject._id,
      assignmentId: assignment._id,
      groupName: { $regex: new RegExp(`^${groupName.trim()}$`, 'i') },
    });

    if (existingName) {
      res.status(400).json({
        success: false,
        message: `Group "${groupName.trim()}" is already registered for this assignment. Please choose another group name or number.`,
      });
      return;
    }

    const normalizedRolls = rawRolls.map((roll) => roll.toUpperCase());
    const duplicateRoll = normalizedRolls.find((roll, index) => normalizedRolls.indexOf(roll) !== index);
    if (duplicateRoll) {
      res.status(400).json({
        success: false,
        message: `Roll number "${duplicateRoll}" cannot be used more than once in the same group.`,
      });
      return;
    }

    // Clean up leader roll number
    const cleanLeaderRoll = leaderRollNumber.trim();

    // Ensure leader is included in member rolls
    if (!rawRolls.some(r => r.toLowerCase() === cleanLeaderRoll.toLowerCase())) {
      rawRolls.push(cleanLeaderRoll);
    }

    // Deduplicate roll numbers
    const uniqueRolls = Array.from(new Set(rawRolls.map(r => r.toUpperCase())));

    // Check maximum group limit
    if (uniqueRolls.length > maxLimit) {
      res.status(400).json({
        success: false,
        message: `Group size (${uniqueRolls.length}) exceeds maximum limit of ${maxLimit} members set by CR.`,
      });
      return;
    }

    if (uniqueRolls.length < 1) {
      res.status(400).json({ success: false, message: 'Group must have at least 1 member.' });
      return;
    }

    // Find existing student records for the rolls (if any)
    const students = await Student.find({
      rollNumber: { $in: uniqueRolls.map(r => new RegExp(`^${r}$`, 'i')) }
    });

    // Check if any roll number is ALREADY registered in a group for this assignment
    const existingGroup = await Group.findOne({
      subjectId: subject._id,
      assignmentId: assignment._id,
      'members.rollNumber': { $in: uniqueRolls.map(r => new RegExp(`^${r}$`, 'i')) }
    });

    if (existingGroup) {
      const existingRolls = existingGroup.members.map(m => m.rollNumber.toUpperCase());
      const conflictingRoll = uniqueRolls.find(r => existingRolls.includes(r));
      res.status(400).json({
        success: false,
        message: `Roll number "${conflictingRoll}" is already registered in group "${existingGroup.groupName}" for ${assignment.title}.`,
      });
      return;
    }

    // Build member subdocs for all provided rolls
    const membersDocs = uniqueRolls.map((roll) => {
      const matched = students.find(s => s.rollNumber.toLowerCase() === roll.toLowerCase());
      const customName = memberNameMap[roll];
      
      let name = customName || matched?.name || roll;
      if (roll.toLowerCase() === req.student!.rollNumber.toLowerCase()) {
        name = req.student!.name;
      }

      return {
        studentId: matched ? matched._id : roll.toLowerCase() === req.student!.rollNumber.toLowerCase() ? req.student!.id : undefined,
        name,
        rollNumber: matched ? matched.rollNumber : roll,
        email: matched ? matched.email : roll.toLowerCase() === req.student!.rollNumber.toLowerCase() ? req.student!.email : '',
      };
    });

    // Identify leader
    const leaderDoc = membersDocs.find(m => m.rollNumber.toLowerCase() === cleanLeaderRoll.toLowerCase()) || {
      studentId: req.student.id,
      name: req.student.name,
      rollNumber: req.student.rollNumber,
      email: req.student.email,
    };

    const newGroup = await Group.create({
      groupName: groupName.trim(),
      subjectId: subject._id,
      assignmentId: assignment ? assignment._id : undefined,
      leader: leaderDoc,
      members: membersDocs,
      maxGroupSize: maxLimit,
    });

    res.status(201).json({
      success: true,
      message: `Group "${newGroup.groupName}" registered successfully.`,
      group: newGroup,
    });
  } catch (error: any) {
    console.error('[Create Group Error]:', error);
    if (error?.code === 11000) {
      if (error?.keyPattern?.groupName || JSON.stringify(error).includes('groupName')) {
        res.status(400).json({
          success: false,
          message: `Group "${req.body.groupName?.trim()}" is already registered for this subject. Please choose another group number or name.`,
        });
        return;
      }
      res.status(400).json({ success: false, message: 'One of these roll numbers is already registered in a group for this subject.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create group.' });
  }
};

/**
 * 2. CONTINUE EXISTING GROUP FOR ANOTHER SUBJECT
 */
export const continueGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { previousGroupId, newSubjectId, newAssignmentId } = req.body;

    if (!previousGroupId || !newSubjectId || !newAssignmentId) {
      res.status(400).json({ success: false, message: 'Please select a previous group, new subject, and new assignment.' });
      return;
    }

    const prevGroup = await Group.findById(previousGroupId);
    if (!prevGroup) {
      res.status(404).json({ success: false, message: 'Previous group not found.' });
      return;
    }

    const subject = await Subject.findById(newSubjectId);
    if (!subject || !subject.isActive) {
      res.status(400).json({ success: false, message: 'New subject is not available.' });
      return;
    }

    const assignment = await Assignment.findById(newAssignmentId);
    if (!assignment || !assignment.isActive) {
      res.status(400).json({ success: false, message: 'New assignment is not available.' });
      return;
    }

    if (assignment.subjectId.toString() !== subject._id.toString()) {
      res.status(400).json({ success: false, message: 'Selected assignment does not belong to the selected subject.' });
      return;
    }
    if (assignment.submissionType === 'Individual') {
      res.status(400).json({
        success: false,
        message: 'Group registration is not allowed for this assignment because the CR set it to Individual Submission.',
      });
      return;
    }

    const maxLimit = assignment.maxGroupSize || 4;
    if (prevGroup.members.length > maxLimit) {
      res.status(400).json({
        success: false,
        message: `Previous group member count (${prevGroup.members.length}) exceeds the maximum group limit (${maxLimit}) for ${assignment.title}.`,
      });
      return;
    }

    // Check if any member is ALREADY in a group for the new assignment
    const memberRolls = prevGroup.members.map(m => m.rollNumber.toUpperCase());
    const existingGroup = await Group.findOne({
      subjectId: subject._id,
      assignmentId: assignment._id,
      'members.rollNumber': { $in: memberRolls.map(r => new RegExp(`^${r}$`, 'i')) }
    });

    if (existingGroup) {
      const existingRolls = existingGroup.members.map(m => m.rollNumber.toUpperCase());
      const conflictingMember = prevGroup.members.find(m => existingRolls.includes(m.rollNumber.toUpperCase()));
      res.status(400).json({
        success: false,
        message: `Member ${conflictingMember?.name} (${conflictingMember?.rollNumber}) is already in a group for ${assignment.title}.`,
      });
      return;
    }

    // Create a NEW group registration record for this subject
    const newGroup = await Group.create({
      groupName: prevGroup.groupName,
      subjectId: subject._id,
      assignmentId: assignment._id,
      leader: prevGroup.leader,
      members: prevGroup.members,
      maxGroupSize: maxLimit,
    });

    res.status(201).json({
      success: true,
      message: `Group "${newGroup.groupName}" continued successfully for ${subject.name}.`,
      group: newGroup,
    });
  } catch (error: any) {
    console.error('[Continue Group Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to continue group.' });
  }
};

/**
 * 3. GET PREVIOUS GROUPS FOR CURRENT STUDENT
 */
export const getMyPreviousGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const groups = await Group.find({ 'members.studentId': studentId })
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      groups,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch student groups.' });
  }
};

/**
 * 4. GET MY GROUP FOR A SPECIFIC SUBJECT / ASSIGNMENT
 */
export const getMyGroupForSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { subjectId } = req.params;
    const { assignmentId } = req.query;

    const filter: any = {
      subjectId,
      $or: [
        { 'members.studentId': req.student.id },
        { 'members.rollNumber': new RegExp(`^${req.student.rollNumber.trim()}$`, 'i') },
      ],
    };

    if (assignmentId) {
      filter.assignmentId = assignmentId;
    }

    const group = await Group.findOne(filter)
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title');

    res.status(200).json({
      success: true,
      group: group || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch group.' });
  }
};

/**
 * 7. ADMIN DELETE GROUP
 */
export const deleteGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) {
      res.status(404).json({ success: false, message: 'Group not found.' });
      return;
    }

    await Group.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: `Group "${group.groupName}" deleted successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete group.' });
  }
};

/**
 * 5. ADMIN LIST ALL GROUPS (WITH FILTERS & SEARCH)
 */
export const getGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, assignmentId, search } = req.query;
    const filter: any = {};

    if (subjectId) filter.subjectId = subjectId;
    if (assignmentId) filter.assignmentId = assignmentId;

    if (search) {
      const searchRegex = new RegExp((search as string).trim(), 'i');
      filter.$or = [
        { groupName: searchRegex },
        { 'leader.name': searchRegex },
        { 'leader.rollNumber': searchRegex },
        { 'members.name': searchRegex },
        { 'members.rollNumber': searchRegex },
      ];
    }

    const groups = await Group.find(filter)
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title deadline maxGroupSize')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch groups.' });
  }
};

/**
 * 6. ADMIN EXPORT GROUPS AS CSV
 */
export const exportGroupsCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, assignmentId } = req.query;
    const filter: any = {};

    if (subjectId) filter.subjectId = subjectId;
    if (assignmentId) filter.assignmentId = assignmentId;

    const groups = await Group.find(filter)
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title')
      .sort({ createdAt: -1 });

    const headers = ['Subject', 'Assignment', 'Group Name', 'Group Leader', 'Leader Roll No', 'Members'];
    const rows = groups.map((g) => {
      const subName = (g.subjectId as any)?.name ? `${(g.subjectId as any).name} (${(g.subjectId as any).code})` : 'N/A';
      const assignTitle = (g.assignmentId as any)?.title || 'N/A';

      const membersFormatted = g.members
        .map((m) => {
          const isLeader = m.rollNumber.toLowerCase() === g.leader.rollNumber.toLowerCase();
          return `${m.name} (${m.rollNumber})${isLeader ? ' - Leader' : ''}`;
        })
        .join('; ');

      return [
        `"${subName.replace(/"/g, '""')}"`,
        `"${assignTitle.replace(/"/g, '""')}"`,
        `"${g.groupName.replace(/"/g, '""')}"`,
        `"${g.leader.name.replace(/"/g, '""')}"`,
        `"${g.leader.rollNumber}"`,
        `"${membersFormatted.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Group_Registrations.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Export Group CSV Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to export group CSV.' });
  }
};
