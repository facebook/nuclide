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

/* global HTMLElement */

import invariant from 'assert';
import * as React from 'react';
import ReactDOM from 'react-dom';

/**
 * A custom HTMLElement we render React elements into.
 */
class ReactMountRootElement extends HTMLElement {
  _reactElement: ?React.Element<any>;

  setReactElement(reactElement: React.Element<any>): void {
    this._reactElement = reactElement;
  }

  attachedCallback(): mixed {
    if (this._reactElement == null) {
      return;
    }
    ReactDOM.render(this._reactElement, this);
  }

  detachedCallback(): mixed {
    if (this._reactElement == null) {
      return;
    }
    ReactDOM.unmountComponentAtNode(this);
  }
}

let reactMountRootElement;
try {
  reactMountRootElement = document.registerElement('nuclide-react-mount-root', {
    prototype: ReactMountRootElement.prototype,
  });
} catch (e) {
  // Element was already registered. Retrieve its constructor:
  const oldElem = document.createElement('nuclide-react-mount-root');
  invariant(oldElem.constructor.name === 'nuclide-react-mount-root');
  reactMountRootElement = (oldElem.constructor: any);
}

export default (reactMountRootElement: Class<ReactMountRootElement>);
