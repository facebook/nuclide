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

import React from 'react';

type Props = {
  children?: mixed,
};

export const ToolbarCenter = (props: Props) => {
  return (
    <div className="nuclide-ui-toolbar__center">
      {props.children}
    </div>
  );
};
