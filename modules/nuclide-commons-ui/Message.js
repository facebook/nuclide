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

export type MessageType = 'default' | 'info' | 'success' | 'warning' | 'error';

type Props = {
  className?: string,
  children?: React.Node,
  type?: MessageType,
};

export const MessageTypes = Object.freeze({
  default: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
});

const MessageTypeClassNames = Object.freeze({
  default: 'nuclide-ui-message-default',
  error: 'nuclide-ui-message-error',
  info: 'nuclide-ui-message-info',
  success: 'nuclide-ui-message-success',
  warning: 'nuclide-ui-message-warning',
});

export const Message = (props: Props) => {
  const {className, children, type} = props;
  const resolvedType = type == null ? MessageTypes.default : type;
  const newClassName = classnames(
    className,
    'nuclide-ui-message',
    MessageTypeClassNames[resolvedType],
  );
  return <div className={newClassName}>{children}</div>;
};
