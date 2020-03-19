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

import nullthrows from 'nullthrows';
import * as React from 'react';
import ReactDOM from 'react-dom';

type Props = {
  parentRef: ?React.ElementRef<any>,
};

type State = {
  tooltipRoot: ?HTMLElement,
};

// Higher order component class for rendering a stylable hover tooltip.
const makeTooltip = (TooltipComponent: React.ComponentType<any>) => {
  class HigherOrderTooltip extends React.Component<Props, State> {
    _tooltipDisposable: ?IDisposable;
    _parentRef: ?React.ElementRef<any>;

    props: Props = {
      parentRef: null,
    };
    state: State = {
      tooltipRoot: null,
    };

    componentDidMount(): void {
      this._showTooltip();
    }

    componentWillUnmount(): void {
      this._hideTooltip();
    }

    componentDidUpdate(prevProps: Props): void {
      const {parentRef: prevParentRef} = prevProps;
      const {parentRef} = this.props;

      // Re-render tooltip if the parent element changed.
      if (prevParentRef !== parentRef) {
        this._hideTooltip();
        this._showTooltip();
      }
    }

    render(): React.Node {
      // The structure of Atom tooltips looks like
      // <div class="tooltip">
      //   <div class="tooltip-arrow"/>
      //   <div class="tooltip-inner"/>
      // </div>
      //
      // Use createPortal() here to render the TooltipComponent into the
      // "tooltip-inner" div.
      const container = this._getContainer();
      return container == null
        ? null
        : ReactDOM.createPortal(
            <TooltipComponent
              tooltipRoot={this.state.tooltipRoot}
              showTooltip={this._showTooltip}
              hideTooltip={this._hideTooltip}
              {...this.props}
            />,
            container,
          );
    }

    _getContainer(): ?HTMLElement {
      return this.state.tooltipRoot == null
        ? null
        : Array.from(this.state.tooltipRoot.children).find(element =>
            element.className.includes('tooltip-inner'),
          );
    }

    _showTooltip = (): void => {
      if (this.props.parentRef == null || this._tooltipDisposable != null) {
        return;
      }

      this._tooltipDisposable = atom.tooltips.add(this.props.parentRef, {
        delay: 0,
        item: document.createElement('div'),
        placement: 'bottom',
        trigger: 'manual',
      });
      const tooltip =
        this.props.parentRef != null
          ? atom.tooltips.tooltips.get(this.props.parentRef)
          : null;
      if (tooltip != null && tooltip[0] != null) {
        const tooltipRoot = tooltip[0].getTooltipElement();
        this.setState({tooltipRoot});
      }
    };

    _hideTooltip = (): void => {
      if (this._tooltipDisposable != null) {
        nullthrows(this._tooltipDisposable).dispose();
      }
      this.setState({tooltipRoot: null});
      this._tooltipDisposable = null;
    };
  }

  return HigherOrderTooltip;
};

export default makeTooltip;
