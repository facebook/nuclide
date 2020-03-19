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
import {existingBufferForUri, bufferForUri} from '../lib/remote-text-buffer';

describe('existingBufferForUri', () => {
  const file1 = '/tmp/file1.txt';

  it('should open an editor with the same buffer, if previously cached', async () => {
    const existingBuffer = existingBufferForUri(file1);
    expect(existingBuffer).toBeUndefined();
    const secondFile1Buffer = (await atom.workspace.open(file1)).getBuffer();
    expect(secondFile1Buffer).toBeDefined();
    const bufferAfterCreation = existingBufferForUri(file1);
    expect(bufferAfterCreation).toBeDefined();
  });
});

describe('bufferForUri', () => {
  const file1 = '/tmp/file1.txt';
  const file2 = '/tmp/file2.txt';

  let file1Buffer: atom$TextBuffer = (null: any);

  beforeEach(() => {
    file1Buffer = bufferForUri(file1);
  });

  it('should open an editor with the same buffer, if previously cached', async () => {
    const secondFile1Buffer = (await atom.workspace.open(file1)).getBuffer();
    expect(secondFile1Buffer).toBe(file1Buffer);
  });

  it('should return the same buffer after creating an editor for it', async () => {
    const file2Buffer = (await atom.workspace.open(file2)).getBuffer();
    expect(bufferForUri(file2)).toBe(file2Buffer);
  });

  it('should throw an error if remote connection not found', () => {
    const uri = 'nuclide://host/abc.txt';
    expect(() => bufferForUri(uri)).toThrow(
      `ServerConnection cannot be found for uri: ${uri}`,
    );
  });
});
