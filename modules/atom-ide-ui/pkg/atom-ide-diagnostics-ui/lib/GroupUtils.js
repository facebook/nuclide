/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {IconName} from 'nuclide-commons-ui/Icon';
import type {DiagnosticMessage} from '../../atom-ide-diagnostics/lib/types';
import type {DiagnosticGroup} from './types';

const PRIORITIZED_GROUPS: Array<DiagnosticGroup> = [
  'review',
  'errors',
  'warnings',
  'info',
];

export function getGroup(message: DiagnosticMessage): DiagnosticGroup {
  const {kind} = message;
  switch (kind) {
    case 'lint':
    case null:
    case undefined:
      // We have a separate button for each severity.
      switch (message.type) {
        case 'Error':
          return 'errors';
        case 'Warning':
          return 'warnings';
        case 'Info':
          return 'info';
        default:
          (message.type: empty);
          throw new Error(`Invalid message severity: ${message.type}`);
      }
    case 'review':
      return 'review';
    default:
      (kind: empty);
      throw new Error(`Invalid message kind: ${kind}`);
  }
}

export function getDisplayName(group: DiagnosticGroup): string {
  switch (group) {
    case 'errors':
      return 'Errors';
    case 'warnings':
      return 'Warnings';
    case 'info':
      return 'Info';
    case 'review':
      return 'Review';
    default:
      (group: empty);
      throw new Error(`Invalid group: ${group}`);
  }
}

export function getIcon(group: DiagnosticGroup): IconName {
  switch (group) {
    case 'errors':
      return 'nuclicon-error';
    case 'warnings':
      return 'nuclicon-warning';
    case 'info':
      return 'info';
    case 'review':
      return 'nuclicon-comment-discussion';
    default:
      (group: empty);
      throw new Error(`Invalid filter type: ${group}`);
  }
}

export function getHighestPriorityGroup(
  groups: Set<DiagnosticGroup>,
): DiagnosticGroup {
  for (const group of PRIORITIZED_GROUPS) {
    if (groups.has(group)) {
      return group;
    }
  }
  throw new Error(`Invalid group set: ${[...groups].toString()}`);
}
