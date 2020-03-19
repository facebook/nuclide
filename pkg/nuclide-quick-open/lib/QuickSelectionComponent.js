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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Tab} from 'nuclide-commons-ui/Tabs';
import type QuickSelectionActions from './QuickSelectionActions';

import type {FileResult, ProviderResult} from './types';
import type SearchResultManager, {ProviderSpec} from './SearchResultManager';
import type {
  ProviderResults,
  GroupedResult,
  GroupedResults,
} from './searchResultHelpers';

import nullthrows from 'nullthrows';

type ResultContext = {
  nonEmptyResults: GroupedResults,
  serviceNames: Array<string>,
  currentServiceIndex: number,
  currentService: GroupedResult,
  directoryNames: Array<NuclideUri>,
  currentDirectoryIndex: number,
  currentDirectory: ProviderResults,
};

export type SelectionIndex = {
  selectedDirectory: string,
  selectedService: string,
  selectedItemIndex: number,
};

import {Observable, Scheduler} from 'rxjs';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button} from 'nuclide-commons-ui/Button';
import {Icon} from 'nuclide-commons-ui/Icon';
import {scrollIntoViewIfNeeded} from 'nuclide-commons-ui/scrollIntoView';
import Tabs from 'nuclide-commons-ui/Tabs';
import {Badge, BadgeSizes} from '../../nuclide-ui/Badge';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import humanizeKeystroke from 'nuclide-commons/humanizeKeystroke';
import {fastDebounce, microtask} from 'nuclide-commons/observable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  filterEmptyResults,
  flattenResults,
  getOuterResults,
} from './searchResultHelpers';

/**
 * Determine what the applicable shortcut for a given action is within this component's context.
 * For example, this will return different keybindings on windows vs linux.
 */
function _findKeybindingForAction(action: string, target: HTMLElement): string {
  const matchingKeyBindings = atom.keymaps.findKeyBindings({
    command: action,
    target,
  });
  const keystroke =
    (matchingKeyBindings.length && matchingKeyBindings[0].keystrokes) || '';
  return humanizeKeystroke(keystroke);
}

type Props = {|
  searchResultManager: SearchResultManager,
  quickSelectionActions: QuickSelectionActions,
  onCancellation: () => void,
  onSelection: (
    selections: Array<ProviderResult>,
    providerName: string,
    query: string,
    // selectionIndex will be null iff for cases where more than one selection
    // is made at once (i.e. when the user hits "Open All")
    selectionIndex: ?number,
  ) => void,
  onItemsChanged?: (newItems: GroupedResults) => void,
  onSelectionChanged?: (
    selectionIndex: SelectionIndex,
    providerName: string,
    query: string,
  ) => void,
|};

type State = {
  activeTab: ProviderSpec,
  hasUserSelection: boolean,
  resultsByService: GroupedResults,
  renderableProviders: Array<ProviderSpec>,
  selectedService: string,
  selectedDirectory: string,
  selectedItemIndex: number,
  initialQuery: string,
};

export default class QuickSelectionComponent extends React.PureComponent<
  Props,
  State,
> {
  _modal: ?HTMLElement;
  _queryInput: ?AtomInput;
  _selectionList: ?HTMLElement;
  _subscriptions: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._subscriptions = new UniversalDisposable();

    const initialProviderName = this.props.searchResultManager.getActiveProviderName();
    const initialActiveTab = this.props.searchResultManager.getProviderSpecByName(
      initialProviderName,
    );
    const initialQuery = this.props.searchResultManager.getLastQuery() || '';
    const initialResults = this.props.searchResultManager.getResults(
      initialQuery,
      initialProviderName,
    );
    const topOuterResult = getOuterResults('top', initialResults);

    this.state = {
      activeTab: initialActiveTab,
      // treated as immutable
      resultsByService: initialResults,
      renderableProviders: this.props.searchResultManager.getRenderableProviders(),
      selectedService: topOuterResult != null ? topOuterResult.serviceName : '',
      selectedDirectory:
        topOuterResult != null ? topOuterResult.directoryName : '',
      selectedItemIndex: topOuterResult != null ? 0 : -1,
      hasUserSelection: false,
      initialQuery,
    };
  }

  /**
   * Public API
   */
  focus(): void {
    const element = this._getInputTextEditor();
    if (element != null) {
      element.focus();
    }
  }

  selectAllText(): void {
    this._getTextEditor().selectAll();
  }

  setInputValue(value: string): void {
    this._getTextEditor().setText(value);
  }

  /**
   * Private API
   */
  UNSAFE_componentWillReceiveProps(nextProps: Props): void {
    // Prevent clowniness:
    if (this.props.searchResultManager !== nextProps.searchResultManager) {
      throw new Error('quick-open: searchResultManager instance changed.');
    }
    // TODO: Find a better way to trigger an update.
    const nextProviderName = this.props.searchResultManager.getActiveProviderName();
    if (this.state.activeTab.name === nextProviderName) {
      process.nextTick(() => {
        const query = nullthrows(this._queryInput).getText();
        this.props.quickSelectionActions.query(query);
      });
    } else {
      const activeProviderSpec = this.props.searchResultManager.getProviderSpecByName(
        nextProviderName,
      );
      const lastResults = this.props.searchResultManager.getResults(
        nullthrows(this._queryInput).getText(),
        nextProviderName,
      );
      this._getTextEditor().setPlaceholderText(activeProviderSpec.prompt);
      this.setState(
        {
          activeTab: activeProviderSpec,
          resultsByService: lastResults,
        },
        () => {
          process.nextTick(() => {
            const query = nullthrows(this._queryInput).getText();
            this.props.quickSelectionActions.query(query);
          });
          if (this.props.onItemsChanged != null) {
            this.props.onItemsChanged(lastResults);
          }
        },
      );
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (prevState.resultsByService !== this.state.resultsByService) {
      if (this.props.onItemsChanged != null) {
        this.props.onItemsChanged(this.state.resultsByService);
      }
    }
    if (
      prevState.selectedItemIndex !== this.state.selectedItemIndex ||
      prevState.selectedService !== this.state.selectedService ||
      prevState.selectedDirectory !== this.state.selectedDirectory
    ) {
      this._updateScrollPosition();
    }
  }

  componentDidMount(): void {
    const modalNode = ReactDOM.findDOMNode(this);
    this._subscriptions.add(
      atom.commands.add(
        // $FlowFixMe
        modalNode,
        'core:move-to-bottom',
        this._handleMoveToBottom,
      ),
      // $FlowFixMe
      atom.commands.add(modalNode, 'core:move-to-top', this._handleMoveToTop),
      // $FlowFixMe
      atom.commands.add(modalNode, 'core:move-down', this._handleMoveDown),
      // $FlowFixMe
      atom.commands.add(modalNode, 'core:move-up', this._handleMoveUp),
      // $FlowFixMe
      atom.commands.add(modalNode, 'core:confirm', this._select),
      atom.commands.add(
        // $FlowFixMe
        modalNode,
        'pane:show-previous-item',
        this._handleMovePreviousTab,
      ),
      atom.commands.add(
        // $FlowFixMe
        modalNode,
        'pane:show-next-item',
        this._handleMoveNextTab,
      ),
      atom.commands.add('body', 'core:cancel', () => {
        this.props.onCancellation();
      }),
      Observable.fromEvent(document, 'mousedown').subscribe(
        this._handleDocumentMouseDown,
      ),
      // The text editor often changes during dispatches, so wait until the next tick.
      observableFromSubscribeFunction(cb =>
        nullthrows(this._queryInput).onDidChange(cb),
      )
        .startWith(null)
        .audit(() => microtask)
        .subscribe(this._handleTextInputChange),
      observableFromSubscribeFunction(cb =>
        this.props.searchResultManager.onProvidersChanged(cb),
      )
        .debounceTime(0, Scheduler.animationFrame)
        .subscribe(this._handleProvidersChange),
      observableFromSubscribeFunction(cb =>
        this.props.searchResultManager.onResultsChanged(cb),
      )
        .let(fastDebounce(50))
        // debounceTime seems to have issues canceling scheduled work. So
        // schedule it after we've debounced the events. See
        // https://github.com/ReactiveX/rxjs/pull/2135
        .debounceTime(0, Scheduler.animationFrame)
        .subscribe(this._handleResultsChange),
    );

    this._getTextEditor().selectAll();
  }

  componentWillUnmount(): void {
    this._subscriptions.dispose();
  }

  _handleClickOpenAll = (): void => {
    if (this.state.activeTab.canOpenAll) {
      this._openAll();
    }
  };

  _handleKeyPress = (e: SyntheticKeyboardEvent<>): void => {
    if (e.shiftKey && e.key === 'Enter') {
      if (this.state.activeTab.canOpenAll) {
        this._openAll();
      }
    }
  };

  _handleMovePreviousTab = (event: Event): void => {
    const currentProviderName = this.props.searchResultManager.getActiveProviderName();
    const currentTabIndex = this.state.renderableProviders.findIndex(
      tab => tab.name === currentProviderName,
    );
    const previousProvider =
      this.state.renderableProviders[currentTabIndex - 1] ||
      this.state.renderableProviders[this.state.renderableProviders.length - 1];
    this.props.quickSelectionActions.changeActiveProvider(
      previousProvider.name,
    );
    event.stopImmediatePropagation();
  };

  _handleMoveNextTab = (event: Event): void => {
    const currentProviderName = this.props.searchResultManager.getActiveProviderName();
    const currentTabIndex = this.state.renderableProviders.findIndex(
      tab => tab.name === currentProviderName,
    );
    const nextProvider =
      this.state.renderableProviders[currentTabIndex + 1] ||
      this.state.renderableProviders[0];
    this.props.quickSelectionActions.changeActiveProvider(nextProvider.name);
    event.stopImmediatePropagation();
  };

  _handleMoveToBottom = (): void => {
    this._moveSelectionToBottom(/* userInitiated */ true);
  };

  _handleMoveToTop = (): void => {
    this._moveSelectionToTop(/* userInitiated */ true);
  };

  _handleMoveDown = (): void => {
    this._moveSelectionDown(/* userInitiated */ true);
  };

  _handleMoveUp = (): void => {
    this._moveSelectionUp(/* userInitiated */ true);
  };

  _handleDocumentMouseDown = (event: Event): void => {
    // If the click did not happen on the modal or on any of its descendants,
    // the click was elsewhere on the document and should close the modal.
    // Otherwise, refocus the input box.
    if (
      event.target !== this._modal &&
      !nullthrows(this._modal).contains((event.target: any))
    ) {
      this.props.onCancellation();
    } else {
      process.nextTick(() => this.focus());
    }
  };

  _handleTextInputChange = (): void => {
    this.setState({hasUserSelection: false});
    const query = this._getTextEditor().getText();
    this.props.quickSelectionActions.query(query);
  };

  _handleResultsChange = (): void => {
    this._updateResults();
  };

  _handleProvidersChange = (): void => {
    this._updateResults();

    // Execute the current query again.
    // This will update any new providers.
    this.props.quickSelectionActions.query(this._getTextEditor().getText());
  };

  _updateResults(): void {
    const activeProviderName = this.props.searchResultManager.getActiveProviderName();
    const updatedResults = this.props.searchResultManager.getResults(
      nullthrows(this._queryInput).getText(),
      activeProviderName,
    );
    const [topProviderName] = Object.keys(updatedResults);
    const renderableProviders = this.props.searchResultManager.getRenderableProviders();
    this.setState(
      {
        renderableProviders,
        resultsByService: updatedResults,
      },
      () => {
        if (
          !this.state.hasUserSelection &&
          topProviderName != null &&
          this.state.resultsByService[topProviderName] != null
        ) {
          const topProviderResults = this.state.resultsByService[
            topProviderName
          ].results;
          if (
            !Object.keys(topProviderResults).some(
              dirName => topProviderResults[dirName].loading,
            )
          ) {
            this._moveSelectionToTop(/* userInitiated */ false);
          }
        }
      },
    );
  }

  _select = (): void => {
    const selectedItem = this._getItemAtIndex(
      this.state.selectedService,
      this.state.selectedDirectory,
      this.state.selectedItemIndex,
    );
    if (!selectedItem) {
      this.props.onCancellation();
    } else {
      const providerName = this.props.searchResultManager.getActiveProviderName();
      const query = this._getTextEditor().getText();
      this.props.onSelection(
        [selectedItem],
        providerName,
        query,
        this.state.selectedItemIndex,
      );
    }
  };

  _getCurrentResultContext(): ?ResultContext {
    const nonEmptyResults = filterEmptyResults(this.state.resultsByService);
    const currentService = nonEmptyResults[this.state.selectedService];

    if (!currentService) {
      return null;
    }

    const serviceNames = Object.keys(nonEmptyResults);
    const currentServiceIndex = serviceNames.indexOf(
      this.state.selectedService,
    );
    const directoryNames = Object.keys(currentService.results);
    const currentDirectoryIndex = directoryNames.indexOf(
      this.state.selectedDirectory,
    );
    const currentDirectory =
      currentService.results[this.state.selectedDirectory];

    if (!currentDirectory || !currentDirectory.results) {
      return null;
    }

    return {
      nonEmptyResults,
      serviceNames,
      currentServiceIndex,
      currentService,
      directoryNames,
      currentDirectoryIndex,
      currentDirectory,
    };
  }

  _moveSelectionDown(userInitiated: boolean): void {
    const context = this._getCurrentResultContext();
    if (!context) {
      this._moveSelectionToTop(userInitiated);
      return;
    }

    if (
      this.state.selectedItemIndex <
      context.currentDirectory.results.length - 1
    ) {
      // only bump the index if remaining in current directory
      this._setSelectedIndex(
        this.state.selectedService,
        this.state.selectedDirectory,
        this.state.selectedItemIndex + 1,
        userInitiated,
      );
    } else {
      // otherwise go to next directory...
      if (context.currentDirectoryIndex < context.directoryNames.length - 1) {
        this._setSelectedIndex(
          this.state.selectedService,
          context.directoryNames[context.currentDirectoryIndex + 1],
          0,
          userInitiated,
        );
      } else {
        // ...or the next service...
        if (context.currentServiceIndex < context.serviceNames.length - 1) {
          const newServiceName =
            context.serviceNames[context.currentServiceIndex + 1];
          const newDirectoryName = Object.keys(
            context.nonEmptyResults[newServiceName].results,
          ).shift();
          this._setSelectedIndex(
            newServiceName,
            newDirectoryName,
            0,
            userInitiated,
          );
        } else {
          // ...or wrap around to the very top
          this._moveSelectionToTop(userInitiated);
        }
      }
    }
  }

  _moveSelectionUp(userInitiated: boolean): void {
    const context = this._getCurrentResultContext();
    if (!context) {
      this._moveSelectionToBottom(userInitiated);
      return;
    }

    if (this.state.selectedItemIndex > 0) {
      // only decrease the index if remaining in current directory
      this._setSelectedIndex(
        this.state.selectedService,
        this.state.selectedDirectory,
        this.state.selectedItemIndex - 1,
        userInitiated,
      );
    } else {
      // otherwise, go to the previous directory...
      if (context.currentDirectoryIndex > 0) {
        this._setSelectedIndex(
          this.state.selectedService,
          context.directoryNames[context.currentDirectoryIndex - 1],
          context.currentService.results[
            context.directoryNames[context.currentDirectoryIndex - 1]
          ].results.length - 1,
          userInitiated,
        );
      } else {
        // ...or the previous service...
        if (context.currentServiceIndex > 0) {
          const newServiceName =
            context.serviceNames[context.currentServiceIndex - 1];
          const newDirectoryName = Object.keys(
            context.nonEmptyResults[newServiceName].results,
          ).pop();
          if (newDirectoryName == null) {
            return;
          }
          const resultsForDirectory =
            context.nonEmptyResults[newServiceName].results[newDirectoryName];
          if (
            resultsForDirectory == null ||
            resultsForDirectory.results == null
          ) {
            return;
          }
          this._setSelectedIndex(
            newServiceName,
            newDirectoryName,
            resultsForDirectory.results.length - 1,
            userInitiated,
          );
        } else {
          // ...or wrap around to the very bottom
          this._moveSelectionToBottom(userInitiated);
        }
      }
    }
  }

  // Update the scroll position of the list view to ensure the selected item is visible.
  _updateScrollPosition(): void {
    if (this._selectionList == null) {
      return;
    }
    const listNode = nullthrows(this._selectionList);
    const selectedNode = listNode.getElementsByClassName('selected')[0];
    // false is passed for @centerIfNeeded parameter, which defaults to true.
    // Passing false causes the minimum necessary scroll to occur, so the selection sticks to the
    // top/bottom.
    if (selectedNode) {
      scrollIntoViewIfNeeded(selectedNode, false);
    }
  }

  _moveSelectionToBottom(userInitiated: boolean): void {
    const bottom = getOuterResults('bottom', this.state.resultsByService);
    if (!bottom) {
      return;
    }
    this._setSelectedIndex(
      bottom.serviceName,
      bottom.directoryName,
      bottom.results.length - 1,
      userInitiated,
    );
  }

  _moveSelectionToTop(userInitiated: boolean): void {
    const top = getOuterResults('top', this.state.resultsByService);
    if (!top) {
      return;
    }
    this._setSelectedIndex(
      top.serviceName,
      top.directoryName,
      0,
      userInitiated,
    );
  }

  _getItemAtIndex(
    serviceName: string,
    directory: string,
    itemIndex: number,
  ): ?ProviderResult {
    if (
      itemIndex === -1 ||
      !this.state.resultsByService[serviceName] ||
      !this.state.resultsByService[serviceName].results[directory] ||
      !this.state.resultsByService[serviceName].results[directory].results[
        itemIndex
      ]
    ) {
      return null;
    }
    return this.state.resultsByService[serviceName].results[directory].results[
      itemIndex
    ];
  }

  _componentForItem(
    item: ProviderResult,
    serviceName: string,
    dirName: string,
  ): React.Element<any> {
    if (item.resultType === 'FILE') {
      (item: FileResult);
      return this.props.searchResultManager.getRendererForProvider(
        serviceName,
        item,
      )(item, serviceName, dirName);
    }
    return this.props.searchResultManager.getRendererForProvider(
      serviceName,
      item,
    )(item, serviceName, dirName);
  }

  _getSelectedIndex(): SelectionIndex {
    return {
      selectedDirectory: this.state.selectedDirectory,
      selectedService: this.state.selectedService,
      selectedItemIndex: this.state.selectedItemIndex,
    };
  }

  _setSelectedIndex(
    service: string,
    directory: string,
    itemIndex: number,
    userInitiated: boolean,
  ): void {
    const newState = {
      selectedService: service,
      selectedDirectory: directory,
      selectedItemIndex: itemIndex,
      hasUserSelection: userInitiated,
    };
    this.setState(newState, () => {
      const selectedIndex = this._getSelectedIndex();
      const providerName = this.props.searchResultManager.getActiveProviderName();
      const query = this._getTextEditor().getText();
      if (this.props.onSelectionChanged != null) {
        this.props.onSelectionChanged(selectedIndex, providerName, query);
      }
    });
  }

  _getInputTextEditor(): ?atom$TextEditorElement {
    if (this._queryInput != null) {
      return this._queryInput.getTextEditor().getElement();
    }
    return null;
  }

  _getTextEditor(): TextEditor {
    return nullthrows(this._queryInput).getTextEditor();
  }

  /**
   * @param newTab is actually a ProviderSpec plus the `name` and `tabContent` properties added by
   *     _renderTabs(), which created the tab object in the first place.
   */
  _handleTabChange = (newTab: Tab): void => {
    const newProviderName = newTab.name;
    const currentProviderName = this.props.searchResultManager.getActiveProviderName();
    if (newProviderName !== currentProviderName) {
      this.props.quickSelectionActions.changeActiveProvider(newProviderName);
    }
  };

  _renderTabs(): React.Element<any> {
    const workspace = atom.views.getView(atom.workspace);
    const tabs = this.state.renderableProviders.map(tab => {
      let keyBinding = null; // TODO
      const humanizedKeybinding = tab.action
        ? _findKeybindingForAction(tab.action, workspace)
        : '';
      if (humanizedKeybinding !== '') {
        keyBinding = <kbd className="key-binding">{humanizedKeybinding}</kbd>;
      }
      return {
        name: tab.name,
        tabContent: (
          <span>
            {tab.title}
            {keyBinding}
          </span>
        ),
      };
    });
    return (
      <div className="omnisearch-tabs">
        <Tabs
          tabs={tabs}
          activeTabName={this.state.activeTab.name}
          onActiveTabChange={this._handleTabChange}
        />
      </div>
    );
  }

  _openAll(): void {
    const selections = flattenResults(this.state.resultsByService);
    const providerName = this.props.searchResultManager.getActiveProviderName();
    const query = this._getTextEditor().getText();
    this.props.onSelection(selections, providerName, query, null);
  }

  render(): React.Node {
    let numTotalResultsRendered = 0;
    const isOmniSearchActive =
      this.state.activeTab.name === 'OmniSearchResultProvider';
    let numQueriesOutstanding = 0;
    const services = Object.keys(this.state.resultsByService).map(
      serviceName => {
        let numResultsForService = 0;
        const directories = this.state.resultsByService[serviceName].results;
        const serviceTitle = this.state.resultsByService[serviceName].title;
        const totalResults = this.state.resultsByService[serviceName]
          .totalResults;
        const directoryNames = Object.keys(directories);
        const directoriesForService = directoryNames.map(dirName => {
          const resultsForDirectory = directories[dirName];
          let message = null;
          if (resultsForDirectory.loading) {
            numQueriesOutstanding++;
            if (!isOmniSearchActive) {
              numTotalResultsRendered++;
              message = (
                <span>
                  <span className="loading loading-spinner-tiny inline-block" />
                  Loading...
                </span>
              );
            }
          } else if (resultsForDirectory.error && !isOmniSearchActive) {
            message = (
              <span>
                <span className="icon icon-circle-slash" />
                Error: <pre>{resultsForDirectory.error}</pre>
              </span>
            );
          } else if (
            resultsForDirectory.results.length === 0 &&
            !isOmniSearchActive
          ) {
            message = (
              <span>
                <span className="icon icon-x" />
                No results
              </span>
            );
          }
          const itemComponents = resultsForDirectory.results.map(
            (item, itemIndex) => {
              numResultsForService++;
              numTotalResultsRendered++;
              const isSelected =
                serviceName === this.state.selectedService &&
                dirName === this.state.selectedDirectory &&
                itemIndex === this.state.selectedItemIndex;
              return (
                <li
                  className={classnames({
                    'quick-open-result-item': true,
                    'list-item': true,
                    selected: isSelected,
                  })}
                  key={serviceName + dirName + itemIndex}
                  onMouseDown={this._select}
                  onMouseMove={this._setSelectedIndex.bind(
                    this,
                    serviceName,
                    dirName,
                    itemIndex,
                    /* userInitiated */ true,
                  )}>
                  {this._componentForItem(item, serviceName, dirName)}
                </li>
              );
            },
          );
          let directoryLabel = null;
          // hide folders if only 1 level would be shown, or if no results were found
          const showDirectories =
            directoryNames.length > 1 &&
            (!isOmniSearchActive || resultsForDirectory.results.length > 0);
          if (showDirectories) {
            directoryLabel = (
              <div className="list-item">
                <span className="icon icon-file-directory">
                  {nuclideUri.nuclideUriToDisplayString(dirName)}
                </span>
              </div>
            );
          }
          return (
            <li
              className={classnames({'list-nested-item': showDirectories})}
              key={dirName}>
              {directoryLabel}
              {message}
              <ul className="list-tree">{itemComponents}</ul>
            </li>
          );
        });
        let serviceLabel = null;
        if (isOmniSearchActive && numResultsForService > 0) {
          serviceLabel = (
            <div
              className="quick-open-provider-item list-item"
              onClick={() =>
                this.props.quickSelectionActions.changeActiveProvider(
                  serviceName,
                )
              }>
              <Icon icon="gear" children={serviceTitle} />
              <Badge
                size={BadgeSizes.small}
                className="quick-open-provider-count-badge"
                value={totalResults}
              />
            </div>
          );
          return (
            <li className="list-nested-item" key={serviceName}>
              {serviceLabel}
              <ul className="list-tree">{directoriesForService}</ul>
            </li>
          );
        }
        return directoriesForService;
      },
    );
    const hasSearchResult = numTotalResultsRendered > 0;
    let omniSearchStatus = null;
    if (isOmniSearchActive && numQueriesOutstanding > 0) {
      omniSearchStatus = (
        <span>
          <span className="loading loading-spinner-tiny inline-block" />
          {'Loading...'}
        </span>
      );
    } else if (isOmniSearchActive && !hasSearchResult) {
      omniSearchStatus = (
        <li>
          <span>
            <span className="icon icon-x" />
            No results
          </span>
        </li>
      );
    }
    const disableOpenAll = !hasSearchResult || !this.state.activeTab.canOpenAll;
    return (
      <div
        className="select-list omnisearch-modal"
        ref={el => {
          this._modal = el;
        }}
        onKeyPress={this._handleKeyPress}>
        <div className="omnisearch-search-bar">
          <AtomInput
            className="omnisearch-pane"
            ref={input => {
              this._queryInput = input;
            }}
            initialValue={this.state.initialQuery}
            placeholderText={this.state.activeTab.prompt}
          />
          <Button
            className="omnisearch-open-all"
            onClick={this._handleClickOpenAll}
            disabled={disableOpenAll}>
            Open All
          </Button>
        </div>
        {this._renderTabs()}
        <div className="omnisearch-results">
          <div className="omnisearch-pane">
            <ul
              className="list-tree"
              ref={el => {
                this._selectionList = el;
              }}>
              {services}
              {omniSearchStatus}
            </ul>
          </div>
        </div>
      </div>
    );
  }
}
