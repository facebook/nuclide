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

import classnames from 'classnames';
import React from 'react';
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
      [`nuclide-ui-toolbar--${maybeToString(props.location)}`]: props.location !=
        null,
    },
    props.className,
  );

  return (
    <div className={className}>
      {props.children}
    </div>
  );
};
