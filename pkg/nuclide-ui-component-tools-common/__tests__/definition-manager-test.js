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
import type {ComponentDefinition} from '../lib/types';
import {
  getSnippetFromDefinition,
  getDocumentationObject,
  getHoverFromComponentDefinition,
} from '../lib/definitionManager';

describe('getSnippetFromDefinition', () => {
  it('should render a snippet without props', () => {
    const definition: ComponentDefinition = {
      name: 'FDSTest',
      requiredProps: [],
      defaultProps: [],
      leadingComment: null,
    };
    expect(getSnippetFromDefinition(definition)).toBe('FDSTest $1/>');
  });

  it('should render basic required props', () => {
    const definition: ComponentDefinition = {
      name: 'FDSTest',
      requiredProps: [
        {
          name: 'value',
          typeAnnotation: 'number',
        },
      ],
      defaultProps: [],
      leadingComment: null,
    };
    expect(getSnippetFromDefinition(definition)).toBe(`FDSTest
  value={$1}
$2/>`);
  });

  it('should render a string annotated prop with nested tabstop', () => {
    const definition: ComponentDefinition = {
      name: 'FDSTest',
      requiredProps: [
        {
          name: 'value',
          typeAnnotation: 'number',
        },
        {
          name: 'label',
          typeAnnotation: 'string',
        },
      ],
      defaultProps: [],
      leadingComment: null,
    };
    expect(getSnippetFromDefinition(definition)).toBe(
      'FDSTest\n\
  value={$1}\n\
  label=${2:"$3"}\n\
$4/>',
    );
  });

  it('should render a tabstop in JSX tags for children prop', () => {
    const definition: ComponentDefinition = {
      name: 'FDSTest',
      requiredProps: [
        {
          name: 'value',
          typeAnnotation: 'number',
        },
        {
          name: 'children',
          typeAnnotation: 'React.Element',
        },
      ],
      defaultProps: [],
      leadingComment: null,
    };
    expect(getSnippetFromDefinition(definition)).toBe(
      'FDSTest\n\
  value={$1}\n\
>\n\
  $2\n\
</FDSTest>',
    );
  });

  it('should not render default props even if required', () => {
    const definition: ComponentDefinition = {
      name: 'FDSTest',
      requiredProps: [
        {
          name: 'value',
          typeAnnotation: 'number',
        },
        {
          name: 'label',
          typeAnnotation: 'string',
        },
      ],
      defaultProps: ['label'],
      leadingComment: null,
    };
    expect(getSnippetFromDefinition(definition)).toBe(`FDSTest
  value={$1}
$2/>`);
  });
});

describe('getDocumentationObject', () => {
  it('should return blank object if no leading comment', () => {
    expect(
      getDocumentationObject({
        name: 'FDS',
        requiredProps: [],
        defaultProps: [],
        leadingComment: null,
      }),
    ).toEqual({});
  });

  it('should return blank object if no @explorer-desc directive', () => {
    expect(
      getDocumentationObject({
        name: 'FDS',
        requiredProps: [],
        defaultProps: [],
        leadingComment: 'a'.repeat(240),
      }),
    ).toEqual({});
  });

  it('should return blank object if it includes @no-completion-description directive', () => {
    expect(
      getDocumentationObject({
        name: 'FDS',
        requiredProps: [],
        defaultProps: [],
        leadingComment: 'a'.repeat(240) + ' @no-completion-description',
      }),
    ).toEqual({});
  });

  it('should return documentation with simple string', () => {
    expect(
      getDocumentationObject({
        name: 'FDS',
        requiredProps: [],
        defaultProps: [],
        leadingComment:
          '@explorer-desc\n\nThis is an adequate description.\n\nDo not include me!',
      }),
    ).toEqual({documentation: 'This is an adequate description.'});
  });

  it('should return blank object if comment is too short', () => {
    expect(
      getDocumentationObject({
        name: 'FDS',
        requiredProps: [],
        defaultProps: [],
        leadingComment: '@explorer-desc\n\nhello',
      }),
    ).toEqual({});
  });

  it('should return truncated documentation with long', () => {
    expect(
      getDocumentationObject({
        name: 'FDS',
        requiredProps: [],
        defaultProps: [],
        leadingComment: '@explorer-desc\n\n' + 'a'.repeat(241),
      }),
    ).toEqual({documentation: 'a'.repeat(240) + '…'});
  });
});

describe('getHoverFromComponentDefinition', () => {
  it('should return a hover object', () => {
    const definition = {
      name: 'FDSTest',
      requiredProps: [],
      defaultProps: [],
      leadingComment: `  @explorer-desc
  ====== Foo
      // Example!
      // Some code!
  Bar`,
    };
    expect(getHoverFromComponentDefinition(definition).contents).toEqual({
      language: 'markdown',
      value: `### Foo
    // Example!
    // Some code!
Bar`,
    });
  });
});
