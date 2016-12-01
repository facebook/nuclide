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
import type {Directory} from 'atom';
import type {FileChangeStatusValue} from '../../nuclide-hg-git-bridge/lib/constants';
import type {NuclideUri} from '../../commons-node/NuclideUri';

import invariant from 'assert';
import {CompositeDisposable} from 'atom';
import electron from 'electron';
import CreateBookmarkModalComponent from './CreateBookmarkModalComponent';
import DeleteBookmarkModalComponent from './DeleteBookmarkModalComponent';
import {React, ReactDOM} from 'react-for-atom';
import RenameBookmarkModalComponent from './RenameBookmarkModalComponent';
import RepositorySectionComponent from './RepositorySectionComponent';
import url from 'url';

const {remote} = electron;
invariant(remote != null);

type Props = {
  createBookmark: (name: string, repo: atom$Repository) => mixed,
  deleteBookmark: (bookmark: BookmarkInfo, repo: atom$Repository) => mixed,
  projectBookmarks: Map<string, Array<BookmarkInfo>>,
  projectDirectories: Array<Directory>,
  projectRepositories: Map<string, atom$Repository>,
  renameBookmark: (bookmarkInfo: BookmarkInfo, nextName: string, repo: atom$Repository) => mixed,
  repositoryBookmarksIsLoading: WeakMap<atom$Repository, Array<BookmarkInfo>>,
  uncommittedChanges: Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>>,
  updateToBookmark: (bookmarkInfo: BookmarkInfo, repo: atom$Repository) => mixed,
};

type BookmarkItem = {
  bookmark: BookmarkInfo,
  repository: atom$Repository,
  type: 'bookmark',
};

type UncommittedChangesItem = {
  repository: atom$Repository,
  type: 'uncommitted',
};

export type SelectableItem = BookmarkItem | UncommittedChangesItem;

type State = {
  activeModalComponent?: ?Object,
  selectedItem?: SelectableItem,
};

export default class SideBarComponent extends React.Component {
  props: Props;
  state: State;

  _activeModalPanel: ?atom$Panel;
  _disposables: CompositeDisposable;
  _menuPopupTimeout: ?number;

  constructor(props: Props) {
    super(props);
    this._disposables = new CompositeDisposable();
    this.state = {};

    (this: any)._confirmCreateBookmark = this._confirmCreateBookmark.bind(this);
    (this: any)._confirmDeleteBookmark = this._confirmDeleteBookmark.bind(this);
    (this: any)._confirmRenameBookmark = this._confirmRenameBookmark.bind(this);
    (this: any)._destroyActiveModal = this._destroyActiveModal.bind(this);
    (this: any)._handleBookmarkClick = this._handleBookmarkClick.bind(this);
    (this: any)._handleBookmarkContextMenu = this._handleBookmarkContextMenu.bind(this);
    (this: any)._handleRepoGearClick = this._handleRepoGearClick.bind(this);
  }

  componentDidMount(): void {
    this._disposables.add(
      atom.commands.add('atom-workspace', 'core:cancel', this._destroyActiveModal),
    );
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (this.state.activeModalComponent !== prevState.activeModalComponent) {
      if (prevState.activeModalComponent != null) {
        this._destroyActiveModal();
      }
      if (this.state.activeModalComponent != null) {
        this._renderActiveModal();
      }
    }
  }

  componentWillUnmount() {
    this._destroyActiveModal();
    this._disposables.dispose();
    if (this._menuPopupTimeout != null) {
      clearTimeout(this._menuPopupTimeout);
    }
  }

  _confirmCreateBookmark(name: string, repo: atom$Repository): void {
    this.props.createBookmark(name, repo);
    this.setState({activeModalComponent: null});
  }

  _confirmDeleteBookmark(bookmark: BookmarkInfo, repo: atom$Repository): void {
    this.props.deleteBookmark(bookmark, repo);
    this.setState({activeModalComponent: null});
  }

  _confirmRenameBookmark(bookmark: BookmarkInfo, nextName: string, repo: atom$Repository): void {
    this.props.renameBookmark(bookmark, nextName, repo);
    this.setState({activeModalComponent: null});
  }

  _destroyActiveModal(): void {
    const panel = this._activeModalPanel;
    if (panel != null) {
      ReactDOM.unmountComponentAtNode(panel.getItem());
      panel.destroy();
      this._activeModalPanel = null;
    }
  }

  _renderActiveModal(): void {
    if (this.state.activeModalComponent == null) {
      return;
    }

    let panel = this._activeModalPanel;
    if (panel == null) {
      const item = document.createElement('div');
      panel = this._activeModalPanel = atom.workspace.addModalPanel({item});
    }

    ReactDOM.render(this.state.activeModalComponent, panel.getItem());
  }

  _handleBookmarkClick(bookmark: BookmarkInfo, repository: atom$Repository): void {
    this.setState({
      selectedItem: {
        bookmark,
        repository,
        type: 'bookmark',
      },
    });
    atom.workspace.open(url.format({
      hostname: 'view',
      protocol: 'fb-hg-smartlog',
      query: {
        repositoryPath: repository.getPath(),
      },
      slashes: true,
    }));
  }

  _handleBookmarkContextMenu(
    bookmark: BookmarkInfo,
    repository: atom$Repository,
    event: SyntheticMouseEvent,
  ): void {
    const menu = remote.Menu.buildFromTemplate([
      {
        click: () => {
          this.props.updateToBookmark(bookmark, repository);
        },
        enabled: !bookmark.active,
        label: `Update to ${bookmark.bookmark}`,
      },
      {type: 'separator'},
      {
        click: () => {
          this.setState({
            activeModalComponent: (
              <DeleteBookmarkModalComponent
                bookmark={bookmark}
                onCancel={() => { this.setState({activeModalComponent: null}); }}
                onDelete={this._confirmDeleteBookmark}
                repository={repository}
              />
            ),
          });
        },
        label: `Delete ${bookmark.bookmark}...`,
      },
      {
        click: () => {
          this.setState({
            activeModalComponent: (
              <RenameBookmarkModalComponent
                bookmark={bookmark}
                onCancel={() => { this.setState({activeModalComponent: null}); }}
                onRename={this._confirmRenameBookmark}
                repository={repository}
              />
            ),
          });
        },
        label: `Rename ${bookmark.bookmark}...`,
      },
    ]);

    // Store event position because React cleans up SyntheticEvent objects.
    // @see https://fb.me/react-event-pooling
    const clientX = event.clientX;
    const clientY = event.clientY;

    this.setState(
      {
        selectedItem: {
          bookmark,
          repository,
          type: 'bookmark',
        },
      },
      () => {
        // Circumvent Electron / OS X render blocking bug.
        // @see https://github.com/electron/electron/issues/1854
        this._menuPopupTimeout = setTimeout(() => {
          menu.popup(remote.getCurrentWindow(), clientX, clientY);
        }, 35);
      },
    );
  }

  _handleRepoGearClick(repo: atom$Repository, event: SyntheticMouseEvent): void {
    this.setState({
      activeModalComponent: (
        <CreateBookmarkModalComponent
          onCancel={() => { this.setState({activeModalComponent: null}); }}
          onCreate={this._confirmCreateBookmark}
          repo={repo}
        />
      ),
    });
  }

  render() {
    return (
      <div
        className="focusable-panel"
        style={{flex: 1, overflow: 'auto', position: 'relative', whiteSpace: 'normal'}}
        tabIndex="0">
        <ul className="list-unstyled">
          {this.props.projectDirectories.map((directory, index) => {
            const repository = this.props.projectRepositories.get(directory.getPath());
            const {uncommittedChanges} = this.props;
            const repositoryBookmarksIsLoading = (repository == null)
              ? null
              : this.props.repositoryBookmarksIsLoading.get(repository);

            const uncommittedChangesForDirectory = new Map();
            let bookmarks;
            let selectedItem;
            if (repository != null) {
              bookmarks = this.props.projectBookmarks.get(repository.getPath());
              if (
                this.state.selectedItem != null
                && this.state.selectedItem.repository === repository
              ) {
                selectedItem = this.state.selectedItem;
              }

              uncommittedChangesForDirectory.set(
                repository.getPath(),
                uncommittedChanges.get(directory.getPath()) || new Map(),
              );
            }

            return (
              <RepositorySectionComponent
                bookmarks={bookmarks}
                bookmarksIsLoading={repositoryBookmarksIsLoading}
                hasSeparator={index > 0}
                key={directory.getPath()}
                onBookmarkClick={this._handleBookmarkClick}
                onBookmarkContextMenu={this._handleBookmarkContextMenu}
                onRepoGearClick={this._handleRepoGearClick}
                repository={repository}
                selectedItem={selectedItem}
                title={directory.getBaseName()}
                uncommittedChanges={uncommittedChangesForDirectory}
              />
            );
          })}
        </ul>
      </div>
    );
  }
}
