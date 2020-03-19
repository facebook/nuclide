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

import type {ButtonSize} from 'nuclide-commons-ui/Button';

import {Button} from 'nuclide-commons-ui/Button';
import * as React from 'react';

type Props = {
  selected?: boolean,
  size?: ButtonSize,
  children?: mixed,
  iconComponent: ?React.ComponentType<any>,
};

export function TaskRunnerButton(props: Props): React.Element<any> {
  const IconComponent = props.iconComponent;
  const icon = IconComponent ? <IconComponent /> : null;
  const buttonProps = {...props};
  delete buttonProps.iconComponent;
  return (
    <Button {...buttonProps} className="nuclide-task-runner-task-runner-button">
      <div className="nuclide-task-runner-task-runner-icon-wrapper">{icon}</div>
      {props.children}
    </Button>
  );
}
