# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import logging
import multiprocessing
import os
import re
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime

import utils


MAX_RUN_TIME_IN_SECONDS = 180
UNIT_TEST_WORKERS = max(1, multiprocessing.cpu_count() - 1)
INTEGRATION_TEST_WORKERS = 1
# Make sure there's enough ports for the number of workers.
OPEN_PORTS = [9091, 9092]


class JsTestRunner(object):
    def __init__(
        self,
        package_manager,
        include_apm=True,
        packages_to_test=None,
        verbose=False,
        parallel=False,
        continue_on_errors=False,
    ):
        self._package_manager = package_manager
        self._include_apm = include_apm
        self._packages_to_test = packages_to_test
        self._parallel = parallel
        self._verbose = verbose
        self._continue_on_errors = continue_on_errors

    def run_integration_tests(self):
        self.install_third_party_packages()

        nuclide_dir = self._package_manager.get_nuclide_path()
        spec_files = [
            os.path.join(root, f)
            for root, _, files in os.walk(os.path.join(nuclide_dir, "spec"))
            for f in files
            if f.endswith("-spec.js")
        ]

        parallel_test_arg_list = []
        serial_test_arg_list = []
        for spec_file in spec_files:
            test_arg = (
                ["atom", "--dev", "--test", "--v=-3", spec_file],
                nuclide_dir,
                os.path.basename(spec_file),
                True,  # retryable
                self._continue_on_errors,
                True,  # is_integration_test
            )
            if spec_file.endswith("-serial-spec.js") or not self._parallel:
                serial_test_arg_list.append(test_arg)
            else:
                parallel_test_arg_list.append(test_arg)

        start = datetime.now()

        if len(serial_test_arg_list):
            logging.info(
                "Running %s integration tests serially...", len(serial_test_arg_list)
            )
            for test_args in serial_test_arg_list:
                run_test(*test_args)

        if len(parallel_test_arg_list):
            logging.info(
                "Running %s integration tests across %d workers...",
                len(parallel_test_arg_list),
                INTEGRATION_TEST_WORKERS,
            )
            run_parallel_tests(parallel_test_arg_list, INTEGRATION_TEST_WORKERS)

        end = datetime.now()
        logging.info("Finished integration tests (%s seconds)", (end - start).seconds)

    def run_unit_tests(self):
        for package_name in self._packages_to_test:
            if not self._package_manager.is_local_dependency(package_name):
                raise Exception("%s is not a valid nuclide package name" % package_name)

        parallel_tests = []
        serial_tests = []

        for package_config in self._package_manager.get_configs():
            pkg_path = package_config["packageRootAbsolutePath"]
            name = package_config["name"]
            test_runner = package_config["testRunner"]

            if test_runner is None:
                continue

            if package_config["excludeTestsFromContinuousIntegration"]:
                continue

            if self._packages_to_test and name not in self._packages_to_test:
                continue

            if test_runner == "apm":
                if not self._include_apm:
                    continue
                # "apm test" exits with an error when there is no "spec" directory
                if not os.path.isdir(os.path.join(pkg_path, "spec")):
                    logging.info("NO TESTS TO RUN FOR: %s", name)
                    continue

            if package_config["testsCannotBeRunInParallel"] or not self._parallel:
                test_bucket = serial_tests
            else:
                test_bucket = parallel_tests

            if test_runner == "npm":
                test_cmd = ["npm", "test"]
                retryable = False
            elif test_runner == "apm":
                # https://github.com/atom/apm/blob/v1.9.2/src/test.coffee#L37
                test_cmd = ["atom", "--dev", "--test", "--v=-3", "spec"]
                retryable = True
            else:
                raise Exception('Unknown test runner "%s"' % test_runner)

            test_args = (test_cmd, pkg_path, name, retryable, self._continue_on_errors)
            test_bucket.append(test_args)

        if len(parallel_tests):
            logging.info(
                "Running %s tests in parallel across %s workers...",
                len(parallel_tests),
                UNIT_TEST_WORKERS,
            )
            start = datetime.now()
            run_parallel_tests(parallel_tests, UNIT_TEST_WORKERS)
            end = datetime.now()
            logging.info("Finished parallel tests (%s seconds)", (end - start).seconds)

        if len(serial_tests):
            logging.info("Running %s tests serially...", len(serial_tests))
            start = datetime.now()
            for test_args in serial_tests:
                run_test(*test_args)
            end = datetime.now()
            logging.info("Finished serial tests (%s seconds)", (end - start).seconds)

    @utils.retryable(num_retries=2, sleep_time=10, exponential=True)
    def install_third_party_packages(self):
        # TODO(asuarez): Figure out a way to better declare the 3rd-party
        # packages that are absolutely needed during integration tests.
        install_cmd = ["apm", "--no-color", "install", "tool-bar"]
        logging.info("Running `%s`...", " ".join(install_cmd))
        start = datetime.now()
        nuclide_dir = self._package_manager.get_nuclide_path()
        subprocess.check_call(install_cmd, cwd=nuclide_dir)
        end = datetime.now()
        logging.info(
            "Finished `%s` (%s seconds)", " ".join(install_cmd), (end - start).seconds
        )


def run_parallel_tests(test_arg_list, num_workers):
    pool = multiprocessing.Pool(processes=num_workers)
    results = [
        pool.apply_async(run_test, args=test_args) for test_args in test_arg_list
    ]
    for async_result in results:
        async_result.wait(MAX_RUN_TIME_IN_SECONDS)
        if not async_result.successful():
            raise async_result.get()


def run_test(
    test_cmd, pkg_path, name, retryable, continue_on_errors, is_integration_test=False
):
    """Run test_cmd in the given pkg_path."""
    logging.info("Running `%s` in %s...", " ".join(test_cmd), pkg_path)
    start = datetime.now()

    env = None
    # If we're running integration tests in parallel, assign a unique NUCLIDE_SERVER_PORT.
    if is_integration_test:
        process_identity = multiprocessing.current_process()._identity
        if len(process_identity) > 0:
            # process_id is numbered starting from 1.
            process_id = process_identity[0] - 1
            if process_id < len(OPEN_PORTS):
                env = os.environ.copy()
                env["TEST_NUCLIDE_SERVER_PORT"] = str(OPEN_PORTS[process_id])

    proc = subprocess.Popen(
        test_cmd,
        cwd=pkg_path,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
        shell=False,
        env=env,
    )
    # Record the pgid now - sometimes the process exits but not its children.
    proc_pgid = os.getpgid(proc.pid)
    stdout = []

    def kill_proc():
        logging.info("KILLING TEST: %s", name)
        # Kill the group so child processes are also cleaned up.
        os.killpg(proc_pgid, signal.SIGKILL)

    timer = threading.Timer(MAX_RUN_TIME_IN_SECONDS, kill_proc)

    try:
        timer.start()
        for line in iter(proc.stdout.readline, ""):
            # line is a bytes string literal in Python 3.
            logging.info(
                "[%s %s]: %s", test_cmd[0], name, line.rstrip().decode("utf-8")
            )
            stdout.append(line)
        proc.wait()
    # pylint: disable-msg=W0612
    # flake8: noqa
    except KeyboardInterrupt as e:
        # Cleanly kill all child processes before terminating.
        kill_proc()
        sys.exit(1)
    finally:
        timer.cancel()

    end = datetime.now()

    if proc.returncode:
        logging.info(
            "TEST %s: %s (exit code: %d)\nstdout:\n%s",
            "ERROR" if timer.is_alive() else "TIMED OUT",
            name,
            proc.returncode,
            "".join(stdout).rstrip(),
        )
        if retryable and is_retryable_error("".join(stdout)):
            logging.info("RETRYING TEST: %s", name)
            time.sleep(3)
            run_test(test_cmd, pkg_path, name, False, continue_on_errors)
            return
        if not continue_on_errors:
            raise utils.TestFailureError(
                "TEST FAILED: %s %s (exit code: %d)"
                % (test_cmd[0], name, proc.returncode),
                proc.returncode,
            )
    else:
        logging.info("TEST PASSED: %s (%s seconds)", name, (end - start).seconds)


def is_retryable_error(output):
    errors = [
        r"atom(-beta)?:\s+line\s+\d+:\s+\d+\s+Segmentation fault: 11",
        r"atom(-beta)?:\s+line\s+\d+:\s+\d+\s+Abort trap: 6",
        r"atom(-beta)?:\s+line\s+\d+:\s+\d+\s+Illegal instruction: 4",
        r"atom(-beta)?:\s+line\s+\d+:\s+\d+\s+Bus error: 10",
    ]
    return any(re.search(error, output) for error in errors)
