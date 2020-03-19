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

import os from 'os';
import nullthrows from 'nullthrows';
import {Observable} from 'rxjs';

import {mapFilter} from 'nuclide-commons/collection';
import {runCommand} from 'nuclide-commons/process';

// Represents parsed information about a process from 'ps'.
export type PsInfo = {
  pid: number,
  ppid: number,
  pcpu: number,
  time: number,
  rss: number,
  vsz: number,
  command: string,
};

// Summary of process metadata for all sub-processes with the
// same command. Typically this uses the 'ps' formatting flag 'comm'
// to include just the executable path, and not the command arguments.
export type ProcessSummary = {
  command: string,
  count: number,
  pcpu: number,
  time: number,
  rss: number,
  vsz: number,
};

export function childProcessTree(ps: Map<number, PsInfo>): ?ChildProcessInfo {
  const ioMap = mapIoStats();
  const viewPs = mapFilter(
    ps,
    (k, v) => v.command !== 'ps -eo pid,ppid,pcpu,time,rss,vsz,command',
  );
  return postOrder(process.pid, mapChildren(viewPs), (pid, children) => {
    const process = viewPs.get(pid);
    if (process == null) {
      return null;
    }
    return {
      pid,
      command: process.command,
      cpuPercentage: process.pcpu,
      children: children.filter(Boolean),
      ioBytesStats: ioMap.get(pid),
    };
  });
}

export function childProcessSummary(
  ps: Map<number, PsInfo>,
): Array<ProcessSummary> {
  const subPs = postOrder(process.pid, mapChildren(ps), (pid, children) => {
    const pidPs = ps.get(pid);
    if (pidPs == null) {
      return [];
    }
    return [pidPs].concat(...children);
  });
  return aggregate(subPs);
}

export function queryPs(cmd: string): Observable<Map<number, PsInfo>> {
  if (os.platform() !== 'darwin' && os.platform() !== 'linux') {
    return Observable.of(new Map());
  }
  return runCommand('ps', ['-eo', `pid,ppid,pcpu,time,rss,vsz,${cmd}`], {
    dontLogInNuclide: true,
  }).map(output => {
    return new Map(
      nullthrows(output)
        .split('\n')
        // only lines with pid (filter out header and final empty line)
        .filter(line => / *[0-9]/.test(line))
        .map(line => line.trim().split(/ +/))
        .map(([pid, ppid, pcpu, time, rss, vsz, ...command]) => [
          Number(pid),
          {
            pid: Number(pid),
            ppid: Number(ppid),
            pcpu: Number(pcpu),
            time: durationInSeconds(time),
            rss: Number(rss),
            vsz: Number(vsz),
            command: command.join(' '),
          },
        ]),
    );
  });
}

function postOrder<T>(
  pid: number,
  childMap: Map<number, Array<number>>,
  callback: (pid: number, children: Array<T>) => T,
): T {
  return callback(
    pid,
    (childMap.get(pid) || []).map(cpid => postOrder(cpid, childMap, callback)),
  );
}

function mapChildren(psMap: Map<number, PsInfo>): Map<number, Array<number>> {
  const map = new Map();
  for (const [pid, ps] of psMap.entries()) {
    const array = map.get(ps.ppid) || [];
    array.push(pid);
    map.set(ps.ppid, array);
  }
  return map;
}

function aggregate(ps: Array<PsInfo>): Array<ProcessSummary> {
  const map: Map<string, ProcessSummary> = new Map();

  for (const subProcess of ps) {
    const command = subProcess.command;
    const existing = map.get(command);
    if (existing != null) {
      existing.count++;
      existing.pcpu += subProcess.pcpu;
      existing.time += subProcess.time;
      existing.rss += subProcess.rss;
      existing.vsz += subProcess.vsz;
    } else {
      map.set(command, {
        command,
        count: 1,
        pcpu: subProcess.pcpu,
        time: subProcess.time,
        rss: subProcess.rss,
        vsz: subProcess.vsz,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.command.localeCompare(b.command));
}

function mapIoStats(): Map<number, IOBytesStats> {
  return new Map(
    getActiveHandles()
      .filter(h => h.constructor.name.toLowerCase() === 'childprocess')
      .map(handle => [
        handle.pid,
        {
          stdin: handle.stdin && handle.stdin.bytesWritten,
          stdout: handle.stdout && handle.stdout.bytesRead,
          stderr: handle.stderr && handle.stderr.bytesRead,
        },
      ]),
  );
}

function getActiveHandles(): Array<Object> {
  // $FlowFixMe: Private method.
  return process._getActiveHandles();
}

// Takes a string of the form HHH:MM:SS.ssss of hours, minutes,
// seconds, and fractions thereof, and returns seconds.  All parts
// are optional except seconds.
export function durationInSeconds(duration: string): number {
  return duration
    .split(':')
    .reduce((acc, value) => 60 * acc + Number(value), 0);
}
