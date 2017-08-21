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

import type {Store} from '../types';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import * as Actions from '../redux/Actions';
import {Observable} from 'rxjs';
import {TunnelsPanelTable} from './TunnelsPanelTable';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import React from 'react';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/ssh-tunnels';

export class TunnelsPanel {
  _store: Store;

  constructor(store: Store) {
    this._store = store;
  }

  getTitle() {
    return 'SSH tunnels';
  }

  getIconName() {
    return 'milestone';
  }

  getPreferredWidth(): number {
    return 300;
  }

  getDefaultLocation(): string {
    return 'right';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getElement(): HTMLElement {
    // $FlowFixMe: We need to teach Flow about Symbol.observable
    const states = Observable.from(this._store);

    const props = states.map(state => {
      return {
        tunnels: Array.from(state.openTunnels.entries()),
        closeTunnel: tunnel =>
          this._store.dispatch(Actions.closeTunnel(tunnel)),
      };
    });

    const BoundTable = bindObservableAsProps(props, TunnelsPanelTable);
    return renderReactRoot(<BoundTable />);
  }

  serialize(): {deserializer: string} {
    return {
      deserializer: 'nuclide.SshTunnelsPanel',
    };
  }
}
