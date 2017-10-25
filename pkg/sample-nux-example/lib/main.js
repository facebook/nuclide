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

import invariant from 'assert';
import {Disposable} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import type {NuxTourModel} from '../../nuclide-nux/lib/NuxModel';
import type {RegisterNux, TriggerNux} from '../../nuclide-nux/lib/main';
import {makeToolbarButtonSpec} from '../../nuclide-ui/ToolbarUtils';

const SAMPLE_NUX_ID = 0;
const SAMPLE_NUX_NAME = 'sample-nux-example.sample-nux-id';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('nux-example-toolbar');
    const {element} = toolBar.addButton(
      makeToolbarButtonSpec({
        icon: 'mortar-board',
        callback: 'nux-example-toolbar:noop',
        tooltip: 'Example Nux Toolbar Item',
      }),
    );
    element.classList.add('sample-nux-toolbar-button');
    const disposable = new Disposable(() => {
      toolBar.removeItems();
    });
    this._disposables.add(disposable);
    return disposable;
  }

  addDisposable(disposable: Disposable) {
    this._disposables.add(disposable);
  }
}

let activation: ?Activation = null;

export function activate() {
  if (activation == null) {
    activation = new Activation();
  }
}

export function deactivate() {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export function consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
  invariant(activation != null);
  return activation.consumeToolBar(getToolBar);
}

function generateTestNuxTour(
  id: number,
  name: string,
  numViews: number = 1,
): NuxTourModel {
  const getNuxViewModel = viewNumber => ({
    content: `Content NUX #${viewNumber}`,
    selector: '.sample-nux-toolbar-button',
    position: 'auto',
    /**
       * OPTIONAL: Use a custom selector function to return a DOM element if the
       * element to bind the NUX to cannot be returned by a query selector class.
       */
    // selectorFunction: () => document.querySelector('.sample-nux-toolbar-button'),
    /**
       * OPTIONAL: If set, the completion predicate will be evaluated after every
       * NUX interaction. The NuxView will not progress to the next one in the
       * NuxTour until the predicate evaluates to true.
       */
    // completionPredicate: () => true,
  });
  const nuxList = Array(numViews)
    .fill() // Fill holes so map doesn't skip them
    .map((_, index) => getNuxViewModel(index + 1));
  return {
    id,
    name,
    nuxList,
    /**
     * OPTIONAL (but recommended): Add your own gatekeeper to control who the
     * NUX is displayed to. Use the global `nuclide_all_nuxes` if you want the
     * NUX to always appear. See `nuclide-nux/lib/NuxModel.js` for more details.
     */
    gatekeeperID: 'nuclide_all_nuxes',
    /**
     * OPTIONAL: Include a custom trigger handled by the NUX framework if you
     * choose to not use the `nux-trigger` service.
     */
    // trigger: null,
    /**
     * DEV-ONLY: Setting this will always show the NUX when triggered every
     * session.  Only to be used for development purposes - the flow typing ensures
     * that this cannot be set to true when shipping the NUX.
     */
    // developmentMode: true,
  };
}

export function consumeRegisterNuxService(addNewNux: RegisterNux): Disposable {
  invariant(activation != null);
  const disposable = addNewNux(
    generateTestNuxTour(SAMPLE_NUX_ID, SAMPLE_NUX_NAME, 2),
  );
  activation.addDisposable(disposable);
  return disposable;
}

export function consumeTriggerNuxService(tryTriggerNux: TriggerNux): void {
  tryTriggerNux(SAMPLE_NUX_ID);
}
