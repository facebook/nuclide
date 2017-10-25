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

import type {NavigationStackService} from '../../nuclide-navigation-stack';

import * as React from 'react';
import {Observable} from 'rxjs';
import {Disposable} from 'atom';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

type Props = {
  enableBack: boolean,
  enableForward: boolean,
  onBack: () => mixed,
  onForward: () => mixed,
};

// Since this is a button which can change the current file, place it where
// it won't change position when the current file name changes, which means way left.
const STATUS_BAR_PRIORITY = -100;

export function consumeStatusBar(
  statusBar: atom$StatusBar,
  navigationStack: NavigationStackService,
): IDisposable {
  const onBack = navigationStack.navigateBackwards;
  const onForward = navigationStack.navigateForwards;
  const props: Observable<Props> = observableFromSubscribeFunction(
    navigationStack.subscribe,
  ).map(stack => ({
    enableBack: stack.hasPrevious,
    enableForward: stack.hasNext,
    onBack,
    onForward,
  }));
  const Tile = bindObservableAsProps(props, NavStackStatusBarTile);
  const item = renderReactRoot(<Tile />);
  item.className = 'nuclide-navigation-stack-tile inline-block';

  const statusBarTile = statusBar.addLeftTile({
    item,
    priority: STATUS_BAR_PRIORITY,
  });

  return new Disposable(() => {
    statusBarTile.destroy();
  });
}

class NavStackStatusBarTile extends React.Component<Props> {
  render(): React.Node {
    return (
      <ButtonGroup size="EXTRA_SMALL">
        <Button
          icon="chevron-left"
          onClick={this.props.onBack}
          disabled={!this.props.enableBack}
          tooltip={{
            title: 'Navigate Backwards',
            keyBindingCommand: 'nuclide-navigation-stack:navigate-backwards',
          }}
        />
        <Button
          icon="chevron-right"
          onClick={this.props.onForward}
          disabled={!this.props.enableForward}
          tooltip={{
            title: 'Navigate Forwards',
            keyBindingCommand: 'nuclide-navigation-stack:navigate-forwards',
          }}
        />
      </ButtonGroup>
    );
  }
}
