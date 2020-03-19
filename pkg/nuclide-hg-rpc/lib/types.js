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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

/**
 * These are status codes used by Mercurial's output.
 * Documented in http://selenic.com/hg/help/status.
 */
export type StatusCodeIdValue = 'A' | 'C' | 'I' | 'M' | '!' | 'R' | '?' | 'U';

export type MergeConflictStatusValue =
  | 'both changed'
  | 'deleted in theirs'
  | 'deleted in ours'
  | 'resolved';

export type MergeConflictStatusCodeId = 'R' | 'U';

/**
 * Internally, the HgRepository uses the string StatusCodeId to do bookkeeping.
 * However, GitRepository uses numbers to represent its statuses, and returns
 * statuses as numbers. In order to keep our status 'types' the same, we map the
 * string StatusCodeId to numbers.
 * The numbers themselves should not matter; they are meant to be passed
 * to ::isStatusNew/::isStatusModified to be interpreted.
 */
export type StatusCodeNumberValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type LineDiff = {
  oldStart: number,
  oldLines: number,
  newStart: number,
  newLines: number,
  oldText?: string,
};

export type BookmarkInfo = {
  active: boolean,
  bookmark: string,
  node: string,
};

export type DiffInfo = {
  added: number,
  deleted: number,
  lineDiffs: Array<LineDiff>,
};

export type CommitPhaseType = 'public' | 'draft' | 'secret';

export type SuccessorTypeValue =
  | 'public'
  | 'amend'
  | 'rebase'
  | 'split'
  | 'fold'
  | 'histedit'
  | 'rewritten';

export type HisteditActionsValue = 'pick';

export type RevisionSuccessorInfo = {
  hash: string,
  type: SuccessorTypeValue,
};

export type RevisionInfo = {
  author: string,
  bookmarks: Array<string>,
  branch: string,
  date: Date,
  description: string,
  hash: string,
  id: number,
  isHead: boolean,
  remoteBookmarks: Array<string>,
  parents: Array<string>,
  phase: CommitPhaseType,
  successorInfo: ?RevisionSuccessorInfo,
  tags: Array<string>,
  title: string,
  files: Array<string>,
  previousHashes?: Array<string>,
};

export type RevisionShowInfo = {
  diff: string,
};

export type RevisionInfoFetched = {
  revisions: Array<RevisionInfo>,
  fromFilesystem: boolean,
};

export type AsyncExecuteRet = {
  command?: string,
  errorMessage?: string,
  exitCode: number,
  stderr: string,
  stdout: string,
};

export type RevisionFileCopy = {
  from: NuclideUri,
  to: NuclideUri,
};

export type RevisionFileChanges = {
  all: Array<NuclideUri>,
  added: Array<NuclideUri>,
  deleted: Array<NuclideUri>,
  copied: Array<RevisionFileCopy>,
  modified: Array<NuclideUri>,
};

export type VcsLogEntry = {
  node: string,
  author: string,
  desc: string,
  date: [number, number],
};

export type VcsLogResponse = {
  entries: Array<VcsLogEntry>,
};

// Information about file for local, base and other commit that caused the conflict
export type MergeConflictSideFileData = {
  contents: ?string,
  exists: boolean,
  isexec: ?boolean,
  issymlink: ?boolean,
};

// Information about the output file
export type MergeConflictOutputFileData = MergeConflictSideFileData & {
  path: NuclideUri,
};

export type MergeConflictFileData = {
  base: MergeConflictSideFileData,
  local: MergeConflictSideFileData,
  other: MergeConflictSideFileData,
  output: MergeConflictOutputFileData,
  status: MergeConflictStatusValue,
  conflictCount?: number,
};

export type MergeConflicts = {
  conflicts: Array<MergeConflictFileData>,
  command: string,
  command_details: {
    cmd: string,
    to_abort: string,
    to_continue: string,
  },
};

export type CheckoutSideName = 'ours' | 'theirs';

export type AmendModeValue = 'Clean' | 'Rebase' | 'Fixup';

export type CheckoutOptions = {
  clean?: true,
};

export type OperationProgressState = {
  active: ?boolean,
  estimate_sec: ?number,
  estimate_str: ?string,
  item: ?string,
  pos: ?number,
  speed_str: ?string,
  topic: ?string,
  total: ?number,
  unit: ?string,
  units_per_sec: ?number,
};
export type OperationProgress = {
  topics: Array<string>,
  state: Object,
};
