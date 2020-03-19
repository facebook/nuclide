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

/**
 * This is the set of types that are "built-in" and never need to be imported.
 *
 * NOTE: This is in addition to the standard set of "built-in" modules. This
 * should only be for declared types that are not actual modules.
 */
export default (new Set([
  // Flow built-in utility types
  '$Abstract',
  '$All',
  '$Diff',
  '$Either',
  '$Enum',
  '$Exact',
  '$Exports',
  '$Flow',
  '$Keys',
  '$NonMaybeType',
  '$ObjMap',
  '$ObjMapi',
  '$Pred',
  '$PropertyType',
  '$ReadOnlyArray',
  '$Refine',
  '$Shape',
  '$Subtype',
  '$Supertype',
  '$Tainted',
  '$TupleMap',
  '$Type',
  'Class',
  // Flow built-in React types from lib/react.js
  'ReactClass',
  'SyntheticEvent',
  'SyntheticClipboardEvent',
  'SyntheticCompositionEvent',
  'SyntheticInputEvent',
  'SyntheticUIEvent',
  'SyntheticFocusEvent',
  'SyntheticKeyboardEvent',
  'SyntheticMouseEvent',
  'SyntheticDragEvent',
  'SyntheticWheelEvent',
  'SyntheticTouchEvent',
  // Other FB/browser builtins
  '$jsx',
  'AdAccountID',
  'FBID',
  'Fbt',
  'Function',
  'HTMLElement',
  'Iterable',
  'Map',
  'ReactElement',
  'ReactNode',
  'Set',
]): Set<string>);
