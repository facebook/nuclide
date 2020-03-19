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
import {Point} from 'simple-text-buffer';
import invariant from 'assert';
import fs from 'fs';
import {Subject} from 'rxjs';
import waitsFor from '../../../jest/waits_for';

import nuclideUri from 'nuclide-commons/nuclideUri';
import * as FileWatcherService from '../../nuclide-filewatcher-rpc';
import ClangServer from '../lib/ClangServer';
import findClangServerArgs from '../lib/find-clang-server-args';

const TEST_FILE = nuclideUri.join(
  __dirname,
  '../__mocks__',
  'fixtures',
  'cpp_buck_project',
  'test.cpp',
);
const FILE_CONTENTS = fs.readFileSync(TEST_FILE).toString('utf8');

describe('ClangServer', () => {
  const serverFlags = Promise.resolve({
    flags: [],
    usesDefaultFlags: false,
    flagsFile: null,
  });

  it('can handle requests', async () => {
    const serverArgs = findClangServerArgs();
    const server = new ClangServer(
      TEST_FILE,
      FILE_CONTENTS,
      serverArgs,
      serverFlags,
    );
    const service = await server.getService();
    let response = await server.compile(FILE_CONTENTS);
    invariant(response);
    expect(
      JSON.stringify(response, null, 2).replace(
        /file":\s+.*test\.cpp/g,
        'file": "<REPLACED>',
      ),
    ).toMatchSnapshot();

    response = await service.get_completions(FILE_CONTENTS, 4, 7, 7, 'f');
    invariant(response);
    expect(response.map(x => x.spelling).sort()).toEqual([
      'f(int x = 0)',
      'false',
      'float',
    ]);

    // This will hit the cache. Double-check the result.
    response = await service.get_completions(FILE_CONTENTS, 4, 7, 7, 'fa');
    invariant(response);
    expect(response.map(x => x.spelling).sort()).toEqual(['false']);

    // Function argument completions are a little special.
    response = await service.get_completions(FILE_CONTENTS, 4, 4, 4, '');
    invariant(response);
    expect(response[0].spelling).toBe('f(int x = 0)');
    expect(response[0].cursor_kind).toBe('OVERLOAD_CANDIDATE');

    response = await service.get_declaration(FILE_CONTENTS, 4, 2);
    invariant(response);
    const {point, spelling, type} = response;
    expect(point).toEqual(new Point(0, 5));
    expect(spelling).toBe('f');
    expect(type).toBe('void (int)');

    response = await service.get_declaration_info(FILE_CONTENTS, 4, 2);
    invariant(response);
    expect(response.length).toBe(1);
    expect(response[0].name).toBe('f(int)');
    expect(response[0].type).toBe('FUNCTION_DECL');
    // May not be consistent between clang versions.
    expect(response[0].cursor_usr).not.toBe(null);
    expect(response[0].is_definition).toBe(true);

    response = await service.get_outline(FILE_CONTENTS);
    invariant(response);
    expect(response).toMatchSnapshot();
  });

  it('gracefully handles server crashes', async () => {
    const serverArgs = findClangServerArgs();
    const server = new ClangServer(
      TEST_FILE,
      FILE_CONTENTS,
      serverArgs,
      serverFlags,
    );
    let response = await server.compile(FILE_CONTENTS);
    expect(response).not.toBe(null);

    const {_process} = server._rpcProcess;
    invariant(_process);
    _process.kill();

    // This request should fail, but cleanup should occur.
    let thrown = false;
    try {
      response = await server.compile(FILE_CONTENTS);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toBe(true);

    // The next request should work as expected.
    const service = await server.getService();
    response = await service.get_declaration(FILE_CONTENTS, 4, 2);
    expect(response).not.toBe(null);
  });

  it('supports get_local_references', async () => {
    const file = nuclideUri.join(
      __dirname,
      '../__mocks__',
      'fixtures',
      'cpp_buck_project',
      'references.cpp',
    );
    const fileContents = fs.readFileSync(file).toString('utf8');
    const serverArgs = findClangServerArgs();
    const server = new ClangServer(file, fileContents, serverArgs, serverFlags);
    const service = await server.getService();

    const compileResponse = await server.compile(fileContents);

    invariant(compileResponse != null);
    expect(compileResponse.diagnostics).toEqual([]);

    // param var1
    expect(
      await service.get_local_references(fileContents, 1, 24),
    ).toMatchSnapshot();
    // var2 (from a reference)
    expect(
      await service.get_local_references(fileContents, 4, 9),
    ).toMatchSnapshot();

    // var3
    expect(
      await service.get_local_references(fileContents, 2, 26),
    ).toMatchSnapshot();

    // inner var1
    expect(
      await service.get_local_references(fileContents, 6, 11),
    ).toMatchSnapshot();

    // nothing
    expect(await service.get_local_references(fileContents, 0, 0)).toBe(null);
    expect(await service.get_local_references(fileContents, 11, 0)).toBe(null);
  });

  it('tracks server status', async () => {
    const serverArgs = findClangServerArgs();
    const server = new ClangServer(TEST_FILE, '', serverArgs, serverFlags);
    expect(server.getStatus()).toBe('finding_flags');

    await waitsFor(() => server.getStatus() === 'compiling', 'compilation');
    await waitsFor(() => server.getStatus() === 'ready', 'ready');
  });

  it('listens to flag changes', async () => {
    const subject = new Subject();
    jest
      .spyOn(FileWatcherService, 'watchWithNode')
      .mockReturnValue(subject.publish());

    const serverArgs = findClangServerArgs();
    const server = new ClangServer(
      TEST_FILE,
      '',
      serverArgs,
      Promise.resolve({
        flags: [],
        usesDefaultFlags: false,
        flagsFile: '',
      }),
    );

    await server.waitForReady();
    subject.next(null);
    expect(server.getFlagsChanged()).toBe(true);
  });
});
