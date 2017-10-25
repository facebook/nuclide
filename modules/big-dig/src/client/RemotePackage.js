/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import fs from 'fs';
import path from 'path';
import {shellQuote} from 'nuclide-commons/string';
import {getLogger} from 'log4js';

import {
  serializeManifest,
  deserializeManifest,
  createManifest,
  compareManifests,
} from './Manifest';
import {SftpClient} from './SftpClient';
import {SshClient} from './SshClient';
import {onceEvent} from '../common/events';

import type {ExecOptions} from './SshClient';

type ExtractFromFile = {|
  /** Remote command to extract an archive on disk to a target directory. */
  fromFileCommand: (remoteArchive: string, remoteDst: string) => string,
|};

type ExtractFromStdin = {|
  /** Remote command to extract an archive from stdin to a target directory. */
  fromStdinCommand: (remoteDst: string) => string,
|};

export type ExtractionMethod = ExtractFromFile | ExtractFromStdin;

export type PackageBuffer = {|
  /** The version of the package being installed (to be saved to the manifest). */
  version: string,
  /** The package to transfer. */
  data: Buffer,
  /** If true, then do not remove prior files (allows patching an installation). */
  isDelta?: boolean,
|};

export type PackageFile = {|
  /** The version of the package being installed (to be saved to the manifest). */
  version: string,
  /** The local path of the package to transfer */
  filename: string,
  /** If true, then do not remove prior files (allows patching an installation). */
  isDelta?: boolean,
|};

/** Install the package as-needed. Big-dig saves a remote manifest, which includes the version and
 * the `stat` for each file. This is used to determine whether the package needs to be
 * (re)installed. */
export type ManagedPackageParams = {|
  /**
   * Generate a package to install remotely; returns either a Buffer or the local package filename.
   * Will be invoked if the package needs to be installed or updated. `currentVersion` is provided
   * to allow generating a patch (returning `isDelta = true`).
   * @param currentVersion The version of the currently-installed package, or `null` if there is no
   *     installed package or it cannot be verified.
   */
  package(currentVersion: ?string): Promise<PackageBuffer | PackageFile>,
  /**
   * Given the version of an existing remote installation, either return the same version if it is
   * compatible (i.e. does not need to be updated), or else a different (expected) version string if
   * the installation is incompatible (i.e. should be updated).
   */
  expectedVersion(version: string): Promise<string>,
  /** Remote command to extract an archive to a given directory. */
  extract?: ExtractionMethod,
  /**
   * Remote command to start the [extracted] package. The command will be run from within the
   * installation directory. (I.e. cwd will be `installationPath`.)
   */
  command: (installationPath: string, args: string) => string,
  /** Location to store the package. */
  installationPath: string,
|};

/** Assume the package is already installed and not managed by Big-dig. */
export type UnmanagedPackageParams = {|
  command: string,
  cwd?: string,
|};

export type PackageParams = ManagedPackageParams | UnmanagedPackageParams;

type PackageOkay = {|
  /** The package is present, has a valid manifest, and is a compatible version. */
  status: 'okay',
|};

type PackageNeedsInstall = {|
  /** The package is not installed; `installationPath` does not exist or is empty. */
  status: 'needs-install',
  message: string,
|};

type PackageNeedsUpdate = {|
  /** A package is present and has a valid manifest, but its version is incompatible. */
  status: 'needs-update',
  message: string,
  /** The version that we need to install. */
  expected: string,
  /** The version that is currently installed. */
  current: string,
|};

type CorruptionReason =
  /** Cannot find a file that verifies the installation status. */
  | 'missing-manifest'
  /** Files have been added, removed, or changed stats (e.g. its modified-time or size). */
  | 'changed-files'
  /** The install path was expected to be a directory but is an existing file. */
  | 'install-path-is-file'
  /** The installed version is different than the manifest version. */
  | 'diff-versions';

type PackageCorrupt = {|
  /**
   * `installationPath` points to a non-empty directory, but its contents are not a valid
   * installation. Files may have been removed or their stats changed. *User data may be present,
   * so installing the package here may cause data loss.*
   */
  status: 'corrupt',
  reason: CorruptionReason,
  message: string,
|};

export type PackageInstallStatus =
  | PackageOkay
  | PackageNeedsInstall
  | PackageNeedsUpdate
  | PackageCorrupt;

export type InstallOptions = {
  /** Directory to store temporary files. */
  tempDir?: string,
  /** Name of the package. */
  name?: string,
  /** If true, then remove any files within the installation path before installing. */
  force?: boolean,
};

function okay(): PackageOkay {
  getLogger().info('Verify installation: OKAY.');
  return {status: 'okay'};
}

function needsUpdate(expected: string, current: string): PackageNeedsUpdate {
  const message = `Found remote server version ${current}, but expected version ${expected}.`;
  getLogger().info(`Verify installation: ${message}`);
  return {
    status: 'needs-update',
    message,
    expected,
    current,
  };
}

function corrupt(message: string, reason: CorruptionReason): PackageCorrupt {
  getLogger().info(`Verify installation: CORRUPT - ${message}`);
  return {status: 'corrupt', reason, message};
}

function needsInstall(message: string): PackageNeedsInstall {
  getLogger().info(`Verify installation: NEEDS INSTALL - ${message}`);
  return {status: 'needs-install', message};
}

export class InstallError extends Error {
  message: string;
  stdout: ?string;
  constructor(message: string, stdout?: string) {
    super(message + '\n' + (stdout || ''));
    this.message = message;
    this.stdout = stdout;
  }
}

export interface RemotePackage {
  /** Runs the package. */
  run(
    args: Array<string>,
    options: ExecOptions,
    ssh: SshClient,
  ): Promise<{stdout: string, code: number | null}>,

  /**
   * Determines the installation status of the package. If unmanaged, this always returns 'okay'.
   * If managed, then this will check the manifest to verify that it is the correct version and not
   * corrupt. Refer to `Manifest` for what kinds of corruption can be detected.
   */
  verifyInstallation(ssh: SshClient): Promise<PackageInstallStatus>,

  /** Throws if installation is not supported. */
  install(ssh: SshClient, options?: InstallOptions): Promise<void>,

  /** Throws if installation is not supported. */
  getInstallationPath(): string,
}

/**
 * Creates an abstraction for the remote package, which may be an unmanaged (preexisting)
 * installation, or a managed installation by big-dig (which may need installation).
 * @param pkg
 */
export function getPackage(pkg: PackageParams): RemotePackage {
  if (pkg.package) {
    return new ManagedPackage(pkg);
  } else {
    return new UnmanagedPackage(pkg);
  }
}

async function runPackage(
  command: string,
  cwd?: string,
  options: ExecOptions,
  ssh: SshClient,
): Promise<{stdout: string, code: number | null}> {
  const cmd = cwd == null ? `${command}` : `cd ${cwd} && ${command}`;

  const {stdout, result} = await ssh.exec(cmd, options);
  // Collect any stdout in case there is an error.
  let output = '';
  stdout.subscribe(data => (output += data));
  // Wait for the bootstrapper to finish
  const {code} = await result;

  return {stdout: output, code};
}

/**
 * An unmanaged, preexisting package. We know nothing about what the package looks like, except how
 * to invoke it. The user is responsible for installing the package on the remote machine and
 * providing a valid command for invocation.
 */
class UnmanagedPackage implements RemotePackage {
  _package: UnmanagedPackageParams;

  constructor(params: UnmanagedPackageParams) {
    this._package = params;
  }

  run(
    args: Array<string>,
    options: ExecOptions = {},
    ssh: SshClient,
  ): Promise<{stdout: string, code: number | null}> {
    const {cwd, command} = this._package;
    const cmd = `${command} ${shellQuote(args)}`;
    return runPackage(cmd, cwd, {...options}, ssh);
  }

  async verifyInstallation(ssh: SshClient): Promise<PackageInstallStatus> {
    return okay();
  }

  async install(ssh: SshClient, options?: InstallOptions): Promise<void> {
    throw new InstallError('An unmanaged remote server cannot be installed.');
  }

  getInstallationPath(): string {
    throw new Error(
      'Cannot determine the installation path of an unmanaged remote server.',
    );
  }
}

/**
 * A managed package. It's our responsibility to verify that it is installed correctly. Implements
 * `install` and `getInstallationPath`.
 */
class ManagedPackage implements RemotePackage {
  _package: ManagedPackageParams;
  /** We record the version when verifying an installation, and later use it when requesting an
   * updated package to install (allowing the packager to provide a delta). If the installation
   * cannot be verified or we are pursuing a fresh install, then this will be `null`.
   */
  _currentVersion: ?string = null;

  constructor(params: ManagedPackageParams) {
    this._package = params;
  }

  run(
    args: Array<string>,
    options: ExecOptions = {},
    ssh: SshClient,
  ): Promise<{stdout: string, code: number | null}> {
    const {installationPath, command} = this._package;
    const cmd = command(installationPath, shellQuote(args));
    return runPackage(cmd, installationPath, {...options}, ssh);
  }

  async verifyInstallation(ssh: SshClient): Promise<PackageInstallStatus> {
    const pkg = this._package;
    const sftp = await ssh.sftp();
    const manifestFile = this._manifestPath();
    getLogger().info('Verifying installation...');

    try {
      if (!await sftp.exists(pkg.installationPath)) {
        return needsInstall('Installation path does not exist');
      }
      const installPathStats = await sftp.lstat(pkg.installationPath);
      if (!installPathStats.isDirectory()) {
        return corrupt(
          'Installation path already exists as a file',
          'install-path-is-file',
        );
      } else if ((await sftp.readdir(pkg.installationPath)).length === 0) {
        return needsInstall('Installation path is empty');
      } else if (!await sftp.exists(manifestFile)) {
        return corrupt(
          `Manifest does not exist at ${manifestFile}`,
          'missing-manifest',
        );
      }

      // The installation state we expect to see:
      const manifest = deserializeManifest(await sftp.readFile(manifestFile));
      this._currentVersion = manifest.version;
      // The actual state:
      const currentFileTree = await sftp.filetree(pkg.installationPath);
      const current = createManifest(
        manifest.version /** Assume current version = manifest version */,
        manifestFile,
        pkg.installationPath,
        currentFileTree,
      );

      // Is the manifest correct?
      const check = compareManifests(manifest, current);

      if (
        // Should be equivalent to `check.status !== 'okay'`, but Flow is not smart enough :(
        check.status === 'changed-files' ||
        check.status === 'diff-versions' // This case should not happen
      ) {
        return corrupt(check.message, check.status);
      }
      // The manifest is correct!

      // Do we need to upgrade the package?
      const expectedVersion = await pkg.expectedVersion(manifest.version);
      if (expectedVersion !== manifest.version) {
        return needsUpdate(expectedVersion, manifest.version);
      }

      return okay();
    } finally {
      await sftp.end();
    }
  }

  async install(ssh: SshClient, options?: InstallOptions): Promise<void> {
    const pkg = this._package;
    let sftp = await ssh.sftp();
    const opts = {...options};
    opts.name = opts.name !== undefined ? opts.name : 'package';
    opts.tempDir = opts.tempDir != null ? opts.tempDir : '/tmp/';
    opts.force = opts.force || false;

    try {
      getLogger().info(`Installing ${opts.name}...`);
      const archive = await pkg.package(this._currentVersion);
      const cleanFirst = archive.isDelta !== true;

      // If we're not installing a delta and we believe there are existing files that need to be
      // removed (e.g. we're updating the installation), then first remove the existing files.
      if (cleanFirst && opts.force) {
        await this._uninstall(sftp);
        this._currentVersion = null;
      }

      await this._initInstallationPath(sftp, {assertEmpty: cleanFirst});

      if (pkg.extract) {
        const extract = pkg.extract;
        // Transfer the archive to a file first? Otherwise, it will be streamed to the extractor.
        if (extract.fromFileCommand) {
          const tmp = path.join(
            opts.tempDir,
            `big-dig-package.${Math.random()}`,
          );
          getLogger().info(
            `Install: transferring package to temporary file (${tmp})...`,
          );
          await this._transferToFile(archive, tmp, sftp);
          await sftp.end();
          try {
            getLogger().info('Install: extracting package...');
            await this._extractFromFile(extract, tmp, ssh);
          } finally {
            try {
              sftp = await ssh.sftp();
              await sftp.unlink(tmp);
              await sftp.end();
            } catch (error) {
              getLogger().warn(
                `Install: could not remove temporary file ${tmp}.`,
              );
            }
          }
        } else {
          await sftp.end();
          getLogger().info('Install: transferring and extracting package...');
          await this._extractFromStdin(archive, extract, ssh);
        }
        sftp = await ssh.sftp();
      } else {
        getLogger().info('Install: transferring package...');
        await this._transferToFile(archive, pkg.installationPath, sftp);
      }
      getLogger().info('Install: saving manifest...');
      await this._saveManifest(archive.version, sftp);
      this._currentVersion = archive.version;
      getLogger().info('Install: complete.');
    } catch (error) {
      getLogger().info(
        `Install: FAILURE (${error.message || error.toString()})`,
      );
      throw error;
    } finally {
      await sftp.end();
    }
  }

  /**
   * Returns the remote path of the package.
   */
  getInstallationPath(): string {
    return this._package.installationPath;
  }

  /**
   * Assuming that the package files have all been installed, this creates and saves a manifest of
   * the state of the installation.
   */
  async _saveManifest(version: string, sftp: SftpClient) {
    const installPath = this._package.installationPath;
    const currentFileTree = await sftp.filetree(installPath);
    const current = createManifest(
      version,
      this._manifestPath(),
      installPath,
      currentFileTree,
    );
    const data = serializeManifest(current);
    await sftp.writeFile(this._manifestPath(), data);
  }

  /**
   * Removes all (preexisting) files from the installation path.
   */
  async _uninstall(sftp: SftpClient) {
    getLogger().info('Removing previous package (if present)...');
    await sftp.rmtree(this._package.installationPath, true);
  }

  /**
   * Ensure that the installation path exists and is empty (if `clean`).
   */
  async _initInstallationPath(
    sftp: SftpClient,
    params: {assertEmpty: boolean},
  ) {
    const assertEmpty = params.assertEmpty;
    const pkg = this._package;
    const installPathIsNonEmpty = () =>
      sftp
        .readdir(pkg.installationPath)
        .then(files => files.length !== 0, error => false);

    if (
      assertEmpty &&
      // We should have checked the manifest to prevent this from happening, but just in case...
      // (Also note that we do not have transactional access to the server filesystem, so
      // this can happen and we might not even catch it here.)
      (await installPathIsNonEmpty())
    ) {
      throw new InstallError(
        `Installation path is not empty (${pkg.installationPath})`,
      );
    }

    let dir;
    if (pkg.extract) {
      dir = pkg.installationPath;
    } else {
      dir = path.dirname(pkg.installationPath);
    }
    await sftp.mkdir(dir, {createIntermediateDirectories: true});
  }

  /**
   * Extract a local file/buffer to the remote install path via stdin.
   */
  async _extractFromStdin(
    archive: PackageBuffer | PackageFile,
    extract: ExtractFromStdin,
    ssh: SshClient,
  ): Promise<void> {
    const pkg = this._package;
    const extractCmd = extract.fromStdinCommand(pkg.installationPath);
    const {stdout, stdio, result} = await ssh.exec(extractCmd);
    let output = '';
    stdout.subscribe(data => (output += data));
    const [, {code}] = await Promise.all([
      this._transferViaStream(archive, stdio),
      result,
    ]);
    if (code !== 0) {
      const codeStr = code == null ? '<null>' : code;
      throw new InstallError(
        `Extraction command exited with code ${codeStr}: ${extractCmd}`,
        output,
      );
    }
  }

  /**
   *  Extract a remote file to a remote directory.
   */
  async _extractFromFile(
    extract: ExtractFromFile,
    archiveFile: string,
    ssh: SshClient,
  ): Promise<void> {
    const pkg = this._package;
    const extractCmd = extract.fromFileCommand(
      archiveFile,
      pkg.installationPath,
    );
    const {stdout, result} = await ssh.exec(extractCmd);
    let output = '';
    stdout.subscribe(data => (output += data));
    const {code} = await result;
    if (code !== 0) {
      const codeStr = code == null ? '<null>' : code;
      throw new InstallError(
        `Extraction command exited with code ${codeStr}: ${extractCmd}`,
        output,
      );
    }
  }

  /**
   * Transfer the local file/buffer to a remote file.
   */
  async _transferToFile(
    archive: PackageBuffer | PackageFile,
    archiveFile: string,
    sftp: SftpClient,
  ): Promise<void> {
    if (archive.data) {
      await sftp.writeFile(archiveFile, archive.data, {flag: 'wx'});
    } else {
      await sftp.fastPut(archive.filename, archiveFile);
    }
  }

  /**
   * Transfer the local file/buffer to a stream (e.g. combined with `_extractFromStdin`).
   */
  _transferViaStream(
    archive: PackageBuffer | PackageFile,
    stream: stream$Writable,
  ): Promise<void> {
    if (archive.data) {
      stream.write(archive.data);
    } else {
      fs.createReadStream(archive.filename).pipe(stream);
    }
    return onceEvent(stream, 'end');
  }

  /**
   * Remote filename for the manifest.
   */
  _manifestPath() {
    const pkg = this._package;
    if (pkg.extract) {
      // Store the manifest within the installation directory
      return path.join(this._package.installationPath, '.big-dig-manifest');
    } else {
      // Store the manifest as a sibling of the installed file
      return path.join(
        path.dirname(this._package.installationPath),
        path.basename('.big-dig-manifest' + pkg.installationPath),
      );
    }
  }
}
