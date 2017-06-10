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

import React from 'react';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {computeDiff} from '../../commons-node/computeDiff';
import DiffViewEditor from '../../commons-atom/DiffViewEditor';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';

type Props = {
  filePath: string,
  oldContent: ?string,
  newContent: ?string,
};

const NUCLIDE_VCS_LOG_LOADING_INDICATOR_CLASSNAME =
  'nuclide-vcs-log-editor-loading-indicator';
const NUCLIDE_VCS_LOG_EDITOR_LOADING_CLASSNAME =
  'nuclide-vcs-log-editor-loading';
const NUCLIDE_VCS_LOG_EDITOR_CLASSNAME = 'nuclide-vcs-log-editor';
const NUCLIDE_VCS_LOG_DIFF_CONTAINER_CLASSNAME =
  'nuclide-vcs-log-diff-container';

export class ShowDiff extends React.Component {
  props: Props;
  _oldTextEditor: atom$TextEditor;
  _oldDiffViewEditor: DiffViewEditor;
  _newTextEditor: atom$TextEditor;
  _newDiffViewEditor: DiffViewEditor;

  render(): React.Element<any> {
    return (
      <div className={NUCLIDE_VCS_LOG_DIFF_CONTAINER_CLASSNAME}>
        <AtomTextEditor
          readOnly={true}
          autoGrow={true}
          syncTextContents={false}
          softWrapped={false}
          className={NUCLIDE_VCS_LOG_EDITOR_CLASSNAME}
          correctContainerWidth={false}
          ref={editorRef => {
            this._oldTextEditor = editorRef && editorRef.getModel();
          }}
        />
        <AtomTextEditor
          readOnly={true}
          autoGrow={true}
          syncTextContents={false}
          softWrapped={false}
          className={NUCLIDE_VCS_LOG_EDITOR_CLASSNAME}
          correctContainerWidth={false}
          ref={editorRef => {
            this._newTextEditor = editorRef && editorRef.getModel();
          }}
        />
      </div>
    );
  }

  componentDidMount(): void {
    this._setupEditors();
  }

  componentWillUnmount(): void {
    this._cleanupEditors();
  }

  componentDidUpdate(prevProps: Props): void {
    if (
      this.props.filePath !== prevProps.filePath ||
      this.props.oldContent !== prevProps.oldContent ||
      this.props.newContent !== prevProps.newContent
    ) {
      this._cleanupEditors();
      this._setupEditors();
    }
  }

  _setupEditors(): void {
    const {filePath, oldContent, newContent} = this.props;
    this._oldDiffViewEditor = new DiffViewEditor(
      atom.views.getView(this._oldTextEditor),
    );
    this._newDiffViewEditor = new DiffViewEditor(
      atom.views.getView(this._newTextEditor),
    );
    this._oldDiffViewEditor.setFileContents(filePath, oldContent || '');
    this._newDiffViewEditor.setFileContents(filePath, newContent || '');
    const diff = computeDiff(oldContent || '', newContent || '');
    this._oldDiffViewEditor.setHighlightedLines([], diff.removedLines);
    this._newDiffViewEditor.setHighlightedLines(diff.addedLines, []);
    this._oldDiffViewEditor.setOffsets(new Map(diff.oldLineOffsets));
    this._newDiffViewEditor.setOffsets(new Map(diff.newLineOffsets));

    // Add loading spinners
    if (oldContent == null) {
      this.setupLoadingIndicator(this._oldDiffViewEditor.getEditorDomElement());
    }
    if (newContent == null) {
      this.setupLoadingIndicator(this._newDiffViewEditor.getEditorDomElement());
    }
  }

  setupLoadingIndicator(editorElement: atom$TextEditorElement) {
    const editorElementParent: HTMLElement = (editorElement.parentNode: any);
    if (editorElementParent == null) {
      return;
    }

    const loadingElement = renderReactRoot(
      <LoadingSpinner delay={50} size={LoadingSpinnerSizes.LARGE} />,
    );
    loadingElement.classList.add(NUCLIDE_VCS_LOG_LOADING_INDICATOR_CLASSNAME);
    editorElementParent.appendChild(loadingElement);
    editorElement.classList.add(NUCLIDE_VCS_LOG_EDITOR_LOADING_CLASSNAME);
  }

  removeLoadingIndicator(editorElement: atom$TextEditorElement) {
    const editorElementParent: HTMLElement = (editorElement.parentNode: any);
    if (editorElementParent == null) {
      return;
    }
    editorElement.classList.remove(NUCLIDE_VCS_LOG_EDITOR_LOADING_CLASSNAME);
    const loadingElement = editorElementParent.querySelectorAll(
      `.${NUCLIDE_VCS_LOG_LOADING_INDICATOR_CLASSNAME}`,
    );
    loadingElement.forEach(element => editorElementParent.removeChild(element));
  }

  _cleanupEditors(): void {
    this._oldDiffViewEditor.destroyMarkers();
    this._newDiffViewEditor.destroyMarkers();
    this.removeLoadingIndicator(this._oldDiffViewEditor.getEditorDomElement());
    this.removeLoadingIndicator(this._newDiffViewEditor.getEditorDomElement());
  }
}
