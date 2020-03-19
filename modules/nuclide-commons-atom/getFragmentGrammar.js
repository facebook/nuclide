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

/**
 * Some grammars should use a specialized grammar for code fragments
 * (namely PHP, since it's wildly different depending on the presence of a <?php opening).
 */

const FRAGMENT_GRAMMARS = Object.freeze({
  'text.html.hack': 'source.hackfragment',
  'text.html.php': 'source.hackfragment',
});

export default function getFragmentGrammar(
  grammar: atom$Grammar,
): atom$Grammar {
  if (FRAGMENT_GRAMMARS.hasOwnProperty(grammar.scopeName)) {
    const fragmentGrammar = FRAGMENT_GRAMMARS[grammar.scopeName];
    return atom.grammars.grammarForScopeName(fragmentGrammar) || grammar;
  }
  return grammar;
}
