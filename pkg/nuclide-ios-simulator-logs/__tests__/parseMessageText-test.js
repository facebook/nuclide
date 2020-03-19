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
import {parseMessageText} from '../lib/parseMessageText';

describe('parseMessageText', () => {
  /* eslint-disable max-len */
  const lines = [
    // TODO: Test no tags?
    '2016-08-24 15:58:33.113 [info][tid:com.facebook.react.JavaScript] This is info',
    '2016-08-24 15:58:33.113 [warn][tid:com.facebook.react.JavaScript] This is warn',
    '2016-08-24 15:58:33.114 [error][tid:com.facebook.react.JavaScript] This is error',
    '2016-08-24 15:58:33.154 [info][tid:com.facebook.react.JavaScript] Running application "Something" with appParams: {"rootTag":1,"initialProps":{}}. __DEV__ === true, development-level warning are ON, performance optimizations are OFF',
    '2016-08-24 15:58:33.172 [info][tid:com.facebook.react.JavaScript] [Something] Checking for update.',
    '2016-08-24 15:58:33.657 [info][tid:com.facebook.react.JavaScript] [Something] App is up to date.',
    '2016-08-24 15:38:04.364 [debug][core.react][tid:main][] [RCTModuleData.m:103] The module RCTDiskCacheStore is returning nil from its constructor. You may need to instantiate it yourself and pass it into the bridge.',
    '2016-08-24 15:58:33.113 [info][tid:com.facebook.react.JavaScript] This\nis\ninfo',
  ];
  /* eslint-enable max-len */

  const parsed = lines.map(parseMessageText);

  it('parses tags', () => {
    expect(parsed.map(message => message.tags)).toEqual([
      ['tid:com.facebook.react.JavaScript'],
      ['tid:com.facebook.react.JavaScript'],
      ['tid:com.facebook.react.JavaScript'],
      ['tid:com.facebook.react.JavaScript'],
      ['tid:com.facebook.react.JavaScript'],
      ['tid:com.facebook.react.JavaScript'],
      ['core.react', 'tid:main'],
      ['tid:com.facebook.react.JavaScript'],
    ]);
  });

  it('parses levels', () => {
    expect(parsed.map(message => message.level)).toEqual([
      'info',
      'warning',
      'error',
      'info',
      'info',
      'info',
      'debug',
      'info',
    ]);
  });

  it('parses text', () => {
    expect(parsed.map(message => message.text)).toEqual([
      /* eslint-disable max-len */
      'This is info',
      'This is warn',
      'This is error',
      'Running application "Something" with appParams: {"rootTag":1,"initialProps":{}}. __DEV__ === true, development-level warning are ON, performance optimizations are OFF',
      '[Something] Checking for update.',
      '[Something] App is up to date.',
      '[RCTModuleData.m:103] The module RCTDiskCacheStore is returning nil from its constructor. You may need to instantiate it yourself and pass it into the bridge.',
      'This\nis\ninfo',
      /* eslint-enable max-len */
    ]);
  });

  it('ends the tag list when it encounters a tag with brackets in it', () => {
    // eslint-disable-next-line max-len
    const line =
      '2016-08-24 17:39:32.278 [debug][cpuspindetector][tid:com.facebook.FBTimer][-[FBCPUSpinDetector _checkUsage]] Begin check usage';
    const {tags, text} = parseMessageText(line);
    expect(tags).toEqual(['cpuspindetector', 'tid:com.facebook.FBTimer']);
    expect(text).toBe('[-[FBCPUSpinDetector _checkUsage]] Begin check usage');
  });

  it('handles messages with weird bracket situations', () => {
    // eslint-disable-next-line max-len
    const line = '2016-08-24 17:39:32.278 [abc][def]g]h';
    const {tags, text} = parseMessageText(line);
    expect(tags).toEqual(['abc', 'def']);
    expect(text).toBe('g]h');
  });
});
