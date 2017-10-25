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
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';

export const WORKSPACE_VIEW_URI_A =
  'atom://nuclide/sample-workspace-views-example-a';

export class ExampleGadgetA {
  getTitle(): string {
    return 'Example Gadget A';
  }

  getIconName(): IconName {
    return 'squirrel';
  }

  getDefaultLocation(): string {
    return 'right';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI_A;
  }

  getElement(): HTMLElement {
    return renderReactRoot(<View />);
  }

  serialize(): Object {
    return {deserializer: 'ExampleGadgetA'};
  }
}

function View(): React.Element<any> {
  return (
    <div className="pane-item padded nuclide-example-gadget">
      This gadget was defined with a separate model and React component.
    </div>
  );
}
