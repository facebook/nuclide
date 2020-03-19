/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {sleep} from 'nuclide-commons/promise';

import {
  TextEventDispatcher,
  observeTextEditorEvents,
  __TEST__,
} from '../text-event';

const grammar = 'testgrammar';

describe('TextCallbackContainer', () => {
  let textCallbackContainer: any;
  let callback: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    textCallbackContainer = new __TEST__.TextCallbackContainer();
    callback = jest.fn();
  });

  function checkInvariant() {
    // enforce the invariant that there be no empty maps or sets
    textCallbackContainer._callbacks.forEach(eventMap => {
      expect(eventMap.size).not.toBe(0);
      eventMap.forEach(callbackSet => {
        expect(callbackSet.size).not.toBe(0);
      });
    });
    textCallbackContainer._allGrammarCallbacks.forEach(callbackSet => {
      expect(callbackSet.size).not.toBe(0);
    });
  }

  it('should return callback', () => {
    textCallbackContainer.addCallback([grammar], ['did-reload'], callback);
    const callbacks = textCallbackContainer.getCallbacks(grammar, 'did-reload');
    expect(callbacks).toEqual(new Set([callback]));
    checkInvariant();
  });

  it('should always return callbacks for all', () => {
    textCallbackContainer.addCallback('all', ['did-save'], callback);
    const callbacks = textCallbackContainer.getCallbacks('asdf', 'did-save');
    expect(callbacks).toEqual(new Set([callback]));
    checkInvariant();
  });

  it('should properly remove a callback', () => {
    textCallbackContainer.addCallback([grammar], ['did-change'], callback);
    expect(textCallbackContainer.getCallbacks(grammar, 'did-change')).toEqual(
      new Set([callback]),
    );
    checkInvariant();
    textCallbackContainer.removeCallback([grammar], ['did-change'], callback);
    expect(textCallbackContainer.getCallbacks(grammar, 'did-change')).toEqual(
      new Set(),
    );
  });
});

describe('TextEventDispatcher', () => {
  let textEventDispatcher: any;
  let fakeTextEditor: any;
  let fakeTextEditor2: any;
  let activeEditor: any;
  // Stores callbacks that have subscribed to Atom text events. Can be called to simulate
  let textEventCallbacks: any;
  let paneSwitchCallbacks: any;

  function fakeObserveEditors(callback) {
    callback(fakeTextEditor);
    callback(fakeTextEditor2);
    return new UniversalDisposable();
  }

  function makeFakeEditor(path?: string = '') {
    // Register a callback for this fake editor.
    const registerCallback = callback => {
      let set = textEventCallbacks.get(editor);
      if (!set) {
        set = new Set();
        textEventCallbacks.set(editor, set);
      }
      set.add(callback);
      return new UniversalDisposable(() => {
        set.delete(callback);
      });
    };
    const buffer = {
      onDidStopChanging: registerCallback,
      onDidSave: registerCallback,
      onDidReload: registerCallback,
    };
    const editor = {
      getBuffer() {
        return buffer;
      },
      getGrammar() {
        return {
          scopeName: grammar,
        };
      },
      // getPath is nice for debugging tests
      getPath() {
        return path;
      },
      destroy() {},
      onDidDestroy(callback) {
        return new UniversalDisposable();
      },
    };
    return editor;
  }

  function triggerAtomEvent(editor) {
    for (const callback of textEventCallbacks.get(editor)) {
      callback();
    }
  }

  beforeEach(() => {
    textEventCallbacks = new Map();
    paneSwitchCallbacks = new Set();

    fakeTextEditor = makeFakeEditor('foo');
    fakeTextEditor2 = makeFakeEditor('bar');
    activeEditor = fakeTextEditor;
    jest.spyOn(atom.workspace, 'isTextEditor').mockReturnValue(true);
    jest
      .spyOn(atom.workspace, 'observeTextEditors')
      .mockImplementation(fakeObserveEditors);
    jest
      .spyOn(atom.workspace, 'getActiveTextEditor')
      .mockImplementation(() => activeEditor);
    jest
      .spyOn(atom.workspace, 'getTextEditors')
      .mockReturnValue([fakeTextEditor, fakeTextEditor2]);
    jest
      .spyOn(atom.workspace, 'onDidChangeActivePaneItem')
      .mockImplementation(callback => {
        paneSwitchCallbacks.add(callback);
        return new UniversalDisposable(() => {});
      });
    textEventDispatcher = new TextEventDispatcher();
  });

  it('should fire events', () => {
    const callback = jest.fn();
    textEventDispatcher.onFileChange([grammar], callback);
    triggerAtomEvent(fakeTextEditor);
    expect(callback).toHaveBeenCalled();
  });

  it('should work with observeTextEditorEvents', () => {
    const spy = jest.fn();
    observeTextEditorEvents([grammar], 'changes').subscribe(editor =>
      spy(editor),
    );
    triggerAtomEvent(fakeTextEditor);
    expect(spy).toHaveBeenCalledWith(fakeTextEditor);
  });

  it('should debounce events', () => {
    const callback = jest.fn();
    textEventDispatcher.onFileChange([grammar], callback);
    // This test hinges on these two calls happening within 50 ms of each other.
    // An initial attempt to mock the clock was unsuccessful, probably because
    // of problems clearing the require cache thoroughly enough that the
    // debounce function picks up the mocked clock. If this causes problems,
    // figure out how to mock the clock properly.
    triggerAtomEvent(fakeTextEditor);
    triggerAtomEvent(fakeTextEditor);
    expect(callback.mock.calls.length).toBe(1);
  });

  it('should dispatch pending events on a tab switch', () => {
    const callback = jest.fn();
    textEventDispatcher.onFileChange([grammar], callback);
    triggerAtomEvent(fakeTextEditor2);
    expect(callback).not.toHaveBeenCalled();
    activeEditor = fakeTextEditor2;
    paneSwitchCallbacks.forEach(f => f());
    expect(callback).toHaveBeenCalledWith(fakeTextEditor2);
  });

  it('should register simultaneous open events as pending', async () => {
    const callback = jest.fn();

    // Initially, both fakeTextEditor/fakeTextEditor2 are opened.
    textEventDispatcher.onFileChange([grammar], callback);

    // Open events need a tick to process.
    await sleep(0);

    // Only fakeTextEditor should have opened; the other one should be pending.
    expect(callback).toHaveBeenCalledWith(fakeTextEditor);
    expect(callback).not.toHaveBeenCalledWith(fakeTextEditor2);

    // Prevent the next open event from being debounced.
    await sleep(100);

    // Switching to fakeTextEditor2 should now trigger its pending open event.
    activeEditor = fakeTextEditor2;
    paneSwitchCallbacks.forEach(f => f());
    expect(callback).toHaveBeenCalledWith(fakeTextEditor2);
  });

  it('should always dispatch to clients that request all changes', () => {
    const callback = jest.fn();
    textEventDispatcher.onAnyFileChange(callback);
    triggerAtomEvent(fakeTextEditor);
    expect(callback).toHaveBeenCalled();
  });

  it('should deregister from text editor events when it has no subscribers', () => {
    expect(textEventCallbacks.get(fakeTextEditor)).toBe(undefined);
    const callback = jest.fn();
    const disposable = textEventDispatcher.onAnyFileChange(callback);
    expect(textEventCallbacks.get(fakeTextEditor).size).toBeGreaterThan(0);
    disposable.dispose();
    expect(textEventCallbacks.get(fakeTextEditor).size).toBe(0);
  });
});
