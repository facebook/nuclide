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

import * as React from 'react';
import BreakpointStore from './BreakpointStore.js';
import {DebuggerStore} from './DebuggerStore';
import Bridge from './Bridge';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';

type Props = {
  // TODO Remove disable
  /* eslint-disable react/no-unused-prop-types */
  breakpointStore: BreakpointStore,
  store: DebuggerStore,
  bridge: Bridge,
  openDevTools: () => void,
  stopDebugging: () => void,
  /* eslint-enable react/no-unused-prop-types */
};

type State = {
  processSocket: ?string,
  debuggerStoreChangeListener?: IDisposable,
};

function getStateFromStore(store: DebuggerStore): State {
  return {
    processSocket: store.getProcessSocket(),
  };
}

export default class DebuggerControllerView extends React.Component<
  Props,
  State,
> {
  constructor(props: Props) {
    super(props);
    this.state = getStateFromStore(props.store);
  }

  componentWillMount() {
    this.setState({
      debuggerStoreChangeListener: this.props.store.onChange(
        this._updateStateFromStore,
      ),
    });
    this._updateStateFromStore();
  }

  componentWillUnmount() {
    const listener = this.state.debuggerStoreChangeListener;
    if (listener != null) {
      listener.dispose();
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    const listener = this.state.debuggerStoreChangeListener;
    if (listener != null) {
      listener.dispose();
    }
    this.setState({
      debuggerStoreChangeListener: nextProps.store.onChange(
        this._updateStateFromStore,
      ),
    });
    this._updateStateFromStore(nextProps.store);
  }

  render(): React.Node {
    if (this.props.store.getDebuggerMode() === 'starting') {
      return (
        <div className="nuclide-debugger-starting-message">
          <div>
            <span className="inline-block">Starting Debugger...</span>
            <LoadingSpinner className="inline-block" size="EXTRA_SMALL" />
          </div>
        </div>
      );
    }
    return null;
  }

  _updateStateFromStore = (store?: DebuggerStore) => {
    if (store != null) {
      this.setState(getStateFromStore(store));
    } else {
      this.setState(getStateFromStore(this.props.store));
    }
  };
}
