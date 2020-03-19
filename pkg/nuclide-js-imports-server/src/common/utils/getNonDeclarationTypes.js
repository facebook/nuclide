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

import type {Collection, Node} from '../types/ast';

import jscs from './jscodeshift';

/**
 * This will get a list of all types that are not from a declaration.
 *
 * NOTE: this can get types that are declared, if you want access to
 * types that are used but undeclared see getUndeclaredTypes
 */
function getNonDeclarationTypes(root: Collection): Set<string> {
  const ids = new Set();

  // Pull out the logic to handle a generic type annotation, we have to iterate
  // down the qualified types to handle things like: `<Immutable.List<Foo>>`
  function handleGenericType(node: Node): void {
    if (jscs.Identifier.check(node.id)) {
      ids.add(node.id.name);
    }
    if (jscs.QualifiedTypeIdentifier.check(node.id)) {
      let currPos = node.id;
      while (currPos && !jscs.Identifier.check(currPos)) {
        currPos = currPos.qualification;
      }
      if (jscs.Identifier.check(currPos)) {
        ids.add(currPos.name);
      }
    }
  }

  // Ideally this would be the only find in here, but it's not because of a
  // jscodeshift bug, so we have to manually search for a specific kind of
  // GenericTypeAnnotations on class super types
  root
    .find(jscs.GenericTypeAnnotation)
    .forEach(path => handleGenericType(path.node));

  // TODO: Delete this after https://github.com/facebook/jscodeshift/issues/34
  root
    .find(jscs.ClassDeclaration)
    .filter(
      path =>
        path.node.superTypeParameters &&
        Array.isArray(path.node.superTypeParameters.params),
    )
    .forEach(path => {
      jscs(path.node.superTypeParameters)
        .find(jscs.GenericTypeAnnotation)
        .forEach(subPath => handleGenericType(subPath.node));
    });

  return ids;
}

export default getNonDeclarationTypes;
