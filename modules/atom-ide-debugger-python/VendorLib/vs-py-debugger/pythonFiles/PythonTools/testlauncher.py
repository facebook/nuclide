def main():
    import os
    import sys
    from ptvsd.visualstudio_py_debugger import DONT_DEBUG, DEBUG_ENTRYPOINTS, get_code
    
    sys.path[0] = os.getcwd()
    os.chdir(sys.argv[1])
    testFx = sys.argv[2]
    args = sys.argv[3:]

    DONT_DEBUG.append(os.path.normcase(__file__))
    DEBUG_ENTRYPOINTS.add(get_code(main))

    try:
        if testFx == 'pytest':
            import pytest
            pytest.main(args)
        else:
            import nose
            nose.run(argv=args)
        sys.exit()
    finally:
        pass

if __name__ == '__main__':
    main()
