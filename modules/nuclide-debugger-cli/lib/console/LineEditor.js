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

import type {Completions} from './CompletionDialog';
export type {Completions};

import type {Keypress} from 'blessed';

import * as DebugProtocol from 'vscode-debugprotocol';

import EventEmitter from 'events';
import History from './History';
import blessed from 'blessed';
import ScrollBox from './ScrollBox';
import {CompletionsDialog} from './CompletionDialog';
import log4js from 'log4js';

type LineEditorOptions = {
  input?: ?stream$Readable,
  output?: ?stream$Writable,
  tty?: ?boolean,
  maxHistoryItems?: number,
  removeHistoryDuplicates?: boolean,
  historySaveFile?: string,
  useTerminalColors?: boolean,
  logKeystrokes?: boolean,
};

type State = 'RUNNING' | 'STOPPED';

const MAX_SCROLLBACK = 2000;
const STATUS_MESSAGE_TIME = 2000; // hold status messages for 3 seconds

export default class LineEditor extends EventEmitter {
  _fullscreen: boolean = false;
  _options: LineEditorOptions;
  _program: blessed.Program;
  _screen: blessed.Screen;
  _outputBox: ScrollBox; // the box containing the scrollback
  _consoleBox: blessed.Box; // the box containing the being edited command line
  _statusBox: blessed.Box; // status line box
  _completionDialog: CompletionsDialog; // list control for tab completions

  _handlers: Map<string, () => void> = new Map();
  _closeError: ?string = null; // if we're closing on an error, what to print after console is back to normal
  _prompt: string;
  _buffer: string; // the string being edited
  _cursor: number; // the cursor position inside _buffer
  _history: History; // a list of previously entered commands
  _historyTextSave: string; // the string that was being edited before the user starting scrolling through history
  _logger: log4js$Logger; // the logger
  _tty: boolean;
  _input: stream$Readable;
  _output: stream$Writable;
  _state: State = 'STOPPED';
  _disableKeys: boolean = false;
  _logKeystrokes: boolean;
  _logger: log4js$Logger;

  // completion state
  _completions: ?Completions;
  _completionItems: Array<DebugProtocol.CompletionItem> = [];
  _completionStart: number;

  // status bar state
  _statusMessage: string = '';
  _statusMessageTimer: ?TimeoutID;

  constructor(options: LineEditorOptions, logger: log4js$Logger) {
    super();
    this._logger = logger;
    this._tty = options.tty !== false;
    this._options = options;
    this._input = options.input || process.stdin;
    this._output = options.output || process.stdout;
    this._logKeystrokes = options.logKeystrokes === true;
    this._logger = log4js.getLogger('default');
  }

  isTTY(): boolean {
    return this._tty;
  }

  close(error: ?string) {
    this._closeError = error;
    if (this._history != null) {
      this._history.save();
    }
    this.emit('close');
  }

  setPrompt(prompt: string): void {
    this._prompt = prompt;
    if (this._tty && this._fullscreen) {
      this._redrawConsole();
    }
    return;
  }

  setState(state: State) {
    this._state = state;
    if (this._tty && this._fullscreen) {
      this._repaintStatus();
    }
  }

  enterFullScreen(): void {
    if (this._fullscreen) {
      return;
    }

    this._fullscreen = true;

    if (this._tty) {
      this._initializeBlessed(this._options);
      return;
    }

    this._initializeTTY(this._options);
  }

  setCompletions(completions: Completions): void {
    if (this._tty) {
      this._completionDialog.setCompletions(completions);
    }
    this._completions = completions;
  }

  _initializeBlessed(options: LineEditorOptions): void {
    const maxHistoryItems =
      options.maxHistoryItems != null ? options.maxHistoryItems : 50;
    const removeDups =
      options.removeHistoryDuplicates != null
        ? options.removeHistoryDuplicates
        : true;

    this._history = new History(
      maxHistoryItems,
      removeDups,
      options.historySaveFile,
    );
    this._historyTextSave = '';

    this._program = blessed.program({});

    this._screen = blessed.screen({
      smartCSR: true,
      program: this._program,
      input: this._input,
      output: this._output,
    });

    const termColors = options.useTerminalColors === true;

    this._program.showCursor();
    this._outputBox = new ScrollBox({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-2',
      scrollable: true,
      style: termColors
        ? {}
        : {
            fg: 'white',
            bg: 'black',
          },
      wrap: false,
      valign: 'bottom',
      maxScrollBack: MAX_SCROLLBACK,
    });

    this._consoleBox = blessed.box({
      top: '100%-2',
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: termColors
        ? {bold: true}
        : {
            fg: 'green',
            bg: 'black',
          },
      tags: false,
    });

    this._statusBox = blessed.box({
      top: '100%-1',
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: termColors
        ? {inverse: true}
        : {
            fg: 'black',
            bg: 'gray',
          },
      tags: true,
    });

    this._completionDialog = new CompletionsDialog({
      top: 10,
      left: 10,
      width: '25%',
      height: 25,
      keys: true,
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          bg: 'black',
          fg: 'white',
        },
        selected: {
          fg: 'blue',
          bg: 'white',
        },
      },
      border: 'line',
    });

    this._screen.append(this._outputBox);
    this._screen.append(this._consoleBox);
    this._screen.append(this._statusBox);
    this._screen.append(this._completionDialog);
    this._completionDialog.hide();

    this._handlers = new Map([
      ['backspace', () => this._backspace()],
      ['delete', () => this._deleteRight(false)],
      ['down', () => this._historyNext()],
      ['end', () => this._end()],
      ['enter', () => this._enter()],
      ['home', () => this._home()],
      ['left', () => this._left()],
      ['pageup', () => this._pageUp()],
      ['pagedown', () => this._pageDown()],
      ['right', () => this._right()],
      ['space', () => this._inputChar(' ')],
      ['tab', () => this._tab()],
      ['up', () => this._historyPrevious()],
      ['C-home', () => this._topOfOutput()],
      ['C-end', () => this._bottomOfOutput()],
      ['C-left', () => this._wordLeft()],
      ['C-right', () => this._wordRight()],
      ['C-a', () => this._home()],
      ['C-c', () => this._sigint()],
      ['C-d', () => this._deleteRight(true)],
      ['C-e', () => this._end()],
      ['C-h', () => this._backspace()],
      ['C-k', () => this._deleteToEnd()],
      ['C-l', () => this._repaintScreen()],
      ['C-t', () => this._swapChars()],
      ['C-u', () => this._deleteLine()],
      ['C-w', () => this._deleteToStart()],
      ['\x7f', () => this._backspace()],
    ]);

    this._screen.on('keypress', (ch: ?string, key: Keypress) => {
      if (this._logKeystrokes) {
        this._logger.info(`key: ${JSON.stringify(key)}`);
      }

      // turn off keys if a dialog like tab completion is up
      if (this._disableKeys) {
        return;
      }

      // key.name is the base name of a key. For a character with shift/ctrl/etc.,
      // it's still just the character 'a', 'b', 'c', etc.
      // key.full is the name of the key with modifiers. e.g. ctrl-c is 'C-c',
      // shift-c is 'S-c'.
      // key.ctrl, key.shift, etc. are booleans for which modifier keys are down.
      //
      // We don't want to go to the handlers array for normal or shifted
      // characters, but we do want to for control keys.
      if ((key.name != null && key.name.length > 1) || key.ctrl === true) {
        const handler = this._handlers.get(key.full);
        if (handler != null) {
          handler();
        }
        return;
      }

      if (ch != null && ch >= ' ') {
        this._inputChar(ch);
        return;
      }
    });

    this._screen.on('resize', () => {
      this._outputBox.resize();
      this._repaintOutput();
      this._redrawConsole();
    });

    this._program.on('destroy', () => {
      if (this._closeError != null) {
        process.stderr.write(this._closeError);
      }
    });

    this._completionDialog.on('nocompletions', e => this._noCompletions(e));
    this._completionDialog.on('cancel', () => this._completionsCancel());
    this._completionDialog.on('selected_item', item =>
      this._completionsSelect(item),
    );

    this._buffer = '';
    this.setPrompt('$ ');
    this._cursor = 0;
    this._screen.render();
  }

  _initializeTTY(options: LineEditorOptions): void {
    this._input.on('data', data => this._onRawData(data));
    this._input.on('end', _ => this.close());
  }

  _redrawConsole(): void {
    // NB - 5 here gives a little context on the right of the cursor when
    // the user is near the right edge of the screen.
    const available = this._consoleBox.width - this._prompt.length - 5;
    const left = Math.max(0, this._cursor - available);

    const text = this._prompt + this._buffer.substr(left);

    this._consoleBox.setContent(text);
    this._screen.render();
    this._program.move(
      this._prompt.length + this._cursor - left,
      this._consoleBox.top,
    );
  }

  _inputChar(ch: string): void {
    this._logger.info(`Input character ${ch}`);
    this._buffer =
      this._buffer.substr(0, this._cursor) +
      ch +
      this._buffer.substr(this._cursor);
    this._logger.info(`Buffer is now ${this._buffer}`);
    this._cursor++;
    this._textChanged();
    this._redrawConsole();
  }

  _tab(): void {
    if (!this._tty) {
      return;
    }

    this._disableKeys = true;
    this._completionDialog.selectCompletion(this._buffer, this._cursor);
  }

  _noCompletions(e: string): void {
    this._temporaryStatus('No completions in current context.');
    this._disableKeys = false;
  }

  _completionsCancel(): void {
    this._completionDialog.hide();
    this._disableKeys = false;
    this._screen.render();
  }

  _completionsSelect(item: DebugProtocol.CompletionItem): void {
    this._disableKeys = false;

    const text = item.text != null ? item.text : item.label;

    let wordStart = this._buffer.lastIndexOf(' ', this._cursor) + 1;

    while (
      wordStart < this._buffer.length &&
      !text.startsWith(this._buffer.substr(wordStart))
    ) {
      wordStart++;
    }

    this._buffer = this._buffer.substr(0, wordStart) + text;
    this._cursor = this._buffer.length;

    this._redrawConsole();
  }

  _sigint(): void {
    this.emit('SIGINT');
  }

  _enter(): void {
    this.write(`${this._prompt}${this._buffer}\n`);
    this._history.addItem(this._buffer);
    this.emit('line', this._buffer);
    this._buffer = '';
    this._cursor = 0;
    this._textChanged();
    this._redrawConsole();
  }

  _left(): void {
    if (this._cursor > 0) {
      this._cursor--;
      this._redrawConsole();
    }
  }

  _right(): void {
    if (this._cursor < this._buffer.length) {
      this._cursor++;
      this._redrawConsole();
    }
  }

  _home(): void {
    this._cursor = 0;
    this._redrawConsole();
  }

  _end(): void {
    this._cursor = this._buffer === '' ? 0 : this._buffer.length;
    this._redrawConsole();
  }

  _deleteToEnd(): void {
    if (this._cursor < this._buffer.length) {
      this._buffer = this._buffer.substr(0, this._cursor);
      this._textChanged();
      this._redrawConsole();
    }
  }

  _deleteToStart(): void {
    if (this._cursor > 0) {
      this._buffer = this._buffer.substr(this._cursor);
      this._cursor = 0;
      this._textChanged();
      this._redrawConsole();
    }
  }

  _deleteLine(): void {
    if (this._buffer !== '') {
      this._buffer = '';
      this._cursor = 0;
      this._textChanged();
      this._redrawConsole();
    }
  }

  _backspace(): void {
    if (this._cursor > 0) {
      this._buffer =
        this._buffer.substr(0, this._cursor - 1) +
        this._buffer.substr(this._cursor);
      this._cursor--;
      this._textChanged();
      this._redrawConsole();
    }
  }

  _deleteRight(eofOnEmpty: boolean): void {
    if (this._buffer === '' && eofOnEmpty) {
      this.close();
      return;
    }

    if (this._cursor < this._buffer.length) {
      this._buffer =
        this._buffer.substr(0, this._cursor) +
        this._buffer.substr(this._cursor + 1);
      this._textChanged();
      this._redrawConsole();
    }
  }

  _wordLeft(): void {
    if (this._cursor === 0) {
      return;
    }

    while (this._buffer[this._cursor - 1] === ' ') {
      this._cursor--;
    }

    while (this._cursor > 0 && this._buffer[this._cursor - 1] !== ' ') {
      this._cursor--;
    }

    this._redrawConsole();
  }

  _wordRight(): void {
    if (this._cursor === this._buffer.length) {
      return;
    }

    while (this._buffer[this._cursor + 1] === ' ') {
      this._cursor++;
    }

    while (
      this._cursor < this._buffer.length &&
      this._buffer[this._cursor + 1] !== ' '
    ) {
      this._cursor++;
    }

    // word-right is expected to land on the space following the word.
    if (this._cursor < this._buffer.length) {
      this._cursor++;
    }

    this._redrawConsole();
  }

  _swapChars(): void {
    if (this._cursor === 0 || this._buffer.length < 2) {
      return;
    }

    if (this._cursor === this._buffer.length) {
      this._cursor--;
    }

    this._buffer =
      this._buffer.substr(0, this._cursor - 1) +
      this._buffer.substr(this._cursor, 1) +
      this._buffer.substr(this._cursor - 1, 1) +
      this._buffer.substr(this._cursor + 1);

    this._cursor++;
    this._textChanged();
    this._redrawConsole();
  }

  _pageUp() {
    this._outputBox.pageUp();
    this._repaintOutput();
  }

  _pageDown() {
    this._outputBox.pageDown();
    this._repaintOutput();
  }

  _repaintScreen() {
    this._screen.realloc();
    this._repaintOutput();
    this._repaintStatus();
    this._redrawConsole();
  }

  _topOfOutput() {
    this._outputBox.scrollToTop();
    this._repaintOutput();
  }

  _bottomOfOutput() {
    this._outputBox.scrollToBottom();
    this._repaintOutput();
  }

  write(s: string): void {
    this._logger.info(`output [${s}]\n`);
    if (!this._tty || !this._fullscreen) {
      this._output.write(s);
      return;
    }

    this._outputBox.write(s);
    this._repaintOutput();
  }

  async prompt(): Promise<void> {
    if (!this._tty) {
      this._output.write(this._prompt);
    }
  }

  _historyPrevious(): void {
    const item = this._history.previousItem();
    if (item != null) {
      this._buffer = item;
      this._cursor = item.length;
      this._redrawConsole();
    }
  }

  _historyNext(): void {
    const item = this._history.nextItem();
    if (item != null) {
      this._buffer = item;
      this._cursor = item.length;
    } else {
      this._buffer = this._historyTextSave;
      this._cursor = this._buffer.length;
    }
    this._redrawConsole();
  }

  _textChanged(): void {
    this._historyTextSave = this._buffer;
    this._history.resetSearch();
  }

  _repaintOutput(): void {
    this._repaintStatus();
    this._screen.render();
  }

  _temporaryStatus(message: string): void {
    if (this._statusMessageTimer != null) {
      clearTimeout(this._statusMessageTimer);
    }
    this._statusMessage = message;
    this._repaintStatus();

    this._statusMessageTimer = setTimeout(() => {
      this._statusMessage = '';
      this._repaintStatus();
    }, STATUS_MESSAGE_TIME);
  }

  _repaintStatus(): void {
    const statusEmpty = '       ';
    const statusBottom = 'BOTTOM ';
    const statusMore = 'MORE...';

    const lpad = (str: string, width: number) =>
      (str + ' '.repeat(width)).substr(0, width);

    const lastLine = this._outputBox.lastLine();
    const scroll = `Lines ${this._outputBox.topLine() +
      1}-${lastLine} of ${this._outputBox.lines()}`;

    const state =
      this._state === 'RUNNING'
        ? '{green-fg}RUNNING{/green-fg}'
        : '{red-fg}STOPPED{/red-fg}';

    const where = this._outputBox.moreOutput()
      ? statusMore
      : this._outputBox.atBottom()
        ? statusBottom
        : statusEmpty;

    this._statusBox.setContent(
      `${this._statusMessage}{|}| ${lpad(scroll, 30)} | ${state} | ${where}`,
    );
    this._screen.render();
  }

  // non-tty support
  _onRawData(data: Buffer): void {
    data
      .toString('utf8')
      .trim()
      .split('\n')
      .forEach(line => this.emit('line', line));
  }
}
