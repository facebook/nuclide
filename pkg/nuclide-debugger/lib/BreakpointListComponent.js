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
import type BreakpointStore from './BreakpointStore';
import type {FileLineBreakpoints, FileLineBreakpoint} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import * as React from 'react';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {track} from '../../nuclide-analytics';
import {ListView, ListViewItem} from '../../nuclide-ui/ListView';
import classnames from 'classnames';
import {Icon} from 'nuclide-commons-ui/Icon';
import {AnalyticsEvents} from './constants';

type Props = {
  actions: DebuggerActions,
  breakpointStore: BreakpointStore,
};

type State = {
  breakpoints: ?FileLineBreakpoints,
};

export class BreakpointListComponent extends React.Component<Props, State> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {
      breakpoints: this.props.breakpointStore.getAllBreakpoints(),
    };
  }

  componentDidMount(): void {
    const {breakpointStore} = this.props;
    this._disposables = new UniversalDisposable(
      breakpointStore.onNeedUIUpdate(() => {
        this.setState({
          breakpoints: breakpointStore.getAllBreakpoints(),
        });
      }),
    );
  }

  componentWillUnmount(): void {
    if (this._disposables != null) {
      this._disposables.dispose();
    }
  }

  _handleBreakpointEnabledChange = (
    breakpoint: FileLineBreakpoint,
    enabled: boolean,
  ): void => {
    this.props.actions.updateBreakpointEnabled(breakpoint.id, enabled);
  };

  _handleBreakpointClick = (
    breakpointIndex: number,
    breakpoint: ?FileLineBreakpoint,
  ): void => {
    invariant(breakpoint != null);
    const {path, line} = breakpoint;
    this.props.actions.openSourceLocation(
      nuclideUri.nuclideUriToUri(path),
      line,
    );
  };

  _debuggerSupportsConditionalBp = (
    breakpoint: FileLineBreakpoint,
  ): boolean => {
    return this.props.breakpointStore.breakpointSupportsConditions(breakpoint);
  };

  render(): React.Node {
    const {breakpoints} = this.state;
    if (breakpoints == null || breakpoints.length === 0) {
      return <span>(no breakpoints)</span>;
    }

    const items = breakpoints
      .map(breakpoint => ({
        ...breakpoint,
        // Calculate the basename exactly once for each breakpoint
        basename: nuclideUri.basename(breakpoint.path),
      }))
      // Show resolved breakpoints at the top of the list, then order by filename & line number.
      .sort(
        (breakpointA, breakpointB) =>
          100 * (Number(breakpointB.resolved) - Number(breakpointA.resolved)) +
          10 * breakpointA.basename.localeCompare(breakpointB.basename) +
          Math.sign(breakpointA.line - breakpointB.line),
      )
      .map((breakpoint, i) => {
        const {basename, line, enabled, resolved, path} = breakpoint;
        const label = `${basename}:${line + 1}`;
        const title = !enabled
          ? 'Disabled breakpoint'
          : !resolved
            ? 'Unresolved Breakpoint'
            : `Breakpoint at ${label} (resolved)`;

        const conditionElement =
          this._debuggerSupportsConditionalBp(breakpoint) &&
          breakpoint.condition !== '' ? (
            <div
              className="nuclide-debugger-breakpoint-condition"
              title={`Breakpoint condition: ${breakpoint.condition}`}
              data-path={path}
              data-line={line}
              onClick={event => {
                atom.commands.dispatch(
                  event.target,
                  'nuclide-debugger:edit-breakpoint',
                );
              }}>
              Condition: {breakpoint.condition}
            </div>
          ) : null;

        const {hitCount} = breakpoint;
        const hitCountElement =
          hitCount != null && hitCount >= 0 ? (
            <div
              className="nuclide-debugger-breakpoint-hitcount"
              title={`Breakpoint hit count: ${hitCount}`}>
              Hit count: {hitCount}
            </div>
          ) : null;
        const content = (
          <div className="inline-block">
            <div
              className={classnames({
                'nuclide-debugger-breakpoint-disabled': !enabled,
                'nuclide-debugger-breakpoint-with-condition':
                  breakpoint.condition !== '',
              })}
              key={i}>
              <Checkbox
                checked={enabled}
                indeterminate={!resolved}
                disabled={!resolved}
                onChange={this._handleBreakpointEnabledChange.bind(
                  this,
                  breakpoint,
                )}
                onClick={(event: SyntheticEvent<>) => event.stopPropagation()}
                title={title}
                className={classnames(
                  resolved ? '' : 'nuclide-debugger-breakpoint-unresolved',
                )}
              />
              <span title={title} data-path={path} data-line={line}>
                <div className="nuclide-debugger-breakpoint-condition-controls">
                  <Icon
                    icon="pencil"
                    className="nuclide-debugger-breakpoint-condition-control"
                    onClick={event => {
                      track(AnalyticsEvents.DEBUGGER_EDIT_BREAKPOINT_FROM_ICON);
                      atom.commands.dispatch(
                        event.target,
                        'nuclide-debugger:edit-breakpoint',
                      );
                    }}
                  />
                </div>
                {label}
              </span>
              {conditionElement}
            </div>
            {hitCountElement}
          </div>
        );
        return (
          // $FlowFixMe(>=0.53.0) Flow suppress
          <ListViewItem
            key={label}
            value={breakpoint}
            data-path={path}
            data-line={line}
            title={title}
            className="nuclide-debugger-breakpoint">
            {content}
          </ListViewItem>
        );
      });
    return (
      // $FlowFixMe(>=0.53.0) Flow suppress
      <ListView
        alternateBackground={true}
        onSelect={this._handleBreakpointClick}
        selectable={true}>
        {items}
      </ListView>
    );
  }
}
