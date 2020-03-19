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

import type {IconName} from 'nuclide-commons-ui/Icon';
import type {Store, WelcomePagePaneProps} from '../types';

import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import {Provider} from 'react-redux';
import {updateWelcomePageVisibility} from '../redux/Actions';
import * as React from 'react';
import {WelcomePageContainer} from './WelcomePageComponent';

type Props = {
  paneProps?: WelcomePagePaneProps,
  store: Store,
  topic: string,
};

export const ALL_WELCOME_PAGE_TOPICS = 'all-welcome-pages';
export const WELCOME_PAGE_VIEW_URI_PREFIX = 'atom://nuclide/welcome-page/';

export function getURIForTopic(topic: string): string {
  return WELCOME_PAGE_VIEW_URI_PREFIX + topic;
}

export default class WelcomePageGadget extends React.Component<Props> {
  _visibilitySubscription: rxjs$ISubscription;

  getTitle(): string {
    return this.props.paneProps?.title ?? 'Welcome to Nuclide';
  }

  getIconName(): IconName {
    return 'nuclicon-nuclide';
  }

  componentDidMount(): void {
    this._visibilitySubscription = observePaneItemVisibility(this).subscribe(
      visible => {
        this.didChangeVisibility(visible);
      },
    );
  }

  componentWillUnmount(): void {
    // This ensures that if the pane is closed the visibility is updated
    this.props.store.dispatch(updateWelcomePageVisibility(false));
    this._visibilitySubscription.unsubscribe();
  }

  didChangeVisibility(visible: boolean) {
    if (!atom.workspace.getModalPanels().some(modal => modal.isVisible())) {
      // If we tab away from smartlog, activate the new item
      // so the user can interact immediately. But we should only do this
      // if no modal is visible, or else we'll focus behind the modal
      atom.workspace.getActivePane().activate();
    }

    this.props.store.dispatch(updateWelcomePageVisibility(visible));
  }

  render(): React.Node {
    const {paneProps, store, topic} = this.props;
    const visibleStore = {...store, subscribe: this._customSubscribe};
    return (
      /* $FlowFixMe(>=0.86.0) This
       * comment suppresses an error found when Flow v0.86 was
       * deployed. To see the error, delete this comment and
       * run Flow. */
      <Provider store={visibleStore}>
        <WelcomePageContainer className={paneProps?.className} topic={topic} />
      </Provider>
    );
  }

  // don't emit when welcome page is not visible to prevent needless re-calculations
  _customSubscribe = (listener: () => mixed): (() => void) => {
    const {store} = this.props;
    return (store: any).subscribe(() => {
      const {isWelcomePageVisible} = store.getState();
      if (!isWelcomePageVisible) {
        return;
      }
      listener();
    });
  };

  getDefaultLocation(): string {
    return 'center';
  }

  getURI(): string {
    return getURIForTopic(this.props.topic);
  }
}
