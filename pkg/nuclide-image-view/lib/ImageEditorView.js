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

import type ImageEditor from './ImageEditor';

import fs from 'fs';
import {Message} from 'nuclide-commons-ui/Message';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import AtomImageEditorView from '../VendorLib/image-view/lib/image-editor-view';
import nullthrows from 'nullthrows';
import * as React from 'react';

/**
 * This view wraps the vendored one. This is necessary because the Atom ImageEditorView performs
 * a stat on the file so we neeed to make sure that the (local) file exists.
 */
export default class ImageEditorView {
  _disposables: UniversalDisposable;
  _realView: ?AtomImageEditorView;
  element: HTMLElement;

  constructor(editor: ImageEditor) {
    this.element = document.createElement('div');
    this.element.className = 'nuclide-image-view-wrapper';

    // Add a temporary element to display a spinner until it is replaced
    const spinner = renderReactRoot(
      <div className="nuclide-image-view-loading-spinner">
        <LoadingSpinner />
      </div>,
    );
    this.element.appendChild(spinner);

    this._disposables = new UniversalDisposable(
      // We need to defer loading the real view until the local file is ready because it assumes it
      // exists.
      editor.whenReady(() => {
        let viewElement;
        // In some weird cases (e.g. Dash cached a deleted file path?), we might have tried to open
        // a nonexistent file. In that case, just show an error. It's important that we don't create
        // an AtomImageEditorView because that will try to stat the nonexistent file and error.
        if (!fs.existsSync(nullthrows(editor.getLocalPath()))) {
          viewElement = renderReactRoot(
            <Message type="error">Image doesn't exist</Message>,
          );
          viewElement.style.flexDirection = 'column';
        } else {
          // AtomImageEditorView tries to do a stat using the result of `getPath()` so we give it a
          // proxy that always returns the local path instead of the real editor. (We don't want to
          // change the editor's `getPath()` because other things use that for display purposes and we
          // want to show the remote path.)
          const proxy = new Proxy(editor, {
            get(obj, prop) {
              if (prop === 'getPath') {
                return editor.getLocalPath;
              }
              // $FlowIgnore
              return obj[prop];
            },
          });

          this._realView = new AtomImageEditorView(proxy);
          viewElement = this._realView.element;
        }

        this.element.replaceChild(viewElement, spinner);
      }),
      () => {
        if (this._realView != null) {
          this._realView.destroy();
        }
      },
    );
  }

  getElement() {
    return this.element;
  }

  destroy() {
    this._disposables.dispose();
  }
}
