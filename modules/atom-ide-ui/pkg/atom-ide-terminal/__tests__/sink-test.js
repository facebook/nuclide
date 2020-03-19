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
import {removePrefixSink, patternCounterSink} from '../lib/sink';

import type {Sink} from '../lib/sink';

describe('sink', () => {
  describe('removePrefixSink', () => {
    const prefix = '\x1bprefix';
    let callCount: number;
    let output: string;
    let sink: Sink;

    beforeEach(() => {
      callCount = 0;
      output = '';
      sink = removePrefixSink(prefix, data => {
        output += data;
        callCount++;
      });
    });

    it('removes prefix when sent a single chunk', () => {
      sink(prefix + 'suffix');
      expect(output).toEqual('suffix');
    });
    it('removes prefix when sent one character at a time', () => {
      for (let i = 0; i < prefix.length; i++) {
        sink(prefix.charAt(i));
        expect(output).toEqual('');
      }
      expect(callCount).toEqual(0);
      sink('_');
      expect(output).toEqual('_');
    });
    it('avoids removing unrelated non-prefix', () => {
      const data = prefix.slice(0, -1) + 'abc';
      sink(data);
      expect(output).toEqual(data);
    });
    it('removes only one of two prefixes', () => {
      sink(prefix + prefix);
      expect(output).toEqual(prefix);
    });
  });

  describe('patternCounterSink', () => {
    let enabled: boolean;
    let counter: number;
    let output: string;

    function notify(): boolean {
      counter++;
      return enabled;
    }
    function next(data: string): void {
      output += data;
    }

    beforeEach(() => {
      enabled = true;
      counter = 0;
      output = '';
    });

    it('does not match a non-match', () => {
      const sink = patternCounterSink('needle', notify, next);
      sink('haystack');
      expect(counter).toEqual(0);
      expect(output).toEqual('haystack');
    });
    it('matches a unique pattern exactly', () => {
      const sink = patternCounterSink('abc', notify, next);
      sink('abc');
      expect(counter).toEqual(1);
      expect(output).toEqual('abc');
    });
    it('matches multiple occurrences of a pattern', () => {
      const sink = patternCounterSink('abc', notify, next);
      sink('abc abc abc');
      expect(counter).toEqual(3);
    });
    it('matches overlapping occurrences of a pattern', () => {
      const sink = patternCounterSink('aba', notify, next);
      sink('ababababa');
      expect(counter).toEqual(4);
    });
    it('matches odd characters', () => {
      const sink = patternCounterSink('\x1b\n ', notify, next);
      sink('  \x1b\n  ');
      expect(counter).toEqual(1);
    });
    it('matches small chunks', () => {
      const sink = patternCounterSink('aaa', notify, next);
      sink('b');
      expect(counter).toEqual(0);
      sink('a');
      expect(counter).toEqual(0);
      sink('a');
      expect(counter).toEqual(0);
      sink('a');
      expect(counter).toEqual(1);
      sink('a');
      expect(counter).toEqual(2);
      sink('a');
      expect(counter).toEqual(3);
      sink('b');
      expect(counter).toEqual(3);
      sink('a');
      expect(counter).toEqual(3);
      sink('a');
      expect(counter).toEqual(3);
      sink('a');
      expect(counter).toEqual(4);
    });
    it('Returning enabled=false has no subsequent notifications', () => {
      const sink = patternCounterSink('a', notify, next);
      sink('a');
      expect(counter).toEqual(1);
      enabled = false;
      sink('a');
      expect(counter).toEqual(2);
      sink('a');
      expect(counter).toEqual(2);
      sink('a');
      expect(counter).toEqual(2);
    });
  });
});
