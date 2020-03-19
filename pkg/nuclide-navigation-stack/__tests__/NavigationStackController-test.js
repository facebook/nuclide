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
import {NavigationStackController} from '../lib/NavigationStackController';

describe('NavigationStackController test suite', () => {
  let controller: NavigationStackController;

  beforeEach(() => {
    jest
      .spyOn(require('../lib/Location'), 'getPathOfLocation')
      .mockImplementation(location => location.editor.getPath());
    jest
      .spyOn(require('../lib/Location'), 'getLocationOfEditor')
      .mockImplementation(editor => editor.location);
    jest
      .spyOn(require('../lib/Location'), 'editorOfLocation')
      .mockImplementation(location => location.editor);

    controller = new NavigationStackController();
  });

  it('startup activation', () => {
    const editor = toEditor('filename', 10);
    controller.onActivate(editor);
    controller.onActiveStopChanging(editor);

    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([editor.location]);
  });

  it('switch tabs and nav back/forwards', async () => {
    const editor1 = toEditor('filename', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('filename2', 20);
    const location2 = editor2.location;
    controller.onActivate(editor2);
    controller.onActiveStopChanging(editor2);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([location1, location2]);

    // noop nav forwards
    await controller.navigateForwards();
    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([location1, location2]);
    expect(editor1.setCursorBufferPosition).not.toHaveBeenCalled();

    await controller.navigateBackwards();
    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([location1, location2]);
    expect(editor1.setCursorBufferPosition).toHaveBeenCalledWith(
      location1.bufferPosition,
    );

    // noop nav backwards
    await controller.navigateBackwards();
    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([location1, location2]);

    await controller.navigateForwards();
    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([location1, location2]);
    expect(editor2.setCursorBufferPosition).toHaveBeenCalledWith(
      location2.bufferPosition,
    );
  });

  it('update position', () => {
    const editor = toEditor('filename', 10);
    controller.onActivate(editor);
    controller.onActiveStopChanging(editor);

    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([editor.location]);

    setPosition(editor, 11);
    expect(getRow(editor)).toEqual(11);
    controller.updatePosition(editor, toPoint(11));

    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([editor.location]);

    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([editor.location]);
  });

  it('update position of non-top', async () => {
    const editor1 = toEditor('filename', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('filename2', 20);
    const location2 = editor2.location;
    controller.onActivate(editor2);
    controller.onActiveStopChanging(editor2);

    await controller.navigateBackwards();
    setPosition(editor1, 11);
    expect(getRow(editor1)).toEqual(11);
    controller.updatePosition(editor1, toPoint(11));
    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([location1, location2]);
  });

  it('open of closed file', () => {
    const editor1 = toEditor('filename', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('filename2', 21);
    const location2 = editor2.location;
    controller.onCreate(editor2);
    controller.onActivate(editor2);
    controller.onOpen(editor2);
    controller.updatePosition(editor2, toPoint(21));
    controller.onActiveStopChanging(editor2);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([location1, location2]);
  });

  it('open of open file', () => {
    const editor1 = toEditor('filename', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('filename2', 21);
    const location2 = editor2.location;
    controller.onActivate(editor2);
    controller.onOpen(editor2);
    controller.onActiveStopChanging(editor2);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([location1, location2]);
  });

  it('open of open file with move', () => {
    const editor1 = toEditor('filename', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('filename2', 21);
    const location2 = editor2.location;
    controller.onActivate(editor2);
    controller.updatePosition(editor2, toPoint(21));
    controller.onOpen(editor2);
    controller.onActiveStopChanging(editor2);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([location1, location2]);
  });

  it('open of current file', () => {
    const editor = toEditor('filename', 10);
    const startLocation = {...editor.location};
    controller.onActivate(editor);
    controller.onActiveStopChanging(editor);

    setPosition(editor, 11);
    controller.updatePosition(editor, toPoint(11));
    controller.onOpen(editor);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([startLocation, editor.location]);
  });

  it('opt-in navigation', () => {
    const editor = toEditor('filename', 10);
    const startLocation = {...editor.location};
    controller.onActivate(editor);
    controller.onActiveStopChanging(editor);

    setPosition(editor, 11);
    controller.updatePosition(editor, toPoint(11));
    controller.onOptInNavigation(editor);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([startLocation, editor.location]);
  });

  it('removePath', () => {
    const editor1 = toEditor('/a/f1', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('/b/f2', 20);
    controller.onActivate(editor2);
    controller.onActiveStopChanging(editor2);

    controller.removePath('/b', ['/a']);

    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([location1]);
  });

  it('close/open file', () => {
    const editor1 = toEditor('/a/f1', 10);
    const location1 = editor1.location;
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('/b/f2', 20);
    const location2 = editor2.location;
    controller.onActivate(editor2);
    controller.onActiveStopChanging(editor2);

    controller.onDestroy(editor1);

    expect(controller.getIndex()).toEqual(1);
    expect(controller.getLocations()).toEqual([
      {
        type: 'uri',
        uri: '/a/f1',
        bufferPosition: toPoint(10),
      },
      location2,
    ]);

    setPosition(editor1, 11);
    const location3 = editor1.location;
    controller.onCreate(editor1);
    expect(controller.getLocations()).toEqual([
      location1,
      location2,
      location3,
    ]);
  });

  it('close unsaved file', () => {
    const editor1 = toEditor(null, 10);
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);
    const editor2 = toEditor('/b/f2', 20);
    const location2 = editor2.location;
    controller.onActivate(editor2);
    controller.onActiveStopChanging(editor2);

    controller.onDestroy(editor1);

    expect(controller.getIndex()).toEqual(0);
    expect(controller.getLocations()).toEqual([location2]);
  });

  it('close only unsaved file', () => {
    const editor1 = toEditor(null, 10);
    controller.onActivate(editor1);
    controller.onActiveStopChanging(editor1);

    controller.onDestroy(editor1);

    expect(controller.getIndex()).toEqual(-1);
    expect(controller.getLocations()).toEqual([]);
  });

  it('max stack depth', () => {
    const editor = toEditor('filename', 10);
    controller.onActivate(editor);
    controller.onActiveStopChanging(editor);

    let line = 10;
    for (let i = 0; i < 1000; i++) {
      line += 1;
      setPosition(editor, line);
      controller.updatePosition(editor, toPoint(line));
      controller.onOpen(editor);
    }

    expect(controller.getLocations().length).toEqual(100);
  });
});

function toPoint(line: number): any {
  return {
    row: line,
    column: 0,
  };
}

function toEditor(filePath: ?string, line: number) {
  const editor: any = {
    getPath() {
      return filePath;
    },
    location: {
      type: 'editor',
      bufferPosition: toPoint(line),
    },
    setCursorBufferPosition: jest.fn(),
  };
  editor.location.editor = editor;
  return editor;
}

function setPosition(editor, line) {
  editor.location = {
    ...editor.location,
    bufferPosition: toPoint(line),
  };
}

function getRow(editor) {
  return editor.location.bufferPosition.row;
}
