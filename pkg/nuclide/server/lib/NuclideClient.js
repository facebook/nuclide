'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

/**
 * This code implements the NuclideFs client.  It uses the request module to
 * make XHR requests to the NuclideFS service.  It is a Promise based API.
 */

var fs = require('fs');
var extend = require('util')._extend;

type FileWithStats = {file: string; stats: fs.Stats};
type ExecResult = {error: ?Error; stdout: string; stderr: string};
type NuclideClientOptions = {
  cwd: ?string;
};

class NuclideClient {
  constructor(id: string, eventbus : NuclideEventbus, options: ?NuclideClientOptions = {}) {
    this._id = id;
    this.eventbus = eventbus;
    this._options = options;
    this._searchProviders = {};
  }

  getID() {
    return this._id;
  }

  /**
   * Reads a file from remote FS
   *
   * @param path the path to the file to read
   * @param options set of options that are passed to fs.createReadStream.
   *
   * It returns promise that resolves to a Buffer with the file contents.
   */
  async readFile(path: string, options?: {}): Promise<Buffer> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'readFile',
      /*methodArgs*/ [path, options]
    );
  }

  /**
   * Writes a file to the remote FS
   *
   * @param path the path to the file to read
   * @param data a node buffer of the data to write to file
   * @param options set of options that are passed to fs.createReadStream.
   *
   * It returns a void promise.
   */
  writeFile(path: string, data: Buffer, options?: {}): Promise<void> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'writeFile',
      /*methodArgs*/ [path, options],
      /*extraOptions*/ {body: data, method: 'POST'}
    );
  }

  /**
   * Creates a new, empty file on the remote FS.
   *
   * If no file (or directory) at the specified path exists, creates the parent
   * directories (if necessary) and then writes an empty file at the specified
   * path.
   *
   * @return A boolean indicating whether the file was created.
   */
  newFile(path: string): Promise<boolean> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'newFile',
      /*methodArgs*/ [path],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  /**
   * Returns an fs.Stats promise from remote FS
   *
   * @param path the path to the file/directory to get Stats for
   */
  async stat(path: string): Promise<fs.Stats> {
    var body = await this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'stat',
      /*methodArgs*/ [path],
      /*extraOptions*/ {json: true}
    );
    return createStats(body);
  }

  /**
   * Returns a promism that resolves to an array of
   * {file: 'name', stats: <fs.Stats>} from remote FS
   *
   * @param path the path to the directory to get entries for
   */
  async readdir(path: string): Promise<Array<FileWithStats>> {
    var body = await this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'readdir',
      /*methodArgs*/ [path],
      /*extraOptions*/ {json: true}
    );
    return body.map((entry) => {
      return {
        file: entry.file,
        stats: createStats(entry.stats),
        isSymbolicLink: entry.isSymbolicLink,
      };
    });
  }

  /**
   * Returns an fs.Stats promise from remote FS
   *
   * @param path the path to the file/directory to get Stats for
   *
   * Same as stats call above except it will return the stats for the
   * underlying file if a link is passed.
   */
  async lstat(path: string): Promise<fs.Stats> {
    var body = await this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'lstat',
      /*methodArgs*/ [path],
      /*extraOptions*/ {json: true}
    );
    return createStats(body);
  }

  /**
   * Checks for existence of a file/directory/link on a remote FS
   *
   * @param path the path to the file/directory to check for existence
   *
   * It returns promise that resolve to true if file exists, false otherwise.
   */
  exists(path: string): Promise<boolean> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'exists',
      /*methodArgs*/ [path],
      /*extraOptions*/ {json: true}
    );
  }

  /**
   * Gets the real path of a file path.
   * It could be different than the given path if the file is a symlink
   * or exists in a symlinked directory.
   */
  realpath(path: string): Promise<string> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'realpath',
      /*methodArgs*/ [path]
    );
  }

  /**
   * Rename a file or folder.
   */
  rename(sourcePath: string, destinationPath: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'rename',
      /*methodArgs*/ [sourcePath, destinationPath],
      /*extraOptions*/ {method: 'POST'}
    );
  }

  /**
   * Creates a new directory with the given path.
   * Throws EEXIST error if the directory already exists.
   * Throws ENOENT if the path given is nested in a non-existing directory.
   */
  mkdir(path: string): Promise<string> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'mkdir',
      /*methodArgs*/ [path],
      /*extraOptions*/ {method: 'POST'}
    );
  }

  /**
   * Runs the equivalent of `mkdir -p` with the given path.
   *
   * Like most implementations of mkdirp, if it fails, it is possible that
   * directories were created for some prefix of the given path.
   * @return true if the path was created; false if it already existed.
   */
  mkdirp(path: string): Promise<boolean> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'mkdirp',
      /*methodArgs*/ [path],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  /*
   * Removes directories even if they are non-empty. Does not fail if the directory doesn't exist.
   */
  rmdir(path: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'rmdir',
      /*methodArgs*/ [path],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  /**
   * Removes files. Does not fail if the file doesn't exist.
   */
  unlink(path: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'unlink',
      /*methodArgs*/ [path],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  findNearestFile(fileName: string, pathToDirectory: string): Promise<?string> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'fs',
      /*methodName*/ 'findNearestFile',
      /*methodArgs*/ [fileName, pathToDirectory],
      /*extraOptions*/ {json: true}
    );
  }

  /**
   * Make rpc call to service given serviceUri in form of `$serviceName/$methodName` and args as arguments list.
   */
  makeRpc(serviceUri: string, args: Array<mixed>, serviceOptions: mixed): Promise<mixed> {
    var [serviceName, methodName] = serviceUri.split('/');
    return this.eventbus.callServiceFrameworkMethod(
      serviceName,
      methodName,
      /* methodArgs */ args,
      /* serviceOptions */ serviceOptions
   );
  }

  registerEventListener(eventName: string, callback: (...args: Array<mixed>) => void, serviceOptions: mixed): Disposable {
    return this.eventbus.registerEventListener(eventName, callback, serviceOptions);
  }

  /**
   * Executes a command on the remote connected server and returns the result.
   * Promisified http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
   * If no options cwd provided, it uses the cwd that was passed into the
   * NuclideClient's options parameter, if it exists.
   * options: {
   *   cwd: String Current working directory of the child process,
   *   env: Object Environment key-value pairs,
   *   encoding: String (Default: 'utf8'),
   *   shell: String Shell to execute the command with (Default: '/bin/sh' on UNIX, 'cmd.exe' on Windows),
   *   timeout: Number (Default: 0),
   *   maxBuffer: Number (Default: 200*1024),
   *   killSignal: String (Default: 'SIGTERM'),
   *   uid: Number Sets the user identity of the process. (See setuid(2).),
   *   gid: Number Sets the group identity of the process. (See setgid(2).),
   * }
   */
  exec(command: string, options: ?mixed): Promise<ExecResult> {
    var {cwd} = this._options;
    var mixedOptions = extend(extend({}, {cwd}), options);
    return this.eventbus.callMethod(
      /*serviceName*/ 'proc',
      /*methodName*/ 'exec',
      /*methodArgs*/ [command, mixedOptions],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  /**
   * Searches the contents of `directory` for paths mathing `query`.
   */
  async searchDirectory(directory: string, query: string): Promise<mixed> {
    return await this.eventbus.callMethod(
      /*serviceName*/ 'search',
      /*methodName*/ 'directory',
      /*methodArgs*/ [directory, query],
      /*extraOptions*/ {json: true}
    );
  }

  /**
   * Returns the server version.
   */
  version(): Promise<number|string> {
    return this.eventbus.callMethod(
      /*serviceName*/ 'server',
      /*methodName*/ 'version',
      /*methodArgs*/ [],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  async watchFile(filePath: string): Promise<FsWatcher> {
    var watcherId = await this.eventbus.callMethod(
      /*serviceName*/ 'watcher',
      /*methodName*/ 'watchFile',
      /*methodArgs*/ [filePath],
      /*extraOptions*/ {method: 'POST', json: true}
    );
    return await this.eventbus.consumeEventEmitter(watcherId, ['change', 'rename', 'delete']);
  }

  async watchDirectory(directoryPath: string): Promise<FsWatcher> {
    var watcherId = await this.eventbus.callMethod(
      /*serviceName*/ 'watcher',
      /*methodName*/ 'watchDirectory',
      /*methodArgs*/ [directoryPath],
      /*extraOptions*/ {method: 'POST', json: true}
    );
    return await this.eventbus.consumeEventEmitter(watcherId, ['change']);
  }

  async watchDirectoryRecursive(directoryPath: string, handler: (numberOfChanges: number) => void) {
    var watchChannel = watchDirectoryChannel(directoryPath);
    await this.eventbus.subscribeToChannel(watchChannel, handler);
    await this.eventbus.callMethod(
      /*serviceName*/ 'watcher',
      /*methodName*/ 'watchDirectoryRecursive',
      /*methodArgs*/ [directoryPath, watchChannel],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  unwatchFile(filePath: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'watcher',
      /*methodName*/ 'unwatchFile',
      /*methodArgs*/ [filePath],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  unwatchDirectory(directoryPath: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'watcher',
      /*methodName*/ 'unwatchDirectory',
      /*methodArgs*/ [directoryPath],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  unwatchDirectoryRecursive(directoryPath: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'watcher',
      /*methodName*/ 'unwatchDirectoryRecursive',
      /*methodArgs*/ [directoryPath],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  doSearchQuery(rootDirectory:string, provider: string, query: string): Promise {
    return this.eventbus.callMethod(
      /*serviceName*/ 'search',
      /*methodName*/ 'query',
      /*methodArgs*/ [rootDirectory, provider, query],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  async getSearchProviders(rootDirectory: string): Promise<Array<{name:string}>> {
    var providers = this._searchProviders[rootDirectory];
    if (providers) {
      return providers;
    }
    providers = await this.eventbus.callMethod(
      /*serviceName*/ 'search',
      /*methodName*/ 'listProviders',
      /*methodArgs*/ [rootDirectory],
      /*extraOptions*/ {method: 'POST', json: true}
    );

    this._searchProviders[rootDirectory] = providers;

    return providers;
  }

  getHackDiagnostics(): Promise {
    var {cwd} = this._options;
    return this.eventbus.callMethod(
      /*serviceName*/ 'hack',
      /*methodName*/ 'getDiagnostics',
      /*methodArgs*/ [{cwd}],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  getHackCompletions(query: string): Promise {
    var {cwd} = this._options;
    return this.eventbus.callMethod(
      /*serviceName*/ 'hack',
      /*methodName*/ 'getCompletions',
      /*methodArgs*/ [query, {cwd}],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  getHackDefinition(query: string, symbolType: SymbolType): Promise {
    var {cwd} = this._options;
    return this.eventbus.callMethod(
      /*serviceName*/ 'hack',
      /*methodName*/ 'getDefinition',
      /*methodArgs*/ [query, symbolType, {cwd}],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  getHackDependencies(dependenciesInfo: Array<{name: string; type: string}>): Promise<mixed> {
    var {cwd} = this._options;
    return this.eventbus.callMethod(
      /*serviceName*/ 'hack',
      /*methodName*/ 'getDependencies',
      /*methodArgs*/ [dependenciesInfo, {cwd}],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  getHackSearchResults(
      search: string,
      filterTypes: ?Array<SearchResultType>,
      searchPostfix: ?string): Promise {
    var {cwd} = this._options;
    return this.eventbus.callMethod(
      /*serviceName*/ 'hack',
      /*methodName*/ 'getSearchResults',
      /*methodArgs*/ [search, filterTypes, searchPostfix, {cwd}],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }
}

function createStats(jsonStats: any) {
  var stats = new fs.Stats();

  stats.dev = jsonStats.dev;
  stats.mode = jsonStats.mode;
  stats.nlink = jsonStats.nlink;
  stats.uid = jsonStats.uid;
  stats.gid = jsonStats.gid;
  stats.rdev = jsonStats.rdev;
  stats.blksize = jsonStats.blksize;
  stats.ino = jsonStats.ino;
  stats.size = jsonStats.size;
  stats.blocks = jsonStats.blocks;
  stats.atime = new Date(jsonStats.atime);
  stats.mtime = new Date(jsonStats.mtime);
  stats.ctime = new Date(jsonStats.ctime);

  if (jsonStats.birthtime) {
    stats.birthtime = new Date(jsonStats.birthtime);
  }

  return stats;
}

module.exports = NuclideClient;

function watchDirectoryChannel(directoryPath: string) {
  return 'watch' + directoryPath;
}
