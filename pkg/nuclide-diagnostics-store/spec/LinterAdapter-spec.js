'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Disposable} from 'atom';

import invariant from 'assert';

import {
  LinterAdapter,
  linterMessageToDiagnosticMessage,
  linterMessagesToDiagnosticUpdate,
} from '../lib/LinterAdapter';

const grammar = 'testgrammar';

import {arePropertiesEqual} from '../../nuclide-test-helpers';

function makePromise<T>(ret: T, timeout: number): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(ret);
    }, timeout);
  });
}

describe('LinterAdapter', () => {
  let eventCallback: any;
  let fakeLinter: any;
  let linterAdapter: any;
  let linterReturn: any;
  let fakeEditor: any;
  let subscribedToAny: any;
  let newUpdateSubscriber: any;
  let publishMessageUpdateSpy: any;
  let publishMessageInvalidationSpy: any;
  let fakeDiagnosticsProviderBase: any;
  let bufferDestroyCallback: any;

  class FakeDiagnosticsProviderBase {
    publishMessageUpdate: JasmineSpy;
    publishMessageInvalidation: JasmineSpy;
    dispose: JasmineSpy;
    constructor(options) {
      eventCallback = options.onTextEditorEvent;
      subscribedToAny = options.enableForAllGrammars;
      newUpdateSubscriber = options.onNewUpdateSubscriber;
      this.publishMessageUpdate = jasmine.createSpy();
      publishMessageUpdateSpy = this.publishMessageUpdate;
      this.publishMessageInvalidation = jasmine.createSpy();
      publishMessageInvalidationSpy = this.publishMessageInvalidation;
      this.dispose = jasmine.createSpy();
      fakeDiagnosticsProviderBase = this;
    }
    onMessageUpdate(callback) {
      this.publishMessageUpdate.andCallFake(callback);
      return new Disposable(() => {});
    }
    onMessageInvalidation(callback) {
      this.publishMessageInvalidation.andCallFake(callback);
      return new Disposable(() => {});
    }
  }

  function newLinterAdapter(linter) {
    return new LinterAdapter(linter, (FakeDiagnosticsProviderBase: any));
  }

  function shouldNotInvalidate() {
    waitsForPromise(() => {
      return eventCallback(fakeEditor).then(result => {
        expect(bufferDestroyCallback).toBeUndefined();
        expect(result).toBeUndefined();
        expect(publishMessageUpdateSpy).not.toHaveBeenCalled();
        expect(publishMessageInvalidationSpy).not.toHaveBeenCalled();
      });
    });
  }

  beforeEach(() => {
    const fakeBuffer = {
      onDidDestroy(callback) {
        bufferDestroyCallback = callback;
        return new Disposable(() => {});
      },
      isDestroyed: () => false,
    };
    fakeEditor = {
      getPath() { return 'foo'; },
      getGrammar() { return {scopeName: grammar}; },
      getBuffer() { return fakeBuffer; },
    };
    spyOn(atom.workspace, 'getActiveTextEditor').andReturn(fakeEditor);
    linterReturn = Promise.resolve([]);
    fakeLinter = {
      grammarScopes: [grammar],
      scope: 'file',
      lintOnFly: true,
      lint: () => linterReturn,
    };
    spyOn(fakeLinter, 'lint').andCallThrough();
    linterAdapter = newLinterAdapter(fakeLinter);
  });

  afterEach(() => {
    jasmine.unspy(atom.workspace, 'getActiveTextEditor');
  });

  it('should dispatch the linter on an event', () => {
    eventCallback(fakeEditor);
    expect(fakeLinter.lint).toHaveBeenCalled();
  });

  it("should subscribe to 'all' for linters for allGrammarScopes", () => {
    newLinterAdapter({
      grammarScopes: [],
      allGrammarScopes: true,
      scope: 'file',
      lintOnFly: true,
      lint: () => linterReturn,
    });
    expect(subscribedToAny).toBe(true);
  });

  it('should dispatch an event on subscribe if no lint is in progress', () => {
    const callback = jasmine.createSpy();
    newUpdateSubscriber(callback);
    waitsFor(() => {
      return publishMessageUpdateSpy.callCount > 0;
    }, 'It should call the callback', 100);
  });

  it('should work when the linter is synchronous', () => {
    linterReturn = [{type: 'Error', filePath: 'foo'}];
    let message = null;
    linterAdapter.onMessageUpdate(m => {
      message = m;
    });
    eventCallback(fakeEditor);
    waitsFor(() => {
      return message && message.filePathToMessages.has('foo');
    }, 'The adapter should publish a message');
  });

  it('should not invalidate previous result when linter resolves to null', () => {
    newLinterAdapter({
      grammarScopes: [],
      scope: 'file',
      lintOnFly: true,
      lint: () => Promise.resolve(null),
    });

    shouldNotInvalidate();
  });

  it('should not invalidate previous result when linter resolves to undefined', () => {
    newLinterAdapter({
      grammarScopes: [],
      scope: 'file',
      lintOnFly: true,
      lint: () => Promise.resolve(undefined),
    });

    shouldNotInvalidate();
  });

  it('should not invalidate previous result when linter returns null', () => {
    newLinterAdapter({
      grammarScopes: [],
      scope: 'file',
      lintOnFly: true,
      lint: () => null,
    });

    shouldNotInvalidate();
  });

  it('should not invalidate previous result when linter returns undefined', () => {
    newLinterAdapter({
      grammarScopes: [],
      scope: 'file',
      lintOnFly: true,
      lint: () => undefined,
    });

    shouldNotInvalidate();
  });

  it('should not reorder results', () => {
    let numMessages = 0;
    let lastMessage = null;
    linterAdapter.onMessageUpdate(message => {
      numMessages++;
      lastMessage = message;
    });
    // Dispatch two linter requests.
    linterReturn = makePromise([{type: 'Error', filePath: 'bar'}], 50);
    eventCallback(fakeEditor);
    linterReturn = makePromise([{type: 'Error', filePath: 'baz'}], 10);
    eventCallback(fakeEditor);
    // If we call it once with a larger value, the first promise will resolve
    // first, even though the timeout is larger
    window.advanceClock(30);
    window.advanceClock(30);
    waitsFor(() => {
      return numMessages === 1 && lastMessage && lastMessage.filePathToMessages.has('baz');
    }, 'There should be only the latest message', 100);
  });

  it('should delegate dispose', () => {
    expect(fakeDiagnosticsProviderBase.dispose).not.toHaveBeenCalled();
    linterAdapter.dispose();
    expect(fakeDiagnosticsProviderBase.dispose).toHaveBeenCalled();
  });

  it('implements invalidateOnClose', () => {
    newLinterAdapter({
      grammarScopes: [],
      allGrammarScopes: true,
      scope: 'file',
      lintOnFly: true,
      invalidateOnClose: true,
      lint: () => Promise.resolve([
        {type: 'Error', filePath: 'foo'},
        {type: 'Error', filePath: 'bar'},
      ]),
    });
    eventCallback(fakeEditor);
    waitsFor(() => bufferDestroyCallback != null);
    runs(() => {
      bufferDestroyCallback();
      expect(publishMessageInvalidationSpy).toHaveBeenCalledWith({
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
      const actual = linterMessageToDiagnosticMessage(linterMessage, providerName);
      const areEqual = arePropertiesEqual(actual, expected);
      expect(areEqual).toBe(true);
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

  describe('linterMessagesToDiagnosticUpdate', () => {
    function runWith(linterMessages) {
      return linterMessagesToDiagnosticUpdate(currentPath, linterMessages, providerName);
    }

    it('should invalidate diagnostics in the current file', () => {
      const result = runWith([]);
      invariant(result.filePathToMessages);
      expect(result.filePathToMessages.get(currentPath)).toEqual([]);
    });

    it('should name linters that do not provide a name', () => {
      providerName = undefined;
      const result = runWith([fileMessage]);
      invariant(result.filePathToMessages);
      const messages = result.filePathToMessages.get(fileMessage.filePath);
      invariant(messages != null);
      const resultMessage = messages[0];
      expect(resultMessage.providerName).toEqual('Unnamed Linter');
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
      const messages = result.filePathToMessages.get(fileMessageWithName.filePath);
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
