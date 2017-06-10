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

import nuclideUri from 'nuclide-commons/nuclideUri';
import dedent from 'dedent';
import {Point} from 'simple-text-buffer';
import {getDefinitionPreview} from '../lib/DefinitionPreviewService';

function fixtureDefinitionWithPoint(point: Point) {
  return {
    path: nuclideUri.join(__dirname, 'fixtures', 'fixture.js'),
    language: 'javascript',
    position: point,
  };
}

describe('DefinitionPreviewService', () => {
  describe('Constant symbols', () => {
    it('returns the only line of a one-line symbol', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          fixtureDefinitionWithPoint(new Point(11, 6)),
        );

        expect(preview).toEqual('const A_CONSTANT = 42;');
      });
    });

    it('returns the first line of a multi-line symbol (for now)', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          fixtureDefinitionWithPoint(new Point(15, 6)),
        );

        expect(preview).toEqual('const A_MULTILINE_CONST = `');
      });
    });
  });

  describe('Type symbols', () => {
    it('returns the first line of a multi-line type (for now)', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          fixtureDefinitionWithPoint(new Point(21, 5)),
        );

        expect(preview).toEqual('type Something = {');
      });
    });
  });

  describe('Function symbols', () => {
    it('returns just one line if parens are balanced on the first line', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          fixtureDefinitionWithPoint(new Point(26, 16)),
        );

        expect(preview).toEqual(
          'export function aSingleLineFunctionSignature() {',
        );
      });
    });

    it('doesnt dedent beyond the current lines indentation level', () => {
      waitsForPromise(async () => {
        const preview = await getDefinitionPreview(
          fixtureDefinitionWithPoint(new Point(36, 18)),
        );

        expect(preview).toEqual(
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
          fixtureDefinitionWithPoint(new Point(30, 16)),
        );

        expect(preview).toEqual(
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
