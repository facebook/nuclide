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

import {getLogger} from 'log4js';
import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from '../../nuclide-analytics';
import updateKeymap from './updateKeymap';

/**
 * Put deprecated commands with their new equivalents here.
 * This will:
 * - automatically warn and forward direct dispatches of the old command
 * - prompt to automatically update the user keybindings
 */
const DEPRECATED_COMMANDS = {
  'nuclide-code-format:format-code': 'code-format:format-code',
  'nuclide-datatip:copy-to-clipboard': 'datatip:copy-to-clipboard',
  'nuclide-datatip:toggle': 'datatip:toggle',
  'nuclide-diagnostics-ui:fix-all-in-current-file':
    'diagnostics:fix-all-in-current-file',
  'nuclide-diagnostics-ui:go-to-first-diagnostic':
    'diagnostics:go-to-first-diagnostic',
  'nuclide-diagnostics-ui:go-to-last-diagnostic':
    'diagnostics:go-to-last-diagnostic',
  'nuclide-diagnostics-ui:go-to-next-diagnostic-trace':
    'diagnostics:go-to-next-diagnostic-trace',
  'nuclide-diagnostics-ui:go-to-next-diagnostic':
    'diagnostics:go-to-next-diagnostic',
  'nuclide-diagnostics-ui:go-to-previous-diagnostic-trace':
    'diagnostics:go-to-previous-diagnostic-trace',
  'nuclide-diagnostics-ui:go-to-previous-diagnostic':
    'diagnostics:go-to-previous-diagnostic',
  'nuclide-diagnostics-ui:open-all-files-with-errors':
    'diagnostics:open-all-files-with-errors',
  'nuclide-diagnostics-ui:toggle-table': 'diagnostics:toggle-table',
  'nuclide-find-references:activate': 'find-references:activate',
  'nuclide-outline-view:toggle': 'outline-view:toggle',
};

class Activation {
  _disposables: UniversalDisposable;
  _warnedCommands: Set<string>;

  constructor() {
    this._warnedCommands = new Set();
    this._disposables = new UniversalDisposable(this._deprecateCommands());

    // $FlowIgnore: private API
    const keymapPath = atom.keymaps.getUserKeymapPath();
    updateKeymap(keymapPath, DEPRECATED_COMMANDS).catch(err => {
      // Nonexistent keymaps are normal.
      if (err.code !== 'ENOENT') {
        getLogger('nuclide-deprecation-cop').error(
          'Error updating user keymap:',
          err,
        );
      }
    });
  }

  _deprecateCommands(): IDisposable {
    // Catch any direct invocations of the commands (context menu, dispatch).
    return atom.commands.onWillDispatch((event: any) => {
      const command = event.type;
      if (!DEPRECATED_COMMANDS.hasOwnProperty(command)) {
        return;
      }
      const newCommand = DEPRECATED_COMMANDS[command];
      if (!this._warnedCommands.has(command)) {
        track('deprecated-command-dispatched', {command});
        atom.notifications.addWarning('Nuclide: Deprecated Command', {
          icon: 'nuclicon-nuclide',
          description:
            `The command \`${command}\` has been deprecated.\n` +
            `Please use the new command \`${newCommand}\`.`,
          dismissable: true,
        });
        this._warnedCommands.add(command);
      }
      atom.commands.dispatch(event.target, newCommand, event.detail);
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
