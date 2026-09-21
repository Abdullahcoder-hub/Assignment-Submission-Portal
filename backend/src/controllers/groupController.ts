import { Response } from 'express';
import mongoose from 'mongoose';
import Group from '../models/Group.js';
import Subject from '../models/Subject.js';
import Assignment from '../models/Assignment.js';
import Student from '../models/Student.js';
import { AuthRequest } from '../middleware/auth.js';
import { validateRollNumber } from '../utils/rollValidator.js';
import { sanitizeCsvField } from '../utils/fileValidation.js';

const getGroupSequenceNumber = (groupName: string): number => {
  const match = groupName?.match(/(?:Group|Team|#)?\s*(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const calculateNextGroupNumber = async (subjectId: mongoose.Types.ObjectId | string, assignmentId: mongoose.Types.ObjectId | string): Promise<number> => {
  const groups = await Group.find({ subjectId, assignmentId }).select('groupName');
  const usedNumbers = new Set<number>();

  for (const group of groups) {
    const number = getGroupSequenceNumber(group.groupName);
    if (number > 0 && number !== Number.MAX_SAFE_INTEGER) usedNumbers.add(number);
  }

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber += 1;
  return nextNumber;
};

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

    const nextGroupNumber = await calculateNextGroupNumber(subject._id, assignment._id);
    const expectedGroupName = `Group ${nextGroupNumber}`;
    if (groupName.trim().toLowerCase() !== expectedGroupName.toLowerCase()) {
      res.status(400).json({
        success: false,
        message: `The next available group number is ${nextGroupNumber}. Please use "${expectedGroupName}".`,
      });
      return;
    }

    // Group registration deadline check
    const groupDeadline = assignment.groupDeadline || assignment.deadline;
    const isPastGroupDeadline = new Date() > new Date(groupDeadline);
    if (isPastGroupDeadline && !assignment.allowLateGroupRegistration) {
      res.status(400).json({
        success: false,
        message: 'Group registration deadline for this assignment has passed. Please contact CR to allow late group registration.',
      });
      return;
    }

    const maxLimit = assignment.maxGroupSize || 4;

    // Parse member roll numbers & names
    const memberNameMap: Record<string, string> = {};
    const rawRolls: string[] = [];

    const inputMembers = Array.isArray(members) ? members : Array.isArray(memberRollNumbers) ? memberRollNumbers : [];
    for (const item of inputMembers) {
      if (typeof item === 'string' && item.trim()) {
        const roll = item.trim();
        const rollVal = validateRollNumber(roll);
        if (!rollVal.isValid) {
          res.status(400).json({ success: false, message: `Member roll number "${roll}" is invalid. Roll number must be exactly 7 digits (e.g. 2260000).` });
          return;
        }
        rawRolls.push(roll);
      } else if (typeof item === 'object' && item?.rollNumber && item.rollNumber.trim()) {
        const roll = item.rollNumber.trim();
        const rollVal = validateRollNumber(roll);
        if (!rollVal.isValid) {
          res.status(400).json({ success: false, message: `Member roll number "${roll}" is invalid. Roll number must be exactly 7 digits (e.g. 2260000).` });
          return;
        }
        rawRolls.push(roll);
        if (item.name && item.name.trim()) {
          memberNameMap[roll.toUpperCase()] = item.name.trim();
        }
      }
    }

    // Clean up leader roll number
    const cleanLeaderRoll = leaderRollNumber.trim();
    const leaderRollVal = validateRollNumber(cleanLeaderRoll);
    if (!leaderRollVal.isValid) {
      res.status(400).json({ success: false, message: `Leader roll number "${cleanLeaderRoll}" is invalid. Roll number must be exactly 7 digits (e.g. 2260000).` });
      return;
    }

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

    // Group registration deadline check
    const groupDeadline = assignment.groupDeadline || assignment.deadline;
    const isPastGroupDeadline = new Date() > new Date(groupDeadline);
    if (isPastGroupDeadline && !assignment.allowLateGroupRegistration) {
      res.status(400).json({
        success: false,
        message: 'Group registration deadline for this assignment has passed. Please contact CR to allow late group registration.',
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
      .populate('assignmentId', 'title');

    groups.sort((a, b) => {
      const diff = getGroupSequenceNumber(a.groupName) - getGroupSequenceNumber(b.groupName);
      return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
    });

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
      .populate('assignmentId', 'title deadline maxGroupSize');

    groups.sort((a, b) => {
      const diff = getGroupSequenceNumber(a.groupName) - getGroupSequenceNumber(b.groupName);
      return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
    });

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
      .populate('assignmentId', 'title');

    groups.sort((a, b) => {
      const diff = getGroupSequenceNumber(a.groupName) - getGroupSequenceNumber(b.groupName);
      return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
    });

    const headers = ['Subject', 'Assignment', 'Group Name', 'Leader + Members'];
    const rows = groups.map((g) => {
      const subName = (g.subjectId as any)?.name ? `${(g.subjectId as any).name} (${(g.subjectId as any).code})` : 'N/A';
      const assignTitle = (g.assignmentId as any)?.title || 'N/A';

      const groupBlock = [
        `Leader: ${g.leader.name} (${g.leader.rollNumber})`,
        ...g.members
          .filter((m) => m.rollNumber.toLowerCase() !== g.leader.rollNumber.toLowerCase())
          .map((m) => `${m.name} (${m.rollNumber})`),
      ].join('\n');

      return [
        sanitizeCsvField(subName),
        sanitizeCsvField(assignTitle),
        sanitizeCsvField(g.groupName),
        sanitizeCsvField(groupBlock),
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

/**
 * 8. GET NEXT AVAILABLE GROUP NUMBER FOR SUBJECT & ASSIGNMENT
 */
export const getNextGroupNumber = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, assignmentId } = req.query;
    if (!subjectId || !assignmentId) {
      res.status(400).json({ success: false, message: 'subjectId and assignmentId are required.' });
      return;
    }

    const nextNum = await calculateNextGroupNumber(subjectId as string, assignmentId as string);
    res.status(200).json({
      success: true,
      nextGroupNumber: nextNum,
      suggestedGroupName: `Group ${nextNum}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to calculate next group number.' });
  }
};

/**
 * 9. UPDATE GROUP (By Student Member/Leader or CR)
 */
export const updateGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { groupName, leaderRollNumber, memberRollNumbers, members } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      res.status(404).json({ success: false, message: 'Group not found.' });
      return;
    }

    // Check authorization: caller must be student member of group or admin
    if (req.student) {
      const isMember = group.members.some(
        (m) =>
          (m.studentId && m.studentId.toString() === req.student!.id) ||
          m.rollNumber.toLowerCase() === req.student!.rollNumber.toLowerCase()
      );
      if (!isMember) {
        res.status(403).json({ success: false, message: 'You are not authorized to edit this group.' });
        return;
      }

      // Check group registration deadline
      const assignment = await Assignment.findById(group.assignmentId);
      if (assignment) {
        const groupDeadline = assignment.groupDeadline || assignment.deadline;
        const isPast = new Date() > new Date(groupDeadline);
        if (isPast && !assignment.allowLateGroupRegistration) {
          res.status(400).json({
            success: false,
            message: 'Group registration deadline has passed. Contact CR to edit group members.',
          });
          return;
        }
      }
    }

    const assignment = await Assignment.findById(group.assignmentId);
    const maxLimit = assignment?.maxGroupSize || group.maxGroupSize || 4;

    // Parse member roll numbers & names
    const memberNameMap: Record<string, string> = {};
    const rawRolls: string[] = [];

    const inputMembers = Array.isArray(members) ? members : Array.isArray(memberRollNumbers) ? memberRollNumbers : [];
    for (const item of inputMembers) {
      if (typeof item === 'string' && item.trim()) {
        const roll = item.trim();
        const rollVal = validateRollNumber(roll);
        if (!rollVal.isValid) {
          res.status(400).json({ success: false, message: `Member roll number "${roll}" is invalid. Roll number must be exactly 7 digits (e.g. 2260000).` });
          return;
        }
        rawRolls.push(roll);
      } else if (typeof item === 'object' && item?.rollNumber && item.rollNumber.trim()) {
        const roll = item.rollNumber.trim();
        const rollVal = validateRollNumber(roll);
        if (!rollVal.isValid) {
          res.status(400).json({ success: false, message: `Member roll number "${roll}" is invalid. Roll number must be exactly 7 digits (e.g. 2260000).` });
          return;
        }
        rawRolls.push(roll);
        if (item.name && item.name.trim()) {
          memberNameMap[roll.toUpperCase()] = item.name.trim();
        }
      }
    }

    const cleanLeaderRoll = (leaderRollNumber || group.leader.rollNumber || '').trim();
    if (cleanLeaderRoll) {
      const leaderRollVal = validateRollNumber(cleanLeaderRoll);
      if (!leaderRollVal.isValid) {
        res.status(400).json({ success: false, message: `Leader roll number "${cleanLeaderRoll}" is invalid. Roll number must be exactly 7 digits (e.g. 2260000).` });
        return;
      }
      if (!rawRolls.some((r) => r.toLowerCase() === cleanLeaderRoll.toLowerCase())) {
        rawRolls.push(cleanLeaderRoll);
      }
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

    const uniqueRolls = Array.from(new Set(normalizedRolls));
    if (uniqueRolls.length > maxLimit) {
      res.status(400).json({
        success: false,
        message: `Group size (${uniqueRolls.length}) exceeds maximum limit of ${maxLimit} members.`,
      });
      return;
    }
    if (uniqueRolls.length < 1) {
      res.status(400).json({ success: false, message: 'Group must have at least 1 member.' });
      return;
    }

    // Check if any roll number is already in ANOTHER group for this assignment
    const conflictingGroup = await Group.findOne({
      _id: { $ne: group._id },
      subjectId: group.subjectId,
      assignmentId: group.assignmentId,
      'members.rollNumber': { $in: uniqueRolls.map((r) => new RegExp(`^${r}$`, 'i')) },
    });

    if (conflictingGroup) {
      const conflictingRolls = conflictingGroup.members.map((m) => m.rollNumber.toUpperCase());
      const conflict = uniqueRolls.find((r) => conflictingRolls.includes(r));
      res.status(400).json({
        success: false,
        message: `Roll number "${conflict}" is already registered in another group ("${conflictingGroup.groupName}").`,
      });
      return;
    }

    // Find student records
    const students = await Student.find({
      rollNumber: { $in: uniqueRolls.map((r) => new RegExp(`^${r}$`, 'i')) },
    });

    const membersDocs: any[] = uniqueRolls.map((roll) => {
      const matched = students.find((s) => s.rollNumber.toLowerCase() === roll.toLowerCase());
      const customName = memberNameMap[roll];
      let name = customName || matched?.name || roll;
      if (req.student && roll.toLowerCase() === req.student.rollNumber.toLowerCase()) {
        name = req.student.name;
      }
      return {
        studentId: matched
          ? (matched._id as any)
          : req.student && roll.toLowerCase() === req.student.rollNumber.toLowerCase()
          ? (new mongoose.Types.ObjectId(req.student.id) as any)
          : undefined,
        name,
        rollNumber: matched ? matched.rollNumber : roll,
        email: matched
          ? matched.email
          : req.student && roll.toLowerCase() === req.student.rollNumber.toLowerCase()
          ? req.student.email
          : '',
      };
    });

    const leaderDoc: any =
      membersDocs.find((m) => m.rollNumber.toLowerCase() === cleanLeaderRoll.toLowerCase()) || membersDocs[0];

    if (req.student && groupName && groupName.trim() !== group.groupName) {
      res.status(400).json({ success: false, message: 'Students cannot change the assigned group number.' });
      return;
    }

    if (!req.student && groupName && groupName.trim()) {
      group.groupName = groupName.trim();
    }
    group.leader = leaderDoc;
    group.members = membersDocs;

    await group.save();

    res.status(200).json({
      success: true,
      message: 'Group updated successfully.',
      group,
    });
  } catch (error: any) {
    console.error('[Update Group Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to update group.' });
  }
};
