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

import classnames from 'classnames';
import * as React from 'react';
import {maybeToString} from 'nuclide-commons/string';

type Props = {
  children?: mixed,
  className?: string,
  location?: 'top' | 'bottom',
};

export const Toolbar = (props: Props) => {
  const className = classnames(
    'nuclide-ui-toolbar',
    {
      [`nuclide-ui-toolbar--${maybeToString(props.location)}`]:
        props.location != null,
    },
    props.className,
  );

  return (
    // $FlowFixMe(>=0.53.0) Flow suppress
    <div className={className}>{props.children}</div>
  );
};
