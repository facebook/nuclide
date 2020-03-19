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
import {track} from 'nuclide-analytics';
import updateKeymap from './updateKeymap';

/**
 * Put deprecated commands with their new equivalents here.
 * This will:
 * - automatically warn and forward direct dispatches of the old command
 * - prompt to automatically update the user keybindings
 */
const DEPRECATED_CONSOLE_COMMANDS = {
  'nuclide-console:toggle': 'console:toggle',
  'nuclide-console:clear': 'console:clear',
  'nuclide-console:copy-message': 'console:copy-message',
};

const DEPRECATED_DEBUGGER_COMMANDS = {
  'nuclide-debugger:toggle': 'debugger:toggle',
  'nuclide-debugger:show': 'debugger:show',
  'nuclide-debugger:hide': 'debugger:hide',
  'nuclide-debugger:restart-debugging': 'debugger:restart-debugging',
  'nuclide-debugger:continue-debugging': 'debugger:continue-debugging',
  'nuclide-debugger:stop-debugging': 'debugger:stop-debugging',
  'nuclide-debugger:step-over': 'debugger:step-over',
  'nuclide-debugger:step-into': 'debugger:step-into',
  'nuclide-debugger:step-out': 'debugger:step-out',
  'nuclide-debugger:run-to-location': 'debugger:run-to-location',
  'nuclide-debugger:toggle-breakpoint': 'debugger:toggle-breakpoint',
};

const DEPRECATED_FILE_TREE_COMMANDS = {
  'nuclide-file-tree:set-current-working-root':
    'tree-view:set-current-working-root',
  'nuclide-file-tree:add-file': 'tree-view:add-file',
  'nuclide-file-tree:add-file-relative': 'tree-view:add-file-relative',
  'nuclide-file-tree:add-folder': 'tree-view:add-folder',
  'nuclide-file-tree:remove-project-folder-selection':
    'tree-view:remove-project-folder-selection',
  'nuclide-file-tree:toggle': 'tree-view:toggle',
  'nuclide-file-tree:toggle-focus': 'tree-view:toggle-focus',
  'nuclide-file-tree:reveal-active-file': 'tree-view:reveal-active-file',
  'nuclide-file-tree:rename-selection': 'tree-view:rename-selection',
  'nuclide-file-tree:copy-selection': 'tree-view:copy-selection',
  'nuclide-file-tree:paste-selection': 'tree-view:paste-selection',
  'nuclide-file-tree:duplicate-selection': 'tree-view:duplicate-selection',
  'nuclide-file-tree:expand-directory': 'tree-view:expand-directory',
  'nuclide-file-tree:collapse-directory': 'tree-view:collapse-directory',
  'nuclide-file-tree:recursive-expand-directory':
    'tree-view:recursive-expand-directory',
  'nuclide-file-tree:recursive-collapse-directory':
    'tree-view:recursive-collapse-directory',
  'nuclide-file-tree:recursive-collapse-all':
    'tree-view:recursive-collapse-all',
  'nuclide-file-tree:open-selected-entry': 'tree-view:open-selected-entry',
  'nuclide-file-tree:open-selected-entry-right':
    'tree-view:open-selected-entry-right',
  'nuclide-file-tree:open-selected-entry-left':
    'tree-view:open-selected-entry-left',
  'nuclide-file-tree:open-selected-entry-up':
    'tree-view:open-selected-entry-up',
  'nuclide-file-tree:open-selected-entry-down':
    'tree-view:open-selected-entry-down',
  'nuclide-file-tree:search-in-directory': 'tree-view:search-in-directory',
  'nuclide-file-tree:remove': 'tree-view:remove',
  'nuclide-file-tree:remove-letter': 'tree-view:remove-letter',
  'nuclide-file-tree:clear-filter': 'tree-view:clear-filter',
  'nuclide-file-tree:go-to-letter-!': 'tree-view:go-to-letter-!',
  'nuclide-file-tree:go-to-letter-#': 'tree-view:go-to-letter-#',
  'nuclide-file-tree:go-to-letter-.': 'tree-view:go-to-letter-.',
  'nuclide-file-tree:go-to-letter-/': 'tree-view:go-to-letter-/',
  'nuclide-file-tree:go-to-letter-0': 'tree-view:go-to-letter-0',
  'nuclide-file-tree:go-to-letter-1': 'tree-view:go-to-letter-1',
  'nuclide-file-tree:go-to-letter-2': 'tree-view:go-to-letter-2',
  'nuclide-file-tree:go-to-letter-3': 'tree-view:go-to-letter-3',
  'nuclide-file-tree:go-to-letter-4': 'tree-view:go-to-letter-4',
  'nuclide-file-tree:go-to-letter-5': 'tree-view:go-to-letter-5',
  'nuclide-file-tree:go-to-letter-6': 'tree-view:go-to-letter-6',
  'nuclide-file-tree:go-to-letter-7': 'tree-view:go-to-letter-7',
  'nuclide-file-tree:go-to-letter-8': 'tree-view:go-to-letter-8',
  'nuclide-file-tree:go-to-letter-9': 'tree-view:go-to-letter-9',
  'nuclide-file-tree:go-to-letter--': 'tree-view:go-to-letter--',
  'nuclide-file-tree:go-to-letter-:': 'tree-view:go-to-letter-:',
  'nuclide-file-tree:go-to-letter-;': 'tree-view:go-to-letter-;',
  'nuclide-file-tree:go-to-letter-?': 'tree-view:go-to-letter-?',
  'nuclide-file-tree:go-to-letter-@': 'tree-view:go-to-letter-@',
  'nuclide-file-tree:go-to-letter-A': 'tree-view:go-to-letter-A',
  'nuclide-file-tree:go-to-letter-B': 'tree-view:go-to-letter-B',
  'nuclide-file-tree:go-to-letter-C': 'tree-view:go-to-letter-C',
  'nuclide-file-tree:go-to-letter-D': 'tree-view:go-to-letter-D',
  'nuclide-file-tree:go-to-letter-E': 'tree-view:go-to-letter-E',
  'nuclide-file-tree:go-to-letter-F': 'tree-view:go-to-letter-F',
  'nuclide-file-tree:go-to-letter-G': 'tree-view:go-to-letter-G',
  'nuclide-file-tree:go-to-letter-H': 'tree-view:go-to-letter-H',
  'nuclide-file-tree:go-to-letter-I': 'tree-view:go-to-letter-I',
  'nuclide-file-tree:go-to-letter-J': 'tree-view:go-to-letter-J',
  'nuclide-file-tree:go-to-letter-K': 'tree-view:go-to-letter-K',
  'nuclide-file-tree:go-to-letter-L': 'tree-view:go-to-letter-L',
  'nuclide-file-tree:go-to-letter-M': 'tree-view:go-to-letter-M',
  'nuclide-file-tree:go-to-letter-N': 'tree-view:go-to-letter-N',
  'nuclide-file-tree:go-to-letter-O': 'tree-view:go-to-letter-O',
  'nuclide-file-tree:go-to-letter-P': 'tree-view:go-to-letter-P',
  'nuclide-file-tree:go-to-letter-Q': 'tree-view:go-to-letter-Q',
  'nuclide-file-tree:go-to-letter-R': 'tree-view:go-to-letter-R',
  'nuclide-file-tree:go-to-letter-S': 'tree-view:go-to-letter-S',
  'nuclide-file-tree:go-to-letter-T': 'tree-view:go-to-letter-T',
  'nuclide-file-tree:go-to-letter-U': 'tree-view:go-to-letter-U',
  'nuclide-file-tree:go-to-letter-V': 'tree-view:go-to-letter-V',
  'nuclide-file-tree:go-to-letter-W': 'tree-view:go-to-letter-W',
  'nuclide-file-tree:go-to-letter-X': 'tree-view:go-to-letter-X',
  'nuclide-file-tree:go-to-letter-Y': 'tree-view:go-to-letter-Y',
  'nuclide-file-tree:go-to-letter-Z': 'tree-view:go-to-letter-Z',
  'nuclide-file-tree:go-to-letter-_': 'tree-view:go-to-letter-_',
  'nuclide-file-tree:go-to-letter-a': 'tree-view:go-to-letter-a',
  'nuclide-file-tree:go-to-letter-b': 'tree-view:go-to-letter-b',
  'nuclide-file-tree:go-to-letter-c': 'tree-view:go-to-letter-c',
  'nuclide-file-tree:go-to-letter-d': 'tree-view:go-to-letter-d',
  'nuclide-file-tree:go-to-letter-e': 'tree-view:go-to-letter-e',
  'nuclide-file-tree:go-to-letter-f': 'tree-view:go-to-letter-f',
  'nuclide-file-tree:go-to-letter-g': 'tree-view:go-to-letter-g',
  'nuclide-file-tree:go-to-letter-h': 'tree-view:go-to-letter-h',
  'nuclide-file-tree:go-to-letter-i': 'tree-view:go-to-letter-i',
  'nuclide-file-tree:go-to-letter-j': 'tree-view:go-to-letter-j',
  'nuclide-file-tree:go-to-letter-k': 'tree-view:go-to-letter-k',
  'nuclide-file-tree:go-to-letter-l': 'tree-view:go-to-letter-l',
  'nuclide-file-tree:go-to-letter-m': 'tree-view:go-to-letter-m',
  'nuclide-file-tree:go-to-letter-n': 'tree-view:go-to-letter-n',
  'nuclide-file-tree:go-to-letter-o': 'tree-view:go-to-letter-o',
  'nuclide-file-tree:go-to-letter-p': 'tree-view:go-to-letter-p',
  'nuclide-file-tree:go-to-letter-q': 'tree-view:go-to-letter-q',
  'nuclide-file-tree:go-to-letter-r': 'tree-view:go-to-letter-r',
  'nuclide-file-tree:go-to-letter-s': 'tree-view:go-to-letter-s',
  'nuclide-file-tree:go-to-letter-t': 'tree-view:go-to-letter-t',
  'nuclide-file-tree:go-to-letter-u': 'tree-view:go-to-letter-u',
  'nuclide-file-tree:go-to-letter-v': 'tree-view:go-to-letter-v',
  'nuclide-file-tree:go-to-letter-w': 'tree-view:go-to-letter-w',
  'nuclide-file-tree:go-to-letter-x': 'tree-view:go-to-letter-x',
  'nuclide-file-tree:go-to-letter-y': 'tree-view:go-to-letter-y',
  'nuclide-file-tree:go-to-letter-z': 'tree-view:go-to-letter-z',
  'nuclide-file-tree:go-to-letter-~': 'tree-view:go-to-letter-~',
};

const DEPRECATED_TERMINAL_COMMANDS = {
  'nuclide-terminal:new-terminal': 'atom-ide-terminal:new-terminal',
  'nuclide-terminal:toggle-terminal-focus':
    'atom-ide-terminal:toggle-terminal-focus',
  'nuclide-terminal:add-escape-prefix': 'atom-ide-terminal:add-escape-prefix',
  'nuclide-terminal:create-paste': 'atom-ide-terminal:create-paste',
  'nuclide-terminal:clear': 'atom-ide-terminal:clear',
};

const DEPRECATED_SOURCE_CONTROL_COMMANDS = {
  'fb-interactive-smartlog:copy-differential-id':
    'fb-interactive-smartlog:copy-diff-number',
  'fb-interactive-smartlog:copy-revision-hash':
    'fb-interactive-smartlog:copy-commit-hash',
  'fb-interactive-smartlog:strip-revision':
    'fb-interactive-smartlog:strip-commit',
  'fb-interactive-smartlog:abandon-revision':
    'fb-interactive-smartlog:abandon-diff',
  'fb-interactive-smartlog:accept-revision':
    'fb-interactive-smartlog:accept-diff',
  'fb-interactive-smartlog:publish-revision':
    'fb-interactive-smartlog:publish-diff',
  'fb-interactive-smartlog:reclaim-revision':
    'fb-interactive-smartlog:reclaim-diff',
  'fb-interactive-smartlog:reject-revision':
    'fb-interactive-smartlog:reject-diff',
  'fb-interactive-smartlog:request-revision':
    'fb-interactive-smartlog:request-diff',
  'fb-interactive-smartlog:rethink-revision':
    'fb-interactive-smartlog:rethink-diff',
};

const DEPRECATED_RELATED_FILES_COMMANDS = {
  'nuclide-related-files:switch-between-header-source': 'file:open-alternate',
  'nuclide-related-files:jump-to-next-related-file': 'file:open-alternate',
  'nuclide-related-files:jump-to-previous-related-file': 'file:open-alternate',
};

const DEPRECATED_COMMANDS = {
  ...DEPRECATED_CONSOLE_COMMANDS,
  ...DEPRECATED_DEBUGGER_COMMANDS,
  ...DEPRECATED_FILE_TREE_COMMANDS,
  ...DEPRECATED_TERMINAL_COMMANDS,
  ...DEPRECATED_SOURCE_CONTROL_COMMANDS,
  ...DEPRECATED_RELATED_FILES_COMMANDS,
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
