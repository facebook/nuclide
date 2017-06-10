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

import type {Tunnel} from '../types';

import {Button} from 'nuclide-commons-ui/Button';
import React from 'react';

type Props = {
  tunnel: Tunnel,
  closeTunnel: (tunnel: Tunnel) => void,
};

export default function TunnelCloseButton(props: Props) {
  return (
    <Button
      className="nuclide-ssh-tunnel-close-button"
      size="SMALL"
      icon="x"
      onClick={() => props.closeTunnel(props.tunnel)}
    />
  );
}
