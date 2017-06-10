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
import {
  addPath,
  confirmAndRevertPath,
  confirmAndDeletePath,
  forgetPath,
  FileChangeStatus,
  RevertibleStatusCodes,
} from '../nuclide-vcs-base';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {openFileInDiffView} from '../commons-atom/open-in-diff-view';
import {track} from '../nuclide-analytics';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import React from 'react';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ChangedFilesList from './ChangedFilesList';
import {TreeList, TreeItem} from './Tree';

type Props = {
  // Used to identify which surface (e.g. file tree vs SCM side bar) was used to trigger an action.
  analyticsSurface?: string,
  // List of files that have checked checkboxes next to their names. `null` -> no checkboxes
  checkedFiles: ?Map<NuclideUri, Set<NuclideUri>>,
  // whether files can be expanded to reveal a diff of changes. Requires passing `fileChanges`.
  enableFileExpansion?: true,
  enableInlineActions?: true,
  // `null` values for FileDiffs for a given key are assumed to be in "loading" state.
  fileChanges?: Map<NuclideUri, Map<NuclideUri, ?diffparser$FileDiff>>,
  fileStatuses: Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>>,
  commandPrefix: string,
  selectedFile: ?NuclideUri,
  hideEmptyFolders?: boolean,
  // Callback when a file's checkbox is toggled
  onFileChecked?: (filePath: NuclideUri) => void,
  onFileChosen: (filePath: NuclideUri) => void,
  getRevertTargetRevision?: () => ?string,
  openInDiffViewOption?: boolean,
};

type DefaultProps = {
  onFileChecked: (filePath: NuclideUri) => void,
  checkedFiles: ?Map<NuclideUri, Set<NuclideUri>>,
};

const ANALYTICS_PREFIX = 'changed-files-view';
const DEFAULT_ANALYTICS_SOURCE_KEY = 'command';

export class MultiRootChangedFilesView extends React.PureComponent {
  props: Props;
  _subscriptions: UniversalDisposable;

  static defaultProps: DefaultProps = {
    checkedFiles: null,
    onFileChecked: () => {},
  };

  constructor(props: Props) {
    super(props);
    (this: any)._handleAddFile = this._handleAddFile.bind(this);
    (this: any)._handleDeleteFile = this._handleDeleteFile.bind(this);
    (this: any)._handleForgetFile = this._handleForgetFile.bind(this);
    (this: any)._handleOpenFileInDiffView = this._handleOpenFileInDiffView.bind(
      this,
    );
    (this: any)._handleRevertFile = this._handleRevertFile.bind(this);
  }

  componentDidMount(): void {
    this._subscriptions = new UniversalDisposable();
    const {commandPrefix, openInDiffViewOption} = this.props;
    this._subscriptions.add(
      atom.contextMenu.add({
        [`.${commandPrefix}-file-entry`]: [
          {type: 'separator'},
          {
            label: 'Add file to Mercurial',
            command: `${commandPrefix}:add`,
            shouldDisplay: event => {
              return (
                this._getStatusCodeForFile(event) === FileChangeStatus.UNTRACKED
              );
            },
          },
          {
            label: 'Open file in Diff View',
            command: `${commandPrefix}:open-in-diff-view`,
            shouldDisplay: event => {
              return (
                atom.packages.isPackageLoaded('fb-diff-view') &&
                openInDiffViewOption
              );
            },
          },
          {
            label: 'Revert File',
            command: `${commandPrefix}:revert`,
            shouldDisplay: event => {
              const statusCode = this._getStatusCodeForFile(event);
              if (statusCode == null) {
                return false;
              }
              return RevertibleStatusCodes.includes(statusCode);
            },
          },
          {
            label: 'Delete File',
            command: `${commandPrefix}:delete-file`,
            shouldDisplay: event => {
              const statusCode = this._getStatusCodeForFile(event);
              return statusCode !== FileChangeStatus.REMOVED;
            },
          },
          {
            label: 'Goto File',
            command: `${commandPrefix}:goto-file`,
          },
          {
            label: 'Copy File Name',
            command: `${commandPrefix}:copy-file-name`,
          },
          {
            label: 'Copy Full Path',
            command: `${commandPrefix}:copy-full-path`,
          },
          {
            label: 'Forget file',
            command: `${commandPrefix}:forget-file`,
            shouldDisplay: event => {
              const statusCode = this._getStatusCodeForFile(event);
              return (
                statusCode !== FileChangeStatus.REMOVED &&
                statusCode !== FileChangeStatus.UNTRACKED
              );
            },
          },
          {type: 'separator'},
        ],
      }),
    );

    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:goto-file`,
        event => {
          const filePath = this._getFilePathFromEvent(event);
          if (filePath != null && filePath.length) {
            goToLocation(filePath);
          }
        },
      ),
    );

    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:copy-full-path`,
        event => {
          atom.clipboard.write(
            nuclideUri.getPath(this._getFilePathFromEvent(event) || ''),
          );
        },
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:delete-file`,
        event => {
          const nuclideFilePath = this._getFilePathFromEvent(event);
          this._handleDeleteFile(nuclideFilePath);
        },
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:copy-file-name`,
        event => {
          atom.clipboard.write(
            nuclideUri.basename(this._getFilePathFromEvent(event) || ''),
          );
        },
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:add`,
        event => {
          const filePath = this._getFilePathFromEvent(event);
          if (filePath != null && filePath.length) {
            this._handleAddFile(filePath);
          }
        },
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:revert`,
        event => {
          const filePath = this._getFilePathFromEvent(event);
          if (filePath != null && filePath.length) {
            this._handleRevertFile(filePath);
          }
        },
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:open-in-diff-view`,
        event => {
          const filePath = this._getFilePathFromEvent(event);
          if (filePath != null && filePath.length) {
            this._handleOpenFileInDiffView(filePath);
          }
        },
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        `.${commandPrefix}-file-entry`,
        `${commandPrefix}:forget-file`,
        event => {
          const filePath = this._getFilePathFromEvent(event);
          if (filePath != null && filePath.length) {
            this._handleForgetFile(filePath);
          }
        },
      ),
    );
  }

  _getStatusCodeForFile(event: MouseEvent): ?number {
    // Walk up the DOM tree to the element containing the relevant data- attributes.
    const target = ((event.target: any): HTMLElement).closest(
      '.nuclide-changed-file',
    );
    invariant(target);
    const filePath = target.getAttribute('data-path');
    const rootPath = target.getAttribute('data-root');
    // $FlowFixMe
    const fileStatusesForRoot = this.props.fileStatuses.get(rootPath);
    invariant(fileStatusesForRoot, 'Invalid rootpath');
    // $FlowFixMe
    const statusCode = fileStatusesForRoot.get(filePath);
    return statusCode;
  }

  _getFilePathFromEvent(event: Event): NuclideUri {
    const eventTarget: HTMLElement = (event.currentTarget: any);
    // $FlowFixMe
    return eventTarget.getAttribute('data-path');
  }

  _getAnalyticsSurface(): string {
    const {analyticsSurface} = this.props;
    return analyticsSurface == null ? 'n/a' : analyticsSurface;
  }

  _handleAddFile(
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void {
    addPath(filePath);
    track(`${ANALYTICS_PREFIX}-add-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  }

  _handleDeleteFile(
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void {
    confirmAndDeletePath(filePath);
    track(`${ANALYTICS_PREFIX}-delete-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  }

  _handleForgetFile(
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void {
    forgetPath(filePath);
    track(`${ANALYTICS_PREFIX}-forget-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  }

  _handleOpenFileInDiffView(
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void {
    openFileInDiffView(filePath);
    track(`${ANALYTICS_PREFIX}-file-in-diff-view`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  }

  _handleRevertFile(
    filePath: string,
    analyticsSource?: string = DEFAULT_ANALYTICS_SOURCE_KEY,
  ): void {
    const {getRevertTargetRevision} = this.props;
    let targetRevision = null;
    if (getRevertTargetRevision != null) {
      targetRevision = getRevertTargetRevision();
    }
    confirmAndRevertPath(filePath, targetRevision);
    track(`${ANALYTICS_PREFIX}-revert-file`, {
      source: analyticsSource,
      surface: this._getAnalyticsSurface(),
    });
  }

  render(): React.Element<any> {
    const {
      checkedFiles: checkedFilesByRoot,
      commandPrefix,
      enableFileExpansion,
      enableInlineActions,
      fileChanges: fileChangesByRoot,
      fileStatuses: fileStatusesByRoot,
      hideEmptyFolders,
      onFileChecked,
      onFileChosen,
      selectedFile,
    } = this.props;
    if (fileStatusesByRoot.size === 0) {
      return (
        <TreeList showArrows={true}><TreeItem>No changes</TreeItem></TreeList>
      );
      // The 'showArrows' is so CSS styling gives this the same indent as
      // real changes do (which themselves have showArrows=true).
    }
    const shouldShowFolderName = fileStatusesByRoot.size > 1;
    return (
      <div className="nuclide-ui-multi-root-file-tree-container">
        {Array.from(
          fileStatusesByRoot.entries(),
        ).map(([root, fileStatuses]) => {
          const fileChanges = fileChangesByRoot == null
            ? null
            : fileChangesByRoot.get(root);
          const checkedFiles = checkedFilesByRoot == null
            ? null
            : checkedFilesByRoot.get(root);
          return (
            <ChangedFilesList
              checkedFiles={checkedFiles}
              commandPrefix={commandPrefix}
              enableFileExpansion={enableFileExpansion === true}
              enableInlineActions={enableInlineActions === true}
              fileChanges={fileChanges}
              fileStatuses={fileStatuses}
              hideEmptyFolders={hideEmptyFolders}
              key={root}
              onAddFile={this._handleAddFile}
              onDeleteFile={this._handleDeleteFile}
              onFileChecked={onFileChecked}
              onFileChosen={onFileChosen}
              onForgetFile={this._handleForgetFile}
              onOpenFileInDiffView={this._handleOpenFileInDiffView}
              onRevertFile={this._handleRevertFile}
              rootPath={root}
              selectedFile={selectedFile}
              shouldShowFolderName={shouldShowFolderName}
            />
          );
        })}
      </div>
    );
  }

  componentWillUnmount(): void {
    this._subscriptions.dispose();
  }
}
