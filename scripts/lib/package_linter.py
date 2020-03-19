# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import absolute_import, division, print_function, unicode_literals

import logging
import os
import re


DEPENDENCIES_FIELDS = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "bundleDependencies",
    "bundledDependencies",
]
EXACT_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
DEFAULT_AUTHOR = (
    "Replace this with the name of the team responsible for maintaining this package"
)


# Detects errors in Nuclide package.json files.
#  - missing/empty description
#  - missing/incorrect version
#  - missing/incorrect scripts/test property
class PackageLinter(object):
    def __init__(self, package_map, feature_groups, atom_ide_ui=False):
        self._atom_ide_ui = atom_ide_ui
        self._had_error = False
        self._package_map = package_map
        self._feature_groups = feature_groups
        self._features_in_groups = set().union(*feature_groups.values())
        self._current_file_being_linted = None

    def validate_packages(self):
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
                    package["packageRootAbsolutePath"], "package.json"
                )
                self.validate_package(package_name, package)
        return not self._had_error

    def is_whitelisted_package(self, package_name):
        return False

    def validate_package(self, package_name, package):
        # Show packages being linted when --verbose flag is specified
        logging.debug("Linting package %s", package_name)

        self.verify_package_name(package_name, package)
        self.verify_main_property(package_name, package)
        self.verify_author_property(package_name, package)

        if not self._atom_ide_ui:
            self.expect_field_in(
                package_name,
                package,
                "packageType",
                ["NodeLibrary", "AtomLibrary", "AtomPackage"],
            )
            if package["packageType"] == "NodeLibrary":
                self.verify_node_library(package)
            else:
                self.verify_atom_package_or_library(package)

        if "description" not in package:
            self.report_error('Missing "description" for %s', package_name)
        elif not package["description"]:
            self.report_error('Empty "description" for %s', package_name)
        self.expect_field(package_name, package, "version", "0.0.0")

        if not self._atom_ide_ui and package.get("repository", None) is not None:
            self.report_error(
                'Package should not contain a "repository" field. See D6510438 for explanation.'
            )

        package_name = package["name"]
        if not self._atom_ide_ui:
            has_valid_prefix = False
            prefixes = self.get_valid_package_prefixes()
            for prefix in prefixes:
                if package_name.startswith(prefix):
                    has_valid_prefix = True
                    break
            if not has_valid_prefix:
                self.report_error(
                    "Package name %s must start with one of %s", package_name, prefixes
                )

        if not self._atom_ide_ui and not package["isNodePackage"]:
            self.validate_json_extras(package)
        self.validate_dependencies(package)
        self.validate_babelrc(package)
        if not self._atom_ide_ui:
            self.validate_provided_services(package)

        if self.is_internal_name(package_name):
            self.expect_field(package_name, package, "private", True)

        if package["engines"] is not None:
            self.report_error(
                'Extraneous "engines" for %s - Only the root package.json should set "engines".',
                package_name,
            )
        if package["_atomModuleCache"] is not None:
            self.report_error('Extraneous "_atomModuleCache" for %s', package_name)

    def verify_package_name(self, package_name, package):
        expected_package_name = ""
        path = package["packageRootAbsolutePath"]
        while True:
            path, component = os.path.split(path)
            if component == "pkg":
                break
            if expected_package_name == "":
                expected_package_name = component
            else:
                expected_package_name = component + "-" + expected_package_name
        if package_name != expected_package_name:
            self.report_error(
                "Expected package name %s found %s", expected_package_name, package_name
            )
        if (
            self._atom_ide_ui or package["packageType"] == "Atom"
        ) and package_name not in self._features_in_groups:
            self.report_error(
                "Package %s not included in any feature groups. Update featureGroups.json.",
                package_name,
            )

    def verify_main_property(self, package_name, package):
        if package["main"] is None:
            return
        package_main = package["main"]
        main_file = os.path.join(package["packageRootAbsolutePath"], package_main)
        if not package_main.startswith("./"):
            # stylistic only - omitting the "./" works
            self.report_error(
                'Package %s should have a "main" file that starts with "./"',
                package_name,
            )
        if not os.path.isfile(main_file):
            self.report_error(
                'Package %s should have a "main" file that exists', package_name
            )
        if not package_main.endswith(".js"):
            self.report_error(
                'Package %s should have a "main" file with a ".js" extension',
                package_name,
            )

    def verify_author_property(self, package_name, package):
        if (
            "author" not in package
            or not package["author"]
            or package["author"] == DEFAULT_AUTHOR
        ):
            self.report_error(
                (
                    'Package %s should have an "author" property that indicates the team who '
                    + "maintains the package"
                ),
                package_name,
            )
        elif re.match("^Nuclide(\s*<.+>\s*)?$", package["author"]):
            self.report_error(
                (
                    "Package %s requires a more specific author. Use one of the Nuclide working "
                    + "groups or another team."
                ),
                package_name,
            )

    def verify_node_library(self, package):
        activation_properties = [
            "activationCommands",
            "activationHooks",
            "consumedServices",
            "providedServices",
        ]
        package_name = package["name"]
        raw_pkg = package["_rawPkg"]
        for prop in activation_properties:
            if prop in raw_pkg:
                self.report_error(
                    'Node libraries %s should not have a "%s" property.',
                    package_name,
                    prop,
                )

    def verify_atom_package_or_library(self, package):
        """Atom packages should either have an "atomConfig" or "nuclide.config", but not both."""
        package_name = package["name"]
        raw_pkg = package["_rawPkg"]
        if (
            "atomConfig" in raw_pkg
            and "nuclide" in raw_pkg
            and "config" in raw_pkg["nuclide"]
        ):
            self.report_error(
                (
                    'Package %s should either have an "atomConfig" '
                    + 'or "nuclide.config", but not both.'
                ),
                package_name,
            )

    def validate_babelrc(self, package):
        # See https://phabricator.intern.facebook.com/D2301649
        # for details on why this used to exist.
        babelrc_path = os.path.join(package["packageRootAbsolutePath"], ".babelrc")
        if os.path.isfile(babelrc_path):
            self.report_error("Deprecated .babelrc file found at %s.", babelrc_path)
            return

    def validate_json_extras(self, package):
        # Only "grammars" are allowed to be cson.
        for dirname in ["keymaps", "menus", "snippets", "settings"]:
            dir_path = os.path.join(package["packageRootAbsolutePath"], dirname)
            if not os.path.isdir(dir_path):
                continue
            for item in os.listdir(dir_path):
                if item.endswith(".cson"):
                    self.report_error(
                        '%s should use a ".json" %s file instead of %s.',
                        package["name"],
                        item,
                        dirname,
                    )

    def validate_dependencies(self, package):
        for field in DEPENDENCIES_FIELDS:
            if field in package and len(package[field]):
                self.report_error(
                    '%s should not have a "%s" field with values',
                    package["name"],
                    field,
                )

    def validate_provided_services(self, package):
        provided_services = package.get("providedServices")
        if provided_services is None:
            return
        for provided_service, _ in provided_services.items():
            if provided_service == "autocomplete.provider":
                self.report_error(
                    (
                        "Use nuclide-autocomplete.provider instead of "
                        + "autocomplete.provider for %s"
                    ),
                    package["name"],
                )

    def expect_field(self, package_name, package, field, value):
        fieldValue = package.get(field, None)
        if fieldValue is None:
            self.report_error('Missing field "%s" for "%s"', field, package_name)
        elif package[field] != value:
            self.report_error(
                'Incorrect "%s" for %s. Found %s expected %s',
                field,
                package_name,
                fieldValue,
                value,
            )

    def expect_field_in(self, package_name, package, field, values):
        fieldValue = package.get(field, None)
        if fieldValue is None:
            self.report_error('Missing field "%s" for %s', field, package_name)
        elif fieldValue not in values:
            self.report_error(
                'Incorrect "%s" for %s. Found %s', field, package_name, fieldValue
            )

    def is_internal_name(self, package_name):
        return package_name.startswith("fb-")

    def get_valid_package_prefixes(self):
        return ["fb-", "nuclide-", "sample-", "dev-", "commons-atom", "commons-node"]

    def report_error(self, message, *args):
        logging.error(
            "PACKAGE ERROR (" + self._current_file_being_linted + "): " + message, *args
        )
        self._had_error = True
