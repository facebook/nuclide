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

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';
import {kebabCase} from 'lodash';

// TODO: This should be extracted to a separate module which can be shared by
// other packages.

const ID_PREFIX = 'nuclide-theme-detector';

function idFromColorName(colorName): string {
  return `${ID_PREFIX}-${kebabCase(colorName)}`;
}

// NOTE: Each of these keys must also be implemented as an ID-selector in this
// packages .less files. They must also be added to the `COLOR_NAMES` array below.
export type ThemeColors = {
  backgroundColorHighlight: string,
  syntaxSelectionColor: string,
  syntaxCursorColor: string,
  syntaxGutterBackgroundColorSelected: string,
  syntaxTextColor: string,
  backgroundColorInfo: string,
  textColorSubtle: string,
};

type ColorName = $Keys<ThemeColors>;

const COLOR_NAMES: Array<ColorName> = [
  'backgroundColorHighlight',
  'syntaxSelectionColor',
  'syntaxCursorColor',
  'syntaxGutterBackgroundColorSelected',
  'syntaxTextColor',
  'backgroundColorInfo',
  'textColorSubtle',
];

export function getThemeChangeEvents(): Observable<null> {
  return Observable.merge(
    atom.packages.hasActivatedInitialPackages()
      ? Observable.of(null)
      : Observable.empty(),
    observableFromSubscribeFunction(cb =>
      atom.packages.onDidActivateInitialPackages(cb),
    ).mapTo(null),
    observableFromSubscribeFunction(cb =>
      atom.themes.onDidChangeActiveThemes(cb),
    )
      // TODO: It seems like the colors are not actually ready yet when
      // `onDidChangeActiveThemes` fires. Ideally we would figure out exactly
      // why and actually know when things are ready, but for now...
      .delay(100)
      .mapTo(null),
  );
}

export function getThemeColors() {
  const tester = document.createElement('div');
  // $FlowIgnore
  document.body.appendChild(tester);
  // $FlowIgnore
  const colors: ThemeColors = {};

  COLOR_NAMES.forEach(colorName => {
    tester.id = idFromColorName(colorName);
    colors[colorName] = window.getComputedStyle(tester).backgroundColor;
  });
  // $FlowIgnore
  document.body.removeChild(tester);
  return colors;
}
