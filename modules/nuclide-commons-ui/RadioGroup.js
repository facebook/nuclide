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

import * as React from 'react';

// Globally unique ID used as the "name" attribute to group radio inputs.
let uid = 0;

type Props = {
  className?: string,
  optionLabels: Array<React.Node>,
  selectedIndex: number,
  onSelectedChange(selectedIndex: number): void,
};

type State = {
  uid: number,
};

/**
 * A managed radio group component. Accepts arbitrary React elements as labels.
 */
export default class RadioGroup extends React.Component<Props, State> {
  static defaultProps = {
    optionLabels: [],
    onSelectedChange: (selectedIndex: number) => {},
    selectedIndex: 0,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      uid: uid++,
    };
  }

  render(): React.Node {
    const {
      className,
      onSelectedChange,
      optionLabels,
      selectedIndex,
    } = this.props;
    const checkboxes = optionLabels.map((labelContent, i) => {
      const id = 'nuclide-radiogroup-' + uid + '-' + i;
      return (
        <div key={i} className="nuclide-ui-radiogroup-div">
          <input
            className="input-radio"
            type="radio"
            checked={i === selectedIndex}
            name={'radiogroup-' + this.state.uid}
            id={id}
            onChange={() => {
              onSelectedChange(i);
            }}
          />
          <label
            className="input-label nuclide-ui-radiogroup-label"
            htmlFor={id}>
            {labelContent}
          </label>
        </div>
      );
    });
    return <div className={className}>{checkboxes}</div>;
  }
}
