/*
This is extracted from log4js@2.4.0:
https://github.com/log4js-node/log4js-node/blob/v2.4.0/lib/appenders/file.js
Requires streamroller@^0.6.0 as a dependency.

TODO(hansonw): Pull in log4js v2 once the dependency bloat is resolved.
https://github.com/log4js-node/log4js-node/issues/576

Copyright 2015 Gareth Jones (with contributions from many other people)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

const debug = require('debug')('log4js:file');
const path = require('path');
const streams = require('streamroller');
const os = require('os');

const eol = os.EOL || '\n';

function openTheStream(file, fileSize, numFiles, options) {
  const stream = new streams.RollingFileStream(
    file,
    fileSize,
    numFiles,
    options
  );
  stream.on('error', (err) => {
    console.error('log4js.fileAppender - Writing to file %s, error happened ', file, err); //eslint-disable-line
  });
  return stream;
}


/**
 * File Appender writing the logs to a text file. Supports rolling of logs by size.
 *
 * @param file file log messages will be written to
 * @param layout a function that takes a logEvent and returns a string
 *   (defaults to basicLayout).
 * @param logSize - the maximum size (in bytes) for a log file,
 *   if not provided then logs won't be rotated.
 * @param numBackups - the number of log files to keep after logSize
 *   has been reached (default 5)
 * @param options - options to be passed to the underlying stream
 * @param timezoneOffset - optional timezone offset in minutes (default system local)
 */
function fileAppender(file, layout, logSize, numBackups, options, timezoneOffset) {
  file = path.normalize(file);
  numBackups = numBackups === undefined ? 5 : numBackups;
  // there has to be at least one backup if logSize has been specified
  numBackups = numBackups === 0 ? 1 : numBackups;

  debug('Creating file appender (',
    file, ', ',
    logSize, ', ',
    numBackups, ', ',
    options, ', ',
    timezoneOffset, ')'
  );

  const writer = openTheStream(file, logSize, numBackups, options);

  const app = function (loggingEvent) {
    writer.write(layout(loggingEvent, timezoneOffset) + eol, 'utf8');
  };

  app.reopen = function () {
    writer.closeTheStream(writer.openTheStream.bind(writer));
  };

  app.shutdown = function (complete) {
    writer.write('', 'utf-8', () => {
      writer.end(complete);
    });
  };

  // For v1 shutdown compatibility below.
  appenders.push(app);

  // On SIGHUP, close and reopen all files. This allows this appender to work with
  // logrotate. Note that if you are using logrotate, you should not set
  // `logSize`.
  process.on('SIGHUP', () => {
    debug('SIGHUP handler called.');
    app.reopen();
  });

  return app;
}

function configure(config /* layouts */) {
  let layout = layouts.basicLayout;
  if (config.layout) {
    layout = layouts.layout(config.layout.type, config.layout);
  }

  return fileAppender(
    config.filename,
    layout,
    config.maxLogSize,
    config.backups,
    config,
    config.timezoneOffset
  );
}

module.exports.configure = configure;

/**
 * The code below is appended for compatibility with log4js 1.x.
 */

const {layouts} = require('log4js');
let appenders = [];

module.exports.shutdown = function shutdown(cb) {
  var completed = 0;
  var error;
  var complete = function(err) {
    error = error || err;
    completed++;
    if (completed >= appenders.length) {
      cb(error);
    }
  };
  if (!appenders.length) {
    return cb();
  }
  appenders.forEach(function(app) {
    app.shutdown(complete);
  });
  appenders = [];
};

module.exports.appender = fileAppender;
