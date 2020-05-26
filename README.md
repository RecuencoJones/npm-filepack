# npm file+pack protocol feature

This is an idea for RFC https://github.com/npm/rfcs/pull/150

## Trying it locally

After cloning the project, do:

```
npm install
npm link
```

Then you can cd into `tests/npm-filepack/root-package` and run:

```
npm-filepack
npm start
```

Or cd into `tests/filepack/root-package` and run:

```
filepack
npm start
```

This will install two local dependencies `test-package-a` and `test-package-b`,
where `test-package-b` also depends on `test-package-a` while also requiring typescript
compiling, which will be executed before packing and linking to `root-package`

## npm-filepack vs filepack?

`npm-filepack` is meant to be like a "built-in" behavior of npm, if npm allowed `file+pack:` protocol.

`filepack` is an external tool (very much like lerna or others), which will use `filepackDependencies` and `filepackDevDependencies`
from `package.json` to resolve tarballs.
This produces a side effect on `package.json`, adding tarball entries in `dependencies` and `devDependencies` respectively!

Once `filepack` has been run once:
- it's not necessary to run it again until we want to rebuild tarballs
- `npm install` can be run normally, and all `npm` commands will be working :tada:
