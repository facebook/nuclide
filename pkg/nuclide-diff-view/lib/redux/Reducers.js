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
  Action,
  AppState,
  CommitState,
  FileDiffState,
  PublishState,
  RepositoryAction,
  RepositoryState,
  UIProvider,
  UpdateActiveNavigationSectionAction,
  UpdateFileDiffAction,
  UpdateFileUiElementsAction,
} from '../types';
import type {HgRepositoryClient} from '../../../nuclide-hg-repository-client';

import * as ActionTypes from './ActionTypes';
import invariant from 'assert';
import {
  createEmptyAppState,
  getEmptyRepositoryState,
} from './createEmptyAppState';
import {
  computeNavigationSections,
} from '../diff-utils';
import {
  getHeadRevision,
  formatFileDiffRevisionTitle,
} from '../utils';

const FILESYSTEM_REVISION_TITLE = 'Filesystem / Editor';

export function rootReducer(
  state: ?AppState,
  action: Action,
): AppState {
  if (state == null) {
    return createEmptyAppState();
  }
  switch (action.type) {
    case ActionTypes.UPDATE_ACTIVE_REPOSITORY: {
      const {hgRepository} = action.payload;
      return {
        ...state,
        activeRepository: hgRepository,
        activeRepositoryState: reduceActiveRepositoryState(state.repositories, hgRepository),
      };
    }

    case ActionTypes.ADD_REPOSITORY:
    case ActionTypes.REMOVE_REPOSITORY:
    case ActionTypes.SET_COMPARE_ID:
    case ActionTypes.UPDATE_DIRTY_FILES:
    case ActionTypes.UPDATE_SELECTED_FILES:
    case ActionTypes.UPDATE_HEAD_TO_FORKBASE_REVISIONS:
    case ActionTypes.UPDATE_LOADING_SELECTED_FILES: {
      const repositories = reduceRepositories(state.repositories, action);

      return {
        ...state,
        activeRepositoryState: reduceActiveRepositoryState(repositories, state.activeRepository),
        repositories,
      };
    }

    case ActionTypes.UPDATE_SUGGESTED_REVIEWERS: {
      return {
        ...state,
        suggestedReviewers: action.payload.suggestedReviewers,
      };
    }

    case ActionTypes.UPDATE_COMMIT_STATE:
    case ActionTypes.SET_COMMIT_MODE: {
      return {
        ...state,
        commit: reduceCommitState(state.commit, action),
      };
    }

    case ActionTypes.UPDATE_PUBLISH_STATE:
      return {
        ...state,
        publish: reducePublishState(state.publish, action),
      };

    case ActionTypes.UPDATE_FILE_DIFF:
      return {
        ...state,
        fileDiff: reduceFileDiff(state.fileDiff, action),
      };
    case ActionTypes.UPDATE_FILE_UI_ELEMENTS:
      return {
        ...state,
        fileDiff: reduceUiElements(state.fileDiff, action),
      };

    case ActionTypes.UPDATE_ACTIVE_NAVIGATION_SECTION:
      return {
        ...state,
        fileDiff: reduceNavigationSectionIndex(state.fileDiff, action),
      };


    case ActionTypes.UPDATE_LOADING_FILE_DIFF:
      return {
        ...state,
        isLoadingFileDiff: action.payload.isLoading,
      };

    case ActionTypes.SET_SHOULD_REBASE_ON_AMEND:
      return {
        ...state,
        shouldRebaseOnAmend: action.payload.shouldRebaseOnAmend,
      };

    case ActionTypes.SET_VIEW_MODE:
      return {
        ...state,
        viewMode: action.payload.viewMode,
      };

    case ActionTypes.SET_CWD_API:
      return {
        ...state,
        cwdApi: action.payload.cwdApi,
      };

    case ActionTypes.ADD_UI_PROVIDER:
    case ActionTypes.REMOVE_UI_PROVIDER:
      return {
        ...state,
        uiProviders: reduceUiProviders(state.uiProviders, action),
      };

    case ActionTypes.UPDATE_DIFF_EDITORS_VISIBILITY:
      return {
        ...state,
        diffEditorsVisible: action.payload.visible,
      };

    case ActionTypes.UPDATE_DIFF_EDITORS:
      return {
        ...state,
        diffEditors: action.payload,
      };
    case ActionTypes.UPDATE_DIFF_NAVIGATOR_VISIBILITY:
      return {
        ...state,
        diffNavigatorVisible: action.payload.visible,
      };

    case ActionTypes.UPDATE_DOCK_CONFIG:
      return {
        ...state,
        shouldDockPublishView: action.payload.shouldDockPublishView,
      };

    default:
      return state;
  }
}

function reduceActiveRepositoryState(
  repositories: Map<HgRepositoryClient, RepositoryState>,
  activeRepository: ?HgRepositoryClient,
): RepositoryState {
  if (activeRepository == null || !repositories.has(activeRepository)) {
    return getEmptyRepositoryState();
  }
  const activeRepositoryState = repositories.get(activeRepository);
  invariant(activeRepositoryState != null);
  return activeRepositoryState;
}

function reduceRepositories(
  repositories: Map<HgRepositoryClient, RepositoryState>,
  action: RepositoryAction,
): Map<HgRepositoryClient, RepositoryState> {
  const newRepositories = new Map(repositories);
  const {repository} = action.payload;

  switch (action.type) {
    case ActionTypes.SET_COMPARE_ID:
    case ActionTypes.UPDATE_DIRTY_FILES:
    case ActionTypes.UPDATE_SELECTED_FILES:
    case ActionTypes.UPDATE_HEAD_TO_FORKBASE_REVISIONS:
    case ActionTypes.UPDATE_LOADING_SELECTED_FILES: {
      const oldRepositoryState = repositories.get(repository);
      invariant(oldRepositoryState != null);
      newRepositories.set(repository, reduceRepositoryAction(oldRepositoryState, action));
      break;
    }
    case ActionTypes.ADD_REPOSITORY: {
      newRepositories.set(repository, getEmptyRepositoryState());
      break;
    }
    case ActionTypes.REMOVE_REPOSITORY: {
      newRepositories.delete(repository);
      break;
    }
  }
  return newRepositories;
}

function reduceRepositoryAction(
  repositoryState: RepositoryState,
  action: RepositoryAction,
): RepositoryState {
  switch (action.type) {
    case ActionTypes.SET_COMPARE_ID:
      return {
        ...repositoryState,
        compareRevisionId: action.payload.compareId,
      };
    case ActionTypes.UPDATE_DIRTY_FILES:
      return {
        ...repositoryState,
        dirtyFiles: action.payload.dirtyFiles,
      };
    case ActionTypes.UPDATE_SELECTED_FILES:
      return {
        ...repositoryState,
        selectedFiles: action.payload.selectedFiles,
      };
    case ActionTypes.UPDATE_HEAD_TO_FORKBASE_REVISIONS: {
      const {headToForkBaseRevisions} = action.payload;
      return {
        ...repositoryState,
        headToForkBaseRevisions,
        headRevision: getHeadRevision(headToForkBaseRevisions),
        revisionStatuses: action.payload.revisionStatuses,
      };
    }
    case ActionTypes.UPDATE_LOADING_SELECTED_FILES:
      return {
        ...repositoryState,
        isLoadingSelectedFiles: action.payload.isLoading,
      };
    default:
      throw new Error('Invalid Repository Action!');
  }
}

function reduceCommitState(
  state: CommitState,
  action: Action,
): CommitState {
  switch (action.type) {
    case ActionTypes.UPDATE_COMMIT_STATE:
      return action.payload.commit;
    case ActionTypes.SET_COMMIT_MODE:
      return {
        ...state,
        mode: action.payload.commitMode,
      };
  }
  return state;
}

function reducePublishState(
  state: PublishState,
  action: Action,
): PublishState {
  switch (action.type) {
    case ActionTypes.UPDATE_PUBLISH_STATE:
      return action.payload.publish;
  }
  return state;
}

function reduceFileDiff(
  state: FileDiffState,
  action: UpdateFileDiffAction,
): FileDiffState {
  const {filePath, fromRevision, newContents, oldContents, textDiff} = action.payload;
  let {inlineElements: newEditorElements} = state.newEditorState;
  let {inlineElements: oldEditorElements} = state.oldEditorState;
  let {activeSectionIndex} = state;

  if (state.filePath !== filePath) {
    // Clear the ui elements and section index.
    activeSectionIndex = -1;
    newEditorElements = new Map();
    oldEditorElements = new Map();
  }

  const {
    addedLines,
    removedLines,
    newToOld,
    oldToNew,
  } = textDiff;

  // Deserialize from JSON.
  const oldLineOffsets = new Map(textDiff.oldLineOffsets);
  const newLineOffsets = new Map(textDiff.newLineOffsets);

  const oldEditorState = {
    revisionTitle: fromRevision == null ? '...' : formatFileDiffRevisionTitle(fromRevision),
    text: oldContents,
    offsets: oldLineOffsets,
    highlightedLines: {
      added: [],
      removed: removedLines,
    },
    inlineElements: oldEditorElements,
    inlineOffsetElements: newEditorElements,
  };
  const newEditorState = {
    revisionTitle: FILESYSTEM_REVISION_TITLE,
    text: newContents,
    offsets: newLineOffsets,
    highlightedLines: {
      added: addedLines,
      removed: [],
    },
    inlineElements: newEditorElements,
    inlineOffsetElements: oldEditorElements,
  };

  const navigationSections = computeNavigationSections(
    addedLines,
    removedLines,
    newEditorElements.keys(),
    oldEditorElements.keys(),
    oldLineOffsets,
    newLineOffsets,
  );

  return {
    activeSectionIndex,
    filePath,
    lineMapping: {newToOld, oldToNew},
    newEditorState,
    oldEditorState,
    navigationSections,
  };
}

function reduceUiElements(
  state: FileDiffState,
  action: UpdateFileUiElementsAction,
): FileDiffState {
  const {newEditorElements, oldEditorElements} = action.payload;
  const {newEditorState, oldEditorState} = state;

  const navigationSections = computeNavigationSections(
    newEditorState.highlightedLines.added,
    oldEditorState.highlightedLines.removed,
    newEditorElements.keys(),
    oldEditorElements.keys(),
    oldEditorState.offsets,
    newEditorState.offsets,
  );

  return {
    ...state,
    oldEditorState: {
      ...oldEditorState,
      inlineElements: oldEditorElements,
      inlineOffsetElements: newEditorElements,
    },
    newEditorState: {
      ...newEditorState,
      inlineElements: newEditorElements,
      inlineOffsetElements: oldEditorElements,
    },
    navigationSections,
  };
}

function reduceNavigationSectionIndex(
  state: FileDiffState,
  action: UpdateActiveNavigationSectionAction,
): FileDiffState {
  return {
    ...state,
    activeSectionIndex: action.payload.sectionIndex,
  };
}

function reduceUiProviders(
  state: Array<UIProvider>,
  action: Action,
): Array<UIProvider> {
  switch (action.type) {
    case ActionTypes.ADD_UI_PROVIDER:
      return state.concat(action.payload.uiProvider);
    case ActionTypes.REMOVE_UI_PROVIDER:
      const {uiProvider} = action.payload;
      return state.filter(provider => provider !== uiProvider);
  }
  return state || [];
}
