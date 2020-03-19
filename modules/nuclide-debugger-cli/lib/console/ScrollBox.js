/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import type {ElementOptions} from 'blessed';

import blessed from 'blessed';

type ScrollBoxOptions = {
  ...ElementOptions,
  maxScrollBack?: number,
};

export default class ScrollBox extends blessed.widget.Box {
  _maxScrollBack: number; // max number of non-split console lines we'll keep
  _boxTop: number; // index of line at top of control, in _splitLines
  _boxBottom: boolean; // true if we're at the bottom, tailing the input
  _lines: Array<string>; // unsplit lines as they are written into the control
  _splitLines: Array<string>; // lines, split to fit window width
  _splitToLines: Array<number>; // map: split line back to owning unsplit line
  _linesToSplit: Array<number>; // map: unsplit line to first split line
  _more: boolean; // true if there's more input at the bottom that user hasn't seen
  _nextOutputSameLine: boolean; // true if the next output should be on the same line (no ending \n)

  constructor(options: ScrollBoxOptions) {
    super(options);

    const maxScrollBack = options.maxScrollBack;
    // $FlowFixMe maxScrollback is fine here with a null check but flow is upset
    this._maxScrollBack = maxScrollBack != null ? maxScrollBack : 2000;
    this._boxTop = 0;
    this._boxBottom = true;
    this._lines = [];
    this._splitLines = [];
    this._splitToLines = [];
    this._linesToSplit = [];
    this._more = false;
    this._nextOutputSameLine = false;
  }

  atTop(): boolean {
    return this._boxTop === 0;
  }

  atBottom(): boolean {
    return this._boxBottom;
  }

  moreOutput(): boolean {
    return this._more;
  }

  // it's simpler to preset the user with screen line #'s than
  // unsplit line #'s.
  topLine(): number {
    return this._boxTop;
  }

  lastLine(): number {
    return Math.min(this._boxTop + this.height, this._splitLines.length);
  }

  lines(): number {
    return this._splitLines.length;
  }

  resize(): void {
    this._rebuildSplitLines();
    this._recomputeContents();
  }

  write(s: string): void {
    const trailingNewline = s.endsWith('\n');
    const lines = s.split('\n');

    if (trailingNewline) {
      lines.splice(-1);
    }

    if (lines.length === 0) {
      return;
    }

    const maxWidth = this.width - 1;

    const addLine = (newLastLine: string): void => {
      const lastLineIdx = this._lines.length;
      this._lines.push(newLastLine);
      this._linesToSplit.push(this._splitLines.length);

      // don't lose blank lines
      if (newLastLine === '') {
        this._splitLines.push(newLastLine);
        this._splitToLines.push(lastLineIdx);
        return;
      }

      // eslint-disable-next-line space-in-parens
      for (let start = 0; newLastLine.length > start; ) {
        const toUse = Math.min(maxWidth, newLastLine.length - start);
        this._splitLines.push(newLastLine.substr(start, toUse));
        this._splitToLines.push(lastLineIdx);
        start += toUse;
      }
    };

    if (this._nextOutputSameLine && this._lines.length !== 0) {
      const lastLineIdx = this._lines.length - 1;
      const lastSplitIdx = this._linesToSplit[lastLineIdx];
      const newLastLine = this._lines[lastLineIdx] + lines[0];

      // remove current last line
      this._lines.pop();
      this._linesToSplit.pop();
      this._splitLines = this._splitLines.slice(0, lastSplitIdx);
      this._splitToLines = this._splitToLines.slice(0, lastSplitIdx);

      addLine(newLastLine);

      lines.shift();
    }

    lines.forEach(line => addLine(line));

    if (this.lines.length > this._maxScrollBack) {
      const linesToDelete = this.lines.length - this._maxScrollBack;
      const splitsToDelete = this._linesToSplit[linesToDelete];

      this._lines = this._lines.slice(linesToDelete);
      this._linesToSplit = this._linesToSplit.slice(linesToDelete);
      this._splitLines = this._splitLines.slice(splitsToDelete);
      this._splitToLines = this._splitToLines.splice(splitsToDelete);

      // Fix up the indices to account for the deleted lines
      this._linesToSplit = this._linesToSplit.map(
        i => i - this._linesToSplit[0],
      );
      this._splitToLines = this._splitToLines.map(
        i => i - this._splitToLines[0],
      );

      // if we're not at the bottom, adjust the top
      this._boxTop = Math.max(0, this._boxTop - linesToDelete);
    }

    this._nextOutputSameLine = !trailingNewline;

    if (!this._boxBottom) {
      this._more = true;
    }

    this._recomputeContents();
  }

  pageUp(): void {
    this._boxTop = Math.max(0, this._boxTop - this.height + 1);
    this._updateScrollFlags();
    this._recomputeContents();
  }

  pageDown(): void {
    this._boxTop = Math.min(
      this._splitLines.length - this.height,
      this._boxTop + this.height - 1,
    );
    this._updateScrollFlags();
    this._recomputeContents();
  }

  scrollToTop(): void {
    this._boxTop = 0;
    this._updateScrollFlags();
    this._recomputeContents();
  }

  scrollToBottom(): void {
    this._boxTop = Math.max(0, this._splitLines.length - this.height);
    this._updateScrollFlags();
    this._recomputeContents();
  }

  _updateScrollFlags(): void {
    this._boxBottom = this._splitLines.length - this._boxTop <= this.height;
    if (this._boxBottom) {
      this._more = false;
    }
  }

  _recomputeContents() {
    // if we're pinned to the bottom, recompute the top
    if (this._boxBottom) {
      this._boxTop = Math.max(0, this._splitLines.length - this.height);
    }

    this.setContent(
      this._splitLines
        .slice(this._boxTop, this._boxTop + this.height)
        .join('\n'),
    );
  }

  _rebuildSplitLines(): void {
    const top = this._splitToLines[this._boxTop];

    this._splitLines = [];
    this._splitToLines = [];
    this._linesToSplit = [];

    const maxWidth = this.width - 1;

    this._lines.forEach((line, idx) => {
      this._linesToSplit.push(this._splitLines.length);

      // don't lose blank lines
      if (line === '') {
        this._splitLines.push(line);
        this._splitToLines.push(idx);
        return;
      }

      // eslint-disable-next-line space-in-parens
      for (let start = 0; line.length > start; ) {
        const toUse = Math.min(maxWidth, line.length - start);
        this._splitLines.push(line.substr(start, toUse));
        this._splitToLines.push(idx);
        start += toUse;
      }
    });

    // if we're tailing the bottom, recomputeContents will fix the top up.
    // otherwise, try to stay on about the same line.
    if (!this.atBottom()) {
      this._boxTop = this._linesToSplit[top];
    }
  }
}
