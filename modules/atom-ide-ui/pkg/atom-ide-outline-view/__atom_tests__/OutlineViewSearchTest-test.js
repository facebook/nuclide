/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {updateSearchSet} from '../lib/OutlineView';
import type {OutlineTreeForUi} from '../lib/createOutlines';
import {Point} from 'atom';

const sampleOutlineView: Array<OutlineTreeForUi> = [
  {
    tokenizedText: [
      {kind: 'keyword', value: 'const'},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'logger'},
    ],
    startPosition: new Point(35, 0),
    endPosition: new Point(35, 49),
    highlighted: false,
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'const'},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'SEARCH_ENABLED_DEFAULT'},
    ],
    startPosition: new Point(36, 0),
    endPosition: new Point(36, 36),
    highlighted: false,
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'export'},
      {kind: 'whitespace', value: ' '},
      {kind: 'keyword', value: 'class'},
      {kind: 'whitespace', value: ' '},
      {kind: 'class-name', value: 'OutlineView'},
    ],
    startPosition: new Point(59, 0),
    endPosition: new Point(144, 1),
    highlighted: false,
    children: [
      {
        tokenizedText: [
          {kind: 'method', value: 'state'},
          {kind: 'plain', value: '='},
        ],
        startPosition: new Point(60, 2),
        endPosition: new Point(60, 15),
        highlighted: false,
        children: [],
      },
      {
        tokenizedText: [
          {kind: 'method', value: 'props'},
          {kind: 'plain', value: '='},
        ],
        startPosition: new Point(61, 2),
        endPosition: new Point(61, 15),
        highlighted: false,
        children: [],
      },
      {
        tokenizedText: [
          {kind: 'method', value: 'subscription'},
          {kind: 'plain', value: '='},
        ],
        startPosition: new Point(63, 2),
        endPosition: new Point(63, 36),
        highlighted: false,
        children: [],
      },
      {
        tokenizedText: [
          {kind: 'method', value: 'constructor'},
          {kind: 'plain', value: '('},
          {kind: 'param', value: 'props'},
          {kind: 'plain', value: ')'},
        ],
        startPosition: new Point(65, 2),
        endPosition: new Point(76, 3),
        highlighted: false,
        children: [],
      },
      {
        tokenizedText: [
          {kind: 'method', value: 'componentDidMount'},
          {kind: 'plain', value: '('},
          {kind: 'plain', value: ')'},
        ],
        startPosition: new Point(78, 2),
        endPosition: new Point(92, 3),
        highlighted: false,
        children: [],
      },
    ],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'class'},
      {kind: 'whitespace', value: ' '},
      {kind: 'class-name', value: 'OutlineViewComponent'},
    ],
    startPosition: new Point(121, 0),
    endPosition: new Point(194, 1),
    highlighted: false,
    children: [
      {
        tokenizedText: [
          {kind: 'method', value: 'props'},
          {kind: 'plain', value: '='},
        ],
        startPosition: new Point(122, 2),
        endPosition: new Point(122, 35),
        highlighted: false,
        children: [],
      },
      {
        tokenizedText: [
          {kind: 'method', value: 'state'},
          {kind: 'plain', value: '='},
        ],
        startPosition: new Point(123, 2),
        endPosition: new Point(125, 4),
        highlighted: false,
        children: [],
      },
    ],
  },
];

describe('OutlineViewSearchTest', () => {
  it('Map is filled for all elements', () => {
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('query', root, resultsMap, new Map(), ''),
    );

    /* Check that every Node is in the Map */
    const checkDefined = (root: OutlineTreeForUi) => {
      expect(resultsMap.get(root)).toBeDefined();
      root.children.forEach(subRoot => checkDefined(subRoot));
    };

    sampleOutlineView.forEach(root => {
      checkDefined(root);
    });
  });

  it('Prefix matching for results', () => {
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('logge', root, resultsMap, new Map(), ''),
    );

    /* Check that `const logger` element is correctly labeled in the Map. */
    const loggerElement = sampleOutlineView[0];
    const result = resultsMap.get(loggerElement);
    expect(result && result.matches).toBe(true);
    expect(!result || result.visible).toBe(true);
  });

  it('Fuzzy search for results', () => {
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('cdm', root, resultsMap, new Map(), ''),
    );

    /* "cdm" should match "componentDidMount" */
    const componentDidMountElement = sampleOutlineView[2].children[4];
    const result = resultsMap.get(componentDidMountElement);
    expect(result && result.matches).toBe(true);
    expect(!result || result.visible).toBe(true);
  });

  it('Parents are visible when child is visible', () => {
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('cdm', root, resultsMap, new Map(), ''),
    );

    const componentDidMountElementParent = sampleOutlineView[2];
    const result = resultsMap.get(componentDidMountElementParent);
    /* Text doesn't match, but notVisible should be false because child is visible. */
    expect(result && result.matches).toBe(false);
    expect(!result || result.visible).toBe(true);
  });

  it('Child does not need to be visible when parent is', () => {
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('OutlineView', root, resultsMap, new Map(), ''),
    );

    const outlineViewElement = sampleOutlineView[2];
    const result = resultsMap.get(outlineViewElement);
    // Parent
    expect(result && result.matches).toBe(true);
    expect(!result || result.visible).toBe(true);

    // Children
    outlineViewElement.children.forEach(child => {
      const childResult = resultsMap.get(child);
      expect(childResult && childResult.matches).toBe(false);
      expect(!childResult || childResult.visible).toBe(false);
    });
  });

  it('Keywords are included in the search', () => {
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('const', root, resultsMap, new Map(), ''),
    );

    // `const logger` should be visible
    const loggerElement = sampleOutlineView[0];
    const result = resultsMap.get(loggerElement);
    expect(result && result.matches).toBe(true);
    expect(!result || result.visible).toBe(true);
  });

  it('Previous query optimization maintains functionality', () => {
    /* Test 1 repeated */
    const resultsMap = new Map();
    sampleOutlineView.forEach(root =>
      updateSearchSet('logge', root, resultsMap, new Map(), ''),
    );
    let loggerElement = sampleOutlineView[0];
    let result = resultsMap.get(loggerElement);
    expect(result && result.matches).toBe(true);
    expect(!result || result.visible).toBe(true);

    /* Update the set when query changed to 'logger' */
    sampleOutlineView.forEach(root =>
      updateSearchSet('logge', root, resultsMap, resultsMap, 'logger'),
    );
    /* Results should stay the same */
    loggerElement = sampleOutlineView[0];
    result = resultsMap.get(loggerElement);
    expect(result && result.matches).toBe(true);
    expect(!result || result.visible).toBe(true);

    const nextElement = sampleOutlineView[1];
    result = resultsMap.get(nextElement);
    expect(result && result.matches).toBe(false);
    expect(!result || result.visible).toBe(false);
  });
});
