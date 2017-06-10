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

import {Disposable} from 'atom';

const grammar = 'testgrammar';

import {DiagnosticsProviderBase} from '../lib/DiagnosticsProviderBase';

describe('DiagnosticsProviderBase', () => {
  let providerBase: any;

  let eventCallback: any;
  let subscribedToAny: any;
  let fakeEditor: any;

  let textEventCallback: any;

  class FakeEventDispatcher {
    onFileChange(grammars, callback) {
      eventCallback = callback;
      return new Disposable(() => {});
    }
    onAnyFileChange(callback) {
      subscribedToAny = true;
      eventCallback = callback;
      return new Disposable(() => {});
    }
  }

  function newProviderBase(options) {
    return new DiagnosticsProviderBase(
      options,
      (new FakeEventDispatcher(): any),
    );
  }

  beforeEach(() => {
    fakeEditor = {
      getPath() {
        return 'foo';
      },
      getGrammar() {
        return {scopeName: grammar};
      },
    };
    eventCallback = null;
    subscribedToAny = null;

    // Flow complains that a spy is not callable.
    textEventCallback = (jasmine.createSpy(): any);
    const options = {
      grammarScopes: new Set([grammar]),
      onTextEditorEvent: textEventCallback,
      shouldRunOnTheFly: true,
    };
    providerBase = newProviderBase(options);
  });

  it('should call the provided callback when there is a text event', () => {
    eventCallback(fakeEditor);
    expect(textEventCallback).toHaveBeenCalled();
  });

  it("should subscribe to 'all' if allGrammarScopes is true", () => {
    newProviderBase({
      grammarScopes: new Set([]),
      enableForAllGrammars: true,
      shouldRunOnTheFly: true,
    });
    expect(subscribedToAny).toBe(true);
  });

  it('should send published messages to all subscribers', () => {
    const callback1 = jasmine.createSpy();
    const callback2 = jasmine.createSpy();

    providerBase.onMessageUpdate(callback1);
    providerBase.onMessageUpdate(callback2);

    const update = 'this is a fake update';
    providerBase.publishMessageUpdate(update);
    expect(callback1).toHaveBeenCalledWith(update);
    expect(callback2).toHaveBeenCalledWith(update);
  });
});
