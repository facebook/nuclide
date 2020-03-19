#!/usr/bin/env python3

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from typing import TypeVar, Generic


T = TypeVar('T')


class Node(Generic[T]):
    def __init__(self, label: T = None) -> None:
        pass


def fun(arg1: float, arg2: float) -> float:
    pass


def fun2(a, *, b):
    pass
