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
import type {ConsoleIO} from './ConsoleIO';

import {analytics} from './analytics';
import CommandLine from './CommandLine';
import CommandDispatcher from './CommandDispatcher';
import ConfigFile from './ConfigFile';
import Debugger from './Debugger';
import DebuggerAdapterFactory from './DebuggerAdapterFactory';
import fs from 'fs';
import {getNuclideVersion} from 'nuclide-commons/system-info';
import HelpCommand from './HelpCommand';
import log4js from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import QuitCommand from './QuitCommand';
import yargs from 'yargs';
import {setRawAnalyticsService} from 'nuclide-commons/analytics';
import * as rawAnalyticsService from 'nuclide-analytics/lib/track';
import {Observable} from 'rxjs';

function buildLogger(): log4js$Logger {
  // there are things in nuclide while will still try to log to
  // $TMP/nuclide-$USER-logs, which won't exist if the user
  // has never run nuclide.
  const nuclideLoggingDir = nuclideUri.join(
    os.tmpdir(),
    `nuclide-${os.userInfo().username}-logs`,
  );
  try {
    if (!fs.existsSync(nuclideLoggingDir)) {
      fs.mkdirSync(nuclideLoggingDir);
    }
  } catch (ex) {
    // This isn't fatal, it just means that the user will get a message
    // and a bit of logging will be lost.
    process.stderr.write(
      `Could not create logging directory ${nuclideLoggingDir}\n`,
    );
  }

  const args = yargs.argv;
  const level = (args.loglevel || 'FATAL').toUpperCase();
  const validLevels = new Set([
    'TRACE',
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR',
    'FATAL',
  ]);

  if (!validLevels.has(level)) {
    throw new Error(`${level} is not a valid loglevel.`);
  }

  // Send debug level logging to a file. Send a configurable (by default FATAL)
  // level to the console.
  const config = {
    appenders: [
      {
        type: 'file',
        filename: '/tmp/nuclide-cli.log',
        maxLogSize: 512 * 1024,
        category: '[all]',
      },
      {
        type: 'logLevelFilter',
        level,
        maxLevel: 'FATAL',
        appender: {
          type: 'stdout',
          category: '[all]',
        },
      },
    ],
    levels: {
      'nuclide-commons/process': 'FATAL',
      '[all]': 'DEBUG',
    },
  };

  log4js.configure(config);

  return log4js.getLogger('default');
}

const _help: string[] = [
  'fbdbg [options] [program [program-arguments]]',
  '  The debugger may be launched in either "launch" or "attach" mode. "launch"',
  '  starts a local program; "attach" attaches to an already running program',
  '  which may be remote. There are options which are specific to the mode and',
  '  type of program being debugged; to see them, specify the --type and mode',
  '  options along with --help.',
  '',
  '--help:',
  '  Show this help.',
  '--attach:',
  '  Attach the debugger to a running process.',
  '--preset:',
  '  Load default arguments for a session type preset',
  '--type debugger-type:',
  '  Specify the type of program to debug. Required with --attach',
  '--plain:',
  '  Do not use cursor control sequences or terminal raw mode (for example,',
  '  if running in a shell that does not well support them such as emacs)',
  '',
  '[program]: If not attaching, the program to launch. Normally the type of',
  '           program can be inferred from the file extension.',
  '',
];

function showHelp(
  configFile: ConfigFile,
  contextSensitiveHelp: Array<string>,
): void {
  process.stdout.write(_help.join('\n') + '\n');

  const types = new DebuggerAdapterFactory().allAdapterKeys();

  process.stdout.write(`Supported debugger types:\n\t${types.join(' ')}\n`);

  if (contextSensitiveHelp.length !== 0) {
    process.stdout.write('Options which are specific to the debugger type:\n');
    process.stdout.write(contextSensitiveHelp.join('\n') + '\n');
  }

  const presets = configFile.presets();
  if (presets.length !== 0) {
    process.stdout.write('\nPresets:\n');
    presets.forEach(preset => {
      process.stdout.write(`${preset.name}:\n  ${preset.description}\n`);
    });
  }
}

async function main(): Promise<void> {
  let cli: ?CommandLine;

  try {
    // see if there's session information on the command line
    const debuggerAdapterFactory = new DebuggerAdapterFactory();
    const configFile = new ConfigFile();

    const preset = configFile.getPresetFromArguments();
    const cmdLine =
      preset == null
        ? process.argv.splice(2)
        : configFile.applyPresetToArguments(preset);
    const args = yargs(cmdLine)
      .boolean('attach')
      .boolean('dvsp')
      .boolean('plain')
      .boolean('help').argv;

    if (args.help) {
      showHelp(configFile, debuggerAdapterFactory.contextSensitiveHelp(args));
      process.exit(0);
    }

    setRawAnalyticsService(rawAnalyticsService, Observable.from([]));

    const logger = buildLogger();
    const aliases = configFile.resolveAliasesForPreset(preset);
    const dispatcher = new CommandDispatcher(aliases);
    const historySave = nuclideUri.join(
      configFile.ensureConfigRoot(),
      'history',
    );
    const safeCli = (cli = new CommandLine(
      dispatcher,
      args.plain,
      logger,
      historySave,
      configFile,
    ));

    dispatcher.registerCommand(new HelpCommand(safeCli, dispatcher));
    dispatcher.registerCommand(new QuitCommand(() => safeCli.close()));

    let adapter;

    try {
      adapter = await debuggerAdapterFactory.adapterFromArguments(args);
    } catch (error) {
      cli.outputLine(error.message);
      cli.outputLine();
      showHelp(configFile, debuggerAdapterFactory.contextSensitiveHelp(args));
      process.exit(0);
    }

    analytics.setAdapter(adapter);

    const muteOutputCategories =
      args.dvsp || adapter == null
        ? new Set()
        : adapter.adapter.muteOutputCategories;

    const debuggerInstance = new Debugger(
      logger,
      cli,
      preset,
      muteOutputCategories,
    );

    debuggerInstance.registerCommands(dispatcher);

    cli.enterFullScreen();
    cli.setCompletions(debuggerInstance);

    if (adapter != null) {
      if (adapter.type === 'hhvm') {
        try {
          // $FlowFB
          const showBetaBanner: ConsoleIO => void = require('./fb-BetaBanner.js')
            .showBetaBanner;
          showBetaBanner(cli);
        } catch (_) {}
      }

      cli.outputLine(`\nfbdbg version ${getNuclideVersion()}\n`);

      await debuggerInstance.launch(adapter);
    }

    // eslint-disable-next-line nuclide-internal/unused-subscription
    cli.observeInterrupts().subscribe(_ => {
      debuggerInstance.breakInto();
    });

    // eslint-disable-next-line nuclide-internal/unused-subscription
    cli.observeLines().subscribe(
      _ => {},
      _ => {},
      _ => {
        debuggerInstance
          .closeSession()
          .then(x => {
            safeCli.outputLine();
            return analytics.shutdown();
          })
          .then(() => process.exit(0));
      },
    );
  } catch (x) {
    if (cli != null) {
      cli.close(`${x.message}\n`);
      return;
    }
    process.stderr.write(`${x.message}\n`);
    analytics.shutdown(`${x.message} ${x.stack}`).then(_ => process.exit(0));
  }
}

main();
