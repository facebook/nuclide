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
import type {GeneratedFileType} from '../../nuclide-generated-files-rpc';
import type {Store} from '../lib/types';

import DraggableFile from 'nuclide-commons-ui/DraggableFile';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as React from 'react';
import classnames from 'classnames';
import {PanelComponentScroller} from 'nuclide-commons-ui/PanelComponentScroller';
import * as FileTreeHelpers from '../lib/FileTreeHelpers';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';
import {TreeList, TreeItem, NestedTreeItem} from 'nuclide-commons-ui/Tree';
import {DragResizeContainer} from 'nuclide-commons-ui/DragResizeContainer';
import {track} from 'nuclide-analytics';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {computeDisplayPaths} from '../../nuclide-ui/ChangedFilesList';
import * as Selectors from '../lib/redux/Selectors';
import * as Actions from '../lib/redux/Actions';
import {createSelector} from 'reselect';
import Immutable from 'immutable';

type OpenFileEntry = {
  name: string,
  uri: NuclideUri,
  isModified: boolean,
  isSelected: boolean,
  generatedType: ?GeneratedFileType,
};

type Props = {
  uris: Array<NuclideUri>,
  modifiedUris: Array<NuclideUri>,
  generatedTypes: Immutable.Map<NuclideUri, GeneratedFileType>,
  activeUri: ?NuclideUri,
  store: Store,
};

type State = {
  hoveredUri: ?NuclideUri,
  selectedUri: ?NuclideUri,
};

export class OpenFilesListComponent extends React.PureComponent<Props, State> {
  _selectedRow: ?TreeItem;

  constructor(props: Props) {
    super(props);
    this.state = {
      hoveredUri: null,
      selectedUri: null,
    };
  }

  componentDidUpdate(prevProps: Props): void {
    const selectedRow = this._selectedRow;
    if (
      selectedRow != null &&
      this.state.selectedUri !== this.props.activeUri &&
      prevProps.activeUri !== this.props.activeUri
    ) {
      // Our lint rule isn't smart enough to recognize that this is a custom method and not the one
      // on HTMLElements, so we just have to squelch the error.
      // eslint-disable-next-line nuclide-internal/dom-apis
      selectedRow.scrollIntoView();
    }
  }

  _onMouseDown(entry: OpenFileEntry, event: SyntheticMouseEvent<>) {
    event.stopPropagation();
    const rootNode = Selectors.getRootForPath(
      this.props.store.getState(),
      entry.uri,
    );
    if (
      FileTreeHelpers.getSelectionMode(event) === 'single-select' &&
      !entry.isSelected &&
      rootNode != null
    ) {
      this.props.store.dispatch(
        Actions.setTargetNode(rootNode.rootUri, entry.uri),
      );
      this.setState({selectedUri: entry.uri});
    }
  }

  _onSelect(entry: OpenFileEntry, event: SyntheticMouseEvent<>): void {
    if (event.defaultPrevented) {
      return;
    }

    const uri = entry.uri;

    if (event.button === 1) {
      this._closeFile(uri);
      return;
    }

    track('filetree-open-from-open-files', {uri});
    goToLocation(uri, {activatePane: false});
  }

  _onConfirm(entry: OpenFileEntry, event: SyntheticMouseEvent<>): void {
    goToLocation(entry.uri);
  }

  _onCloseClick(entry: OpenFileEntry, event: SyntheticEvent<>): void {
    const uri = entry.uri;
    event.preventDefault();
    this._closeFile(uri);
  }

  _closeFile(uri: NuclideUri): void {
    track('filetree-close-from-open-files', {uri});
    atom.workspace.getPanes().forEach(pane => {
      pane
        .getItems()
        .filter(item => item.getPath && item.getPath() === uri)
        .forEach(item => {
          pane.destroyItem(item);
        });
    });
  }

  _onListItemMouseEnter(entry: OpenFileEntry) {
    this.setState({
      hoveredUri: entry.uri,
    });
  }

  _onListItemMouseLeave = () => {
    this.setState({
      hoveredUri: null,
    });
  };

  _handleSelectedRow = (treeItem: ?TreeItem): void => {
    this._selectedRow = treeItem;
  };

  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _getDisplayNames = createSelector([(props: Props) => props.uris], x => {
    return computeDisplayPaths(x);
  });

  propsToEntries(): Array<OpenFileEntry> {
    const displayPaths = this._getDisplayNames(this.props);
    const entries = this.props.uris.map((uri, index) => {
      const isModified = this.props.modifiedUris.indexOf(uri) >= 0;
      const isSelected = uri === this.props.activeUri;
      const generatedType = this.props.generatedTypes.get(uri);
      return {
        uri,
        name: displayPaths[index],
        isModified,
        isSelected,
        generatedType,
      };
    });

    // Sort by file name (see https://fb.facebook.com/groups/nuclideintfeedback/permalink/1883372318378041/)
    entries.sort((e1, e2) =>
      nuclideUri.basename(e1.uri).localeCompare(nuclideUri.basename(e2.uri)),
    );
    return entries;
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

  render(): React.Node {
    const sortedEntries = this.propsToEntries();

    return (
      <DragResizeContainer>
        <div className="nuclide-file-tree-open-files">
          <PanelComponentScroller>
            {/* simulate a once-nested list to share styles those with others
            that require a single level of indentation */}
            <TreeList showArrows className="nuclide-file-tree-open-files-list">
              <NestedTreeItem hasFlatChildren>
                {sortedEntries.map(e => {
                  const isHoveredUri = this.state.hoveredUri === e.uri;
                  return (
                    <TreeItem
                      className={classnames(
                        'file',
                        'nuclide-path-with-terminal',
                        this._generatedClass(e.generatedType),
                        {
                          'text-highlight': isHoveredUri,
                        },
                      )}
                      selected={e.isSelected}
                      key={e.uri}
                      onConfirm={this._onConfirm.bind(this, e)}
                      onSelect={this._onSelect.bind(this, e)}
                      onMouseEnter={this._onListItemMouseEnter.bind(this, e)}
                      onMouseLeave={this._onListItemMouseLeave}
                      onMouseDown={this._onMouseDown.bind(this, e)}
                      path={e.uri}
                      name={e.name}
                      // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
                      ref={e.isSelected ? this._handleSelectedRow : null}>
                      <DraggableFile uri={e.uri} trackingSource="open-files">
                        <span
                          className={classnames('icon', {
                            'icon-primitive-dot': e.isModified && !isHoveredUri,
                            'icon-x': isHoveredUri || !e.isModified,
                            'text-info': e.isModified,
                          })}
                          onClick={this._onCloseClick.bind(this, e)}
                        />
                        <PathWithFileIcon path={e.name} />
                      </DraggableFile>
                    </TreeItem>
                  );
                })}
              </NestedTreeItem>
            </TreeList>
          </PanelComponentScroller>
        </div>
      </DragResizeContainer>
    );
  }
}
