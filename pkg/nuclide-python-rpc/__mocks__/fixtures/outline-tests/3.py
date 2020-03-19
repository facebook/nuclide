# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
# flake8: noqa


class Test3:

    def __init__(self):
        print('hi')

    @fakedecorator
    def hello(self, name):
        print('hello' + name)

    @property
    def hey(self):
        return 'hi'

    @staticmethod
    def meth():
        pass

from blah import imported_decorator

@imported_decorator()
def func():
    pass
