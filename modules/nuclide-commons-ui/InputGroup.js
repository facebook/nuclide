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
  /** The contents of the InputGroup; Generally, an instance of `Button` or an input. */
  children?: mixed,
  className?: string,
};

/**
 * Visually groups Buttons/inputs passed in as children.
 * Unlike <ButtonGroup> this currently **requires that all children have equal
 * height (corresponding `size` props)**
 */
export const InputGroup = (props: Props) => {
  const {children, className} = props;
  const newClassName = classnames(className, 'nuclide-input-group');
  return (
    // $FlowFixMe(>=0.53.0) Flow suppress
    <div className={newClassName}>{children}</div>
  );
};
