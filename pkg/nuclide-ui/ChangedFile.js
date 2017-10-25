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
import type {IconName} from 'nuclide-commons-ui/Icon';

import addTooltip from 'nuclide-commons-ui/addTooltip';
import classnames from 'classnames';
import {getAtomProjectRelativePath} from 'nuclide-commons-atom/projects';
import {
  FileChangeStatusToIcon,
  FileChangeStatusToLabel,
  FileChangeStatusToTextColor,
} from '../nuclide-vcs-base';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as React from 'react';
import {FileChangeStatus} from '../nuclide-vcs-base';
import {Icon} from 'nuclide-commons-ui/Icon';
import PathWithFileIcon from './PathWithFileIcon';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';

const ANALYTICS_SOURCE_KEY = 'inline';
const LF = '\u000A';
type Props = {
  commandPrefix: string,
  // whether files can be expanded to reveal a diff of changes. Requires passing `fileChanges`.
  // TODO: remove disable
  // eslint-disable-next-line react/no-unused-prop-types
  enableFileExpansion: boolean,
  enableInlineActions: boolean,
  // `null` values for FileDiffs for a given key are assumed to be in "loading" state.
  // TODO: remove disable
  // eslint-disable-next-line react/no-unused-prop-types
  fileChanges: ?diffparser$FileDiff,
  filePath: NuclideUri,
  fileStatus: FileChangeStatusValue,
  // Determines status of checkbox to left of the component. null -> no checkbox
  isChecked: ?boolean,
  isHgPath: boolean,
  isSelected: boolean,
  onAddFile: (filePath: NuclideUri, analyticsSourceKey: string) => void,
  onDeleteFile: (filePath: NuclideUri, analyticsSourceKey: string) => void,
  // onFileChecked: What to do when the checkbox is toggled
  onFileChecked: (filePath: NuclideUri) => void,
  onFileChosen: (filePath: NuclideUri) => void,
  onForgetFile: (filePath: NuclideUri, analyticsSourceKey: string) => void,
  onMarkFileResolved?: (
    filePath: NuclideUri,
    analyticsSourceKey: string,
  ) => void,
  onOpenFileInDiffView: (
    filePath: NuclideUri,
    analyticsSourceKey: string,
  ) => void,
  openInDiffViewOption: boolean,
  onRevertFile: (filePath: NuclideUri, analyticsSourceKey: string) => void,
  rootPath: NuclideUri,
};

export default class ChangedFile extends React.Component<Props> {
  _getFileClassname(): string {
    const {commandPrefix, fileStatus, isHgPath, isSelected} = this.props;
    return classnames(
      'nuclide-changed-file',
      'list-item',
      {
        selected: isSelected,
        [`${commandPrefix}-file-entry`]: isHgPath,
      },
      FileChangeStatusToTextColor[fileStatus],
    );
  }

  _renderAction(
    key: string,
    icon: IconName,
    tooltipTitle: string,
    onClick: () => void,
  ): React.Element<any> {
    return (
      <div
        className="nuclide-changed-file-action"
        key={key}
        onClick={onClick}
        ref={addTooltip({
          delay: 300,
          placement: 'top',
          title: tooltipTitle,
        })}>
        <Icon icon={icon} />
      </div>
    );
  }

  _renderForgetAction(filePath: string): React.Element<any> {
    return this._renderAction(
      'forget' /* key */,
      'circle-slash' /* icon */,
      'Forget (stop tracking file in version control)' /* title */,
      this.props.onForgetFile.bind(this, filePath, ANALYTICS_SOURCE_KEY),
    );
  }

  _renderDeleteAction(filePath: string): React.Element<any> {
    return this._renderAction(
      'delete' /* key */,
      'trashcan' /* icon */,
      'Delete file from file system' /* title */,
      this.props.onDeleteFile.bind(this, filePath, ANALYTICS_SOURCE_KEY),
    );
  }

  _renderResolveAction(filePath: string): ?React.Element<any> {
    return this.props.onMarkFileResolved
      ? this._renderAction(
          'resolve' /* key */,
          'check' /* icon */,
          'Mark file as resolved' /* title */,
          this.props.onMarkFileResolved.bind(
            this,
            filePath,
            ANALYTICS_SOURCE_KEY,
          ),
        )
      : null;
  }

  _renderMarkDeletedAction(filePath: string): React.Element<any> {
    return this._renderAction(
      'mark-deleted' /* key */,
      'circle-slash' /* icon */,
      'Mark file as deleted (remove from version control)' /* title */,
      this.props.onForgetFile.bind(this, filePath, ANALYTICS_SOURCE_KEY),
    );
  }

  _renderRestoreAction(filePath: string): React.Element<any> {
    return this._renderAction(
      'restore' /* key */,
      'playback-rewind' /* icon */,
      'Restore file (revert to last known version)' /* title */,
      this.props.onRevertFile.bind(this, filePath, ANALYTICS_SOURCE_KEY),
    );
  }

  _renderAddAction(filePath: string): React.Element<any> {
    return this._renderAction(
      'add' /* key */,
      'plus' /* icon */,
      'Add file to version control' /* title */,
      this.props.onAddFile.bind(this, filePath, ANALYTICS_SOURCE_KEY),
    );
  }

  _renderOpenInDiffViewAction(filePath: string): ?React.Element<any> {
    return this.props.openInDiffViewOption
      ? this._renderAction(
          'diff' /* key */,
          'diff' /* icon */,
          'Open file in Diff View' /* title */,
          this.props.onOpenFileInDiffView.bind(
            this,
            filePath,
            ANALYTICS_SOURCE_KEY,
          ),
        )
      : null;
  }

  _onCheckboxChange = (isChecked: boolean): void => {
    this.props.onFileChecked(this.props.filePath);
  };

  render(): React.Node {
    const {
      enableInlineActions,
      isChecked,
      isHgPath,
      filePath,
      fileStatus,
    } = this.props;
    const baseName = nuclideUri.basename(filePath);
    let actions;
    if (enableInlineActions && isHgPath) {
      const eligibleActions = [this._renderOpenInDiffViewAction(filePath)];
      switch (fileStatus) {
        case FileChangeStatus.ADDED:
          eligibleActions.push(
            this._renderForgetAction(filePath),
            this._renderDeleteAction(filePath),
          );
          break;
        case FileChangeStatus.UNTRACKED:
          eligibleActions.push(
            this._renderAddAction(filePath),
            this._renderDeleteAction(filePath),
          );
          break;
        case FileChangeStatus.MISSING: // removed from FS but not VCS
          eligibleActions.push(
            this._renderRestoreAction(filePath),
            this._renderMarkDeletedAction(filePath),
          );
          break;
        case FileChangeStatus.MODIFIED:
        case FileChangeStatus.REMOVED: // removed from both FS and VCS
          eligibleActions.push(this._renderRestoreAction(filePath));
          break;
        case FileChangeStatus.CHANGE_DELETE:
          eligibleActions.push(this._renderDeleteAction(filePath));
          eligibleActions.push(this._renderResolveAction(filePath));
          break;
      }
      actions = (
        <div className="nuclide-changed-file-actions">{eligibleActions}</div>
      );
    }
    const statusName = FileChangeStatusToLabel[fileStatus];
    const projectRelativePath =
      getAtomProjectRelativePath(filePath) || filePath;
    const checkbox =
      isChecked != null ? (
        <Checkbox
          className="nuclide-changed-file-checkbox"
          checked={isChecked}
          onChange={this._onCheckboxChange}
        />
      ) : null;
    return (
      <li
        data-name={baseName}
        data-path={filePath}
        data-root={this.props.rootPath}
        className={this._getFileClassname()}
        key={filePath}>
        {checkbox}
        <span
          className="nuclide-changed-file-name"
          onClick={() => this.props.onFileChosen(filePath)}>
          <Icon
            className="nuclide-changed-file-name-icon"
            icon={FileChangeStatusToIcon[fileStatus]}
          />
          <PathWithFileIcon
            path={baseName}
            title={`${statusName}:${LF}${projectRelativePath}${LF}(Click to open in Nuclide)`}
          />
        </span>
        {actions}
      </li>
    );
  }
}
