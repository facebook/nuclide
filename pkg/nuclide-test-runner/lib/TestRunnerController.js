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

import type {TestRunner, Message} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Observable} from 'rxjs';

import invariant from 'assert';
import Ansi from './Ansi';
import {TextBuffer} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';
import TestRunModel from './TestRunModel';
import TestRunnerPanel from './ui/TestRunnerPanel';
import TestSuiteModel from './TestSuiteModel';
import os from 'os';
import {track} from '../../nuclide-analytics';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-test-runner');

export const WORKSPACE_VIEW_URI = 'atom://nuclide/test-runner';

type SerializedTestRunnerPanelState = {
  deserializer: 'nuclide.TestRunnerPanelState',
};

export class TestRunnerController {
  _activeTestRunner: ?Object;
  _attachDebuggerBeforeRunning: boolean;
  _buffer: TextBuffer;
  _executionState: number;
  _path: ?string;
  _root: HTMLElement;
  _run: ?TestRunModel;
  _runningTest: boolean;
  _testRunners: Set<TestRunner>;
  _testRunnerPanel: TestRunnerPanel;
  _testSuiteModel: ?TestSuiteModel;

  constructor(testRunners: Set<TestRunner>) {
    this._root = document.createElement('div');
    this._root.className = 'nuclide-test-runner-root';

    // Bind Functions for use as callbacks;
    // TODO: Replace with property initializers when supported by Flow;
    (this: any).clearOutput = this.clearOutput.bind(this);
    (this: any).stopTests = this.stopTests.bind(this);
    (this: any)._handleClickRun = this._handleClickRun.bind(this);
    (this: any)._onDebuggerCheckboxChanged = this._onDebuggerCheckboxChanged.bind(
      this,
    );

    // TODO: Use the ReadOnlyTextBuffer class from nuclide-atom-text-editor when it is exported.
    this._buffer = new TextBuffer();
    // Make `delete` a no-op to effectively create a read-only buffer.
    (this._buffer: Object).delete = () => {};

    this._executionState = TestRunnerPanel.ExecutionState.STOPPED;
    this._testRunners = testRunners;
    this._attachDebuggerBeforeRunning = false;
    this._runningTest = false;
    this._renderPanel();
  }

  clearOutput() {
    this._buffer.setText('');
    this._path = undefined;
    this._run = undefined;
    this._stopListening();
    this._testSuiteModel = undefined;
    this._renderPanel();
  }

  destroy() {
    this._stopListening();
    ReactDOM.unmountComponentAtNode(this._root);
  }

  didUpdateTestRunners() {
    this._renderPanel();
  }

  /**
   * @return A Promise that resolves when testing has succesfully started.
   */
  async runTests(path?: string): Promise<void> {
    this._runningTest = true;
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-test-runner:toggle-panel',
      {visible: true},
    );

    // Get selected test runner when Flow knows `this._testRunnerPanel` is defined.
    const selectedTestRunner = this._testRunnerPanel.getSelectedTestRunner();
    if (!selectedTestRunner) {
      logger.warn(
        `No test runner selected. Active test runners: ${this._testRunners.size}`,
      );
      return;
    }

    // 1. Use the `path` argument to this function
    // 2. Use `this._path` on the instance
    // 3. Let `testPath` be `undefined` so the path will be taken from the active `TextEditor`
    let testPath = path === undefined ? this._path : path;

    // If there's no path yet, get the path from the active `TextEditor`.
    if (testPath === undefined) {
      const activeTextEditor = atom.workspace.getActiveTextEditor();
      if (!activeTextEditor) {
        logger.debug('Attempted to run tests with no active text editor.');
        return;
      }

      // If the active text editor has no path, bail because there's nowhere to run tests.
      testPath = activeTextEditor.getPath();
    }

    if (!testPath) {
      logger.warn('Attempted to run tests on an editor with no path.');
      return;
    }

    // If the test runner is debuggable, and the user has checked the box, then we will launch
    // the debugger before running the tests.  We do not handle killing the debugger.
    if (
      this._isSelectedTestRunnerDebuggable() &&
      this._attachDebuggerBeforeRunning
    ) {
      const isAttached = await this._isDebuggerAttached(
        selectedTestRunner.debuggerProviderName,
      );
      if (!isAttached) {
        await selectedTestRunner.attachDebugger(testPath);
      }
    }

    // If the user has cancelled the test run while control was yielded, we should not run the test.
    if (!this._runningTest) {
      return;
    }

    this.clearOutput();
    this._runTestRunnerServiceForPath(
      selectedTestRunner.runTest(testPath),
      testPath,
      selectedTestRunner.label,
    );
    track('testrunner-run-tests', {
      path: testPath,
      testRunner: selectedTestRunner.label,
    });

    // Set state as "Running" to give immediate feedback in the UI.
    this._setExecutionState(TestRunnerPanel.ExecutionState.RUNNING);
    this._path = testPath;
    this._renderPanel();
  }

  _isSelectedTestRunnerDebuggable(): boolean {
    if (this._testRunnerPanel == null) {
      return false;
    }
    const selectedTestRunner = this._testRunnerPanel.getSelectedTestRunner();
    return (
      selectedTestRunner != null && selectedTestRunner.attachDebugger != null
    );
  }

  async _isDebuggerAttached(debuggerProviderName: string): Promise<boolean> {
    const debuggerService = await consumeFirstProvider(
      'nuclide-debugger.remote',
    );
    return debuggerService.isInDebuggingMode(debuggerProviderName);
  }

  stopTests(): void {
    // Resume the debugger if needed.
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-debugger:continue-debugging',
    );
    this._stopListening();
    // Respond in the UI immediately and assume the process is properly killed.
    this._setExecutionState(TestRunnerPanel.ExecutionState.STOPPED);
  }

  /**
   * Adds an end-of-line character to `text` and appends the resulting string to this controller's
   * text buffer.
   */
  _appendToBuffer(text: string): void {
    // `undo: 'skip'` disables the TextEditor's "undo system". Since the buffer is managed by this
    // class, an undo will never happen. Disable it when appending to prevent doing unneeded
    // bookkeeping.
    //
    // @see {@link https://atom.io/docs/api/v1.0.4/TextBuffer#instance-append|TextBuffer::append}
    this._buffer.append(`${text}${os.EOL}`, {undo: 'skip'});
  }

  _onDebuggerCheckboxChanged(isChecked: boolean): void {
    this._attachDebuggerBeforeRunning = isChecked;
    this._renderPanel();
  }

  _handleClickRun(event: SyntheticMouseEvent): void {
    // Don't pass a reference to `runTests` directly because the callback receives a mouse event as
    // its argument. `runTests` needs to be called with no arguments.
    this.runTests();
  }

  _runTestRunnerServiceForPath(
    testRun: Observable<Message>,
    path: NuclideUri,
    label: string,
  ): void {
    const subscription = testRun
      .do((message: Message) => {
        switch (message.kind) {
          case 'summary':
            this._testSuiteModel = new TestSuiteModel(message.summaryInfo);
            this._renderPanel();
            break;
          case 'run-test':
            const testInfo = message.testInfo;
            if (this._testSuiteModel) {
              this._testSuiteModel.addTestRun(testInfo);
            }

            // If a test run throws an exception, the stack trace is returned in 'details'.
            // Append its entirety to the console.
            if (testInfo.hasOwnProperty('details') && testInfo.details !== '') {
              // $FlowFixMe(peterhal)
              this._appendToBuffer(testInfo.details);
            }

            // Append a PASS/FAIL message depending on whether the class has test failures.
            this._appendToBuffer(
              TestRunModel.formatStatusMessage(
                testInfo.name,
                testInfo.durationSecs,
                testInfo.status,
              ),
            );
            this._renderPanel();
            break;
          case 'start':
            if (this._run) {
              this._run.start();
            }
            break;
          case 'error':
            const error = message.error;
            if (this._run) {
              this._run.stop();
            }
            if (error.code === 'ENOENT') {
              this._appendToBuffer(
                `${Ansi.YELLOW}Command '${error.path}' does not exist${Ansi.RESET}`,
              );
              this._appendToBuffer(
                `${Ansi.YELLOW}Are you trying to run remotely?${Ansi.RESET}`,
              );
              this._appendToBuffer(`${Ansi.YELLOW}Path: ${path}${Ansi.RESET}`);
            }
            this._appendToBuffer(
              `${Ansi.RED}Original Error: ${error.message}${Ansi.RESET}`,
            );
            this._setExecutionState(TestRunnerPanel.ExecutionState.STOPPED);
            logger.error(`Error running tests: "${error.message}"`);
            break;
          case 'stderr':
            // Color stderr output red in the console to distinguish it as error.
            this._appendToBuffer(`${Ansi.RED}${message.data}${Ansi.RESET}`);
            break;
        }
      })
      .finally(() => {
        this._stopListening();
        this._setExecutionState(TestRunnerPanel.ExecutionState.STOPPED);
      })
      .subscribe();
    this._run = new TestRunModel(
      label,
      subscription.unsubscribe.bind(subscription),
    );
  }

  _setExecutionState(executionState: number): void {
    this._executionState = executionState;
    this._renderPanel();
  }

  _renderPanel() {
    let progressValue;
    if (
      this._testSuiteModel &&
      this._executionState === TestRunnerPanel.ExecutionState.RUNNING
    ) {
      progressValue = this._testSuiteModel.progressPercent();
    } else {
      // If there is no running test suite, fill the progress bar because there is no progress to
      // track.
      progressValue = 100;
    }
    const component = ReactDOM.render(
      <TestRunnerPanel
        attachDebuggerBeforeRunning={this._attachDebuggerBeforeRunning}
        buffer={this._buffer}
        executionState={this._executionState}
        onClickClear={this.clearOutput}
        onClickRun={this._handleClickRun}
        onClickStop={this.stopTests}
        onDebuggerCheckboxChanged={this._onDebuggerCheckboxChanged}
        path={this._path}
        progressValue={progressValue}
        runDuration={this._run && this._run.getDuration()}
        // `TestRunnerPanel` expects an Array so it can render the test runners in a dropdown and
        // maintain a selected index. `Set` maintains items in insertion order, so the ordering is
        // determinate on each render.
        testRunners={Array.from(this._testRunners)}
        testSuiteModel={this._testSuiteModel}
      />,
      this._root,
    );
    invariant(component instanceof TestRunnerPanel);
    this._testRunnerPanel = component;
  }

  _stopListening(): void {
    this._runningTest = false;
    if (this._run && this._run.dispose != null) {
      try {
        const dispose = this._run.dispose;
        this._run.dispose = null;
        this._run.stop();
        invariant(this._run); // Calling `stop()` should never null the `_run` property.
        track('testrunner-stop-tests', {
          testRunner: this._run.label,
        });
        dispose();
      } catch (e) {
        invariant(this._run); // Nothing in the try block should ever null the `_run` property.
        // If the remote connection goes away, it won't be possible to stop tests. Log an error and
        // proceed as usual.
        logger.error(`Error when stopping test run #'${this._run.label}: ${e}`);
      }
    }
  }

  getTitle() {
    return 'Test Runner';
  }

  getIconName() {
    return 'checklist';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'bottom';
  }

  getElement(): HTMLElement {
    return this._root;
  }

  serialize(): SerializedTestRunnerPanelState {
    return {
      deserializer: 'nuclide.TestRunnerPanelState',
    };
  }
}
