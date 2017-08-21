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
import type {FileChangeStatusValue} from '../nuclide-vcs-base';

import {repositoryForPath} from '../nuclide-vcs-base';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import classnames from 'classnames';
import nuclideUri from 'nuclide-commons/nuclideUri';
import React from 'react';
import ChangedFile from './ChangedFile';

function isHgPath(path: NuclideUri): boolean {
  const repo = repositoryForPath(path);
  return repo != null && repo.getType() === 'hg';
}

const FILE_CHANGES_INITIAL_PAGE_SIZE = 100;

type Props = {
  // List of files that have checked checkboxes next to their names. `null` -> no checkboxes
  checkedFiles: ?Set<NuclideUri>,
  commandPrefix: string,
  // whether files can be expanded to reveal a diff of changes. Requires passing `fileChanges`.
  enableFileExpansion: boolean,
  enableInlineActions: boolean,
  // `null` values for FileDiffs for a given key are assumed to be in "loading" state.
  fileChanges: ?Map<NuclideUri, ?diffparser$FileDiff>,
  fileStatuses: Map<NuclideUri, FileChangeStatusValue>,
  hideEmptyFolders: boolean,
  onAddFile: (filePath: NuclideUri) => void,
  onDeleteFile: (filePath: NuclideUri) => void,
  // Callback when a file's checkbox is toggled
  onFileChecked: (filePath: NuclideUri) => void,
  // Call back when a file is clicked on
  onFileChosen: (filePath: NuclideUri) => void,
  onForgetFile: (filePath: NuclideUri) => void,
  onMarkFileResolved?: (filePath: NuclideUri) => void,
  onOpenFileInDiffView: (filePath: NuclideUri) => void,
  onRevertFile: (filePath: NuclideUri) => void,
  openInDiffViewOption: boolean,
  rootPath: NuclideUri,
  selectedFile: ?NuclideUri,
  shouldShowFolderName: boolean,
};

type State = {
  isCollapsed: boolean,
  visiblePagesCount: number,
};

export default class ChangedFilesList extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      isCollapsed: false,
      visiblePagesCount: 1,
    };
  }

  render(): ?React.Element<any> {
    const {
      checkedFiles,
      commandPrefix,
      enableFileExpansion,
      enableInlineActions,
      fileChanges,
      fileStatuses,
      onAddFile,
      onDeleteFile,
      onFileChecked,
      onFileChosen,
      onForgetFile,
      onMarkFileResolved,
      onOpenFileInDiffView,
      openInDiffViewOption,
      onRevertFile,
      rootPath,
      selectedFile,
    } = this.props;
    if (fileStatuses.size === 0 && this.props.hideEmptyFolders) {
      return null;
    }

    const filesToShow =
      FILE_CHANGES_INITIAL_PAGE_SIZE * this.state.visiblePagesCount;
    const sizeLimitedFileChanges = Array.from(fileStatuses.entries()).slice(
      0,
      filesToShow,
    );

    const rootClassName = classnames('list-nested-item', {
      collapsed: this.state.isCollapsed,
    });

    const showMoreFilesElement =
      fileStatuses.size > filesToShow
        ? <div
            className="icon icon-ellipsis"
            ref={addTooltip({
              title: 'Show more files with uncommitted changes',
              delay: 300,
              placement: 'bottom',
            })}
            onClick={() =>
              this.setState({
                visiblePagesCount: this.state.visiblePagesCount + 1,
              })}
          />
        : null;

    const isHgRoot = isHgPath(rootPath);
    return (
      <ul className="list-tree has-collapsable-children nuclide-changed-files-list">
        <li className={rootClassName}>
          {this.props.shouldShowFolderName
            ? <div
                className="list-item"
                key={this.props.rootPath}
                onClick={() =>
                  this.setState({isCollapsed: !this.state.isCollapsed})}>
                <span
                  className="icon icon-file-directory nuclide-file-changes-root-entry"
                  data-path={this.props.rootPath}>
                  {nuclideUri.basename(this.props.rootPath)}
                </span>
              </div>
            : null}
          <ul className="list-tree has-flat-children">
            {sizeLimitedFileChanges.map(([filePath, fileStatus]) =>
              <ChangedFile
                commandPrefix={commandPrefix}
                enableFileExpansion={enableFileExpansion}
                enableInlineActions={enableInlineActions}
                fileChanges={
                  fileChanges == null ? null : fileChanges.get(filePath)
                }
                filePath={filePath}
                fileStatus={fileStatus}
                isChecked={
                  checkedFiles == null ? null : checkedFiles.has(filePath)
                }
                isHgPath={isHgRoot}
                isSelected={selectedFile === filePath}
                key={filePath}
                onAddFile={onAddFile}
                onDeleteFile={onDeleteFile}
                onFileChecked={onFileChecked}
                onFileChosen={onFileChosen}
                onForgetFile={onForgetFile}
                onMarkFileResolved={onMarkFileResolved}
                onOpenFileInDiffView={onOpenFileInDiffView}
                openInDiffViewOption={openInDiffViewOption}
                onRevertFile={onRevertFile}
                rootPath={rootPath}
              />,
            )}
            <li>
              {showMoreFilesElement}
            </li>
          </ul>
        </li>
      </ul>
    );
  }
}
