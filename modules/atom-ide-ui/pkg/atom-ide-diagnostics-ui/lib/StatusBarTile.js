/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  ObservableDiagnosticUpdater,
  DiagnosticMessage,
} from '../../atom-ide-diagnostics/lib/types';

import addTooltip from 'nuclide-commons-ui/addTooltip';
import {Icon} from 'nuclide-commons-ui/Icon';
import classnames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import analytics from 'nuclide-commons-atom/analytics';

type DiagnosticCount = {
  errorCount: number,
  warningCount: number,
};

// Stick this to the left of remote-projects (-99)
const STATUS_BAR_PRIORITY = -99.5;

const RENDER_DEBOUNCE_TIME = 100;

export default class StatusBarTile {
  _diagnosticUpdaters: Map<ObservableDiagnosticUpdater, DiagnosticCount>;
  _totalDiagnosticCount: DiagnosticCount;
  _subscriptions: UniversalDisposable;
  _tile: ?atom$StatusBarTile;
  _item: ?HTMLElement;

  constructor() {
    this._diagnosticUpdaters = new Map();
    this._totalDiagnosticCount = {
      errorCount: 0,
      warningCount: 0,
    };
    this._subscriptions = new UniversalDisposable();
  }

  consumeDiagnosticUpdates(
    diagnosticUpdater: ObservableDiagnosticUpdater,
  ): void {
    if (this._diagnosticUpdaters.has(diagnosticUpdater)) {
      return;
    }

    const diagnosticCount = {
      errorCount: 0,
      warningCount: 0,
    };
    this._diagnosticUpdaters.set(diagnosticUpdater, diagnosticCount);
    this._subscriptions.add(
      diagnosticUpdater.allMessageUpdates
        .debounceTime(RENDER_DEBOUNCE_TIME)
        .subscribe(
          this._onAllMessagesDidUpdate.bind(this, diagnosticUpdater),
          null,
          this._onAllMessagesDidUpdate.bind(this, diagnosticUpdater, []),
        ),
    );
  }

  consumeStatusBar(statusBar: atom$StatusBar): void {
    if (this._item) {
      // Assuming our invariants hold, if this case fires, that means that there is more than one
      // status bar provider, which is weird. For now, we just ignore this case for simplicity.
      return;
    }

    const item = (this._item = document.createElement('div'));
    item.className = 'inline-block';
    this._render();
    this._tile = statusBar.addLeftTile({
      item,
      priority: STATUS_BAR_PRIORITY,
    });
  }

  _onAllMessagesDidUpdate(
    diagnosticUpdater: ObservableDiagnosticUpdater,
    messages: Array<DiagnosticMessage>,
  ): void {
    // Update the DiagnosticCount for the updater.
    let errorCount = 0;
    let warningCount = 0;
    for (const message of messages) {
      if (message.type === 'Error') {
        ++errorCount;
      } else if (message.type === 'Warning' || message.type === 'Info') {
        // TODO: should "Info" messages have their own category?
        ++warningCount;
      }
    }
    this._diagnosticUpdaters.set(diagnosticUpdater, {
      errorCount,
      warningCount,
    });

    // Recalculate the total diagnostic count.
    let totalErrorCount = 0;
    let totalWarningCount = 0;
    for (const diagnosticCount of this._diagnosticUpdaters.values()) {
      totalErrorCount += diagnosticCount.errorCount;
      totalWarningCount += diagnosticCount.warningCount;
    }
    this._totalDiagnosticCount = {
      errorCount: totalErrorCount,
      warningCount: totalWarningCount,
    };

    this._render();
  }

  _render(): void {
    if (this._item) {
      ReactDOM.render(
        <StatusBarTileComponent {...this._totalDiagnosticCount} />,
        this._item,
      );
    }
  }

  dispose() {
    this._subscriptions.dispose();
    if (this._item) {
      ReactDOM.unmountComponentAtNode(this._item);
      this._item = null;
    }

    if (this._tile) {
      this._tile.destroy();
      this._tile = null;
    }
  }
}

type Props = {
  errorCount: number,
  warningCount: number,
};

class StatusBarTileComponent extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
    (this: any)._onClick = this._onClick.bind(this);
  }

  render() {
    const errorCount = this.props.errorCount;
    const warningCount = this.props.warningCount;
    const hasErrors = errorCount > 0;
    const hasWarnings = warningCount > 0;
    const errorClassName = classnames(
      'nuclide-diagnostics-status-bar-highlight',
      {
        'text-error': hasErrors,
      },
    );
    const warningClassName = classnames(
      'nuclide-diagnostics-status-bar-highlight',
      {
        'text-warning': hasWarnings,
      },
    );
    const errorLabel = hasErrors ? errorCount : 'No';
    const errorSuffix = errorCount !== 1 ? 's' : '';
    const warningLabel = hasWarnings ? warningCount : 'No';
    const warningSuffix = warningCount !== 1 ? 's' : '';

    return (
      <span>
        <a
          className={errorClassName}
          onClick={this._onClick}
          ref={addTooltip({
            title: `${errorLabel} error${errorSuffix}`,
            placement: 'top',
          })}>
          <Icon icon="stop" />
          {errorCount}
        </a>
        <a
          className={warningClassName}
          onClick={this._onClick}
          ref={addTooltip({
            title: `${warningLabel} warning${warningSuffix}`,
            placement: 'top',
          })}>
          <Icon icon="alert" />
          {warningCount}
        </a>
      </span>
    );
  }

  _onClick(): void {
    const target = atom.views.getView(atom.workspace);
    atom.commands.dispatch(target, 'diagnostics:toggle-table');
    analytics.track('diagnostics-show-table-from-status-bar');
  }
}
