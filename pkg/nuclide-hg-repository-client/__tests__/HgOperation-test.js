/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */

import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {RevisionInfoFetched} from '../../nuclide-hg-rpc/lib/types';
import type {
  HgOperation,
  TreePreviewApplierFunction,
  ReportedOptimisticState,
} from '../lib/HgOperation';
import type {RevisionTree} from '../lib/revisionTree/RevisionTree';

import invariant from 'assert';
import {Observable, Subject} from 'rxjs';
import typeof * as HgService from '../../nuclide-hg-rpc/lib/HgService';

import {HgRepositoryClient} from '..';
import {emptyHgOperationProgress} from '../lib/HgOperation';

import {makeRevisionChain} from '../../nuclide-hg-rpc/__mocks__/MockHgTypes';
import {sleep} from 'nuclide-commons/promise';
import {HgPullOperation} from '../lib/operations/PullOperation';

class TestHgOperation implements HgOperation {
  _hash: string;
  constructor(hash: string) {
    this._hash = hash;
  }

  name = 'test';

  getArgs() {
    return ['test', this._hash];
  }

  getEquivalentCommand() {
    return `hg test ${this._hash}`;
  }

  getCommandDocumentation() {
    return {
      naturalLanguageDescription: 'Just a test',
      confirmationMessage: 'confirm',
    };
  }
}

describe('HgOperations', () => {
  describe('runOperation', () => {
    let mockService: ?HgService;
    let client;
    const mockRepoPath = 'testRepo';
    let mockExecutionOutput: ?Array<LegacyProcessMessage> = null;
    let mockExecutionSubject: ?Subject<LegacyProcessMessage> = null;
    let mockRevisionTreeUpdates: ?Subject<RevisionInfoFetched> = null;

    beforeEach(() => {
      mockRevisionTreeUpdates = new Subject();
      mockService = (({
        observeExecution: jest.fn(),
        observeRevisionChanges: jest.fn(),
        createRepositorySubscriptions: () => Promise.resolve(),
        fetchStatuses: () => Observable.empty().publish(),
      }: any): HgService);
      client = new HgRepositoryClient(mockRepoPath, mockService, {
        originURL: null,
        workingDirectoryPath: mockRepoPath,
      });
      jest.spyOn(mockService, 'observeExecution').mockImplementation(() => {
        if (mockExecutionSubject != null) {
          return mockExecutionSubject.asObservable().publish();
        }
        invariant(mockExecutionOutput != null);
        return Observable.from(mockExecutionOutput)
          .concatMap(val => {
            // emit one value per tick, to simulate the process running
            return Observable.of(val).delay(0);
          })
          .publish();
      });
      jest
        .spyOn(client._sharedMembers.revisionsCache, 'observeRevisionChanges')
        .mockImplementation(() => {
          invariant(mockRevisionTreeUpdates != null);
          return mockRevisionTreeUpdates.asObservable().concatMap(val => {
            // emit one value per tick, to simulate the process running
            return Observable.of(val).delay(0);
          });
        });
    });
    afterEach(() => {
      mockExecutionOutput = null;
      mockExecutionSubject = null;
    });

    it('runs operations', async () => {
      const hash = '111111';
      const operation = new TestHgOperation(hash);
      mockExecutionOutput = [
        {kind: 'stdout', data: 'hello'},
        {kind: 'stdout', data: 'world!'},
        {kind: 'exit', exitCode: 0, signal: null},
      ];

      const outputPromise = client
        .runOperation(operation)
        .do(progress => {
          if (progress != null && progress.hasProcessExited) {
            invariant(mockRevisionTreeUpdates != null);
            // pretend we notice a watchman update once the command finishes
            mockRevisionTreeUpdates.next({revisions: [], fromFilesystem: true});
          }
        })
        .toArray()
        .toPromise();

      const output = await outputPromise;

      const baseProgress = emptyHgOperationProgress(operation);
      expect(output).toEqual([
        {...baseProgress},
        {...baseProgress, stdout: ['hello']},
        {...baseProgress, stdout: ['hello', 'world!']},
        {
          ...baseProgress,
          stdout: ['hello', 'world!'],
          hasProcessExited: true,
          exitCode: 0,
          hasCompleted: false,
        },
        {
          ...baseProgress,
          stdout: ['hello', 'world!'],
          hasProcessExited: true,
          exitCode: 0,
          hasCompleted: true,
        },
      ]);
    });

    it('emits optimistic state functions based on revision list', async () => {
      invariant(mockRevisionTreeUpdates != null);
      const hash = '111111';
      const operation = new TestHgOperation(hash);
      mockExecutionSubject = new Subject();

      const testRevList = makeRevisionChain(4, {
        phase: 'public',
        remoteBookmarks: ['test'],
      });

      const func1: TreePreviewApplierFunction = () => [[], null];
      const func2: TreePreviewApplierFunction = () => [[], null];
      // $FlowIgnore - flow doesn't want us to rewrite methods
      operation.makeOptimisticStateApplier = (
        treeObservable: Observable<Array<RevisionTree>>,
      ): Observable<?ReportedOptimisticState> => {
        return treeObservable
          .takeWhile(trees => {
            return trees.length < 3;
          })
          .map(trees => {
            // just to test different optimistic functions, use the length of the tree
            switch (trees.length) {
              case 1:
                return func1;
              case 2:
                return func2;
            }
            return null;
          })
          .map(optimisticApplier => ({
            optimisticApplier,
          }));
      };

      const outputPromise = client
        .runOperation(operation)
        .toArray()
        .toPromise();

      mockExecutionSubject.next({kind: 'stdout', data: '1'});
      mockRevisionTreeUpdates.next({
        revisions: testRevList.slice(0, 1),
        fromFilesystem: true,
      });
      await sleep(5);

      mockExecutionSubject.next({kind: 'stdout', data: '2'});
      mockRevisionTreeUpdates.next({
        revisions: testRevList.slice(0, 2),
        fromFilesystem: true,
      });
      await sleep(5);

      mockExecutionSubject.next({kind: 'stdout', data: '3'});
      mockRevisionTreeUpdates.next({
        revisions: testRevList.slice(0, 3),
        fromFilesystem: true,
      });
      await sleep(5);

      mockExecutionSubject.next({kind: 'exit', exitCode: 0, signal: null});
      mockExecutionSubject.complete();

      const output = await outputPromise;

      const baseProgress = emptyHgOperationProgress(operation);
      expect(output).toEqual([
        {...baseProgress},
        {...baseProgress, stdout: ['1']},
        {
          ...baseProgress,
          stdout: ['1'],
          optimisticApplier: func1,
        },
        {
          ...baseProgress,
          stdout: ['1', '2'],
          optimisticApplier: func1,
        },
        {
          ...baseProgress,
          stdout: ['1', '2'],
          optimisticApplier: func2,
        },
        {
          ...baseProgress,
          stdout: ['1', '2', '3'],
          optimisticApplier: func2,
        },
        {
          ...baseProgress,
          stdout: ['1', '2', '3'],
          optimisticApplier: null,
        },
        {
          ...baseProgress,
          stdout: ['1', '2', '3'],
          hasProcessExited: true,
          exitCode: 0,
          hasCompleted: false,
        },
        {
          ...baseProgress,
          stdout: ['1', '2', '3'],
          hasProcessExited: true,
          exitCode: 0,
          hasCompleted: true,
        },
      ]);
    });

    it('accumulates errors from stderr', async () => {
      const hash = '111111';
      const operation = new TestHgOperation(hash);
      mockExecutionOutput = [
        {kind: 'stdout', data: 'hello'},
        {kind: 'stderr', data: 'A\n'},
        {kind: 'stderr', data: 'B\n'},
        {kind: 'exit', exitCode: 1, signal: null},
      ];

      expect(client.runOperation(operation).toPromise()).rejects.toThrow(
        'hg test exited with status 1\nA\n\nB\n',
      );
    });

    it('reports errors', async () => {
      const hash = '111111';
      const operation = new TestHgOperation(hash);
      mockExecutionOutput = [
        {kind: 'stdout', data: 'hello'},
        {kind: 'stderr', data: 'Some error message!\n'},
        {kind: 'exit', exitCode: 1, signal: null},
      ];

      const reportError = jest.fn();

      await client
        .runOperation(operation, reportError)
        .toArray()
        .toPromise()
        .catch(() => {});

      expect(reportError).toHaveBeenCalled();
      const error = reportError.mock.calls[0][1];
      invariant(error instanceof Error);
      expect(error.toString()).toContain('Some error message!');
    });

    it('supports loading spinner in optimistic state', async () => {
      const operation = new HgPullOperation();
      mockExecutionOutput = [
        {kind: 'stdout', data: 'hello'},
        {kind: 'exit', exitCode: 0, signal: null},
      ];

      const outputPromise = client
        .runOperation(operation)
        .toArray()
        .toPromise();

      const output = await outputPromise;

      const baseProgress = emptyHgOperationProgress(operation);
      expect(output).toEqual([
        {...baseProgress, showFullscreenSpinner: true},
        {...baseProgress, showFullscreenSpinner: true, stdout: ['hello']},
        {
          ...baseProgress,
          showFullscreenSpinner: true,
          stdout: ['hello'],
          hasProcessExited: true,
          exitCode: 0,
          hasCompleted: false,
        },
        {
          ...baseProgress,
          stdout: ['hello'],
          hasProcessExited: true,
          exitCode: 0,
          hasCompleted: true,
        },
      ]);
    });
  });
});
