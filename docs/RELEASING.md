# Release process

HPADesign uses the `version` field in `package.json` as its application version. The current public version is `0.1.3`.

GitHub Pages is deployed only when a push to `main` changes that version. Changes to source code, dependencies, or the lockfile do not publish the site unless the application version changes in the same push.

Before preparing a release, commit all application changes so the working tree is clean. Then use npm to update `package.json` and `package-lock.json` and create a version commit and annotated Git tag:

```sh
npm version <new-version> -m "chore(release): v%s"
```

For example:

```sh
npm version 0.1.1 -m "chore(release): v%s"
```

Push the version commit and its `v0.1.1` tag together. The version-changing push to `main` triggers the GitHub Pages deployment workflow.

```sh
git push origin main --follow-tags
```

Finally, create a GitHub Release from the pushed tag. GitHub generates release notes from the changes since the previous release:

```sh
gh release create v0.1.1 --verify-tag --generate-notes --title "HPADesign v0.1.1"
```

For the initial `0.1.0` release, if the version change has already been committed without an npm-created tag, create and push the annotated tag manually before running `gh release create`:

```sh
git tag -a v0.1.0 -m "HPADesign v0.1.0"
git push origin v0.1.0
```
