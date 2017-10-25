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

import type {IconName} from 'nuclide-commons-ui/Icon';

import * as React from 'react';

export const WORKSPACE_VIEW_URI_B =
  'atom://nuclide/sample-workspace-views-example-b';

export class ExampleGadgetB extends React.Component<{}> {
  getTitle(): string {
    return 'Example Gadget B';
  }

  getIconName(): IconName {
    return 'squirrel';
  }

  getDefaultLocation(): string {
    return 'right';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI_B;
  }

  render(): React.Node {
    return (
      <div className="pane-item padded nuclide-example-gadget">
        This gadget stores its state in the topmost React component.
      </div>
    );
  }

  serialize(): Object {
    return {deserializer: 'ExampleGadgetB'};
  }
}
