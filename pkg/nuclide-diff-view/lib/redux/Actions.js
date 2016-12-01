'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Message} from '../../../nuclide-console/lib/types';
import type {NuclideUri} from '../../../commons-node/nuclideUri';
import type {
  AddRepositoryAction,
  AddUiProviderAction,
  CommitAction,
  CommitModeType,
  CommitState,
  DiffEditorsState,
  DiffFileAction,
  DiffModeType,
  EditorElementsMap,
  FileChangeStatusValue,
  PublishDiffAction,
  PublishState,
  RemoveRepositoryAction,
  RemoveUiProviderAction,
  SetCommitModeAction,
  SetCompareIdAction,
  SetCwdApiAction,
  SetShouldReabaseOnAmendAction,
  SetViewModeAction,
  TextDiff,
  UIProvider,
  UpdateActiveNavigationSectionAction,
  UpdateActiveRepositoryAction,
  UpdateCommitStateAction,
  UpdateDockConfigAction,
  UpdateSuggestedReviewersAction,
  UpdateDiffEditorsAction,
  UpdateDiffEditorsVisibilityAction,
  UpdateDiffNavigatorVisibilityAction,
  UpdateDirtyFilesAction,
  UpdateFileDiffAction,
  UpdateFileUiElementsAction,
  UpdateHeadToForkBaseRevisions,
  UpdateLoadingFileDiffAction,
  UpdateLoadingSelectedFilesAction,
  UpdatePublishStateAction,
  UpdateSelectedFilesAction,
  SuggestedReviewersState,
} from '../types';
import type {HgRepositoryClient} from '../../../nuclide-hg-repository-client';
import type {RevisionStatuses} from '../../../nuclide-hg-repository-client/lib/HgRepositoryClient';
import type {
  RevisionInfo,
} from '../../../nuclide-hg-rpc/lib/HgService';
import type {CwdApi} from '../../../nuclide-current-working-directory/lib/CwdApi';
import type {Subject} from 'rxjs';

import * as ActionTypes from './ActionTypes';

export function addRepository(
  repository: HgRepositoryClient,
): AddRepositoryAction {
  return {
    type: ActionTypes.ADD_REPOSITORY,
    payload: {
      repository,
    },
  };
}

export function setCompareId(
  repository: HgRepositoryClient,
  compareId: ?number,
): SetCompareIdAction {
  return {
    type: ActionTypes.SET_COMPARE_ID,
    payload: {
      repository,
      compareId,
    },
  };
}

export function updateDirtyFiles(
  repository: HgRepositoryClient,
  dirtyFiles: Map<NuclideUri, FileChangeStatusValue>,
): UpdateDirtyFilesAction {
  return {
    type: ActionTypes.UPDATE_DIRTY_FILES,
    payload: {
      repository,
      dirtyFiles,
    },
  };
}

export function removeRepository(
  repository: HgRepositoryClient,
): RemoveRepositoryAction {
  return {
    type: ActionTypes.REMOVE_REPOSITORY,
    payload: {
      repository,
    },
  };
}

export function updateSelectedFiles(
  repository: HgRepositoryClient,
  selectedFiles: Map<NuclideUri, FileChangeStatusValue>,
): UpdateSelectedFilesAction {
  return {
    type: ActionTypes.UPDATE_SELECTED_FILES,
    payload: {
      repository,
      selectedFiles,
    },
  };
}

export function updateLoadingSelectedFiles(
  repository: HgRepositoryClient,
  isLoading: boolean,
): UpdateLoadingSelectedFilesAction {
  return {
    type: ActionTypes.UPDATE_LOADING_SELECTED_FILES,
    payload: {
      repository,
      isLoading,
    },
  };
}

export function updateHeadToForkBaseRevisionsState(
  repository: HgRepositoryClient,
  headToForkBaseRevisions: Array<RevisionInfo>,
  revisionStatuses: RevisionStatuses,
): UpdateHeadToForkBaseRevisions {
  return {
    type: ActionTypes.UPDATE_HEAD_TO_FORKBASE_REVISIONS,
    payload: {
      repository,
      headToForkBaseRevisions,
      revisionStatuses,
    },
  };
}

export function updateActiveRepository(
  hgRepository: ?HgRepositoryClient,
): UpdateActiveRepositoryAction {
  return {
    type: ActionTypes.UPDATE_ACTIVE_REPOSITORY,
    payload: {
      hgRepository,
    },
  };
}

export function setCwdApi(
  cwdApi: ?CwdApi,
): SetCwdApiAction {
  return {
    type: ActionTypes.SET_CWD_API,
    payload: {
      cwdApi,
    },
  };
}

export function diffFile(
  filePath: NuclideUri,
  onChangeModified: () => mixed,
): DiffFileAction {
  return {
    type: ActionTypes.DIFF_FILE,
    payload: {
      filePath,
      onChangeModified,
    },
  };
}

export function updateFileDiff(
  filePath: NuclideUri,
  newContents: string,
  oldContents: string,
  fromRevision: ?RevisionInfo,
  textDiff: TextDiff,
): UpdateFileDiffAction {
  return {
    type: ActionTypes.UPDATE_FILE_DIFF,
    payload: {
      filePath,
      fromRevision,
      newContents,
      oldContents,
      textDiff,
    },
  };
}

export function updateFileUiElements(
  newEditorElements: EditorElementsMap,
  oldEditorElements: EditorElementsMap,
): UpdateFileUiElementsAction {
  return {
    type: ActionTypes.UPDATE_FILE_UI_ELEMENTS,
    payload: {
      newEditorElements,
      oldEditorElements,
    },
  };
}

export function setViewMode(
  viewMode: DiffModeType,
): SetViewModeAction {
  return {
    type: ActionTypes.SET_VIEW_MODE,
    payload: {
      viewMode,
    },
  };
}

export function setCommitMode(
  commitMode: CommitModeType,
): SetCommitModeAction {
  return {
    type: ActionTypes.SET_COMMIT_MODE,
    payload: {
      commitMode,
    },
  };
}

export function updateCommitState(
  commitState: CommitState,
): UpdateCommitStateAction {
  return {
    type: ActionTypes.UPDATE_COMMIT_STATE,
    payload: {
      commit: commitState,
    },
  };
}

export function updateSuggestedReviewers(
  suggestedReviewers: SuggestedReviewersState,
): UpdateSuggestedReviewersAction {
  return {
    type: ActionTypes.UPDATE_SUGGESTED_REVIEWERS,
    payload: {
      suggestedReviewers,
    },
  };
}

export function updatePublishState(
  publish: PublishState,
): UpdatePublishStateAction {
  return {
    type: ActionTypes.UPDATE_PUBLISH_STATE,
    payload: {
      publish,
    },
  };
}

export function setShouldRebaseOnAmend(
  shouldRebaseOnAmend: boolean,
): SetShouldReabaseOnAmendAction {
  return {
    type: ActionTypes.SET_SHOULD_REBASE_ON_AMEND,
    payload: {
      shouldRebaseOnAmend,
    },
  };
}

export function commit(
  repository: HgRepositoryClient,
  message: string,
  publishUpdates: Subject<Message>,
): CommitAction {
  return {
    type: ActionTypes.COMMIT,
    payload: {
      message,
      repository,
      publishUpdates,
    },
  };
}

export function publishDiff(
  repository: HgRepositoryClient,
  message: string,
  isPrepareMode: boolean,
  lintExcuse: ?string,
  publishUpdates: Subject<Message>,
): PublishDiffAction {
  return {
    type: ActionTypes.PUBLISH_DIFF,
    payload: {
      isPrepareMode,
      lintExcuse,
      message,
      publishUpdates,
      repository,
    },
  };
}

export function addUiProvider(
  uiProvider: UIProvider,
): AddUiProviderAction {
  return {
    type: ActionTypes.ADD_UI_PROVIDER,
    payload: {
      uiProvider,
    },
  };
}

export function removeUiProvider(
  uiProvider: UIProvider,
): RemoveUiProviderAction {
  return {
    type: ActionTypes.REMOVE_UI_PROVIDER,
    payload: {
      uiProvider,
    },
  };
}

export function updateLoadingFileDiff(
  isLoading: boolean,
): UpdateLoadingFileDiffAction {
  return {
    type: ActionTypes.UPDATE_LOADING_FILE_DIFF,
    payload: {
      isLoading,
    },
  };
}

export function updateDiffEditorsVisibility(
  visible: boolean,
): UpdateDiffEditorsVisibilityAction {
  return {
    type: ActionTypes.UPDATE_DIFF_EDITORS_VISIBILITY,
    payload: {
      visible,
    },
  };
}

export function updateDiffEditors(
  diffEditors: ?DiffEditorsState,
): UpdateDiffEditorsAction {
  return {
    type: ActionTypes.UPDATE_DIFF_EDITORS,
    payload: diffEditors,
  };
}

export function updateDiffNavigatorVisibility(
  visible: boolean,
): UpdateDiffNavigatorVisibilityAction {
  return {
    type: ActionTypes.UPDATE_DIFF_NAVIGATOR_VISIBILITY,
    payload: {
      visible,
    },
  };
}

export function updateActiveNavigationSection(
  sectionIndex: number,
): UpdateActiveNavigationSectionAction {
  return {
    type: ActionTypes.UPDATE_ACTIVE_NAVIGATION_SECTION,
    payload: {
      sectionIndex,
    },
  };
}

export function updateDockConfig(
  shouldDockPublishView: boolean,
): UpdateDockConfigAction {
  return {
    type: ActionTypes.UPDATE_DOCK_CONFIG,
    payload: {
      shouldDockPublishView,
    },
  };
}
