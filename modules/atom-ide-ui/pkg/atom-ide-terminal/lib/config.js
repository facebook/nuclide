/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {Terminal} from './types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export const COLOR_CONFIGS = Object.freeze({
  // dark
  black: 'atom-ide-terminal.black',
  red: 'atom-ide-terminal.red',
  green: 'atom-ide-terminal.green',
  blue: 'atom-ide-terminal.blue',
  yellow: 'atom-ide-terminal.yellow',
  cyan: 'atom-ide-terminal.cyan',
  magenta: 'atom-ide-terminal.magenta',
  white: 'atom-ide-terminal.white',
  // bright
  brightBlack: 'atom-ide-terminal.brightBlack',
  brightRed: 'atom-ide-terminal.brightRed',
  brightGreen: 'atom-ide-terminal.brightGreen',
  brightBlue: 'atom-ide-terminal.brightBlue',
  brightYellow: 'atom-ide-terminal.brightYellow',
  brightCyan: 'atom-ide-terminal.brightCyan',
  brightMagenta: 'atom-ide-terminal.brightMagenta',
  brightWhite: 'atom-ide-terminal.brightWhite',
});

export const PRESERVED_COMMANDS_CONFIG = 'atom-ide-terminal.preservedCommands';
export const SCROLLBACK_CONFIG = 'atom-ide-terminal.scrollback';
export const CURSOR_STYLE_CONFIG = 'atom-ide-terminal.cursorStyle';
export const CURSOR_BLINK_CONFIG = 'atom-ide-terminal.cursorBlink';
export const LINE_HEIGHT_CONFIG = 'atom-ide-terminal.lineHeight';
export const DOCUMENTATION_MESSAGE_CONFIG =
  'atom-ide-terminal.documentationMessage';
export const ADD_ESCAPE_COMMAND = 'atom-ide-terminal:add-escape-prefix';
export const OPTION_IS_META_CONFIG = 'atom-ide-terminal.optionIsMeta';
export const TRANSPARENCY_CONFIG = 'atom-ide-terminal.allowTransparency';
export const CHAR_ATLAS_CONFIG = 'atom-ide-terminal.charAtlas';
export const RENDERER_TYPE_CONFIG = 'atom-ide-terminal.renderer';
export const FONT_FAMILY_CONFIG = 'atom-ide-terminal.fontFamily';
export const FONT_SCALE_CONFIG = 'atom-ide-terminal.fontScale';
export const COPY_ON_SELECT_CONFIG = 'atom-ide-terminal.copyOnSelect';

export function getFontSize(): number {
  return (
    parseFloat(featureConfig.get(FONT_SCALE_CONFIG)) *
    parseFloat(atom.config.get('editor.fontSize'))
  );
}

export function setTerminalOption(
  terminal: Terminal,
  optionName: string,
  value: mixed,
): void {
  if (terminal.getOption(optionName) !== value) {
    terminal.setOption(optionName, value);
  }
}

export function subscribeConfigChanges(terminal: Terminal): IDisposable {
  return new UniversalDisposable(
    featureConfig
      .observeAsStream(OPTION_IS_META_CONFIG)
      .skip(1)
      .subscribe(optionIsMeta => {
        setTerminalOption(terminal, 'macOptionIsMeta', optionIsMeta);
      }),
    featureConfig
      .observeAsStream(CURSOR_STYLE_CONFIG)
      .skip(1)
      .subscribe(cursorStyle =>
        setTerminalOption(terminal, 'cursorStyle', cursorStyle),
      ),
    featureConfig
      .observeAsStream(CURSOR_BLINK_CONFIG)
      .skip(1)
      .subscribe(cursorBlink =>
        setTerminalOption(terminal, 'cursorBlink', cursorBlink),
      ),
    featureConfig
      .observeAsStream(SCROLLBACK_CONFIG)
      .skip(1)
      .subscribe(scrollback =>
        setTerminalOption(terminal, 'scrollback', scrollback),
      ),
    featureConfig
      .observeAsStream(RENDERER_TYPE_CONFIG)
      .skip(1)
      .map(rendererType => (rendererType === 'auto' ? 'canvas' : rendererType))
      .subscribe(rendererType =>
        setTerminalOption(terminal, 'rendererType', rendererType),
      ),
  );
}

export function syncTerminalFont(terminal: Terminal) {
  setTerminalOption(terminal, 'fontSize', getFontSize());
  setTerminalOption(
    terminal,
    'lineHeight',
    featureConfig.get(LINE_HEIGHT_CONFIG),
  );
  setTerminalOption(
    terminal,
    'fontFamily',
    featureConfig.get(FONT_FAMILY_CONFIG),
  );
}
