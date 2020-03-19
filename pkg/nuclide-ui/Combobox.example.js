/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import * as React from 'react';
import {Block} from 'nuclide-commons-ui/Block';
import {Combobox} from './Combobox';
import {Observable} from 'rxjs';

function requestOptions(): Observable<Array<string>> {
  return Observable.of(['Nuclide', 'Atom', 'Facebook']);
}

function onSelect(option: string) {
  // Handle select
}

function filterOptions(options: Array<string>, value: string): Array<string> {
  // Custom filter to filter, sort, etc. how you want
  return options.filter(option => {
    const lowerCaseValue = value.toLowerCase();
    return option.toLowerCase().indexOf(lowerCaseValue) > -1;
  });
}

const BasicExample = (): React.Element<'div'> => (
  <div>
    <Block>
      <Combobox
        initialTextInput=""
        size="sm"
        maxOptionCount={30}
        requestOptions={requestOptions}
        placeholderText="Search here"
        onSelect={onSelect}
        filterOptions={filterOptions}
      />
    </Block>
  </div>
);

export const ComboboxExamples = {
  sectionName: 'Combobox',
  description: 'Combobox is a typeahead that supports async requests',
  examples: [
    {
      title: 'Basic Example',
      component: BasicExample,
    },
  ],
};
