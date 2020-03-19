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

import type {IconName} from 'nuclide-commons-ui/Icon';
import type {Observable} from 'rxjs';
import type {StatusData} from '../../nuclide-language-service/lib/LanguageService';

export type LanguageStatusProvider = {
  name: string,
  description: string,
  icon: ?IconName,
  iconMarkdown: ?string,
  grammarScopes: Array<string>,
  priority: number,

  observeStatus(editor: TextEditor): Observable<StatusData>,

  clickStatus(editor: TextEditor, id: string, button: string): Promise<void>,
};

export type StatusKind = 'null' | 'green' | 'yellow' | 'red';
