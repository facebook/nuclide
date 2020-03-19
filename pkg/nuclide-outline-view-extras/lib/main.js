/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {NuxTourModel} from '../../nuclide-nux/lib/NuxModel';
import type {RegisterNux} from '../../nuclide-nux/lib/main';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {WORKSPACE_VIEW_URI} from 'atom-ide-ui/pkg/atom-ide-outline-view/lib/OutlineViewPanel';

const NUX_OUTLINE_VIEW_TOUR = 'nuclide_outline_view_nux';
const NUX_OUTLINE_VIEW_ID = 4342;
const GK_NUX_OUTLINE_VIEW = 'mp_nuclide_outline_view_nux';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('outline-view');
    const {element} = toolBar.addButton({
      icon: 'list-unordered',
      callback: 'outline-view:toggle',
      tooltip: 'Toggle Outline',
      priority: 200,
    });
    // Class added is not defined elsewhere, and is just used to mark the toolbar button
    element.classList.add('outline-view-toolbar-button');
    const disposable = new UniversalDisposable(() => {
      toolBar.removeItems();
    });
    this._disposables.add(disposable);
    return disposable;
  }

  _createOutlineViewNuxTourModel(): NuxTourModel {
    const outlineViewToolbarIconNux = {
      content: 'Check out the new Outline!',
      selector: '.outline-view-toolbar-button',
      position: 'auto',
      completionPredicate: () =>
        document.querySelector('div.outline-view') != null,
    };

    const outlineViewPanelNux = {
      content: 'Click on a symbol to jump to its definition.',
      selector: 'div.outline-view',
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
      document.querySelector('div.outline-view') == null;
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
        title: 'Outline',
        icon: 'list-unordered',
        description:
          'Displays major components of the current file (classes, methods, etc.)',
        command: () => {
          // eslint-disable-next-line nuclide-internal/atom-apis
          atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
        },
      },
      priority: 2.5, // Between diff view and test runner
    };
  }
}

createPackage(module.exports, Activation);
