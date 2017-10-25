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
import ReactDOM from 'react-dom';
import ReactMountRootElement from 'nuclide-commons-ui/ReactMountRootElement';

/**
 * Create an object that can be used as an Atom model from a React element. Example:
 *
 *     class UsageStats extends React.Component {
 *
 *       // Methods that Atom looks for on models (like `getTitle()`, `getIconName()`, etc.) can be
 *       // added to the component.
 *       getTitle(): string {
 *         return 'Usage Stats';
 *       }
 *
 *       render(): React.Element {
 *         return <div>Stats</div>;
 *       }
 *
 *     }
 *
 *    const item = viewableFromReactElement(<UsageStats />);
 *    atom.workspace.getPanes()[0].addItem(item); // Or anywhere else Atom uses model "items."
 */
export function viewableFromReactElement(
  reactElement: React.Element<any>,
): Object {
  const container = new ReactMountRootElement();
  const item = ReactDOM.render(reactElement, container);

  // Add the a reference to the container to the item. This will allow Atom's view registry to
  // associate the item with the HTML element.
  if (item.element != null) {
    throw new Error(
      "Component cannot have an `element` property. That's added by viewableFromReactElement",
    );
  }
  (item: any).element = container;

  // Add a destroy method to the item that will unmount the component. There's no need for users to
  // implement this themselves because they have `componentWillUnmount()`.
  if (item.destroy != null) {
    throw new Error(
      "Component cannot implement `destroy()`. That's added by `viewableFromReactElement`",
    );
  }
  (item: any).destroy = () => {
    ReactDOM.unmountComponentAtNode(container);
  };

  return item;
}
