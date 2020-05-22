# npm file+pack protocol feature

This is an idea for issue https://github.com/npm/cli/issues/1333

## Trying it locally

After cloning the project, do:

```
npm install
npm link
```

Then you can cd into `tests/root-package` and run:

```
npm-filepack
npm start
```

This will install two local dependencies `test-package-a` and `test-package-b`,
where `test-package-b` also depends on `test-package-a` while also requiring typescript
compiling, which will be executed before packing and linking to `root-package`
