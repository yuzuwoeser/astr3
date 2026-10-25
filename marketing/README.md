# ASTR3 launch kit

This kit targets developers building astrology websites and learning tools.
The working pitch is **interactive astrology charts connected to your app's
content**. Three developers trying an integration in four weeks, and five working
integrations in eight weeks, are experiment targets rather than forecasts.

## Start here

1. Publish the tested repository changes through the normal deployment workflow.
   This kit does not authorize a push, deployment, message or post.
2. Open the public [selection demo](https://yuzuwoeser.github.io/astr3/examples/selection/)
   and [React tutorial](https://yuzuwoeser.github.io/astr3/integrations/react/)
   after deployment. These new routes must be live before using the drafts.
3. Post the short announcement on an account you already use, attach the screenshot,
   and submit the technical showcase to the Three.js forum.
4. Use [prospects.md](prospects.md) for personalized outreach. Its contact status
   matters: a GitHub profile is not a messaging channel. Hold candidates without
   an appropriate verified contact route; never open a promotional issue.
5. Bring responses into the next working session. Keep conversations and contact
   history in the ignored `.private/marketing/` directory, outside tracked files.

## Assets and copy

- [Ready-to-adapt posts and technical answers](launch-copy.md).
- [Three researched communities and their constraints](communities.md).
- [Twelve public prospects, fit evidence and individual drafts](prospects.md).
- [Sun selection screenshot](../site/public/marketing/selection-demo.png).
- [Moon selection screenshot](../site/public/marketing/selection-moon.png).
- [Selection and transit clip, WebM](../site/public/marketing/selection-demo.webm).
- [React tutorial source](../examples/react/README.md). The website publishes this
  same file beside the actual runnable component, rather than a separate stale copy.

Suggested image description: “An ASTR3 natal/transit wheel with the Sun selected.
An application panel lists the selected planet's natal and transit aspects.”
All screenshots and recordings use invented positions, unknown houses and manual
synthetic transit steps. No dates, birth information or real predictions appear.
WebM is provided as a standalone clip; use the PNG where a platform does not accept it.

To refresh captures with Node.js 24 LTS and installed Playwright Chromium:

```sh
npm run build:site
npm run capture:marketing
npm run test:pages
```

The capture script serves the local root-base build and performs actual UI actions.
It writes two PNGs and a roughly 25-second WebM to `site/public/marketing/`.
Capture after a root-base build, then rebuild Pages to include the refreshed assets.

## Four-week operating schedule

| Week | Agent deliverables                                                      | Human actions, within 2–3 hours                                      |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Demo, tutorial, captures, copy, prospect research                       | Publish the verified changes; post one announcement and one showcase |
| 2    | First three contactable messages; responses and integration examples    | Send three relevant messages; relay replies                          |
| 3    | Next three messages; repair the most repeated onboarding blocker        | Relay replies and test any prospect-specific example                 |
| 4    | Next messages, evidence review and a revised pitch or onboarding change | Follow up with interested builders and confirm working integrations  |

During a weekly session, supply only the new responses and any reproduction details.
The agent should review the private log, prepare the next three eligible messages,
draft replies, and address the most repeated blocker. Work runs during sessions;
there is no background campaign or automatic posting.

## Evidence and decisions

Track project, source/contact route, date contacted, reply, integration attempt,
blocker, next action and permission to showcase. Count an attempt when a developer
actually installs or embeds ASTR3; count an integration when they report a working
chart in their own project. Do not count this repository's examples as adoption.

No replies after relevant outreach: revisit fit and the opening message.
Replies without attempts: improve the first-chart path. Attempts that stop: repair
the repeated blocker before increasing distribution. Ask interested users what
would make the next integration step possible. Stars are secondary evidence.

## Verification record

Research and validation were performed on 2026-10-25 using Node.js 24 LTS:

| Check                         | Result                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`               | Passed: types, 247 unit/reference tests, builds, example compilers, Ruby recipe syntax and packed consumer                               |
| `npm run test:pages`          | 82 desktop/mobile production tests passed under `/astr3/`, including the new demo and React selection lifecycle                          |
| `npm run format:check`        | Passed                                                                                                                                   |
| Published npm package         | Registry version `0.1.1` installed with Three.js in an independent temporary directory; SSR-safe main import and headless model verified |
| React starter ZIP             | Extracted generated archive, installed dependencies, built independently and verified selection, updates and unmount/remount in Chromium |
| Additional browser inspection | Desktop/mobile layout, keyboard selection, reduced-motion setting and usable selection/object list without WebGL                         |
| Media capture                 | Two screenshots and a WebM produced by actual selection and transit-step actions; no browser or asset errors during capture              |

The check used a writable temporary npm cache because the sandbox could not write
the default cache. PHP is unavailable in this environment, so its optional syntax
check was skipped; PHP runtime and WordPress runtime were not newly validated.
No public deployment or external contact has been performed.

Project descriptions and community policies can change; recheck the linked primary
sources before use. Public project fit is an inference from documentation, not
evidence of interest.
