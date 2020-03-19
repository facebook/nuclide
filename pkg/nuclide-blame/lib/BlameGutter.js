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

import type {RevisionInfo} from '../../nuclide-hg-rpc/lib/types';
import type {BlameForEditor, BlameProvider} from './types';

import addTooltip from 'nuclide-commons-ui/addTooltip';
import hideAllTooltips from '../../nuclide-ui/hide-all-tooltips';
import {track, trackTiming} from 'nuclide-analytics';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {shell} from 'electron';
import escapeHTML from 'escape-html';
import * as React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {shortNameForAuthor} from '../../nuclide-vcs-log';

const BLAME_DECORATION_CLASS = 'blame-decoration';

let Avatar;
try {
  // $FlowFB
  Avatar = require('../../nuclide-ui/fb-Avatar').default;
} catch (err) {
  Avatar = null;
}

let getEmployeeIdentifierFromAuthorString: string => string;
try {
  // $FlowFB
  getEmployeeIdentifierFromAuthorString = require('fb-vcs-common')
    .getEmployeeIdentifierFromAuthorString;
} catch (err) {
  getEmployeeIdentifierFromAuthorString = shortNameForAuthor;
}

function getHash(revision: ?RevisionInfo): ?string {
  if (revision == null) {
    return null;
  }
  return revision.hash;
}

export default class BlameGutter {
  _editor: atom$TextEditor;
  _blameProvider: BlameProvider;
  _bufferLineToDecoration: Map<number, atom$Decoration>;
  _gutter: atom$Gutter;
  _loadingSpinnerDiv: ?HTMLElement;
  _isDestroyed: boolean;
  _isEditorDestroyed: boolean;
  _subscriptions: UniversalDisposable;

  /**
   * @param gutterName A name for this gutter. Must not be used by any another
   *   gutter in this TextEditor.
   * @param editor The TextEditor this BlameGutter should create UI for.
   * @param blameProvider The BlameProvider that provides the appropriate blame
   *   information for this BlameGutter.
   */
  constructor(
    gutterName: string,
    editor: atom$TextEditor,
    blameProvider: BlameProvider,
  ) {
    this._isDestroyed = false;
    this._isEditorDestroyed = false;

    this._subscriptions = new UniversalDisposable();
    this._editor = editor;
    this._blameProvider = blameProvider;
    this._bufferLineToDecoration = new Map();
    // Priority is -200 by default and 0 is the line number
    this._gutter = editor.addGutter({name: gutterName, priority: -1200});

    this._subscriptions.add(
      editor.onDidDestroy(() => {
        this._isEditorDestroyed = true;
        this.destroy();
      }),
    );
    const editorView = atom.views.getView(editor);
    this._subscriptions.add(
      editorView.onDidChangeScrollTop(() => {
        hideAllTooltips();
      }),
    );
    this._fetchAndDisplayBlame();
  }

  async _onClick(revision: RevisionInfo): Promise<void> {
    const blameProvider = this._blameProvider;
    if (typeof blameProvider.getUrlForRevision !== 'function') {
      return;
    }

    const url = await blameProvider.getUrlForRevision(
      this._editor,
      revision.hash,
    );
    // flowlint-next-line sketchy-null-string:off
    if (url) {
      // Note that 'shell' is not the public 'shell' package on npm but an Atom built-in.
      shell.openExternal(url);
    } else {
      atom.notifications.addWarning(`No URL found for ${revision.hash}.`);
    }

    track('blame-gutter-click-revision', {
      editorPath: this._editor.getPath() || '',
      url: url || '',
    });
  }

  async _fetchAndDisplayBlame(): Promise<void> {
    // Add a loading spinner while we fetch the blame.
    this._addLoadingSpinner();

    let newBlame;
    try {
      newBlame = await this._blameProvider.getBlameForEditor(this._editor);
    } catch (error) {
      atom.notifications.addError(
        'Failed to fetch blame to display. ' +
          'The file is empty or untracked or the repository cannot be reached.',
        {detail: error},
      );
      atom.commands.dispatch(
        atom.views.getView(this._editor),
        'nuclide-blame:hide-blame',
      );
      return;
    }
    // The BlameGutter could have been destroyed while blame was being fetched.
    if (this._isDestroyed) {
      return;
    }

    // Remove the loading spinner before setting the contents of the blame gutter.
    this._cleanUpLoadingSpinner();

    this._updateBlame(newBlame);
  }

  _addLoadingSpinner(): void {
    if (this._loadingSpinnerDiv) {
      return;
    }
    const gutterView = atom.views.getView(this._gutter);
    this._loadingSpinnerDiv = document.createElement('div');
    this._loadingSpinnerDiv.className = 'nuclide-blame-spinner';
    gutterView.appendChild(this._loadingSpinnerDiv);
    gutterView.classList.add('nuclide-blame-loading');
  }

  _cleanUpLoadingSpinner(): void {
    if (this._loadingSpinnerDiv) {
      this._loadingSpinnerDiv.remove();
      this._loadingSpinnerDiv = null;
      const gutterView = atom.views.getView(this._gutter);
      gutterView.classList.remove('nuclide-blame-loading');
    }
  }

  destroy(): void {
    this._isDestroyed = true;
    this._cleanUpLoadingSpinner();
    if (!this._isEditorDestroyed) {
      // Due to a bug in the Gutter API, destroying a Gutter after the editor
      // has been destroyed results in an exception.
      this._gutter.destroy();
    }
    // Remove all the lines
    for (const lineNumber of this._bufferLineToDecoration.keys()) {
      this._removeBlameLine(lineNumber);
    }
  }

  _updateBlame(blameForEditor: BlameForEditor): void {
    return trackTiming('blame-ui.blame-gutter.updateBlame', () =>
      this.__updateBlame(blameForEditor),
    );
  }

  // The BlameForEditor completely replaces any previous blame information.
  __updateBlame(blameForEditor: BlameForEditor): void {
    if (blameForEditor.length === 0) {
      atom.notifications.addInfo(
        `Found no blame to display. Is this file empty or untracked?
          If not, check for errors in the Nuclide logs local to your repo.`,
      );
    }
    const allPreviousBlamedLines = new Set(this._bufferLineToDecoration.keys());

    let oldest = Number.POSITIVE_INFINITY;
    let newest = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < blameForEditor.length; ++i) {
      const revision = blameForEditor[i];
      if (!revision) {
        continue;
      }
      const date = Number(revision.date);
      if (date < oldest) {
        oldest = date;
      }
      if (date > newest) {
        newest = date;
      }
    }

    for (let bufferLine = 0; bufferLine < blameForEditor.length; ++bufferLine) {
      const hash = getHash(blameForEditor[bufferLine]);
      const isFirstLine = hash !== getHash(blameForEditor[bufferLine - 1]);
      const isLastLine = hash !== getHash(blameForEditor[bufferLine + 1]);

      const blameInfo = blameForEditor[bufferLine];
      if (blameInfo) {
        this._setBlameLine(
          bufferLine,
          blameInfo,
          isFirstLine,
          isLastLine,
          oldest,
          newest,
        );
      }
      allPreviousBlamedLines.delete(bufferLine);
    }

    // Any lines that weren't in the new blameForEditor are outdated.
    for (const oldLine of allPreviousBlamedLines) {
      this._removeBlameLine(oldLine);
    }
  }

  _setBlameLine(
    bufferLine: number,
    revision: RevisionInfo,
    isFirstLine: boolean,
    isLastLine: boolean,
    oldest: number,
    newest: number,
  ): void {
    const item = this._createGutterItem(
      revision,
      isFirstLine,
      isLastLine,
      oldest,
      newest,
    );
    const decorationProperties = {
      type: 'gutter',
      gutterName: this._gutter.name,
      class: BLAME_DECORATION_CLASS,
      item,
    };

    let decoration = this._bufferLineToDecoration.get(bufferLine);
    if (!decoration) {
      const marker = this._editor.markBufferRange(
        [[bufferLine, 0], [bufferLine, 100000]],
        {invalidate: 'touch'},
      );

      decoration = this._editor.decorateMarker(marker, decorationProperties);
      this._bufferLineToDecoration.set(bufferLine, decoration);
    } else {
      ReactDOM.unmountComponentAtNode(decoration.getProperties().item);
      decoration.setProperties(decorationProperties);
    }
  }

  _removeBlameLine(bufferLine: number): void {
    const blameDecoration = this._bufferLineToDecoration.get(bufferLine);
    if (!blameDecoration) {
      return;
    }
    ReactDOM.unmountComponentAtNode(blameDecoration.getProperties().item);
    // The recommended way of destroying a decoration is by destroying its marker.
    blameDecoration.getMarker().destroy();
    this._bufferLineToDecoration.delete(bufferLine);
  }

  _createGutterItem(
    blameInfo: RevisionInfo,
    isFirstLine: boolean,
    isLastLine: boolean,
    oldest: number,
    newest: number,
  ): HTMLElement {
    const item = document.createElement('div');

    item.addEventListener('click', () => {
      this._onClick(blameInfo);
    });

    ReactDOM.render(
      <GutterElement
        revision={blameInfo}
        isFirstLine={isFirstLine}
        isLastLine={isLastLine}
        oldest={oldest}
        newest={newest}
      />,
      item,
    );
    return item;
  }
}

type Props = {
  revision: RevisionInfo,
  isFirstLine: boolean,
  isLastLine: boolean,
  oldest: number,
  newest: number,
};

class GutterElement extends React.Component<Props> {
  render(): React.Node {
    const {oldest, newest, revision, isLastLine, isFirstLine} = this.props;
    const date = Number(revision.date);

    const alpha = 1 - (date - newest) / (oldest - newest);
    const opacity = 0.2 + 0.8 * alpha;

    if (isFirstLine) {
      const employeeIdentifier = getEmployeeIdentifierFromAuthorString(
        revision.author,
      );
      const tooltip = {
        title:
          escapeHTML(revision.title) +
          '<br />' +
          escapeHTML(employeeIdentifier) +
          ' &middot; ' +
          escapeHTML(revision.date.toDateString()),
        delay: 0,
        placement: 'right',
      };

      return (
        <div
          className="nuclide-blame-row nuclide-blame-content"
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={addTooltip(tooltip)}>
          {!isLastLine ? (
            <div className="nuclide-blame-vertical-bar nuclide-blame-vertical-bar-first" />
          ) : null}
          {Avatar ? (
            <Avatar size={16} employeeIdentifier={employeeIdentifier} />
          ) : (
            employeeIdentifier + ': '
          )}
          <span>{revision.title}</span>
          <div style={{opacity}} className="nuclide-blame-border-age" />
        </div>
      );
    }

    return (
      <div className="nuclide-blame-row">
        <div
          className={classnames('nuclide-blame-vertical-bar', {
            'nuclide-blame-vertical-bar-last': isLastLine,
            'nuclide-blame-vertical-bar-middle': !isLastLine,
          })}
        />
        <div style={{opacity}} className="nuclide-blame-border-age" />
      </div>
    );
  }
}
