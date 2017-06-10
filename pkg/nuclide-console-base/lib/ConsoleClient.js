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

import {dispatchConsoleToggle, pipeProcessMessagesToConsole} from './main';

const SHOW_CONSOLE_ON_PROCESS_EVENTS = ['stdout', 'stderr', 'error'];

export default class ConsoleClient {
  _consoleShown: boolean;
  _processName: string;
  _progressUpdates: Subject<Message>;
  _showNotificationOnCompletion: boolean;

  constructor(
    processName: string,
    progressUpdates: Subject<Message>,
    showNotificationOnCompletion?: boolean = true,
  ) {
    this._processName = processName;
    this._progressUpdates = progressUpdates;
    this._consoleShown = false;
    this._showNotificationOnCompletion = showNotificationOnCompletion;
  }

  enableAndPipeProcessMessagesToConsole(
    processMessage: LegacyProcessMessage /* TODO(T17463635) */,
  ) {
    pipeProcessMessagesToConsole(
      this._processName,
      this._progressUpdates,
      this._showNotificationOnCompletion,
      processMessage,
    );
    if (
      !this._consoleShown &&
      SHOW_CONSOLE_ON_PROCESS_EVENTS.includes(processMessage.kind)
    ) {
      dispatchConsoleToggle(true);
      this._consoleShown = true;
    }
  }
}
