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

import type TestSuiteModel from '../TestSuiteModel';
import type {TestRunner, RunTestOption} from '../types';

import nuclideUri from 'nuclide-commons/nuclideUri';
import Console from './Console';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {Toolbar} from 'nuclide-commons-ui/Toolbar';
import {ToolbarLeft} from 'nuclide-commons-ui/ToolbarLeft';
import {ToolbarRight} from 'nuclide-commons-ui/ToolbarRight';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {Button, ButtonSizes, ButtonTypes} from 'nuclide-commons-ui/Button';
import nullthrows from 'nullthrows';
import createPaneContainer from 'nuclide-commons-atom/create-pane-container';
import * as React from 'react';
import ReactDOM from 'react-dom';
import TestClassTree from './TestClassTree';

type Props = {
  attachDebuggerBeforeRunning: ?boolean,
  filterMethodsValue: ?string,
  buffer: Object,
  executionState: number,
  onClickClear: (event: SyntheticMouseEvent<>) => mixed,
  onClickRun: (event: SyntheticMouseEvent<>) => mixed,
  onClickStop: (event: SyntheticMouseEvent<>) => mixed,
  onDebuggerCheckboxChanged: (isChecked: boolean) => mixed,
  path: ?string,
  progressValue: ?number,
  runDuration: ?number,
  testRunners: Array<TestRunner>,
  testSuiteModel: ?TestSuiteModel,
};

type State = {
  selectedTestRunnerIndex: number,
  consoleContainer: ?HTMLElement,
  treeContainer: ?HTMLElement,
  filterMethodsShown: boolean,
  filterMethodsText: string,
};

export default class TestRunnerPanel extends React.Component<Props, State> {
  static ExecutionState = Object.freeze({
    RUNNING: 0,
    STOPPED: 1,
  });

  _paneContainer: Object;
  _paneContainerElement: ?HTMLElement;
  _textEditorModel: TextEditor;
  // Bound Functions for use as callbacks.
  setSelectedTestRunnerIndex: Function;
  onFilterMethodButtonClick: Function;
  onFilterMethodTextChanged: Function;

  state = {
    treeContainer: null,
    consoleContainer: null,
    // If there are test runners, start with the first one selected. Otherwise store -1 to
    // later indicate there were no active test runners.
    selectedTestRunnerIndex: this.props.testRunners.length > 0 ? 0 : -1,
    filterMethodsShown: false,
    filterMethodsText: this.props.filterMethodsValue || '',
  };

  componentDidMount() {
    this._paneContainer = createPaneContainer();
    const leftPane = this._paneContainer.getActivePane();
    const rightPane = leftPane.splitRight({
      // Prevent Atom from cloning children on splitting; this panel wants an empty container.
      copyActiveItem: false,
      // Make the right pane 2/3 the width of the parent since console output is generally wider
      // than the test tree.
      flexScale: 2,
    });

    nullthrows(this._paneContainerElement).appendChild(
      atom.views.getView(this._paneContainer),
    );

    this.setState({
      treeContainer: atom.views.getView(leftPane).querySelector('.item-views'),
      consoleContainer: atom.views
        .getView(rightPane)
        .querySelector('.item-views'),
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps: Object) {
    const currSelectedIndex = this.state.selectedTestRunnerIndex;
    if (currSelectedIndex === -1 && nextProps.testRunners.length > 0) {
      this.setState({selectedTestRunnerIndex: 0});
    } else if (nextProps.testRunners.length === 0 && currSelectedIndex >= 0) {
      this.setState({selectedTestRunnerIndex: -1});
    }
  }

  componentWillUnmount() {
    this._paneContainer.destroy();
  }

  render() {
    let runStopButton;
    switch (this.props.executionState) {
      case TestRunnerPanel.ExecutionState.RUNNING:
        runStopButton = (
          <Button
            size={ButtonSizes.SMALL}
            className="inline-block"
            icon="primitive-square"
            buttonType={ButtonTypes.ERROR}
            onClick={this.props.onClickStop}>
            Stop
          </Button>
        );
        break;
      case TestRunnerPanel.ExecutionState.STOPPED:
        const initialTest = this.props.path === undefined;
        runStopButton = (
          <Button
            size={ButtonSizes.SMALL}
            className="inline-block"
            icon={initialTest ? 'playback-play' : 'sync'}
            buttonType={ButtonTypes.PRIMARY}
            disabled={this.isDisabled()}
            onClick={this.props.onClickRun}>
            {initialTest ? 'Test' : 'Re-Test'}
          </Button>
        );
        break;
    }

    // Assign `value` only when needed so a null/undefined value will show an indeterminate
    // progress bar.
    let progressAttrs: ?{[key: string]: mixed} = undefined;
    // flowlint-next-line sketchy-null-number:off
    if (this.props.progressValue) {
      // `key` is set to force React to treat this as a new element when the `value` attr should be
      // removed. Currently it just sets `value="0"`, which is styled differently from no `value`
      // attr at all.
      // TODO: Remove the `key` once https://github.com/facebook/react/issues/1448 is resolved.
      progressAttrs = {
        key: 1,
        value: this.props.progressValue,
      };
    }

    let runMsg;
    if (this.props.executionState === TestRunnerPanel.ExecutionState.RUNNING) {
      runMsg = <span className="inline-block">Running</span>;
      // flowlint-next-line sketchy-null-number:off
    } else if (this.props.runDuration) {
      runMsg = (
        <span className="inline-block">
          Done (in {this.props.runDuration / 1000}s)
        </span>
      );
    }

    let pathMsg;
    // flowlint-next-line sketchy-null-string:off
    if (this.props.path) {
      pathMsg = (
        <span title={this.props.path} className="inline-block">
          {nuclideUri.basename(this.props.path)}
        </span>
      );
    }

    let dropdown;
    if (this.isDisabled()) {
      dropdown = (
        <span className="inline-block text-warning">
          No registered test runners
        </span>
      );
    } else {
      dropdown = (
        <Dropdown
          className="inline-block nuclide-test-runner__runner-dropdown"
          disabled={
            this.props.executionState === TestRunnerPanel.ExecutionState.RUNNING
          }
          options={this.props.testRunners.map((testRunner, index) => ({
            label: testRunner.label,
            value: index,
          }))}
          onChange={this.setSelectedTestRunnerIndex}
          value={this.state.selectedTestRunnerIndex}
          size="sm"
          title="Choose a test runner"
        />
      );
    }

    let attachDebuggerCheckbox = null;
    if (this.props.attachDebuggerBeforeRunning != null) {
      attachDebuggerCheckbox = (
        <Checkbox
          className="inline-block"
          checked={this.props.attachDebuggerBeforeRunning}
          label="Enable Debugger"
          onChange={this.props.onDebuggerCheckboxChanged}
        />
      );
    }

    const filterMethodsProps = this.getSelectedTestRunnerSupportedOptions().get(
      'filter',
    );
    let filterTestMethodsButton = null;
    let filterTestMethodsTextbox = null;
    if (filterMethodsProps) {
      // flowlint-next-line sketchy-null-string:off
      const buttonLabel = filterMethodsProps.label || 'Filter';
      filterTestMethodsButton = (
        <Button
          className="btn"
          icon="nuclicon-funnel"
          size="EXTRA_SMALL"
          buttonType={
            this.state.filterMethodsShown ? ButtonTypes.PRIMARY : null
          }
          onClick={this.onFilterMethodButtonClick}
          tooltip={{
            title: this.state.filterMethodsShown
              ? buttonLabel + ' (hide)'
              : buttonLabel + ' (show)',
          }}
        />
      );
      if (this.state.filterMethodsShown) {
        filterTestMethodsTextbox = (
          <AtomInput
            className="inline-block"
            value={this.state.filterMethodsText}
            size="sm"
            placeholderText={filterMethodsProps.placeholderText}
            onDidChange={this.onFilterMethodTextChanged}
            width={250}
            tooltip={{title: filterMethodsProps.tooltip}}
          />
        );
      }
    }

    const running =
      this.props.executionState === TestRunnerPanel.ExecutionState.RUNNING;

    const progressBar = running ? (
      <progress
        className="inline-block"
        max="100"
        title="Test progress"
        {...progressAttrs}
      />
    ) : null;

    const tree =
      this.state.treeContainer == null
        ? null
        : ReactDOM.createPortal(
            <TestClassTree
              isRunning={
                this.props.executionState ===
                TestRunnerPanel.ExecutionState.RUNNING
              }
              testSuiteModel={this.props.testSuiteModel}
            />,
            this.state.treeContainer,
          );

    const console =
      this.state.consoleContainer == null
        ? null
        : ReactDOM.createPortal(
            <Console textBuffer={this.props.buffer} />,
            this.state.consoleContainer,
          );

    return (
      <div className="nuclide-test-runner-panel">
        {tree}
        {console}
        <Toolbar location="top">
          <ToolbarLeft>
            {dropdown}
            {runStopButton}
            {attachDebuggerCheckbox}
            {pathMsg}
            {filterTestMethodsButton}
            {filterTestMethodsTextbox}
          </ToolbarLeft>
          <ToolbarRight>
            {runMsg}
            {progressBar}
            <Button
              size={ButtonSizes.SMALL}
              className="inline-block"
              disabled={this.isDisabled() || running}
              onClick={this.props.onClickClear}>
              Clear
            </Button>
          </ToolbarRight>
        </Toolbar>
        <div
          className="nuclide-test-runner-console"
          ref={el => {
            this._paneContainerElement = el;
          }}
        />
      </div>
    );
  }

  isDisabled(): boolean {
    return this.props.testRunners.length === 0;
  }

  setSelectedTestRunnerIndex = (selectedTestRunnerIndex: number): void => {
    this.setState({selectedTestRunnerIndex});
  };

  onFilterMethodButtonClick = (): void => {
    this.setState(prevState => ({
      filterMethodsShown: !prevState.filterMethodsShown,
    }));
  };

  onFilterMethodTextChanged = (newValue: string): void => {
    this.setState({
      filterMethodsText: newValue,
    });
  };

  getSelectedTestRunner(): ?Object {
    const selectedTestRunnerIndex = this.state.selectedTestRunnerIndex;
    if (selectedTestRunnerIndex >= 0) {
      return this.props.testRunners[selectedTestRunnerIndex];
    }
  }

  getSelectedTestRunnerSupportedOptions(): Map<string, RunTestOption> {
    const runner = this.getSelectedTestRunner();
    const supportedOptions = runner && runner.supportedOptions;
    return supportedOptions || new Map();
  }

  getFilterMethodsValue(): string {
    if (this.state.filterMethodsShown) {
      return this.state.filterMethodsText;
    } else {
      return '';
    }
  }
}
