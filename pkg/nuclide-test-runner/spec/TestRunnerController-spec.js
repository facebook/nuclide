'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {TestRunner} from '../lib/types';
import {Observable} from 'rxjs';

import {TestRunnerController} from '../lib/TestRunnerController';

describe('TestRunnerController', () => {

  const TEST_RUNNER = {getByUri() {}, label: '', runTest() { return Observable.empty(); }};

  let testRunners: Set<TestRunner> = (null: any);

  beforeEach(() => {
    testRunners = new Set();
  });

  describe('on initialization', () => {

    it('does not create a panel by default', () => {
      const controller = new TestRunnerController(testRunners);
      expect(controller.getElement().innerHTML).toEqual('');
      controller.destroy();
    });

    it('creates a panel if showPanel() is called', () => {
      const controller = new TestRunnerController(testRunners);
      controller.showPanel();
      expect(controller.getElement().innerHTML).not.toEqual('');
      controller.destroy();
    });

  });

  describe('runTests()', () => {

    it('forces the panel to be shown', () => {
      // The controller needs at least one test runner to run tests.
      testRunners.add(TEST_RUNNER);
      // Start with `panelVisible: false` to ensure the panel is initially hidden.
      const controller = new TestRunnerController(testRunners);
      expect(controller.getElement().innerHTML).toEqual('');
      waitsForPromise(async () => {
        await controller.runTests();
        expect(controller.getElement().innerHTML).not.toEqual('');
      });
    });

  });

  describe('on addition of new test runners', () => {
    // When new test runners are added, the dropdown in the UI needs to update. However, it should
    // not force a render if the panel is still supposed to be hidden.
    it('does not create a panel if `panelVisible` is false', () => {
      const controller = new TestRunnerController(testRunners);
      testRunners.add(TEST_RUNNER);
      controller.didUpdateTestRunners();
      expect(controller.getElement().innerHTML).toEqual('');
    });

  });

});
