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

import type {DiagnosticGroup} from '../types';

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import * as React from 'react';
import * as GroupUtils from '../GroupUtils';

type Props = {|
  group: DiagnosticGroup,
  selected: boolean,
  onClick: () => mixed,
|};

export default function FilterButton(props: Props): React.Node {
  const {selected, group} = props;
  const displayName = GroupUtils.getDisplayName(group);
  const title = props.selected ? `Hide ${displayName}` : `Show ${displayName}`;
  return (
    <Button
      icon={GroupUtils.getIcon(group)}
      size={ButtonSizes.SMALL}
      selected={selected}
      onClick={props.onClick}
      tooltip={{title}}
    />
  );
}
