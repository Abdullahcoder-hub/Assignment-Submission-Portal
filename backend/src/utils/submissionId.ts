import moment from 'moment-timezone';

const timezone = process.env.TIMEZONE || 'Asia/Karachi';

/**
 * Generates a unique submission ID in the format: SUB-{SUBJECT_CODE}-{YYYYMMDD}-{XXXX}
 * Example: SUB-OOP-20260911-0042
 */
export const generateSubmissionId = (subjectCode: string): string => {
  const cleanCode = subjectCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'SUB';
  const dateStr = moment().tz(timezone).format('YYYYMMDD');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `SUB-${cleanCode}-${dateStr}-${randomSuffix}`;
};
