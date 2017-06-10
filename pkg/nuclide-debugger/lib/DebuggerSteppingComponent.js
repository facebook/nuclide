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

import type DebuggerActions from './DebuggerActions';
import type {ControlButtonSpecification, DebuggerModeType} from './types';
import type {DebuggerStore} from './DebuggerStore';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';

import React from 'react';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import ChromeActionRegistryActions from './ChromeActionRegistryActions';
import {DebuggerMode} from './DebuggerStore';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type DebuggerSteppingComponentProps = {
  actions: DebuggerActions,
  debuggerStore: DebuggerStore,
};

type DebuggerSteppingComponentState = {
  allowSingleThreadStepping: boolean,
  debuggerMode: DebuggerModeType,
  pauseOnException: boolean,
  pauseOnCaughtException: boolean,
  enableSingleThreadStepping: boolean,
  customControlButtons: Array<ControlButtonSpecification>,
  waitingForPause: boolean,
};

const defaultTooltipOptions = {
  placement: 'bottom',
};

const STEP_OVER_ICON = (
  <svg viewBox="0 0 100 100">
    <circle cx="46" cy="63" r="10" />
    <path
      d={
        'M83.8,54.7c-6.5-16.6-20.7-28.1-37.2-28.1c-19.4,0-35.6,16-39.9,' +
          '37.3l11.6,2.9c3-16.2,14.5-28.2,28.2-28.2 c11,0,20.7,7.8,25.6,' +
          '19.3l-9.6,2.7l20.8,14.7L93.7,52L83.8,54.7z'
      }
    />
  </svg>
);

const STEP_INTO_ICON = (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="75" r="10" />
    <polygon points="42,20 57,20 57,40 72,40 50,60 28,40 42,40" />
  </svg>
);

const STEP_OUT_ICON = (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="75" r="10" />
    <polygon
      points="42,20 57,20 57,40 72,40 50,60 28,40 42,40"
      transform="rotate(180, 50, 40)"
    />
  </svg>
);

function SVGButton(props: {
  onClick: () => void,
  tooltip: atom$TooltipsAddOptions,
  icon: React.Element<any>,
  disabled: boolean,
}): React.Element<any> {
  return (
    <Button
      className="nuclide-debugger-stepping-svg-button"
      onClick={props.onClick}
      disabled={props.disabled}
      tooltip={props.tooltip}>
      <div>
        {props.icon}
      </div>
    </Button>
  );
}

export class DebuggerSteppingComponent extends React.Component {
  props: DebuggerSteppingComponentProps;
  state: DebuggerSteppingComponentState;
  _disposables: UniversalDisposable;

  constructor(props: DebuggerSteppingComponentProps) {
    super(props);
    (this: any)._setWaitingForPause = this._setWaitingForPause.bind(this);
    (this: any)._togglePauseState = this._togglePauseState.bind(this);

    this._disposables = new UniversalDisposable();
    const {debuggerStore} = props;
    this.state = {
      allowSingleThreadStepping: Boolean(
        debuggerStore.getSettings().get('SingleThreadStepping'),
      ),
      debuggerMode: debuggerStore.getDebuggerMode(),
      pauseOnException: debuggerStore.getTogglePauseOnException(),
      pauseOnCaughtException: debuggerStore.getTogglePauseOnCaughtException(),
      enableSingleThreadStepping: debuggerStore.getEnableSingleThreadStepping(),
      customControlButtons: debuggerStore.getCustomControlButtons(),
      waitingForPause: false,
    };
  }

  componentDidMount(): void {
    const {debuggerStore} = this.props;
    this._disposables.add(
      debuggerStore.onChange(() => {
        this.setState({
          allowSingleThreadStepping: Boolean(
            debuggerStore.getSettings().get('SingleThreadStepping'),
          ),
          debuggerMode: debuggerStore.getDebuggerMode(),
          pauseOnException: debuggerStore.getTogglePauseOnException(),
          pauseOnCaughtException: debuggerStore.getTogglePauseOnCaughtException(),
          enableSingleThreadStepping: debuggerStore.getEnableSingleThreadStepping(),
          customControlButtons: debuggerStore.getCustomControlButtons(),
        });

        if (
          this.state.waitingForPause &&
          debuggerStore.getDebuggerMode() !== DebuggerMode.RUNNING
        ) {
          this._setWaitingForPause(false);
        }
      }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _setWaitingForPause(waiting: boolean): void {
    this.setState({
      waitingForPause: waiting,
    });
  }

  _togglePauseState() {
    if (this.state.debuggerMode === DebuggerMode.RUNNING) {
      this._setWaitingForPause(true);
    }

    // ChromeActionRegistryActions.PAUSE actually toggles paused state.
    const actionId = this.state.debuggerMode === DebuggerMode.RUNNING
      ? ChromeActionRegistryActions.PAUSE
      : ChromeActionRegistryActions.RUN;
    this.props.actions.triggerDebuggerAction(actionId);
  }

  render(): ?React.Element<any> {
    const {
      debuggerMode,
      pauseOnException,
      pauseOnCaughtException,
      allowSingleThreadStepping,
      enableSingleThreadStepping,
      customControlButtons,
      waitingForPause,
    } = this.state;
    const {actions} = this.props;
    const isPaused = debuggerMode === DebuggerMode.PAUSED;
    const isStopped = debuggerMode === DebuggerMode.STOPPED;
    const isPausing = debuggerMode === DebuggerMode.RUNNING && waitingForPause;
    const playPauseIcon = isPausing
      ? null
      : <span
          className={isPaused ? 'icon-playback-play' : 'icon-playback-pause'}
        />;

    const loadingIndicator = !isPausing
      ? null
      : <LoadingSpinner
          className="nuclide-debugger-stepping-playpause-button-loading"
          size={LoadingSpinnerSizes.EXTRA_SMALL}
        />;

    // "Set Source Paths" is only available if the current debugger provides
    // this functionality.
    const setSourcePathsButton = !this.props.debuggerStore.getCanSetSourcePaths()
      ? null
      : <Button
          className="nuclide-debugger-set-source-path-button"
          icon="file-code"
          title="Configure source file paths"
          onClick={() => actions.configureSourcePaths()}
        />;

    const restartDebuggerButton = !this.props.debuggerStore.getCanRestartDebugger()
      ? null
      : <Button
          icon="sync"
          className="nuclide-debugger-stepping-button-separated"
          disabled={isStopped}
          tooltip={{
            ...defaultTooltipOptions,
            title: 'Restart the debugger using the same settings as the current debug session',
            keyBindingCommand: 'nuclide-debugger:restart-debugging',
          }}
          onClick={() => actions.restartDebugger()}
        />;

    return (
      <div className="nuclide-debugger-stepping-component">
        <ButtonGroup className="nuclide-debugger-stepping-buttongroup">
          {restartDebuggerButton}
          <Button
            disabled={isStopped || isPausing}
            tooltip={{
              ...defaultTooltipOptions,
              title: isPausing
                ? 'Waiting for pause...'
                : isPaused ? 'Continue' : 'Pause',
              keyBindingCommand: isPaused
                ? 'nuclide-debugger:continue-debugging'
                : undefined,
            }}
            onClick={this._togglePauseState.bind(this)}>
            <div className="nuclide-debugger-stepping-playpause-button">
              {playPauseIcon}
              {loadingIndicator}
            </div>
          </Button>
          <SVGButton
            icon={STEP_OVER_ICON}
            disabled={!isPaused}
            tooltip={{
              ...defaultTooltipOptions,
              title: 'Step over',
              keyBindingCommand: 'nuclide-debugger:step-over',
            }}
            onClick={actions.triggerDebuggerAction.bind(
              actions,
              ChromeActionRegistryActions.STEP_OVER,
            )}
          />
          <SVGButton
            icon={STEP_INTO_ICON}
            disabled={!isPaused}
            tooltip={{
              ...defaultTooltipOptions,
              title: 'Step into',
              keyBindingCommand: 'nuclide-debugger:step-into',
            }}
            onClick={actions.triggerDebuggerAction.bind(
              actions,
              ChromeActionRegistryActions.STEP_INTO,
            )}
          />
          <SVGButton
            icon={STEP_OUT_ICON}
            disabled={!isPaused}
            tooltip={{
              ...defaultTooltipOptions,
              title: 'Step out',
              keyBindingCommand: 'nuclide-debugger:step-out',
            }}
            onClick={actions.triggerDebuggerAction.bind(
              actions,
              ChromeActionRegistryActions.STEP_OUT,
            )}
          />
          <Button
            icon="primitive-square"
            disabled={isStopped}
            tooltip={{
              ...defaultTooltipOptions,
              title: 'Detach debugger',
              keyBindingCommand: 'nuclide-debugger:stop-debugging',
            }}
            onClick={() => actions.stopDebugging()}
          />
          {setSourcePathsButton}
        </ButtonGroup>
        <ButtonGroup className="nuclide-debugger-stepping-buttongroup">
          {customControlButtons.map((specification, i) => (
            <Button {...specification} key={i} />
          ))}
        </ButtonGroup>
        <Checkbox
          className="nuclide-debugger-exception-checkbox"
          onChange={() => actions.togglePauseOnException(!pauseOnException)}
          checked={pauseOnException}
          label={pauseOnException ? 'Pause on' : 'Pause on exception'}
        />
        {pauseOnException
          ? [
              <ButtonGroup key="first">
                <Button
                  size="EXTRA_SMALL"
                  selected={!pauseOnCaughtException}
                  onClick={() => actions.togglePauseOnCaughtException(false)}>
                  uncaught
                </Button>
                <Button
                  size="EXTRA_SMALL"
                  selected={pauseOnCaughtException}
                  onClick={() => actions.togglePauseOnCaughtException(true)}>
                  any
                </Button>
              </ButtonGroup>,
              <span
                key="second"
                className="nuclide-debugger-exception-fragment">
                {' exception'}
              </span>,
            ]
          : null}
        {allowSingleThreadStepping
          ? <Checkbox
              disabled={isStopped}
              className="nuclide-debugger-exception-checkbox"
              onChange={() =>
                actions.toggleSingleThreadStepping(!enableSingleThreadStepping)}
              checked={enableSingleThreadStepping}
              label={'Single Thread Stepping'}
            />
          : null}
      </div>
    );
  }
}
