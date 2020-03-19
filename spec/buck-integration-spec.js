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

import {sleep} from 'nuclide-commons/promise';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
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
    waitsForPromise(deactivateAllPackages);
  });

  it('builds a project', () => {
    let buildToolbar: ?HTMLElement;
    const workspaceView = atom.views.getView(atom.workspace);

    waitsForPromise(async () => {
      const projectPath = await copyBuildFixture('objc_project_1', __dirname);
      setLocalProject(projectPath);

      // Wait for the Buck project to load. (hacky)
      // The enabled state of the tasks depends on this.
      await sleep(1000);
    });

    waitsFor('the toolbar to be shown', 500, () => {
      buildToolbar = document.querySelector('.nuclide-task-runner-toolbar');
      return Boolean(buildToolbar);
    });

    let combobox: ?HTMLElement;
    waitsFor('the target combobox to appear', 200, () => {
      invariant(buildToolbar != null);
      combobox = buildToolbar.querySelector('.nuclide-buck-target-combobox');
      return combobox;
    });

    // Focus on the build toolbar target combobox field.
    let targetField: atom$TextEditorElement;
    runs(() => {
      // Focus on the build toolbar target field.
      invariant(combobox != null);
      targetField = window.targetField = (combobox.querySelector(
        'atom-text-editor',
      ): any);
      targetField.focus();
      targetField.click();
    });

    // Wait for the results.
    let listGroup: ?HTMLElement;
    waitsFor('results to appear', 30000, () => {
      invariant(document.body != null);
      listGroup = document.body.querySelector('.nuclide-combobox-list-group');
      const hasListItems =
        listGroup && listGroup.querySelectorAll('li').length > 0;
      const isLoading =
        listGroup && listGroup.querySelector('.loading-message') != null;
      return hasListItems && !isLoading;
    });

    waitsFor('platforms to load', 120000, () => {
      // It shouldn't have errored.
      invariant(listGroup != null);
      const errorMessageEl = listGroup.querySelector('.text-error');
      const errorText =
        errorMessageEl == null ? null : errorMessageEl.innerText;
      expect(errorMessageEl).toBeNull(
        `Buck failed with the following error: ${errorText || ''}`,
      );

      const listElements = listGroup.querySelectorAll('li');
      const targets = Array.from(listElements).map(el => el.textContent);
      if (targets.length !== 1 || targets[0] !== 'test_app_alias') {
        return false;
      }
      expect(targets).toEqual(['test_app_alias']);

      // Set the target.
      listElements[0].click();

      invariant(buildToolbar != null);

      // The Build task should be selected.
      const spinner = buildToolbar.querySelector('.buck-spinner');
      return spinner == null;
    });

    waitsForPromise({timeout: 25000}, async () => {
      invariant(buildToolbar != null);

      // Run the project
      atom.commands.dispatch(workspaceView, 'nuclide-task-runner:buck-build');

      // The Build task should be selected.
      const button = buildToolbar.querySelector(
        '.nuclide-task-runner-toolbar-contents .nuclide-task-runner-task-runner-button',
      );
      invariant(button != null);
      const icon = button.querySelector('.icon-nuclicon-buck');
      expect(icon).toExist();
    });

    waitsFor(
      'the console to appear',
      30000,
      () => workspaceView.querySelectorAll('.console').length > 0,
    );

    waitsFor('the build to finish', 60000, () => {
      const consoleOutput = workspaceView.querySelectorAll(
        '.console-record pre',
      );
      if (consoleOutput.length > 0) {
        const lastOutput = consoleOutput[consoleOutput.length - 1];
        const innerText = lastOutput.innerText;
        invariant(innerText != null);
        return innerText.indexOf('Build succeeded.') !== -1;
      }
      return true;
    });
  });
});
