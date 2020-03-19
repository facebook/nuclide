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

import invariant from 'assert';
import marked from 'marked';
import makeTooltip from './Tooltip';
import * as React from 'react';

type Props = {
  status: any,
  tooltipRoot: HTMLElement,
  detail: React.Element<any>,
};

type State = {
  maxWidth: number,
  maxHeight: number,
};

class TaskRunnerStatusTooltipComponent extends React.Component<Props, State> {
  state: State = {
    maxWidth: 0,
    maxHeight: 0,
  };
  myRef: React.ElementRef<any>;
  constructor(props: Props) {
    super(props);
    this.myRef = React.createRef();
  }
  componentDidUpdate(prevProps: Props, prevState: State) {
    const width = this.myRef.current?.offsetWidth;
    const height = this.myRef.current?.offsetHeight;
    if (this.state.maxWidth !== width) {
      this.setState({
        maxWidth: width,
      });
    }
    if (this.state.maxHeight !== height) {
      this.setState({
        maxHeight: height,
      });
    }
  }
  render(): React.Node {
    this._styleTooltip();
    const {data} = this.props.status;
    invariant(data.kind !== 'null');
    const message = data.message;
    return (
      <div
        className="nuclide-taskbar-status-tooltip-content"
        ref={this.myRef}
        style={{
          minWidth: this.state.maxWidth + 'px',
          minHeight: this.state.maxHeight + 'px',
        }}>
        {message == null ? null : (
          <div
            dangerouslySetInnerHTML={{
              __html: marked(message),
            }}
          />
        )}
        {message == null ? null : <hr />}

        {this.props.detail}
      </div>
    );
  }

  _styleTooltip(): void {
    const {tooltipRoot, status} = this.props;
    if (tooltipRoot != null) {
      tooltipRoot.classList.remove(
        'nuclide-taskbar-status-tooltip-green',
        'nuclide-taskbar-status-tooltip-yellow',
        'nuclide-taskbar-status-tooltip-red',
      );
      tooltipRoot.classList.add(
        'nuclide-taskbar-status-tooltip-' + status.data.kind,
      );
    }
  }
}

const TaskRunnerStatusTooltip = makeTooltip(TaskRunnerStatusTooltipComponent);
export default TaskRunnerStatusTooltip;
