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
 */

import type {TerminalOptions} from 'xterm';
import type {Terminal} from './types';

import {
  boolean,
  constant,
  either,
  either3,
  object,
  number,
  string,
  guard,
} from 'decoders';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {Terminal as XTerminal} from 'vscode-xterm';
import * as Fit from 'vscode-xterm/lib/addons/fit/fit';
import * as WebLinks from 'vscode-xterm/lib/addons/webLinks/webLinks';
import {
  CHAR_ATLAS_CONFIG,
  CURSOR_BLINK_CONFIG,
  CURSOR_STYLE_CONFIG,
  FONT_FAMILY_CONFIG,
  LINE_HEIGHT_CONFIG,
  OPTION_IS_META_CONFIG,
  SCROLLBACK_CONFIG,
  TRANSPARENCY_CONFIG,
  getFontSize,
  RENDERER_TYPE_CONFIG,
} from './config';

const assertTerminalOptionsInFeatureConfig = guard(
  object({
    cursorBlink: boolean,
    cursorStyle: either3(
      constant('block'),
      constant('underline'),
      constant('bar'),
    ),
    scrollback: number,
    fontFamily: string,
    fontSize: number,
    lineHeight: number,
    macOptionIsMeta: boolean,
    allowTransparency: boolean,
    experimentalCharAtlas: either3(
      constant('none'),
      constant('static'),
      constant('dynamic'),
    ),
    rendererType: either(constant('canvas'), constant('dom')),
  }),
);

export function createTerminal(options: TerminalOptions = {}): Terminal {
  // Load the addons on-demand the first time we create a terminal.
  // $FlowIgnore
  if (XTerminal.fit == null) {
    // The 'fit' add-on resizes the terminal based on the container size
    // and the font size such that the terminal fills the container.
    XTerminal.applyAddon(Fit);
  }
  // $FlowIgnore
  if (XTerminal.webLinksInit == null) {
    // The 'webLinks' add-on linkifies http URL strings.
    XTerminal.applyAddon(WebLinks);
  }
  const rendererType = featureConfig.get(RENDERER_TYPE_CONFIG);
  // $FlowIgnore We know that TerminalClass is XTerminal + addons
  const terminal = new XTerminal(
    // $FlowIssue: xterms type needs to be updated to include experimentalCharAtlas
    assertTerminalOptionsInFeatureConfig({
      cursorBlink: featureConfig.get(CURSOR_BLINK_CONFIG),
      cursorStyle: featureConfig.get(CURSOR_STYLE_CONFIG),
      scrollback: featureConfig.get(SCROLLBACK_CONFIG),
      fontFamily: featureConfig.get(FONT_FAMILY_CONFIG),
      fontSize: getFontSize(),
      lineHeight: featureConfig.get(LINE_HEIGHT_CONFIG),
      macOptionIsMeta: featureConfig.get(OPTION_IS_META_CONFIG),
      allowTransparency: featureConfig.get(TRANSPARENCY_CONFIG),
      experimentalCharAtlas: featureConfig.get(CHAR_ATLAS_CONFIG),
      rendererType: rendererType === 'auto' ? 'canvas' : rendererType,
      ...options,
    }),
  );
  // Patch into xterm Linkifier to catch errors on out of bounds line fetching.
  // Track issue at https://github.com/xtermjs/xterm.js/issues/1669
  const linkifier = terminal._core.linkifier;
  const doLinkifyRow = linkifier._doLinkifyRow;
  linkifier._doLinkifyRow = (row, text, matcher, offset) => {
    try {
      doLinkifyRow.call(linkifier, row, text, matcher, offset);
    } catch (e) {
      // swallow errors to avoid red box because the linkifier runs on a timer.
    }
  };
  return terminal;
}
