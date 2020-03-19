/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import type {Observable} from 'rxjs';

export type HgExecOptions = {|
  cwd: string,
  input?: ?(string | Observable<string>),
  NO_HGPLAIN?: boolean,
  TTY_OUTPUT?: boolean,
  HGEDITOR?: string,
  useMerge3?: boolean,
|};
