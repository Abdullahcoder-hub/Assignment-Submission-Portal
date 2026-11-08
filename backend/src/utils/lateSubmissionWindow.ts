export const LATE_SUBMISSION_WINDOW_MS = 5 * 60 * 1000;

export const isLateSubmissionGrantActive = (
  decidedAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!decidedAt) return false;
  const approvalTime = new Date(decidedAt).getTime();
  const currentTime = now.getTime();
  return Number.isFinite(approvalTime)
    && currentTime >= approvalTime
    && currentTime < approvalTime + LATE_SUBMISSION_WINDOW_MS;
};
