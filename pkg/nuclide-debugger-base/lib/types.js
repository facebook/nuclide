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

import type {ControlButtonSpecification} from '../../nuclide-debugger/lib/types';

export type AtomNotificationType = 'info' | 'warning' | 'error' | 'fatalError';
export type AtomNotification = {
  type: AtomNotificationType,
  message: string,
};

export type DebuggerConfigAction = 'launch' | 'attach';

// Copied from nuclide-ui/Table.js because the RPC framework doesn't play well with type imports.
export type ThreadColumn = {
  title: string,
  key: string,
  // Percentage. The `width`s of all columns must add up to 1.
  width?: number,
  // Optional React component for rendering cell contents.
  // The component receives the cell value via `props.data`.
  component?: any,
  shouldRightAlign?: boolean,
};

// Indicates which of various optional features that this debugger supports.
export type DebuggerCapabilities = {
  +conditionalBreakpoints: boolean,
  +continueToLocation: boolean,
  +customSourcePaths: boolean,
  +singleThreadStepping: boolean,
  +readOnlyTarget: boolean,
  +threads: boolean,
};

// Describes how to configure various properties that individual debuggers
// are allowed to override.
export type DebuggerProperties = {
  +customControlButtons: Array<ControlButtonSpecification>,
  +targetDescription: () => ?string,
  +threadColumns: ?Array<ThreadColumn>,
  +threadsComponentTitle: string,
};
