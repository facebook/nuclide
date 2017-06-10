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

import {__test__} from '../lib/AutocompleteHelpers';

const {getCompletionBodyInline, getCompletionBodyMultiLine} = __test__;

describe('AutocompleteHelpers', () => {
  describe('@getCompletionBodyMultiLine', () => {
    it('converts method call with first argument being longest', () => {
      const completion = {
        chunks: [
          {
            spelling: 'ArgumentOne:',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg1',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2:',
            isPlaceHolder: false,
          },
          {
            spelling: 'argTwo',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'Argument3:',
            isPlaceHolder: false,
          },
          {
            spelling: 'argument3',
            isPlaceHolder: true,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyMultiLine(
        completion,
        /* columnOffset */ 10,
        /* indentation */ 2,
      );

      expect(body).toBe(
        'ArgumentOne:${1:arg1}\n' +
          '             arg2:${2:argTwo}\n' +
          '        Argument3:${3:argument3}\n',
      );
    });

    it('converts method call with third argument being longest', () => {
      const completion = {
        chunks: [
          {
            spelling: 'Arg1:',
            isPlaceHolder: false,
          },
          {
            spelling: 'argumentOne',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2:',
            isPlaceHolder: false,
          },
          {
            spelling: 'argTwo',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'Argument3:',
            isPlaceHolder: false,
          },
          {
            spelling: 'argument3',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'test123',
            isPlaceHolder: false,
          },
          {
            spelling: 'this_is_a_test_placeholder',
            isPlaceHolder: true,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyMultiLine(
        completion,
        /* columnOffset */ 10,
        /* indentation */ 3,
      );

      expect(body).toBe(
        'Arg1:${1:argumentOne}\n' +
          '         arg2:${2:argTwo}\n' +
          '    Argument3:${3:argument3}\n' +
          '      test123:${4:this_is_a_test_placeholder}\n',
      );
    });

    it('calls getCompletionBodyMultiLine with odd number of non-empty chunks', () => {
      const completion = {
        chunks: [
          {
            spelling: 'ArgumentOne:',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg1',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2:',
            isPlaceHolder: false,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyMultiLine(
        completion,
        /* columnOffset */ 10,
        /* indentation */ 3,
      );

      expect(body).toBe(null);
    });

    it('calls getCompletionBodyMultiLine with two non-placeholder chunks in a row', () => {
      const completion = {
        chunks: [
          {
            spelling: 'ArgumentOne:',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg1',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2:',
            isPlaceHolder: false,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyMultiLine(
        completion,
        /* columnOffset */ 10,
        /* indentation */ 3,
      );

      expect(body).toBe(null);
    });

    it('calls getCompletionBodyMultiLine with two placeholder chunks in a row', () => {
      const completion = {
        chunks: [
          {
            spelling: 'ArgumentOne:',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg1',
            isPlaceHolder: true,
          },
          {
            spelling: '   ',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2',
            isPlaceHolder: true,
          },
          {
            spelling: 'arg2:',
            isPlaceHolder: false,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyMultiLine(
        completion,
        /* columnOffset */ 10,
        /* indentation */ 3,
      );

      expect(body).toBe(null);
    });
  });

  describe('@getCompletionBodyInline', () => {
    it('converts method call with 2 arguments', () => {
      const completion = {
        chunks: [
          {
            spelling: 'ArgumentOne:',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg1',
            isPlaceHolder: true,
          },
          {
            spelling: ' ',
            isPlaceHolder: false,
          },
          {
            spelling: 'arg2:',
            isPlaceHolder: false,
          },
          {
            spelling: 'argTwo',
            isPlaceHolder: true,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyInline(completion);
      expect(body).toBe('ArgumentOne:${1:arg1} arg2:${2:argTwo}');
    });

    it('converts short completion with no placeholders', () => {
      const completion = {
        chunks: [
          {
            spelling: 'self',
            isPlaceHolder: false,
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      const body = getCompletionBodyInline(completion);
      expect(body).toBe('self');
    });

    it('decorates optional parameters', () => {
      const completion = {
        chunks: [
          {
            spelling: 'f(',
          },
          {
            spelling: 'int x',
            isPlaceHolder: true,
          },
          {
            spelling: ', ',
            isPlaceHolder: false,
            isOptional: false,
          },
          {
            spelling: 'int y',
            isPlaceHolder: true,
            isOptional: true,
          },
          {
            spelling: ', ',
            isPlaceHolder: false,
            isOptional: false,
          },
          {
            spelling: 'int z',
            isPlaceHolder: true,
            isOptional: true,
          },
          {
            spelling: ')',
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      };

      let body = getCompletionBodyInline(completion);
      expect(body).toBe('f(${1:int x}${2:[, int y, int z]})');

      body = getCompletionBodyInline({
        chunks: [
          {
            spelling: 'f(',
          },
          {
            spelling: 'int x',
            isPlaceHolder: true,
            isOptional: true,
          },
          {
            spelling: ')',
          },
        ],
        result_type: '',
        spelling: '',
        cursor_kind: '',
        brief_comment: null,
        typed_name: '',
      });
      expect(body).toBe('f(${1:[int x]})');
    });
  });
});
