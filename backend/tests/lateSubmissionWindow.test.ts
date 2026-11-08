import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLateSubmissionGrantActive, LATE_SUBMISSION_WINDOW_MS } from '../src/utils/lateSubmissionWindow.js';

test('late approval is active only for five minutes after the decision', () => {
  const decidedAt = new Date('2026-11-08T10:00:00.000Z');

  assert.equal(isLateSubmissionGrantActive(decidedAt, decidedAt), true);
  assert.equal(
    isLateSubmissionGrantActive(
      decidedAt,
      new Date(decidedAt.getTime() + LATE_SUBMISSION_WINDOW_MS - 1),
    ),
    true,
  );
  assert.equal(
    isLateSubmissionGrantActive(
      decidedAt,
      new Date(decidedAt.getTime() + LATE_SUBMISSION_WINDOW_MS),
    ),
    false,
  );
  assert.equal(isLateSubmissionGrantActive(decidedAt, new Date(decidedAt.getTime() - 1)), false);
});

test('late approval rejects missing or invalid decision times', () => {
  assert.equal(isLateSubmissionGrantActive(undefined), false);
  assert.equal(isLateSubmissionGrantActive('not-a-date'), false);
});
