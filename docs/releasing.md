# Preparing a release

The [source repository](https://github.com/yuzuwoeser/astr3) is public. The package
version is 0.1.0; npm publication is pending. These steps validate a release
candidate locally. Pushing, enabling GitHub Pages, changing repository visibility,
and publishing to npm require the owner's instruction.

For demo deployment and production smoke tests, see [GitHub Pages](github-pages.md).

## Identity and privacy

Check the identity that the next commit will use and the history you will publish:

```sh
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
git log --all --format='%h %an <%ae> | %cn <%ce>'
git remote -v
git status --short
```

Confirm that the author and committer use the intended public identity. Do not
change global Git settings or a GitHub profile as part of a release. Review commit
messages, tags, and all refs that may be pushed. A clean checkout does not imply
clean history; keep private backup refs and repositories out of public history.

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
npm run test:pages
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
scanning the compressed file alone. Scan `site-dist/` before hosting the demo.

## Documentation and publication

- Confirm README examples, API/transit contracts and calculation limits match the
  implementation. Keep contributor and agent guides, `llms.txt`, and the changelog current.
- Verify package author/repository/homepage/bugs metadata, version and license.
  Keep npm publication instructions truthful until the package actually exists.
- Review the final diff and create a local commit. Recheck identity, clean status,
  reachable refs, tarball contents and scans at the committed candidate.
- When pushing is authorized, push only the reviewed branch. Verify **private
  vulnerability reporting** and update [SECURITY.md](../SECURITY.md) if its
  availability changes; the policy currently directs reporters to request a
  private channel without disclosing details publicly.
- When npm publication is authorized, verify ownership/availability of the package
  name, publish the reviewed artifact and record the release in the changelog.

Record commands, versions and results in the release notes or review evidence.
Never commit raw scanner reports that might reproduce a secret or personal input.

## Automated distributions

`npm run build:release` builds the library, packs it without running prepack a
second time, and creates `.release/`. It uses the same browser builder as Pages.
The output includes the npm tarball, browser ZIP, WordPress ZIP, independent
starter ZIPs, source-commit manifest and SHA-256 checksums. Generated archives
normalize file order and timestamps so the same candidate has stable ZIP bytes.

```sh
npm run build:release
npm run test:starters
npm run test:release
npm run test:wordpress
```

Starter validation installs each extracted archive in isolation and builds its
application. It needs npm network access for framework/tooling dependencies.
Release browser tests serve port 4175. WordPress Playground downloads WordPress
and PHP runtimes, installs the actual ZIP and serves port 4176; native PHP/Docker
are not required. Defaults cover WordPress 6.5 / PHP 8.0. Also run against the
current WordPress version with `ASTR3_WP_VERSION=latest ASTR3_PHP_VERSION=8.3`.
Playground is a test-only dev dependency and is excluded from all distributions.

### One-time npm setup

The package name is `astr3`. Confirm account ownership/name availability before
publishing. If the name is unavailable, stop and resolve ownership; do not rename
exports or silently switch to another scope. Initial package registration or
publication may require the owner's authenticated npm session. Complete that
setup before using CI; there is no token stored in this repository.

Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)
for GitHub repository `yuzuwoeser/astr3`, workflow `release.yml`, allowing direct
publication. GitHub-hosted Node 24 runners provide OIDC through `id-token: write`.
Use npm 11.5.1 or newer. Review npm's current setup requirements when bootstrapping
a new package. Publication generates provenance for this public repository.

### Tag-triggered publication

Prepare the version and changelog on `main`, validate and commit them, and only
when pushing/publication is authorized push an annotated `vX.Y.Z` tag for that
reviewed commit. `.github/workflows/release.yml` rejects tags that do not match
`package.json` or whose commit is outside `origin/main`.

The prepare job runs checks and scans history/extracted distributions, then
uploads the tested artifacts. The publish job downloads those exact bytes,
checks the manifest and existing GitHub/npm artifacts, creates a draft release,
uploads assets, publishes the tarball, verifies npm integrity, and makes the
release public. No PR workflow publishes. Ordinary merges still deploy Pages.

A partial failure leaves the draft and any already-published npm version intact.
Rerun the failed publish job to resume using the original uploaded artifacts.
Identical existing assets/npm integrity are accepted; differences and unexpected
release assets fail without overwriting them. Never move a release tag to repair
an artifact mismatch: prepare a new version. Do not delete a published npm version
as a retry strategy. Local `node scripts/publish-release.mjs --dry-run` performs
read-only preflight with the release environment and GitHub authentication set.

The website installation chooser exposes downloads from the current main build;
its versioned filenames are convenience links and can change before release.
GitHub Release assets are the immutable installation path for published versions.
Keep npm instructions marked pending until the first actual registry publication.
