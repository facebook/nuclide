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

import type {IconName} from 'nuclide-commons-ui/Icon';
import type {
  OutlineTree,
  OutlineTreeKind,
} from 'atom-ide-ui/pkg/atom-ide-outline-view/lib/types';

const OUTLINE_KIND_TO_ICON: {[OutlineTreeKind]: IconName} = {
  array: 'type-array',
  boolean: 'type-boolean',
  class: 'type-class',
  constant: 'type-constant',
  constructor: 'type-constructor',
  enum: 'type-enum',
  field: 'type-field',
  file: 'type-file',
  function: 'type-function',
  interface: 'type-interface',
  method: 'type-method',
  module: 'type-module',
  namespace: 'type-namespace',
  number: 'type-number',
  package: 'type-package',
  property: 'type-property',
  string: 'type-string',
  variable: 'type-variable',
};

export function iconForOutlineKind(kind: OutlineTreeKind): IconName {
  return OUTLINE_KIND_TO_ICON[kind];
}

export function iconForOutlineTree(outlineTree: OutlineTree): IconName {
  const {kind} = outlineTree;
  // $FlowFixMe these come from the RPC and are untyped.
  const icon: ?IconName = outlineTree.icon;
  const iconName = icon != null ? icon : kind && iconForOutlineKind(kind);
  if (iconName == null) {
    return 'code';
  }
  return iconName;
}
