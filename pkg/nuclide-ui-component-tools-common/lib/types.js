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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export type IndexMessage = {|
  type: 'directory' | 'file',
  value: NuclideUri,
|};

export type ComponentDefinition = {|
  name: string,
  requiredProps: Array<ComponentProp>,
  defaultProps: Array<string>,
  leadingComment: ?string,
|};

export type ComponentProp = {|
  name: string,
  typeAnnotation: string,
  leadingComment?: string,
|};
