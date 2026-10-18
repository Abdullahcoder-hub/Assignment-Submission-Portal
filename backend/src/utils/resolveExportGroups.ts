export type ExportGroupRecord = {
  id: string;
  assignmentId: string | null;
  name: string;
  memberRollNumbers: string[];
};

export type ExportSubmissionGroup = {
  id: string;
  rollNumber: string;
  groupId?: string | null;
  groupName?: string | null;
};

const normalizeRollNumber = (rollNumber: string): string => rollNumber.trim().toLowerCase();

export const resolveExportGroups = <T extends ExportSubmissionGroup>(
  submissions: T[],
  assignmentId: string,
  groups: ExportGroupRecord[],
): Array<T & { groupId: string; groupName: string }> =>
  submissions.map((submission) => {
    const rollNumber = normalizeRollNumber(submission.rollNumber);
    const membershipMatches = groups.filter((group) =>
      group.memberRollNumbers.some((memberRollNumber) => normalizeRollNumber(memberRollNumber) === rollNumber)
    );
    const assignmentGroups = membershipMatches.filter((group) => group.assignmentId === assignmentId);
    const candidates = assignmentGroups.length > 0
      ? assignmentGroups
      : membershipMatches.filter((group) => group.assignmentId === null);
    const matchedGroup = (submission.groupId
      ? candidates.find((group) => group.id === submission.groupId)
      : undefined) || (candidates.length === 1 ? candidates[0] : undefined);

    return matchedGroup
      ? {
          ...submission,
          groupId: matchedGroup.id,
          groupName: matchedGroup.name,
        }
      : {
          ...submission,
          groupId: `unmatched:${submission.id}`,
          groupName: `Submission_${submission.rollNumber}`,
        };
  });
