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

/* global sessionStorage */
/* eslint-disable no-console, nuclide-internal/no-commonjs */

declare function waitsForPromise(
  optionsOrFunc:
    | {shouldReject?: boolean, timeout?: number}
    | (() => Promise<mixed>),
  func?: () => Promise<mixed>,
): void;

declare class Benchmark {
  description: string,
  columns: Array<string>,
  timeout: number,
  iterations: number,
  repetitions: number,
  getIterationDescription?: (iteration: number) => string,
  run: (iteration: number) => Object,
  name?: string,
  index?: number,
}

type RunOptions = {
  benchmarks: Array<string>,
  packages: Array<string>,
  iterations?: number,
  repetitions?: number,
};

const fs = require('fs');
const path = require('path');
const {
  sleep,
  sleepUntilNoRequests,
  yellow,
  green,
} = require('../benchmarker-utils');
const {writeTsv, writeAllTsv, readAllTsv} = require('../benchmarker-tsv');
const {aggregateTable, avg} = require('../benchmarker-data');

const RUN_STATE_KEY = 'nuclide-benchmarker-run-state';
const RESULT_DIR_ROOT = '/tmp/nuclide-benchmarker-results';

// These benchmarks need to load packages fast, and re-use native module info in localstorage.
// Disabling devMode allows Atom to access the data stored within the installed-packages:*.* cache.
atom.devMode = false;

// Determine what benchmarks are to be run, and with which packages installed.
const {
  benchmarks: allBenchmarks,
  packages: allPackages,
  iterations: iterationsOverride,
  repetitions: repetitionsOverride,
} = getRunOptions();

describe('Nuclide performance', () => {
  // Rehydrate the state of the benchmark run following a restart or a reload.
  const testState = getTestState();
  const {benchmarkIndex, iteration, repetition} = testState;
  let {resultDir, resultFile} = testState;

  // Load the benchmark we need to (continue to) run.
  // $FlowIgnore -- in this case we do not want to use a string literal in require.
  const benchmark: Benchmark = require('../benchmarks/' +
    allBenchmarks[benchmarkIndex]);
  benchmark.index = benchmarkIndex;
  benchmark.name = allBenchmarks[benchmarkIndex];
  if (iterationsOverride != null) {
    benchmark.iterations = iterationsOverride;
  }
  if (repetitionsOverride != null) {
    benchmark.repetitions = repetitionsOverride;
  }

  // Every record stored in a file has an iteration column at the start for aggregation purposes.
  const columns = benchmark.columns;
  columns.unshift('iteration');

  it(benchmark.description, () => {
    // The Atom spec runner spies on setTimeout and neuters it, but we need it to work as intended.
    jasmine.unspy(window, 'setTimeout');

    waitsForPromise({timeout: benchmark.timeout}, async () => {
      // Load any packages that might have been passed in from the command line.
      await Promise.all(allPackages.map(p => atom.packages.activatePackage(p)));

      // If there is no result directory (probably a new overall benchmark run), create it.
      if (!resultDir) {
        resultDir = createResultDir();
        setTestState({resultDir});
        console.log(`Writing results for run to ${yellow(resultDir)}`);
      }

      // If there is no result file (probably the first iteration of a new benchmark), create it.
      if (!resultFile) {
        resultFile = createResultFile(resultDir, benchmark, columns);
        setTestState({resultFile});
        console.log(
          `Writing raw results for ${String(benchmark.name)} to ${yellow(
            resultFile,
          )}`,
        );
      }

      // We are in no hurry. Give the new window 2 seconds to breathe before testing it.
      await sleep(2000);
      await sleepUntilNoRequests();

      // Run the benchmark for this iteration/repetition and append the results to the result file.
      const iterationDescription =
        benchmark.getIterationDescription != null
          ? `; ${benchmark.getIterationDescription(iteration)}`
          : '';

      console.log(
        yellow(
          `${String(benchmark.name)}: ` +
            `iteration ${iteration + 1} of ${benchmark.iterations}, ` +
            `repetition ${repetition + 1} of ${benchmark.repetitions}` +
            iterationDescription,
        ),
      );
      const result = await benchmark.run(iteration);
      result.iteration = iteration;
      writeTsv(resultFile, columns, result);

      // Determine the next benchmark & iteration due so that when we reload Atom, it can continue.
      const nextTestState = getNextTestState(
        allBenchmarks,
        benchmark,
        iteration,
        repetition,
      );

      // Detect if we have reached the end of an individual benchmark or of the whole run (& exit).
      if (nextTestState.iteration === 0) {
        const processedResultFile = processResultFile(resultFile);
        console.log(
          `Results for ${String(benchmark.name)} are in ${green(
            processedResultFile,
          )}`,
        );
      }
      if (nextTestState.benchmarkIndex === 0) {
        console.log(`All results for the run are in ${green(resultDir)}`);
        return;
      }

      // Otherwise save state & reload for the next loop. 5 seconds is enough for the restart.
      setTestState(nextTestState);
      atom.reload();
      await sleep(5000);
    });
  });
});

function getRunOptions(): RunOptions {
  let benchmarks = [];
  // flowlint-next-line sketchy-null-string:off
  if (process.env.BENCHMARK) {
    // A single benchmark has been passed in from the command line or shell.
    benchmarks = [process.env.BENCHMARK];
  } else {
    // Run all the benchmarks in the benchmarks folder.
    benchmarks = fs
      .readdirSync(path.join(__dirname, '../benchmarks'))
      .filter(filename => filename.endsWith('.js'))
      .map(filename => filename.replace(/\.js$/, ''));
  }

  let packages = [];
  // flowlint-next-line sketchy-null-string:off
  if (process.env.BENCHMARK_PACKAGES) {
    // packages to be loaded have been passed in from the command line or shell.
    packages = process.env.BENCHMARK_PACKAGES
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== '');
  }

  const options: RunOptions = {
    benchmarks,
    packages,
  };

  if (process.env.QUICK != null && process.env.QUICK !== 'false') {
    options.iterations = 1;
    options.repetitions = 1;
  }
  if (process.env.ITERATIONS != null) {
    options.iterations = Number(process.env.ITERATIONS);
  }
  if (process.env.REPETITIONS != null) {
    options.repetitions = Number(process.env.REPETITIONS);
  }

  return options;
}

function getTestState(): Object {
  const item = sessionStorage.getItem(RUN_STATE_KEY);
  // flowlint-next-line sketchy-null-string:off
  if (item) {
    try {
      return JSON.parse(item);
    } catch (e) {}
  }
  return {
    benchmarkIndex: 0,
    iteration: 0,
    repetition: 0,
    resultDir: null,
    resultFile: null,
  };
}

function setTestState(newState: Object): void {
  const state = getTestState();
  for (const key in newState) {
    state[key] = newState[key];
  }
  sessionStorage.setItem(RUN_STATE_KEY, JSON.stringify(state));
}

function createResultDir(): string {
  if (!fs.existsSync(RESULT_DIR_ROOT)) {
    fs.mkdirSync(RESULT_DIR_ROOT);
  }
  const resultDir = path.join(RESULT_DIR_ROOT, Date.now().toString());
  fs.mkdirSync(resultDir);
  return resultDir;
}

function createResultFile(
  resultDir: string,
  benchmark: {name?: string},
  columns: Array<string>,
): string {
  // $FlowFixMe
  const resultFile = path.join(resultDir, benchmark.name + '.tsv');
  writeTsv(resultFile, columns);
  return resultFile;
}

function processResultFile(resultFile: string): string {
  // Aggregates on the first column, averaging the other columns.
  const {columns, records} = readAllTsv(resultFile);
  const processedResultFile = resultFile.replace(/\.tsv$/, '.processed.tsv');
  writeAllTsv(
    processedResultFile,
    columns,
    aggregateTable(columns, records, columns[0], avg),
  );
  return processedResultFile;
}

function getNextTestState(
  benchmarks: Array<string>,
  benchmark: Benchmark,
  iteration: number,
  repetition: number,
): Object {
  if (repetition < benchmark.repetitions - 1) {
    // There is another repetition of this iteration to do.
    return {repetition: repetition + 1};
  }

  if (iteration < benchmark.iterations - 1) {
    // There is another iteration of this benchmark to do.
    return {
      repetition: 0,
      iteration: iteration + 1,
    };
  }

  if (
    typeof benchmark.index === 'number' &&
    benchmark.index < benchmarks.length - 1
  ) {
    // There is another benchmark of this run to do. Reset the file path.
    return {
      repetition: 0,
      iteration: 0,
      benchmarkIndex: benchmark.index + 1,
      resultFile: null,
    };
  }

  // Otherwise that was the final repetition of the final iteration of the final benchmark.
  // We're done.
  return {
    repetition: 0,
    iteration: 0,
    benchmarkIndex: 0,
    resultFile: null,
    resultDir: null,
  };
}
