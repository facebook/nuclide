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

import type {ArcToolbarModel} from '../ArcToolbarModel';

import ArcToolbarSection from '../ArcToolbarSection';
import React from 'react';

/**
 * Create a component for the extra UI in the toolbar. We use a component
 * (instead of an element) so that we can pass down props from the toolbar itself in the future
 * (e.g. dimensions), and create the component in a closure so that we can close over state
 * too.
 */
export function createExtraUiComponent(
  model: ArcToolbarModel,
): ReactClass<any> {
  return class ExtraUi extends React.Component {
    render(): React.Element<any> {
      return <ArcToolbarSection model={model} />;
    }
  };
}
