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

import escapeRegExp from 'escape-string-regexp';
import fsPromise from 'nuclide-commons/fsPromise';
import {track} from '../../nuclide-analytics';

function quoteRegExp(str: string): string {
  const boundary = '([\'"])';
  return `${boundary}(${str})${boundary}`;
}

export default (async function updateKeymap(
  keymapPath: string,
  deprecatedCommands: {[command: string]: string},
): Promise<void> {
  const keymapFile = await fsPromise.readFile(keymapPath, 'utf8');
  // Search for all deprecated commands (whole words, escaped).
  const mergedRegExp = Object.keys(deprecatedCommands)
    .map(escapeRegExp)
    .join('|');
  const matches = keymapFile.match(new RegExp(quoteRegExp(mergedRegExp), 'g'));
  if (matches != null) {
    // Format as a list.
    const matchesSet = new Set(matches.map(m => m.substr(1, m.length - 2)));
    const matchesArray = Array.from(matchesSet);
    const matchesList = matchesArray
      .map(command => `- \`${command}\``)
      .join('\n');
    return new Promise(resolve => {
      const notification = atom.notifications.addInfo(
        'Nuclide: Deprecated Commands',
        {
          icon: 'nuclicon-nuclide',
          description:
            'Your keymap contains the following deprecated commands:' +
            `\n\n${matchesList}\n\n` +
            'Would you like to update your keymap?',
          dismissable: true,
          buttons: [
            {
              text: 'Update Keymap',
              className: 'icon icon-keyboard',
              onDidClick: async () => {
                track('deprecated-command-replaced', {commands: matchesArray});
                const replaced = matchesArray.reduce(
                  (str, match) =>
                    str.replace(
                      new RegExp(quoteRegExp(escapeRegExp(match)), 'g'),
                      `$1${deprecatedCommands[match]}$3`,
                    ),
                  keymapFile,
                );
                await fsPromise.writeFile(keymapPath, replaced);
                atom.notifications.addSuccess('Keymap successfully updated!');
                notification.dismiss();
                resolve();
              },
            },
          ],
        },
      );
    });
  }
});
