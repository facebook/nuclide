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

import {
  activateAllPackages,
  deactivateAllPackages,
  jasmineIntegrationTestSetup,
} from './utils/integration-test-helpers';
import {
  dispatchKeyboardEvent,
  setLocalProject,
  waitsForFilePosition,
} from '../pkg/commons-atom/testHelpers';
import {copyFixture} from '../pkg/nuclide-test-helpers';
import {sleep} from 'nuclide-commons/promise';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import nuclideUri from 'nuclide-commons/nuclideUri';

const NAV_SLEEP_MS = 1000;

function navBack() {
  runs(() => {
    dispatchKeyboardEvent(',', document.activeElement, {ctrl: true});
  });
  // Need to wait for the event loop to flush before continuing.
  waitsForPromise(() => sleep(NAV_SLEEP_MS));
}

function navForward() {
  runs(() => {
    dispatchKeyboardEvent('.', document.activeElement, {ctrl: true});
  });
  // Need to wait for the event loop to flush before continuing.
  waitsForPromise(() => sleep(NAV_SLEEP_MS));
}

function waitForStopChanging() {
  waitsForPromise(() => {
    return new Promise(resolve => {
      atom.workspace.onDidStopChangingActivePaneItem(resolve);
    });
  });
}

function goTo(fullFile, shortFile, line, column, waitForActivate) {
  runs(() => {
    goToLocation(fullFile(), line, column);
  });
  if (waitForActivate) {
    waitForStopChanging();
  }
  waitsForFilePosition(shortFile, line, column);
}

describe('Nav Stack Integration', () => {
  it('tests navigation stack', () => {
    let flowProjectPath: string = (null: any);
    let mainPath: string = (null: any);
    let fooPath: string = (null: any);

    function getMainPath() {
      return mainPath;
    }

    function getFooPath() {
      return fooPath;
    }

    waitsForPromise({timeout: 240000}, async () => {
      jasmineIntegrationTestSetup();

      // Activate nuclide packages.
      await activateAllPackages();

      // Copy flow project to a temporary location.
      flowProjectPath = await copyFixture('nav_project_1', __dirname);
      mainPath = nuclideUri.join(flowProjectPath, 'main');
      fooPath = nuclideUri.join(flowProjectPath, 'Foo');

      // Add this directory as an atom project.
      setLocalProject(flowProjectPath);
    });

    goTo(getMainPath, 'main', 0, 0, true);
    goTo(getMainPath, 'main', 12, 2, false);
    goTo(getFooPath, 'Foo', 10, 0, true);
    goTo(getFooPath, 'Foo', 11, 5, false);

    navBack();
    waitsForFilePosition('Foo', 10, 0);
    navBack();
    waitsForFilePosition('main', 12, 2);
    navBack();
    waitsForFilePosition('main', 0, 0);
    navBack();
    waitsForFilePosition('main', 0, 0);
    navForward();
    waitsForFilePosition('main', 12, 2);
    navForward();
    waitsForFilePosition('Foo', 10, 0);
    navForward();
    waitsForFilePosition('Foo', 11, 5);
    navForward();
    waitsForFilePosition('Foo', 11, 5);

    runs(() => {
      deactivateAllPackages();
    });
  });
});
