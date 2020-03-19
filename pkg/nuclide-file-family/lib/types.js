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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export type FileFamilyProvider = {
  +getRelatedFiles: (path: NuclideUri) => Promise<FileGraph>,
};

export type FileGraph = {|
  files: FileMap,
  relations: RelationList,
|};

export type FileMap = Map<NuclideUri, RelatedFile>;
export type RelationList = Array<Relation>;

export type RelatedFile = {|
  labels: Set<string>,
  exists?: boolean,
  creatable?: boolean,
|};

export type Relation = {|
  from: NuclideUri,
  to: NuclideUri,
  labels: Set<string>,
  directed: boolean,
|};
