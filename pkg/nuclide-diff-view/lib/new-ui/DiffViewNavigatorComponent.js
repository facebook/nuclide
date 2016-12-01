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
  AppState,
  NavigationSectionStatusType,
} from '../types';
import type DiffViewModel from '../DiffViewModel';
import typeof * as BoundActionCreators from '../redux/Actions';

import createPaneContainer from '../../../commons-atom/create-pane-container';
import {
  DiffMode,
  DIFF_EDITOR_MARKER_CLASS,
} from '../constants';
import {
  React,
  ReactDOM,
} from 'react-for-atom';
import {
  centerScrollToBufferLine,
  navigationSectionStatusToEditorElement,
  renderCommitView,
  renderFileChanges,
  renderPublishView,
  renderTimelineView,
} from '../DiffViewComponent';
import {Modal} from '../../../nuclide-ui/Modal';
import SectionDirectionNavigator from './SectionDirectionNavigator';
import {notifyInternalError} from '../notifications';

type Props = AppState & {
  actionCreators: BoundActionCreators,
  // TODO(most): deprecate the model - use `actionCreators` instead.
  diffModel: DiffViewModel,
};

export default class DiffViewNavigatorComponent extends React.Component {
  props: Props;
  _paneContainer: Object;
  _navigatorPane: atom$Pane;
  _fileChangesPane: atom$Pane;

  constructor(props: Props) {
    super(props);
    (this: any)._handleNavigateToSection = this._handleNavigateToSection.bind(this);
  }

  componentDidMount(): void {
    this._paneContainer = createPaneContainer();
    ReactDOM.findDOMNode(this.refs.paneContainer).appendChild(
      atom.views.getView(this._paneContainer),
    );
    this._navigatorPane = this._paneContainer.getActivePane();
    this._fileChangesPane = this._navigatorPane.splitRight({
      flexScale: 0.5,
    });
    this._renderPaneElements();
  }

  componentDidUpdate(): void {
    this._renderPaneElements();
  }

  render(): React.Element<any> {
    return (
      <div className="nuclide-diff-view-navigator-root" ref="paneContainer" />
    );
  }

  _renderPaneElements(): void {
    ReactDOM.render(
      this._renderNavigator(),
      this._getPaneElement(this._navigatorPane),
    );
    ReactDOM.render(
      this._renderFileChanges(),
      this._getPaneElement(this._fileChangesPane),
    );
  }

  componentWillUnmount(): void {
    const panes = [this._navigatorPane, this._fileChangesPane];
    panes.forEach(pane => {
      ReactDOM.unmountComponentAtNode(ReactDOM.findDOMNode(this._getPaneElement(pane)));
      pane.destroy();
    });
  }

  _renderNavigator(): React.Element<any> {
    return (
      <div className="nuclide-diff-view-navigator-timeline-container">
        {this._renderNavigationState()}
      </div>
    );
  }

  _renderFileChanges(): React.Element<any> {
    const {
      fileDiff: {activeSectionIndex, filePath, navigationSections},
      isLoadingFileDiff,
    } = this.props;

    let sectionNavigator;
    if (isLoadingFileDiff) {
      sectionNavigator = (
        <div className="padded">
          Loading Changes ...
        </div>
      );
    } else if (navigationSections.length === 0) {
      sectionNavigator = (
        <div className="padded">
          No active diff changes
        </div>
      );
    } else {
      sectionNavigator = (
        <div className="padded">
          <span>Changed Sections: </span>
          <SectionDirectionNavigator
            commandTarget={`.${DIFF_EDITOR_MARKER_CLASS}`}
            filePath={filePath}
            navigationSections={navigationSections}
            selectedNavigationSectionIndex={activeSectionIndex}
            onNavigateToNavigationSection={this._handleNavigateToSection}
          />
        </div>
      );
    }

    return (
      <div className="nuclide-diff-view-navigator-file-changes-container">
        {sectionNavigator}
        <div className="nuclide-diff-view-navigator-horizontal-selector" />
        {renderFileChanges(this.props.diffModel)}
      </div>
    );
  }

  _getPaneElement(pane: atom$Pane): HTMLElement {
    return atom.views.getView(pane).querySelector('.item-views');
  }

  _handleNavigateToSection(
    status: NavigationSectionStatusType,
    lineNumber: number,
  ): void {
    const {diffEditors} = this.props;
    if (diffEditors == null) {
      notifyInternalError(new Error('diffEditors cannot be null while navigating!'));
      return;
    }
    const {newDiffEditor, oldDiffEditor} = diffEditors;
    const textEditorElement = navigationSectionStatusToEditorElement(
      oldDiffEditor.getEditorDomElement(),
      newDiffEditor.getEditorDomElement(),
      status,
    );
    centerScrollToBufferLine(textEditorElement, lineNumber);
  }

  _renderNavigationState(): React.Element<any> {
    const {diffModel, viewMode} = this.props;
    switch (viewMode) {
      case DiffMode.BROWSE_MODE:
        return renderTimelineView(diffModel);
      case DiffMode.COMMIT_MODE:
        return renderCommitView(diffModel);
      case DiffMode.PUBLISH_MODE:
        return this._renderPublishView();
      default:
        throw new Error(`Invalid Diff Mode: ${viewMode}`);
    }
  }

  _renderPublishView(): React.Element<any> {
    const {actionCreators, diffModel, shouldDockPublishView} = this.props;

    const publishViewElement = renderPublishView(diffModel);
    if (shouldDockPublishView) {
      return publishViewElement;
    } else {
      const dismissHandler = () => {
        actionCreators.setViewMode(DiffMode.BROWSE_MODE);
      };
      const modalMaxHeight = document.body.clientHeight - 100;
      return (
        <div>
          {renderTimelineView(diffModel)}
          <Modal onDismiss={dismissHandler}>
            <div
              style={{maxHeight: modalMaxHeight}}
              className="nuclide-diff-view-modal-diff-mode">
              {publishViewElement}
            </div>
          </Modal>
        </div>
      );
    }
  }
}
