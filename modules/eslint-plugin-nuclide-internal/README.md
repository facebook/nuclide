## `eslint-plugin-nuclide-internal`

### Developing

* To run a single rule in isolation:

```sh
./node_modules/.bin/eslint \
  --no-eslintrc \
  --parser=babel-eslint \
  --rulesdir=resources/eslint-plugin-nuclide-internal \
  --rule='consistent-import-name: 1' \
  -- file.js
```
