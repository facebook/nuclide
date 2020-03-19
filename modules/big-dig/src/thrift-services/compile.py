#!/usr/bin/env python3

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import argparse
import logging
import os
from pathlib import Path
import subprocess
import textwrap
from typing import List
from distutils.spawn import find_executable as which

CODE_FOLDER_NAME_MAP = {
    "js:node": "gen-nodejs",
    "java": "gen-java",
    "php": "gen-php"
}
logging.basicConfig(level=logging.INFO, format="%(message)s")


def add_header(fpath: Path) -> None:
    header = textwrap.dedent(
        """\
       /**
        * Copyright (c) 2017-present, Facebook, Inc.
        * All rights reserved.
        *
        * This source code is licensed under the BSD-style license found in the
        * LICENSE file in the root directory of this source tree. An additional grant
        * of patent rights can be found in the PATENTS file in the same directory.
        *
        * @generated
        */

        """
    )

    with open(fpath, "r") as f:
        content = f.read()

    if content.startswith(header):
        return

    with open(fpath, "w") as f:
        f.write(header + content)


def add_copyright_headers_to_code_files(folder_path: Path) -> None:
    for fname in folder_path.iterdir():
        fpath = folder_path / fname
        if fpath.is_dir():
            add_copyright_headers_to_code_files(fpath)
        elif os.path.isfile(fpath):
            add_header(fpath)


class ThriftError(Exception):
    pass


def run_thrift(language: str, source_files: List[Path]) -> None:
    for source_file in source_files:
        logging.info(f"\nCompiling {source_file} into {language}")
        source_dir = source_file.parent
        if subprocess.run(
            ["thrift", "--gen", language, "-r", source_file], cwd=source_dir
        ).returncode != 0:
            raise ThriftError
        folder_name = CODE_FOLDER_NAME_MAP[language]
        generated_dir = source_dir / folder_name
        print(f"Generated output to {generated_dir}")
        add_copyright_headers_to_code_files(generated_dir)


def main():
    parser = argparse.ArgumentParser(
        description="Generate thrift code for all .thrift files in subdirectories"
    )

    parser.add_argument(
        "-l",
        "--lan",
        action="store",
        dest="language",
        choices=["js:node", "java", "php", "python", "perl", "ruby"],
        default="js:node",
        help="Compile thrift to given language.",
    )

    args = parser.parse_args()
    if not which("thrift"):
        print(
            "thrift is not installed. See https://thrift.apache.org/ to install."
        )
        exit(1)

    try:
        start_dir = Path(os.path.dirname(os.path.realpath(__file__)))
        thrift_files = list(start_dir.glob('**/*.thrift'))
        run_thrift(args.language, thrift_files)
    except ThriftError:
        print("There was an error running thrift")
        exit(1)


if __name__ == "__main__":
    main()
