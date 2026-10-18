import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveExportGroups,
  type ExportGroupRecord,
} from '../src/utils/resolveExportGroups.js';

const groups: ExportGroupRecord[] = [
  {
    id: 'group-1',
    assignmentId: 'assignment-1',
    name: 'Group 1',
    memberRollNumbers: ['2260001', '2260003'],
  },
  {
    id: 'legacy-group',
    assignmentId: null,
    name: 'Legacy Group',
    memberRollNumbers: ['2260004'],
  },
];

test('resolves legacy submission group metadata from assignment membership', () => {
  const [resolved] = resolveExportGroups(
    [{ id: 'submission-1', rollNumber: '2260003', groupId: null, groupName: null, sequenceNumber: null }],
    'assignment-1',
    groups,
  );

  assert.equal(resolved.groupId, 'group-1');
  assert.equal(resolved.groupName, 'Group 1');
  assert.equal(resolved.sequenceNumber, null);
});

test('preserves a known group and resolves legacy group registrations', () => {
  const resolved = resolveExportGroups(
    [
      { id: 'submission-1', rollNumber: '2260001', groupId: 'group-1', groupName: 'Old group label' },
      { id: 'submission-2', rollNumber: '2260004', groupId: null, groupName: null },
    ],
    'assignment-1',
    groups,
  );

  assert.deepEqual(resolved.map(({ groupId, groupName }) => ({ groupId, groupName })), [
    { groupId: 'group-1', groupName: 'Group 1' },
    { groupId: 'legacy-group', groupName: 'Legacy Group' },
  ]);
});

test('keeps only submitted members together and preserves sequence gaps', () => {
  const submissions = [
    { id: 'submission-1', rollNumber: '2260001', groupId: 'group-1', groupName: 'Group 1', sequenceNumber: 1 },
    { id: 'submission-3', rollNumber: '2260003', groupId: 'group-1', groupName: 'Group 1', sequenceNumber: 3 },
  ];
  const resolved = resolveExportGroups(submissions, 'assignment-1', groups);

  assert.equal(resolved.length, 2);
  assert.deepEqual(resolved.map(({ groupId, sequenceNumber }) => ({ groupId, sequenceNumber })), [
    { groupId: 'group-1', sequenceNumber: 1 },
    { groupId: 'group-1', sequenceNumber: 3 },
  ]);
});

test('resolves submissions from different groups to separate group identifiers', () => {
  const resolved = resolveExportGroups(
    [
      { id: 'submission-1', rollNumber: '2260001', groupId: 'group-1', groupName: 'Group 1' },
      { id: 'submission-4', rollNumber: '2260004', groupId: 'legacy-group', groupName: 'Legacy Group' },
    ],
    'assignment-1',
    groups,
  );

  assert.deepEqual(resolved.map(({ groupId, groupName }) => ({ groupId, groupName })), [
    { groupId: 'group-1', groupName: 'Group 1' },
    { groupId: 'legacy-group', groupName: 'Legacy Group' },
  ]);
});

test('keeps submissions with missing or ambiguous group metadata as separate export units', () => {
  const resolved = resolveExportGroups(
    [
      { id: 'submission-1', rollNumber: '2260099', groupId: null, groupName: null },
      { id: 'submission-2', rollNumber: '2260001', groupId: 'missing-group', groupName: null },
      { id: 'submission-3', rollNumber: '2260003', groupId: null, groupName: null },
    ],
    'assignment-1',
    [...groups, { ...groups[0], id: 'duplicate-group', name: 'Duplicate Group' }],
  );

  assert.deepEqual(resolved.map(({ id, groupId, groupName }) => ({ id, groupId, groupName })), [
    { id: 'submission-1', groupId: 'unmatched:submission-1', groupName: 'Submission_2260099' },
    { id: 'submission-2', groupId: 'unmatched:submission-2', groupName: 'Submission_2260001' },
    { id: 'submission-3', groupId: 'unmatched:submission-3', groupName: 'Submission_2260003' },
  ]);
});
