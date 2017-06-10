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

import type CommandDispatcherType from '../lib/CommandDispatcher';
import type {IPCEvent} from '../lib/types';

import {Subject} from 'rxjs';
import invariant from 'assert';
import DebuggerModel from '../lib/DebuggerModel';
import * as utils from './utils';

describe('Bridge', () => {
  let debuggerModel;
  let breakpointStore;
  let bridge;
  let editor;
  let mockDispatcher: CommandDispatcherType;
  let mockEvent$: Subject<IPCEvent>;
  let path;

  function getCallFrameDecorationInRow(row: number): ?atom$Decoration {
    const decorationArrays = editor.decorationsForScreenRowRange(row, row);
    for (const key in decorationArrays) {
      const result = decorationArrays[key].find(
        item => item.getProperties().class === 'nuclide-current-line-highlight',
      );
      if (result !== undefined) {
        return result;
      }
    }
    return null;
  }

  function getCursorInRow(row: number): ?atom$Cursor {
    let result = null;
    const cursors = editor.getCursors();
    cursors.forEach(cursor => {
      if (cursor.getBufferRow() === row) {
        result = cursor;
      }
    });
    return result;
  }

  function sendIpcNotification(...args: any[]) {
    mockEvent$.next({
      channel: 'notification',
      args,
    });
  }

  beforeEach(() => {
    waitsForPromise(async () => {
      editor = await utils.createEditorWithUniquePath();
      // Feed 30 lines to editor
      editor.setText('foo\nbar\nbaz'.repeat(10));
      const editorPath = editor.getPath();
      invariant(editorPath);
      path = editorPath;

      mockDispatcher = ((jasmine.createSpyObj('commandDispatcher', [
        'send',
        'getEventObservable',
        'isNewChannel',
      ]): any): CommandDispatcherType);
      mockEvent$ = new Subject();
      // $FlowFixMe override instance methods.
      mockDispatcher.getEventObservable = jasmine
        .createSpy('getEventObservable')
        .andReturn(mockEvent$.asObservable());
      spyOn(require('../lib/CommandDispatcher'), 'default').andReturn(
        mockDispatcher,
      );
      // $FlowFixMe override instance methods.
      mockDispatcher.isNewChannel = jasmine
        .createSpy('isNewChannel')
        .andReturn(false);

      debuggerModel = new DebuggerModel();
      bridge = debuggerModel.getBridge();
      breakpointStore = debuggerModel.getBreakpointStore();
      spyOn(breakpointStore, '_addBreakpoint').andCallThrough();
      spyOn(breakpointStore, '_bindBreakpoint').andCallThrough();
      spyOn(breakpointStore, '_deleteBreakpoint').andCallThrough();
      bridge.enterDebugMode();
      bridge.enableEventsListening();
    });
    runs(() => {
      sendIpcNotification('CallFrameSelected', {
        sourceURL: 'file://' + path,
        lineNumber: 1,
      });
    });
  });

  it('should add decoration to line of current call frame', () => {
    waitsFor(
      () => {
        return Boolean(getCallFrameDecorationInRow(1));
      },
      'call frame highlight to appear',
      100,
    );

    runs(() => {
      expect(getCallFrameDecorationInRow(1)).toBeTruthy();
    });
  });

  it('should send breakpoints over ipc when breakpoints change', () => {
    breakpointStore._addBreakpoint('/tmp/foobarbaz.js', 4);
    expect(mockDispatcher.send).toHaveBeenCalledWith('AddBreakpoint', {
      sourceURL: 'file:///tmp/foobarbaz.js',
      lineNumber: 4,
      condition: '',
      enabled: true,
    });
  });

  it('should send execution control commands over ipc', () => {
    bridge.continue();
    expect(mockDispatcher.send).toHaveBeenCalledWith('Continue');

    bridge.stepOver();
    expect(mockDispatcher.send).toHaveBeenCalledWith('StepOver');

    bridge.stepInto();
    expect(mockDispatcher.send).toHaveBeenCalledWith('StepInto');

    bridge.stepOut();
    expect(mockDispatcher.send).toHaveBeenCalledWith('StepOut');
  });

  it('should move cursor to target line when open source location', () => {
    const line = 13;
    sendIpcNotification('OpenSourceLocation', {
      sourceURL: 'file://' + path,
      lineNumber: line,
    });

    waitsFor(
      () => {
        return Boolean(getCursorInRow(line));
      },
      'cursor at line to appear',
      100,
    );

    runs(() => {
      expect(editor.getCursorBufferPosition().row).toEqual(line);
    });
  });

  it('should change BreakpointStore when getting add/remove breakpoints notification', () => {
    const line = 15;
    const condition = 'Condtion expression';
    const enabled = true;
    const resolved = true;
    sendIpcNotification('BreakpointAdded', {
      sourceURL: 'file://' + path,
      lineNumber: line,
      condition,
      enabled,
      resolved,
    });
    expect(breakpointStore._bindBreakpoint).toHaveBeenCalledWith(
      path,
      line,
      condition,
      enabled,
      resolved,
    );

    sendIpcNotification('BreakpointRemoved', {
      sourceURL: 'file://' + path,
      lineNumber: line,
    });
    expect(breakpointStore._deleteBreakpoint).toHaveBeenCalledWith(
      path,
      line,
      false,
    );
  });
});
