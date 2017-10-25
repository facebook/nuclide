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

import React from 'react';
import classnames from 'classnames';
import nullthrows from 'nullthrows';

type Props = {
  className?: string,
};

export default class UnstyledButton extends React.Component<Props> {
  props: Props;
  _node: ?HTMLButtonElement;

  focus(): void {
    nullthrows(this._node).focus();
  }

  _setRef = (node: ?HTMLButtonElement) => (this._node = node);

  render(): React$Element<any> {
    const {className, ...props} = this.props;
    const classes = classnames('nuclide-ui-unstyled-button', className);
    // eslint-disable-next-line rulesdir/use-nuclide-ui-components
    return <button className={classes} ref={this._setRef} {...props} />;
  }
}
