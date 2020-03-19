/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

/* eslint-disable no-undef */

// This is the type for the result of calling React.createRef where your ref
// is a component.
//
// Usage:
//
//  _nameInputRef: ReactComponentRef<ProtonTextInput> = React.createRef();
declare type ReactComponentRef<TInstance: React$Component<any, any>> = {
  current: null | TInstance,
};

// This is the type for the result of calling React.createRef where the ref is a
// plain DOM element, like `input`, or `div`
//
// Usage:
//
//   _inputRef: ReactHTMLElementRef<HTMLInputElement> = React.createRef();
declare type ReactHTMLElementRef<TElement: HTMLElement> = {
  current: null | TElement,
};
