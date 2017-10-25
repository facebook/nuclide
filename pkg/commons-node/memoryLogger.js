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

import Dequeue from 'dequeue';

type LogEntry = {|time: number, text: string|};

export class MemoryLogger {
  _underlyingLogger: log4js$Logger;
  _logs: Dequeue = new Dequeue(); // stores LogEntry elements
  _retentionPeriod: number;

  constructor(
    underlyingLogger: log4js$Logger,
    retentionPeriod: number = 5 * 60 * 1000, // retain past five minutes
  ) {
    this._underlyingLogger = underlyingLogger;
    this._retentionPeriod = retentionPeriod;
  }

  dispose(): void {
    this._logs.empty();
  }

  dump(): string {
    // We only have a destructive way to enumerate all elements of _log,
    // so we'll build up a replacement list.
    const newLogs = new Dequeue();
    let result = '';
    while (this._logs.length > 0) {
      const log: LogEntry = this._logs.shift();
      result += log.text + '\n';
      newLogs.push(log);
    }
    this._logs = newLogs;
    return result;
  }

  getUnderlyingLogger(): log4js$Logger {
    return this._underlyingLogger;
  }

  trace(message: string) {
    this._underlyingLogger.trace(message.substring(0, 400));
    this._appendAndExpunge('TRACE', message);
  }

  info(message: string) {
    this._underlyingLogger.info(message.substring(0, 400));
    this._appendAndExpunge('INFO', message);
  }

  warn(message: string) {
    this._underlyingLogger.warn(message);
    this._appendAndExpunge('WARN', message);
  }

  error(message: string) {
    this._underlyingLogger.error(message);
    this._appendAndExpunge('ERROR', message);
  }

  _appendAndExpunge(level: string, message: string): void {
    if (this._retentionPeriod === 0) {
      return;
    }

    // this._logs will keep the past five minute's worth of logs
    const time = Date.now();
    const text =
      new Date(time).toLocaleTimeString('en-US', {hour12: false}) +
      ' ' +
      level +
      ' - ' +
      message;
    // push the new entry
    const newLog: LogEntry = {time, text};
    this._logs.push(newLog);
    // and unshift all expired entries
    while (
      this._logs.length > 0 &&
      (this._logs.first(): LogEntry).time + this._retentionPeriod <= time
    ) {
      this._logs.shift();
    }
  }
}

export class SnapshotLogger {
  _retentionPeriod: number;
  _snapshotInterval: number;
  _files: Map<
    string,
    Array<{|time: number, text: string, version: number|}>,
  > = new Map();

  constructor(
    retentionPeriod: number = 5 * 60 * 1000, // retain past five minutes
    snapshotInterval: number = 30 * 1000, // snapshot no more than every 30s
  ) {
    this._retentionPeriod = retentionPeriod;
    this._snapshotInterval = snapshotInterval;
  }

  dispose(): void {
    this._files.clear();
  }

  dump(): Array<{|title: string, text: string|}> {
    const results = [];
    for (const [filepath, snapshots] of this._files) {
      for (const snapshot of snapshots) {
        const time = new Date(snapshot.time).toLocaleTimeString('en-US', {
          hour12: false,
        });
        const version = String(snapshot.version);
        results.push({
          title: `${filepath} ${time},v${version}`,
          text: snapshot.text,
        });
      }
    }
    return results;
  }

  snapshot(
    filepath: string,
    version: number,
    buffer: simpleTextBuffer$TextBuffer,
  ): void {
    if (this._retentionPeriod === 0) {
      return;
    }
    // this._files will keep historical versions of every open file.
    // It will keep at least one copy of it, and will discard older copies if
    // they're older than five minutes. It will save version updates but no
    // more frequently than once every thirty seconds.
    const time = new Date().getTime();
    let snapshots = this._files.get(filepath);
    if (snapshots != null && snapshots.length > 0) {
      const mostRecent = snapshots[snapshots.length - 1];
      if (
        mostRecent.time + this._snapshotInterval > time ||
        mostRecent.version === version
      ) {
        return;
      }
    }
    if (snapshots == null) {
      snapshots = [];
      this._files.set(filepath, snapshots);
    }
    // Remove any old snapshots at the start of the array
    const firstRemainingSnapshot = snapshots.findIndex(
      snapshot => snapshot.time + this._retentionPeriod > time,
    );
    if (firstRemainingSnapshot > 0) {
      snapshots.splice(0, firstRemainingSnapshot);
    }
    // Add a new snashot at the end
    snapshots.push({time, text: buffer.getText(), version});
  }

  close(filepath: string): void {
    this._files.delete(filepath);
  }
}
