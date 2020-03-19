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

import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import SettingsPaneItem, {WORKSPACE_VIEW_URI} from './SettingsPaneItem';
import querystring from 'querystring';
import * as React from 'react';
import url from 'url';

export default function(uri: string) {
  if (uri.startsWith(WORKSPACE_VIEW_URI)) {
    let initialFilter = '';
    const {query} = url.parse(uri);
    if (query != null) {
      const params = querystring.parse(query);
      if (typeof params.filter === 'string') {
        initialFilter = params.filter;
      }
    }
    return viewableFromReactElement(
      <SettingsPaneItem initialFilter={initialFilter} />,
    );
  }
}
