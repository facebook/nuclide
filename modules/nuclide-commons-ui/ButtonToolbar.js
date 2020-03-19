/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import classnames from 'classnames';
import * as React from 'react';

type Props = {
  className?: string,
  children?: mixed,
};

/**
 * Visually groups Buttons passed in as children.
 */
export const ButtonToolbar = (props: Props) => {
  const {children, className} = props;
  return (
    // $FlowFixMe(>=0.53.0) Flow suppress
    <div className={classnames('btn-toolbar', className)}>{children}</div>
  );
};
