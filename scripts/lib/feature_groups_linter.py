# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import logging


# Detects errors in feature groups json fields.
class FeatureGroupsLinter(object):
    def __init__(self, feature_groups, path, available_features):
        self._available_features = available_features
        self._path = path
        self._included_features = set().union(*feature_groups.values())
        self._had_error = False

    def validate(self):
        missing_features = self._included_features - self._available_features
        if missing_features:
            self.report_error(
                "Feature group contains non-existent features: %s",
                ", ".join(missing_features),
            )

        return not self._had_error

    def report_error(self, message, *args):
        logging.error("PACKAGE ERROR (" + self._path + "): " + message, *args)
        self._had_error = True
