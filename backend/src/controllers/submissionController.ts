import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import archiver from 'archiver';
import axios from 'axios';
import Subject from '../models/Subject.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Group from '../models/Group.js';
import LateRequest from '../models/LateRequest.js';
import Student from '../models/Student.js';
import cloudinary, { uploadToCloudinary, deleteFromCloudinary, sanitizePathSegment } from '../config/cloudinary.js';
import { sendSubmissionConfirmationEmail } from '../config/brevo.js';
import { generateSubmissionId } from '../utils/submissionId.js';
import { escapeRegex, sanitizeFileName, isFileTypeAllowed, isFileSignatureValid, isFileSizeValid, sanitizeCsvField } from '../utils/fileValidation.js';
import { AuthRequest } from '../middleware/auth.js';
import moment from 'moment-timezone';
import { convertFileToPdf, mergePDFs, getGroupSequence, OfficeConversionError } from '../utils/pdfMerge.js';
import { addMissingStudentIdentity } from '../utils/submissionPdfIdentity.js';
import { logError } from '../utils/logger.js';

const timezone = process.env.TIMEZONE || 'Asia/Karachi';

/**
 * STUDENT SUBMISSION API
 */
export const createSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  let uploadedCloudinaryPublicId: string | null = null;
  let uploadedResourceType: string = 'raw';

  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { subjectId, assignmentId } = req.body;
    const file = req.file;

    const studentId = req.student.id;
    const studentName = req.student.name;
    const rollNumber = req.student.rollNumber;
    const email = req.student.email;

    if (!subjectId) {
      res.status(400).json({ success: false, message: 'Please select a subject.' });
      return;
    }

    if (!assignmentId) {
      res.status(400).json({ success: false, message: 'Please select an assignment.' });
      return;
    }

    if (!file) {
      res.status(400).json({ success: false, message: 'Please select your assignment file.' });
      return;
    }

    // 2. Validate Subject
    const subject = await Subject.findById(subjectId);
    if (!subject || !subject.isActive) {
      res.status(400).json({ success: false, message: 'Selected subject is not available.' });
      return;
    }

    // 3. Validate Assignment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || !assignment.isActive) {
      res.status(400).json({ success: false, message: 'Selected assignment is not active or available.' });
      return;
    }

    // Check if assignment subject matches
    if (assignment.subjectId.toString() !== subject._id.toString()) {
      res.status(400).json({ success: false, message: 'Assignment does not belong to the selected subject.' });
      return;
    }

    // 4. Deadline Check
    const now = new Date();
    const isPastDeadline = now > new Date(assignment.deadline);
    let submissionStatus: 'Submitted' | 'Late' | 'Submitted Late — CR Approved' = 'Submitted';

    if (isPastDeadline) {
      if (assignment.allowLateSubmission) {
        submissionStatus = 'Late';
      } else {
        // Check if student or group has an approved late request for this assignment
        const group = await Group.findOne({ subjectId, 'members.studentId': studentId });
        const filter: any = { assignmentId, status: 'Approved' };
        if (group) {
          filter.$or = [{ groupId: group._id }, { studentId }];
        } else {
          filter.studentId = studentId;
        }

        const approvedLateReq = await LateRequest.findOne(filter);
        if (!approvedLateReq) {
          res.status(400).json({
            success: false,
            isPastDeadline: true,
            lateRequestRequired: true,
            message: 'Submission deadline has passed. Please submit a Late Submission Request to your CR for approval.',
          });
          return;
        }

        submissionStatus = 'Submitted Late — CR Approved';
      }
    }

    const isLate = isPastDeadline;

    // 5. Group Enforcement — block Group-type submissions if student is not in a group
    let groupName: string | null = null;
    let studentGroup: any = null;
    if (assignment.submissionType === 'Group') {
      const cleanRollForGroup = rollNumber.trim();
      studentGroup = await Group.findOne({
        subjectId,
        assignmentId,
        $or: [
          { 'members.studentId': studentId },
          { 'members.rollNumber': { $regex: new RegExp(`^${escapeRegex(cleanRollForGroup)}$`, 'i') } },
        ],
      });

      if (!studentGroup) {
        res.status(400).json({
          success: false,
          message:
            'You must be registered in a group for this assignment before submitting. Please create or join a group first.',
        });
        return;
      }

      groupName = studentGroup.groupName;
    }

    // 6. File Validation (Type & Size)
    const originalFileName = sanitizeFileName(file.originalname);
    if (!isFileTypeAllowed(originalFileName, assignment.allowedFileTypes)) {
      const allowedText = assignment.allowedFileTypes.map((t) => t.toUpperCase()).join(', ');
      res.status(400).json({
        success: false,
        message: `Only ${allowedText} files are allowed.`,
      });
      return;
    }

    if (!isFileSignatureValid(originalFileName, file.buffer)) {
      res.status(400).json({ success: false, message: 'The uploaded file content does not match its file extension.' });
      return;
    }

    if (!isFileSizeValid(file.size, assignment.maxFileSize)) {
      res.status(400).json({
        success: false,
        message: `File size exceeds the ${assignment.maxFileSize} MB limit.`,
      });
      return;
    }

    // 6. Check Duplicate Submission (assignmentId + rollNumber)
    const cleanRollNumber = rollNumber.trim();
    const existingSubmission = await Submission.findOne({
      assignmentId: assignment._id,
      rollNumber: { $regex: new RegExp(`^${escapeRegex(cleanRollNumber)}$`, 'i') },
    });

    if (existingSubmission) {
      res.status(400).json({
        success: false,
        message: 'This assignment has already been submitted for this roll number.',
      });
      return;
    }

    // 7. Upload File to Cloudinary
    //    For Group assignments: prefix the stored filename with the group name if not already present
    let storedFileName = sanitizeFileName(file.originalname);
    if (groupName) {
      const groupPrefix = groupName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      if (groupPrefix) {
        const ext = path.extname(storedFileName);
        const nameWithoutExt = storedFileName.slice(0, storedFileName.length - ext.length);
        const prefixWithSeparator = `${groupPrefix}_`.toLowerCase();

        if (!nameWithoutExt.toLowerCase().startsWith(prefixWithSeparator)) {
          storedFileName = `${groupPrefix}_${storedFileName}`;
        }
      }
    }

    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadToCloudinary(
        file.buffer,
        storedFileName,
        subject.code,
        assignment.title,
        cleanRollNumber,
        groupName ?? undefined
      );
      uploadedCloudinaryPublicId = cloudinaryResult.public_id;
      uploadedResourceType = cloudinaryResult.resource_type || 'raw';
    } catch (uploadErr) {
      logError('[Cloudinary Upload Error]', uploadErr);
      res.status(500).json({
        success: false,
        message: 'Unable to upload the assignment right now. Please try again.',
      });
      return;
    }

    // 8. Create MongoDB Submission
    const submissionIdStr = generateSubmissionId(subject.code);
    const submittedAtDate = new Date();
    const submissionClassId = subject.classId || assignment.classId || (req.student?.classId as any);

    let newSubmission;
    try {
      newSubmission = await Submission.create({
        submissionId: submissionIdStr,
        studentId,
        assignmentId: assignment._id,
        subjectId: subject._id,
        classId: submissionClassId || undefined,
        studentName: studentName.trim(),
        rollNumber: cleanRollNumber,
        email: email.trim().toLowerCase(),
        cloudinaryPublicId: cloudinaryResult.public_id,
        cloudinarySecureUrl: cloudinaryResult.secure_url,
        cloudinaryResourceType: cloudinaryResult.resource_type || 'raw',
        cloudinaryFormat: cloudinaryResult.format || path.extname(storedFileName).replace('.', ''),
        originalFileName: storedFileName,
        fileSize: file.size,
        fileType: file.mimetype || 'application/octet-stream',
        submittedAt: submittedAtDate,
        isLate,
        status: submissionStatus,
        emailStatus: 'Sent',
        groupName: groupName ?? null,
        groupId: studentGroup ? studentGroup._id : undefined,
        sequenceNumber: req.body.sequenceNumber ? Number(req.body.sequenceNumber) : undefined,
      });
    } catch (dbErr: any) {
      logError('[MongoDB Creation Error]', dbErr);
      // Clean up orphaned Cloudinary file
      if (uploadedCloudinaryPublicId) {
        await deleteFromCloudinary(uploadedCloudinaryPublicId, uploadedResourceType);
      }

      if (dbErr.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'This assignment has already been submitted for this roll number.',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Something went wrong on the server while saving your submission. Please try again.',
      });
      return;
    }

    // 9. Send Confirmation Email via Brevo
    let emailSent = false;
    try {
      const emailResult = await sendSubmissionConfirmationEmail({
        toEmail: email.trim(),
        toName: studentName.trim(),
        rollNumber: cleanRollNumber,
        subjectName: subject.name,
        subjectCode: subject.code,
        assignmentTitle: assignment.title,
        submissionId: submissionIdStr,
        originalFileName,
        submittedAt: submittedAtDate,
        isLate,
      });

      emailSent = emailResult.success;
      if (!emailSent) {
        newSubmission.emailStatus = 'Failed';
        await newSubmission.save();
      }
    } catch (emailErr) {
      logError('[Brevo Confirmation Failure]', emailErr);
      newSubmission.emailStatus = 'Failed';
      await newSubmission.save();
    }

    // 10. Return Receipt Response
    const formattedSubmittedAt = moment(submittedAtDate).tz(timezone).format('DD MMMM YYYY, hh:mm A');

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Assignment submitted successfully.'
        : 'Assignment submitted successfully. However, the confirmation email could not be sent.',
      emailSent,
      submission: {
        submissionId: newSubmission.submissionId,
        studentName: newSubmission.studentName,
        rollNumber: newSubmission.rollNumber,
        email: newSubmission.email,
        subjectName: subject.name,
        subjectCode: subject.code,
        assignmentTitle: assignment.title,
        originalFileName: newSubmission.originalFileName,
        cloudinarySecureUrl: newSubmission.cloudinarySecureUrl,
        submittedAt: formattedSubmittedAt,
        isLate: newSubmission.isLate,
        status: newSubmission.status,
        emailStatus: newSubmission.emailStatus,
      },
    });
  } catch (error: any) {
    logError('[Submission Error]', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong on the server. Please try again.',
    });
  }
};

/**
 * ADMIN GET SUBMISSIONS LIST (PAGINATED, SEARCH, FILTER)
 */
export const getSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { subjectId, assignmentId, status, search, date } = req.query;

    const filter: any = {};

    if (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') && req.admin?.assignedClassId) {
      filter.classId = req.admin.assignedClassId;
    }

    if (subjectId) filter.subjectId = subjectId;
    if (assignmentId) filter.assignmentId = assignmentId;
    if (status) filter.status = status;

    if (search) {
      const searchRegex = new RegExp(escapeRegex((search as string).trim()), 'i');
      filter.$or = [{ studentName: searchRegex }, { rollNumber: searchRegex }, { email: searchRegex }, { submissionId: searchRegex }];
    }

    if (date) {
      const startOfDay = moment.tz(date as string, timezone).startOf('day').toDate();
      const endOfDay = moment.tz(date as string, timezone).endOf('day').toDate();
      filter.submittedAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const total = await Submission.countDocuments(filter);
    const submissions = await Submission.find(filter)
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title deadline')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      submissions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch submissions.' });
  }
};

/**
 * ADMIN DASHBOARD STATS
 */
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classFilter: any = (['CR', 'CR_ASSISTANT'].includes(req.admin?.role || '') && req.admin?.assignedClassId)
      ? { classId: req.admin.assignedClassId }
      : {};

    const startOfToday = moment().tz(timezone).startOf('day').toDate();
    const endOfToday = moment().tz(timezone).endOf('day').toDate();

    const [
      totalSubjects,
      totalAssignments,
      totalSubmissions,
      todaysSubmissions,
      lateSubmissions,
      recentSubmissions,
    ] = await Promise.all([
      Subject.countDocuments({ isActive: true, ...classFilter }),
      Assignment.countDocuments({ isActive: true, ...classFilter }),
      Submission.countDocuments(classFilter),
      Submission.countDocuments({
        submittedAt: { $gte: startOfToday, $lte: endOfToday },
        ...classFilter,
      }),
      Submission.countDocuments({ isLate: true, ...classFilter }),
      Submission.find(classFilter)
        .populate('subjectId', 'name code')
        .populate('assignmentId', 'title')
        .sort({ submittedAt: -1 })
        .limit(5),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalSubjects,
        totalAssignments,
        totalSubmissions,
        todaysSubmissions,
        lateSubmissions,
      },
      recentSubmissions,
    });
  } catch (error) {
    logError('[Dashboard Stats Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics.' });
  }
};

/**
 * Helper to fetch file buffer from Cloudinary URL with browser User-Agent
 */
const getCloudinaryDownloadUrls = (submission: any): string[] => {
  const resourceType = submission.cloudinaryResourceType || 'raw';
  const format = submission.cloudinaryFormat || path.extname(submission.originalFileName).replace('.', '');

  return ['authenticated', 'upload'].map((type) => cloudinary.utils.private_download_url(
    submission.cloudinaryPublicId,
    format,
    { resource_type: resourceType, type, attachment: false },
  ));
};

const fetchFileBuffer = async (fileUrls: string[]): Promise<Buffer> => {
  let lastError: unknown;

  for (const fileUrl of fileUrls.filter(Boolean)) {
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const buffer = Buffer.from(response.data);
      if (buffer.length > 0) return buffer;
      lastError = new Error('Cloudinary returned an empty file.');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No Cloudinary download URL is available.');
};

/**
 * ADMIN SINGLE FILE DOWNLOAD
 */
export const downloadSingleSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const submission = await Submission.findById(id).lean();

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission record not found.' });
      return;
    }

    if (!submission.cloudinarySecureUrl && !submission.cloudinaryPublicId) {
      res.status(404).json({ success: false, message: 'File URL is not available.' });
      return;
    }

    const downloadUrls = [submission.cloudinarySecureUrl, ...getCloudinaryDownloadUrls(submission)];
    const cleanFileName = submission.originalFileName.replace(/["\r\n]/g, '_');

    for (const url of downloadUrls) {
      try {
        const streamResponse = await axios.get(url, {
          responseType: 'stream',
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        res.setHeader('Content-Type', submission.fileType || 'application/octet-stream');
        if (submission.fileSize) {
          res.setHeader('Content-Length', submission.fileSize);
        }
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(submission.originalFileName)}`
        );

        streamResponse.data.pipe(res);
        return;
      } catch (streamErr) {
        logError('[Stream Download Attempt Failed]', streamErr);
      }
    }

    res.status(502).json({ success: false, message: 'Unable to fetch the submission file from Cloudinary.' });
  } catch (error) {
    logError('[Download Single Error]', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to download submission file.' });
    }
  }
};

/**
 * IN-BROWSER FILE STREAMING (STUDENT & ADMIN)
 */
export const viewSubmissionFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const isDownload = req.query.download === 'true';

    let submission: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      submission = await Submission.findById(id).lean();
    }
    if (!submission) {
      submission = await Submission.findOne({ submissionId: id }).lean();
    }

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission record not found.' });
      return;
    }

    // Security Guard: Check if user is Admin OR student owns this submission
    if (req.student) {
      if (submission.studentId.toString() !== req.student.id) {
        res.status(403).json({ success: false, message: 'Access denied to this submission.' });
        return;
      }
    } else if (!req.admin) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!submission.cloudinarySecureUrl && !submission.cloudinaryPublicId) {
      res.status(404).json({ success: false, message: 'File URL is not available.' });
      return;
    }

    const format = submission.cloudinaryFormat || path.extname(submission.originalFileName).replace('.', '');
    const signedRawUrls = ['authenticated', 'upload'].map((type) => cloudinary.utils.private_download_url(
      submission.cloudinaryPublicId,
      format,
      { resource_type: submission.cloudinaryResourceType || 'raw', type, attachment: false },
    ));
    const signedImageUrls = ['authenticated', 'upload'].map((type) => cloudinary.utils.private_download_url(
      submission.cloudinaryPublicId,
      format,
      { resource_type: 'image', type, attachment: false },
    ));

    const downloadUrls = [submission.cloudinarySecureUrl, ...signedRawUrls, ...signedImageUrls];

    const cleanFileName = submission.originalFileName.replace(/["\r\n]/g, '_');

    const lowerExt = path.extname(submission.originalFileName).toLowerCase();
    const inlineContentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
    };
    const contentType = inlineContentTypes[lowerExt] || 'application/octet-stream';

    for (const url of downloadUrls) {
      try {
        const streamResponse = await axios.get(url, {
          responseType: 'stream',
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        res.setHeader('Content-Type', contentType);
        res.setHeader('X-File-Name', encodeURIComponent(submission.originalFileName));
        if (submission.fileSize) {
          res.setHeader('Content-Length', submission.fileSize);
        }
        const dispositionType = isDownload ? 'attachment' : 'inline';
        res.setHeader(
          'Content-Disposition',
          `${dispositionType}; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(submission.originalFileName)}`
        );
        res.setHeader('Cache-Control', 'private, no-store');

        streamResponse.data.pipe(res);
        return;
      } catch (streamErr) {
        // Try next candidate URL
      }
    }

    res.status(502).json({ success: false, message: 'Unable to stream file from Cloudinary.' });
  } catch (error) {
    logError('[View Submission Stream Error]', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream submission file.' });
    }
  }
};

/**
 * STUDENT DELETE OWN SUBMISSION FOR RE-UPLOAD
 */
export const deleteStudentSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Student authentication required.' });
      return;
    }

    const { id } = req.params;
    const studentId = req.student.id;

    const submission = await Submission.findById(id);
    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found.' });
      return;
    }

    // Security check: ensure student owns this submission
    if (submission.studentId.toString() !== studentId.toString()) {
      res.status(403).json({ success: false, message: 'You are only allowed to delete your own submissions.' });
      return;
    }

    // Delete Cloudinary file
    if (submission.cloudinaryPublicId) {
      await deleteFromCloudinary(submission.cloudinaryPublicId, submission.cloudinaryResourceType);
    }

    await Submission.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Submission deleted successfully. You can now re-upload your correct file.',
    });
  } catch (error) {
    logError('[Student Delete Error]', error);
    res.status(500).json({ success: false, message: 'Failed to delete submission for re-upload.' });
  }
};

const getGroupNumber = (groupName: string): number => {
  const match = groupName?.match(/(?:Group|Team|#)?\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

/**
 * ADMIN DOWNLOAD ALL SUBMISSIONS AS ZIP
 */
export const downloadAssignmentZip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findById(assignmentId).populate('subjectId', 'name code');
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const submissions = await Submission.find({ assignmentId }).sort({ submittedAt: 1, _id: 1 });
    if (!submissions || submissions.length === 0) {
      res.status(400).json({ success: false, message: 'No submissions found for this assignment.' });
      return;
    }

    const subjectCode = (assignment.subjectId as any)?.code || 'SUB';
    const cleanAssignmentTitle = sanitizePathSegment(assignment.title);
    const isGroupAssignment = assignment.submissionType === 'Group';
    const accountIdentityById = new Map<string, { studentName: string; rollNumber: string }>();
    if (isGroupAssignment) {
      const studentIds = [...new Set(submissions.map((submission) => submission.studentId.toString()))];
      const studentAccounts = await Student.find({ _id: { $in: studentIds } }).select('name rollNumber').lean();
      studentAccounts.forEach((student) => {
        accountIdentityById.set(student._id.toString(), {
          studentName: student.name,
          rollNumber: student.rollNumber,
        });
      });
    }

    const filesToArchive: Array<{ buffer: Buffer; name: string }> = [];

    if (isGroupAssignment) {
      // Group assignment: Merge PDFs by group
      const groupMap = new Map<string, typeof submissions>();
      // Group submissions by groupId
      for (const sub of submissions) {
        if (sub.groupId) {
          const groupId = sub.groupId.toString();
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, []);
          }
          groupMap.get(groupId)!.push(sub);
        } else {
          // Individual submissions in group assignment (edge case)
          const key = 'individual';
          if (!groupMap.has(key)) {
            groupMap.set(key, []);
          }
          groupMap.get(key)!.push(sub);
        }
      }

      // Process each group
      for (const [groupId, groupSubmissions] of groupMap) {
        const pdfsToMerge: Array<{ buffer: Buffer; sequenceNumber: number; studentName: string; rollNumber: string }> = [];
        const filesToKeepSeparate: Array<{ buffer: Buffer; name: string }> = [];
        for (const sub of groupSubmissions) {
          if (!sub.cloudinarySecureUrl && !sub.cloudinaryPublicId) continue;
          const identity = accountIdentityById.get(sub.studentId.toString()) ?? {
            studentName: sub.studentName,
            rollNumber: sub.rollNumber,
          };
          try {
            const originalBuffer = await fetchFileBuffer([sub.cloudinarySecureUrl, ...getCloudinaryDownloadUrls(sub)]);
            const originalFileName = sub.originalFileName || sub.cloudinaryFormat || 'submission';
            const extension = path.extname(originalFileName).toLowerCase();
            const archiveName = `${subjectCode}_${cleanAssignmentTitle}/${sanitizePathSegment(identity.rollNumber)}-${sanitizePathSegment(identity.studentName)}${extension || '.bin'}`;

            if (['.zip', '.ppt', '.pptx', '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods', '.csv'].includes(extension)) {
              filesToKeepSeparate.push({ buffer: originalBuffer, name: archiveName });
              continue;
            }

            let fileBuffer: Buffer;
            if (extension === '.pdf') {
              fileBuffer = originalBuffer;
            } else {
              fileBuffer = await convertFileToPdf(originalBuffer, originalFileName);
            }
            fileBuffer = await addMissingStudentIdentity(fileBuffer, identity.studentName, identity.rollNumber);

            const sequenceNumber = sub.sequenceNumber ?? groupSubmissions.indexOf(sub) + 1;
            pdfsToMerge.push({
              buffer: fileBuffer,
              sequenceNumber,
              studentName: identity.studentName,
              rollNumber: identity.rollNumber,
            });
          } catch (err) {
            logError('[ZIP Group Error] Failed to prepare a submission for the group PDF.', err);
            throw err;
          }
        }
        filesToArchive.push(...filesToKeepSeparate);

        // Merge PDFs if we have more than one
        let finalBuffer: Buffer;
        let fileName: string;

        if (pdfsToMerge.length > 1) {
          finalBuffer = await mergePDFs(pdfsToMerge);
          const groupNumber = groupId === 'individual' ? 'Individual' : getGroupSequence(groupSubmissions[0]?.groupName || '');
          fileName = `Group ${groupNumber}.pdf`;
        } else if (pdfsToMerge.length === 1) {
          finalBuffer = pdfsToMerge[0].buffer;
          const groupNumber = groupId === 'individual' ? 'Individual' : getGroupSequence(groupSubmissions[0]?.groupName || '');
          fileName = `Group ${groupNumber}.pdf`;
        } else {
          continue; // No PDFs for this group
        }

        filesToArchive.push({
          buffer: finalBuffer,
          name: `${subjectCode}_${cleanAssignmentTitle}/${fileName}`,
        });
      }
    } else {
      // Individual assignment: Keep original naming
      const usedFileNames = new Set<string>();
      for (const sub of submissions) {
        if (!sub.cloudinarySecureUrl && !sub.cloudinaryPublicId) continue;
        try {
          const ext = path.extname(sub.originalFileName) || '.pdf';
          const cleanRoll = sanitizePathSegment(sub.rollNumber);
          const cleanName = sanitizePathSegment(sub.studentName);

          let targetFileName = `${cleanRoll}-${cleanName}${ext}`;

          let duplicateCounter = 1;
          while (usedFileNames.has(targetFileName)) {
            targetFileName = `${cleanRoll}-${cleanName}_${duplicateCounter}${ext}`;
            duplicateCounter++;
          }
          usedFileNames.add(targetFileName);

          const fileBuffer = await fetchFileBuffer([sub.cloudinarySecureUrl, ...getCloudinaryDownloadUrls(sub)]);
          filesToArchive.push({ buffer: fileBuffer, name: `${subjectCode}_${cleanAssignmentTitle}/${targetFileName}` });
        } catch (fileErr) {
          logError('[ZIP Stream File Error]', fileErr);
        }
      }
    }

    if (filesToArchive.length === 0) {
      res.status(502).json({ success: false, message: 'Cloudinary files could not be downloaded.' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${subjectCode}_${cleanAssignmentTitle}_Submissions.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    for (const file of filesToArchive) {
      archive.append(file.buffer, { name: file.name });
    }

    await archive.finalize();
  } catch (error) {
    logError('[Download ZIP Error]', error);
    if (!res.headersSent) {
      if (error instanceof OfficeConversionError) {
        res.status(503).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to generate ZIP archive.' });
    }
  }
};

/**
 * ADMIN EXPORT CSV
 */
export const exportAssignmentCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findById(assignmentId).populate('subjectId', 'name code');
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const submissions = await Submission.find({ assignmentId }).sort({ rollNumber: 1 });

    const subjectName = (assignment.subjectId as any)?.name || 'Subject';
    const subjectCode = (assignment.subjectId as any)?.code || '';

    // Generate CSV String
    const headers = ['Submission ID', 'Roll Number', 'Student Name', 'Email', 'Subject', 'Assignment', 'File Name', 'Submitted At', 'Status', 'Email Status'];
    
    const rows = submissions.map((sub) => {
      const formattedDate = moment(sub.submittedAt).tz(timezone).format('YYYY-MM-DD HH:mm:ss');
      return [
        sanitizeCsvField(sub.submissionId),
        sanitizeCsvField(sub.rollNumber),
        sanitizeCsvField(sub.studentName),
        sanitizeCsvField(sub.email),
        sanitizeCsvField(`${subjectName} (${subjectCode})`),
        sanitizeCsvField(assignment.title),
        sanitizeCsvField(sub.originalFileName),
        sanitizeCsvField(formattedDate),
        sanitizeCsvField(sub.status),
        sanitizeCsvField(sub.emailStatus),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    const cleanTitle = sanitizePathSegment(assignment.title);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${subjectCode}_${cleanTitle}_Submissions.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    logError('[Export CSV Error]', error);
    res.status(500).json({ success: false, message: 'Failed to export CSV.' });
  }
};

/**
 * ADMIN DELETE SUBMISSION
 */
export const deleteSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const submission = await Submission.findById(id);
    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found.' });
      return;
    }

    // Delete Cloudinary file
    if (submission.cloudinaryPublicId) {
      await deleteFromCloudinary(submission.cloudinaryPublicId, submission.cloudinaryResourceType);
    }

    await Submission.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Submission deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete submission.' });
  }
};

/**
 * GET DEFAULTERS (UNSUBMITTED STUDENTS) FOR AN ASSIGNMENT
 */
export const getDefaulters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).populate('subjectId', 'name code');
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const submissions = await Submission.find({ assignmentId }).select('studentId rollNumber');
    const submittedStudentIds = submissions.map((s) => (s.studentId ? s.studentId.toString() : ''));
    const submittedRolls = submissions.map((s) => s.rollNumber.toUpperCase());

    const allStudents = await Student.find().select('name rollNumber email').sort({ rollNumber: 1 });

    const defaulters = allStudents.filter((st) => {
      const isSubmittedId = submittedStudentIds.includes(st._id.toString());
      const isSubmittedRoll = submittedRolls.includes(st.rollNumber.toUpperCase());
      return !isSubmittedId && !isSubmittedRoll;
    });

    res.status(200).json({
      success: true,
      assignment: {
        id: assignment._id,
        title: assignment.title,
        deadline: assignment.deadline,
        subject: assignment.subjectId,
      },
      count: defaulters.length,
      totalStudents: allStudents.length,
      defaulters,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch defaulters list.' });
  }
};

/**
 * EXPORT DEFAULTERS CSV
 */
export const exportDefaultersCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).populate('subjectId', 'name code');
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const submissions = await Submission.find({ assignmentId }).select('studentId rollNumber');
    const submittedStudentIds = submissions.map((s) => (s.studentId ? s.studentId.toString() : ''));
    const submittedRolls = submissions.map((s) => s.rollNumber.toUpperCase());

    const allStudents = await Student.find().select('name rollNumber email').sort({ rollNumber: 1 });

    const defaulters = allStudents.filter((st) => {
      const isSubmittedId = submittedStudentIds.includes(st._id.toString());
      const isSubmittedRoll = submittedRolls.includes(st.rollNumber.toUpperCase());
      return !isSubmittedId && !isSubmittedRoll;
    });

    const headers = ['Roll Number', 'Student Name', 'Email', 'Assignment', 'Subject', 'Status'];
    const rows = defaulters.map((st) =>
      [
        sanitizeCsvField(st.rollNumber),
        sanitizeCsvField(st.name),
        sanitizeCsvField(st.email),
        sanitizeCsvField(assignment.title),
        sanitizeCsvField((assignment.subjectId as any)?.name || 'N/A'),
        sanitizeCsvField('Unsubmitted (Defaulter)'),
      ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Defaulters_${assignment.title}_Unsubmitted.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to export defaulters CSV.' });
  }
};
