/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

/* @providesModule HgConstants */

import type {
  AmendModeValue,
  CommitPhaseType,
  MergeConflictStatusCodeId,
  MergeConflictStatusValue,
  StatusCodeIdValue,
  StatusCodeNumberValue,
  SuccessorTypeValue,
} from './HgService';

const StatusCodeId = Object.freeze({
  ADDED: 'A',
  CLEAN: 'C',
  IGNORED: 'I',
  MODIFIED: 'M',
  MISSING: '!', // (deleted by non-hg command, but still tracked)
  REMOVED: 'R',
  UNTRACKED: '?',
  UNRESOLVED: 'U',
});

// This is to work around flow's missing support of enums.
(StatusCodeId: {[key: string]: StatusCodeIdValue});

const StatusCodeNumber = Object.freeze({
  ADDED: 1,
  CLEAN: 2,
  IGNORED: 3,
  MODIFIED: 4,
  MISSING: 5,
  REMOVED: 6,
  UNTRACKED: 7,
  UNRESOLVED: 8,
});

// This is to work around flow's missing support of enums.
(StatusCodeNumber: {[key: string]: StatusCodeNumberValue});

const StatusCodeIdToNumber: {
  [key: StatusCodeIdValue]: StatusCodeNumberValue,
} = {
  [StatusCodeId.ADDED]: StatusCodeNumber.ADDED,
  [StatusCodeId.CLEAN]: StatusCodeNumber.CLEAN,
  [StatusCodeId.IGNORED]: StatusCodeNumber.IGNORED,
  [StatusCodeId.MODIFIED]: StatusCodeNumber.MODIFIED,
  [StatusCodeId.MISSING]: StatusCodeNumber.MISSING,
  [StatusCodeId.REMOVED]: StatusCodeNumber.REMOVED,
  [StatusCodeId.UNTRACKED]: StatusCodeNumber.UNTRACKED,
  [StatusCodeId.UNRESOLVED]: StatusCodeNumber.UNRESOLVED,
};

const MergeConflictStatus = Object.freeze({
  BOTH_CHANGED: 'both changed',
  DELETED_IN_THEIRS: 'deleted in theirs',
  DELETED_IN_OURS: 'deleted in ours',
  RESOLVED: 'resolved',
});

// This is to work around flow's missing support of enums.
(MergeConflictStatus: {[key: string]: MergeConflictStatusValue});

const AmendMode = Object.freeze({
  CLEAN: 'Clean',
  FIXUP: 'Fixup',
  REBASE: 'Rebase',
});

// This is to work around flow's missing support of enums.
(AmendMode: {[key: string]: AmendModeValue});

const CommitPhase = Object.freeze({
  PUBLIC: 'public',
  DRAFT: 'draft',
  SECRET: 'secret',
});

// This is to work around flow's missing support of enums.
(CommitPhase: {[key: string]: CommitPhaseType});

const SuccessorType = Object.freeze({
  PUBLIC: 'public',
  AMEND: 'amend',
  REBASE: 'rebase',
  SPLIT: 'split',
  FOLD: 'fold',
  HISTEDIT: 'histedit',
});

// This is to work around flow's missing support of enums.
(SuccessorType: {[key: string]: SuccessorTypeValue});

const MergeConflictFileStatus = Object.freeze({
  RESOLVED: 'R',
  UNRESOLVED: 'U',
});

(MergeConflictFileStatus: {[key: string]: MergeConflictStatusCodeId});

const HEAD_REVISION_EXPRESSION = '.';

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = {
  AmendMode,
  CommitPhase,
  HEAD_REVISION_EXPRESSION,
  MergeConflictStatus,
  MergeConflictFileStatus,
  StatusCodeId,
  StatusCodeIdToNumber,
  StatusCodeNumber,
  SuccessorType,
};
