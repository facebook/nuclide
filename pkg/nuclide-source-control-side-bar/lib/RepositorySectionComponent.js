'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {BookmarkInfo} from '../../nuclide-hg-rpc/lib/HgService';
import type {FileChangeStatusValue} from '../../nuclide-hg-git-bridge/lib/constants';
import type {NuclideUri} from '../../commons-node/NuclideUri';
import type {SelectableItem} from './SideBarComponent';

import bookmarkIsEqual from './bookmarkIsEqual';
import classnames from 'classnames';
import {HR} from '../../nuclide-ui/HR';
import invariant from 'assert';
import {MultiRootChangedFilesView} from '../../nuclide-ui/MultiRootChangedFilesView';
import {React} from 'react-for-atom';
import {Section} from '../../nuclide-ui/Section';
import url from 'url';

type Props = {
  bookmarks: ?Array<BookmarkInfo>,
  bookmarksIsLoading: ?Array<BookmarkInfo>,
  hasSeparator: boolean,
  onBookmarkClick: (
    bookmark: BookmarkInfo,
    repository: atom$Repository,
  ) => mixed,
  onBookmarkContextMenu: (
    bookmark: BookmarkInfo,
    repository: atom$Repository,
    event: SyntheticMouseEvent,
  ) => mixed,
  onRepoGearClick: (
    repository: atom$Repository,
    event: SyntheticMouseEvent,
  ) => mixed,
  repository: ?atom$Repository,
  selectedItem: ?SelectableItem,
  title: string,
  uncommittedChanges: Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>>,
};

type State = {
  uncommittedChangesExpanded: boolean,
};

const ACTIVE_BOOKMARK_TITLE = 'Active bookmark';
const LOADING_BOOKMARK_TITLE = 'Loading...';

export default class RepositorySectionComponent extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    (this: any)._handleBookmarkContextMenu = this._handleBookmarkContextMenu.bind(this);
    (this: any)._handleRepoGearClick = this._handleRepoGearClick.bind(this);
    (this: any)._handleUncommittedFilesExpandedChange =
      this._handleUncommittedFilesExpandedChange.bind(this);

    this.state = {
      uncommittedChangesExpanded: true,
    };
  }

  _handleBookmarkClick(bookmark: BookmarkInfo) {
    invariant(this.props.repository != null);
    this.props.onBookmarkClick(bookmark, this.props.repository);
  }

  _handleBookmarkContextMenu(bookmark: BookmarkInfo, event: SyntheticMouseEvent) {
    invariant(this.props.repository != null);
    this.props.onBookmarkContextMenu(bookmark, this.props.repository, event);
  }

  _handleRepoGearClick(event: SyntheticMouseEvent) {
    invariant(this.props.repository != null);
    this.props.onRepoGearClick(this.props.repository, event);
  }

  _onFileChosen(filePath: NuclideUri): void {
    const diffEntityOptions = {file: filePath};
    const formattedUrl = url.format({
      protocol: 'atom',
      host: 'nuclide',
      pathname: 'diff-view',
      slashes: true,
      query: diffEntityOptions,
    });

    atom.workspace.open(formattedUrl);
  }

  _handleUncommittedFilesExpandedChange(isCollapsed: boolean): void {
    this.setState({uncommittedChangesExpanded: !isCollapsed});
  }

  render(): React.Element<any> {
    const repository = this.props.repository;
    const selectedItem = this.props.selectedItem;

    let bookmarksBranchesHeader;
    let bookmarksBranchesList;
    let createButton;
    let uncommittedChangesSection;
    if (repository != null) {
      if (repository.getType() === 'hg') {
        bookmarksBranchesHeader = 'BOOKMARKS';
        createButton = (
          <button
            className="btn btn-sm icon icon-plus"
            onClick={this._handleRepoGearClick}
            style={{marginTop: '6px', position: 'absolute', right: '10px'}}
            title="Create bookmark..."
          />
        );
      } else if (repository.getType() === 'git') {
        bookmarksBranchesHeader = 'BRANCHES';
      } else {
        bookmarksBranchesHeader = `UNSUPPORTED REPOSITORY TYPE ${repository.getType()}`;
      }

      if (repository.getType() === 'hg') {
        let bookmarksBranchesListItems;
        const repositoryBookmarks = this.props.bookmarks;
        if (repositoryBookmarks == null) {
          bookmarksBranchesListItems = (
            <li className="list-item nuclide-source-control-side-bar--list-item text-subtle">
              Loading...
            </li>
          );
        } else if (repositoryBookmarks.length === 0) {
          bookmarksBranchesListItems = (
            <li className="list-item nuclide-source-control-side-bar--list-item text-subtle">
              None
            </li>
          );
        } else {
          bookmarksBranchesListItems = repositoryBookmarks.map(bookmark => {
            // If there is a list of "loading" bookmarks and this bookmark is in it, this bookmark
            // is in the "loading" state.
            const isLoading = this.props.bookmarksIsLoading != null &&
              this.props.bookmarksIsLoading.find(
                loadingBookmark => bookmarkIsEqual(bookmark, loadingBookmark)) != null;

            const isSelected = selectedItem != null
              && selectedItem.type === 'bookmark'
              && bookmarkIsEqual(bookmark, selectedItem.bookmark);
            const liClassName = classnames(
              'list-item nuclide-source-control-side-bar--list-item', {
                selected: isSelected,
              },
            );

            let title;
            if (bookmark.active) {
              title = ACTIVE_BOOKMARK_TITLE;
            } else if (isLoading) {
              title = LOADING_BOOKMARK_TITLE;
            }

            const iconClassName = classnames('icon', {
              // Don't display the icon when loading but still apply `.icon` because it affects
              // rendering of its content.
              'icon-bookmark': !bookmark.active && !isLoading,
              'icon-check': bookmark.active && !isLoading,
              'text-subtle': isLoading,
              // * Don't apply `success` when the bookmark is selected because the resulting text
              //   contrast ratio can be illegibly low in core themes.
              // * Don't apply `success` when it's loading like during a rename.
              'text-success': bookmark.active && !isSelected && !isLoading,
            });

            let loadingSpinner;
            if (isLoading) {
              loadingSpinner = (
                <span className="loading loading-spinner-tiny inline-block inline-block-tight" />
              );
            }

            let onContextMenu;
            if (!isLoading) {
              // When the bookmark is not loading, show its context menu so actions can be taken on
              // it.
              onContextMenu = this._handleBookmarkContextMenu.bind(this, bookmark);
            }

            return (
              <li
                className={liClassName}
                key={bookmark.bookmark}
                onClick={this._handleBookmarkClick.bind(this, bookmark)}
                onContextMenu={onContextMenu}
                title={title}>
                <span className={iconClassName}>
                  {loadingSpinner}
                  {bookmark.bookmark}
                </span>
              </li>
            );
          });
        }
        bookmarksBranchesList = (
          <ul className="list-group">
            {bookmarksBranchesListItems}
          </ul>
        );

        const uncommittedChanges = this.props.uncommittedChanges.get(repository.getPath());
        if (repository != null && uncommittedChanges != null && uncommittedChanges.size > 0) {
          uncommittedChangesSection = (
            <Section
              className="nuclide-file-tree-section-caption"
              collapsable={true}
              collapsed={!this.state.uncommittedChangesExpanded}
              headline="UNCOMMITTED CHANGES"
              onChange={this._handleUncommittedFilesExpandedChange}
              size="small">
              <div className="nuclide-source-control-side-bar-uncommitted-changes">
                <MultiRootChangedFilesView
                  fileChanges={this.props.uncommittedChanges}
                  rootPath={repository.getPath()}
                  commandPrefix="sc-sidebar"
                  selectedFile={null}
                  hideEmptyFolders={true}
                  shouldShowFolderName={false}
                  onFileChosen={this._onFileChosen}
                />
              </div>
            </Section>
          );
        }
      } else {
        bookmarksBranchesList = (
          <div className="nuclide-source-control-side-bar--header text-info">
            Only Mercurial repositories are supported. '{repository.getType()}' found.
          </div>
        );
      }
    }

    let separator;
    if (this.props.hasSeparator) {
      separator = <HR />;
    }

    return (
      <li>
        {separator}
        <h6 className="text-highlight nuclide-source-control-side-bar--repo-header">
          {this.props.title}
        </h6>
        <div className="nuclide-source-control-side-bar--header">
          {uncommittedChangesSection}
        </div>
        {createButton}
        <h6 className="nuclide-source-control-side-bar--header">
          {bookmarksBranchesHeader}
        </h6>
        {bookmarksBranchesList}
      </li>
    );
  }

}
