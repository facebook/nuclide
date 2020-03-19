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
import type {GeneratedFileType} from '../nuclide-generated-files-rpc';
import type {FileChangeStatusValue} from '../nuclide-vcs-base';

import addTooltip from 'nuclide-commons-ui/addTooltip';
import classnames from 'classnames';
import nuclideUri from 'nuclide-commons/nuclideUri';
import nullthrows from 'nullthrows';
import * as React from 'react';
import ChangedFile from './ChangedFile';

// Computes the minimally differentiable display path for each file.
// The algorithm is O(n*m^2) where n = filePaths.length and m = maximum number
// parts in a given path and the implementation is semi-optimized for
// performance.
//
// ['/a/b/c.js', '/a/d/c.js'] would return ['b/c.js', 'd/c.js']
// ['/a/b/c.js', '/a/b/d.js'] would return ['c.js', 'd.js']
// ['/a/b.js', '/c/a/b.js'] would return ['/a/b.js', 'c/a/b.js']
export function computeDisplayPaths(
  filePaths: Array<NuclideUri>,
  maxDepth: number = 5,
): Array<string> {
  const displayPaths = filePaths.map(path => {
    const separator = nuclideUri.pathSeparatorFor(path);
    return {
      separator,
      pathParts: path.split(separator).reverse(),
      depth: 1,
      done: false,
    };
  });

  let seenCount: {[NuclideUri]: number} = {};
  let currentDepth = 1;
  let toProcess = displayPaths;
  while (currentDepth < maxDepth && toProcess.length > 0) {
    // Compute number of times each display path is seen.
    toProcess.forEach(({pathParts, depth}) => {
      const path = pathParts.slice(0, depth).join('/');
      if (seenCount[path] == null) {
        seenCount[path] = 1;
      } else {
        seenCount[path]++;
      }
    });

    // Mark the display paths seen exactly once as done.
    // Increment the depth otherwise.
    toProcess.forEach(displayPath => {
      const {depth, pathParts} = displayPath;
      const path = pathParts.slice(0, depth).join('/');

      if (seenCount[path] === 1 || depth === pathParts.length) {
        displayPath.done = true;
      } else {
        displayPath.depth++;
      }
    });

    toProcess = toProcess.filter(displayPath => !displayPath.done);
    seenCount = {};
    currentDepth++;
  }

  return displayPaths.map(({separator, pathParts, depth}) =>
    pathParts
      .slice(0, depth)
      .reverse()
      .join(separator),
  );
}

const FILE_CHANGES_INITIAL_PAGE_SIZE = 50;
const GENERATED_TYPE_PRIORITY: Array<GeneratedFileType> = [
  'manual',
  'partial',
  'generated',
];

type Props = {
  rootPath: NuclideUri,
  shouldShowFolderName: boolean,
  selectedFile?: ?NuclideUri,
  fileStatuses: Map<NuclideUri, FileChangeStatusValue>,
  generatedTypes?: Map<NuclideUri, GeneratedFileType>,

  // List of files that have checked checkboxes next to their names. `null` -> no checkboxes
  checkedFiles?: ?Set<NuclideUri>,
  // Callback when a file's checkbox is toggled
  onFileChecked?: ?(filePath: NuclideUri) => mixed,

  onFileChosen(filePath: NuclideUri): mixed,
  onFileOpen?: ?(filePath: NuclideUri) => mixed,
  onFileOpenFolder?: ?(filePath: NuclideUri) => mixed,
  // Callbacks controlling what happens when certain icons are clicked
  // If null or undefined, icon won't appear
  onAddFile?: ?(filePath: NuclideUri) => mixed,
  onDeleteFile?: ?(filePath: NuclideUri) => mixed,
  onForgetFile?: ?(filePath: NuclideUri) => mixed,
  onMarkFileResolved?: ?(filePath: NuclideUri) => mixed,
  onOpenFileInDiffView?: ?(filePath: NuclideUri) => mixed,
  onRevertFile?: ?(filePath: NuclideUri) => mixed,
};

type State = {
  isCollapsed: boolean,
  visiblePagesCount: number,
};

export default class ChangedFilesList extends React.PureComponent<
  Props,
  State,
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isCollapsed: false,
      visiblePagesCount: 1,
    };
  }

  render(): React.Node {
    const {
      checkedFiles,
      fileStatuses,
      generatedTypes,
      onAddFile,
      onDeleteFile,
      onFileChecked,
      onFileChosen,
      onForgetFile,
      onMarkFileResolved,
      onFileOpen,
      onFileOpenFolder,
      onOpenFileInDiffView,
      onRevertFile,
      rootPath,
      selectedFile,
    } = this.props;
    onFileOpen;

    const filesToShow =
      FILE_CHANGES_INITIAL_PAGE_SIZE * this.state.visiblePagesCount;
    const filePaths = Array.from(fileStatuses.keys()).slice(0, filesToShow);
    const displayPaths = computeDisplayPaths(filePaths);
    const sizeLimitedFileChanges = filePaths
      .map((filePath, index) => {
        const generatedType =
          generatedTypes != null ? generatedTypes.get(filePath) : null;
        return {
          filePath,
          displayPath: displayPaths[index],
          fileStatus: nullthrows(fileStatuses.get(filePath)),
          generatedType,
        };
      })
      .sort((change1, change2) => {
        // Generated files always go after manually edited files
        if (change1.generatedType !== change2.generatedType) {
          return (
            GENERATED_TYPE_PRIORITY.indexOf(change1.generatedType) -
            GENERATED_TYPE_PRIORITY.indexOf(change2.generatedType)
          );
        }

        return nuclideUri
          .basename(change1.filePath)
          .localeCompare(nuclideUri.basename(change2.filePath));
      });

    const rootClassName = classnames('list-nested-item', {
      collapsed: this.state.isCollapsed,
    });

    const showMoreFilesElement =
      fileStatuses.size > filesToShow ? (
        <div
          className="icon icon-ellipsis"
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={addTooltip({
            title: 'Show more files with uncommitted changes',
            delay: 300,
            placement: 'bottom',
          })}
          onClick={() =>
            this.setState({
              // TODO: (wbinnssmith) T30771435 this setState depends on current state
              // and should use an updater function rather than an object
              // eslint-disable-next-line react/no-access-state-in-setstate
              visiblePagesCount: this.state.visiblePagesCount + 1,
            })
          }
        />
      ) : null;

    return (
      <ul className="list-tree has-collapsable-children nuclide-changed-files-list">
        <li className={rootClassName}>
          {this.props.shouldShowFolderName ? (
            <div
              className="list-item"
              key={this.props.rootPath}
              onClick={() =>
                // TODO: (wbinnssmith) T30771435 this setState depends on current state
                // and should use an updater function rather than an object
                // eslint-disable-next-line react/no-access-state-in-setstate
                this.setState({isCollapsed: !this.state.isCollapsed})
              }>
              <span
                className="icon icon-file-directory nuclide-file-changes-root-entry"
                data-path={this.props.rootPath}>
                {nuclideUri.basename(this.props.rootPath)}
              </span>
            </div>
          ) : null}
          <ul className="list-tree has-flat-children">
            {sizeLimitedFileChanges.map(
              ({displayPath, filePath, fileStatus, generatedType}) => {
                return (
                  <ChangedFile
                    displayPath={displayPath}
                    filePath={filePath}
                    fileStatus={fileStatus}
                    generatedType={generatedType}
                    isChecked={
                      checkedFiles == null ? null : checkedFiles.has(filePath)
                    }
                    isSelected={selectedFile === filePath}
                    key={filePath}
                    onFileOpen={onFileOpen}
                    onFileOpenFolder={onFileOpenFolder}
                    onAddFile={onAddFile}
                    onDeleteFile={onDeleteFile}
                    onFileChecked={onFileChecked}
                    onFileChosen={onFileChosen}
                    onForgetFile={onForgetFile}
                    onMarkFileResolved={onMarkFileResolved}
                    onOpenFileInDiffView={onOpenFileInDiffView}
                    onRevertFile={onRevertFile}
                    rootPath={rootPath}
                  />
                );
              },
            )}
            <li>{showMoreFilesElement}</li>
          </ul>
        </li>
      </ul>
    );
  }
}
