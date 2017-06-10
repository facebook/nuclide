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

import type {LinterProvider} from '..';

import {Disposable, Range} from 'atom';
import invariant from 'assert';
import {Subject} from 'rxjs';

import {
  LinterAdapter,
  linterMessageToDiagnosticMessage,
  linterMessageV2ToDiagnosticMessage,
  linterMessagesToDiagnosticUpdate,
} from '../lib/LinterAdapter';

const grammar = 'testgrammar';

function makePromise<T>(ret: T, timeout: number): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(ret);
    }, timeout);
  });
}

describe('LinterAdapter', () => {
  let fakeLinter: any;
  let linterAdapter: any;
  let linterReturn: any;
  let fakeEditor: any;
  let bufferDestroyCallback: any;
  let textEventSubject;
  let textEventSpy;

  function newLinterAdapter(linter: LinterProvider) {
    return new LinterAdapter(linter);
  }

  beforeEach(() => {
    textEventSubject = new Subject();
    textEventSpy = spyOn(
      require('nuclide-commons-atom/text-event'),
      'observeTextEditorEvents',
    ).andReturn(textEventSubject.asObservable());

    const fakeBuffer = {
      onDidDestroy(callback) {
        bufferDestroyCallback = callback;
        return new Disposable(() => {});
      },
      isDestroyed: () => false,
    };
    fakeEditor = {
      getPath() {
        return 'foo';
      },
      getGrammar() {
        return {scopeName: grammar};
      },
      getBuffer() {
        return fakeBuffer;
      },
    };
    linterReturn = Promise.resolve([]);
    fakeLinter = {
      name: 'fakeLinter',
      grammarScopes: [grammar],
      scope: 'file',
      lintsOnChange: true,
      lint: () => linterReturn,
    };
    spyOn(fakeLinter, 'lint').andCallThrough();
    linterAdapter = newLinterAdapter(fakeLinter);
  });

  afterEach(() => {
    bufferDestroyCallback = null;
  });

  it('should dispatch the linter on an event', () => {
    textEventSubject.next(fakeEditor);
    expect(fakeLinter.lint).toHaveBeenCalled();
  });

  it("should subscribe to 'all' when * is in grammarScopes", () => {
    newLinterAdapter({
      name: 'linter',
      grammarScopes: ['*'],
      scope: 'file',
      lintsOnChange: true,
      lint: () => linterReturn,
    });
    expect(textEventSpy).toHaveBeenCalledWith('all', 'changes');
  });

  it('should work when the linter is synchronous', () => {
    waitsForPromise(async () => {
      linterReturn = [{type: 'Error', filePath: 'foo'}];
      textEventSubject.next(fakeEditor);
      const message = await linterAdapter.getUpdates().take(1).toPromise();
      expect(message.filePathToMessages.has('foo')).toBe(true);
    });
  });

  function shouldNotInvalidate(value) {
    waitsForPromise(async () => {
      const spy = jasmine.createSpy();
      linterAdapter.getInvalidations().subscribe(() => spy());

      const promise = linterAdapter.getUpdates().take(1).toPromise();

      // Populate the result.
      linterReturn = [{type: 'Error', filePath: 'foo'}];
      textEventSubject.next(fakeEditor);
      await promise;

      linterReturn = value;
      textEventSubject.next(fakeEditor);

      // This is tricky - the result resolves on the next tick.
      await new Promise(resolve => process.nextTick(resolve));
      expect(spy).not.toHaveBeenCalled();
    });
  }

  it('should not invalidate previous result when linter resolves to null', () => {
    shouldNotInvalidate(Promise.resolve(null));
  });

  it('should not invalidate previous result when linter resolves to undefined', () => {
    shouldNotInvalidate(Promise.resolve(undefined));
  });

  it('should not invalidate previous result when linter returns null', () => {
    shouldNotInvalidate(null);
  });

  it('should not invalidate previous result when linter returns undefined', () => {
    shouldNotInvalidate(undefined);
  });

  it('should not reorder results', () => {
    let numMessages = 0;
    let lastMessage = null;
    linterAdapter.getUpdates().subscribe(message => {
      numMessages++;
      lastMessage = message;
    });
    // Dispatch two linter requests.
    linterReturn = makePromise([{type: 'Error', filePath: 'bar'}], 50);
    textEventSubject.next(fakeEditor);
    linterReturn = makePromise([{type: 'Error', filePath: 'baz'}], 10);
    textEventSubject.next(fakeEditor);
    // If we call it once with a larger value, the first promise will resolve
    // first, even though the timeout is larger
    advanceClock(30);
    advanceClock(30);
    waitsFor(
      () => {
        return (
          numMessages === 1 &&
          lastMessage &&
          lastMessage.filePathToMessages.has('baz')
        );
      },
      'There should be only the latest message',
      100,
    );
  });

  it('invalidates files on close', () => {
    linterReturn = Promise.resolve([
      {type: 'Error', filePath: 'foo'},
      {type: 'Error', filePath: 'bar'},
    ]);
    textEventSubject.next(fakeEditor);
    waitsFor(() => bufferDestroyCallback != null);
    waitsForPromise(async () => {
      // Wait for the first lint to finish.
      await linterAdapter.getUpdates().take(1).toPromise();
      // Start a pending lint.
      linterReturn = makePromise([], 10);
      textEventSubject.next(fakeEditor);
      const promise = linterAdapter.getInvalidations().take(1).toPromise();
      bufferDestroyCallback();
      const invalidation = await promise;
      expect(invalidation).toEqual({
        scope: 'file',
        filePaths: ['foo', 'bar'],
      });
    });
  });
});

describe('message transformation functions', () => {
  const fileMessage = {
    type: 'Error',
    text: 'Uh oh',
    filePath: '/fu/bar',
  };

  const fileMessageWithName = {
    type: 'Error',
    text: 'Uh oh',
    filePath: '/fu/bar',
    name: 'Custom Linter Name',
  };

  const projectMessage = {
    type: 'Warning',
    text: 'Oh no!',
  };

  let providerName;
  let currentPath: string = (null: any);

  beforeEach(() => {
    providerName = 'provider';
    currentPath = 'foo/bar';
  });

  describe('linterMessageToDiagnosticMessage', () => {
    function checkMessage(linterMessage, expected) {
      invariant(providerName);
      const actual = linterMessageToDiagnosticMessage(
        linterMessage,
        providerName,
      );
      // This filters out any undefined values.
      expect(JSON.stringify(actual)).toEqual(JSON.stringify(expected));
    }

    it('should turn a message with a filePath into a file scope diagnostic', () => {
      checkMessage(fileMessage, {
        scope: 'file',
        providerName,
        type: fileMessage.type,
        filePath: fileMessage.filePath,
        text: fileMessage.text,
      });
    });

    it('should turn a message without a filePath into a project scope diagnostic', () => {
      checkMessage(projectMessage, {
        scope: 'project',
        providerName,
        type: projectMessage.type,
        text: projectMessage.text,
      });
    });
  });

  describe('linterMessageV2ToDiagnosticMessage', () => {
    it('should correctly convert messages', () => {
      expect(
        linterMessageV2ToDiagnosticMessage(
          {
            location: {
              file: 'file.txt',
              position: [[0, 0], [0, 1]],
            },
            reference: {
              file: 'ref.txt',
              position: [1, 1],
            },
            excerpt: 'Error',
            severity: 'error',
            solutions: [
              {
                title: 'Solution',
                position: [[0, 0], [0, 1]],
                currentText: '',
                replaceWith: 'a',
              },
            ],
            description: 'Description',
          },
          'test',
        ),
      ).toEqual({
        scope: 'file',
        providerName: 'test',
        type: 'Error',
        filePath: 'file.txt',
        range: new Range([0, 0], [0, 1]),
        text: 'Error\nDescription',
        trace: [
          {
            type: 'Trace',
            filePath: 'ref.txt',
            range: new Range([1, 1], [1, 1]),
          },
        ],
        fix: {
          title: 'Solution',
          oldRange: new Range([0, 0], [0, 1]),
          oldText: '',
          newText: 'a',
        },
      });
    });
  });

  describe('linterMessagesToDiagnosticUpdate', () => {
    function runWith(linterMessages) {
      return linterMessagesToDiagnosticUpdate(
        currentPath,
        linterMessages,
        providerName,
      );
    }

    it('should invalidate diagnostics in the current file', () => {
      const result = runWith([]);
      invariant(result.filePathToMessages);
      expect(result.filePathToMessages.get(currentPath)).toEqual([]);
    });

    it('should use the LinterProvider name when one is not specified in message', () => {
      const result = runWith([fileMessage]);
      invariant(result.filePathToMessages);
      const messages = result.filePathToMessages.get(fileMessage.filePath);
      invariant(messages != null);
      const resultMessage = messages[0];
      expect(resultMessage.providerName).toEqual('provider');
    });

    it('should use the provider name specified in message when available', () => {
      const result = runWith([fileMessageWithName]);
      invariant(result.filePathToMessages);
      const messages = result.filePathToMessages.get(
        fileMessageWithName.filePath,
      );
      invariant(messages != null);
      const resultMessage = messages[0];
      expect(resultMessage.providerName).toEqual('Custom Linter Name');
    });

    it('should provide both project messages and file messages', () => {
      const result = runWith([fileMessage, projectMessage]);
      invariant(result.filePathToMessages);
      // The actual message transformations are tested in the tests from
      // linterMessageToDiagnosticMessage -- no need to duplicate them here.
      const messages = result.filePathToMessages.get(fileMessage.filePath);
      invariant(messages != null);
      expect(messages.length).toEqual(1);
      invariant(result.projectMessages);
      expect(result.projectMessages.length).toEqual(1);
    });
  });
});
