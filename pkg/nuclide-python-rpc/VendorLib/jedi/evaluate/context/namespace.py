import os
from itertools import chain

from jedi._compatibility import use_metaclass
from jedi.evaluate.cache import evaluator_method_cache, CachedMetaClass
from jedi.evaluate import imports
from jedi.evaluate.filters import DictFilter, AbstractNameDefinition
from jedi.evaluate.base_context import NO_CONTEXTS, TreeContext


class ImplicitNSName(AbstractNameDefinition):
    """
    Accessing names for implicit namespace packages should infer to nothing.
    This object will prevent Jedi from raising exceptions
    """
    def __init__(self, implicit_ns_context, string_name):
        self.implicit_ns_context = implicit_ns_context
        self.string_name = string_name

    def infer(self):
        return NO_CONTEXTS

    def get_root_context(self):
        return self.implicit_ns_context


class ImplicitNamespaceContext(use_metaclass(CachedMetaClass, TreeContext)):
    """
    Provides support for implicit namespace packages
    """
    api_type = 'module'
    parent_context = None

    def __init__(self, evaluator, fullname):
        super(ImplicitNamespaceContext, self).__init__(evaluator, parent_context=None)
        self.evaluator = evaluator
        self.fullname = fullname

    def get_filters(self, search_global, until_position=None, origin_scope=None):
        yield DictFilter(self._sub_modules_dict())

    @property
    @evaluator_method_cache()
    def name(self):
        string_name = self.py__package__().rpartition('.')[-1]
        return ImplicitNSName(self, string_name)

    def py__file__(self):
        return None

    def py__package__(self):
        """Return the fullname
        """
        return self.fullname

    @property
    def py__path__(self):
        return lambda: [self.paths]

    @evaluator_method_cache()
    def _sub_modules_dict(self):
        names = {}

        paths = self.paths
        file_names = chain.from_iterable(os.listdir(path) for path in paths)
        mods = [
            file_name.rpartition('.')[0] if '.' in file_name else file_name
            for file_name in file_names
            if file_name != '__pycache__'
        ]

        for name in mods:
            names[name] = imports.SubModuleName(self, name)
        return names
