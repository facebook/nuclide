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

import invariant from 'assert';
import {Emitter} from 'atom';
import {shell, clipboard} from 'electron';
import {fastDebounce} from 'nuclide-commons/observable';
import {Observable} from 'rxjs';
import url from 'url';
import Terminal from 'xterm';

import {getPtyServiceByNuclideUri} from '../../nuclide-remote-connection';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {observeElementDimensions} from '../../commons-atom/observe-element-dimensions';
import performanceNow from 'nuclide-commons/performanceNow';
import {
  infoFromUri,
  uriFromInfo,
} from '../../commons-node/nuclide-terminal-uri';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {
  RemoteConnection,
  ServerConnection,
} from '../../nuclide-remote-connection';
import {spawn} from '../../nuclide-pty-rpc';
import {track} from '../../nuclide-analytics';

import {removePrefixSink, patternCounterSink} from './sink';

import type {IconName} from 'nuclide-commons-ui/Icon';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  Command,
  Pty,
  PtyClient,
  PtyInfo,
} from '../../nuclide-pty-rpc/rpc-types';

import type {Sink} from './sink';
import type {TerminalInfo} from '../../commons-node/nuclide-terminal-uri';

const RESIZE_EVENT_DEBOUNCE_MS = 100;
const PRESERVED_COMMANDS_CONFIG = 'nuclide-terminal.preservedCommands';
const SCROLLBACK_CONFIG = 'nuclide-terminal.scrollback';
const CURSOR_STYLE_CONFIG = 'nuclide-terminal.cursorStyle';
const CURSOR_BLINK_CONFIG = 'nuclide-terminal.cursorBlink';
const ADD_ESCAPE_COMMAND = 'nuclide-terminal:add-escape-prefix';
const TMUX_CONTROLCONTROL_PREFIX = '\x1BP1000p';
export const URI_PREFIX = 'atom://nuclide-terminal-view';

export interface TerminalViewState {
  deserializer: 'TerminalView',
  paneUri: string,
}

type ProcessExitCallback = () => void;

export class TerminalView implements PtyClient {
  _paneUri: string;
  _cwd: ?NuclideUri;
  _command: ?Command;
  _title: string;
  _subscriptions: UniversalDisposable;
  _emitter: Emitter;
  _preservedCommands: Set<string>;
  _div: HTMLDivElement;
  _terminal: Object;
  _pty: ?Pty;
  _processOutput: Sink;
  _startTime: number;
  _bytesIn: number;
  _bytesOut: number;
  _focusStart: ?number;
  _focusDuration: number;
  _terminalInfo: TerminalInfo;
  _processExitCallback: ProcessExitCallback;

  constructor(paneUri: string) {
    this._paneUri = paneUri;
    const info = infoFromUri(paneUri);
    this._terminalInfo = info;
    const cwd = (this._cwd = info.cwd == null ? null : info.cwd);
    this._command = info.command == null ? null : info.command;
    this._title = info.title == null ? 'terminal' : info.title;
    this._processExitCallback = () => {};

    this._startTime = performanceNow();
    this._bytesIn = 0;
    this._bytesOut = 0;
    this._focusStart = null;
    this._focusDuration = 0;

    const subscriptions = (this._subscriptions = new UniversalDisposable());
    this._processOutput = this._createOutputSink();

    this._emitter = new Emitter();
    subscriptions.add(this._emitter);

    subscriptions.add(
      featureConfig
        .observeAsStream(PRESERVED_COMMANDS_CONFIG)
        .subscribe((preserved: any) => {
          this._preservedCommands = new Set([
            ...(preserved || []),
            ...(info.preservedCommands || []),
          ]);
        }),
      atom.config.onDidChange(
        'editor.fontSize',
        this._syncAtomStyle.bind(this),
      ),
      atom.config.onDidChange(
        'editor.fontFamily',
        this._syncAtomStyle.bind(this),
      ),
      atom.config.onDidChange(
        'editor.lineHeight',
        this._syncAtomStyle.bind(this),
      ),
    );

    const div = (this._div = document.createElement('div'));
    div.classList.add('terminal-pane');
    subscriptions.add(() => div.remove());

    const terminal = (this._terminal = new Terminal({
      cols: 512,
      rows: 512,
      cursorBlink: featureConfig.get(CURSOR_BLINK_CONFIG),
      cursorStyle: featureConfig.get(CURSOR_STYLE_CONFIG),
      scrollback: featureConfig.get(SCROLLBACK_CONFIG),
    }));
    terminal.open(this._div, false);
    terminal.attachCustomKeyEventHandler(
      this._checkIfKeyBoundOrDivertToXTerm.bind(this),
    );
    this._subscriptions.add(() => terminal.destroy());
    registerLinkHandlers(terminal);

    this._subscriptions.add(
      atom.commands.add(div, 'core:copy', () => {
        document.execCommand('copy');
      }),
      atom.commands.add(div, 'core:paste', () => {
        document.execCommand('paste');
      }),
      atom.commands.add(
        div,
        ADD_ESCAPE_COMMAND,
        this._addEscapePrefix.bind(this),
      ),
      atom.commands.add(div, 'nuclide-terminal:clear', this._clear.bind(this)),
      featureConfig
        .observeAsStream(CURSOR_STYLE_CONFIG)
        .skip(1)
        .subscribe(cursorStyle =>
          terminal.setOption('cursorStyle', cursorStyle),
        ),
      featureConfig
        .observeAsStream(CURSOR_BLINK_CONFIG)
        .skip(1)
        .subscribe(cursorBlink =>
          terminal.setOption('cursorBlink', cursorBlink),
        ),
      featureConfig
        .observeAsStream(SCROLLBACK_CONFIG)
        .skip(1)
        .subscribe(scrollback => terminal.setOption('scrollback', scrollback)),
    );

    if (process.platform === 'win32') {
      // On Windows, add Putty-style highlight and right click to copy, right click to paste.
      this._subscriptions.add(
        Observable.fromEvent(div, 'contextmenu').subscribe(e => {
          // Note: Manipulating the clipboard directly because atom's core:copy and core:paste
          // commands are not working correctly with terminal selection.
          if (terminal.hasSelection()) {
            // $FlowFixMe: add types for clipboard
            clipboard.writeText(terminal.selectionManager.selectionText);
          } else {
            document.execCommand('paste');
          }
          terminal.selectionManager.clearSelection();
          terminal.focus();
          e.stopPropagation();
        }),
      );
    }

    if (cwd != null && nuclideUri.isRemote(cwd)) {
      this._subscriptions.add(
        ServerConnection.onDidCloseServerConnection(connection => {
          if (nuclideUri.getHostname(cwd) === connection.getRemoteHostname()) {
            this._closeTab();
          }
        }),
      );
    }

    // div items don't support a 'focus' event, and we need to forward.
    (this._div: any).focus = () => terminal.focus();
    (this._div: any).blur = () => terminal.blur();

    this._spawn(cwd);
  }

  _spawn(cwd: ?NuclideUri): void {
    const command = this._command;
    const info: PtyInfo = {
      terminalType: 'xterm-256color',
      environment: this._terminalInfo.environmentVariables,
      ...(command == null ? {} : {command}),
    };
    if (
      cwd == null ||
      nuclideUri.isLocal(cwd) ||
      RemoteConnection.getByHostname(nuclideUri.getHostname(cwd)).length > 0
    ) {
      const promise =
        cwd == null
          ? spawn(info, this)
          : getPtyServiceByNuclideUri(cwd).spawn(
              {...info, cwd: nuclideUri.getPath(cwd)},
              this,
            );
      promise
        .then(pty => this._onPtyFulfill(pty))
        .catch(error => this._onPtyFail(error));
    } else {
      // If the remote connection is not ready, retry when we see a new connection.
      const subscription = RemoteConnection.onDidAddRemoteConnection(
        connection => {
          if (RemoteConnection.getForUri(cwd) != null) {
            this._subscriptions.remove(subscription);
            subscription.dispose();
            this._spawn(cwd);
          }
        },
      );
      this._subscriptions.add(subscription);
    }
  }

  _onPtyFulfill(pty: Pty): void {
    invariant(this._pty == null);
    this._pty = pty;

    const now = performanceNow();
    this._focusStart = now;
    track('nuclide-terminal.started', {
      pane: this._paneUri,
      uri: this._cwd,
      startDelay: Math.round(now - this._startTime),
    });

    this._subscriptions.add(
      this.dispose.bind(this),
      Observable.merge(
        Observable.fromEvent(this._terminal, 'focus'),
        Observable.fromEvent(window, 'resize'),
        observeElementDimensions(
          (this._div.querySelector('.xterm-viewport'): any),
        ),
      )
        .let(fastDebounce(RESIZE_EVENT_DEBOUNCE_MS))
        .subscribe(() => this._fitAndResize()),
      Observable.fromEvent(this._terminal, 'data').subscribe(
        this._onInput.bind(this),
      ),
      Observable.fromEvent(this._terminal, 'title').subscribe(
        this._setTitle.bind(this),
      ),
      Observable.interval(10 * 1000)
        .startWith(0)
        .map(() => atom.workspace.paneForItem(this))
        .filter(pane => pane != null)
        .first()
        .switchMap(pane => {
          invariant(pane != null);
          return observableFromSubscribeFunction(
            pane.onDidChangeFlexScale.bind(pane),
          );
        })
        .subscribe(this._syncAtomStyle.bind(this)),
      Observable.interval(60 * 60 * 1000).subscribe(() =>
        track('nuclide-terminal.hourly', this._statistics()),
      ),
      Observable.fromEvent(this._terminal, 'focus').subscribe(
        this._focused.bind(this),
      ),
      Observable.fromEvent(this._terminal, 'blur').subscribe(
        this._blurred.bind(this),
      ),
    );
  }

  _focused(): void {
    if (this._focusStart == null) {
      this._focusStart = performanceNow();
    }
  }

  _blurred(): void {
    const focusStart = this._focusStart;
    if (focusStart != null) {
      this._focusStart = null;
      this._focusDuration += performanceNow() - focusStart;
    }
  }

  _statistics(): Object {
    const now = performanceNow();
    const focusStart = this._focusStart;
    const focusDuration =
      this._focusDuration + (focusStart == null ? 0 : now - focusStart);
    const {query} = url.parse(this._paneUri, true);
    const id = query == null ? null : query.unique;

    return {
      id,
      uri: this._cwd,
      focusDuration: Math.round(focusDuration),
      duration: Math.round(now - this._startTime),
      bytesIn: this._bytesIn,
      bytesOut: this._bytesOut,
    };
  }

  _onPtyFail(error: Error) {
    this._terminal.writeln('Error starting process:');
    for (const line of String(error).split('\n')) {
      this._terminal.writeln(line);
    }
    track('nuclide-terminal.failed', {
      pane: this._paneUri,
      uri: this._cwd,
      startDelay: Math.round(performanceNow() - this._startTime),
      error: String(error),
    });
  }

  // Our Activation updates the global style sheet in response to the same config
  // changes we are listening to.  We need to ensure the style sheet is in place
  // before we measure and resize, so we setTimeout to run on the tick after config
  // notifications go out.
  _syncAtomStyle(): void {
    setTimeout(this._fitAndResize.bind(this), 0);
  }

  _fitAndResize(): void {
    // The 'fit' add-on resizes the terminal based on the container size
    // and the font size such that the terminal fills the container.
    Terminal.loadAddon('fit');
    this._terminal.fit();
    if (this._pty != null) {
      this._pty.resize(this._terminal.cols, this._terminal.rows);
    }
  }

  _clear(): void {
    this._terminal.clear();
  }

  _onInput(data: string): void {
    if (this._pty != null) {
      this._bytesIn += data.length;
      this._pty.writeInput(data);
    }
  }

  _setTitle(title: string) {
    this._title = title;
    this._emitter.emit('did-change-title', title);
    this._emitter.emit('did-change-path', title);
  }

  _addEscapePrefix(event: Object): void {
    if (typeof event.originalEvent === 'object') {
      const keyEvent: Object = event.originalEvent;
      if (typeof keyEvent.key === 'string') {
        this._onInput(`\x1B${keyEvent.key}`);
      }
    }
  }

  _checkIfKeyBoundOrDivertToXTerm(event: Event): boolean {
    // Only allow input if we have somewhere to send it.
    if (this._pty == null) {
      return false;
    }

    const keystroke = atom.keymaps.keystrokeForKeyboardEvent(event);
    const bindings = atom.keymaps.findKeyBindings({
      keystrokes: keystroke,
      target: this._div,
    });
    const preserved = this._preservedCommands;

    if (
      preserved.has(ADD_ESCAPE_COMMAND) &&
      bindings.some(b => b.command === ADD_ESCAPE_COMMAND)
    ) {
      // Intercept the add escape binding and send escape directly, then
      // divert to xterm (to handle keys like Backspace).
      this._onInput('\x1B');
      return true;
    }

    // Skip any key binding that is preserved.
    return !bindings.some(b => preserved.has(b.command));
  }

  _createOutputSink(): Sink {
    let tmuxLines = 0;
    let lines = 0;
    let firstChar: ?string = null;
    let warned = false;
    return removePrefixSink(
      TMUX_CONTROLCONTROL_PREFIX,
      patternCounterSink(
        '\n%',
        n => ++tmuxLines < 2,
        patternCounterSink(
          '\n',
          n => ++lines < 2,
          data => {
            if (firstChar == null && data.length > 0) {
              firstChar = data.charAt(0);
            }
            if (
              firstChar === '%' &&
              tmuxLines === lines &&
              tmuxLines >= 2 &&
              !warned
            ) {
              warned = true;
              atom.notifications.addWarning('Tmux control protocol detected', {
                detail:
                  'The terminal output looks like you might be using tmux with -C or -CC.  ' +
                  'Nuclide terminal can be used with tmux, but not with the -C or -CC options.  ' +
                  'In your ~/.bashrc or similar, you can avoid invocations of tmux -C (or -CC) ' +
                  'in Nuclide terminal by checking:\n' +
                  '  if [ "$TERM_PROGRAM" != nuclide ]; then\n' +
                  '    tmux -C ...\n' +
                  '  fi',
                dismissable: true,
              });
            }
            this._terminal.write(data);
          },
        ),
      ),
    );
  }

  _closeTab(): void {
    const pane = atom.workspace.paneForItem(this);
    if (pane != null) {
      pane.destroyItem(this);
    }
  }

  onOutput(data: string): void {
    this._bytesOut += data.length;
    this._processOutput(data);
  }

  onExit(code: number, signal: number): void {
    const terminal = this._terminal;
    track('nuclide-terminal.exit', {...this._statistics(), code, signal});

    if (code === 0 && !this._terminalInfo.remainOnCleanExit) {
      this._closeTab();
      return;
    }

    terminal.writeln('');
    terminal.writeln('');
    const command = this._terminalInfo.command;
    const process =
      command == null ? 'Process' : `${command.file} ${command.args.join(' ')}`;
    terminal.writeln(`${process} exited with error code '${code}'.`);
    if (signal !== 0) {
      terminal.writeln(`  killed by signal '${signal}'.`);
    }
    terminal.writeln('');

    this._disableTerminal();
  }

  _disableTerminal() {
    this.dispose();
    this._terminal.blur();

    // Disable terminal's ability to capture input once in error state.
    (this._div: any).focus = () => {};
    (this._div: any).blur = () => {};
  }

  setProcessExitCallback(callback: ProcessExitCallback): void {
    this._processExitCallback = callback;
  }

  terminateProcess(): void {
    if (this._pty != null) {
      this._disableTerminal();
      this._terminal.writeln('');
      this._terminal.writeln('Process terminated.');
      this._terminal.writeln('');
    }
  }

  copy(): TerminalView {
    const paneUri = uriFromInfo(this._terminalInfo);
    return new TerminalView(paneUri);
  }

  // Remote connection is closing--note the window remains open to show error
  // output if the process exit code was not 0.
  dispose(): void {
    if (this._pty != null) {
      this._pty.dispose();
      this._pty = null;
    }

    this._processExitCallback();
    this._processExitCallback = () => {};
  }

  // Window is closing, so close everything.
  destroy(): void {
    this._subscriptions.dispose();
  }

  getTitle(): string {
    return this._title;
  }

  getIconName(): IconName {
    return this._terminalInfo.icon;
  }

  getURI(): string {
    return this._paneUri;
  }

  getDefaultLocation(): string {
    return this._terminalInfo.defaultLocation;
  }

  getElement(): any {
    return this._div;
  }

  getPath(): string {
    return this._title;
  }

  onDidChangePath(callback: (v: ?string) => mixed): IDisposable {
    return this.on('did-change-path', callback);
  }

  onDidChangeTitle(callback: (v: ?string) => mixed): IDisposable {
    return this.on('did-change-title', callback);
  }

  on(name: string, callback: (v: any) => mixed): IDisposable {
    return this._emitter.on(name, callback);
  }

  serialize(): TerminalViewState {
    return {
      deserializer: 'TerminalView',
      paneUri: this._paneUri,
    };
  }
}

export function deserializeTerminalView(
  state: TerminalViewState,
): TerminalView {
  // Convert from/to uri to generate a new unique id.
  const info = infoFromUri(state.paneUri);
  const paneUri = uriFromInfo(info);
  return new TerminalView(paneUri);
}

function registerLinkHandlers(terminal: Terminal): void {
  const bindings = [
    {
      // Diff (e.g. 'D1234') with word boundary on either side.
      regex: /\bD[1-9][0-9]{3,}\b/,
      matchIndex: 0,
      urlPrefix: 'https://phabricator.intern.facebook.com/',
    },
    {
      // Paste (e.g. 'P1234') with word boundary on either side.
      regex: /\bP[1-9][0-9]{3,}\b/,
      matchIndex: 0,
      urlPrefix: 'https://phabricator.intern.facebook.com/',
    },
    {
      // Task (e.g. 't1234' or 'T1234') with word boundary on either side.
      // Note the [tT] is not included in the resulting URL.
      regex: /\b[tT]([1-9][0-9]{3,})\b/,
      matchIndex: 1,
      urlPrefix: 'https://our.intern.facebook.com/intern/tasks?t=',
    },
    {
      // Task (e.g. '#1234') preceded by beginning-of-line or whitespace and followed
      // by word boundary.  Unfortunately, since '#' is punctuation, the point before
      // it is not normally a word boundary, so this has to be registered separately.
      regex: /(^|\s)#([1-9][0-9]{3,})\b/,
      matchIndex: 2,
      urlPrefix: 'https://our.intern.facebook.com/intern/tasks?t=',
    },
  ];

  for (const {regex, matchIndex, urlPrefix} of bindings) {
    terminal.linkifier.registerLinkMatcher(
      regex,
      (event, match) => shell.openExternal(urlPrefix + match),
      {matchIndex},
    );
  }
}
