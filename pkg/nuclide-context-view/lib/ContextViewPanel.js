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

import * as React from 'react';
import {Icon} from 'nuclide-commons-ui/Icon';

type Props = {
  locked: boolean,
  children?: React.Element<any>,
};

export const ContextViewPanel = (props: Props) => {
  return (
    <div className="nuclide-context-view-content padded">
      <p>
        {props.locked ? <Icon icon="lock" /> : null}
        Click on a symbol (variable, function, type, etc) in an open file to see
        more information about it below.
      </p>
      {props.children}
    </div>
  );
};
