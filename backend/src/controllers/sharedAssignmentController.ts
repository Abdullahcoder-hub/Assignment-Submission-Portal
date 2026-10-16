import { Response } from 'express';
import path from 'path';
import os from 'node:os';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import axios from 'axios';
import moment from 'moment-timezone';
import SharedAssignment from '../models/SharedAssignment.js';
import Assignment from '../models/Assignment.js';
import Subject from '../models/Subject.js';
import Class from '../models/Class.js';
import Admin from '../models/Admin.js';
import Submission from '../models/Submission.js';
import Student from '../models/Student.js';
import cloudinary, { sanitizePathSegment } from '../config/cloudinary.js';
import { sendSharedAssignmentToTeacherEmail } from '../config/brevo.js';
import { sanitizeCsvField } from '../utils/fileValidation.js';
import { convertFileToPdf, mergePDFs, getGroupSequence, OfficeConversionError } from '../utils/pdfMerge.js';
import { addMissingStudentIdentity } from '../utils/submissionPdfIdentity.js';
import { downloadFileToPath } from '../utils/downloadFileToPath.js';
import { AuthRequest } from '../middleware/auth.js';
import { logError } from '../utils/logger.js';

const timezone = process.env.TIMEZONE || 'Asia/Karachi';

const getCloudinaryDownloadUrls = (submission: any): string[] => {
  const resourceType = submission.cloudinaryResourceType || 'raw';
  const format = submission.cloudinaryFormat || path.extname(submission.originalFileName).replace('.', '');

  return ['authenticated', 'upload'].map((type) =>
    cloudinary.utils.private_download_url(submission.cloudinaryPublicId, format, {
      resource_type: resourceType,
      type,
      attachment: false,
    })
  );
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
 * 1. SHARE ASSIGNMENT WITH TEACHER (CR only)
 */
export const shareAssignmentWithTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignmentId, teacherId, note, shareZip = true, shareCsv = true } = req.body;

    if (!assignmentId || !teacherId) {
      res.status(400).json({ success: false, message: 'Assignment ID and Teacher ID are required.' });
      return;
    }

    const assignment = await Assignment.findById(assignmentId).populate('subjectId', 'name code');
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const teacher = await Admin.findOne({ _id: teacherId, role: 'TEACHER', isActive: true, approvalStatus: 'Approved' });
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Approved Teacher account not found.' });
      return;
    }

    const subjectId = assignment.subjectId as any;
    const classId = assignment.classId || req.admin?.assignedClassId;

    let targetClass = null;
    if (classId) {
      targetClass = await Class.findById(classId);
    }

    let shared = await SharedAssignment.findOne({ assignmentId: assignment._id, teacherId: teacher._id });
    if (shared) {
      shared.shareZip = Boolean(shareZip);
      shared.shareCsv = Boolean(shareCsv);
      shared.note = note ? String(note).trim() : shared.note;
      shared.sharedAt = new Date();
      await shared.save();
    } else {
      shared = await SharedAssignment.create({
        assignmentId: assignment._id,
        subjectId: subjectId._id,
        classId: classId || undefined,
        teacherId: teacher._id,
        crId: req.admin?.id as any,
        note: note ? String(note).trim() : '',
        shareZip: Boolean(shareZip),
        shareCsv: Boolean(shareCsv),
        sharedAt: new Date(),
      });
    }

    const submissionsCount = await Submission.countDocuments({ assignmentId: assignment._id });

    // Send notification email to Teacher
    try {
      await sendSharedAssignmentToTeacherEmail({
        teacherEmail: teacher.email,
        teacherName: teacher.name,
        crName: req.admin?.name || 'Class Representative',
        assignmentTitle: assignment.title,
        subjectName: subjectId.name || 'Subject',
        className: targetClass ? `${targetClass.name} (${targetClass.section || 'General'})` : 'Your Class',
        submissionsCount,
        note: shared.note,
        hasZip: shared.shareZip,
        hasCsv: shared.shareCsv,
      });
    } catch (emailErr) {
      logError('[Shared Assignment Notification Email Warning]', emailErr);
    }

    res.status(200).json({
      success: true,
      message: `Assignment package successfully shared with ${teacher.name}.`,
      sharedAssignment: shared,
    });
  } catch (error) {
    logError('[Share Assignment Error]', error);
    res.status(500).json({ success: false, message: 'Failed to share assignment with teacher.' });
  }
};

/**
 * 2. GET TEACHER'S RECEIVED SHARED ASSIGNMENTS (Teacher only)
 */
export const getTeacherSharedAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.admin?.id;
    if (!teacherId) {
      res.status(401).json({ success: false, message: 'Teacher authentication required.' });
      return;
    }

    const sharedList = await SharedAssignment.find({ teacherId })
      .populate('assignmentId', 'title description deadline submissionType maxFileSize allowedFileTypes')
      .populate('subjectId', 'name code')
      .populate('classId', 'name semester section')
      .populate('crId', 'name email')
      .sort({ sharedAt: -1 })
      .lean();

    // Attach submission counts
    const items = await Promise.all(
      sharedList.map(async (item) => {
        const count = await Submission.countDocuments({ assignmentId: item.assignmentId?._id });
        return { ...item, submissionsCount: count };
      })
    );

    res.status(200).json({
      success: true,
      count: items.length,
      sharedAssignments: items,
    });
  } catch (error) {
    logError('[Get Teacher Shared Assignments Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shared assignments.' });
  }
};

/**
 * 3. GET CR's SHARED ASSIGNMENTS LIST (CR only)
 */
export const getCRSharedAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.admin?.id) {
      filter.$or = [{ crId: req.admin.id }, { classId: req.admin.assignedClassId }];
    }

    const sharedList = await SharedAssignment.find(filter)
      .populate('assignmentId', 'title deadline submissionType')
      .populate('subjectId', 'name code')
      .populate('classId', 'name semester section')
      .populate('teacherId', 'name email')
      .sort({ sharedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: sharedList.length,
      sharedAssignments: sharedList,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch CR shared assignments.' });
  }
};

/**
 * 4. TEACHER DOWNLOAD SHARED ASSIGNMENT ZIP
 */
export const downloadSharedAssignmentZip = async (req: AuthRequest, res: Response): Promise<void> => {
  let temporaryDirectory: string | undefined;
  try {
    const { id } = req.params;
    const teacherId = req.admin?.id;

    const shared = await SharedAssignment.findOne({ _id: id, teacherId, shareZip: true })
      .populate('assignmentId')
      .populate('subjectId');

    if (!shared || !shared.assignmentId) {
      res.status(404).json({ success: false, message: 'Shared ZIP package not available or not authorized.' });
      return;
    }

    const assignment = shared.assignmentId as any;
    const subject = shared.subjectId as any;

    const submissions = await Submission.find({ assignmentId: assignment._id }).sort({ submittedAt: 1, _id: 1 });
    if (!submissions || submissions.length === 0) {
      res.status(400).json({ success: false, message: 'No student submissions found for this assignment.' });
      return;
    }

    const subjectCode = subject?.code || 'SUB';
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

    const filesToArchive: Array<{ path: string; name: string }> = [];
    const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), 'shared-assignment-zip-'));
    temporaryDirectory = stagingDirectory;
    let stagedFileCount = 0;
    const getStagedFilePath = () => path.join(stagingDirectory, `${stagedFileCount++}.bin`);

    if (isGroupAssignment) {
      const groupMap = new Map<string, typeof submissions>();
      for (const sub of submissions) {
        const groupId = sub.groupId ? sub.groupId.toString() : 'individual';
        if (!groupMap.has(groupId)) groupMap.set(groupId, []);
        groupMap.get(groupId)!.push(sub);
      }

      for (const [groupId, groupSubmissions] of groupMap) {
        const pdfsToMerge: Array<{ buffer: Buffer; sequenceNumber: number; studentName: string; rollNumber: string }> = [];
        const filesToKeepSeparate: Array<{ path: string; name: string }> = [];
        for (const sub of groupSubmissions) {
          if (!sub.cloudinarySecureUrl && !sub.cloudinaryPublicId) continue;
          const identity = accountIdentityById.get(sub.studentId.toString()) ?? {
            studentName: sub.studentName,
            rollNumber: sub.rollNumber,
          };
          try {
            const originalFileName = sub.originalFileName || sub.cloudinaryFormat || 'submission';
            const extension = path.extname(originalFileName).toLowerCase();
            const archiveName = `${subjectCode}_${cleanAssignmentTitle}/${sanitizePathSegment(identity.rollNumber)}-${sanitizePathSegment(identity.studentName)}${extension || '.bin'}`;

            if (['.zip', '.ppt', '.pptx', '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods', '.csv'].includes(extension)) {
              const stagedPath = getStagedFilePath();
              await downloadFileToPath([sub.cloudinarySecureUrl, ...getCloudinaryDownloadUrls(sub)], stagedPath);
              filesToKeepSeparate.push({ path: stagedPath, name: archiveName });
              continue;
            }

            const originalBuffer = await fetchFileBuffer([sub.cloudinarySecureUrl, ...getCloudinaryDownloadUrls(sub)]);
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
          continue;
        }

        const stagedPath = getStagedFilePath();
        await writeFile(stagedPath, finalBuffer);
        filesToArchive.push({
          path: stagedPath,
          name: `${subjectCode}_${cleanAssignmentTitle}/${fileName}`,
        });
      }
    } else {
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

          const stagedPath = getStagedFilePath();
          await downloadFileToPath([sub.cloudinarySecureUrl, ...getCloudinaryDownloadUrls(sub)], stagedPath);
          filesToArchive.push({ path: stagedPath, name: `${subjectCode}_${cleanAssignmentTitle}/${targetFileName}` });
        } catch (fileErr) {
          logError('[ZIP Stream File Error]', fileErr);
        }
      }
    }

    if (filesToArchive.length === 0) {
      res.status(502).json({ success: false, message: 'Submission files could not be retrieved from Cloudinary.' });
      return;
    }

    // Update download metrics
    shared.downloadCount = (shared.downloadCount || 0) + 1;
    shared.lastDownloadedAt = new Date();
    await shared.save();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${subjectCode}_${cleanAssignmentTitle}_Submissions.zip"`);

    const archive = archiver('zip', { zlib: { level: 1 } });
    const archiveOutput = pipeline(archive, res);
    for (const file of filesToArchive) {
      archive.append(createReadStream(file.path), { name: file.name });
    }

    await Promise.all([archive.finalize(), archiveOutput]);
  } catch (error) {
    logError('[Teacher Download ZIP Error]', error);
    if (!res.headersSent) {
      if (error instanceof OfficeConversionError) {
        res.status(503).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to generate submissions ZIP package.' });
    }
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch((error: unknown) => {
        logError('[Teacher Download ZIP Error] Failed to remove temporary ZIP files.', error);
      });
    }
  }
};

/**
 * 5. TEACHER DOWNLOAD SHARED ASSIGNMENT SUMMARY CSV
 */
export const downloadSharedAssignmentCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const teacherId = req.admin?.id;

    const shared = await SharedAssignment.findOne({ _id: id, teacherId, shareCsv: true })
      .populate('assignmentId')
      .populate('subjectId')
      .populate('classId');

    if (!shared || !shared.assignmentId) {
      res.status(404).json({ success: false, message: 'Shared CSV report not available or not authorized.' });
      return;
    }

    const assignment = shared.assignmentId as any;
    const subject = shared.subjectId as any;
    const targetClass = shared.classId as any;

    const submissions = await Submission.find({ assignmentId: assignment._id }).sort({ rollNumber: 1 });
    const submittedRolls = new Set(submissions.map((s) => s.rollNumber.trim().toUpperCase()));

    // Find defaulters if class is known
    let defaultersRows: string[] = [];
    if (targetClass) {
      const allClassStudents = await Student.find({ classId: targetClass._id, isEmailVerified: true }).sort({ rollNumber: 1 });
      const defaulters = allClassStudents.filter((s) => !submittedRolls.has(s.rollNumber.trim().toUpperCase()));

      defaultersRows = defaulters.map((s) =>
        [
          'N/A',
          sanitizeCsvField(s.rollNumber),
          sanitizeCsvField(s.name),
          sanitizeCsvField(s.email),
          sanitizeCsvField(`${subject?.name || 'Subject'} (${subject?.code || ''})`),
          sanitizeCsvField(assignment.title),
          'NO SUBMISSION',
          'N/A',
          'Not Submitted (Defaulter)',
          'N/A',
        ].join(',')
      );
    }

    const headers = ['Submission ID', 'Roll Number', 'Student Name', 'Email', 'Subject', 'Assignment', 'File Name', 'Submitted At', 'Status', 'Email Status'];

    const submittedRows = submissions.map((sub) => {
      const formattedDate = moment(sub.submittedAt).tz(timezone).format('YYYY-MM-DD HH:mm:ss');
      return [
        sanitizeCsvField(sub.submissionId),
        sanitizeCsvField(sub.rollNumber),
        sanitizeCsvField(sub.studentName),
        sanitizeCsvField(sub.email),
        sanitizeCsvField(`${subject?.name || 'Subject'} (${subject?.code || ''})`),
        sanitizeCsvField(assignment.title),
        sanitizeCsvField(sub.originalFileName),
        sanitizeCsvField(formattedDate),
        sanitizeCsvField(sub.status),
        sanitizeCsvField(sub.emailStatus),
      ].join(',');
    });

    const csvContent = [
      headers.join(','),
      ...submittedRows,
      ...(defaultersRows.length > 0 ? ['', '--- DEFAULTER STUDENTS (NO SUBMISSION) ---', ...defaultersRows] : []),
    ].join('\n');

    // Update download metrics
    shared.downloadCount = (shared.downloadCount || 0) + 1;
    shared.lastDownloadedAt = new Date();
    await shared.save();

    const cleanTitle = sanitizePathSegment(assignment.title);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${subject?.code || 'SUB'}_${cleanTitle}_Submissions_Report.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    logError('[Teacher Download CSV Error]', error);
    res.status(500).json({ success: false, message: 'Failed to export CSV report.' });
  }
};

/**
 * 6. REVOKE SHARED ASSIGNMENT (CR only)
 */
export const revokeSharedAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const shared = await SharedAssignment.findByIdAndDelete(id);
    if (!shared) {
      res.status(404).json({ success: false, message: 'Shared assignment record not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Shared assignment revoked successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to revoke shared assignment.' });
  }
};
