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

import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import React from 'react';

type NuclideListSelectorItem = {
  deletable?: boolean,
  displayTitle: string,
  id: string,
};

type Props = {
  items: Array<NuclideListSelectorItem>,
  // If null, no item is initially selected.
  idOfSelectedItem: ?string,
  onItemClicked: (idOfClickedItem: string) => mixed,
  onItemDoubleClicked: (idOfDoubleClickedItem: string) => mixed,
  // Function that is called when the "+" button on the list is clicked.
  // The user's intent is to create a new item for the list.
  onAddButtonClicked: () => mixed,
  // Function that is called when the "-" button on the list is clicked.
  // The user's intent is to delete the currently-selected item.
  // If the `idOfCurrentlySelectedItem` is null, this means there is
  // no item selected.
  onDeleteButtonClicked: (idOfCurrentlySelectedItem: ?string) => mixed,
};

const DELETE_BUTTON_TITLE_DEFAULT = 'Delete selected item';
const DELETE_BUTTON_TITLE_NONE = 'No item selected to delete';
const DELETE_BUTTON_TITLE_UNDELETABLE = 'Selected item cannot be deleted';

/**
 * A generic component that displays selectable list items, and offers
 * the ability to add and remove items. It looks roughly like the following:
 *
 *   - - - - -
 *  | Item 1  |
 *  |---------|
 *  | Item 2  |
 *  |---------|
 *  |         |
 *  |         |
 *  |---------|
 *  | +  |  - |
 *   ---------
 */
export class MutableListSelector extends React.Component {
  props: Props;

  _onDeleteButtonClicked = () => {
    this.props.onDeleteButtonClicked(this.props.idOfSelectedItem);
  };

  _onItemClicked(itemId: string) {
    this.props.onItemClicked(itemId);
  }

  _onItemDoubleClicked(itemId: string) {
    this.props.onItemDoubleClicked(itemId);
  }

  render(): ?React.Element<any> {
    let selectedItem;
    const listItems = this.props.items.map(item => {
      let classes = 'list-item';
      if (item.id === this.props.idOfSelectedItem) {
        classes += ' selected';
        selectedItem = item;
      }
      return (
        <li
          key={item.id}
          className={classes}
          onClick={this._onItemClicked.bind(this, item.id)}
          onDoubleClick={this._onItemDoubleClicked.bind(this, item.id)}
          tabIndex={0}>
          {item.displayTitle}
        </li>
      );
    });

    // Explain why the delete button is disabled if the current selection, or lack thereof, is
    // undeletable.
    let deleteButtonTitle;
    if (selectedItem == null) {
      deleteButtonTitle = DELETE_BUTTON_TITLE_NONE;
    } else if (selectedItem.deletable === false) {
      deleteButtonTitle = DELETE_BUTTON_TITLE_UNDELETABLE;
    } else {
      deleteButtonTitle = DELETE_BUTTON_TITLE_DEFAULT;
    }

    return (
      <div>
        <div className="block select-list">
          <ol className="list-group">
            {listItems}
          </ol>
        </div>
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <ButtonGroup>
            <Button
              disabled={
                selectedItem == null || selectedItem.deletable === false
              }
              onClick={this._onDeleteButtonClicked}
              title={deleteButtonTitle}>
              -
            </Button>
            <Button
              onClick={this.props.onAddButtonClicked}
              title="Create new item">
              +
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }
}
