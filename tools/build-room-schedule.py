"""Build the delivery staff directory CSV from the RRHS master schedule workbook.

Usage:
  python3 tools/build-room-schedule.py "<Master Schedule.xlsx>" [sheet name] > \
    "check-out-page/schedule_processed.xlsx - Room Schedule.csv"

Rules (per period cell):
  - Black-filled cell (athletics duty)            -> no delivery
  - "... w/ Teacher" (inclusion, co-taught)        -> no delivery
  - Conference / PLC Planning                      -> teacher's default ROOM
  - Room number, or text containing "Room 1315"    -> that room
  - Course name with no room listed                -> teacher's default ROOM
  - Off Campus / Closed / TBD / sports / other     -> no delivery
The checkout script additionally filters rooms to the allowed buildings.
Requires: openpyxl. Default sheet: the last "<date> Edition" sheet.
"""
import csv, re, sys
import openpyxl

NO_DELIVERY = re.compile(
    r"off campus|closed|tbd|athletic trainer|volleyball|basketball|football|soccer|baseball|"
    r"softball|track|swim|water polo|cheer|tennis|golf|wrestl|cross country|^m(r|rs|s)\.\s",
    re.I,
)
ROOM_IN_TEXT = re.compile(r"\b(?:room|rm)\s*(\d{3,4}[A-Z]?)\b|^(\d{3,4}[A-Z]?)\b|\b(\d{4})\b", re.I)
DEFAULT_ROOM_TEXT = re.compile(r"^(conference|plc planning)$", re.I)
PERIOD_HEADERS = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH"]


def room_from(text):
    m = ROOM_IN_TEXT.search(text)
    return next((g for g in m.groups() if g), "") if m else ""


def cell_room(cell, default_room):
    text = re.sub(r"\s+", " ", str(cell.value or "")).strip()
    fill = cell.fill.fgColor.rgb if cell.fill is not None and cell.fill.fill_type else None
    if fill == "FF000000":
        return "", "athletics"
    if not text:
        return "", ""
    if "w/" in text.lower():
        return "", "inclusion"
    if DEFAULT_ROOM_TEXT.match(text):
        return default_room, text.lower()
    room = room_from(text)
    if room:
        return room, ""
    if NO_DELIVERY.search(text):
        return "", text
    return default_room, ""  # a class with no room listed is taught in their room


def main():
    wb = openpyxl.load_workbook(sys.argv[1])
    if len(sys.argv) > 2:
        ws = wb[sys.argv[2]]
    else:
        ws = [s for s in wb.worksheets if s.title.strip().endswith("Edition")][-1]
    header = [str(c.value or "").strip() for c in ws[1]]
    name_i = header.index("Teacher/Staff")
    room_i = header.index("ROOM")
    period_i = [header.index(h) for h in PERIOD_HEADERS]

    out = csv.writer(sys.stdout, lineterminator="\n")
    out.writerow(["Teacher/Staff"] + [f"Period {p}" for p in range(1, 9)] + ["Notes"])
    rows = []
    for r in ws.iter_rows(min_row=2):
        name = re.sub(r"\s+", " ", str(r[name_i].value or "")).strip()
        if not name or "," not in name:
            continue
        default_room = room_from(re.sub(r"\s+", " ", str(r[room_i].value or "")).strip())
        periods, notes = [], []
        for p, i in enumerate(period_i, start=1):
            room, why = cell_room(r[i], default_room)
            periods.append(room)
            if not room and why:
                notes.append(f"{PERIOD_HEADERS[p - 1]}: {why}")
        rows.append([name] + periods + ["; ".join(notes)])
    rows.sort(key=lambda row: row[0].lower())
    out.writerows(rows)
    print(f"{ws.title}: {len(rows)} staff", file=sys.stderr)


if __name__ == "__main__":
    main()
