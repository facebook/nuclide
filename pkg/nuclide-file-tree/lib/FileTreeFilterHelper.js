'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

const {
  PureRenderMixin,
  React,
  } = require('react-for-atom');

function filterName(name: string, filter: ?string) {
  if (filter != null && filter.length) {
    name = name.split(new RegExp(`(?:(?=${filter}))`, 'ig'));
    name = name.map((text, i) => {
      if (text.match(new RegExp(filter, 'ig'))) {
        return (
          <span key={i}>
            <span className='nuclide-file-tree-entry-highlight'>
              {text.substring(0, filter.length)}
            </span>
            <span>
              {text.substring(filter.length)}
            </span>
          </span>
        );
      }
      return (
        <span key={i}>
          {text}
        </span>
      );
    });
  }
  return name;
}

module.exports = filterName;
