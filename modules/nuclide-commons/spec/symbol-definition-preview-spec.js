/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import nuclideUri from '../nuclideUri';
import dedent from 'dedent';
import {Point} from 'simple-text-buffer';
import {getDefinitionPreview} from '../symbol-definition-preview';
import invariant from 'assert';

function javascriptFixtureDefinitionWithPoint(point: Point) {
  return {
    path: nuclideUri.join(
      __dirname,
      'fixtures',
      'symbol-definition-preview-sample.js',
    ),
    language: 'javascript',
    position: point,
  };
}

function pythonFixtureDefinitionWithPoint(point: Point) {
  return {
    path: nuclideUri.join(
      __dirname,
      'fixtures',
      'symbol-definition-preview-sample.py',
    ),
    language: 'python',
    position: point,
  };
}

describe('getDefinitionPreview', () => {
  describe('Constant symbols', () => {
    it('returns the only line of a one-line symbol', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(11, 6)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual('const A_CONSTANT = 42;');
      });
    });

    it('returns the entire multi-line symbol', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(15, 6)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          dedent`const A_MULTILINE_CONST = \`
            hey look I span
              multiple
                lines
          \`;`,
        );
      });
    });
  });

  describe('Type symbols', () => {
    it('returns an entire multi-line type', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(21, 5)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          dedent`type Something = {
            name: string,
            age?: number,
          };`,
        );
      });
    });

    it('returns only the property from within a type', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(44, 4)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual('name: string,');
      });
    });

    it('returns property and value of a complex type within a type', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(43, 2)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          dedent`properties: {
            name: string,
            age?: number,
          },`,
        );
      });
    });
  });

  describe('Function symbols', () => {
    it('returns just one line if parens are balanced on the first line', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(26, 16)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          'export function aSingleLineFunctionSignature() {',
        );
      });
    });

    it('works without parentheses as with python', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          pythonFixtureDefinitionWithPoint(new Point(7, 4)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual('def foo(bar=27):');
      });
    });

    it('works without parentheses but with braces as with python', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          pythonFixtureDefinitionWithPoint(new Point(11, 4)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          dedent`def baz(test={
            'one': 'two'
          }):`,
        );
      });
    });

    it('doesn\'t dedent beyond the current lines indentation level', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(36, 18)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          dedent`
              export function aPoorlyIndentedFunction(
            aReallyReallyLongArgumentNameThatWouldRequireThisToBreakAcrossMultipleLines: Something,
            ): number {
          `,
        );
      });
    });

    it('reads until the indentation returns to initial and parens are balanced', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          javascriptFixtureDefinitionWithPoint(new Point(30, 16)),
        );

        expect(preview).not.toBeNull();
        invariant(preview != null);
        expect(preview.contents).toEqual(
          dedent`
            export function aMultiLineFunctionSignature(
              aReallyReallyLongArgumentNameThatWouldRequireThisToBreakAcrossMultipleLines: Something,
            ): number {
          `,
        );
      });
    });
  });
});
