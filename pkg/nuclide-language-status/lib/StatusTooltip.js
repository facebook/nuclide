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

import type {ServerStatus} from './StatusComponent';

import {track} from 'nuclide-commons/analytics';
import makeTooltip from './Tooltip';
import invariant from 'assert';
import marked from 'marked';
import nullthrows from 'nullthrows';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import * as React from 'react';

type Props = {
  editor: atom$TextEditor,
  status: ServerStatus,
  tooltipRoot: HTMLElement,
  hideTooltip: () => void,
};

class StatusTooltipComponent extends React.Component<Props> {
  render(): React.Node {
    this._styleTooltip();
    const {data, provider} = this.props.status;
    invariant(data.kind !== 'null');
    const message = data.message;
    return (
      <div className="nuclide-language-status-tooltip-content">
        {message == null ? null : (
          <div
            dangerouslySetInnerHTML={{
              __html: marked(message),
            }}
          />
        )}
        {message == null ? null : <hr />}

        <div
          dangerouslySetInnerHTML={{
            __html: marked(provider.description || ''),
          }}
        />
        {this._renderButtons()}
      </div>
    );
  }

  _styleTooltip(): void {
    const {tooltipRoot, status} = this.props;
    if (tooltipRoot != null) {
      tooltipRoot.classList.remove(
        'nuclide-language-status-tooltip-green',
        'nuclide-language-status-tooltip-yellow',
        'nuclide-language-status-tooltip-red',
      );
      tooltipRoot.classList.add(
        'nuclide-language-status-tooltip-' + status.data.kind,
      );
    }
  }

  _renderButtons = (): ?React.Node => {
    const {provider, data} = this.props.status;
    if (
      (data.kind !== 'red' && data.kind !== 'yellow') ||
      data.buttons.length === 0
    ) {
      return null;
    }
    const buttonType =
      data.kind === 'red' ? ButtonTypes.ERROR : ButtonTypes.WARNING;
    return (
      <ButtonGroup>
        {data.buttons.map(b => (
          <Button
            key={b}
            buttonType={buttonType}
            onClick={() => {
              track('nuclide-language-status:click', {
                provider: provider.name,
                button: b,
              });
              provider.clickStatus(
                nullthrows(this.props.editor),
                data.id || '',
                b,
              );
              this.props.hideTooltip();
            }}>
            {b}
          </Button>
        ))}
      </ButtonGroup>
    );
  };
}

const StatusTooltip = makeTooltip(StatusTooltipComponent);
export default StatusTooltip;
