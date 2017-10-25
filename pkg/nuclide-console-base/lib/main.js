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

import type {Message} from '../../nuclide-console/lib/types';
import type {LegacyProcessMessage} from 'nuclide-commons/process';

import {Subject} from 'rxjs';

// This must match URI defined in ../../nuclide-console/lib/ui/ConsoleContainer
const CONSOLE_VIEW_URI = 'atom://nuclide/console';

export function changeConsoleVisibility(visible: boolean): void {
  switch (visible) {
    case true:
      // eslint-disable-next-line rulesdir/atom-apis
      atom.workspace.open(CONSOLE_VIEW_URI, {searchAllPanes: true});
      return;
    case false:
      atom.workspace.hide(CONSOLE_VIEW_URI);
      return;
    default:
      atom.workspace.toggle(CONSOLE_VIEW_URI);
      return;
  }
}

export function pipeProcessMessagesToConsole(
  processName: string,
  progressUpdates: Subject<Message>,
  showNotificationOnCompletion: boolean,
  processMessage: LegacyProcessMessage /* TODO(T17463635) */,
): void {
  switch (processMessage.kind) {
    case 'stderr':
      progressUpdates.next({text: processMessage.data, level: 'error'});
      break;

    case 'stdout':
      progressUpdates.next({text: processMessage.data, level: 'info'});
      break;

    case 'error':
      const {error} = processMessage;
      progressUpdates.next({
        text: error.message || String(error),
        level: 'error',
      });
      break;

    case 'exit':
      if (processMessage.exitCode === 0) {
        progressUpdates.next({
          text: `${processName} completed successfully`,
          level: 'success',
        });
        if (showNotificationOnCompletion) {
          atom.notifications.addSuccess('Operation completed successfully', {
            detail: `${processName} finished`,
          });
        }
      } else {
        progressUpdates.next({
          text: `${processName} exited with non zero code`,
          level: 'error',
        });
        if (showNotificationOnCompletion) {
          atom.notifications.addError('Operation Failed', {
            detail: 'Check console for output',
          });
        }
        changeConsoleVisibility(true /* console visibility */);
      }
      break;
  }
}
