# Calculation conventions and validation

`astr3/ephemeris` uses [Astronomy Engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT) for planetary positions, apparent sidereal time, and true obliquity. Houses use an independent geometric implementation. No Swiss Ephemeris implementation is incorporated. Neither Swiss Ephemeris nor Python is a package dependency.

## Inputs and outputs

`calculateTransits({ utc }, { signal? })` uses the same planetary calculation as `calculate`, without latitude/longitude inputs or house/angle calculation. The transit bi-wheel projects those positions into natal houses through its model; it never substitutes transit-time cusps for natal cusps.

- Absolute UTC as `Date`, or ISO timestamp with `Z`/explicit offset. Local civil time, DST ambiguity, and place lookup belong to applications. Latitude is north positive; longitude is east positive.
- Supported adapter dates: 1900-01-01 through 2100-12-31 UTC. The core renderer has no date range.
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto; tropical, geocentric, true ecliptic/equinox of date. `GeoVector(..., true)` includes light-time and aberration corrections before ecliptic conversion.
- Speed is a centered one-hour longitude difference, unwrapped across 0° and scaled to degrees/day. Negative means retrograde. Extremely near stations, classifications can differ between engines; no stationary classification is asserted.
- No topocentric parallax, sidereal ayanamsa, nodes, asteroids, Chiron, refraction, custom ΔT, or Earth-orientation corrections. Arbitrary supplied points remain renderable.
- `timeUncertain` uses the supplied reference instant, omits angles/houses, and returns a warning. It does not claim the entire day's positions are known precisely.

The provider checks cancellation before and after calculation. After an initial asynchronous yield, the engine is synchronous and cannot be interrupted mid-body. For high-volume work, run it in an application-owned worker. The demo cancels old requests and checks a revision token before applying results.

## House geometry

RAMC is Greenwich apparent sidereal time plus longitude. Transform ecliptic longitude to equatorial right ascension/declination using true obliquity.

- **Equal:** twelve 30° intervals starting at the ascendant.
- **Whole Sign:** twelve signs starting at the ascending sign. AC/MC remain independent axes.
- **Placidus:** solve `RA(λ) − RAMC = f × SDA(λ)`, where `SDA = acos(−tan(latitude) × tan(declination))` and `f` is ±1/3 or ±2/3. Bisection finds intermediate cusps about the upper meridian; opposites complete the wheel.

Placidus returns `houseStatus: 'unavailable'` at/beyond the polar circle or failed convergence, retaining defined axes and a reason. No silent substitution occurs. At geographic poles the ascendant is undefined, so no axes/houses return. Choose Equal or Whole Sign explicitly.

House occupancy uses longitude intervals starting at each actual cusp, including the cusp in its own house. No five-degree cusp rule or three-dimensional house positioning is applied.

## Independent checks and limits

Committed fixtures record numeric results from separately installed Swiss Ephemeris 2.10.03 with Moshier planets. Tests import no reference implementation. Optional regeneration uses `tests/fixtures/generate-reference.py`, which needs a separately obtained `pyswisseph` installation under its applicable terms.

- **52 charts:** endpoints and five-year samples across 1900–2100, both hemispheres, equatorial/high latitudes, and dates around Mercury's April 2024 stations.
- **Planet tolerance: 2 arcminutes**, checked on fixtures rather than asserted universally. On 2100-12-31 the Moon differs by about 1.14 arcminutes because the engines predict different future ΔT (about 205 versus 94 seconds). Sampled modern-date errors are substantially smaller.
- **House/angle tolerance: 0.005°** with independent time models. Fixed-RAMC fixtures isolate the house geometry and cover meridian wraparound and ±66.5° latitude.
- Other tests cover longitude/orb boundaries, supplied aspects, cusp membership, unknown data, polar failures, and cancellation.

For exact agreement with a particular astrology service, supply that service's positions/cusps and conventions through another provider. Interpretation text belongs to applications.
