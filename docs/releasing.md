# Preparing a public release

These steps are local validation. Creating a GitHub repository, pushing a branch,
changing its visibility or publishing to npm requires the owner's instruction.
The intended repository is `yuzuwoeser/astr3`; links may be unavailable before it
is created. Version 0.1.0 has an implementation but is not yet published to npm.

## Identity and privacy

Check the identity that the next commit will use and the history you will publish:

```sh
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
git log --all --format='%h %an <%ae> | %cn <%ce>'
git remote -v
git status --short
```

This repository uses `yuzuwoeser` and
`118196026+yuzuwoeser@users.noreply.github.com`. Do not change global Git settings
or a GitHub profile to release this repository. Check author/committer fields as
well as commit messages, tags and all refs that may be pushed. A clean latest
checkout does not imply clean history. Do not import private backup refs or merge
an unsanitized local repository into the publication repository.

Use only synthetic positions or clearly documented public reference inputs in
fixtures, screenshots and examples. Review metadata, source maps with inline
sources, archives, logs and browser traces. Keep any personal-data search terms,
redacted scan reports and old-to-new history maps outside the public repository.
Preserve legitimate public third-party license attribution.

Install **Gitleaks 8.30.1** from its
[official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1), checking
the published checksum for your platform. Run these without uploading the source:

```sh
gitleaks git --log-opts=--all --redact --no-banner .
```

After building, scan an export of tracked files plus the extracted package and
demo build with `gitleaks dir --redact --no-banner PATH`. Exporting tracked files
avoids scanning dependencies and local caches. Inspect uncommitted files separately;
`git archive HEAD` includes committed files only. CI scans all fetched history
with this same pinned scanner version. Do not treat a secret scan as a personal
data detector: review dates, coordinates and images separately.

## Validate the release candidate

Use Node 24 LTS and the committed lockfile:

```sh
npm ci
npm exec playwright -- install chromium
npm run format:check
npm run check
npm run test:browser
npm pack --dry-run
npm pack
```

Stop any unrelated server on port 4173 before browser tests. On Linux, install
Chromium with `--with-deps`. Browser coverage is Chromium desktop and mobile touch
emulation; physical devices, Firefox and Safari remain unverified.

`npm run check` builds both outputs and installs the package into an isolated
offline consumer, verifying public ESM entry points, declarations and headless
imports. The consumer installs local archives of ASTR3 and its installed peers
with an isolated empty npm cache, so cached registry metadata is not required.

`npm pack` rebuilds the library and creates an ignored tarball. Inspect
its file list: only built ESM/types/maps, public docs, metadata, license and notices
belong there. Tests, demo source, private configuration and local agent data do not.
Extract the tarball into a temporary directory for scanning; do not rely on
scanning the compressed file alone. Scan `demo-dist/` before hosting the demo.

## Documentation and publication

- Confirm README examples, API/transit contracts and calculation limits match the
  implementation. Keep contributor and agent guides, `llms.txt`, and the changelog current.
- Verify package author/repository/homepage/bugs metadata, version and license.
  Keep npm publication instructions truthful until the package actually exists.
- Review the final diff and create a local commit. Recheck identity, clean status,
  reachable refs, tarball contents and scans at the committed candidate.
- When GitHub publication is authorized, push only the intended sanitized branch.
  Enable **private vulnerability reporting** before advertising that reporting
  channel; [SECURITY.md](../SECURITY.md) explains the fallback while unavailable.
- When npm publication is authorized, verify ownership/availability of the package
  name, publish the reviewed artifact and record the release in the changelog.

Record commands, versions and results in the release notes or review evidence.
Never commit raw scanner reports that might reproduce a secret or personal input.
