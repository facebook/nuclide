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

import humanizeKeystroke from '../humanizeKeystroke';

describe('nuclide-keystroke-label', () => {
  // adapted from https://github.com/atom/underscore-plus/blob/master/spec/underscore-plus-spec.coffee
  describe('humanizeKeystroke', () => {
    it('replaces single keystroke', () => {
      expect(humanizeKeystroke('cmd-O', 'darwin')).toEqual('⌘⇧O');
      expect(humanizeKeystroke('cmd-O', 'linux')).toEqual('Cmd+Shift+O');

      expect(humanizeKeystroke('cmd-shift-up', 'darwin')).toEqual('⌘⇧↑');
      expect(humanizeKeystroke('cmd-shift-up', 'linux')).toEqual(
        'Cmd+Shift+Up',
      );

      expect(humanizeKeystroke('cmd-option-down', 'darwin')).toEqual('⌘⌥↓');
      expect(humanizeKeystroke('cmd-option-down', 'linux')).toEqual(
        'Cmd+Alt+Down',
      );

      expect(humanizeKeystroke('cmd-option-left', 'darwin')).toEqual('⌘⌥←');
      expect(humanizeKeystroke('cmd-option-left', 'linux')).toEqual(
        'Cmd+Alt+Left',
      );

      expect(humanizeKeystroke('cmd-option-right', 'darwin')).toEqual('⌘⌥→');
      expect(humanizeKeystroke('cmd-option-right', 'linux')).toEqual(
        'Cmd+Alt+Right',
      );

      expect(humanizeKeystroke('cmd-o', 'darwin')).toEqual('⌘O');
      expect(humanizeKeystroke('cmd-o', 'linux')).toEqual('Cmd+O');

      expect(humanizeKeystroke('ctrl-2', 'darwin')).toEqual('⌃2');
      expect(humanizeKeystroke('ctrl-2', 'linux')).toEqual('Ctrl+2');

      expect(humanizeKeystroke('cmd-space', 'darwin')).toEqual('⌘space');
      expect(humanizeKeystroke('cmd-space', 'linux')).toEqual('Cmd+Space');

      expect(humanizeKeystroke('cmd-|', 'darwin')).toEqual('⌘⇧\\');
      expect(humanizeKeystroke('cmd-|', 'linux')).toEqual('Cmd+Shift+\\');

      expect(humanizeKeystroke('cmd-}', 'darwin')).toEqual('⌘⇧]');
      expect(humanizeKeystroke('cmd-}', 'linux')).toEqual('Cmd+Shift+]');

      expect(humanizeKeystroke('cmd--', 'darwin')).toEqual('⌘-');
      expect(humanizeKeystroke('cmd--', 'linux')).toEqual('Cmd+-');
    });

    it('correctly replaces keystrokes with shift and capital letter', () => {
      expect(humanizeKeystroke('cmd-shift-P', 'darwin')).toEqual('⌘⇧P');
      expect(humanizeKeystroke('cmd-shift-P', 'linux')).toEqual('Cmd+Shift+P');
    });

    it('replaces multiple keystrokes', () => {
      expect(humanizeKeystroke('cmd-O cmd-n', 'darwin')).toEqual('⌘⇧O ⌘N');
      expect(humanizeKeystroke('cmd-O cmd-n', 'linux')).toEqual(
        'Cmd+Shift+O Cmd+N',
      );

      expect(humanizeKeystroke('cmd-shift-- cmd-n', 'darwin')).toEqual(
        '⌘⇧- ⌘N',
      );
      expect(humanizeKeystroke('cmd-shift-- cmd-n', 'linux')).toEqual(
        'Cmd+Shift+- Cmd+N',
      );

      expect(humanizeKeystroke('cmd-k right', 'darwin')).toEqual('⌘K →');
      expect(humanizeKeystroke('cmd-k right', 'linux')).toEqual('Cmd+K Right');
    });

    it('formats function keys', () => {
      expect(humanizeKeystroke('cmd-f2', 'darwin')).toEqual('⌘F2');
      expect(humanizeKeystroke('cmd-f2', 'linux')).toEqual('Cmd+F2');
    });

    it('handles junk input', () => {
      // $FlowFixMe: Deliberately testing invalid input.
      expect(humanizeKeystroke()).toEqual(undefined);
      // $FlowFixMe: Deliberately testing invalid input.
      expect(humanizeKeystroke(null)).toEqual(null);
      expect(humanizeKeystroke('')).toEqual('');
    });
  });
});
