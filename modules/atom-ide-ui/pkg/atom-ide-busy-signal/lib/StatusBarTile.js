/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {Observable} from 'rxjs';

import invariant from 'assert';
import * as React from 'react';
import ReactDOM from 'react-dom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {arrayCompact} from 'nuclide-commons/collection';
import {Icon} from 'nuclide-commons-ui/Icon';
import {BusyMessageInstance} from './BusyMessageInstance';

// We want to be the furthest left on the right side of the status bar so as not to leave a
// conspicuous gap (or cause jitter) when nothing is busy.
const STATUS_BAR_PRIORITY = 1000;

type Props = {
  waitingForComputer: boolean,
  waitingForUser: boolean,
  onDidClick: ?() => void,
};

function StatusBarTileComponent(props: Props) {
  let element;
  if (props.waitingForUser) {
    element = <Icon className="busy-signal-status-bar" icon="unverified" />;
  } else if (props.waitingForComputer) {
    element = <div className="busy-signal-status-bar loading-spinner-tiny" />;
  } else {
    element = null;
  }

  if (props.onDidClick != null) {
    element = <a onClick={props.onDidClick}>{element}</a>;
  }

  return element;
}

export default class StatusBarTile {
  _item: HTMLElement;
  _tile: atom$StatusBarTile;
  _tooltip: ?IDisposable;
  _disposables: UniversalDisposable;
  _messages: Array<BusyMessageInstance> = [];
  _isMouseOverItem: boolean = false;
  _isMouseOverTooltip: number = 0;
  _leaveTimeoutId: ?TimeoutID;

  constructor(
    statusBar: atom$StatusBar,
    messageStream: Observable<Array<BusyMessageInstance>>,
  ) {
    this._item = document.createElement('div');
    this._tile = this._createTile(statusBar);
    this._disposables = new UniversalDisposable(
      messageStream.subscribe(messages => this._handleMessages(messages)),
    );
  }

  dispose(): void {
    ReactDOM.unmountComponentAtNode(this._item);
    this._tile.destroy();
    if (this._tooltip != null) {
      this._tooltip.dispose();
    }
    this._disposables.dispose();
  }

  _createTile(statusBar: atom$StatusBar): atom$StatusBarTile {
    const item = this._item;
    item.className = 'inline-block';
    item.addEventListener('mouseenter', () => {
      this._isMouseOverItem = true;
      this._stopLeaveTimeout();
      this._ensureTooltip();
    });
    item.addEventListener('mouseleave', () => {
      this._isMouseOverItem = false;
      this._startLeaveTimeoutIfNecessary();
    });
    const tile = statusBar.addRightTile({
      item,
      priority: STATUS_BAR_PRIORITY,
    });
    return tile;
  }

  _handleMessages(messages: Array<BusyMessageInstance>): void {
    this._messages = messages;

    const onDidClicks = arrayCompact(messages.map(m => m._onDidClick));

    const props: Props = {
      waitingForComputer: messages.some(m => m.waitingFor === 'computer'),
      waitingForUser: messages.some(m => m.waitingFor === 'user'),
      onDidClick:
        onDidClicks.length > 0
          ? () => onDidClicks.forEach(callback => callback())
          : null,
    };
    ReactDOM.render(<StatusBarTileComponent {...props} />, this._item);

    const revealTooltip = messages.some(message =>
      message.shouldRevealTooltip(),
    );
    if (this._tooltip != null) {
      // If the user already had the tooltip up, then we'll either
      // refresh it or hide it. No matter what, we'll have to unmount it.
      this._disposeTooltip();
      // There are two reasons to refresh the tooltip (bringing it back):
      // 1) the mouse was previously over the tile or the tooltip
      // 2) one of the messages is marked with 'reveal tooltip'
      if (
        messages.length > 0 &&
        (revealTooltip || this._isMouseOverItem || this._isMouseOverTooltip)
      ) {
        this._ensureTooltip();
      } else {
        this._isMouseOverItem = false;
      }
    } else if (revealTooltip) {
      this._ensureTooltip();
    }
  }

  _disposeTooltip(): void {
    if (this._tooltip != null) {
      this._tooltip.dispose();
      this._tooltip = null;
      this._isMouseOverTooltip = 0;
    }
  }

  _ensureTooltip(): void {
    if (this._tooltip != null) {
      return;
    }
    const body = document.createElement('div');
    for (const message of this._messages) {
      if (body.childElementCount > 0) {
        body.appendChild(document.createElement('br'));
      }
      const titleElement = message.getTitleElement();
      invariant(titleElement != null);
      body.appendChild(titleElement);
    }

    this._tooltip = atom.tooltips.add(this._item, {
      item: body,
      delay: 0,
      trigger: 'manual',
    });
    const tooltipAtomObjects = atom.tooltips.tooltips.get(this._item);
    if (tooltipAtomObjects != null) {
      for (const tooltipAtomObject of tooltipAtomObjects) {
        const div = tooltipAtomObject.getTooltipElement();
        div.addEventListener('mouseenter', () => {
          this._isMouseOverTooltip++;
          this._stopLeaveTimeout();
        });
        div.addEventListener('mouseleave', () => {
          this._isMouseOverTooltip--;
          this._startLeaveTimeoutIfNecessary();
        });
      }
    }
  }

  _startLeaveTimeoutIfNecessary(): void {
    if (
      !this._isMouseOverItem &&
      this._isMouseOverTooltip === 0 &&
      this._leaveTimeoutId == null
    ) {
      this._leaveTimeoutId = setTimeout(() => {
        this._disposeTooltip();
        // Currently visible messages should no longer reveal the tooltip again.
        this._messages.forEach(message => message.setRevealTooltip(false));
      }, 200);
    }
  }

  _stopLeaveTimeout(): void {
    if (this._leaveTimeoutId != null) {
      clearTimeout(this._leaveTimeoutId);
      this._leaveTimeoutId = null;
    }
  }
}
