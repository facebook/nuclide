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

import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {NuxTourModel} from '../../nuclide-nux/lib/NuxModel';
import type {RegisterNux} from '../../nuclide-nux/lib/main';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

const NUX_OUTLINE_VIEW_TOUR = 'nuclide_outline_view_nux';
const NUX_OUTLINE_VIEW_ID = 4342;
const GK_NUX_OUTLINE_VIEW = 'mp_nuclide_outline_view_nux';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  _createOutlineViewNuxTourModel(): NuxTourModel {
    const outlineViewToolbarIconNux = {
      content: 'Check out the new Outline View!',
      selector: '.nuclide-outline-view-toolbar-button',
      position: 'auto',
      completionPredicate: () =>
        document.querySelector('div.nuclide-outline-view') != null,
    };

    const outlineViewPanelNux = {
      content: 'Click on a symbol to jump to its definition.',
      selector: 'div.pane-item.nuclide-outline-view',
      position: 'left',
    };

    const isValidFileTypeForNux = editor => {
      if (editor == null) {
        return false;
      }
      const path = editor.getPath();
      if (path == null) {
        return false;
      }
      return path.endsWith('.js') || path.endsWith('.php');
    };

    const isOutlineViewClosed = () =>
      document.querySelector('.nuclide-outline-view') == null;
    const triggerCallback = editor =>
      isOutlineViewClosed() && isValidFileTypeForNux(editor);

    const nuxTriggerModel = {
      triggerType: 'editor',
      triggerCallback,
    };

    const outlineViewNuxTour = {
      id: NUX_OUTLINE_VIEW_ID,
      name: NUX_OUTLINE_VIEW_TOUR,
      nuxList: [outlineViewToolbarIconNux, outlineViewPanelNux],
      trigger: nuxTriggerModel,
      gatekeeperID: GK_NUX_OUTLINE_VIEW,
    };

    return outlineViewNuxTour;
  }

  consumeRegisterNuxService(addNewNux: RegisterNux): IDisposable {
    const disposable = addNewNux(this._createOutlineViewNuxTourModel());
    this._disposables.add(disposable);
    return disposable;
  }

  getHomeFragments(): HomeFragments {
    return {
      feature: {
        title: 'Outline View',
        icon: 'list-unordered',
        description: 'Displays major components of the current file (classes, methods, etc.)',
        command: () => {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'nuclide-outline-view:toggle',
            {visible: true},
          );
        },
      },
      priority: 2.5, // Between diff view and test runner
    };
  }
}

createPackage(module.exports, Activation);
