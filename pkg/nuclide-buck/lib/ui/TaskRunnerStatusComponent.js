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

import type {
  TaskRunnerBulletinStatus,
  TaskRunnerBulletinTitle,
  TaskOutcome,
} from '../../../nuclide-task-runner/lib/types';

import classnames from 'classnames';
import FullWidthProgressBar from 'nuclide-commons-ui/FullWidthProgressBar';
import {Observable, BehaviorSubject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import TaskRunnerStatusTooltip from './TaskRunnerStatusTooltip';

type Props = {
  taskIsRunning: boolean,
  outcome: ?TaskOutcome,
  bulletin: ?TaskRunnerBulletinStatus,
  progress: ?number,
};

type State = {
  hoveredProviderName: ?string,
  secondsSinceTitleChange: string,
  titleChangeTimestamp: number,
  visible: boolean,
  recentProgress: number,
};

const MinimumTaskProgress: number = 0.01;
const LevelToIcon = {
  success: 'icon-check',
  error: 'icon-alert',
  warning: 'icon-alert',
};

export default class TaskRunnerStatusComponent extends React.Component<
  Props,
  State,
> {
  _tooltipRefs: Map<string, HTMLElement> = new Map();
  // Legacy of migration, will remove this later.
  _hoveredProviderName: BehaviorSubject<?string> = new BehaviorSubject(null);
  _disposables: UniversalDisposable = new UniversalDisposable();
  _intervalID: ?IntervalID;

  state: State = {
    hoveredProviderName: null,
    secondsSinceTitleChange: '0.1',
    titleChangeTimestamp: 0,
    visible: false,
    recentProgress: MinimumTaskProgress,
  };

  _tickUpdateSeconds() {
    const timenow = Date.now() - this.state.titleChangeTimestamp;
    this.setState({
      secondsSinceTitleChange: Math.max(timenow / 1000, 0.1).toFixed(1),
    });
  }

  constructor() {
    super();

    // $FlowFixMe: debounce() is not in flow types for rxjs
    const hoveredProviderNameDebounced = this._hoveredProviderName.debounce(
      hoveredProviderName => {
        // No debounce when hovering on to, 250ms debounce when hovering off of
        return Observable.empty().delay(hoveredProviderName != null ? 0 : 250);
      },
    );
    this._disposables.add(
      hoveredProviderNameDebounced.subscribe(hoveredProviderName => {
        this.setState({hoveredProviderName});
      }),
    );
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {taskIsRunning, progress, outcome, bulletin} = this.props;
    const {visible} = this.state;
    if (visible && !prevState.visible) {
      this._startTimer();
      this._setTitleChangeTimestamp();
    }
    if (!visible && prevState.visible) {
      this._stopTimer();
    }
    if (taskIsRunning && !visible) {
      this.setState({visible: true});
    }
    if (
      bulletin != null &&
      bulletin.title.message !== prevProps.bulletin?.title.message
    ) {
      this._setTitleChangeTimestamp();
    }

    let progressTargetValue = this.state.recentProgress;
    if (progress != null) {
      progressTargetValue = Math.max(progress, MinimumTaskProgress);
    } else if (outcome != null) {
      // A race condition exists where { progress: 1 } won't reach here,
      // so we're overwriting progress for successful tasks to 100%
      if (outcome.type === 'success') {
        progressTargetValue = 1;
      }
    } else {
      // if progress && outcome are both null, then the Task has just started,
      // so progress should be MinimumTaskProgress until progress is set by buck
      progressTargetValue = MinimumTaskProgress;
    }

    if (this.state.recentProgress !== progressTargetValue) {
      this.setState({recentProgress: progressTargetValue});
    }
  }

  componentWillUnmount() {
    this._stopTimer();
    this._disposables.dispose();
  }

  _setTitleChangeTimestamp(): void {
    this.setState({
      titleChangeTimestamp: Date.now(),
      secondsSinceTitleChange: '0.1',
    });
  }

  _startTimer(): void {
    this._stopTimer();
    this._intervalID = setInterval(() => {
      this._tickUpdateSeconds();
    }, 100);
  }

  _stopTimer(): void {
    if (this._intervalID != null) {
      clearInterval(this._intervalID);
      this._intervalID = null;
    }
  }

  _defaultTitle(): React.Node {
    return (
      <>
        {'Running task... '}
        <span className={classnames('task-seconds')}>
          {this.state.secondsSinceTitleChange}
        </span>
        {' sec'}
      </>
    );
  }

  render(): React.Node {
    const serverStatus = {
      data: {
        kind: 'green',
        message: null,
        buttons: ['Stop'],
      },
      provider: {
        name: '',
        description: '',
        priority: 1,
      },
    };
    const clearButton = (
      <div
        className="close-icon"
        onClick={() => this.setState({visible: false})}
      />
    );
    if (!this.state.visible) {
      return null;
    }
    return (
      <div className="nuclide-taskbar-status-container">
        <FullWidthProgressBar progress={this.state.recentProgress} />
        <div className="nuclide-taskbar-status-providers-container">
          {this._renderProvider(
            serverStatus,
            this.state.hoveredProviderName != null,
          )}
          {this.props.taskIsRunning ? null : clearButton}
        </div>
      </div>
    );
  }

  _reactNodeFromTitle = (title: TaskRunnerBulletinTitle): React.Node => {
    switch (title.level) {
      case 'success':
      case 'error':
      case 'warning':
        return (
          <>
            <span className={classnames('icon ' + LevelToIcon[title.level])} />
            {title.message}
          </>
        );
      case 'log':
      default:
        return (
          <>
            {`${title.message.slice(0, 24)} `}
            <span className={classnames('task-seconds')}>
              {this.state.secondsSinceTitleChange}
            </span>
            {' sec'}
          </>
        );
    }
  };

  _renderProvider = (status: any, hovered: boolean): React.Node => {
    const {provider} = status;
    const title = this.props.bulletin?.title;
    return (
      <div
        className={classnames('nuclide-taskbar-status-provider')}
        onMouseOver={this._onMouseOver}
        onMouseOut={this._onMouseOut}
        data-name={status.provider.name}
        key={status.provider.name}
        ref={this._setTooltipRef}>
        {title == null ? this._defaultTitle() : this._reactNodeFromTitle(title)}
        <div className="fb-on-demand-beta-small nuclide-taskbar-beta-small" />
        {this.state.hoveredProviderName !== provider.name ||
        this.props.bulletin?.detail == null ? null : (
          <TaskRunnerStatusTooltip
            detail={this.props.bulletin?.detail}
            parentRef={this._tooltipRefs.get(status.provider.name)}
            status={status}
          />
        )}
      </div>
    );
  };

  _setTooltipRef = (ref: React.ElementRef<any>): void => {
    if (ref == null) {
      return;
    }
    this._tooltipRefs.set(ref.dataset.name, ref);
  };

  _onMouseOver = (e: SyntheticEvent<any>): void => {
    this._hoveredProviderName.next(e.currentTarget.dataset.name);
  };

  _onMouseOut = (): void => {
    this._hoveredProviderName.next(null);
  };
}
