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

import type {HandlesByType, ChildProcessInfo} from '../types';

import React from 'react';
import BasicStatsSectionComponent from './sections/BasicStatsSectionComponent';
import ActiveHandlesSectionComponent from './sections/ActiveHandlesSectionComponent';
import ChildProcessTreeComponent from './sections/ChildProcessTreeComponent';
import CommandsSectionComponent from './sections/CommandsSectionComponent';

type Props = {
  toolbarJewel: string,
  updateToolbarJewel: (value: string) => void,
  cpuPercentage: number,
  memory: number,
  heapPercentage: number,
  activeHandles: number,
  activeRequests: number,
  activeHandlesByType: HandlesByType,
  childProcessesTree: ?ChildProcessInfo,
};

export default class HealthPaneItemComponent extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const sections = {
      Stats: <BasicStatsSectionComponent {...this.props} />,
      Subprocesses: (
        <ChildProcessTreeComponent
          childProcessesTree={this.props.childProcessesTree}
        />
      ),
      Handles: (
        <ActiveHandlesSectionComponent
          activeHandlesByType={this.props.activeHandlesByType}
        />
      ),
      Commands: <CommandsSectionComponent />,
    };

    // For each section, we use settings-view to get a familiar look for table cells.
    return (
      <div>
        {Object.keys(sections).map((title, s) =>
          <div className="nuclide-health-pane-item-section" key={s}>
            <h2>
              {title}
            </h2>
            <div className="settings-view">
              {sections[title]}
            </div>
          </div>,
        )}
      </div>
    );
  }
}
