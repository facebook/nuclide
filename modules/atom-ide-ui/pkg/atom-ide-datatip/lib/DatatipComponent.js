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

import type {Datatip} from './types';

import * as React from 'react';

import {maybeToString} from 'nuclide-commons/string';
import MarkedStringDatatip from './MarkedStringDatatip';

export const DATATIP_ACTIONS = Object.freeze({
  PIN: 'PIN',
  CLOSE: 'CLOSE',
});

const IconsForAction = {
  [DATATIP_ACTIONS.PIN]: 'pin',
  [DATATIP_ACTIONS.CLOSE]: 'x',
};

type DatatipComponentProps = {
  action: string,
  actionTitle: string,
  className?: string,
  datatip: Datatip,
  onActionClick: Function,
};

export class DatatipComponent extends React.Component<DatatipComponentProps> {
  handleActionClick = (event: SyntheticEvent<>) => {
    this.props.onActionClick();
  };

  render(): React.Node {
    const {
      className,
      action,
      actionTitle,
      datatip,
      onActionClick,
      ...props
    } = this.props;

    let content;
    if (datatip.component != null) {
      content = <datatip.component />;
    } else if (datatip.markedStrings != null) {
      content = <MarkedStringDatatip markedStrings={datatip.markedStrings} />;
    }

    let actionButton = null;
    if (action != null && IconsForAction[action] != null) {
      const actionIcon = IconsForAction[action];
      actionButton = (
        <div
          className={`datatip-pin-button icon-${actionIcon}`}
          onClick={this.handleActionClick}
          title={actionTitle}
        />
      );
    }

    return (
      <div
        className={`${maybeToString(className)} datatip-container`}
        {...props}>
        <div className="datatip-content">{content}</div>
        {actionButton}
      </div>
    );
  }
}
