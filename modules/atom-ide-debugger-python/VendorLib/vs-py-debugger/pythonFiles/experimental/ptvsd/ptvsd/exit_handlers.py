# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import atexit
import os
import platform
import signal


class AlreadyInstalledError(RuntimeError):
    """Exit handlers were already installed."""


class UnsupportedSignalError(RuntimeError):
    """A signal is not supported."""


def kill_current_proc(signum=signal.SIGTERM):
    """Kill the current process.

    Note that this directly kills the process (with SIGTERM, by default)
    rather than using sys.exit().
    """
    os.kill(os.getpid(), signum)


class ExitHandlers(object):
    """Manages signal and atexit handlers."""

    if platform.system() == 'Windows':
        # TODO: Windows *does* support these signals:
        #  SIGABRT, SIGFPE, SIGILL, SIGINT, SIGSEGV, SIGTERM, SIGBREAK
        SIGNALS = []
    else:
        SIGNALS = [
            signal.SIGHUP,
        ]

    def __init__(self):
        self._signal_handlers = {sig: []
                                 for sig in self.SIGNALS}
        self._atexit_handlers = []
        self._installed = False

    @property
    def supported_signals(self):
        return set(self.SIGNALS)

    @property
    def installed(self):
        return self._installed

    def install(self):
        """Set the parent handlers.

        This must be called in the main thread.
        """
        if self._installed:
            raise AlreadyInstalledError('exit handlers already installed')
        self._installed = True
        self._install_signal_handler()
        self._install_atexit_handler()

    # TODO: Add uninstall()?

    def add_atexit_handler(self, handle_atexit, nodupe=True):
        """Add an atexit handler to the list managed here."""
        if nodupe and handle_atexit in self._atexit_handlers:
            raise ValueError('atexit handler alraedy added')
        self._atexit_handlers.append(handle_atexit)

    def add_signal_handler(self, signum, handle_signal, nodupe=True,
                           ignoreunsupported=False):
        """Add a signal handler to the list managed here."""
        # TODO: The initialization of self.SIGNALS should make this
        # special-casing unnecessary.
        if platform.system() == 'Windows':
            return

        try:
            handlers = self._signal_handlers[signum]
        except KeyError:
            if ignoreunsupported:
                return
            raise UnsupportedSignalError(signum)
        if nodupe and handle_signal in handlers:
            raise ValueError('signal handler alraedy added')
        handlers.append(handle_signal)

    # internal methods

    def _install_signal_handler(self):
        # TODO: The initialization of self.SIGNALS should make this
        # special-casing unnecessary.
        if platform.system() == 'Windows':
            return

        orig = {}
        try:
            for sig in self._signal_handlers:
                # TODO: Skip or fail if signal.getsignal() returns None?
                orig[sig] = signal.signal(sig, self._signal_handler)
        except ValueError:
            # Wasn't called in main thread!
            raise

    def _signal_handler(self, signum, frame):
        for handle_signal in self._signal_handlers.get(signum, ()):
            handle_signal(signum, frame)

    def _install_atexit_handler(self):
        self._atexit_handlers = []
        atexit.register(self._atexit_handler)

    def _atexit_handler(self):
        for handle_atexit in self._atexit_handlers:
            handle_atexit()
