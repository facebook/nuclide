# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import os.path

from package_linter import PackageLinter
from package_manager import create_config_for_package


MODULES_REPO = "https://github.com/facebook/nuclide/tree/master/modules"
MODULES_LICENSE = "BSD-3-Clause"


class ModulesLinter(PackageLinter):
    def __init__(self, package_map, feature_groups):
        PackageLinter.__init__(self, package_map, feature_groups)

        root_package = create_config_for_package(
            os.path.join(os.path.dirname(__file__), "../../package.json")
        )
        # Check against both dependencies and devDependencies.
        root_deps = root_package["dependencies"].copy()
        root_deps.update(root_package["devDependencies"])
        self._root_deps = root_deps

    def validate_package(self, package_name, package):
        if not package["description"]:
            self.report_error('Empty "description" for %s', package_name)

        package_absolute_path = package["packageRootAbsolutePath"]
        package_dirname = os.path.basename(package_absolute_path)

        if package_dirname.startswith("fb-") and not package["private"]:
            self.report_error(
                'FB-only package %s should have "private": true.', package_name
            )

        self.verify_author_property(package_name, package)

        if not package["private"]:
            self.verify_main_property(package_name, package)

            expected_repo = MODULES_REPO + "/" + package_name
            if not package["repository"]:
                self.report_error('Missing "repository" for %s', package_name)
            elif not package["repository"] != MODULES_REPO:
                self.report_error(
                    "Repository of %s must match %s", package_name, expected_repo
                )

            if package["license"] != MODULES_LICENSE:
                self.report_error(
                    "Package %s must use the %s license", package_name, MODULES_LICENSE
                )

            if not os.path.exists(os.path.join(package_absolute_path, "LICENSE")):
                self.report_error("Package %s must have a LICENSE file", package_name)

            if not os.path.exists(os.path.join(package_absolute_path, "PATENTS")):
                self.report_error("Package %s must have a PATENTS file", package_name)

        self._validate_dependencies(package, "dependencies")
        self._validate_dependencies(package, "devDependencies")

    # Check that:
    # 1) inter-modules dependencies have consistent versions
    # 2) sub-dependencies are consistent with the ones in the root package.json
    # 3) all dependency versions are exact
    def _validate_dependencies(self, package, deps_key):
        for key, version in package[deps_key].items():
            if (
                key in self._package_map
                and version != self._package_map[key]["version"]
            ):
                self.report_error(
                    '%s "%s" of "%s" must match the corresponding package.json (v%s)',
                    deps_key,
                    key,
                    package["name"],
                    self._package_map[key]["version"],
                )
            elif key in self._root_deps:
                root_version = self._root_deps[key]
                if root_version != version:
                    self.report_error(
                        '%s "%s" of "%s" must match the root package.json (v%s)',
                        deps_key,
                        key,
                        package["name"],
                        root_version,
                    )
            elif not version[0].isdigit():
                self.report_error(
                    '%s "%s" of "%s" must be an exact version',
                    deps_key,
                    key,
                    package["name"],
                )
