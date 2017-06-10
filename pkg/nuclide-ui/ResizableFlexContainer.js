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

import {arrayCompact, arrayEqual} from 'nuclide-commons/collection';
import classnames from 'classnames';
import createPaneContainer from '../commons-atom/create-pane-container';
import React from 'react';
import ReactDOM from 'react-dom';

type Props = {
  children?: ?React.Element<any>,
  className?: string,
  direction: FlexDirection,
};

export type FlexDirection = 'HORIZONTAL' | 'VERTICAL';

export const FlexDirections = Object.freeze({
  HORIZONTAL: 'HORIZONTAL',
  VERTICAL: 'VERTICAL',
});

function getChildrenFlexScales(children: ?React.Element<any>): Array<number> {
  return arrayCompact(
    React.Children.map(children, child => {
      if (child == null) {
        return null;
      } else if (!(child.type === ResizableFlexItem)) {
        throw new Error(
          'ResizableFlexContainer may only have ResizableFlexItem children!',
        );
      } else {
        return child.props.initialFlexScale;
      }
    }) || [],
  );
}

export class ResizableFlexContainer extends React.Component {
  _paneContainer: Object;
  _panes: Array<atom$Pane>;
  props: Props;

  componentDidMount(): void {
    this._setupPanes(this.props);
    this._renderPanes();
  }

  componentWillReceiveProps(newProps: Props): void {
    if (
      !arrayEqual(
        getChildrenFlexScales(this.props.children),
        getChildrenFlexScales(newProps.children),
      )
    ) {
      this._destroyPanes();
      this._setupPanes(newProps);
    }
  }

  componentDidUpdate(prevProps: Props): void {
    this._renderPanes();
  }

  _setupPanes(props: Props): void {
    const flexScales = getChildrenFlexScales(props.children);
    const {direction} = props;
    this._paneContainer = createPaneContainer();
    const containerNode = ReactDOM.findDOMNode(this.refs.flexContainer);
    // $FlowFixMe
    containerNode.innerHTML = '';
    // $FlowFixMe
    containerNode.appendChild(atom.views.getView(this._paneContainer));
    const startingPane: atom$Pane = this._paneContainer.getActivePane();
    let lastPane = startingPane;
    this._panes = [startingPane];
    for (let i = 1; i < flexScales.length; i++) {
      const flexScale = flexScales[i];
      if (direction === FlexDirections.HORIZONTAL) {
        lastPane = lastPane.splitRight({flexScale});
      } else {
        /* direction === SplitDirections.VERTICAL */ lastPane = lastPane.splitDown(
          {flexScale},
        );
      }
      this._panes.push(lastPane);
    }
    startingPane.setFlexScale(flexScales[0]);
  }

  _renderPanes(): void {
    const {children} = this.props;
    let i = 0;
    React.Children.forEach(children, (child: ?React.Element<any>) => {
      if (child == null) {
        return;
      }
      ReactDOM.render(child, this._getPaneElement(this._panes[i++]));
    });
  }

  componentWillUnmount(): void {
    this._destroyPanes();
  }

  _destroyPanes(): void {
    this._panes.forEach(pane => {
      ReactDOM.unmountComponentAtNode(
        ReactDOM.findDOMNode(this._getPaneElement(pane)),
      );
      pane.destroy();
    });
    this._panes = [];
  }

  _getPaneElement(pane: atom$Pane): HTMLElement {
    // $FlowFixMe querySelector returns ?HTMLElement
    return atom.views.getView(pane).querySelector('.item-views');
  }

  render(): React.Element<any> {
    const {className} = this.props;
    const containerClassName = classnames(
      'nuclide-ui-resizable-flex-container',
      className,
    );
    return <div className={containerClassName} ref="flexContainer" />;
  }
}

type ResizableFlexItemProps = {
  initialFlexScale: number,
  children?: ?React.Element<any>,
};

export class ResizableFlexItem extends React.Component {
  props: ResizableFlexItemProps;

  render(): React.Element<any> {
    return (
      <div className="nuclide-ui-resizable-flex-item">
        {this.props.children}
      </div>
    );
  }
}
