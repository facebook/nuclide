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

import invariant from 'assert';

import {convertTypedRegionsToCoverageResult} from '../lib/TypedRegions';

function runTest(regions, expectedPercentage, ...expected) {
  const result = convertTypedRegionsToCoverageResult(regions);
  invariant(result != null);
  // Use floor since that's what will happen when it's displayed
  expect(Math.floor(result.percentage)).toEqual(expectedPercentage);
  expect(result.uncoveredRegions).toEqual(expected);
}

function toError(expected) {
  return {
    ...expected,
    type: 'unchecked',
  };
}

function toWarning(expected) {
  return {
    ...expected,
    type: 'partial',
  };
}

function runTestError(regions, expectedPercentage, ...expected) {
  runTest(regions, expectedPercentage, ...expected.map(toError));
}

function runTestWarning(regions, expectedPercentage, ...expected) {
  runTest(regions, expectedPercentage, ...expected.map(toWarning));
}

describe('convertTypedRegionsToCoverageRegions', () => {
  it('empty array', () => {
    runTest([], 100);
  });

  it('empty string', () => {
    runTest(
      [
        {
          color: 'unchecked',
          text: '',
        },
      ],
      100,
    );
  });

  it('simple error', () => {
    runTestError(
      [
        {
          color: 'unchecked',
          text: 'blah',
        },
      ],
      0,
      {
        line: 1,
        start: 1,
        end: 4,
      },
    );
  });

  it('simple warning', () => {
    runTestWarning(
      [
        {
          color: 'partial',
          text: 'blah',
        },
      ],
      50,
      {
        line: 1,
        start: 1,
        end: 4,
      },
    );
  });

  it('simple message w/ offset', () => {
    runTestError(
      [
        {
          color: 'checked',
          text: 'blahs',
        },
        {
          color: 'unchecked',
          text: 'blah',
        },
      ],
      50,
      {
        line: 1,
        start: 6,
        end: 9,
      },
    );
  });

  it('simple message w/ multi-line offset', () => {
    runTestError(
      [
        {
          color: 'checked',
          text: '1stline\nsecond-line\n\nstartofthird',
        },
        {
          color: 'unchecked',
          text: 'blah',
        },
      ],
      75,
      {
        line: 4,
        start: 13,
        end: 16,
      },
    );
  });

  it('simple message w/ multi-line offset endling in newline', () => {
    runTestError(
      [
        {
          color: 'checked',
          text: '1stline\nsecond-line\n',
        },
        {
          color: 'unchecked',
          text: 'blah',
        },
      ],
      66,
      {
        line: 3,
        start: 1,
        end: 4,
      },
    );
  });

  it('multi-line error', () => {
    runTestError(
      [
        {
          color: 'unchecked',
          text: 'blah\nmoarerrors',
        },
      ],
      0,
      {
        line: 1,
        start: 1,
        end: 4,
      },
      {
        line: 2,
        start: 1,
        end: 10,
      },
    );
  });

  it('blank-lines error', () => {
    runTestError(
      [
        {
          color: 'unchecked',
          text: 'blah\n\nmoarerrors\n',
        },
      ],
      0,
      {
        line: 1,
        start: 1,
        end: 4,
      },
      {
        line: 3,
        start: 1,
        end: 10,
      },
    );
  });

  it('contiguous errors are merged', () => {
    runTestError(
      [
        {
          color: 'unchecked',
          text: 'blah',
        },
        {
          color: 'unchecked',
          text: 'blech',
        },
      ],
      0,
      {
        line: 1,
        start: 1,
        end: 9,
      },
    );
  });

  it('should not count default regions in the percentage', () => {
    runTestError(
      [
        {
          color: 'unchecked',
          text: 'foo',
        },
        {
          color: 'default',
          text: 'bar',
        },
        {
          color: 'checked',
          text: 'baz',
        },
      ],
      50,
      {
        line: 1,
        start: 1,
        end: 3,
      },
    );
  });
});
