# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

# @nolint

# Unused single import, underline name.
import numpy
from os.path import (
    join,
    # Unused from .. import, underline name on appropriate line.
    abspath,
)

join('test', 'b')


# Extra whitespace before ), underline the space.
def test(a ):
    # Line too long, underline entire line including leading whitespace.
    os.path.join('abdfdkfdsljfksdlfjsdklfjsdkljfsdklfjskdlfjdskljfsd', 'fdsjkfdsjkfsdjkfsdjfdksfdsfdsfdfdsfsdfsdfds')
    print a
        # Unexpected indent, underline the leading whitespace.
        print a

print('hi') # Two blank spaces before comment, underline the comment including space.
print('hello')  #One space after #, underline the comment.

b=5  # Missing whitespace around operator, underline the operator.
b =  5  # Too much whitespace, underline the whitespace.

# Trailing whitespace, underline the whitespace.
# NOTE: DON'T LET YOUR EDITOR TRIM THE TRAILING WHITESPACE,
# OR TESTS WILL FAIL :(
# Expected: 4 trailing spaces.
f = 5    

# Undefined reference, underline the reference.
f = idontexist
# Unused definition, underline the entire assignment.
d = 12345
# SyntaxError, underline entire non-whitespace line.
def a(b):
    print(()!!
