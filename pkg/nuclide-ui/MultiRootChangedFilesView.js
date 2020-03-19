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
import type {GeneratedFileType} from '../nuclide-generated-files-rpc';
import type {FileChangeStatusValue} from '../nuclide-vcs-base';
import {openFileInDiffView} from '../commons-atom/open-in-diff-view';
import {track} from 'nuclide-analytics';
import * as React from 'react';
import ChangedFilesList from './ChangedFilesList';
import {TreeList, TreeItem} from 'nuclide-commons-ui/Tree';
import classnames from 'classnames';

type Props = {
  // Used to identify which surface (e.g. file tree vs SCM side bar) was used to trigger an action.
  analyticsSurface?: string,
  // List of files that have checked checkboxes next to their names. `null` -> no checkboxes
  checkedFiles: ?Map<NuclideUri, Set<NuclideUri>>,
  fileStatuses: Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>>,
  generatedTypes?: Map<NuclideUri, GeneratedFileType>,
  commandPrefix: string,
  selectedFile: ?NuclideUri,
  hideEmptyFolders?: boolean,
  // Callback when a file's checkbox is toggled
  onFileChecked?: (filePath: NuclideUri) => mixed,
  onFileChosen(filePath: NuclideUri): mixed,
  onFileOpen?: ?(filePath: NuclideUri) => mixed,
  onFileOpenFolder?: ?(filePath: NuclideUri) => mixed,
  onMarkFileResolved?: (filePath: NuclideUri) => mixed,
  getRevertTargetRevision?: () => ?string,
  onClickAdd(filePath: NuclideUri): mixed,
  onClickRevert(filePath: NuclideUri, toRevision: ?string): mixed,
  onClickDelete(filePath: NuclideUri): mixed,
  onClickForget(filePath: NuclideUri): mixed,
  openInDiffViewOption?: boolean,
};

type DefaultProps = {
  onFileChecked: (filePath: NuclideUri) => void,
  checkedFiles: ?Map<NuclideUri, Set<NuclideUri>>,
};

const ANALYTICS_PREFIX = 'changed-files-view';
const DEFAULT_ANALYTICS_SOURCE_KEY = 'command';

export class MultiRootChangedFilesView extends React.PureComponent<Props> {
  _itemSelector: string;

  constructor(props: Props) {
    super(props);

    this._itemSelector = `.${
      props.commandPrefix
    }.nuclide-ui-multi-root-file-tree-container .nuclide-changed-file`;
  }

  static defaultProps: DefaultProps = {
    checkedFiles: null,
    onFileChecked: () => {},
  };

  _getAnalyticsSurface(): string {
    const {analyticsSurface} = this.props;
    return analyticsSurface == null ? 'n/a' : analyticsSurface;
  }

  _handleAddFile = (
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void => {
    this.props.onClickAdd(filePath);
    track(`${ANALYTICS_PREFIX}-add-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  };

  _handleDeleteFile = (
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void => {
    this.props.onClickDelete(filePath);
    track(`${ANALYTICS_PREFIX}-delete-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  };

  _handleForgetFile = (
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void => {
    this.props.onClickForget(filePath);
    track(`${ANALYTICS_PREFIX}-forget-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  };

  _handleOpenFileInDiffView = (
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void => {
    openFileInDiffView(filePath);
    track(`${ANALYTICS_PREFIX}-file-in-diff-view`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  };

  _handleRevertFile = (
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void => {
    const {getRevertTargetRevision, onClickRevert} = this.props;
    let targetRevision = null;
    if (getRevertTargetRevision != null) {
      targetRevision = getRevertTargetRevision();
    }
    onClickRevert(filePath, targetRevision);
    track(`${ANALYTICS_PREFIX}-revert-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  };

  render(): React.Node {
    const {
      checkedFiles: checkedFilesByRoot,
      commandPrefix,
      fileStatuses: fileStatusesByRoot,
      hideEmptyFolders,
      onFileChecked,
      onFileChosen,
      onFileOpen,
      onFileOpenFolder,
      onMarkFileResolved,
      openInDiffViewOption,
      selectedFile,
    } = this.props;
    if (fileStatusesByRoot.size === 0) {
      return (
        <TreeList showArrows={true}>
          <TreeItem>No changes</TreeItem>
        </TreeList>
      );
      // The 'showArrows' is so CSS styling gives this the same indent as
      // real changes do (which themselves have showArrows=true).
    }
    const shouldShowFolderName = fileStatusesByRoot.size > 1;
    return (
      <div
        className={classnames(
          commandPrefix,
          'nuclide-ui-multi-root-file-tree-container',
        )}>
        {Array.from(fileStatusesByRoot.entries()).map(
          ([root, fileStatuses]) => {
            if (fileStatuses.size == null && hideEmptyFolders) {
              return null;
            }
            const checkedFiles =
              checkedFilesByRoot == null ? null : checkedFilesByRoot.get(root);
            return (
              <ChangedFilesList
                checkedFiles={checkedFiles}
                fileStatuses={fileStatuses}
                generatedTypes={this.props.generatedTypes}
                key={root}
                onAddFile={this._handleAddFile}
                onDeleteFile={this._handleDeleteFile}
                onFileChecked={onFileChecked}
                onFileChosen={onFileChosen}
                onFileOpen={onFileOpen}
                onFileOpenFolder={onFileOpenFolder}
                onForgetFile={this._handleForgetFile}
                onMarkFileResolved={onMarkFileResolved}
                onOpenFileInDiffView={
                  openInDiffViewOption ? this._handleOpenFileInDiffView : null
                }
                onRevertFile={this._handleRevertFile}
                rootPath={root}
                selectedFile={selectedFile}
                shouldShowFolderName={shouldShowFolderName}
              />
            );
          },
        )}
      </div>
    );
  }
}
