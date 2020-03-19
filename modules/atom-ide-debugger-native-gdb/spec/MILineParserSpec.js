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
 */

import invariant from 'assert';
import MILineParser from '../lib/MILineParser';
import {
  MIAsyncRecord,
  MIRecord,
  MIResultRecord,
  MIStreamRecord,
} from '../lib/MIRecord';

describe('MILineParser', () => {
  let parser;

  beforeEach(() => {
    parser = new MILineParser();
  });

  describe('when given invalid input', () => {
    it('should throw an exception on invalid leading character', () => {
      const corruptEvent = '!';
      let thrown = false;

      try {
        parser.parseMILine(corruptEvent);
      } catch (error) {
        expect(error.message).toEqual("Line is not an MI record at: '!'");
        thrown = true;
      }
      expect(thrown).toBe(true);
    });

    it('should throw an exception on a badly formatted token', () => {
      const corruptEvent = '3.14159~"a float is not a valid token"';
      let thrown = false;

      try {
        parser.parseMILine(corruptEvent);
      } catch (error) {
        expect(error.message).toEqual(
          'Line is not an MI record at: \'3.14159~"a float is not a valid token"\'',
        );
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });

  describe('when given the debugger prompt', () => {
    it('should return an empty record', () => {
      const event = '(gdb) ';
      const record = parser.parseMILine(event);

      expect(record.constructor).toBe(MIRecord.prototype.constructor);
    });
  });

  describe('when given stream output events', () => {
    it('should parse console output properly', () => {
      const consoleEvent = '~"some console text"';
      const record = parser.parseMILine(consoleEvent);

      expect(record instanceof MIStreamRecord).toBe(true);
      invariant(record instanceof MIStreamRecord);

      expect(record.streamTarget).toEqual('console');
      expect(record.text).toEqual('some console text');
    });

    it('should parse target output properly', () => {
      const consoleEvent = '@"some target text"';
      const record = parser.parseMILine(consoleEvent);

      expect(record instanceof MIStreamRecord).toBe(true);
      invariant(record instanceof MIStreamRecord);

      expect(record.streamTarget).toEqual('target');
      expect(record.text).toEqual('some target text');
    });

    it('should parse log output properly', () => {
      const consoleEvent = '&"some log text"';
      const record = parser.parseMILine(consoleEvent);

      expect(record instanceof MIStreamRecord).toBe(true);
      invariant(record instanceof MIStreamRecord);

      expect(record.streamTarget).toEqual('log');
      expect(record.text).toEqual('some log text');
    });

    it('should parse escaped characters in strings properly', () => {
      const consoleEvent = '~"this string has \\"bel\\\'s\\" on \\b\\b\\b"';
      const record = parser.parseMILine(consoleEvent);

      expect(record instanceof MIStreamRecord).toBe(true);
      invariant(record instanceof MIStreamRecord);

      expect(record.streamTarget).toEqual('console');
      expect(record.text).toEqual('this string has "bel\'s" on \b\b\b');
    });

    it('should throw an exception on an unterminated string', () => {
      const corruptEvent = '~"this string is not terminated';
      let thrown = false;

      try {
        parser.parseMILine(corruptEvent);
      } catch (error) {
        expect(error.message).toEqual(
          "End quote missing on string at: 'this string is not terminated'",
        );
        thrown = true;
      }

      expect(thrown).toBe(true);
    });

    it('should throw an exception if a stream event starts with a token', () => {
      const corruptEvent = '4~"this string has a token."';
      let thrown = false;

      try {
        parser.parseMILine(corruptEvent);
      } catch (error) {
        expect(error.message).toEqual(
          'Token is not expected on stream record: \'4~"this string has a token."\'',
        );
        thrown = true;
      }

      expect(thrown).toBe(true);
    });
  });

  describe('when given result output', () => {
    it('should parse empty output properly', () => {
      const output = '^done';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toBe(null);
        expect(record.resultClass).toEqual('done');
        expect(record.result).toEqual({});
      }
    });

    it('should parse simple result output properly', () => {
      const output = '42^done,one="1",two="2"';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('done');
        expect(record.result).toEqual({one: '1', two: '2'});
      }
    });

    it('should parse an empty tuple in result output properly', () => {
      const output = '42^error,one={}';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('error');
        expect(record.result).toEqual({one: {}});
      }
    });

    it('should parse a tuple in result output properly', () => {
      const output = '42^running,one={two="2",three="3"}';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('running');
        expect(record.result).toEqual({one: {two: '2', three: '3'}});
      }
    });

    it('should parse an empty list in result output properly', () => {
      const output = '42^connected,one=[]';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('connected');
        expect(record.result).toEqual({one: []});
      }
    });

    it('should parse a value list in result output properly', () => {
      const output = '42^exit,one=["2","3"]';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('exit');
        expect(record.result).toEqual({one: ['2', '3']});
      }
    });

    it('should parse a result list in result output properly', () => {
      const output = '42^done,one=[two="2",three="3"]';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('done');
        expect(record.result).toEqual({one: [{two: '2'}, {three: '3'}]});
      }
    });

    it('should parse a compex result list in result output properly', () => {
      const output = '42^done,one={two="2",inner={four="4",five=[]},three="3"}';
      const record = parser.parseMILine(output);

      expect(record instanceof MIResultRecord).toBe(true);

      if (record instanceof MIResultRecord) {
        expect(record.token).toEqual(42);
        expect(record.resultClass).toEqual('done');
        expect(record.result).toEqual({
          one: {
            two: '2',
            inner: {four: '4', five: []},
            three: '3',
          },
        });
      }
    });

    it('should throw an exception on an invalid result class', () => {
      const output = '42^invalid';

      let thrown = false;
      try {
        parser.parseMILine(output);
      } catch (error) {
        expect(error.message).toEqual("Result class expected at 'invalid'");
        thrown = true;
      }

      expect(thrown).toBe(true);
    });
  });

  describe('when given async output', () => {
    it('should parse empty async exec output properly', () => {
      const asyncOutput = '*stopped';
      const record = parser.parseMILine(asyncOutput);

      expect(record instanceof MIAsyncRecord).toBe(true);

      if (record instanceof MIAsyncRecord) {
        expect(record.token).toBe(null);
        expect(record.recordType).toEqual('async-exec');
        expect(record.asyncClass).toEqual('stopped');
        expect(record.result).toEqual({});
      }
    });

    it('should parse empty async status output properly', () => {
      const asyncOutput = '1+stopped';
      const record = parser.parseMILine(asyncOutput);

      expect(record instanceof MIAsyncRecord).toBe(true);

      if (record instanceof MIAsyncRecord) {
        expect(record.token).toBe(1);
        expect(record.recordType).toEqual('async-status');
        expect(record.asyncClass).toEqual('stopped');
        expect(record.result).toEqual({});
      }
    });

    it('should parse empty async notify output properly', () => {
      const asyncOutput = '2=stopped';
      const record = parser.parseMILine(asyncOutput);

      expect(record instanceof MIAsyncRecord).toBe(true);

      if (record instanceof MIAsyncRecord) {
        expect(record.token).toBe(2);
        expect(record.recordType).toEqual('async-notify');
        expect(record.asyncClass).toEqual('stopped');
        expect(record.result).toEqual({});
      }
    });

    it('should parse simple async notify output', () => {
      const asyncOutput = '2=stopped,one={two="three"}';
      const record = parser.parseMILine(asyncOutput);

      expect(record instanceof MIAsyncRecord).toBe(true);

      if (record instanceof MIAsyncRecord) {
        expect(record.token).toBe(2);
        expect(record.recordType).toEqual('async-notify');
        expect(record.asyncClass).toEqual('stopped');
        expect(record.result).toEqual({one: {two: 'three'}});
      }
    });
  });
});
