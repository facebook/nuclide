'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  NavigationSection,
  NavigationSectionStatusType,
} from './types';
import type DiffViewModel from './DiffViewModel';
import typeof * as BoundActionCreators from './redux/Actions';

import invariant from 'assert';
import {MultiRootChangedFilesView} from '../../nuclide-ui/MultiRootChangedFilesView';
import {Disposable, TextBuffer} from 'atom';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {
  React,
  ReactDOM,
} from 'react-for-atom';
import DiffViewEditorPane from './DiffViewEditorPane';
import SyncScroll from './SyncScroll';
import DiffTimelineView from './DiffTimelineView';
import DiffViewToolbar from './DiffViewToolbar';
import {DiffNavigationBar} from './DiffNavigationBar';
import DiffCommitView from './DiffCommitView';
import DiffPublishView from './DiffPublishView';
import createPaneContainer from '../../commons-atom/create-pane-container';
import {bufferForUri} from '../../commons-atom/text-buffer';
import {
  DiffMode,
  NavigationSectionStatus,
} from './constants';
import {getMultiRootFileChanges} from '../../nuclide-hg-git-bridge/lib/utils';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from '../../nuclide-ui/LoadingSpinner';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import {Observable} from 'rxjs';
import {formatDiffViewUrl} from './utils';

type Props = {
  diffModel: DiffViewModel,
  actionCreators: BoundActionCreators,
  // A bound function that when invoked will try to trigger the Diff View NUX
  tryTriggerNux: () => void,
};

let CachedPublishComponent;
function getPublishComponent() {
  if (CachedPublishComponent == null) {
    // Try requiring private module
    try {
      // $FlowFB
      const {DiffViewPublishForm} = require('./fb/DiffViewPublishForm');
      CachedPublishComponent = DiffViewPublishForm;
    } catch (ex) {
      CachedPublishComponent = DiffPublishView;
    }
  }
  return CachedPublishComponent;
}

let CachedCommitComponent;
function getCommitComponent() {
  if (CachedCommitComponent == null) {
    // Try requiring private module
    try {
      // $FlowFB
      const {DiffViewCreateForm} = require('./fb/DiffViewCreateForm');
      CachedCommitComponent = DiffViewCreateForm;
    } catch (ex) {
      CachedCommitComponent = DiffCommitView;
    }
  }

  return CachedCommitComponent;
}

export function renderPublishView(diffModel: DiffViewModel): React.Element<any> {
  const {
    publish: {message, mode, state},
    activeRepositoryState: {headRevision},
    shouldDockPublishView,
    suggestedReviewers,
  } = diffModel.getState();
  const PublishComponent = getPublishComponent();
  return (
    <PublishComponent
      suggestedReviewers={suggestedReviewers}
      publishModeState={state}
      message={message}
      publishMode={mode}
      headCommitMessage={headRevision == null ? '' : headRevision.description}
      diffModel={diffModel}
      shouldDockPublishView={shouldDockPublishView}
    />
  );
}

export function renderCommitView(diffModel: DiffViewModel): React.Element<any> {
  const {
    commit: {message, mode, state},
    shouldRebaseOnAmend,
    suggestedReviewers,
  } = diffModel.getState();

  const CommitComponent = getCommitComponent();
  return (
    <CommitComponent
      suggestedReviewers={suggestedReviewers}
      commitMessage={message}
      commitMode={mode}
      commitModeState={state}
      shouldRebaseOnAmend={shouldRebaseOnAmend}
      // `diffModel` is acting as the action creator for commit view and needs to be passed so
      // methods can be called on it.
      diffModel={diffModel}
    />
  );
}

export function renderTimelineView(diffModel: DiffViewModel): React.Element<any> {
  const onSelectionChange = revision => diffModel.setCompareRevision(revision);
  return (
    <DiffTimelineView
      diffModel={diffModel}
      onSelectionChange={onSelectionChange}
    />
  );
}

export function renderFileChanges(diffModel: DiffViewModel): React.Element<any> {
  const {
    activeRepository,
    activeRepositoryState: {
      isLoadingSelectedFiles,
      selectedFiles,
    },
    fileDiff,
  } = diffModel.getState();
  const rootPaths = activeRepository != null ? [activeRepository.getWorkingDirectory()] : [];

  let spinnerElement = null;
  if (isLoadingSelectedFiles) {
    spinnerElement = (
      <LoadingSpinner
        className="inline-block nuclide-diff-view-file-change-spinner"
        size={LoadingSpinnerSizes.EXTRA_SMALL}
      />
    );
  }

  const emptyMessage = !isLoadingSelectedFiles && selectedFiles.size === 0
    ? <div className="nuclide-diff-view-padded">No file changes selected</div>
    : null;

  // Open the view, if not previously open as well as issue a diff command.
  // TODO(most): Switch to an action after migration complete to the new split UI.
  const diffFilePath = filePath => {
    if (diffModel.getState().diffEditorsVisible) {
      diffModel.diffFile(filePath);
    } else {
      atom.workspace.open(formatDiffViewUrl({file: filePath}));
    }
  };

  const getCompareRevision = () => {
    const {compareRevisionId} = diffModel.getState().activeRepositoryState;
    return compareRevisionId == null ? null : `${compareRevisionId}`;
  };

  return (
    <div>
      <div className="padded">File Changes{spinnerElement}</div>
      <div className="nuclide-diff-view-tree">
        <MultiRootChangedFilesView
          commandPrefix="nuclide-diff-view"
          fileChanges={getMultiRootFileChanges(selectedFiles, rootPaths)}
          getRevertTargetRevision={getCompareRevision}
          selectedFile={fileDiff.filePath}
          onFileChosen={diffFilePath}
        />
        {emptyMessage}
      </div>
    </div>
  );
}

export function centerScrollToBufferLine(
  textEditorElement: atom$TextEditorElement,
  bufferLineNumber: number,
): void {
  const textEditor = textEditorElement.getModel();
  const pixelPositionTop = textEditorElement
    .pixelPositionForBufferPosition([bufferLineNumber, 0]).top;
  // Manually calculate the scroll location, instead of using
  // `textEditor.scrollToBufferPosition([lineNumber, 0], {center: true})`
  // because that API to wouldn't center the line if it was in the visible screen range.
  const scrollTop = pixelPositionTop
    + textEditor.getLineHeightInPixels() / 2
    - textEditorElement.clientHeight / 2;
  textEditorElement.setScrollTop(Math.max(scrollTop, 1));

  textEditorElement.focus();

  textEditor.setCursorBufferPosition(
    [bufferLineNumber, 0],
    {autoscroll: false},
  );
}

export function pixelRangeForNavigationSection(
  oldEditorElement: atom$TextEditorElement,
  newEditorElement: atom$TextEditorElement,
  navigationSection: NavigationSection,
): {top: number, bottom: number} {
  const {status, lineNumber, lineCount} = navigationSection;
  const textEditorElement = navigationSectionStatusToEditorElement(
    oldEditorElement, newEditorElement, status);
  const lineHeight = textEditorElement.getModel().getLineHeightInPixels();
  return {
    top: textEditorElement.pixelPositionForBufferPosition([lineNumber, 0]).top,
    bottom: textEditorElement.pixelPositionForBufferPosition([lineNumber + lineCount - 1, 0]).top
      + lineHeight,
  };
}

export function navigationSectionStatusToEditorElement(
  oldEditorElement: atom$TextEditorElement,
  newEditorElement: atom$TextEditorElement,
  navigationSectionStatus: NavigationSectionStatusType,
): atom$TextEditorElement {
  switch (navigationSectionStatus) {
    case NavigationSectionStatus.ADDED:
    case NavigationSectionStatus.CHANGED:
    case NavigationSectionStatus.NEW_ELEMENT:
      return newEditorElement;
    case NavigationSectionStatus.REMOVED:
    case NavigationSectionStatus.OLD_ELEMENT:
      return oldEditorElement;
    default:
      throw new Error('Invalid diff section status');
  }
}

export function getCenterScrollSelectedNavigationIndex(
  editorElements: [atom$TextEditorElement, atom$TextEditorElement],
  navigationSections: Array<NavigationSection>,
): number {
  const elementsScrollCenter = editorElements.map(editorElement => {
    const scrollTop = editorElement.getScrollTop();
    return scrollTop + editorElement.clientHeight / 2;
  });

  let selectedSectionIndex = -1;

  // TODO(most): Pre-compute the positions of the diff sections.
  // Q: when to invalidate (line edits, UI elements & diff reloads, ..etc.)
  for (let sectionIndex = 0; sectionIndex < navigationSections.length; sectionIndex++) {
    const {status, lineNumber} = navigationSections[sectionIndex];
    const textEditorElement = navigationSectionStatusToEditorElement(
      editorElements[0],
      editorElements[1],
      status,
    );
    const sectionPixelTop = textEditorElement
      .pixelPositionForBufferPosition([lineNumber, 0]).top;

    const sectionEditorIndex = editorElements.indexOf(textEditorElement);
    const sectionEditorScrollCenter = elementsScrollCenter[sectionEditorIndex];

    if (sectionEditorScrollCenter >= sectionPixelTop) {
      selectedSectionIndex = sectionIndex;
    }
  }

  return selectedSectionIndex;
}

const EMPTY_FUNCTION = () => {};
const SCROLL_FIRST_CHANGE_DELAY_MS = 100;
const DEBOUNCE_STATE_UPDATES_MS = 50;

export default class DiffViewComponent extends React.Component {
  props: Props;

  _subscriptions: UniversalDisposable;
  _syncScroll: SyncScroll;
  _oldEditorPane: atom$Pane;
  _oldEditorComponent: DiffViewEditorPane;
  _paneContainer: Object;
  _newEditorPane: atom$Pane;
  _newEditorComponent: DiffViewEditorPane;
  _bottomRightPane: atom$Pane;
  _timelineComponent: ?React.Component<any, any, any>;
  _treePane: atom$Pane;
  _treeComponent: React.Component<any, any, any>;
  _navigationPane: atom$Pane;
  _navigationComponent: DiffNavigationBar;
  _publishComponent: ?React.Component<any, any, any>;
  _readonlyBuffer: atom$TextBuffer;

  constructor(props: Props) {
    super(props);
    (this: any)._handleNavigateToNavigationSection =
      this._handleNavigateToNavigationSection.bind(this);
    (this: any)._onDidUpdateTextEditorElement = this._onDidUpdateTextEditorElement.bind(this);
    (this: any)._onSwitchToEditor = this._onSwitchToEditor.bind(this);
    (this: any)._onDidChangeScrollTop = this._onDidChangeScrollTop.bind(this);
    (this: any)._pixelRangeForNavigationSection = this._pixelRangeForNavigationSection.bind(this);
    this._readonlyBuffer = new TextBuffer();
    this._subscriptions = new UniversalDisposable();
  }

  componentDidMount(): void {
    const {diffModel, tryTriggerNux} = this.props;
    const stateUpdates = observableFromSubscribeFunction(
      diffModel.onDidUpdateState.bind(diffModel))
      .map(() => diffModel.getState());
    this._subscriptions.add(
      Observable.merge(
        stateUpdates,
        observableFromSubscribeFunction(
          atom.workspace.onDidChangeActivePaneItem.bind(atom.workspace)),
      ).filter(() => {
        const activeItem = atom.workspace.getActivePaneItem();
        return activeItem != null && (activeItem: any).tagName === 'NUCLIDE-DIFF-VIEW';
      })
      .debounceTime(DEBOUNCE_STATE_UPDATES_MS)
      .subscribe(() => {
        this.forceUpdate();
      }),

      // Scroll to the first navigation section when diffing a file.
      stateUpdates.map(({fileDiff}) => fileDiff.filePath)
        .distinctUntilChanged()
        .switchMap(filePath => {
          // Clear prior subscriptions on file switch.
          if (!filePath) {
            return Observable.empty();
          }
          return Observable.concat(
            // Wait for the diff text to load.
            stateUpdates.filter(({fileDiff}) => fileDiff.oldEditorState.text.length > 0)
              .first().ignoreElements(),
            // Wait for the diff editor to render the UI state.
            Observable.interval(SCROLL_FIRST_CHANGE_DELAY_MS).first(),
          );
        }).subscribe(() => this._scrollToFirstHighlightedLine()),
    );

    this._paneContainer = createPaneContainer();
    // The changed files status tree takes 1/5 of the width and lives on the right most,
    // while being vertically splt with the revision timeline stack pane.
    const topPane = this._newEditorPane = this._paneContainer.getActivePane();
    this._bottomRightPane = topPane.splitDown({
      flexScale: 0.3,
    });
    this._treePane = this._bottomRightPane.splitLeft({
      flexScale: 0.35,
    });
    this._navigationPane = topPane.splitRight({
      flexScale: 0.045,
    });
    this._oldEditorPane = topPane.splitLeft({
      flexScale: 1,
    });

    this._renderDiffView();

    this._subscriptions.add(
      this._destroyPaneDisposable(this._oldEditorPane),
      this._destroyPaneDisposable(this._newEditorPane),
      this._destroyPaneDisposable(this._navigationPane),
      this._destroyPaneDisposable(this._treePane),
      this._destroyPaneDisposable(this._bottomRightPane),
    );

    ReactDOM.findDOMNode(this.refs.paneContainer).appendChild(
      atom.views.getView(this._paneContainer),
    );

    tryTriggerNux();
  }

  _setupSyncScroll(): void {
    if (this._oldEditorComponent == null || this._newEditorComponent == null) {
      return;
    }
    const oldTextEditorElement = this._oldEditorComponent.getEditorDomElement();
    const newTextEditorElement = this._newEditorComponent.getEditorDomElement();
    const syncScroll = this._syncScroll;
    if (syncScroll != null) {
      syncScroll.dispose();
      this._subscriptions.remove(syncScroll);
    }
    this._syncScroll = new SyncScroll(
      oldTextEditorElement,
      newTextEditorElement,
    );
    this._subscriptions.add(this._syncScroll);
  }

  _scrollToFirstHighlightedLine(): void {
    const {fileDiff: {navigationSections}} = this.props.diffModel.getState();
    if (navigationSections.length === 0) {
      return;
    }

    const {status, lineNumber} = navigationSections[0];
    this._handleNavigateToNavigationSection(status, lineNumber);
  }

  _renderDiffView(): void {
    this._renderTree();
    this._renderEditors();
    this._renderNavigation();
    this._renderBottomRightPane();
  }

  _renderBottomRightPane(): void {
    const {viewMode} = this.props.diffModel.getState();
    switch (viewMode) {
      case DiffMode.BROWSE_MODE:
        this._renderTimelineView();
        this._publishComponent = null;
        break;
      case DiffMode.COMMIT_MODE:
        this._renderCommitView();
        this._timelineComponent = null;
        this._publishComponent = null;
        break;
      case DiffMode.PUBLISH_MODE:
        this._renderPublishView();
        this._timelineComponent = null;
        break;
      default:
        throw new Error(`Invalid Diff Mode: ${viewMode}`);
    }
  }

  componentDidUpdate(prevProps: Props): void {
    this._renderDiffView();
    this.props.diffModel.emitActiveBufferChangeModified();
  }

  _renderCommitView(): void {
    ReactDOM.render(
      renderCommitView(this.props.diffModel),
      this._getPaneElement(this._bottomRightPane),
    );
  }

  _renderPublishView(): void {
    this._publishComponent = ReactDOM.render(
      renderPublishView(this.props.diffModel),
      this._getPaneElement(this._bottomRightPane),
    );
  }

  _renderTree(): void {
    this._treeComponent = ReactDOM.render(
      renderFileChanges(this.props.diffModel),
      this._getPaneElement(this._treePane),
    );
  }

  _renderEditors(): void {
    const {
      fileDiff,
      isLoadingFileDiff,
    } = this.props.diffModel.getState();

    const {
      filePath,
      lineMapping,
      newEditorState: newState,
      oldEditorState: oldState,
    } = fileDiff;
    const oldEditorComponent = ReactDOM.render(
        <DiffViewEditorPane
          headerTitle={oldState.revisionTitle}
          textBuffer={this._readonlyBuffer}
          filePath={filePath}
          isLoading={isLoadingFileDiff}
          offsets={oldState.offsets}
          lineMapper={lineMapping.newToOld}
          highlightedLines={oldState.highlightedLines}
          textContent={oldState.text}
          inlineElements={oldState.inlineElements}
          inlineOffsetElements={oldState.inlineOffsetElements}
          readOnly={true}
          onDidChangeScrollTop={this._onDidChangeScrollTop}
          onDidUpdateTextEditorElement={EMPTY_FUNCTION}
        />,
        this._getPaneElement(this._oldEditorPane),
    );
    invariant(oldEditorComponent instanceof DiffViewEditorPane);
    this._oldEditorComponent = oldEditorComponent;
    const textBuffer = bufferForUri(filePath);
    const newEditorComponent = ReactDOM.render(
        <DiffViewEditorPane
          headerTitle={newState.revisionTitle}
          textBuffer={textBuffer}
          filePath={filePath}
          isLoading={isLoadingFileDiff}
          offsets={newState.offsets}
          lineMapper={lineMapping.oldToNew}
          highlightedLines={newState.highlightedLines}
          inlineElements={newState.inlineElements}
          inlineOffsetElements={newState.inlineOffsetElements}
          onDidUpdateTextEditorElement={this._onDidUpdateTextEditorElement}
          readOnly={false}
        />,
        this._getPaneElement(this._newEditorPane),
    );
    invariant(newEditorComponent instanceof DiffViewEditorPane);
    this._newEditorComponent = newEditorComponent;
  }

  _onDidUpdateTextEditorElement(): void {
    this.props.actionCreators.updateDiffEditors({
      newDiffEditor: this._newEditorComponent.getDiffEditor(),
      oldDiffEditor: this._oldEditorComponent.getDiffEditor(),
    });
    this._setupSyncScroll();
  }

  _renderTimelineView(): void {
    this._timelineComponent = ReactDOM.render(
      renderTimelineView(this.props.diffModel),
      this._getPaneElement(this._bottomRightPane),
    );
  }

  _renderNavigation(): void {
    const {fileDiff: {navigationSections}} = this.props.diffModel.getState();
    const navigationPaneElement = this._getPaneElement(this._navigationPane);
    const oldEditorElement = this._oldEditorComponent.getEditorDomElement();
    const newEditorElement = this._newEditorComponent.getEditorDomElement();
    const diffViewHeight = Math.max(
      oldEditorElement.getScrollHeight(),
      newEditorElement.getScrollHeight(),
      1, // Protect against zero scroll height while initializring editors.
    );
    const component = ReactDOM.render(
      <DiffNavigationBar
        navigationSections={navigationSections}
        navigationScale={navigationPaneElement.clientHeight / diffViewHeight}
        editorLineHeight={oldEditorElement.getModel().getLineHeightInPixels()}
        pixelRangeForNavigationSection={this._pixelRangeForNavigationSection}
        onNavigateToNavigationSection={this._handleNavigateToNavigationSection}
      />,
      navigationPaneElement,
    );
    invariant(component instanceof DiffNavigationBar);
    this._navigationComponent = component;
  }

  _handleNavigateToNavigationSection(
    navigationSectionStatus: NavigationSectionStatusType,
    scrollToLineNumber: number,
  ): void {
    const textEditorElement = this._navigationSectionStatusToEditorElement(navigationSectionStatus);
    centerScrollToBufferLine(textEditorElement, scrollToLineNumber);
  }

  _pixelRangeForNavigationSection(
    navigationSection: NavigationSection,
  ): {top: number, bottom: number} {
    return pixelRangeForNavigationSection(
      this._oldEditorComponent.getEditorDomElement(),
      this._newEditorComponent.getEditorDomElement(),
      navigationSection,
    );
  }

  _navigationSectionStatusToEditorElement(
    navigationSectionStatus: NavigationSectionStatusType,
  ): atom$TextEditorElement {
    return navigationSectionStatusToEditorElement(
      this._oldEditorComponent.getEditorDomElement(),
      this._newEditorComponent.getEditorDomElement(),
      navigationSectionStatus,
    );
  }

  _getPaneElement(pane: atom$Pane): HTMLElement {
    return atom.views.getView(pane).querySelector('.item-views');
  }

  _destroyPaneDisposable(pane: atom$Pane): IDisposable {
    return new Disposable(() => {
      ReactDOM.unmountComponentAtNode(ReactDOM.findDOMNode(this._getPaneElement(pane)));
      pane.destroy();
    });
  }

  componentWillUnmount(): void {
    this._subscriptions.dispose();
  }

  render(): React.Element<any> {
    const {
      activeSectionIndex,
      filePath,
      newEditorState,
      oldEditorState,
      navigationSections,
    } = this.props.diffModel.getState().fileDiff;

    return (
      <div className="nuclide-diff-view-container">
        <DiffViewToolbar
          navigationSections={navigationSections}
          filePath={filePath}
          selectedNavigationSectionIndex={activeSectionIndex}
          newRevisionTitle={newEditorState.revisionTitle}
          oldRevisionTitle={oldEditorState.revisionTitle}
          onSwitchToEditor={this._onSwitchToEditor}
          onNavigateToNavigationSection={this._handleNavigateToNavigationSection}
        />
        <div className="nuclide-diff-view-component" ref="paneContainer" />
      </div>
    );
  }

  _onSwitchToEditor(): void {
    const diffViewNode = ReactDOM.findDOMNode(this);
    invariant(diffViewNode, 'Diff View DOM needs to be attached to switch to editor mode');
    atom.commands.dispatch(diffViewNode, 'nuclide-diff-view:switch-to-editor');
  }

  _onDidChangeScrollTop(): void {
    const editorElements = [
      this._oldEditorComponent.getEditorDomElement(),
      this._newEditorComponent.getEditorDomElement(),
    ];
    const {fileDiff: {navigationSections, activeSectionIndex}} = this.props.diffModel.getState();
    const selectedNavigationSectionIndex = getCenterScrollSelectedNavigationIndex(
      editorElements,
      navigationSections,
    );

    if (activeSectionIndex !== selectedNavigationSectionIndex) {
      this.props.actionCreators.updateActiveNavigationSection(selectedNavigationSectionIndex);
    }
  }
}
