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
import type {IconName} from 'nuclide-commons-ui/Icon';

import {getLogger} from 'log4js';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import classnames from 'classnames';
import DraggableFile from 'nuclide-commons-ui/DraggableFile';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  FileChangeStatusToIcon,
  FileChangeStatusToLabel,
  FileChangeStatusToTextColor,
} from '../nuclide-vcs-base';
import * as React from 'react';
import {FileChangeStatus} from '../nuclide-vcs-base';
import {Icon} from 'nuclide-commons-ui/Icon';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import nullthrows from 'nullthrows';
import ReactDOM from 'react-dom';

const LF = '\u000A';
const COMMAND_PREFIX = 'changed-file';
const CONTEXT_MENU_KEY = 'context-menu';
const INLINE_KEY = 'inline';

type Props = {
  displayPath: string,
  filePath: NuclideUri,
  rootPath: NuclideUri,
  fileStatus: FileChangeStatusValue,
  generatedType: ?GeneratedFileType,
  isSelected: boolean,

  // Determines status of checkbox to left of the component. null -> no checkbox
  isChecked: ?boolean,
  // onFileChecked: What to do when the checkbox is toggled
  onFileChecked?: ?(filePath: NuclideUri) => mixed,

  onFileChosen(filePath: NuclideUri): mixed,
  // Controls 'Open file' context menu item, if null or omitted, menu item doesn't appear
  onFileOpen?: ?(filePath: NuclideUri) => mixed,
  onFileOpenFolder?: ?(filePath: NuclideUri) => mixed,
  // Callbacks controlling what happens when certain icons are clicked
  // If null or undefined, icon won't appear
  onAddFile?: ?(filePath: NuclideUri, analyticsSourceKey: string) => mixed,
  onDeleteFile?: ?(filePath: NuclideUri, analyticsSourceKey: string) => mixed,
  onForgetFile?: ?(filePath: NuclideUri, analyticsSourceKey: string) => mixed,
  onMarkFileResolved?: ?(
    filePath: NuclideUri,
    analyticsSourceKey: string,
  ) => mixed,
  onOpenFileInDiffView?: ?(
    filePath: NuclideUri,
    analyticsSourceKey: string,
  ) => mixed,
  onRevertFile?: ?(filePath: NuclideUri, analyticsSourceKey: string) => mixed,
};

export default class ChangedFile extends React.Component<Props> {
  _disposables: UniversalDisposable;

  componentDidMount(): void {
    const node: HTMLElement = (ReactDOM.findDOMNode(this): any);
    this._disposables = new UniversalDisposable(
      atom.commands.add(node, `${COMMAND_PREFIX}:open-file`, event => {
        const {filePath, onFileOpen} = this.props;
        if (onFileOpen != null) {
          onFileOpen(filePath);
        }
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:open-file-folder`, event => {
        const {filePath, onFileOpenFolder} = this.props;
        if (onFileOpenFolder != null) {
          onFileOpenFolder(filePath);
        }
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:copy-full-path`, event => {
        atom.clipboard.write(nuclideUri.getPath(this.props.filePath || ''));
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:delete-file`, event => {
        const {onDeleteFile, filePath} = this.props;
        if (onDeleteFile != null) {
          onDeleteFile(filePath, CONTEXT_MENU_KEY);
        }
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:copy-file-name`, event => {
        atom.clipboard.write(nuclideUri.basename(this.props.filePath || ''));
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:add`, event => {
        const {onAddFile, filePath} = this.props;
        if (onAddFile != null) {
          onAddFile(filePath, CONTEXT_MENU_KEY);
        }
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:revert`, event => {
        const {onRevertFile, filePath} = this.props;
        if (onRevertFile != null) {
          onRevertFile(filePath, CONTEXT_MENU_KEY);
        }
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:open-in-diff-view`, event => {
        const {onOpenFileInDiffView, filePath} = this.props;
        if (onOpenFileInDiffView != null) {
          onOpenFileInDiffView(filePath, CONTEXT_MENU_KEY);
        }
      }),
      atom.commands.add(node, `${COMMAND_PREFIX}:forget-file`, event => {
        const {onForgetFile, filePath} = this.props;
        if (onForgetFile != null) {
          onForgetFile(filePath, CONTEXT_MENU_KEY);
        }
      }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _getFileClassname(): string {
    const {fileStatus, generatedType, isSelected} = this.props;
    return classnames(
      'nuclide-changed-file',
      'list-item',
      'nuclide-path-with-terminal',
      this._generatedClass(generatedType),
      {
        selected: isSelected,
      },
      FileChangeStatusToTextColor[fileStatus],
    );
  }

  _generatedClass(generatedType: ?GeneratedFileType): ?string {
    switch (generatedType) {
      case 'generated':
        return 'generated-fully';
      case 'partial':
        return 'generated-partly';
      default:
        return null;
    }
  }

  _renderAction(
    key: string,
    icon: IconName,
    tooltipTitle: string,
    onClick: () => mixed,
  ): React.Node {
    return (
      <div
        className="nuclide-changed-file-action"
        key={key}
        onClick={onClick}
        // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
        ref={addTooltip({
          delay: 300,
          placement: 'top',
          title: tooltipTitle,
        })}>
        <Icon icon={icon} />
      </div>
    );
  }

  _renderForgetAction(filePath: string): React.Node {
    const {onForgetFile} = this.props;
    return onForgetFile != null
      ? this._renderAction(
          'forget' /* key */,
          'circle-slash' /* icon */,
          'Forget (stop tracking file in version control)' /* title */,
          onForgetFile.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _renderDeleteAction(filePath: string): React.Node {
    const {onDeleteFile} = this.props;
    return onDeleteFile != null
      ? this._renderAction(
          'delete' /* key */,
          'trashcan' /* icon */,
          'Delete file from file system' /* title */,
          onDeleteFile.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _renderResolveAction(filePath: string): React.Node {
    const {onMarkFileResolved} = this.props;
    return onMarkFileResolved
      ? this._renderAction(
          'resolve' /* key */,
          'check' /* icon */,
          'Mark file as resolved' /* title */,
          onMarkFileResolved.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _renderMarkDeletedAction(filePath: string): React.Node {
    const {onForgetFile} = this.props;
    return onForgetFile != null
      ? this._renderAction(
          'mark-deleted' /* key */,
          'circle-slash' /* icon */,
          'Mark file as deleted (remove from version control)' /* title */,
          onForgetFile.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _renderRestoreAction(filePath: string): React.Node {
    const {onRevertFile} = this.props;
    return onRevertFile != null
      ? this._renderAction(
          'restore' /* key */,
          'playback-rewind' /* icon */,
          'Restore file (revert to last known version)' /* title */,
          onRevertFile.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _renderAddAction(filePath: string): React.Node {
    const {onAddFile} = this.props;
    return onAddFile != null
      ? this._renderAction(
          'add' /* key */,
          'plus' /* icon */,
          'Add file to version control' /* title */,
          onAddFile.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _renderOpenInDiffViewAction(filePath: string): React.Node {
    const {onOpenFileInDiffView} = this.props;
    return onOpenFileInDiffView != null
      ? this._renderAction(
          'diff' /* key */,
          'diff' /* icon */,
          'Open file in Diff View' /* title */,
          onOpenFileInDiffView.bind(this, filePath, INLINE_KEY),
        )
      : null;
  }

  _onCheckboxChange = (isChecked: boolean): void => {
    nullthrows(this.props.onFileChecked)(this.props.filePath);
  };

  render(): React.Node {
    const {
      isChecked,
      displayPath,
      filePath,
      fileStatus,
      rootPath,
      onFileChosen,
      onFileOpen,
      onFileOpenFolder,
      onOpenFileInDiffView,
      onForgetFile,
      onDeleteFile,
      onAddFile,
      onRevertFile,
      onMarkFileResolved,
    } = this.props;

    const enableDiffView = onOpenFileInDiffView != null;
    const enableForget =
      onForgetFile != null && fileStatus === FileChangeStatus.ADDED;
    const enableDelete =
      onDeleteFile != null &&
      (fileStatus === FileChangeStatus.UNTRACKED ||
        fileStatus === FileChangeStatus.CHANGE_DELETE);
    const enableAdd =
      onAddFile != null && fileStatus === FileChangeStatus.UNTRACKED;
    const enableRestore =
      onRevertFile != null &&
      (fileStatus === FileChangeStatus.MISSING ||
        fileStatus === FileChangeStatus.MODIFIED ||
        fileStatus === FileChangeStatus.REMOVED);
    const enableMarkDeleted =
      onForgetFile != null && fileStatus === FileChangeStatus.MISSING;
    const enableResolve =
      onMarkFileResolved != null &&
      (fileStatus === FileChangeStatus.CHANGE_DELETE ||
        fileStatus === FileChangeStatus.BOTH_CHANGED);
    const enableOpen = onFileOpen != null;
    const enableOpenFolder = onFileOpenFolder != null;

    const eligibleActions = [];
    if (enableDiffView) {
      eligibleActions.push(this._renderOpenInDiffViewAction(filePath));
    }
    if (enableAdd) {
      eligibleActions.push(this._renderAddAction(filePath));
    }
    if (enableDelete) {
      eligibleActions.push(this._renderDeleteAction(filePath));
    }
    if (enableForget) {
      eligibleActions.push(this._renderForgetAction(filePath));
    }
    if (enableRestore) {
      eligibleActions.push(this._renderRestoreAction(filePath));
    }
    if (enableMarkDeleted) {
      eligibleActions.push(this._renderMarkDeletedAction(filePath));
    }
    if (enableResolve) {
      eligibleActions.push(this._renderResolveAction(filePath));
    }

    const actions =
      eligibleActions.length > 0 ? (
        <div className="nuclide-changed-file-actions">{eligibleActions}</div>
      ) : null;
    const handleFileChosen =
      onFileChosen != null ? () => onFileChosen(filePath) : null;

    const statusName = FileChangeStatusToLabel[fileStatus];
    const checkbox =
      isChecked != null ? (
        <Checkbox
          className="nuclide-changed-file-checkbox"
          checked={isChecked}
          onChange={this._onCheckboxChange}
        />
      ) : null;
    let relativePath = filePath;
    try {
      relativePath = nuclideUri.relative(rootPath, filePath);
    } catch (err) {
      getLogger('nuclide-ui').error(
        'ChangedFile failed to get relative path for %s, %s\nDid the cwd change? ',
        rootPath,
        filePath,
        err,
      );
    }
    const draggable = !(
      fileStatus === FileChangeStatus.MISSING ||
      fileStatus === FileChangeStatus.REMOVED
    );
    return (
      <li
        data-name={displayPath}
        data-path={filePath}
        data-root={this.props.rootPath}
        data-enable-diff-view={enableDiffView || null}
        data-enable-forget={enableForget || null}
        data-enable-delete={enableDelete || null}
        data-enable-add={enableAdd || null}
        data-enable-revert={enableRestore || null}
        data-enable-open={enableOpen || null}
        data-enable-open-folder={enableOpenFolder || null}
        className={this._getFileClassname()}
        key={filePath}>
        {checkbox}
        <DraggableFile
          draggable={draggable}
          trackingSource={'changed-file'}
          uri={filePath}
          className="nuclide-changed-file-name"
          onClick={handleFileChosen}>
          <Icon
            className="nuclide-changed-file-name-icon"
            icon={FileChangeStatusToIcon[fileStatus]}
          />
          <PathWithFileIcon
            path={displayPath}
            title={`${statusName}:${LF}${relativePath}${LF}(Click to open)`}
          />
        </DraggableFile>
        {actions}
      </li>
    );
  }
}

function getCommandTargetForEvent(event): Element {
  const {target} = event;
  return target.closest('.nuclide-changed-file') || target;
}

// this will currently never get GC'd, but should only ever be created once
// If this might become a problem, consider refcounting wrt ChangedFile instances
atom.contextMenu.add({
  '.nuclide-changed-file': [
    {type: 'separator'},
    {
      label: 'Add file to Mercurial',
      command: `${COMMAND_PREFIX}:add`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute('data-enable-add');
      },
    },
    {
      label: 'Open file in Diff View',
      command: `${COMMAND_PREFIX}:open-in-diff-view`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute(
          'data-enable-diff-view',
        );
      },
    },
    {
      label: 'Revert File',
      command: `${COMMAND_PREFIX}:revert`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute(
          'data-enable-revert',
        );
      },
    },
    {
      label: 'Delete File',
      command: `${COMMAND_PREFIX}:delete-file`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute(
          'data-enable-delete',
        );
      },
    },
    {
      label: 'Open File',
      command: `${COMMAND_PREFIX}:open-file`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute('data-enable-open');
      },
    },
    {
      label: 'Open Folder',
      command: `${COMMAND_PREFIX}:open-file-folder`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute(
          'data-enable-open-folder',
        );
      },
    },
    {
      label: 'Copy File Name',
      command: `${COMMAND_PREFIX}:copy-file-name`,
    },
    {
      label: 'Copy Full Path',
      command: `${COMMAND_PREFIX}:copy-full-path`,
    },
    {
      label: 'Forget file',
      command: `${COMMAND_PREFIX}:forget-file`,
      shouldDisplay: event => {
        return getCommandTargetForEvent(event).hasAttribute(
          'data-enable-forget',
        );
      },
    },
    {type: 'separator'},
  ],
});
