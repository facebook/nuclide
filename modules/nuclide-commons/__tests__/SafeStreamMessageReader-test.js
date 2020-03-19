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
import Stream from 'stream';
import SafeStreamMessageReader from '../SafeStreamMessageReader';
import waitsFor from '../../../jest/waits_for';

describe('SafeStreamMessageReader', () => {
  it('reads valid messages', async () => {
    const readable = new Stream.Readable({
      read() {
        this.push('Content-Length: 7\r\n\r\n{"a":1}');
        this.push(null);
      },
    });
    const reader = new SafeStreamMessageReader(readable);
    const listenSpy = jest.fn();
    reader.listen(listenSpy);

    await waitsFor(() => listenSpy.mock.calls.length > 0);

    expect(listenSpy.mock.calls[0]).toEqual([{a: 1}]);
  });

  it('emits an error for an invalid header', async () => {
    const readable = new Stream.Readable({
      read() {
        this.push('Invalid-Header: test\r\n\r\n');
        this.push('Content-Length: 2\r\n\r\n{}');
        this.push(null);
      },
    });
    const reader = new SafeStreamMessageReader(readable);
    const listenSpy = jest.fn();
    const errorSpy = jest.fn();
    reader.listen(listenSpy);
    reader.onError(errorSpy);

    await waitsFor(() => errorSpy.mock.calls.length > 0);

    expect(errorSpy.mock.calls[0][0].name).toBe('Error');
    expect(listenSpy).not.toHaveBeenCalled();
  });
});
