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

type Props = {
  children?: mixed,
};

export const ToolbarRight = (props: Props) => {
  return (
    <div className="nuclide-ui-toolbar__right">
      {props.children}
    </div>
  );
};
