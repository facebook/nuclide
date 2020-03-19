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
import which from '../which';
import {Observable} from 'rxjs';

describe('which', () => {
  let runCommand;
  let runCommandReturn = '';

  beforeEach(() => {
    runCommandReturn = '';
    runCommand = jest
      .spyOn(require('../process'), 'runCommand')
      .mockImplementation(() => Observable.of(runCommandReturn));
  });

  afterEach(() => {
    // $FlowFixMe
    require('../process').runCommand.mockRestore();
  });

  describe('on windows', () => {
    const real_platform: string = process.platform;
    const eol = '\r\n';
    const os = require('os');
    const real_eol = os.EOL;
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      // $FlowFixMe overwriting for test
      os.EOL = eol;
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', {value: real_platform});
      // $FlowFixMe overwriting for test
      os.EOL = real_eol;
    });

    it('calls where on Windows', () => {
      const param: string = '';
      which(param);
      expect(runCommand).toHaveBeenCalledWith('where', [''], {});
    });

    it('returns the first match', async () => {
      runCommandReturn = 'hello' + os.EOL + 'hello.exe' + os.EOL;
      const ret = await which('bla');
      expect(ret).toEqual('hello');
    });
  });

  describe('on linux', () => {
    const real_platform: string = process.platform;
    const eol = '\n';
    const os = require('os');
    const real_eol = os.EOL;
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {value: 'linux'});
      // $FlowFixMe overwriting for test
      os.EOL = eol;
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', {value: real_platform});
      // $FlowFixMe overwriting for test
      os.EOL = real_eol;
    });

    it('calls which', () => {
      const param: string = '';
      which(param);
      expect(runCommand).toHaveBeenCalledWith('which', [param], {});
    });

    it('returns the first match', async () => {
      runCommandReturn = 'hello' + os.EOL + '/bin/hello' + os.EOL;
      const ret = await which('bla');
      expect(ret).toEqual('hello');
    });
  });
});
