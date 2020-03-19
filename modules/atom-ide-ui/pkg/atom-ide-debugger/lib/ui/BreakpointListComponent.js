/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {IBreakpoint, IDebugService, IExceptionBreakpoint} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import * as React from 'react';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {track} from 'nuclide-commons/analytics';
import {ListView, ListViewItem} from 'nuclide-commons-ui/ListView';
import classnames from 'classnames';
import {Icon} from 'nuclide-commons-ui/Icon';
import {Observable} from 'rxjs';
import {AnalyticsEvents} from '../constants';
import {openSourceLocation} from '../utils';
import {Section} from 'nuclide-commons-ui/Section';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {observeProjectPathsAll} from 'nuclide-commons-atom/projects';
import passesGK from 'nuclide-commons/passesGK';

type Props = {|
  service: IDebugService,
|};

type State = {
  supportsConditionalBreakpoints: boolean,
  breakpoints: IBreakpoint[],
  exceptionBreakpoints: IExceptionBreakpoint[],
  exceptionBreakpointsCollapsed: boolean,
  unavailableBreakpointsCollapsed: boolean,
  activeProjects: NuclideUri[],
  supportsLogMessage: boolean,
};

export default class BreakpointListComponent extends React.Component<
  Props,
  State,
> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this.state = this._computeState();
    this._disposables = new UniversalDisposable(
      Observable.fromPromise(
        passesGK('nuclide_debugger_logging_breakpoints'),
      ).subscribe(supportsLogMessage => {
        this.setState({supportsLogMessage});
      }),
    );
  }

  _computeState(): State {
    const {service} = this.props;
    const {focusedProcess} = service.viewModel;
    const model = service.getModel();

    const exceptionBreakpointsCollapsed = Boolean(
      featureConfig.get('debugger-exceptionBreakpointsCollapsed'),
    );

    let newActiveProjects = [];
    let newSupportsLogMessage = false;
    if (this.state != null) {
      const {activeProjects, supportsLogMessage} = this.state;
      if (activeProjects != null) {
        newActiveProjects = activeProjects;
      }
      newSupportsLogMessage = supportsLogMessage;
    }

    return {
      supportsConditionalBreakpoints:
        focusedProcess != null &&
        Boolean(
          focusedProcess.session.capabilities.supportsConditionalBreakpoints,
        ),
      breakpoints: model.getBreakpoints(),
      exceptionBreakpoints: model.getExceptionBreakpoints(),
      exceptionBreakpointsCollapsed,
      unavailableBreakpointsCollapsed: true,
      activeProjects: newActiveProjects,
      supportsLogMessage: newSupportsLogMessage,
    };
  }

  componentDidMount(): void {
    const model = this.props.service.getModel();
    const {viewModel} = this.props.service;
    this._disposables.add(
      model.onDidChangeBreakpoints(() => {
        this.setState(this._computeState());
      }),
      // Exception breakpoint filters are different for different debuggers,
      // so we must refresh when switching debugger focus.
      viewModel.onDidChangeDebuggerFocus(() => {
        this.setState(this._computeState());
      }),
      observeProjectPathsAll(projectPaths =>
        this.setState({activeProjects: projectPaths}),
      ),
    );
  }

  componentWillUnmount(): void {
    if (this._disposables != null) {
      this._disposables.dispose();
    }
  }

  _handleBreakpointEnabledChange = (
    breakpoint: IBreakpoint,
    enabled: boolean,
  ): void => {
    this.props.service.enableOrDisableBreakpoints(enabled, breakpoint);
  };

  _handleBreakpointClick = (
    breakpointIndex: number,
    breakpoint: ?IBreakpoint,
  ): void => {
    invariant(breakpoint != null);
    const {uri, line} = breakpoint;
    // Debugger model is 1-based while Atom UI is zero-based.
    openSourceLocation(uri, line - 1);
  };

  _setExceptionCollapsed = (collapsed: boolean): void => {
    featureConfig.set('debugger-exceptionBreakpointsCollapsed', collapsed);
    this.setState({exceptionBreakpointsCollapsed: collapsed});
  };

  _setUnavailableCollapsed = (collapsed: boolean): void => {
    this.setState({unavailableBreakpointsCollapsed: collapsed});
  };

  _getHostnameTranslated(uri: NuclideUri): string {
    try {
      // $FlowFB
      const {getBreakpointHostnameTranslated} = require('./fb-utils');
      return getBreakpointHostnameTranslated(uri);
    } catch (_) {}

    if (nuclideUri.isLocal(uri)) {
      return 'local';
    } else {
      return nuclideUri.getHostname(uri);
    }
  }

  _renderLogMessage(breakpoint: IBreakpoint): ?React.Node {
    if (
      !this.props.service.viewModel.focusedProcess ||
      !this.state.supportsLogMessage ||
      breakpoint.logMessage == null
    ) {
      return null;
    }

    return (
      <div
        className="debugger-breakpoint-condition"
        title={`Breakpoint log message: ${breakpoint.logMessage}`}
        data-path={breakpoint.uri}
        data-line={breakpoint.line}
        data-bpid={breakpoint.getId()}
        onClick={event => {
          atom.commands.dispatch(event.target, 'debugger:edit-breakpoint');
        }}>
        Log Message: {breakpoint.logMessage}
      </div>
    );
  }

  render(): React.Node {
    const {
      exceptionBreakpoints,
      supportsConditionalBreakpoints,
      activeProjects,
      breakpoints,
    } = this.state;
    const {service} = this.props;
    const availableHosts = activeProjects
      .filter(uri => nuclideUri.isRemote(uri))
      .map(uri => this._getHostnameTranslated(uri));
    const breakpointGroup = available =>
      breakpoints
        .filter(bp => {
          const match =
            nuclideUri.isLocal(bp.uri) ||
            availableHosts.some(
              host => this._getHostnameTranslated(bp.uri) === host,
            );
          return available ? match : !match;
        })
        .sort((breakpointA, breakpointB) => {
          const fileA = nuclideUri.basename(breakpointA.uri);
          const fileB = nuclideUri.basename(breakpointB.uri);
          if (fileA !== fileB) {
            return fileA.localeCompare(fileB);
          }
          return breakpointA.line - breakpointB.line;
        })
        .map((breakpoint, i) => {
          const host = this._getHostnameTranslated(breakpoint.uri) || 'local';
          const basename = nuclideUri.basename(breakpoint.uri);
          const {line, verified, uri: path} = breakpoint;
          const enabled = breakpoint.enabled && available;
          const bpId = breakpoint.getId();
          const label = `${basename}:${line}`;
          const title =
            (!enabled
              ? 'Disabled breakpoint'
              : !verified
                ? 'Unresolved Breakpoint'
                : `Breakpoint at ${label} (resolved)`) +
            (available
              ? ''
              : ` - ${host}:${nuclideUri.getPath(breakpoint.uri)}`);

          const conditionElement =
            supportsConditionalBreakpoints && breakpoint.condition != null ? (
              <div
                className="debugger-breakpoint-condition"
                title={`Breakpoint condition: ${breakpoint.condition}`}
                data-path={path}
                data-line={line}
                data-bpid={bpId}
                onClick={event => {
                  atom.commands.dispatch(
                    event.target,
                    'debugger:edit-breakpoint',
                  );
                }}>
                Condition: {breakpoint.condition}
              </div>
            ) : null;

          const hitcountElement =
            breakpoint.hitCount != null && breakpoint.hitCount > 0 ? (
              <div className="debugger-breakpoint-hitcount">
                Hit count: {breakpoint.hitCount}
              </div>
            ) : null;
          const content = (
            <div className="inline-block">
              <div
                className={classnames({
                  'debugger-breakpoint-disabled': !enabled,
                  'debugger-breakpoint-with-condition': Boolean(
                    breakpoint.condition,
                  ),
                })}
                key={i}>
                <Checkbox
                  checked={enabled}
                  onChange={this._handleBreakpointEnabledChange.bind(
                    this,
                    breakpoint,
                  )}
                  onClick={(event: SyntheticEvent<>) => event.stopPropagation()}
                  title={title}
                  disabled={!available}
                  className={classnames(
                    verified ? '' : 'debugger-breakpoint-unresolved',
                    'debugger-breakpoint-checkbox',
                  )}
                />
                <span
                  title={title}
                  data-path={path}
                  data-bpid={bpId}
                  data-line={line}>
                  <div className="debugger-breakpoint-condition-controls">
                    <Icon
                      icon="pencil"
                      className="debugger-breakpoint-condition-control"
                      data-path={path}
                      data-bpid={bpId}
                      data-line={line}
                      onClick={event => {
                        track(
                          AnalyticsEvents.DEBUGGER_EDIT_BREAKPOINT_FROM_ICON,
                        );
                        atom.commands.dispatch(
                          event.target,
                          'debugger:edit-breakpoint',
                        );
                      }}
                    />
                    <Icon
                      icon="x"
                      className="debugger-breakpoint-condition-control"
                      data-path={path}
                      data-bpid={bpId}
                      data-line={line}
                      onClick={event => {
                        track(
                          AnalyticsEvents.DEBUGGER_DELETE_BREAKPOINT_FROM_ICON,
                        );
                        atom.commands.dispatch(
                          event.target,
                          'debugger:remove-breakpoint',
                        );
                        event.stopPropagation();
                      }}
                    />
                  </div>
                  {label}
                </span>
                {conditionElement}
                {this._renderLogMessage(breakpoint)}
                {hitcountElement}
              </div>
            </div>
          );
          return (
            <ListViewItem
              key={label}
              index={i}
              value={breakpoint}
              data-path={path}
              data-bpid={bpId}
              data-line={line}
              title={title}
              className="debugger-breakpoint">
              {content}
            </ListViewItem>
          );
        });
    const availableBreakpoints = breakpointGroup(true);
    const unavailableBreakpoints = breakpointGroup(false);
    return (
      <div>
        <ListView
          alternateBackground={true}
          onSelect={this._handleBreakpointClick}
          selectable={true}>
          {availableBreakpoints}
        </ListView>
        {breakpoints.length === 0 ? (
          <span className="debugger-breakpoint">
            You currently have no source breakpoints set.
          </span>
        ) : null}
        {exceptionBreakpoints.length > 0 ? (
          <Section
            className="debugger-breakpoint-section"
            headline="Exception breakpoints"
            collapsable={true}
            onChange={this._setExceptionCollapsed}
            collapsed={this.state.exceptionBreakpointsCollapsed}>
            {exceptionBreakpoints.map(exceptionBreakpoint => {
              return (
                <div
                  className="debugger-breakpoint"
                  key={exceptionBreakpoint.getId()}>
                  <Checkbox
                    className={classnames(
                      'debugger-breakpoint-checkbox',
                      'debugger-exception-checkbox',
                    )}
                    onChange={enabled =>
                      service.enableOrDisableBreakpoints(
                        enabled,
                        exceptionBreakpoint,
                      )
                    }
                    checked={exceptionBreakpoint.enabled}
                  />
                  {exceptionBreakpoint.label ||
                    `${exceptionBreakpoint.filter} exceptions`}
                </div>
              );
            })}
          </Section>
        ) : null}
        {unavailableBreakpoints.length > 0 ? (
          <Section
            className="debugger-breakpoint-section"
            headline={
              <div className="inline-block">
                <Icon icon="nuclicon-warning" /> Unavailable breakpoints
              </div>
            }
            collapsable={true}
            onChange={this._setUnavailableCollapsed}
            collapsed={this.state.unavailableBreakpointsCollapsed}>
            <div className="debugger-unavailable-breakpoint-help">
              These breakpoints are in files that are not currently available in
              any project root. Add the corresponding local or remote project to
              your file tree to enable these breakpoints.
            </div>
            <ListView alternateBackground={true} selectable={false}>
              {unavailableBreakpoints}
            </ListView>
          </Section>
        ) : null}
      </div>
    );
  }
}
