"""Optional maintainer tool; requires separately installed pyswisseph, not shipped.

Records numerical facts only. No reference implementation is used by tests or astr3.
"""
import datetime
import json
from pathlib import Path
import swisseph as swe

directory = Path(__file__).parent
times = [case["utc"] for case in json.loads((directory / "reference.json").read_text())["cases"]]
times += ["2025-01-11T12:00:00Z", "2025-01-12T12:00:00Z"]
cases = []
for utc in times:
    date = datetime.datetime.fromisoformat(utc.replace("Z", "+00:00"))
    jd = swe.julday(date.year, date.month, date.day, date.hour + date.minute / 60 + date.second / 3600)
    value, flags = swe.calc_ut(jd, swe.TRUE_NODE, swe.FLG_MOSEPH | swe.FLG_SPEED)
    assert flags & swe.FLG_MOSEPH
    cases.append({"utc": utc, "longitude": value[0], "speed": value[3]})
output = {
    "source": f"Swiss Ephemeris {swe.version}, Moshier true node, tropical ecliptic/equinox of date. Numerical results only; no implementation or runtime dependency.",
    "cases": cases,
}
(directory / "lunar-nodes.json").write_text(json.dumps(output, indent=2) + "\n")
print(f"Recorded {len(cases)} independent true-node reference positions")
