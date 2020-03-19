"""
:mod:`jedi.evaluate.imports` is here to resolve import statements and return
the modules/classes/functions/whatever, which they stand for. However there's
not any actual importing done. This module is about finding modules in the
filesystem. This can be quite tricky sometimes, because Python imports are not
always that simple.

This module uses imp for python up to 3.2 and importlib for python 3.3 on; the
correct implementation is delegated to _compatibility.

This module also supports import autocompletion, which means to complete
statements like ``from datetim`` (curser at the end would return ``datetime``).
"""
import imp
import os
import pkgutil
import sys

from parso.python import tree
from parso.tree import search_ancestor
from parso.cache import parser_cache
from parso import python_bytes_to_unicode

from jedi._compatibility import find_module, unicode, ImplicitNSInfo
from jedi import debug
from jedi import settings
from jedi.evaluate import sys_path
from jedi.evaluate import helpers
from jedi.evaluate import compiled
from jedi.evaluate import analysis
from jedi.evaluate.utils import unite
from jedi.evaluate.cache import evaluator_method_cache
from jedi.evaluate.filters import AbstractNameDefinition
from jedi.evaluate.base_context import ContextSet, NO_CONTEXTS


# This memoization is needed, because otherwise we will infinitely loop on
# certain imports.
@evaluator_method_cache(default=NO_CONTEXTS)
def infer_import(context, tree_name, is_goto=False):
    module_context = context.get_root_context()
    import_node = search_ancestor(tree_name, 'import_name', 'import_from')
    import_path = import_node.get_path_for_name(tree_name)
    from_import_name = None
    evaluator = context.evaluator
    try:
        from_names = import_node.get_from_names()
    except AttributeError:
        # Is an import_name
        pass
    else:
        if len(from_names) + 1 == len(import_path):
            # We have to fetch the from_names part first and then check
            # if from_names exists in the modules.
            from_import_name = import_path[-1]
            import_path = from_names

    importer = Importer(evaluator, tuple(import_path),
                        module_context, import_node.level)

    types = importer.follow()

    #if import_node.is_nested() and not self.nested_resolve:
    #    scopes = [NestedImportModule(module, import_node)]

    if not types:
        return NO_CONTEXTS

    if from_import_name is not None:
        types = unite(
            t.py__getattribute__(
                from_import_name,
                name_context=context,
                is_goto=is_goto,
                analysis_errors=False
            )
            for t in types
        )
        if not is_goto:
            types = ContextSet.from_set(types)

        if not types:
            path = import_path + [from_import_name]
            importer = Importer(evaluator, tuple(path),
                                module_context, import_node.level)
            types = importer.follow()
            # goto only accepts `Name`
            if is_goto:
                types = set(s.name for s in types)
    else:
        # goto only accepts `Name`
        if is_goto:
            types = set(s.name for s in types)

    debug.dbg('after import: %s', types)
    return types


class NestedImportModule(tree.Module):
    """
    TODO while there's no use case for nested import module right now, we might
        be able to use them for static analysis checks later on.
    """
    def __init__(self, module, nested_import):
        self._module = module
        self._nested_import = nested_import

    def _get_nested_import_name(self):
        """
        Generates an Import statement, that can be used to fake nested imports.
        """
        i = self._nested_import
        # This is not an existing Import statement. Therefore, set position to
        # 0 (0 is not a valid line number).
        zero = (0, 0)
        names = [unicode(name) for name in i.namespace_names[1:]]
        name = helpers.FakeName(names, self._nested_import)
        new = tree.Import(i._sub_module, zero, zero, name)
        new.parent = self._module
        debug.dbg('Generated a nested import: %s', new)
        return helpers.FakeName(str(i.namespace_names[1]), new)

    def __getattr__(self, name):
        return getattr(self._module, name)

    def __repr__(self):
        return "<%s: %s of %s>" % (self.__class__.__name__, self._module,
                                   self._nested_import)


def _add_error(context, name, message=None):
    # Should be a name, not a string!
    if hasattr(name, 'parent'):
        analysis.add(context, 'import-error', name, message)


def get_init_path(directory_path):
    """
    The __init__ file can be searched in a directory. If found return it, else
    None.
    """
    for suffix, _, _ in imp.get_suffixes():
        path = os.path.join(directory_path, '__init__' + suffix)
        if os.path.exists(path):
            return path
    return None


class ImportName(AbstractNameDefinition):
    start_pos = (1, 0)
    _level = 0

    def __init__(self, parent_context, string_name):
        self.parent_context = parent_context
        self.string_name = string_name

    def infer(self):
        return Importer(
            self.parent_context.evaluator,
            [self.string_name],
            self.parent_context,
            level=self._level,
        ).follow()

    def goto(self):
        return [m.name for m in self.infer()]

    def get_root_context(self):
        # Not sure if this is correct.
        return self.parent_context.get_root_context()

    @property
    def api_type(self):
        return 'module'


class SubModuleName(ImportName):
    _level = 1


class Importer(object):
    def __init__(self, evaluator, import_path, module_context, level=0):
        """
        An implementation similar to ``__import__``. Use `follow`
        to actually follow the imports.

        *level* specifies whether to use absolute or relative imports. 0 (the
        default) means only perform absolute imports. Positive values for level
        indicate the number of parent directories to search relative to the
        directory of the module calling ``__import__()`` (see PEP 328 for the
        details).

        :param import_path: List of namespaces (strings or Names).
        """
        debug.speed('import %s' % (import_path,))
        self._evaluator = evaluator
        self.level = level
        self.module_context = module_context
        try:
            self.file_path = module_context.py__file__()
        except AttributeError:
            # Can be None for certain compiled modules like 'builtins'.
            self.file_path = None

        if level:
            base = module_context.py__package__().split('.')
            if base == ['']:
                base = []
            if level > len(base):
                path = module_context.py__file__()
                if path is not None:
                    import_path = list(import_path)
                    p = path
                    for i in range(level):
                        p = os.path.dirname(p)
                    dir_name = os.path.basename(p)
                    # This is not the proper way to do relative imports. However, since
                    # Jedi cannot be sure about the entry point, we just calculate an
                    # absolute path here.
                    if dir_name:
                        # TODO those sys.modules modifications are getting
                        # really stupid. this is the 3rd time that we're using
                        # this. We should probably refactor.
                        if path.endswith(os.path.sep + 'os.py'):
                            import_path.insert(0, 'os')
                        else:
                            import_path.insert(0, dir_name)
                    else:
                        _add_error(module_context, import_path[-1])
                        import_path = []
                        # TODO add import error.
                        debug.warning('Attempted relative import beyond top-level package.')
                # If no path is defined in the module we have no ideas where we
                # are in the file system. Therefore we cannot know what to do.
                # In this case we just let the path there and ignore that it's
                # a relative path. Not sure if that's a good idea.
            else:
                # Here we basically rewrite the level to 0.
                base = tuple(base)
                if level > 1:
                    base = base[:-level + 1]

                import_path = base + tuple(import_path)
        self.import_path = import_path

    @property
    def str_import_path(self):
        """Returns the import path as pure strings instead of `Name`."""
        return tuple(
            name.value if isinstance(name, tree.Name) else name
            for name in self.import_path)

    def sys_path_with_modifications(self):
        in_path = []
        sys_path_mod = self._evaluator.project.sys_path \
                       + sys_path.check_sys_path_modifications(self.module_context)
        if self.file_path is not None:
            # If you edit e.g. gunicorn, there will be imports like this:
            # `from gunicorn import something`. But gunicorn is not in the
            # sys.path. Therefore look if gunicorn is a parent directory, #56.
            if self.import_path:  # TODO is this check really needed?
                for path in sys_path.traverse_parents(self.file_path):
                    if os.path.basename(path) == self.str_import_path[0]:
                        in_path.append(os.path.dirname(path))

            # Since we know nothing about the call location of the sys.path,
            # it's a possibility that the current directory is the origin of
            # the Python execution.
            sys_path_mod.insert(0, os.path.dirname(self.file_path))

        return in_path + sys_path_mod

    def follow(self):
        if not self.import_path:
            return NO_CONTEXTS
        return self._do_import(self.import_path, self.sys_path_with_modifications())

    def _do_import(self, import_path, sys_path):
        """
        This method is very similar to importlib's `_gcd_import`.
        """
        import_parts = [
            i.value if isinstance(i, tree.Name) else i
            for i in import_path
        ]

        # Handle "magic" Flask extension imports:
        # ``flask.ext.foo`` is really ``flask_foo`` or ``flaskext.foo``.
        if len(import_path) > 2 and import_parts[:2] == ['flask', 'ext']:
            # New style.
            ipath = ('flask_' + str(import_parts[2]),) + import_path[3:]
            modules = self._do_import(ipath, sys_path)
            if modules:
                return modules
            else:
                # Old style
                return self._do_import(('flaskext',) + import_path[2:], sys_path)

        module_name = '.'.join(import_parts)
        try:
            return ContextSet(self._evaluator.modules[module_name])
        except KeyError:
            pass

        if len(import_path) > 1:
            # This is a recursive way of importing that works great with
            # the module cache.
            bases = self._do_import(import_path[:-1], sys_path)
            if not bases:
                return NO_CONTEXTS
            # We can take the first element, because only the os special
            # case yields multiple modules, which is not important for
            # further imports.
            parent_module = list(bases)[0]

            # This is a huge exception, we follow a nested import
            # ``os.path``, because it's a very important one in Python
            # that is being achieved by messing with ``sys.modules`` in
            # ``os``.
            if import_parts == ['os', 'path']:
                return parent_module.py__getattribute__('path')

            try:
                method = parent_module.py__path__
            except AttributeError:
                # The module is not a package.
                _add_error(self.module_context, import_path[-1])
                return NO_CONTEXTS
            else:
                paths = method()
                debug.dbg('search_module %s in paths %s', module_name, paths)
                for path in paths:
                    # At the moment we are only using one path. So this is
                    # not important to be correct.
                    try:
                        if not isinstance(path, list):
                            path = [path]
                        module_file, module_path, is_pkg = \
                            find_module(import_parts[-1], path, fullname=module_name)
                        break
                    except ImportError:
                        module_path = None
                if module_path is None:
                    _add_error(self.module_context, import_path[-1])
                    return NO_CONTEXTS
        else:
            parent_module = None
            try:
                debug.dbg('search_module %s in %s', import_parts[-1], self.file_path)
                # Override the sys.path. It works only good that way.
                # Injecting the path directly into `find_module` did not work.
                sys.path, temp = sys_path, sys.path
                try:
                    module_file, module_path, is_pkg = \
                        find_module(import_parts[-1], fullname=module_name)
                finally:
                    sys.path = temp
            except ImportError:
                # The module is not a package.
                _add_error(self.module_context, import_path[-1])
                return NO_CONTEXTS

        code = None
        if is_pkg:
            # In this case, we don't have a file yet. Search for the
            # __init__ file.
            if module_path.endswith(('.zip', '.egg')):
                code = module_file.loader.get_source(module_name)
            else:
                module_path = get_init_path(module_path)
        elif module_file:
            code = module_file.read()
            module_file.close()

        if isinstance(module_path, ImplicitNSInfo):
            from jedi.evaluate.context.namespace import ImplicitNamespaceContext
            fullname, paths = module_path.name, module_path.paths
            module = ImplicitNamespaceContext(self._evaluator, fullname=fullname)
            module.paths = paths
        elif module_file is None and not module_path.endswith(('.py', '.zip', '.egg')):
            module = compiled.load_module(self._evaluator, module_path)
        else:
            module = _load_module(self._evaluator, module_path, code, sys_path, parent_module)

        if module is None:
            # The file might raise an ImportError e.g. and therefore not be
            # importable.
            return NO_CONTEXTS

        self._evaluator.modules[module_name] = module
        return ContextSet(module)

    def _generate_name(self, name, in_module=None):
        # Create a pseudo import to be able to follow them.
        if in_module is None:
            return ImportName(self.module_context, name)
        return SubModuleName(in_module, name)

    def _get_module_names(self, search_path=None, in_module=None):
        """
        Get the names of all modules in the search_path. This means file names
        and not names defined in the files.
        """

        names = []
        # add builtin module names
        if search_path is None and in_module is None:
            names += [self._generate_name(name) for name in sys.builtin_module_names]

        if search_path is None:
            search_path = self.sys_path_with_modifications()
        for module_loader, name, is_pkg in pkgutil.iter_modules(search_path):
            names.append(self._generate_name(name, in_module=in_module))
        return names

    def completion_names(self, evaluator, only_modules=False):
        """
        :param only_modules: Indicates wheter it's possible to import a
            definition that is not defined in a module.
        """
        from jedi.evaluate.context import ModuleContext
        from jedi.evaluate.context.namespace import ImplicitNamespaceContext
        names = []
        if self.import_path:
            # flask
            if self.str_import_path == ('flask', 'ext'):
                # List Flask extensions like ``flask_foo``
                for mod in self._get_module_names():
                    modname = mod.string_name
                    if modname.startswith('flask_'):
                        extname = modname[len('flask_'):]
                        names.append(self._generate_name(extname))
                # Now the old style: ``flaskext.foo``
                for dir in self.sys_path_with_modifications():
                    flaskext = os.path.join(dir, 'flaskext')
                    if os.path.isdir(flaskext):
                        names += self._get_module_names([flaskext])

            for context in self.follow():
                # Non-modules are not completable.
                if context.api_type != 'module':  # not a module
                    continue
                # namespace packages
                if isinstance(context, ModuleContext) and context.py__file__().endswith('__init__.py'):
                    paths = context.py__path__()
                    names += self._get_module_names(paths, in_module=context)

                # implicit namespace packages
                elif isinstance(context, ImplicitNamespaceContext):
                    paths = context.paths
                    names += self._get_module_names(paths)

                if only_modules:
                    # In the case of an import like `from x.` we don't need to
                    # add all the variables.
                    if ('os',) == self.str_import_path and not self.level:
                        # os.path is a hardcoded exception, because it's a
                        # ``sys.modules`` modification.
                        names.append(self._generate_name('path', context))

                    continue

                for filter in context.get_filters(search_global=False):
                    names += filter.values()
        else:
            # Empty import path=completion after import
            if not self.level:
                names += self._get_module_names()

            if self.file_path is not None:
                path = os.path.abspath(self.file_path)
                for i in range(self.level - 1):
                    path = os.path.dirname(path)
                names += self._get_module_names([path])

        return names


def _load_module(evaluator, path=None, code=None, sys_path=None, parent_module=None):
    if sys_path is None:
        sys_path = evaluator.project.sys_path

    dotted_path = path and compiled.dotted_from_fs_path(path, sys_path)
    if path is not None and path.endswith(('.py', '.zip', '.egg')) \
            and dotted_path not in settings.auto_import_modules:

        module_node = evaluator.grammar.parse(
            code=code, path=path, cache=True, diff_cache=True,
            cache_path=settings.cache_directory)

        from jedi.evaluate.context import ModuleContext
        return ModuleContext(evaluator, module_node, path=path)
    else:
        return compiled.load_module(evaluator, path)


def add_module(evaluator, module_name, module):
    if '.' not in module_name:
        # We cannot add paths with dots, because that would collide with
        # the sepatator dots for nested packages. Therefore we return
        # `__main__` in ModuleWrapper.py__name__(), which is similar to
        # Python behavior.
        evaluator.modules[module_name] = module


def get_modules_containing_name(evaluator, modules, name):
    """
    Search a name in the directories of modules.
    """
    from jedi.evaluate.context import ModuleContext
    def check_directories(paths):
        for p in paths:
            if p is not None:
                # We need abspath, because the seetings paths might not already
                # have been converted to absolute paths.
                d = os.path.dirname(os.path.abspath(p))
                for file_name in os.listdir(d):
                    path = os.path.join(d, file_name)
                    if file_name.endswith('.py'):
                        yield path

    def check_python_file(path):
        try:
            # TODO I don't think we should use the cache here?!
            node_cache_item = parser_cache[evaluator.grammar._hashed][path]
        except KeyError:
            try:
                return check_fs(path)
            except IOError:
                return None
        else:
            module_node = node_cache_item.node
            return ModuleContext(evaluator, module_node, path=path)

    def check_fs(path):
        with open(path, 'rb') as f:
            code = python_bytes_to_unicode(f.read(), errors='replace')
            if name in code:
                module = _load_module(evaluator, path, code)

                module_name = sys_path.dotted_path_in_sys_path(evaluator.project.sys_path, path)
                if module_name is not None:
                    add_module(evaluator, module_name, module)
                return module

    # skip non python modules
    used_mod_paths = set()
    for m in modules:
        try:
            path = m.py__file__()
        except AttributeError:
            pass
        else:
            used_mod_paths.add(path)
        yield m

    if not settings.dynamic_params_for_other_modules:
        return

    additional = set(os.path.abspath(p) for p in settings.additional_dynamic_modules)
    # Check the directories of used modules.
    paths = (additional | set(check_directories(used_mod_paths))) \
            - used_mod_paths

    # Sort here to make issues less random.
    for p in sorted(paths):
        # make testing easier, sort it - same results on every interpreter
        m = check_python_file(p)
        if m is not None and not isinstance(m, compiled.CompiledObject):
            yield m
