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

import React from 'react';
import classnames from 'classnames';

const SPECIAL_CHARACTERS = './@_';

function formatFilter(filter) {
  let result = filter;

  for (let i = 0; i < SPECIAL_CHARACTERS.length; i++) {
    const char = SPECIAL_CHARACTERS.charAt(i);
    result = result.replace(char, '\\' + char);
  }

  return result;
}

export function matchesFilter(name: string, filter: string): boolean {
  return name.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
}

export function filterName(
  name: string,
  filter: string,
  isSelected: boolean,
): string | Array<React.Element<any>> {
  if (filter.length) {
    const classes = classnames({
      'nuclide-file-tree-entry-highlight': true,
      'text-highlight': !isSelected,
    });

    return name
      .split(new RegExp(`(?:(?=${formatFilter(filter)}))`, 'ig'))
      .map((text, i) => {
        if (matchesFilter(text, filter)) {
          return (
            <span key={filter + i}>
              <span className={classes}>
                {text.substr(0, filter.length)}
              </span>
              <span>
                {text.substr(filter.length)}
              </span>
            </span>
          );
        }
        return (
          <span key={filter + i}>
            {text}
          </span>
        );
      });
  }
  return name;
}
