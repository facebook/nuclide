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

/* global getSelection */

import type {BusySignalService} from '../../atom-ide-busy-signal/lib/types';
import type {
  FindReferencesProvider,
  FindReferencesReturn,
  FindReferencesViewService,
  FindReferencesData,
} from './types';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {asyncFind} from 'nuclide-commons/promise';
import createPackage from 'nuclide-commons-atom/createPackage';
import ContextMenu from 'nuclide-commons-atom/ContextMenu';
import {bufferPositionForMouseEvent} from 'nuclide-commons-atom/mouse-to-position';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import analytics from 'nuclide-commons/analytics';
import {FindReferencesViewModel} from './FindReferencesViewModel';
import {getLogger} from 'log4js';
import FindReferencesModel from './FindReferencesModel';

function showWarning(message: string): void {
  atom.notifications.addWarning('Find References: ' + message, {
    dismissable: true,
  });
}

function tryCreateView(data: ?FindReferencesReturn): ?FindReferencesViewModel {
  if (data == null) {
    showWarning('Symbol references are not available for this project.');
  } else if (data.type === 'error') {
    analytics.track('find-references:error', {message: data.message});
    showWarning(data.message);
  } else {
    const {baseUri, referencedSymbolName, references} = data;
    // Only record symbol name/uri if we actually found some references.
    const trackData = references.length ? {baseUri, referencedSymbolName} : {};
    analytics.track('find-references:success', {
      resultCount: references.length.toString(),
      ...trackData,
    });
    return createView(data);
  }
}

function createView(data: FindReferencesData): ?FindReferencesViewModel {
  const {baseUri, referencedSymbolName, references} = data;
  if (!data.references.length) {
    showWarning('No references found.');
  } else {
    let title = data.title;
    if (title == null) {
      title = 'Symbol References';
    }
    const model = new FindReferencesModel(
      baseUri,
      referencedSymbolName,
      title,
      references,
    );
    return new FindReferencesViewModel(model);
  }
}

function openViewModel(view: ?FindReferencesViewModel): void {
  if (!view) {
    return;
  }
  const disposable = atom.workspace.addOpener(newUri => {
    if (view.getURI() === newUri) {
      return view;
    }
  });
  // not a file URI
  // eslint-disable-next-line nuclide-internal/atom-apis
  atom.workspace.open(view.getURI());
  // The new tab opens instantly, so this is no longer needed.
  disposable.dispose();
}

function enableForEditor(editor: TextEditor): void {
  const elem = atom.views.getView(editor);
  elem.classList.add('enable-atom-ide-find-references');
}

function disableForEditor(editor: TextEditor): void {
  const elem = atom.views.getView(editor);
  elem.classList.remove('enable-atom-ide-find-references');
}

class Activation {
  _subscriptions: UniversalDisposable;
  _providers: Array<FindReferencesProvider> = [];
  _supportedProviders: Map<
    TextEditor,
    Array<FindReferencesProvider>,
  > = new Map();

  _busySignalService: ?BusySignalService;

  constructor(state: ?any): void {
    this._subscriptions = new UniversalDisposable();
    // Add this separately as registerOpenerAndCommand requires
    // this._subscriptions to be initialized for observeTextEditors function.
    this._subscriptions.add(this.registerOpenerAndCommand());
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  consumeBusySignal(busySignalService: BusySignalService): IDisposable {
    this._busySignalService = busySignalService;
    return new UniversalDisposable(() => {
      this._busySignalService = null;
    });
  }

  consumeProvider(provider: FindReferencesProvider): IDisposable {
    this._providers.push(provider);
    // Editors are often open before providers load, so update existing ones too.
    atom.workspace.getTextEditors().forEach(async editor => {
      if (await provider.isEditorSupported(editor)) {
        if (this._addSupportedProvider(editor, provider)) {
          enableForEditor(editor);
        }
      }
    });

    return new UniversalDisposable(() => {
      this._providers = this._providers.filter(p => p !== provider);

      this._supportedProviders.forEach((supported, editor) => {
        const providerIdx = supported.indexOf(provider);
        if (providerIdx !== -1) {
          supported.splice(providerIdx, 1);
          if (supported.length === 0) {
            disableForEditor(editor);
          }
        }
      });
    });
  }

  provideReferencesViewService(): FindReferencesViewService {
    return {
      async viewResults(results: FindReferencesData) {
        openViewModel(createView(results));
      },
    };
  }

  registerOpenerAndCommand(): IDisposable {
    let lastMouseEvent;
    return new UniversalDisposable(
      atom.commands.add(
        'atom-text-editor',
        'find-references:activate',
        async event => {
          openViewModel(
            tryCreateView(
              await this._getProviderData(
                ContextMenu.isEventFromContextMenu(event)
                  ? lastMouseEvent
                  : null,
              ),
            ),
          );
        },
      ),
      // Mark text editors with a working provider with a special CSS class.
      // This ensures the context menu option only appears in supported projects.
      atom.workspace.observeTextEditors(async editor => {
        const path = editor.getPath();
        // flowlint-next-line sketchy-null-string:off
        if (!path || this._supportedProviders.get(editor)) {
          return;
        }
        this._supportedProviders.set(editor, []);
        await Promise.all(
          this._providers.map(async provider => {
            if (await provider.isEditorSupported(editor)) {
              if (this._addSupportedProvider(editor, provider)) {
                enableForEditor(editor);
              }
            }
          }),
        );
        if (editor.isDestroyed()) {
          // This is asynchronous, so the editor may have been destroyed!
          this._supportedProviders.delete(editor);
          return;
        }
        const disposable = editor.onDidDestroy(() => {
          this._supportedProviders.delete(editor);
          this._subscriptions.remove(disposable);
        });
        this._subscriptions.add(disposable);
      }),
      // Enable text copy from the symbol reference
      atom.commands.add('atom-ide-find-references-view', 'core:copy', () => {
        const selection = getSelection();
        if (selection != null) {
          const selectedText = selection.toString();
          atom.clipboard.write(selectedText);
        }
      }),
      // Add the context menu programmatically so we can capture the mouse event.
      atom.contextMenu.add({
        'atom-text-editor:not(.mini).enable-atom-ide-find-references': [
          {
            label: 'Find References',
            command: 'find-references:activate',
            created: event => {
              lastMouseEvent = event;
            },
          },
        ],
      }),
    );
  }

  async _getProviderData(event: ?MouseEvent): Promise<?FindReferencesReturn> {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return null;
    }
    const path = editor.getPath();
    // flowlint-next-line sketchy-null-string:off
    if (!path) {
      return null;
    }
    const point =
      event != null
        ? bufferPositionForMouseEvent(event, editor)
        : editor.getCursorBufferPosition();
    analytics.track('find-references:activate', {
      path,
      row: point.row.toString(),
      column: point.column.toString(),
    });
    const supported = this._supportedProviders.get(editor);
    if (!supported) {
      return null;
    }
    const resultPromise = asyncFind(
      supported.map(provider =>
        provider.findReferences(editor, point).catch(err => {
          getLogger('find-references').error('Error finding references', err);
          return {
            type: 'error',
            message: String(err),
          };
        }),
      ),
      x => x,
    );
    const busySignalService = this._busySignalService;
    if (busySignalService != null) {
      const displayPath = nuclideUri.basename(path);
      return busySignalService.reportBusyWhile(
        `Finding references for ${displayPath}:${point.row}:${point.column}`,
        () => resultPromise,
        {revealTooltip: true},
      );
    }
    return resultPromise;
  }

  // Returns true if this adds the first provider for the editor.
  _addSupportedProvider(editor: TextEditor, provider: FindReferencesProvider) {
    let supported = this._supportedProviders.get(editor);
    if (supported == null) {
      supported = [];
      this._supportedProviders.set(editor, supported);
    }
    supported.push(provider);
    return supported.length === 1;
  }
}

createPackage(module.exports, Activation);
