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

/* global HTMLElement */

import invariant from 'assert';
import React from 'react';
import ReactDOM from 'react-dom';

export type CustomPaneItemOptions = {
  title: string, // Title for the custom pane item being created.
  iconName?: string, // Optional string representing the octicon that is rendered next to the title.
  uri?: string,
  allowSplit?: boolean, // Whether splits are allowed on the pane item. Defaults to false.
  initialProps: Object, // The pane item specific properties.
};

export class CustomPaneItem extends HTMLElement {
  _title: ?string;
  _iconName: ?string;
  _uri: ?string;
  _allowSplit: boolean;
  __component: React.Component<any, any, any>;

  initialize(options: CustomPaneItemOptions) {
    this._title = options.title;
    this._iconName = options.iconName;
    this._uri = options.uri;
    this._allowSplit = Boolean(options.allowSplit);

    this.__component = ReactDOM.render(this.__renderPaneItem(options), this);
  }

  /**
   * Subclasses should override this method to render the pane using options passed from above.
   * This method is invoked as part of initialize(), and so, it should be safe to invoke any of the
   * getter methods on this class in this method.
   *
   * @return A React component that this element call ReactDOM.render() on.
   */
  __renderPaneItem(options: CustomPaneItemOptions): React.Element<any> {
    throw new Error('Subclass should implement this method.');
  }

  getTitle(): string {
    invariant(this._title);
    return this._title;
  }

  getIconName(): ?string {
    return this._iconName;
  }

  getURI(): ?string {
    return this._uri;
  }

  copy(): boolean {
    return this._allowSplit;
  }

  detachedCallback(): mixed {
    ReactDOM.unmountComponentAtNode(this);
  }
}
