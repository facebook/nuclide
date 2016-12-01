'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {sleep} from '../pkg/commons-node/promise';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import activation from '../pkg/nuclide-task-runner';
import {
  activateAllPackages,
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
} from './utils/integration-test-helpers';
import {copyBuildFixture} from '../pkg/nuclide-test-helpers';
import {setLocalProject} from '../pkg/commons-atom/testHelpers';
import invariant from 'assert';

describe('Buck building via toolbar', () => {

  beforeEach(() => {
    waitsForPromise({timeout: 60000}, async () => {
      // Configure some jasmine specific things for integration testing.
      jasmineIntegrationTestSetup();

      // Activate nuclide packages.
      await activateAllPackages();
    });
  });

  afterEach(() => {
    // Deactivate nuclide packages.
    deactivateAllPackages();
  });

  it('builds a project', () => {
    let buildToolbar: HTMLElement;
    const workspaceView = atom.views.getView(atom.workspace);

    waitsForPromise(async () => {
      const projectPath = await copyBuildFixture('objc_project_1', __dirname);
      setLocalProject(projectPath);

      // Wait for the Buck project to load. (hacky)
      // The enabled state of the tasks depends on this.
      await sleep(1000);
    });

    runs(() => {
      // Select the Buck build system.
      const commands = activation._getCommands();
      invariant(commands != null);
      commands.selectTask({taskRunnerId: 'buck', type: 'build'});
    });

    waitsFor(
      'the toolbar to be shown',
      500,
      () => {
        atom.commands.dispatch(
          workspaceView,
          'nuclide-task-runner:toggle-toolbar-visibility',
          {visible: true},
        );
        buildToolbar = document.querySelector('.nuclide-task-runner-toolbar');
        return Boolean(buildToolbar);
      },
    );

    let combobox: HTMLElement;
    waitsFor(
      'the target combobox to appear',
      200,
      () => (
        combobox = buildToolbar.querySelector('.nuclide-buck-target-combobox')
      ),
    );

    // Focus on the build toolbar target combobox field.
    let targetField: HTMLElement;
    runs(() => {
      // Focus on the build toolbar target field.
      targetField = combobox.querySelector('atom-text-editor');
      const event = new window.MouseEvent('focus');
      targetField.dispatchEvent(event);
    });

    // Wait for the results.
    let listGroup: HTMLElement;
    waitsFor(
      'results to appear',
      30000,
      () => {
        listGroup = document.body.querySelector('.nuclide-combobox-list-group');
        const hasListItems = listGroup && listGroup.querySelectorAll('li').length > 0;
        const isLoading = listGroup && listGroup.querySelector('.loading-message') != null;
        return hasListItems && !isLoading;
      },
    );

    waitsForPromise(async () => {
      // It shouldn't have errored.
      const errorMessageEl = listGroup.querySelector('.text-error');
      const errorText = errorMessageEl == null ? null : errorMessageEl.innerText;
      expect(errorMessageEl).toBeNull(`Buck failed with the following error: ${errorText || ''}`);

      const listElements = listGroup.querySelectorAll('li');
      const targets = Array.from(listElements).map(el => el.textContent);
      expect(targets).toEqual(['test_app_alias']);

      // Set the target.
      listElements[0].click();

      // Since there's some debouncing going on, wait for the state to update before building.
      await sleep(1000);

      // Run the project
      atom.commands.dispatch(workspaceView, 'nuclide-task-runner:run-selected-task');

      // The Build task should be selected.
      const button = buildToolbar.querySelector(
        '.nuclide-task-runner-toolbar-contents .nuclide-task-runner-system-task-button',
      );
      expect(button.textContent).toBe('Build');
    });

    waitsFor(
      'the console to appear',
      30000,
      () => workspaceView.querySelectorAll('.nuclide-console').length > 0,
    );

    waitsFor(
      'the build to finish',
      30000,
      () => {
        const consoleOutput = workspaceView.querySelectorAll('.nuclide-console-record pre');
        if (consoleOutput.length > 0) {
          const lastOutput = consoleOutput[consoleOutput.length - 1];
          const innerText = lastOutput.innerText;
          invariant(innerText != null);
          return innerText.indexOf('Buck exited') !== -1;
        }
        return true;
      },
    );

  });

});
