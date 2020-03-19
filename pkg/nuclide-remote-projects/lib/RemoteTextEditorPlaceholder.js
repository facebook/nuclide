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

import type {HgRepositoryDescription} from '../../nuclide-source-control-helpers/lib/types';

import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as React from 'react';
import RemoteTextEditorPlaceholderComponent from './RemoteTextEditorPlaceholderComponent';

export type RemoteTextEditorPlaceholderState = {
  deserializer: 'RemoteTextEditorPlaceholder',
  data: {
    uri: string,
    contents: string,
    // If the editor was unsaved, we'll restore the unsaved contents after load.
    isModified: boolean,
    repositoryDescription: ?HgRepositoryDescription,
  },
};

export class TextEditor implements atom$PaneItem {
  _uri: string;
  _contents: string;
  _isModified: boolean;
  _repositoryDescription: ?HgRepositoryDescription;

  constructor({data}: RemoteTextEditorPlaceholderState) {
    this._uri = data.uri;
    this._contents = data.contents;
    this._isModified = data.isModified;
    this._repositoryDescription = data.repositoryDescription;
  }

  destroy() {}

  serialize(): RemoteTextEditorPlaceholderState {
    return {
      deserializer: 'RemoteTextEditorPlaceholder',
      data: {
        uri: this._uri,
        contents: this._contents,
        // If the editor was unsaved, we'll restore the unsaved contents after load.
        isModified: this._isModified,
        repositoryDescription: this._repositoryDescription,
      },
    };
  }

  getTitle(): string {
    return nuclideUri.basename(this._uri);
  }

  // This shouldn't *exactly* match the real URI.
  // Otherwise it makes it difficult to swap it out for the real editor.
  getURI(): string {
    return this._uri.replace('nuclide://', 'nuclide-placeholder://');
  }

  getPath(): string {
    return this._uri;
  }

  getRepositoryDescription(): ?HgRepositoryDescription {
    return this._repositoryDescription;
  }

  getText(): string {
    return this._contents;
  }

  isModified(): boolean {
    return this._isModified;
  }

  getElement(): HTMLElement {
    return renderReactRoot(
      <RemoteTextEditorPlaceholderComponent
        contents={this._contents}
        uri={this._uri}
      />,
    );
  }
}

// We name the class "TextEditor" because Atom uses the constructor name as the `data-type`
// attribute of the tab and themes style that. We want to make sure that these themes style our tab
// like text editor tabs.
export const RemoteTextEditorPlaceholder = TextEditor;
