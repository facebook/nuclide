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

import type {PaneItemState} from './types';
import type {Observable} from 'rxjs';

import HealthPaneItemComponent from './ui/HealthPaneItemComponent';
import * as React from 'react';

type Props = {
  stateStream: Observable<?PaneItemState>,
};

export const WORKSPACE_VIEW_URI = 'atom://nuclide/health';

export default class HealthPaneItem extends React.Component<
  Props,
  PaneItemState,
> {
  _stateSubscription: rxjs$ISubscription;

  constructor(props: Props) {
    super(props);
    this.state = {
      stats: null,
      childProcessesTree: null,
    };
  }

  componentDidMount() {
    // Note: We assume the `stateStram` prop never changes.
    this._stateSubscription = this.props.stateStream.subscribe(state =>
      this.setState(state || {}),
    );
  }

  componentWillUnmount() {
    this._stateSubscription.unsubscribe();
  }

  getTitle(): string {
    return 'Health';
  }

  getIconName(): string {
    return 'dashboard';
  }

  // Return false to prevent the tab getting split (since we only update a singleton health pane).
  copy(): boolean {
    return false;
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'center';
  }

  render() {
    const {
      toolbarJewel,
      updateToolbarJewel,
      childProcessesTree,
      stats,
    } = this.state;

    if (stats == null) {
      return <div />;
    }

    return (
      <div
        // Need native-key-bindings and tabIndex={-1} to be able to copy paste
        className="pane-item padded nuclide-health-pane-item native-key-bindings"
        tabIndex={-1}>
        {/* $FlowFixMe(>=0.53.0) Flow suppress */}
        <HealthPaneItemComponent
          toolbarJewel={toolbarJewel}
          updateToolbarJewel={updateToolbarJewel}
          cpuPercentage={stats.cpuPercentage}
          heapPercentage={stats.heapPercentage}
          memory={stats.rss}
          activeHandles={stats.activeHandles}
          activeRequests={stats.activeRequests}
          activeHandlesByType={stats.activeHandlesByType}
          childProcessesTree={childProcessesTree}
        />
      </div>
    );
  }
}
