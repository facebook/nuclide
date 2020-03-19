/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import {getComponentDefinitionFromAst} from '..';
import {parseCode, getComponentNameFromUri} from '../lib/uiComponentAst';
import {BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE} from '../__fixtures__/common';

describe('getComponentNameFromUri', () => {
  it('returns null', () => {
    expect(getComponentNameFromUri('')).toBeNull();
  });

  it('returns a component name', () => {
    expect(getComponentNameFromUri('/foo/bar/Component.react.js')).toBe(
      'Component',
    );
  });

  it('returns null for invalid path', () => {
    expect(getComponentNameFromUri('Component')).toBeNull();
    expect(getComponentNameFromUri('Component.react.example.js')).toBeNull();
    expect(getComponentNameFromUri('Component.js')).toBeNull();
  });
});

describe('getComponentDefinitionFromAst', () => {
  it('returns a valid component definition', () => {
    const ast = parseCode(BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE);
    invariant(ast);
    const definition = getComponentDefinitionFromAst(
      'foo/bar/FDSTest.react.js',
      ast,
    );
    invariant(definition);
    expect(definition.name).toBe('FDSTest');
    expect(definition.requiredProps.length).toBe(2);
    expect(definition.defaultProps.length).toBe(2);
    expect(definition.leadingComment).toBe(`@explorer-desc

Test!`);
  });
});
