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
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';

type Props = {
  title: string,
  icon: string,
  description: string | React.Element<any>,
  command: ?(string | (() => void)),
};

export default class HomeFeatureComponent extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
    (this: any)._tryIt = this._tryIt.bind(this);
  }

  _tryIt(): void {
    const {command} = this.props;
    if (command == null) {
      return;
    }
    switch (typeof command) {
      case 'string':
        atom.commands.dispatch(atom.views.getView(atom.workspace), command);
        return;
      case 'function':
        command();
        return;
      default:
        throw new Error('Invalid command value');
    }
  }

  render(): React.Element<any> {
    const {title, command} = this.props;
    return (
      <details className="nuclide-home-card">
        <summary
          className={`nuclide-home-summary icon icon-${this.props.icon}`}>
          {title}
          {command
            ? <Button
                className="pull-right nuclide-home-tryit"
                size={ButtonSizes.SMALL}
                onClick={this._tryIt}>
                Try it
              </Button>
            : null}
        </summary>
        <div className="nuclide-home-detail">
          {this.props.description}
        </div>
      </details>
    );
  }
}
