/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import type {ChildProcessInfo} from '../lib/types';
import type {PsInfo, ProcessSummary} from '../lib/getChildProcesses';

import {Observable} from 'rxjs';
import nullthrows from 'nullthrows';
import * as nuclideProcess from 'nuclide-commons/process';

import {
  durationInSeconds,
  queryPs,
  childProcessTree,
  childProcessSummary,
} from '../lib/getChildProcesses';

type QueryPsEntry = {
  line: string,
  ps: PsInfo,
  isDescendant: boolean,
  children: Array<number>,
};

function fakePsEntry(
  pid: number,
  ppid: number,
  command: string,
  isDescendant: boolean,
  ...children: Array<number>
): QueryPsEntry {
  const pcpu = 1;
  const time = 2;
  const rss = 3;
  const vsz = 4;
  return {
    line: `  ${pid}  ${ppid} ${pcpu}  ${time}    ${rss} ${vsz} ${command}  `,
    ps: {pid, ppid, pcpu, time, rss, vsz, command},
    isDescendant,
    children,
  };
}

function fakeSummary(command: string, count: number): ProcessSummary {
  return {
    command,
    count,
    pcpu: count,
    time: count * 2,
    rss: count * 3,
    vsz: count * 4,
  };
}

function setProcessPid(pid: number): number {
  const original = process.pid;
  Object.defineProperty(process, 'pid', {value: pid});
  return original;
}

function checkQueryPs(
  mockPid: number,
  data: Array<QueryPsEntry>,
  summary: Array<ProcessSummary>,
): void {
  describe('sample data', () => {
    const descendants = data.filter(x => x.isDescendant);
    let originalPid: number;

    beforeEach(() => {
      originalPid = setProcessPid(mockPid);
      jest
        .spyOn(nuclideProcess, 'runCommand')
        .mockImplementation((cmd, args, options) => {
          expect(cmd).toEqual('ps');
          expect(args).toEqual(['-eo', 'pid,ppid,pcpu,time,rss,vsz,command']);
          return Observable.of(
            '  PID  PPID  %CPU      TIME    RSS      VSZ COMMAND\n' +
              data.map(entry => entry.line + '\n').join(''),
          );
        });
    });
    afterEach(() => {
      setProcessPid(originalPid);
    });

    it('parses', async () => {
      const expected = new Map(data.map(entry => [entry.ps.pid, entry.ps]));
      const actual = await queryPs('command').toPromise();
      expect(actual).toEqual(expected);
    });

    it('summarizes', async () => {
      const actual = await queryPs('command')
        .map(childProcessSummary)
        .toPromise();
      expect(actual).toEqual(summary);
    });

    it('converts to tree', async () => {
      await (async () => {
        const expectedMap = new Map(descendants.map(x => [x.ps.pid, x]));
        const actual = await queryPs('command')
          .map(childProcessTree)
          .toPromise();
        if (expectedMap.size === 0) {
          expect(actual).toBe(null);
          return;
        }
        function check(node: ChildProcessInfo): number {
          let count = 1;
          const expected = nullthrows(expectedMap.get(node.pid));
          expect(node.children.length).toBe(expected.children.length);
          for (const child of node.children) {
            expect(expected.children.includes(child.pid)).toBe(true);
            count += check(child);
          }
          return count;
        }
        const count = check(nullthrows(actual));
        expect(count).toBe(data.filter(x => x.isDescendant).length);
      })();
    });
  });
}

describe('getChildProcesses', () => {
  describe('single process', () => {
    checkQueryPs(
      2,
      [fakePsEntry(1, 0, 'init', false), fakePsEntry(2, 1, 'nuclide', true)],
      [fakeSummary('nuclide', 1)],
    );
  });

  describe('other processes', () => {
    checkQueryPs(
      5,
      [
        fakePsEntry(1, 0, 'init', false),
        fakePsEntry(2, 1, 'launchd', false),
        fakePsEntry(3, 1, 'cron', false),
        fakePsEntry(4, 1, 'mdworker', false),
        fakePsEntry(5, 1, 'nuclide', true),
        fakePsEntry(6, 1, 'chrome', false),
        fakePsEntry(7, 1, 'iTerm2', false),
        fakePsEntry(8, 7, 'bash', false),
      ],
      [fakeSummary('nuclide', 1)],
    );
  });

  describe('direct sub-processes', () => {
    checkQueryPs(
      2,
      [
        fakePsEntry(1, 0, 'init', false),
        fakePsEntry(2, 1, 'nuclide', true, 3, 4, 5, 6),
        fakePsEntry(3, 2, 'flow', true),
        fakePsEntry(4, 2, 'hg', true),
        fakePsEntry(5, 2, 'flow', true),
        fakePsEntry(6, 2, 'hg', true),
      ],
      [fakeSummary('flow', 2), fakeSummary('hg', 2), fakeSummary('nuclide', 1)],
    );
  });

  describe('sub-process tree', () => {
    checkQueryPs(
      2,
      [
        fakePsEntry(1, 0, 'init', false),
        fakePsEntry(2, 1, 'nuclide', true, 3, 4),
        fakePsEntry(3, 2, 'flow', true, 5, 6),
        fakePsEntry(4, 2, 'hg', true, 7, 8),
        fakePsEntry(5, 3, 'flow', true),
        fakePsEntry(6, 3, 'flow', true),
        fakePsEntry(7, 4, 'hg', true),
        fakePsEntry(8, 4, 'hg', true),
      ],
      [fakeSummary('flow', 3), fakeSummary('hg', 3), fakeSummary('nuclide', 1)],
    );
  });

  describe('missing process', () => {
    checkQueryPs(1, [], []);
  });

  describe('durationInSeconds', () => {
    it('handles integers', () => {
      expect(durationInSeconds('5')).toBe(5);
    });
    it('handles doubles', () => {
      expect(durationInSeconds('2.5')).toBe(2.5);
    });
    it('handles minutes', () => {
      expect(durationInSeconds('5:00')).toBe(5 * 60);
    });
    it('handles hours', () => {
      expect(durationInSeconds('5:00:00')).toBe(5 * 60 * 60);
    });
    it('handles everything at once', () => {
      expect(durationInSeconds('500:10:20.5')).toBe(
        500 * 60 * 60 + 10 * 60 + 20.5,
      );
    });
  });
});
