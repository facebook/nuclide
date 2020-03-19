# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.


def foo(bar=27):
    return bar * 3

# flake8: noqa
def baz(test={
  'one': 'two'
}):
    return test['one']


print(foo())
print(baz())
