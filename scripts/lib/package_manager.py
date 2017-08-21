# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import logging
import os

import utils

NUCLIDE_PATH = os.path.realpath(os.path.join(os.path.dirname(__file__), '../..'))
PACKAGES_PATH = os.path.join(NUCLIDE_PATH, 'pkg')


class PackageManager(object):
    def __init__(self, package_dir=PACKAGES_PATH):
        # Keys are names of packages and values are the corresponding configs.
        self._package_map = load_package_configs(package_dir)

    def get_configs(self):
        sorted_packages = sorted(self._package_map.items(),
                                 key=lambda x: x[1]['name'])
        for package_name, package_config in sorted_packages:
            logging.debug('Including package: %s', package_name)
            yield package_config

    def is_local_dependency(self, package_name):
        return package_name in self._package_map

    def get_nuclide_path(self):
        return NUCLIDE_PATH

    def get_package_map(self):
        return self._package_map


def load_package_configs(package_dir=PACKAGES_PATH):
    '''Returns a map where keys are names of packages and values are package configs.'''
    package_map = {}

    # Performs a depth-first search of the project root for package.json files.
    for (path, dirs, files) in os.walk(package_dir):
        if 'package.json' in files:
            # No need to explore subdirectories once package.json is found.
            del dirs[:]
            package_json = os.path.join(path, 'package.json')
            config = create_config_for_package(package_json)
            # config will be None for packages such as sample packages.
            if config:
                package_name = config['name']
                # Update the map now that the config is complete.
                package_map[package_name] = config

    return package_map


def create_config_for_package(path):
    '''Create a config for a parsed package.json. Returns None if it is not a
    Nuclide package.

    No code in this library should parse a package.json file directly. Instead,
    it should operate on a package config that is created by this method.
    Because we may read extra properties in package.json, such as "customDeps",
    it is critical that all scripts operate on a normalized package config
    rather than a raw package.json.
    '''
    pkg = utils.json_load(path)
    nuclide_config = pkg.get('nuclide', {})

    config = {}

    # Standard package.json fields
    config['name'] = pkg['name']
    config['repository'] = pkg.get('repository')
    config['version'] = pkg.get('version')
    config['description'] = pkg.get('description')
    config['license'] = pkg.get('license')
    config['main'] = pkg.get('main')
    config['dependencies'] = pkg.get('dependencies', {})
    config['optionalDependencies'] = pkg.get('optionalDependencies', {})
    config['devDependencies'] = pkg.get('devDependencies', {})
    # Both spellings are acceptable:
    config['bundleDependencies'] = pkg.get('bundleDependencies', {})
    config['bundledDependencies'] = pkg.get('bundledDependencies', {})
    config['scripts'] = pkg.get('scripts', {})
    config['private'] = pkg.get('private', False)
    config['engines'] = pkg.get('engines')

    # Custom Nuclide fields
    config['packageRootAbsolutePath'] = os.path.dirname(path)
    config['packageType'] = nuclide_config.get('packageType')
    config['isNodePackage'] = nuclide_config.get('packageType') == 'Node'
    config['testRunner'] = nuclide_config.get('testRunner')
    config['testsCannotBeRunInParallel'] = nuclide_config.get(
        'testsCannotBeRunInParallel', False)
    config['excludeTestsFromContinuousIntegration'] = nuclide_config.get(
        'excludeTestsFromContinuousIntegration', False)
    config['atomTestRunner'] = pkg.get('atomTestRunner')
    config['_atomModuleCache'] = pkg.get('_atomModuleCache')

    return config
