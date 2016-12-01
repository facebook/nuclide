#!/usr/bin/env node
'use strict';
/* @noflow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

/* NON-TRANSPILED FILE */
/* eslint comma-dangle: [1, always-multiline], prefer-object-spread/prefer-object-spread: 0 */

/* eslint-disable no-console */

// This file is both the main and worker process.
if (process.send) {
  runChild();
} else {
  runParent();
}

function runParent() {
  const argv = require('yargs')
    .usage('Usage: $0 [options]')
    .option('overwrite', {
      describe: 'Overwrite original files with transpile output.',
      type: 'boolean',
    })
    .help('help')
    .argv;

  const assert = require('assert');
  const child_process = require('child_process');
  const fs = require('fs');
  const glob = require('glob');
  const os = require('os');
  const path = require('path');

  const basedir = path.join(__dirname, '../..');
  const developmentFilePath = path.join(basedir, 'DEVELOPMENT');
  const numWorkers = Math.max(os.cpus().length - 1, 1);

  const count = {
    skipped: 0,
    transpiled: 0,
  };

  const jsFiles = glob.sync(path.join(basedir, '**/*.js'), {
    ignore: [
      '**/node_modules/**',
      '**/VendorLib/**',
    ],
  });

  // Sanity checks
  assert(jsFiles.length > 10);
  jsFiles.forEach(filename => {
    assert(path.isAbsolute(filename));
  });

  console.log('%s workers. %s files...', numWorkers, jsFiles.length);

  for (let i = 0; i < numWorkers; i++) {
    child_process.fork(__filename)
      .on('message', function(m) {
        if (m.transpiled === true) {
          count.transpiled++;
        } else if (m.skipped === true) {
          count.skipped++;
        }
        if (jsFiles.length) {
          this.send({cmd: 'next', filename: jsFiles.pop()});
        } else {
          this.kill();
        }
      })
      .on('exit', code => {
        if (code) {
          process.exit(code);
        }
      })
      .send({cmd: 'init', overwrite: argv.overwrite});
  }

  process.once('exit', code => {
    if (code !== 0) { return; }
    if (argv.overwrite && fs.existsSync(developmentFilePath)) {
      fs.unlinkSync(developmentFilePath);
    }
    console.log(
      'transpiled: %s | skipped: %s | %ds',
      count.transpiled,
      count.skipped,
      process.uptime().toFixed(2)
    );
  });
}

function runChild() {
  const fs = require('fs');

  const NodeTranspiler = require('../../pkg/nuclide-node-transpiler/lib/NodeTranspiler');
  const nodeTranspiler = new NodeTranspiler();

  let overwrite;

  process.on('message', m => {
    const res = {};
    if (m.cmd === 'next') {
      const src = fs.readFileSync(m.filename);
      if (NodeTranspiler.shouldCompile(src)) {
        const code = nodeTranspiler.transformWithCache(src, m.filename);
        if (overwrite) {
          fs.writeFileSync(m.filename, code);
        }
        res.transpiled = true;
      } else {
        res.skipped = true;
      }
    } else if (m.cmd === 'init') {
      overwrite = m.overwrite;
    }
    process.send(res);
  });
}
