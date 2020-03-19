# How to compile the test project
`ocamlc -g -o <name>.byte <name>.ml`

Note that the `.cmi` and `.cmo` files are not necessary for the test to run and
do not need to be checked in.

# How to debug the test project manually
`./ocamldebug <name>.byte`
