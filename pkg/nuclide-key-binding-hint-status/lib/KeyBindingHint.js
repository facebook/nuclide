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
import {Icon} from 'nuclide-commons-ui/Icon';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import humanizeKeystroke from 'nuclide-commons/humanizeKeystroke';
import humanizeEventName from '../../commons-node/humanizeEventName';

/* global KeyboardEvent */

// Given a command name, return an array of human readable key bindings.
function keyBindingsFromCommand(commandName: string): Array<string> {
  const keyBindings = atom.keymaps.findKeyBindings({
    command: commandName,
    // Adding the target allows us to filter out keymaps for other OSs.
    target: window.document.activeElement,
  });
  const humanizedKeyBindings = keyBindings.map(binding => {
    return humanizeKeystroke(binding.keystrokes);
  });

  return humanizedKeyBindings;
}

type State = {
  event: ?Event,
};

export default class KeyBindingHint extends React.Component<any, State> {
  _areProcessingUserEvent: boolean;
  _disposables: UniversalDisposable;

  constructor(props: any) {
    super(props);
    this._areProcessingUserEvent = false;
    this.state = {event: null};

    this._disposables = new UniversalDisposable(
      atom.commands.onWillDispatch(this._handleWillDispatch),
    );
  }

  render(): React.Node {
    const {event} = this.state;
    if (event == null) {
      return <div />;
    }
    const keyBindings = keyBindingsFromCommand(event.type);

    if (!keyBindings.length) {
      // TODO: Consider indicating that this command lacks a binding.
      // TODO: Consider allowing the user to create a binding via a context menu.
      return <div />;
    }

    const firstBinding = keyBindings.length ? keyBindings[0] : '';
    const tooltip = addTooltip({
      title: humanizeEventName(event.type),
      keyBindingCommand: event.type,
      placement: 'top',
      keyBindingTarget: window.document.activeElement,
    });

    return (
      // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
      <div ref={tooltip}>
        <Icon icon="keyboard">
          <span style={{paddingLeft: '5px'}}>{firstBinding}</span>
        </Icon>
      </div>
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _handleWillDispatch = (event: Event) => {
    // We don't care about events dispatched by other events.
    if (!this._areProcessingUserEvent) {
      this._areProcessingUserEvent = true;
      // If they are already using the keyboard, they don't need our advice.
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      if (event.originalEvent instanceof KeyboardEvent) {
        this.setState({event: null});
      } else {
        this.setState({event});
      }
      // Nested events are handled within a single event loop. By handling only
      // the first event of a given loop, we approximate only responding to user
      // instigated events.
      setImmediate(this._userEventComplete);
    }
  };

  _userEventComplete = () => {
    this._areProcessingUserEvent = false;
  };
}
