# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import logging
import os
import re
import sys

PACKAGE_NAME_WHITELIST = [
    'hyperclick', # we want to upstream this to atom, so do not require nuclide- prefix
]
DEPENDENCIES_FIELDS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'bundleDependencies',
    'bundledDependencies'
]
EXACT_SEMVER_RE = re.compile(r'^\d+\.\d+\.\d+$')

# Detects errors in Nuclide pacakge.json files.
#  - missing/empty description
#  - missing/incorrect repository
#  - missing/incorrect version
#  - missing/incorrect scripts/test property
class PackageLinter(object):
    def __init__(self, package_map):
        self._had_error = False
        self._package_map = package_map
        self._current_file_being_linted = None

    def validate_packages(self):
        self.validate_all_packages()

        for package_name in self._package_map:
            if not self.is_whitelisted_package(package_name):
                package = self._package_map[package_name]
                # It is admittedly a little gross to set this as a field rather than threading it
                # through validate_package() or creating a new "Validator" object for each package
                # that has the path to the package.json as a field so it doesn't have to be used as
                # a "global". However, that would make this class harder to subclass. Fortunately,
                # this logic is very fast, so it doesn't seem like we'll have to make it
                # multi-threaded any time soon, so we can get away with sharing this field.
                self._current_file_being_linted = os.path.join(
                        package['packageRootAbsolutePath'], 'package.json')
                self.validate_package(package_name, package)
        return not self._had_error

    def validate_all_packages(self):
        '''This method can be overridden by subclasses.'''
        pass

    def is_whitelisted_package(self, package_name):
        return False

    def validate_package(self, package_name, package):
        # Show packages being linted when --verbose flag is specified
        logging.debug('Linting package %s', package_name)

        self.verify_package_name(package_name, package)
        self.verify_main_property(package_name, package)

        self.expect_field_in(package_name, package, 'packageType', ['Node', 'Atom'])
        self.expect_field_in(package_name, package, 'testRunner', ['npm', 'apm'])
        if package['testRunner'] == 'npm':
            self.verify_npm_package(package)
        else:
            self.verify_apm_package(package)

        if not 'description' in package:
            self.report_error('Missing "description" for %s', package_name)
        elif not package['description']:
            self.report_error('Empty "description" for %s', package_name)
        self.expect_field(package_name, package,
                'repository', 'https://github.com/facebook/nuclide')
        self.expect_field(package_name, package, 'version', '0.0.0')

        package_name = package['name']
        has_valid_prefix = False
        prefixes = self.get_valid_package_prefixes()
        for prefix in prefixes:
            if package_name.startswith(prefix):
                has_valid_prefix = True
                break
        if not has_valid_prefix:
            self.report_error('Package name %s must start with one of %s', package_name, prefixes)

        if not package['isNodePackage']:
            self.expect_field(package_name, package, 'testRunner', 'apm')
            self.validate_json_extras(package)
        self.validate_dependencies(package)
        self.validate_babelrc(package)

        if self.is_internal_name(package_name):
            self.expect_field(package_name, package, 'private', True)

        if package['engines'] is not None:
            self.report_error(
                'Extraneous "engines" for %s - Only the root package.json should set "engines".',
                package_name
            )
        if package['_atomModuleCache'] is not None:
            self.report_error('Extraneous "_atomModuleCache" for %s', package_name)

    def verify_package_name(self, package_name, package):
        if package_name in PACKAGE_NAME_WHITELIST:
            return
        expected_package_name = ''
        path = package['packageRootAbsolutePath']
        while True:
            path, component = os.path.split(path)
            if component == 'pkg':
                break
            if expected_package_name == '':
                expected_package_name = component
            else:
                expected_package_name = component + '-' + expected_package_name
        if package_name != expected_package_name:
            self.report_error('Expected package name %s found %s', expected_package_name, package_name)

    def verify_main_property(self, package_name, package):
        if package['main'] is None:
            return
        package_main = package['main'];
        main_file = os.path.join(package['packageRootAbsolutePath'], package_main)
        if not package_main.startswith('./'):
            # stylistic only - omitting the "./" works
            self.report_error('Package %s should have a "main" file that starts with "./"', package_name)
        if not os.path.isfile(main_file):
            self.report_error('Package %s should have a "main" file that exists', package_name)
        if not package_main.endswith('.js'):
            self.report_error(
                'Package %s should have a "main" file with a ".js" extension',
                package_name)

    def verify_npm_package(self, package):
        self.verify_npm_test_property(package)

    def verify_npm_test_property(self, package):
        package_name = package['name']
        if not 'scripts' in package:
            self.report_error(
                'Package %s should have a "scripts" section with a "test" property.',
                package_name)
        elif not 'test' in package['scripts']:
            self.report_error(
                ('Package %s should have a "test" property in its "scripts" section ' +
                    'to define how its tests are run.'),
                package_name)
        elif '--harmony' in package['scripts']['test']:
            self.report_error(
                ('Package %s should not use the `--harmony` flag when running tests.'),
                package_name)

    def verify_apm_package(self, package):
        self.verify_apm_test_property(package)

    def verify_apm_test_property(self, package):
        '''apm packages should not specify a separate test runner.'''
        package_name = package['name']
        if 'scripts' in package and 'test' in package['scripts']:
            self.report_error(
                ('Package %s should not have a custom scripts/test section ' +
                    'because it will use apm as its test runner.'),
                package_name)
        if package['atomTestRunner'] is None:
            self.report_error(
                'Package %s should have an "atomTestRunner" field', package_name)
        atom_test_runner_path = os.path.join(package['packageRootAbsolutePath'],
                                             package['atomTestRunner'])
        if not os.path.isfile(atom_test_runner_path):
            self.report_error(
                'Package %s should have an "atomTestRunner" that exists at %s',
                package_name, atom_test_runner_path)

    def validate_babelrc(self, package):
        # See https://phabricator.intern.facebook.com/D2301649
        # for details on why this used to exist.
        babelrc_path = os.path.join(package['packageRootAbsolutePath'], '.babelrc')
        if os.path.isfile(babelrc_path):
            self.report_error('Deprecated .babelrc file found at %s.', babelrc_path)
            return

    def validate_json_extras(self, package):
        # Only "grammars" are allowed to be cson.
        for dirname in ['keymaps', 'menus', 'snippets', 'settings']:
            dir_path = os.path.join(package['packageRootAbsolutePath'], dirname)
            if not os.path.isdir(dir_path):
                continue
            for item in os.listdir(dir_path):
                if item.endswith('.cson'):
                    self.report_error(
                        '%s should use a ".json" %s file instead of %s.',
                        package['name'], item, dirname)

    def validate_dependencies(self, package):
        for field in DEPENDENCIES_FIELDS:
            if field in package and len(package[field]):
                self.report_error(
                    '%s should not have a "%s" field with values',
                    package['name'],
                    field)

    def expect_field(self, package_name, package, field, value):
        fieldValue = package.get(field, None)
        if fieldValue is None:
            self.report_error('Missing field "%s" for "%s"', field, package_name)
        elif package[field] != value:
            self.report_error('Incorrect "%s" for %s. Found %s expected %s',
                    field, package_name, fieldValue, value)

    def expect_field_in(self, package_name, package, field, values):
        fieldValue = package.get(field, None)
        if fieldValue is None:
            self.report_error('Missing field "%s" for %s', field, package_name)
        elif not fieldValue in values:
            self.report_error('Incorrect "%s" for %s. Found %s',
                    field, package_name, fieldValue)

    def is_internal_name(self, package_name):
        return package_name.startswith('fb-')

    def get_valid_package_prefixes(self):
        return ['fb-', 'nuclide-', 'sample-', 'hyperclick', 'commons-atom', 'commons-node']

    def report_error(self, message, *args):
        logging.error('PACKAGE ERROR (' + self._current_file_being_linted + '): ' + message, *args)
        self._had_error = True
