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
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import shallowEqual from 'shallowequal';
import * as analytics from 'nuclide-analytics';

type Props =
  | {
      available: true,
      enableBack: boolean,
      enableForward: boolean,
      onBack: () => mixed,
      onForward: () => mixed,
    }
  | {
      available: false,
    };

// Since this is a button which can change the current file, place it where
// it won't change position when the current file name changes, which means way left.
const STATUS_BAR_PRIORITY = -100;

export function consumeStatusBar(
  statusBar: atom$StatusBar,
  navigationStackServices: Observable<?NavigationStackService>,
): IDisposable {
  const props: Observable<Props> = navigationStackServices
    .switchMap(navigationStack => {
      if (navigationStack == null) {
        return Observable.of({
          available: false,
        });
      }
      const onBack = () => {
        analytics.track('status-bar-nav-stack-clicked-back');
        navigationStack.navigateBackwards();
      };
      const onForward = () => {
        analytics.track('status-bar-nav-stack-clicked-forward');
        navigationStack.navigateForwards();
      };
      return observableFromSubscribeFunction(navigationStack.subscribe).map(
        stack => ({
          available: true,
          enableBack: stack.hasPrevious,
          enableForward: stack.hasNext,
          onBack,
          onForward,
        }),
      );
    })
    .distinctUntilChanged(shallowEqual);
  const Tile = bindObservableAsProps(props, NavStackStatusBarTile);
  const item = renderReactRoot(<Tile />);
  item.className = 'nuclide-navigation-stack-tile inline-block';

  const statusBarTile = statusBar.addLeftTile({
    item,
    priority: STATUS_BAR_PRIORITY,
  });

  return new UniversalDisposable(() => {
    statusBarTile.destroy();
  });
}

class NavStackStatusBarTile extends React.Component<Props> {
  render(): React.Node {
    if (!this.props.available) {
      return null;
    }
    return (
      <ButtonGroup size="EXTRA_SMALL">
        <Button
          icon="chevron-left"
          onClick={this.props.onBack}
          disabled={!this.props.enableBack}
          tooltip={{
            title: 'Go Back',
            keyBindingCommand: 'nuclide-navigation-stack:navigate-backwards',
          }}
          className="nuclide-navigation-stack-button"
        />
        <Button
          icon="chevron-right"
          onClick={this.props.onForward}
          disabled={!this.props.enableForward}
          tooltip={{
            title: 'Go Forward',
            keyBindingCommand: 'nuclide-navigation-stack:navigate-forwards',
          }}
          className="nuclide-navigation-stack-button"
        />
      </ButtonGroup>
    );
  }
}
