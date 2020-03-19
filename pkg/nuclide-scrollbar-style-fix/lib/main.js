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

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import electron from 'electron';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable(
      electron.remote
        .require('scrollbar-style')
        .onDidChangePreferredScrollbarStyle(style => {
          // Copied from https://github.com/atom/atom/blob/v1.32.0/src/workspace-element.js#L36
          // Once we upstream a fix
          const workspaceEl = atom.views.getView(atom.workspace);
          switch (style) {
            case 'legacy':
              workspaceEl.classList.remove('scrollbars-visible-when-scrolling');
              workspaceEl.classList.add('scrollbars-visible-always');
              break;
            case 'overlay':
              workspaceEl.classList.remove('scrollbars-visible-always');
              workspaceEl.classList.add('scrollbars-visible-when-scrolling');
              break;
            default:
              (style: empty);
              throw new Error(`Invalid scrollbar style: ${style}`);
          }

          // Force the scrollbars to be redrawn. This is necessary because of Chromium bug 454346,
          // which causes Chrome not to update scrollbar styles correctly. We should be able to
          // remove it when Atom upgrades to a version of electron with a Chromium >= 62
          // (electron 3). (Verfiy before removing by trying the repo in the README.)
          //
          // This method was chosen because (1) it worked and (2) it didn't mess with the file tree.
          // (Removing and re-adding the node, for example, would cause an empty tree to be drawn
          // until you interacted with it, at which point React Virtualized would redraw the
          // contents).
          for (const el of document.getElementsByClassName(
            'nuclide-scrollbar-style-fix',
          )) {
            if (window.getComputedStyle(el).display === 'none') {
              // It's hidden. Don't bother doing anything.
              continue;
            }
            const originalDisplayStyle = el.style.display;
            el.style.display = 'none';
            window.requestAnimationFrame(() => {
              if (el.style.display !== 'none') {
                // It changed out from under us!
                return;
              }
              el.style.display = originalDisplayStyle;
            });
          }
        }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
