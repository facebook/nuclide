/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';

import ClangServer from '../lib/ClangServer';
import findClangServerArgs from '../lib/find-clang-server-args';

const TEST_FILE = nuclideUri.join(
  __dirname,
  '../__mocks__',
  'fixtures',
  'cpp_buck_project',
  'outline.cpp',
);
const FILE_CONTENTS = fs.readFileSync(TEST_FILE, 'utf8');

describe('ClangServer', () => {
  it('can return outline data', async () => {
    const serverArgs = findClangServerArgs();
    const server = new ClangServer(
      TEST_FILE,
      FILE_CONTENTS,
      serverArgs,
      Promise.resolve({
        flags: ['-x', 'c++'],
        usesDefaultFlags: false,
        flagsFile: null,
      }),
    );
    const service = await server.getService();
    const response = await service.get_outline(FILE_CONTENTS);
    invariant(response != null);
    expect(response).toMatchSnapshot();
  });
});
