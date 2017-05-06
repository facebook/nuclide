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

import type {Observable} from 'rxjs';
import type {OutlineForUi, OutlineTreeForUi} from './main';
import type {TextToken} from '../../commons-node/tokenizedText-rpc-types';

import React from 'react';
import invariant from 'assert';
import classnames from 'classnames';

import {track} from '../../nuclide-analytics';
import {goToLocationInEditor} from '../../commons-atom/go-to-location';
import {getLogger} from '../../nuclide-logging';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from '../../nuclide-ui/LoadingSpinner';
import {PanelComponentScroller} from '../../nuclide-ui/PanelComponentScroller';
import {Message, MessageTypes} from '../../nuclide-ui/Message';

const logger = getLogger();

type State = {
  outline: OutlineForUi,
};

type Props = {
  outlines: Observable<OutlineForUi>,
};

const TOKEN_KIND_TO_CLASS_NAME_MAP = {
  keyword: 'syntax--keyword',
  'class-name': 'syntax--entity syntax--name syntax--class',
  constructor: 'syntax--entity syntax--name syntax--function',
  method: 'syntax--entity syntax--name syntax--function',
  param: 'syntax--variable',
  string: 'syntax--string',
  whitespace: '',
  plain: '',
  type: 'syntax--support syntax--type',
};

export class OutlineView extends React.Component {
  state: State;
  props: Props;

  subscription: ?rxjs$ISubscription;

  constructor(props: Props) {
    super(props);
    this.state = {
      outline: {
        kind: 'empty',
      },
    };
  }

  componentDidMount(): void {
    invariant(this.subscription == null);
    this.subscription = this.props.outlines.subscribe(outline => {
      this.setState({outline});
    });
  }

  componentWillUnmount(): void {
    invariant(this.subscription != null);
    this.subscription.unsubscribe();
    this.subscription = null;
  }

  render(): React.Element<any> {
    return (
      <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
        <PanelComponentScroller>
          <div className="nuclide-outline-view">
            <OutlineViewComponent outline={this.state.outline} />
          </div>
        </PanelComponentScroller>
      </div>
    );
  }
}

type OutlineViewComponentProps = {
  outline: OutlineForUi,
};

class OutlineViewComponent extends React.Component {
  props: OutlineViewComponentProps;

  render(): ?React.Element<any> {
    const outline = this.props.outline;
    const noOutlineAvailableMessage = (
      <Message>
        No outline available.
      </Message>
    );
    switch (outline.kind) {
      case 'empty':
      case 'not-text-editor':
        return noOutlineAvailableMessage;
      case 'loading':
        return (
          <div className="nuclide-outline-view-loading">
            <LoadingSpinner
              className="inline-block"
              size={LoadingSpinnerSizes.MEDIUM}
            />
          </div>
        );
      case 'no-provider':
        return outline.grammar === 'Null Grammar'
          ? noOutlineAvailableMessage
          : <Message type={MessageTypes.warning}>
              Outline view does not currently support {outline.grammar}.
            </Message>;
      case 'provider-no-outline':
        return noOutlineAvailableMessage;
      case 'outline':
        return renderTrees(outline.editor, outline.outlineTrees);
      default:
        const errorText = `Encountered unexpected outline kind ${outline.kind}`;
        logger.error(errorText);
        return (
          <Message type={MessageTypes.error}>
            Internal Error:<br />
            {errorText}
          </Message>
        );
    }
  }
}

class OutlineTree extends React.PureComponent {
  props: {
    editor: atom$TextEditor,
    outline: OutlineTreeForUi,
  };

  render(): React.Element<any> {
    const {editor, outline} = this.props;

    const onClick = () => {
      const pane = atom.workspace.paneForItem(editor);
      if (pane == null) {
        return;
      }
      track('nuclide-outline-view:go-to-location');
      pane.activate();
      pane.activateItem(editor);
      goToLocationInEditor(
        editor,
        outline.startPosition.row,
        outline.startPosition.column,
      );
    };

    const onDoubleClick = () => {
      // Assumes that the click handler has already run, activating the text editor and moving the
      // cursor to the start of the symbol.
      const endPosition = outline.endPosition;
      if (endPosition != null) {
        editor.selectToBufferPosition(endPosition);
      }
    };

    const classNames = ['list-nested-item'];
    if (outline.kind) {
      classNames.push(`kind-${outline.kind}`);
    }
    const classes = classnames(classNames, {
      selected: outline.highlighted,
    });
    return (
      <li className={classes}>
        <div
          className="list-item nuclide-outline-view-item"
          onClick={onClick}
          onDoubleClick={onDoubleClick}>
          {renderItem(outline)}
        </div>
        {renderTrees(editor, outline.children)}
      </li>
    );
  }
}

function renderItem(
  outline: OutlineTreeForUi,
): Array<React.Element<any> | string> {
  const r = [];

  if (outline.icon != null) {
    r.push(<span className={`icon icon-${outline.icon}`} />);
    // Note: icons here are fixed-width, so the text lines up.
  }

  if (outline.tokenizedText != null) {
    r.push(...outline.tokenizedText.map(renderTextToken));
  } else if (outline.plainText != null) {
    r.push(outline.plainText);
  } else {
    r.push('Missing text');
  }

  return r;
}

function renderTextToken(token: TextToken, index: number): React.Element<any> {
  const className = TOKEN_KIND_TO_CLASS_NAME_MAP[token.kind];
  return <span className={className} key={index}>{token.value}</span>;
}

function renderTrees(
  editor: atom$TextEditor,
  outlines: Array<OutlineTreeForUi>,
): ?React.Element<any> {
  if (outlines.length === 0) {
    return null;
  }
  return (
    // Add `position: relative;` to let `li.selected` style position itself relative to the list
    // tree rather than to its container.
    (
      <ul className="list-tree" style={{position: 'relative'}}>
        {outlines.map((outline, index) => (
          <OutlineTree editor={editor} outline={outline} key={index} />
        ))}
      </ul>
    )
  );
}
