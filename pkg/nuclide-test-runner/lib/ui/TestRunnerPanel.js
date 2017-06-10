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
import type {TestRunner} from '../types';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import Console from './Console';
import {Dropdown} from '../../../nuclide-ui/Dropdown';
import {Toolbar} from 'nuclide-commons-ui/Toolbar';
import {ToolbarLeft} from 'nuclide-commons-ui/ToolbarLeft';
import {ToolbarRight} from 'nuclide-commons-ui/ToolbarRight';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {Button, ButtonSizes, ButtonTypes} from 'nuclide-commons-ui/Button';
import createPaneContainer from '../../../commons-atom/create-pane-container';
import React from 'react';
import ReactDOM from 'react-dom';
import TestClassTree from './TestClassTree';

type Props = {
  attachDebuggerBeforeRunning: ?boolean,
  buffer: Object,
  executionState: number,
  onClickClear: (event: SyntheticMouseEvent) => mixed,
  onClickRun: (event: SyntheticMouseEvent) => mixed,
  onClickStop: (event: SyntheticMouseEvent) => mixed,
  onDebuggerCheckboxChanged: (isChecked: boolean) => mixed,
  path: ?string,
  progressValue: ?number,
  runDuration: ?number,
  testRunners: Array<TestRunner>,
  testSuiteModel: ?TestSuiteModel,
};

type State = {
  selectedTestRunnerIndex: number,
};

export default class TestRunnerPanel extends React.Component {
  props: Props;
  state: State;
  _paneContainer: Object;
  _leftPane: atom$Pane;
  _rightPane: atom$Pane;
  _textEditorModel: TextEditor;
  _tree: TestClassTree;

  // Bound Functions for use as callbacks.
  setSelectedTestRunnerIndex: Function;

  static ExecutionState = Object.freeze({
    RUNNING: 0,
    STOPPED: 1,
  });

  constructor(props: Object) {
    super(props);
    this.state = {
      roots: [],
      // If there are test runners, start with the first one selected. Otherwise store -1 to
      // later indicate there were no active test runners.
      selectedTestRunnerIndex: props.testRunners.length > 0 ? 0 : -1,
    };

    // Bind Functions for use as callbacks;
    // TODO: Replace with property initializers when supported by Flow;
    this.setSelectedTestRunnerIndex = this.setSelectedTestRunnerIndex.bind(
      this,
    );
  }

  componentDidMount() {
    this._paneContainer = createPaneContainer();
    this._leftPane = this._paneContainer.getActivePane();
    this._rightPane = this._leftPane.splitRight({
      // Prevent Atom from cloning children on splitting; this panel wants an empty container.
      copyActiveItem: false,
      // Make the right pane 2/3 the width of the parent since console output is generally wider
      // than the test tree.
      flexScale: 2,
    });

    this.renderTree();
    this.renderConsole();

    // $FlowFixMe
    ReactDOM.findDOMNode(this.refs.paneContainer).appendChild(
      atom.views.getView(this._paneContainer),
    );
  }

  componentDidUpdate() {
    this.renderTree();
  }

  componentWillReceiveProps(nextProps: Object) {
    const currSelectedIndex = this.state.selectedTestRunnerIndex;
    if (currSelectedIndex === -1 && nextProps.testRunners.length > 0) {
      this.setState({selectedTestRunnerIndex: 0});
    } else if (nextProps.testRunners.length === 0 && currSelectedIndex >= 0) {
      this.setState({selectedTestRunnerIndex: -1});
    }
  }

  componentWillUnmount() {
    ReactDOM.unmountComponentAtNode(
      atom.views.getView(this._rightPane).querySelector('.item-views'),
    );
    ReactDOM.unmountComponentAtNode(
      atom.views.getView(this._leftPane).querySelector('.item-views'),
    );
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
    } else if (this.props.runDuration) {
      runMsg = (
        <span className="inline-block">
          Done (in {this.props.runDuration / 1000}s)
        </span>
      );
    }

    let pathMsg;
    if (this.props.path) {
      pathMsg = (
        <span title={this.props.path}>
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
          ref="dropdown"
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

    const running =
      this.props.executionState === TestRunnerPanel.ExecutionState.RUNNING;

    const progressBar = running
      ? <progress
          className="inline-block"
          max="100"
          title="Test progress"
          {...progressAttrs}
        />
      : null;

    return (
      <div className="nuclide-test-runner-panel">
        <Toolbar location="top">
          <ToolbarLeft>
            {dropdown}
            {runStopButton}
            {attachDebuggerCheckbox}
            {pathMsg}
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
        <div className="nuclide-test-runner-console" ref="paneContainer" />
      </div>
    );
  }

  isDisabled(): boolean {
    return this.props.testRunners.length === 0;
  }

  setSelectedTestRunnerIndex(selectedTestRunnerIndex: number): void {
    this.setState({selectedTestRunnerIndex});
  }

  getSelectedTestRunner(): ?Object {
    const selectedTestRunnerIndex = this.state.selectedTestRunnerIndex;
    if (selectedTestRunnerIndex >= 0) {
      return this.props.testRunners[selectedTestRunnerIndex];
    }
  }

  renderTree() {
    const component = ReactDOM.render(
      <TestClassTree
        isRunning={
          this.props.executionState === TestRunnerPanel.ExecutionState.RUNNING
        }
        testSuiteModel={this.props.testSuiteModel}
      />,
      atom.views.getView(this._leftPane).querySelector('.item-views'),
    );
    invariant(component instanceof TestClassTree);
    this._tree = component;
  }

  renderConsole() {
    ReactDOM.render(
      <Console textBuffer={this.props.buffer} />,
      atom.views.getView(this._rightPane).querySelector('.item-views'),
    );
  }
}
