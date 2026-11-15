"""Local browser UI for the original solver. Run: python server.py"""

import argparse
import json
from fractions import Fraction
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

from main import (ATTRIBUTES, ATTRIBUTE_LABELS, CATEGORIES, Microbe, parse_interval,
                  parse_numbers, ranked_trios, validate_trait_names)

ROOT = Path(__file__).resolve().parent


def solve(data):
    if not isinstance(data, dict):
        raise ValueError("Enter ocean conditions and ten microbes.")
    ranges = data.get("ranges", [])
    if not isinstance(ranges, list) or len(ranges) != 3:
        raise ValueError("Enter all three ocean ranges.")
    intervals = []
    for attr, bounds in zip(ATTRIBUTE_LABELS, ranges):
        if not isinstance(bounds, list) or len(bounds) != 2:
            raise ValueError(f"Enter both endpoints for {attr}.")
        try:
            intervals.append(parse_interval(" ".join(map(str, bounds))))
        except ValueError as error:
            raise ValueError(f"{attr.title()}: {error}") from None
    # Missing catalogs belong to older saved clients; explicit lists are authoritative.
    trait_names = validate_trait_names(data.get("traitNames", list(CATEGORIES)))
    desired, undesired = data.get("desired"), data.get("undesired")
    if desired not in trait_names or undesired not in trait_names:
        raise ValueError("Choose a desired and an excluded trait.")
    if desired == undesired:
        raise ValueError("The desired and excluded traits must be different.")
    rows = data.get("microbes", [])
    if not isinstance(rows, list) or len(rows) != 10:
        raise ValueError("Enter exactly ten microbes.")
    microbes = []
    for number, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            raise ValueError(f"Check microbe {number}.")
        values, traits = row.get("values", []), row.get("traits", [])
        if not isinstance(values, list) or len(values) != 3:
            raise ValueError(f"Enter three values for microbe {number}.")
        try:
            parsed = parse_numbers(" ".join(map(str, values)), 3)
        except ValueError:
            raise ValueError(f"Microbe {number}: enter valid Attribute 1, Attribute 2 and Attribute 3 values.") from None
        if not isinstance(traits, list) or not traits or any(t not in trait_names for t in traits):
            raise ValueError(f"Microbe {number}: select at least one trait from your trait list.")
        microbes.append(Microbe(number, parsed, frozenset(traits)))
    matches = []
    for trio, totals, checks, score in ranked_trios(microbes, intervals, desired, undesired):
        matches.append({
            "ids": [m.number for m in trio],
            "averages": [str(Fraction(total, 3)) for total in totals],
            "decimals": [float(total / 3) for total in totals],
            "carriers": [m.number for m in trio if desired in m.traits],
            "checks": checks,
            "score": score,
        })
    return {"matches": matches, "eligible": sum(undesired not in m.traits for m in microbes),
            "excluded_ids": [m.number for m in microbes if undesired in m.traits],
            "best_score": matches[0]["score"] if matches else None,
            "scoring": {"points_per_check": 20, "checks": [*ATTRIBUTES, "desired", "excluded"]}}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve only public UI files, not the workspace or Python source.
        path = self.path.split("?", 1)[0]
        public = {"/": "web/index.html", "/app.js": "web/app.js", "/model.js": "web/model.js", "/style.css": "web/style.css", "/assets/treat.jpg": "assets/treat.jpg"}
        if path not in public:
            self.send_error(404)
            return
        self.path = "/" + public[path]
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/solve":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 50000:
                raise ValueError("The request is empty or too large.")
            result = solve(json.loads(self.rfile.read(length)))
            status = 200
        except (ValueError, TypeError, OverflowError) as error:
            result, status = {"error": str(error)}, 400
        body = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(ROOT)))
    url = f"http://127.0.0.1:{args.port}"
    print(f"Ocean Lab is running at {url}. Press Ctrl+C to stop.", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
