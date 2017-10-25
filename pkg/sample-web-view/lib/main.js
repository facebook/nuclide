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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import WebViewPane from './WebViewPane';

const URI_PREFIX = 'sample-web-view:';

/**
 * Encapsulates the state for this package so it can be cleaned up easily in deactivate().
 */
class Activation {
  _subscriptions: UniversalDisposable;

  constructor(state: ?Object) {
    this._subscriptions = new UniversalDisposable();
    this._subscriptions.add(
      // The Atom 1.0 API docs are ambiguous about the contract of an object returned by an opener:
      // https://atom.io/docs/api/v1.0.0/Workspace#instance-addOpener.
      // It turns out that returning an HTMLElement with a getTitle() method is sufficient to
      // add a pane with the result of getTitle() as the title for the pane.
      atom.workspace.addOpener(uriToOpen => {
        if (!uriToOpen.startsWith(URI_PREFIX)) {
          return;
        }
        const element = new WebViewPane();
        element.src = uriToOpen.substring(URI_PREFIX.length);
        return element;
      }),
    );
    this._subscriptions.add(
      atom.commands.add('atom-workspace', 'sample-web-view:open-url', () =>
        this._openUrl(),
      ),
    );
  }

  /** Opens a tab that loads facebook.com. */
  _openUrl() {
    // not a file URI
    // eslint-disable-next-line rulesdir/atom-apis
    atom.workspace.open('sample-web-view:https://facebook.com/');
  }

  dispose() {
    this._subscriptions.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object): void {
  if (!activation) {
    activation = new Activation(state);
  }
}

export function deactivate(): void {
  if (activation) {
    activation.dispose();
    activation = null;
  }
}
