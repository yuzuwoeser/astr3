# Calculation conventions and validation

`@yuzuwoeser/astr3/ephemeris` uses [Astronomy Engine](https://github.com/cosinekitty/astronomy)
(MIT, supported peer range `^2.1.19`) for planetary positions, lunar state vectors,
apparent sidereal time, and true obliquity. Houses and lunar nodes use geometric
calculations over those quantities. Neither Swiss Ephemeris nor Python is a
package dependency. For method signatures, request fields, and errors, see the
[calculation API](api.md#calculation-api); this guide explains conventions and limits.

## Inputs and outputs

`calculateTransits({ utc }, { signal? })` uses the same planetary calculation as `calculate`, without latitude/longitude inputs or house/angle calculation. The transit bi-wheel projects those positions into natal houses through its model; it never substitutes transit-time cusps for natal cusps.

The optional [transit animation controller](transits.md#animated-time-steps) calls an injected calculator for every displayed timestamp. Its sub-day/station sampling and 0.05° trajectory-resolution target govern playback detail; they do not change the astronomical conventions or numerical accuracy limits below.

- Absolute UTC as `Date`, or ISO timestamp with `Z`/explicit offset. Local civil time, DST ambiguity, and place lookup belong to applications. Latitude is north positive; longitude is east positive.
- Supported adapter dates: 1900-01-01 through 2100-12-31 UTC. The core renderer has no date range.
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto; tropical, geocentric, true ecliptic/equinox of date. `GeoVector(..., true)` includes light-time and aberration corrections before ecliptic conversion.
- North Node (`north-node`, ☊) and South Node (`south-node`, ☋) use the **true, osculating** convention. Both are included in natal and transit `bodies`, with latitude 0°, speed, retrograde status, and `metadata.nodeType: 'true'`. Chart metadata includes `lunarNodeType: 'true'`. The South Node is exactly opposite the North Node. These geometric points have no light-time/aberration correction.
- Ascendant (`ascendant`, AC) and Midheaven (`midheaven`, MC) are included in natal `bodies` whenever the corresponding angles are defined. Their longitudes match `angles` exactly, independent of house system; MC is not inferred from cusp 10. Their daily speed is not supplied. UTC-only transit calculations omit these location-dependent points.
- Speed is a centered one-hour longitude difference, unwrapped across 0° and scaled to degrees/day. Negative means retrograde. Extremely near stations, classifications can differ between engines; no stationary classification is asserted.
- No topocentric parallax, sidereal ayanamsa, mean-node calculation, asteroids, Chiron, refraction, custom ΔT, or Earth-orientation corrections. Arbitrary supplied points remain renderable, including externally calculated mean nodes.
- `timeUncertain` uses the supplied reference instant, omits angles/houses, and returns a warning. It does not claim the entire day's positions are known precisely.

The provider checks cancellation before and after calculation. After an initial asynchronous yield, the engine is synchronous and cannot be interrupted mid-body. For high-volume work, run it in an application-owned worker. The demo cancels old requests and checks a revision token before applying results.

## Lunar node geometry

The true node is the intersection of the instantaneous lunar orbital plane with the ecliptic, following the [osculating-node convention](https://www.astro.com/swisseph/swisseph.htm). Rotate Astronomy Engine's `GeoMoonState` position and velocity from J2000 equatorial coordinates into the true ecliptic/equinox of the requested date. With orbital normal `h = r × v`, the ascending-node direction is `(-h.y, h.x, 0)`. Its longitude gives the North Node; add 180° for the South Node.

True nodes can briefly move direct, so their motion is calculated rather than hardcoded retrograde. The Moon model's velocity approximation affects node speeds more than positions. Near a node station, a tiny speed and its direct/retrograde flag can disagree with another engine. Use an external provider when exact agreement with that engine is required.

## House geometry

RAMC is Greenwich apparent sidereal time plus longitude. Transform ecliptic longitude to equatorial right ascension/declination using true obliquity.

- **Equal:** twelve 30° intervals starting at the ascendant.
- **Whole Sign:** twelve signs starting at the ascending sign. AC/MC remain independent axes.
- **Placidus:** solve `RA(λ) − RAMC = f × SDA(λ)`, where `SDA = acos(−tan(latitude) × tan(declination))` and `f` is ±1/3 or ±2/3. Bisection finds intermediate cusps about the upper meridian; opposites complete the wheel.

Placidus returns `houseStatus: 'unavailable'` at/beyond the polar circle or failed
convergence, retaining defined axes and a warning. No silent substitution occurs.
At geographic poles the ascendant is undefined, so no axes/houses return for any
system. At other high latitudes, choose Equal or Whole Sign explicitly if needed.
The standalone `calculateHouses` function returns the same geometry with `status`
and optional `reason`; its [inputs](api.md#standalone-house-calculation) are angles,
not a UTC calculation request.

House occupancy uses longitude intervals starting at each actual cusp, including the cusp in its own house. No five-degree cusp rule or three-dimensional house positioning is applied.

## Independent checks and limits

Committed fixtures record numeric results from separately installed Swiss
Ephemeris 2.10.03 with Moshier planets. Tests import no reference implementation.
Optional [reference regeneration](https://github.com/yuzuwoeser/astr3/blob/main/tests/fixtures/generate-reference.py)
needs a separately obtained `pyswisseph` installation under its applicable terms.

- **52 charts:** endpoints and five-year samples across 1900–2100, both hemispheres, equatorial/high latitudes, and dates around Mercury's April 2024 stations.
- **Planet tolerance: 2 arcminutes**, checked on fixtures rather than asserted universally. On 2100-12-31 the Moon differs by about 1.14 arcminutes because the engines predict different future ΔT (about 205 versus 94 seconds). Sampled modern-date errors are substantially smaller.
- **House/angle tolerance: 0.005°** with independent time models. Fixed-RAMC fixtures isolate the house geometry and cover meridian wraparound and ±66.5° latitude.
- **True-node position tolerance: 1 arcminute**, checked against 54 independent Moshier true-node fixtures across 1900–2100, including zodiac wrap and direct motion. Sampled speed differences stay below 0.01°/day; motion flags are compared outside that margin from a station. These are sampled tolerances, not a universal error bound. Optional [node reference regeneration](https://github.com/yuzuwoeser/astr3/blob/main/tests/fixtures/generate-node-reference.py) uses the same separate-installation terms.
- Other tests cover longitude/orb boundaries, supplied aspects, cusp membership, unknown data, polar failures, and cancellation.

For exact agreement with a particular astrology service, supply that service's positions/cusps and conventions through another provider. Interpretation text belongs to applications.
