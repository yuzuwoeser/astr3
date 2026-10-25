# Integration coverage roadmap

Distribution comes first. New integrations reuse the npm/browser distributions;
CMS packages include the shared browser renderer instead of copying its logic.

| Phase               | Stacks                                                          | Deliverable and acceptance                                                                                                                    |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial delivery    | JS/TS, HTML, React, Vue, Svelte, Angular, PHP, WordPress, Rails | Versioned distributions, installable WordPress ZIP, standalone starters, adoption-first guides; package, browser and WordPress runtime checks |
| Framework expansion | Next.js, Nuxt, SvelteKit, Astro                                 | Runnable browser-only mounts with update/disposal, SSR boundaries and client navigation tests                                                 |
| Backend expansion   | Laravel, Django, ASP.NET Core                                   | Safe server JSON serialization, browser rendering, lifecycle and actual backend runtime tests                                                 |
| CMS expansion       | Drupal, Joomla                                                  | Native installable packages built from the shared browser modules, with editor placement and platform runtime tests                           |

Only the initial delivery is implemented in this change. Later phases are named
follow-up work, not compatibility claims. Each new guide must identify its tested
framework version and distinguish the minimal integration from demo scaffolding.

Before implementing either additional CMS package, specify its native packaging,
editor data-entry surface, permission model and update lifecycle. Keep supplied
chart JSON and appearance presets as the shared integration boundary. Birth-detail
forms, location/timezone services and interpretation are application features.

Separate framework npm packages remain deferred: the current small adapters are
copyable components with lifecycle ownership. Reconsider published adapters only
when their maintenance and consumer benefit justify a supported package API.
