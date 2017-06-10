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

import type {ChildProcessInfo, IOBytesStats} from './types';

import {runCommand} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import os from 'os';

type PSTable = {
  cpids: {
    [ppid: number]: Array<number>,
  },
  cpus: {
    [pid: number]: number,
  },
  commands: {
    [pid: number]: string,
  },
  ioBytesStats: {
    [pid: number]: IOBytesStats,
  },
};

export default function getChildProcessesTree(): Observable<?ChildProcessInfo> {
  if (os.platform() !== 'darwin') {
    return Observable.of(null);
  }

  return runCommand('ps', ['axo', 'ppid,pid,pcpu,command'], {
    dontLogInNuclide: true,
  })
    .map(parsePSOutput)
    .map(ps => buildTree(ps, process.pid));
}

function getActiveHandles(): Array<Object> {
  // $FlowFixMe: Private method.
  return process._getActiveHandles();
}

function parsePSOutput(output: string): PSTable {
  const cpids = {};
  const cpus = {};
  const commands = {};
  const ioBytesStats = {};
  const lines = output.split('\n');
  lines.forEach(line => {
    const [ppid, pid, cpu, ...spawnargs] = line.trim().split(/ +/);
    if (spawnargs.join(' ') === 'ps axo ppid,pid,pcpu,command') {
      return;
    }
    cpids[ppid] = cpids[ppid] || [];
    cpids[ppid].push(Number(pid));
    cpus[pid] = Number(cpu);
    commands[pid] = spawnargs.join(' ');
  });
  getActiveHandles().forEach(handle => {
    const type = handle.constructor.name.toLowerCase();
    if (type === 'childprocess') {
      ioBytesStats[handle.pid] = {
        stdin: handle.stdin && handle.stdin.bytesWritten,
        stdout: handle.stdout && handle.stdout.bytesRead,
        stderr: handle.stderr && handle.stderr.bytesRead,
      };
    }
  });
  return {cpids, cpus, commands, ioBytesStats};
}

function buildTree(ps: PSTable, pid: number): ChildProcessInfo {
  return {
    pid,
    command: ps.commands[pid],
    cpuPercentage: ps.cpus[pid],
    children: (ps.cpids[pid] || []).map(cpid => buildTree(ps, cpid)),
    ioBytesStats: ps.ioBytesStats[pid],
  };
}
