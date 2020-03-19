import os
import sys

from jedi.evaluate.sys_path import get_venv_path, detect_additional_paths
from jedi.cache import underscore_memoization


class Project(object):
    def __init__(self, sys_path=None):
        if sys_path is not None:
            self._sys_path = sys_path

        venv = os.getenv('VIRTUAL_ENV')
        if venv:
            sys_path = get_venv_path(venv)

        if sys_path is None:
            sys_path = sys.path

        base_sys_path = list(sys_path)
        try:
            base_sys_path.remove('')
        except ValueError:
            pass

        self._base_sys_path = base_sys_path

    def add_script_path(self, script_path):
        self._script_path = script_path

    def add_evaluator(self, evaluator):
        self._evaluator = evaluator

    @property
    @underscore_memoization
    def sys_path(self):
        if self._script_path is None:
            return self._base_sys_path

        return self._base_sys_path + detect_additional_paths(self._evaluator, self._script_path)
