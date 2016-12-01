'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  CommitModeType,
  CommitModeStateType,
  DiffModeType,
  DiffOptionType,
  PublishModeType,
  PublishModeStateType,
  NavigationSectionStatusType,
} from './types';

export const DiffMode = Object.freeze({
  BROWSE_MODE: '1. Browse',
  COMMIT_MODE: '2. Commit',
  PUBLISH_MODE: '3. Publish',
});

// This is to work around flow's missing support of enums.
(DiffMode: {[key: string]: DiffModeType});

export const DiffOption = Object.freeze({
  DIRTY: 'Dirty',
  LAST_COMMIT: 'Last Commit',
  COMPARE_COMMIT: 'Compare Commit',
});

// This is to work around flow's missing support of enums.
(DiffOption: {[key: string]: DiffOptionType});

export const CommitMode = Object.freeze({
  COMMIT: 'Commit',
  AMEND: 'Amend',
});

// This is to work around flow's missing support of enums.
(CommitMode: {[key: string]: CommitModeType});

export const CommitModeState = Object.freeze({
  READY: 'Ready',
  LOADING_COMMIT_MESSAGE: 'Loading Commit Message',
  AWAITING_COMMIT: 'Awaiting Commit',
});

// This is to work around flow's missing support of enums.
(CommitModeState: {[key: string]: CommitModeStateType});

export const PublishMode = Object.freeze({
  CREATE: 'Create',
  UPDATE: 'Update',
});

// This is to work around flow's missing support of enums.
(PublishMode: {[key: string]: PublishModeType});

export const PublishModeState = Object.freeze({
  READY: 'Ready',
  LOADING_PUBLISH_MESSAGE: 'Loading Publish Message',
  AWAITING_PUBLISH: 'Awaiting Publish',
  PUBLISH_ERROR: 'Publish Error',
});

// This is to work around flow's missing support of enums.
(PublishModeState: {[key: string]: PublishModeStateType});

export const NON_MERCURIAL_REPO_DISPLAY_NAME = '[X] Non-Mercurial Repository';

export const NavigationSectionStatus = Object.freeze({
  ADDED: 'Added',
  CHANGED: 'Changed',
  REMOVED: 'Removed',
  NEW_ELEMENT: 'New Element',
  OLD_ELEMENT: 'Old Element',
});

// This is to work around flow's missing support of enums.
(NavigationSectionStatus: {[key: string]: NavigationSectionStatusType});

export const LintErrorMessages = [
  'Usage Exception: Lint',
  'ESLint reported a warning',
];

export const DIFF_VIEW_NAVIGATOR_TOGGLE_COMMAND = 'diff-view-navigator:toggle';
export const DIFF_EDITOR_MARKER_CLASS = 'nuclide-diff-editor-marker';
export const SHOULD_DOCK_PUBLISH_VIEW_CONFIG_KEY = 'nuclide-diff-view.shouldDockPublishView';
