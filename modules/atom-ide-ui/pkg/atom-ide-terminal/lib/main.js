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

import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
// for homedir
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import os from 'os';
import {Observable} from 'rxjs';

import createPackage from 'nuclide-commons-atom/createPackage';
import getElementFilePath from 'nuclide-commons-atom/getElementFilePath';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import AsyncStorage from 'idb-keyval';
import invariant from 'assert';

import {setRpcService, setGkService} from './AtomServiceContainer';
import {deserializeTerminalView, TerminalView} from './terminal-view';
import {TERMINAL_DEFAULT_INFO, TERMINAL_URI} from './nuclide-terminal-info';
import {FocusManager} from './FocusManager';

import type {CreatePasteFunction} from 'atom-ide-ui/pkg/atom-ide-console/lib/types';
import type {GatekeeperService} from 'nuclide-commons-atom/types';
import type {TerminalApi, TerminalInfo, TerminalInstance} from './types';

const MOVED_TERMINAL_NUX_SHOWN_KEY = 'atom_ide_terminal_moved_nux';

class Activation {
  _subscriptions: UniversalDisposable;
  _cwd: ?nuclide$CwdApi;

  constructor() {
    const focusManager = new FocusManager();
    this._subscriptions = new UniversalDisposable(
      focusManager,
      atom.workspace.addOpener((uri, options) => {
        if (uri === TERMINAL_URI) {
          // $FlowFixMe this has the merged terminalInfo inside it
          const info = options.terminalInfo || {};
          if (info.cwd == null || info.cwd === '') {
            const cwd = this._cwd && this._cwd.getCwd();
            if (cwd != null) {
              info.cwd = cwd;
            }
          }
          return new TerminalView({...TERMINAL_DEFAULT_INFO, ...info});
        }
      }),
      atom.commands.add('atom-workspace', 'atom-ide-terminal:toggle', () => {
        const activePane = atom.workspace.getActivePaneItem();
        if (
          activePane &&
          activePane.getURI &&
          activePane.getURI() === TERMINAL_URI
        ) {
          const container = atom.workspace.getActivePaneContainer();
          if (container === atom.workspace.getCenter()) {
            atom.confirm(
              {
                message: 'This will destroy the current terminal',
                detail:
                  'Toggling active terminals in the center pane closes them.',
                buttons: ['Keep', 'Destroy'],
                defaultId: 0,
                cancelId: 0,
                type: 'warning',
              },
              response => {
                if (response === 1) {
                  atom.workspace.toggle(TERMINAL_URI);
                }
              },
            );

            return;
          }
        }
        atom.workspace.toggle(TERMINAL_URI);
      }),
      atom.commands.add(
        'atom-workspace',
        'atom-ide-terminal:new-terminal',
        event => {
          // HACK: we pass along the cwd in the opener's options to be able to
          // read from it above.
          // eslint-disable-next-line nuclide-internal/atom-apis
          openTerminalInNewPaneItem({
            terminalInfo: {
              cwd: this._getPathOrCwd(event),
            },
            searchAllPanes: false,
          });
        },
      ),
      atom.commands.add(
        'atom-workspace',
        'atom-ide-terminal:new-local-terminal',
        () => {
          // HACK: we pass along the cwd in the opener's options to be able to
          // read from it above.
          // eslint-disable-next-line nuclide-internal/atom-apis
          openTerminalInNewPaneItem({
            terminalInfo: {cwd: os.homedir()},
          });
        },
      ),
      atom.commands.add(
        'atom-workspace',
        'atom-ide-terminal:toggle-terminal-focus',
        () => focusManager.toggleFocus(),
      ),
    );
  }

  provideTerminal(): TerminalApi {
    return {
      open: (info: TerminalInfo): Promise<TerminalInstance> => {
        const terminalView: any = openTerminalInNewPaneItem({
          terminalInfo: info,
        });
        return terminalView;
      },
      close: (key: string) => {
        destroyItemWhere(item => {
          // $FlowFixMe this is on TerminalViews only
          if (typeof item.getTerminalKey !== 'function') {
            return false;
          }

          return item.getTerminalKey() === key;
        });
      },
    };
  }

  dispose() {
    this._subscriptions.dispose();
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('nuclide-terminal');
    toolBar.addButton({
      icon: 'terminal',
      callback: {
        '': 'atom-ide-terminal:toggle',
        alt: 'atom-ide-terminal:new-terminal',
      },
      tooltip: 'Toggle Terminal (alt click for New)',
      priority: 700,
    });

    const disposable = new UniversalDisposable(() => {
      toolBar.removeItems();
    });
    this._subscriptions.add(disposable);
    return disposable;
  }

  consumePasteProvider(provider: any): IDisposable {
    const createPaste: CreatePasteFunction = provider.createPaste;
    const disposable = new UniversalDisposable(
      atom.commands.add(
        '.terminal-pane',
        'atom-ide-terminal:create-paste',
        async event => {
          const {
            currentTarget: {terminal},
          } = (event: any);
          const uri = await createPaste(
            terminal.getSelection(),
            {
              title: 'Paste from Atom IDE Terminal',
            },
            'terminal paste',
          );
          atom.notifications.addSuccess(`Created paste at ${uri}`);
        },
      ),
      atom.contextMenu.add({
        '.terminal-pane': [
          {
            label: 'Create Paste',
            command: 'atom-ide-terminal:create-paste',
            shouldDisplay: event => {
              const div = event.target.closest('.terminal-pane');
              if (div == null) {
                return false;
              }
              const {terminal} = (div: any);
              if (terminal == null) {
                return false;
              }
              return terminal.hasSelection();
            },
          },
          {type: 'separator'},
        ],
      }),
    );
    this._subscriptions.add(disposable);
    return new UniversalDisposable(() => {
      disposable.dispose();
      this._subscriptions.remove(disposable);
    });
  }

  initializeCwdApi(cwd: nuclide$CwdApi): IDisposable {
    this._cwd = cwd;
    return new UniversalDisposable(() => {
      this._cwd = null;
    });
  }

  consumeRpcService(rpcService: nuclide$RpcService): IDisposable {
    return setRpcService(rpcService);
  }

  consumeGatekeeperService(service: GatekeeperService): IDisposable {
    return setGkService(service);
  }

  _getPathOrCwd(event: Event): ?string {
    const editorPath = getElementFilePath(
      ((event.target: any): HTMLElement),
      true,
    );

    if (editorPath != null) {
      return nuclideUri.endsWithSeparator(editorPath)
        ? editorPath
        : nuclideUri.dirname(editorPath);
    }

    if (this._cwd != null) {
      return this._cwd.getCwd();
    }

    return null;
  }
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = {
  // exported for package.json entry
  deserializeTerminalView,
};

createPackage(module.exports, Activation);

async function openTerminalInNewPaneItem(
  options: atom$WorkspaceOpenOptions & {
    terminalInfo: TerminalInfo,
  },
): Promise<atom$PaneItem> {
  const existingPane = atom.workspace.paneForURI(TERMINAL_URI);

  // TODO: The flow types are wrong. paneForURI returns a nullable pane
  if (!existingPane) {
    // eslint-disable-next-line nuclide-internal/atom-apis
    return atom.workspace.open(TERMINAL_URI, options);
  }

  const [item, hasShownNux] = await Promise.all([
    atom.workspace.createItemForURI(TERMINAL_URI, options),
    AsyncStorage.get(MOVED_TERMINAL_NUX_SHOWN_KEY),
  ]);
  existingPane.activateItem(item);
  existingPane.activate();

  if (!hasShownNux) {
    invariant(item instanceof TerminalView);
    showTooltipForPaneItem(item);
    AsyncStorage.set(MOVED_TERMINAL_NUX_SHOWN_KEY, true);
  }

  return item;
}

function showTooltipForPaneItem(paneItem: TerminalView): IDisposable {
  return new UniversalDisposable(
    Observable.create(() => {
      const tooltip = atom.tooltips.add(paneItem.getElement(), {
        title: `
        <div>
          <span style="margin-right: 4px">
            We now open terminals here, but if you move them, new terminals
            will open in the same location.
          </span>
          <button class="btn btn-primary nuclide-moved-terminal-nux-dismiss">
            Got it
          </button>
        </div>
      `,
        trigger: 'manual',
        html: true,
      });

      return () => tooltip.dispose();
    })
      .takeUntil(Observable.timer(1000 * 60))
      .takeUntil(
        observableFromSubscribeFunction(cb =>
          atom.workspace.onDidDestroyPaneItem(cb),
        ).filter(event => event.item === paneItem),
      )
      .takeUntil(
        Observable.fromEvent(document.body, 'click').filter(e =>
          e.target.classList.contains('nuclide-moved-terminal-nux-dismiss'),
        ),
      )
      .subscribe(),
  );
}
