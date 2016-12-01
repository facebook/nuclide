'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {ButtonSize} from '../../../nuclide-ui/Button';

import {Button} from '../../../nuclide-ui/Button';
import {React} from 'react-for-atom';

type Props = {
  selected?: boolean,
  size?: ButtonSize,
  children?: mixed,
  iconComponent: ReactClass<any>,
};

export function TaskRunnerButton(props: Props): React.Element<any> {
  const IconComponent = props.iconComponent;
  const buttonProps = {...props};
  delete buttonProps.label;
  delete buttonProps.iconComponent;
  return (
    <Button
      {...buttonProps}
      className="nuclide-task-runner-system-task-button">
      <div className="nuclide-task-runner-system-icon-wrapper">
        <IconComponent />
      </div>
      <div className="nuclide-task-runner-system-task-button-divider" />
      {props.children}
    </Button>
  );
}
