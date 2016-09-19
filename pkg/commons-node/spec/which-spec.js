'use babel';
/* @flow */

import which from '../which';

describe('which', () => {
  let checkOutput: JasmineSpy;
  let checkOutputReturn = {stdout: ''};

  beforeEach(() => {
    checkOutput = spyOn(require('../process'), 'checkOutput').andCallFake(() =>
      checkOutputReturn
    );
  });

  afterEach(() => {
    jasmine.unspy(require('../process'), 'checkOutput');
  });

  describe('on windows', () => {
    const real_platform: string = process.platform;
    const eol = '\r\n';
    let os = require('os');
    const real_eol = os.EOL;
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      os.EOL = eol;
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', {value: real_platform});
      os.EOL = real_eol;
    });

    it('calls where on Windows', () => {
      let param: string = '';
      which(param);
      expect(checkOutput).toHaveBeenCalledWith('where', [param]);
    });

    it('returns the first match', () => {
      waitsForPromise(async () => {
        checkOutputReturn.stdout = 'hello' + os.EOL + 'hello.exe' + os.EOL;
        const ret = await which('bla');
        expect(ret).toEqual('hello');
      });
    });
  });

  describe('on linux', () => {
    const real_platform: string = process.platform;
    const eol = '\n';
    let os = require('os');
    const real_eol = os.EOL;
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {value: 'linux'});
      os.EOL = eol;
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', {value: real_platform});
      os.EOL = real_eol;
    });

    it('calls which', () => {
      let param: string = '';
      which(param);
      expect(checkOutput).toHaveBeenCalledWith('which', [param]);
    });

    it('returns the first match', () => {
      waitsForPromise(async () => {
        checkOutputReturn.stdout = 'hello' + os.EOL + '/bin/hello' + os.EOL;
        const ret = await which('bla');
        expect(ret).toEqual('hello');
      });
    });
  });
});
