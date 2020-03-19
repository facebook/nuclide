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
import {
  getRequiredProps,
  parseCode,
  getDefaultPropNames,
  formatLeadingComment,
} from '../lib/uiComponentAst';
import {BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE} from '../__fixtures__/common';

describe('ui-component-ast', () => {
  it('parses a React component module', () => {
    const ast = parseCode(BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE);
    expect(ast).toBeTruthy();
  });

  it('retrieves required props from a React component', () => {
    const requiredProps = getRequiredProps(
      'FDSTest',
      BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE,
    );
    expect(requiredProps).toEqual([
      {
        name: 'value',
        typeAnnotation: 'NumberTypeAnnotation',
        leadingComment: 'Test value.',
      },
      {
        name: 'type',
        typeAnnotation: 'FDSType',
        leadingComment: 'A test required enum.',
      },
    ]);
  });

  it('retrieves required props with $Exact longhand', () => {
    const requiredProps = getRequiredProps(
      'FDSTest',
      `
export type Props = $Exact<{
  value: number,
  type: string,
}>

class FDSTest extends React.PureComponent<Props> {}
    `,
    );
    expect(requiredProps).toEqual([
      {
        name: 'value',
        typeAnnotation: 'NumberTypeAnnotation',
      },
      {
        name: 'type',
        typeAnnotation: 'StringTypeAnnotation',
      },
    ]);
  });

  it('gets default prop names', () => {
    const defaultProps = getDefaultPropNames(
      'FDSTest',
      parseCode(BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE),
    );
    expect(defaultProps).toEqual(['type', 'optionalValue']);
  });

  it('gets default prop names with declaration indirection', () => {
    const defaultProps = getDefaultPropNames(
      'FDSTest',
      parseCode(`
const Props = {
  value: number,
  type: string,
}

const DEFAULT_PROPS = {
  value: 0,
  type: 'foo',
};

class FDSTest extends React.PureComponent<Props> {
  static defaultProps = DEFAULT_PROPS;
}
    `),
    );

    expect(defaultProps).toEqual(['value', 'type']);
  });

  it('parses a component with a blank object', () => {
    const code = `
type Props = {};
type DefaultProps = {};

class FDSTest extends React.PureComponent<Props> {
  static defaultProps: DefaultProps;
}`;

    expect(getDefaultPropNames('FDSTest', parseCode(code))).toEqual([]);
    expect(getRequiredProps('FDSTest', code)).toEqual([]);
  });
});

describe('formatLeadingComment', () => {
  it('returns identity', () => {
    expect(formatLeadingComment('Hello')).toBe('Hello');
  });

  it('strips asterisks', () => {
    expect(formatLeadingComment(' * Hello!')).toBe('Hello!');
  });

  it('removes trailing blank lines', () => {
    expect(
      formatLeadingComment(`
 * Hello!
 *
    `),
    ).toBe('Hello!');
  });

  it('strips trailing whitespace', () => {
    expect(formatLeadingComment(' * Hello!  ')).toBe('Hello!');
  });

  it('maintains vertical whitespace in the middle', () => {
    expect(
      formatLeadingComment(` * Hello!
 *
 * It is me!
 *
 * Wow!
 `),
    ).toBe(`Hello!

It is me!

Wow!`);
  });

  it('joins consecutive lines', () => {
    expect(
      formatLeadingComment(` * Hello!
  * It is me!`),
    ).toBe('Hello! It is me!');
  });
});
