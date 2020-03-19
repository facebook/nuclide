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

import * as React from 'react';
import {Block} from 'nuclide-commons-ui/Block';
import {MultiRootChangedFilesView} from './MultiRootChangedFilesView';
import {FileChangeStatus} from '../nuclide-vcs-base';

function BasicExample(): React.Element<any> {
  const fileChanges = new Map([
    [
      'nuclide://remote.host/someRemoteDir',
      new Map([
        ['path/to/some/file/added.js', FileChangeStatus.ADDED],
        ['path/to/some/file/modified.js', FileChangeStatus.MODIFIED],
        ['path/to/some/file/missing.js', FileChangeStatus.MISSING],
        ['path/to/some/file/removed.js', FileChangeStatus.REMOVED],
        ['path/to/some/file/untracked.js', FileChangeStatus.UNTRACKED],
      ]),
    ],
    [
      'someLocalDir',
      new Map([
        ['file/with/shared/prefix/foo.js', FileChangeStatus.MODIFIED],
        ['file/with/shared/prefix/bar.js', FileChangeStatus.MODIFIED],
        ['file/with/shared/prefix/baz.js', FileChangeStatus.MODIFIED],
        ['file/with/another/prefix/foo.js', FileChangeStatus.MODIFIED],
        ['file/with/another/prefix/bar.js', FileChangeStatus.MODIFIED],
      ]),
    ],
  ]);
  return (
    <div>
      <Block>
        <MultiRootChangedFilesView
          fileStatuses={fileChanges}
          commandPrefix="nuclide-ui-playground"
          selectedFile={null}
          onFileChosen={uri =>
            atom.notifications.addInfo(`Selected file ${uri}`)
          }
          openInDiffViewOption={true}
          onClickAdd={uri => atom.notifications.addInfo(`Added file ${uri}`)}
          onClickRevert={uri =>
            atom.notifications.addInfo(`Reverted file ${uri}`)
          }
          onClickDelete={uri =>
            atom.notifications.addInfo(`Deleted file ${uri}`)
          }
          onClickForget={uri =>
            atom.notifications.addInfo(`Forgot file ${uri}`)
          }
        />
      </Block>
    </div>
  );
}

export const MultiRootChangedFilesViewExample = {
  sectionName: 'MultiRootChangedFilesView',
  description:
    'Renders a list of changed files, across one or more directories.',
  examples: [
    {
      title: 'Basic example',
      component: BasicExample,
    },
  ],
};
