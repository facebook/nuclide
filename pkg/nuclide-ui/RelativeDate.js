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
import {relativeDate} from 'nuclide-commons/string';
import addTooltip from 'nuclide-commons-ui/addTooltip';

type DefaultProps = {
  delay: number,
  shorten: boolean,
  withToolip: boolean,
};
type Props = DefaultProps & {
  date: Date,
  delay?: number,
  shorten?: boolean,
  withToolip?: boolean,
};
const DEFAULT_RERENDER_DELAY = 10000; // ms

/**
 * Renders a relative date that forces a re-render every `delay` ms,
 * in order to properly update the UI.
 *
 * Does not respond to changes to the initial `delay` for simplicity's sake.
 */
export default class RelativeDate extends React.Component<Props> {
  _interval: ?number;

  static defaultProps: DefaultProps = {
    delay: DEFAULT_RERENDER_DELAY,
    shorten: false,
    withToolip: false,
  };

  componentDidMount(): void {
    const {delay} = this.props;
    this._interval = setInterval(() => this.forceUpdate(), delay);
  }

  componentWillUnmount(): void {
    if (this._interval != null) {
      clearInterval(this._interval);
    }
  }

  render(): React.Node {
    const {
      date,
      // eslint-disable-next-line no-unused-vars
      delay: _,
      shorten,
      withToolip,
      ...remainingProps
    } = this.props;
    return (
      <span
        {...remainingProps}
        ref={
          withToolip
            ? addTooltip({
                title: date.toLocaleString(),
                delay: 200,
                placement: 'top',
              })
            : null
        }>
        {relativeDate(date, undefined, shorten)}
      </span>
    );
  }
}
