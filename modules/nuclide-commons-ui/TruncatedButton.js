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

import {Button} from './Button';
import classnames from 'classnames';
import * as React from 'react';

type Props = {
  className?: string,
  // $FlowFixMe(>=0.53.0) Flow suppress
  children?: React.Children,
  label?: string,
};

export default class TruncatedButton extends React.Component<Props> {
  render(): React.Node {
    const {children, className, label, ...props} = this.props;
    return (
      <Button
        className={classnames(
          'btn-block',
          'nuclide-ui-truncated-button',
          className,
        )}
        title={label}
        {...props}>
        {children || label}
      </Button>
    );
  }
}
