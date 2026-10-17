"""Optional maintainer tool. Requires a separately installed pyswisseph (not shipped).

Records numerical facts for an independent implementation comparison. Imports no
Swiss Ephemeris source into astr3; neither the package nor CI needs this tool.
"""
import datetime
import json
from pathlib import Path
import swisseph as swe

cases = [
    ("1900-01-01T00:00:00Z", 40.7128, -74.006),
    ("1950-06-15T06:30:00Z", 0, 0),
    ("2000-01-01T12:00:00Z", 51.5074, -0.1278),
    ("2024-04-08T18:00:00Z", -33.8688, 151.2093),
    ("2025-03-15T00:00:00Z", 64.1466, -21.9426),
    ("2050-12-21T23:45:00Z", -55, 110),
    ("2100-12-31T12:00:00Z", 35.6762, 139.6503),
]
# Five-year samples across the supported range, with both hemispheres and
# longitudes. Include dates around Mercury's April 2024 retrograde stations.
for year in range(1900, 2101, 5):
    cases.append((f"{year}-09-22T03:15:00Z", -45 if year % 10 else 60, 139.65 if year % 10 else -74))
for day in [1, 3, 24, 27]:
    cases.append((f"2024-04-{day:02}T12:00:00Z", 40, -74))

fixtures = []
for utc, latitude, longitude in cases:
    date = datetime.datetime.fromisoformat(utc.replace("Z", "+00:00"))
    jd = swe.julday(date.year, date.month, date.day, date.hour + date.minute / 60 + date.second / 3600)
    planets = [swe.calc_ut(jd, body, swe.FLG_MOSEPH | swe.FLG_SPEED)[0] for body in range(10)]
    houses = {}
    for name, code in [("placidus", b"P"), ("equal", b"E"), ("whole-sign", b"W")]:
        cusps, angles = swe.houses_ex(jd, latitude, longitude, code)
        houses[name] = {"cusps": cusps, "ascendant": angles[0], "midheaven": angles[1]}
    fixtures.append({"utc": utc, "latitude": latitude, "longitude": longitude, "planets": [{"longitude": value[0], "speed": value[3]} for value in planets], "houses": houses})

output = {"source": f"Swiss Ephemeris {swe.version}, Moshier, apparent geocentric tropical of date. Numerical results only, no implementation code or runtime dependency.", "cases": fixtures}
Path(__file__).with_name("reference.json").write_text(json.dumps(output, indent=2) + "\n")
print(f"Recorded {len(fixtures)} independent reference charts")

geometry = []
for latitude in [-66.5, -65, -30, 0, 30, 65, 66.5]:
    for ramc in [0, 45, 89.99, 90, 179.99, 180, 225, 270, 359.99]:
        cusps, _ = swe.houses_armc(ramc, latitude, 23.436, b"P")
        geometry.append({"ramc": ramc, "latitude": latitude, "obliquity": 23.436, "cusps": cusps})
Path(__file__).with_name("house-geometry.json").write_text(
    '{"source":"Swiss Ephemeris ' + swe.version + ' houses_armc numerical results; independent geometry fixtures.","cases":[\n'
    + ',\n'.join(json.dumps(item, separators=(',', ':')) for item in geometry)
    + '\n]}\n'
)
print(f"Recorded {len(geometry)} independent house geometries")
