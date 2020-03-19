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
import openPreview from '../openPreview';
import fsPromise from 'nuclide-commons/fsPromise';
import invariant from 'assert';

function getActiveTextEditor(): atom$TextEditor {
  const activeTextEditor = atom.workspace.getActiveTextEditor();
  invariant(activeTextEditor);
  return activeTextEditor;
}

function getPendingItem(): atom$PaneItem {
  const pane = atom.workspace.paneForItem(getActiveTextEditor());
  invariant(pane);
  return pane.getPendingItem();
}

describe('openPreview', () => {
  // replace Jasmine's mocked setTimeout with another mock which immediately
  // fires the callback. This is to mock the delay after requesting a preview.
  let oldSetTimeout;
  beforeEach(() => {
    oldSetTimeout = window.setTimeout;
    window.setTimeout = fn => fn();
  });

  afterEach(() => {
    window.setTimeout = oldSetTimeout;
  });

  describe('previewing within the same file', () => {
    let file;
    let fileItem;
    beforeEach(async () => {
      file = await fsPromise.tempfile();
      await fsPromise.writeFile(file, 'foobarbaz\n'.repeat(1000));
      fileItem = await atom.workspace.open(file);
    });

    afterEach(() => {
      fsPromise.unlink(file);
    });

    it('does not change the cursor position', async () => {
      expect(getActiveTextEditor().getURI()).toEqual(file);
      expect(getActiveTextEditor().getCursorBufferPosition()).toEqual({
        row: 0,
        column: 0,
      });

      await openPreview(file, {
        line: 700,
        column: 3,
        center: true,
      })._promise;

      // this case shouldn't open any new editors
      expect(getActiveTextEditor()).toBe(fileItem);

      // Neither the file path nor the cursor position technically change as
      // this preview is not yet confirmed
      expect(getActiveTextEditor().getURI()).toEqual(file);
      expect(getActiveTextEditor().getCursorBufferPosition()).toEqual({
        row: 0,
        column: 0,
      });
    });
  });

  describe('opening a preview of a different file', () => {
    let startingFile;
    let previewingFile;

    beforeEach(async () => {
      [startingFile, previewingFile] = await Promise.all([
        fsPromise.tempfile(),
        fsPromise.tempfile(),
      ]);
      await atom.workspace.open(startingFile);
    });

    afterEach(async () => {
      await (() =>
        Promise.all([
          fsPromise.unlink(startingFile),
          fsPromise.unlink(previewingFile),
        ]))();
    });

    it('opens a preview pane editor pointed at the previewFile', async () => {
      expect(getActiveTextEditor().getURI()).toEqual(startingFile);
      expect(getActiveTextEditor().getCursorBufferPosition()).toEqual({
        row: 0,
        column: 0,
      });

      await openPreview(previewingFile)._promise;
      expect(getActiveTextEditor().getURI()).toBe(previewingFile);
      // $FlowFixMe
      expect(getPendingItem().getURI()).toBe(previewingFile);
    });

    it('leaves focus on the starting editor', async () => {
      expect(getActiveTextEditor().getURI()).toEqual(startingFile);
      expect(getActiveTextEditor().getCursorBufferPosition()).toEqual({
        row: 0,
        column: 0,
      });

      await openPreview(previewingFile)._promise;
      expect(getActiveTextEditor().getURI()).toEqual(previewingFile);
    });
  });

  describe('with multiple previews', () => {
    let startingFile;
    let firstPreviewingFile;
    let secondPreviewingFile;

    beforeEach(async () => {
      [
        startingFile,
        firstPreviewingFile,
        secondPreviewingFile,
      ] = await Promise.all([
        fsPromise.tempfile(),
        fsPromise.tempfile(),
        fsPromise.tempfile(),
      ]);
      await atom.workspace.open(startingFile);
    });

    afterEach(async () => {
      await (() =>
        Promise.all([
          fsPromise.unlink(startingFile),
          fsPromise.unlink(firstPreviewingFile),
          fsPromise.unlink(secondPreviewingFile),
        ]))();
    });

    it('reuses the preview pane when openPreview is called multiple times', async () => {
      await openPreview(firstPreviewingFile)._promise;
      const firstPendingItem = getPendingItem();
      // $FlowFixMe
      expect(getPendingItem().getURI()).toBe(firstPreviewingFile);

      await openPreview(secondPreviewingFile)._promise;
      const secondPendingItem = getPendingItem();
      // $FlowFixMe
      expect(getPendingItem().getURI()).toBe(secondPreviewingFile);

      // $FlowFixMe
      expect(firstPendingItem.isDestroyed()).toBe(true);
      // $FlowFixMe
      expect(secondPendingItem.isDestroyed()).toBe(false);
      expect(getPendingItem()).toBe(secondPendingItem);
      expect(secondPendingItem).toBe(getActiveTextEditor());
    });

    it('destroys all previews once an openable is confirmed', async () => {
      await openPreview(firstPreviewingFile)._promise;
      const firstPendingItem = getPendingItem();
      const secondOpenable = openPreview(secondPreviewingFile);
      await secondOpenable._promise;
      const secondPendingItem = getPendingItem();

      await secondOpenable.confirm();

      // $FlowFixMe
      expect(firstPendingItem.isDestroyed()).toBe(true);
      // $FlowFixMe
      expect(secondPendingItem.isDestroyed()).toBe(false);
      expect(getPendingItem()).toBeNull();
      expect(secondPendingItem).toBe(getActiveTextEditor());
    });
  });

  it('never reuses a non-pending pane', async () => {
    const [startingFile, file1, file2] = await Promise.all([
      fsPromise.tempfile(),
      fsPromise.tempfile(),
      fsPromise.tempfile(),
    ]);
    await atom.workspace.open(startingFile);

    await openPreview(file1)._promise;
    // Open a preview back in the originating file, which is not pending
    await openPreview(startingFile)._promise;
    expect(getActiveTextEditor()).not.toBe(getPendingItem());

    // ...and make sure requesting a new preview does *not* reuse the original
    // file's pane item
    await openPreview(file2)._promise;
    expect(getActiveTextEditor()).toBe(getPendingItem());

    await Promise.all([
      fsPromise.unlink(startingFile),
      fsPromise.unlink(file1),
      fsPromise.unlink(file2),
    ]);
  });

  it('throws when trying to confirm a preview that is not the latest', async () => {
    const [file1, file2] = await Promise.all([
      fsPromise.tempfile(),
      fsPromise.tempfile(),
    ]);

    const preview1 = openPreview(file1);
    openPreview(file2);

    expect(() => preview1.confirm()).toThrow();

    await Promise.all([fsPromise.unlink(file1), fsPromise.unlink(file2)]);
  });

  it('throws when calling confirm after cancel', async () => {
    const file = await fsPromise.tempfile();
    const preview = openPreview(file);
    preview.cancel();
    expect(() => preview.confirm()).toThrow();

    await fsPromise.unlink(file);
  });

  it('throws when calling cancel after confirm', async () => {
    const file = await fsPromise.tempfile();
    const preview = openPreview(file);
    preview.confirm();
    expect(() => preview.cancel()).toThrow();

    await fsPromise.unlink(file);
  });
});
