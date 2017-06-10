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

/* global getSelection */

import type {FindReferencesReturn} from './rpc-types';

import crypto from 'crypto';
import createPackage from 'nuclide-commons-atom/createPackage';
import ContextMenu from 'nuclide-commons-atom/ContextMenu';
import {
  bufferPositionForMouseEvent,
} from 'nuclide-commons-atom/mouse-to-position';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import analytics from 'nuclide-commons-atom/analytics';
import FindReferencesElement from './FindReferencesElement';
import {getLogger} from 'log4js';
import FindReferencesModel from './FindReferencesModel';

const logger = getLogger('nuclide-find-references');

export type FindReferencesProvider = {
  // Return true if your provider supports finding references for the provided TextEditor.
  isEditorSupported(editor: TextEditor): Promise<boolean>,

  // `findReferences` will only be called if `isEditorSupported` previously returned true
  // for the given TextEditor.
  findReferences(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?FindReferencesReturn>,
};

const FIND_REFERENCES_URI = 'atom://nuclide/find-references/';

function showWarning(message: string): void {
  atom.notifications.addWarning('nuclide-find-references: ' + message, {
    dismissable: true,
  });
}

async function tryCreateView(
  data: ?FindReferencesReturn,
): Promise<?HTMLElement> {
  try {
    if (data == null) {
      showWarning('Symbol references are not available for this project.');
    } else if (data.type === 'error') {
      analytics.track('find-references:error', {message: data.message});
      showWarning(data.message);
    } else if (!data.references.length) {
      analytics.track('find-references:success', {resultCount: '0'});
      showWarning('No references found.');
    } else {
      const {baseUri, referencedSymbolName, references} = data;
      analytics.track('find-references:success', {
        baseUri,
        referencedSymbolName,
        resultCount: references.length.toString(),
      });
      const model = new FindReferencesModel(
        baseUri,
        referencedSymbolName,
        references,
      );

      return new FindReferencesElement().initialize(model);
    }
  } catch (e) {
    // TODO(peterhal): Remove this when unhandled rejections have a default handler.
    logger.error('Exception in nuclide-find-references', e);
    atom.notifications.addError(`nuclide-find-references: ${e}`, {
      dismissable: true,
    });
  }
}

function enableForEditor(editor: TextEditor): void {
  const elem = atom.views.getView(editor);
  elem.classList.add('enable-nuclide-find-references');
}

function disableForEditor(editor: TextEditor): void {
  const elem = atom.views.getView(editor);
  elem.classList.remove('enable-nuclide-find-references');
}

class Activation {
  _subscriptions: UniversalDisposable;
  _providers: Array<FindReferencesProvider> = [];
  _supportedProviders: Map<
    TextEditor,
    Array<FindReferencesProvider>,
  > = new Map();

  constructor(state: ?any): void {
    let lastMouseEvent;

    this._subscriptions = new UniversalDisposable(
      atom.commands.add(
        'atom-text-editor',
        'nuclide-find-references:activate',
        async event => {
          const view = await tryCreateView(
            await this._getProviderData(
              ContextMenu.isEventFromContextMenu(event) ? lastMouseEvent : null,
            ),
          );
          if (view != null) {
            // Generate a unique identifier.
            const id = (crypto.randomBytes(8) || '').toString('hex');
            const uri = FIND_REFERENCES_URI + id;
            const disposable = atom.workspace.addOpener(newUri => {
              if (uri === newUri) {
                return view;
              }
            });
            // not a file URI
            // eslint-disable-next-line nuclide-internal/atom-apis
            atom.workspace.open(uri);
            // The new tab opens instantly, so this is no longer needed.
            disposable.dispose();
          }
        },
      ),
      // Mark text editors with a working provider with a special CSS class.
      // This ensures the context menu option only appears in supported projects.
      observeTextEditors(async editor => {
        const path = editor.getPath();
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
        const disposable = editor.onDidDestroy(() => {
          this._supportedProviders.delete(editor);
          this._subscriptions.remove(disposable);
        });
        this._subscriptions.add(disposable);
      }),
      // Enable text copy from the symbol reference
      atom.commands.add('nuclide-find-references-view', 'core:copy', () => {
        const selection = getSelection();
        if (selection != null) {
          const selectedText = selection.toString();
          atom.clipboard.write(selectedText);
        }
      }),
      // Add the context menu programmatically so we can capture the mouse event.
      atom.contextMenu.add({
        'atom-text-editor:not(.mini).enable-nuclide-find-references': [
          {
            label: 'Find References',
            command: 'nuclide-find-references:activate',
            created: event => {
              lastMouseEvent = event;
            },
          },
        ],
      }),
    );
  }

  dispose(): void {
    this._subscriptions.dispose();
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

  async _getProviderData(event: ?MouseEvent): Promise<?FindReferencesReturn> {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return null;
    }
    const path = editor.getPath();
    if (!path) {
      return null;
    }
    const point = event != null
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
    const providerData = await Promise.all(
      supported.map(provider => provider.findReferences(editor, point)),
    );
    return providerData.filter(x => Boolean(x))[0];
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
