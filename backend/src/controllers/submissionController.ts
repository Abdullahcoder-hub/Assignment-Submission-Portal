import { Request, Response } from 'express';
import path from 'path';
import archiver from 'archiver';
import axios from 'axios';
import Subject from '../models/Subject.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import cloudinary, { uploadToCloudinary, deleteFromCloudinary, sanitizePathSegment } from '../config/cloudinary.js';
import { sendSubmissionConfirmationEmail } from '../config/brevo.js';
import { generateSubmissionId } from '../utils/submissionId.js';
import { sanitizeFileName, isFileTypeAllowed, isFileSizeValid } from '../utils/fileValidation.js';
import { AuthRequest } from '../middleware/auth.js';
import moment from 'moment-timezone';

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

    if (isPastDeadline && !assignment.allowLateSubmission) {
      res.status(400).json({ success: false, message: 'Submission deadline has passed.' });
      return;
    }

    const isLate = isPastDeadline;

    // 5. File Validation (Type & Size)
    const originalFileName = sanitizeFileName(file.originalname);
    if (!isFileTypeAllowed(originalFileName, assignment.allowedFileTypes)) {
      const allowedText = assignment.allowedFileTypes.map((t) => t.toUpperCase()).join(', ');
      res.status(400).json({
        success: false,
        message: `Only ${allowedText} files are allowed.`,
      });
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
      rollNumber: { $regex: new RegExp(`^${cleanRollNumber}$`, 'i') },
    });

    if (existingSubmission) {
      res.status(400).json({
        success: false,
        message: 'This assignment has already been submitted for this roll number.',
      });
      return;
    }

    // 7. Upload File to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadToCloudinary(
        file.buffer,
        originalFileName,
        subject.code,
        assignment.title,
        cleanRollNumber
      );
      uploadedCloudinaryPublicId = cloudinaryResult.public_id;
      uploadedResourceType = cloudinaryResult.resource_type || 'raw';
    } catch (uploadErr) {
      console.error('[Cloudinary Upload Error]:', uploadErr);
      res.status(500).json({
        success: false,
        message: 'Unable to upload the assignment right now. Please try again.',
      });
      return;
    }

    // 8. Create MongoDB Submission
    const submissionIdStr = generateSubmissionId(subject.code);
    const submittedAtDate = new Date();

    let newSubmission;
    try {
      newSubmission = await Submission.create({
        submissionId: submissionIdStr,
        studentId,
        assignmentId: assignment._id,
        subjectId: subject._id,
        studentName: studentName.trim(),
        rollNumber: cleanRollNumber,
        email: email.trim().toLowerCase(),
        cloudinaryPublicId: cloudinaryResult.public_id,
        cloudinarySecureUrl: cloudinaryResult.secure_url,
        cloudinaryResourceType: cloudinaryResult.resource_type || 'raw',
        cloudinaryFormat: cloudinaryResult.format || path.extname(originalFileName).replace('.', ''),
        originalFileName,
        fileSize: file.size,
        fileType: file.mimetype || 'application/octet-stream',
        submittedAt: submittedAtDate,
        isLate,
        status: isLate ? 'Late' : 'Submitted',
        emailStatus: 'Sent',
      });
    } catch (dbErr: any) {
      console.error('[MongoDB Creation Error]:', dbErr);
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
      console.error('[Brevo Confirmation Failure]:', emailErr);
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
        submittedAt: formattedSubmittedAt,
        isLate: newSubmission.isLate,
        status: newSubmission.status,
        emailStatus: newSubmission.emailStatus,
      },
    });
  } catch (error: any) {
    console.error('[Submission Error]:', error);
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

    if (subjectId) filter.subjectId = subjectId;
    if (assignmentId) filter.assignmentId = assignmentId;
    if (status) filter.status = status;

    if (search) {
      const searchRegex = new RegExp((search as string).trim(), 'i');
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
    const totalSubjects = await Subject.countDocuments();
    const totalAssignments = await Assignment.countDocuments();
    const totalSubmissions = await Submission.countDocuments();

    const startOfToday = moment().tz(timezone).startOf('day').toDate();
    const endOfToday = moment().tz(timezone).endOf('day').toDate();

    const todaysSubmissions = await Submission.countDocuments({
      submittedAt: { $gte: startOfToday, $lte: endOfToday },
    });

    const lateSubmissions = await Submission.countDocuments({ isLate: true });

    const recentSubmissions = await Submission.find()
      .populate('subjectId', 'name code')
      .populate('assignmentId', 'title')
      .sort({ submittedAt: -1 })
      .limit(5);

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
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics.' });
  }
};

/**
 * Helper to fetch file buffer from Cloudinary URL with browser User-Agent
 */
const getCloudinaryDownloadUrl = (submission: any): string => {
  const resourceType = submission.cloudinaryResourceType || 'raw';
  const format = submission.cloudinaryFormat || path.extname(submission.originalFileName).replace('.', '');

  return cloudinary.utils.private_download_url(submission.cloudinaryPublicId, format, {
    resource_type: resourceType,
    type: 'upload',
    attachment: false,
  });
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
    const submission = await Submission.findById(id);

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission record not found.' });
      return;
    }

    if (!submission.cloudinarySecureUrl && !submission.cloudinaryPublicId) {
      res.status(404).json({ success: false, message: 'File URL is not available.' });
      return;
    }

    try {
      const buffer = await fetchFileBuffer([submission.cloudinarySecureUrl, getCloudinaryDownloadUrl(submission)]);
      const cleanFileName = submission.originalFileName.replace(/["\r\n]/g, '_');

      res.setHeader('Content-Type', submission.fileType || 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(submission.originalFileName)}`
      );

      res.status(200).send(buffer);
    } catch (fetchErr) {
      console.error('[Download Single Cloudinary Failure]:', fetchErr);
      res.status(502).json({ success: false, message: 'Unable to fetch the submission file from Cloudinary.' });
    }
  } catch (error) {
    console.error('[Download Single Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to download submission file.' });
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
    console.error('[Student Delete Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to delete submission for re-upload.' });
  }
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

    const submissions = await Submission.find({ assignmentId });
    if (!submissions || submissions.length === 0) {
      res.status(400).json({ success: false, message: 'No submissions found for this assignment.' });
      return;
    }

    const subjectCode = (assignment.subjectId as any)?.code || 'SUB';
    const cleanAssignmentTitle = sanitizePathSegment(assignment.title);
    const zipFolderName = `${subjectCode}_${cleanAssignmentTitle}`;

    const usedFileNames = new Set<string>();
    const filesToArchive: Array<{ buffer: Buffer; name: string }> = [];

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

        const fileBuffer = await fetchFileBuffer([sub.cloudinarySecureUrl, getCloudinaryDownloadUrl(sub)]);
        filesToArchive.push({ buffer: fileBuffer, name: `${zipFolderName}/${targetFileName}` });
        usedFileNames.add(targetFileName);
      } catch (fileErr) {
        console.error(`[ZIP Stream File Error] Failed for submission ${sub.submissionId} (${sub.originalFileName}):`, fileErr);
      }
    }

    if (usedFileNames.size === 0) {
      res.status(502).json({ success: false, message: 'Cloudinary files could not be downloaded.' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFolderName}_Submissions.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    for (const file of filesToArchive) {
      archive.append(file.buffer, { name: file.name });
    }

    await archive.finalize();
  } catch (error) {
    console.error('[Download ZIP Error]:', error);
    if (!res.headersSent) {
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
        `"${sub.submissionId}"`,
        `"${sub.rollNumber}"`,
        `"${sub.studentName.replace(/"/g, '""')}"`,
        `"${sub.email}"`,
        `"${subjectName} (${subjectCode})"`,
        `"${assignment.title.replace(/"/g, '""')}"`,
        `"${sub.originalFileName.replace(/"/g, '""')}"`,
        `"${formattedDate}"`,
        `"${sub.status}"`,
        `"${sub.emailStatus}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    const cleanTitle = sanitizePathSegment(assignment.title);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${subjectCode}_${cleanTitle}_Submissions.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Export CSV Error]:', error);
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
