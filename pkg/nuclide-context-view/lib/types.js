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

// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';
import type {Definition} from 'atom-ide-ui';
import typeof ContextViewMessage from './ContextViewMessage';

export type ContextElementProps = {
  ContextViewMessage: ContextViewMessage,
  definition: ?Definition,
  // Context providers can use this function to prevent Context View from updating
  // the current definition.
  setLocked: (locked: boolean) => void,
};

export type ContextProvider = {
  /**
   * Context View uses element factories to render providers' React
   * components. This gives Context View the ability to set the props (which
   * contains the currentDefinition) of each provider. The factory should return
   * null if there is no element to be rendered.
   */
  getElementFactory: () => (props: ContextElementProps) => ?React.Element<any>,
  id: string, // Unique ID of the provider (suggested: use the package name of the provider)
  title: string, // Display name
};

export type NuclideContextView = {
  registerProvider: (provider: ContextProvider) => IDisposable,
};
