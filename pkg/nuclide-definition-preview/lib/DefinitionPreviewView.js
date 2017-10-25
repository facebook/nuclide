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

import type {ContextElementProps} from '../../nuclide-context-view/lib/types';
import type {Definition} from 'atom-ide-ui';

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {Block} from 'nuclide-commons-ui/Block';
import * as React from 'react';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {bufferForUri} from '../../nuclide-remote-connection';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import analytics from 'nuclide-commons-atom/analytics';
import featureConfig from 'nuclide-commons-atom/feature-config';
import invariant from 'assert';
import {TextBuffer} from 'atom';

const MINIMUM_EDITOR_HEIGHT = 10;
const EDITOR_HEIGHT_DELTA = 10;

type State = {
  buffer: atom$TextBuffer,
  editorHeight: number, // Height in ems to render the AtomTextEditor.
};

export class DefinitionPreviewView extends React.Component<
  ContextElementProps,
  State,
> {
  _settingsChangeDisposable: IDisposable;

  constructor(props: ContextElementProps) {
    super(props);
    const buffer =
      props.definition != null
        ? bufferForUri(props.definition.path)
        : new TextBuffer();
    const heightSetting = (featureConfig.get(
      'nuclide-definition-preview.editorHeight',
    ): any);
    let height: number = 50;
    if (heightSetting != null) {
      height = heightSetting;
    }
    if (height < MINIMUM_EDITOR_HEIGHT) {
      height = MINIMUM_EDITOR_HEIGHT;
    }
    this.state = {
      buffer,
      editorHeight: height,
    };
    this._settingsChangeDisposable = featureConfig.observe(
      'nuclide-definition-preview.editorHeight',
      (newHeight: any) => this._setEditorHeight((newHeight: number)),
    );
  }

  componentWillReceiveProps(newProps: ContextElementProps): void {
    if (newProps.definition != null) {
      const definition = newProps.definition;
      // The buffer always needs to point to the right file path, so create a new one with
      // the correct path if the new definition prop has a different path than the
      // currently loaded buffer.
      if (definition.path !== this.state.buffer.getPath()) {
        this.setState({buffer: bufferForUri(definition.path)});
      }
    } else {
      // A null definition has no associated file path, so make a new TextBuffer()
      // that doesn't have an associated file path.
      this.setState({buffer: new TextBuffer()});
    }
  }

  // Loads the current buffer in state if it's not already loaded.
  async _loadBuffer(): Promise<void> {
    if (!this.state.buffer.loaded) {
      await this.state.buffer.load();
    }
  }

  componentDidUpdate(prevProps: ContextElementProps, prevState: State): void {
    if (this.props.definition != null) {
      this._finishRendering(this.props.definition);
    }
  }

  componentWillUnmount(): void {
    this._settingsChangeDisposable.dispose();
  }

  async _finishRendering(definition: Definition): Promise<void> {
    await this._loadBuffer();
    this._scrollToRow(definition.position.row);

    const editor = this.getEditor();
    editor.getDecorations().forEach(decoration => decoration.destroy());
    invariant(this.props.definition != null);
    const marker = editor.markBufferPosition(definition.position);
    editor.decorateMarker(marker, {
      type: 'line',
      class: 'nuclide-current-line-highlight',
    });
  }

  render(): React.Node {
    const {ContextViewMessage, definition} = this.props;
    const atMinHeight =
      this.state.editorHeight - EDITOR_HEIGHT_DELTA < MINIMUM_EDITOR_HEIGHT;
    // Show either a "No definition" message or the definition in an editors
    return definition == null ? (
      <ContextViewMessage message={ContextViewMessage.NO_DEFINITION} />
    ) : (
      <div className="pane-item nuclide-definition-preview">
        <div
          className="nuclide-definition-preview-editor"
          style={{height: `${this.state.editorHeight}em`}}>
          <AtomTextEditor
            ref="editor"
            gutterHidden={true}
            lineNumberGutterVisible={false}
            path={definition.path}
            // Should be readonly, but can't because we can only make buffers readonly,
            // We can't do readonly on editor granularity.
            readOnly={false}
            textBuffer={this.state.buffer}
            syncTextContents={false}
          />
          <ButtonContainer
            _openCurrentDefinitionInMainEditor={
              this._openCurrentDefinitionInMainEditor
            }
            _increaseEditorHeight={this._increaseEditorHeight}
            _decreaseEditorHeight={this._decreaseEditorHeight}
            atMinHeight={atMinHeight}
          />
        </div>
      </div>
    );
  }

  _openCurrentDefinitionInMainEditor = (): void => {
    analytics.track('nuclide-definition-preview:openInMainEditor');
    const def = this.props.definition;
    if (def != null) {
      goToLocation(def.path, {
        line: def.position.row,
        column: def.position.column,
        center: true,
      });
    }
  };

  // Sets the height of the definition preview editor only if it satisfies the minimum height
  _setEditorHeight(height: number): void {
    if (height !== this.state.editorHeight && height >= MINIMUM_EDITOR_HEIGHT) {
      featureConfig.set('nuclide-definition-preview.editorHeight', height);
      this.setState({editorHeight: height});
    }
  }

  _increaseEditorHeight = (): void => {
    this._setEditorHeight(this.state.editorHeight + EDITOR_HEIGHT_DELTA);
  };

  _decreaseEditorHeight = (): void => {
    this._setEditorHeight(this.state.editorHeight - EDITOR_HEIGHT_DELTA);
  };

  getEditor(): atom$TextEditor {
    return this.refs.editor.getModel();
  }

  _scrollToRow(row: number): void {
    this.getEditor().scrollToBufferPosition([row, 0], {center: true});
  }
}

type ButtonContainerProps = {
  _openCurrentDefinitionInMainEditor: () => void,
  _increaseEditorHeight: () => void,
  _decreaseEditorHeight: () => void,
  atMinHeight: boolean,
};

const ButtonContainer = (props: ButtonContainerProps) => {
  return (
    <Block>
      <div className="nuclide-definition-preview-buttons">
        <div className="nuclide-definition-preview-buttons-left">
          <span style={{paddingRight: '1em'}}>Height:</span>
          <Button
            onClick={props._decreaseEditorHeight}
            size={ButtonSizes.SMALL}
            disabled={props.atMinHeight}>
            -
          </Button>
          <Button
            onClick={props._increaseEditorHeight}
            size={ButtonSizes.SMALL}>
            +
          </Button>
        </div>
        <div className="nuclide-definition-preview-buttons-right">
          <Button
            onClick={props._openCurrentDefinitionInMainEditor}
            size={ButtonSizes.SMALL}>
            Open in main editor
          </Button>
        </div>
      </div>
    </Block>
  );
};
