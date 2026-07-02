# -*- coding: utf-8 -*-
"""
ARE Edit Point Loads -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 3

Select joist(s), enter up to 5 point loads in a compact syntax, and this writes
ARE_J_P1_Mag..P5_Mag (kips) + ARE_J_P1_Dist..P5_Dist (length from joist start)
and a schedule-facing ARE_J_PointLoad_Callout, e.g.:
    P1=1.5k @ 6'-0"; P2=0.8k @ 14'-6"

Input syntax:  kips@feet ; kips@feet ; ...   e.g.  1.5@6; 0.8@14.5
  - distance is decimal feet from the joist start (6.5 = 6'-6")
  - blank input clears all point loads on the selection

Single joist  -> the prompt pre-fills its current loads (edit in place).
Multi-select  -> apply the same set to all, or clear all.

Display-only: point loads are NOT folded into the uniform line load.
CPython note: instance params via LookupParameter; length via BuiltInParameter.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_point_loads.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Edit Point Loads log\n")
    except Exception:
        pass


try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import BuiltInParameter, Transaction
    from pyrevit import forms

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

MARKER = "ARE_J_P1_Mag"
MAXN = 5
CALLOUT = "ARE_J_PointLoad_Callout"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_double(inst, name):
    try:
        p = inst.LookupParameter(name)
        return p.AsDouble() if p is not None else 0.0
    except Exception:
        return 0.0


def set_val(inst, name, value):
    p = inst.LookupParameter(name)
    if p is None or p.IsReadOnly:
        return False
    try:
        p.Set(value)
        return True
    except Exception:
        return False


def joist_length_ft(inst):
    try:
        p = inst.get_Parameter(BuiltInParameter.INSTANCE_LENGTH_PARAM)
        if p is not None:
            return p.AsDouble()
    except Exception:
        pass
    # fallback: location curve
    try:
        curve = getattr(inst.Location, "Curve", None)
        if curve is not None:
            return curve.Length
    except Exception:
        pass
    return None


def fmt_num(x):
    return ("%g" % x)


def ft_in(ft):
    total_in = int(round(ft * 12.0))
    return "{0}'-{1}\"".format(total_in // 12, total_in % 12)


def parse_loads(text):
    """'1.5@6; 0.8@14.5' -> sorted [(mag,dist_ft), ...]. Raises ValueError."""
    loads = []
    for chunk in text.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "@" not in chunk:
            raise ValueError("'{0}' should be magnitude@distance, e.g. 1.5@6".format(chunk))
        mpart, dpart = chunk.split("@", 1)
        mag = float(mpart.strip())
        dist = float(dpart.strip())
        if mag <= 0:
            continue
        if dist < 0:
            raise ValueError("distance can't be negative: '{0}'".format(chunk))
        loads.append((mag, dist))
    if len(loads) > MAXN:
        raise ValueError("max {0} point loads (got {1})".format(MAXN, len(loads)))
    loads.sort(key=lambda md: md[1])
    return loads


def current_string(inst):
    parts = []
    for i in range(1, MAXN + 1):
        m = get_double(inst, "ARE_J_P{0}_Mag".format(i))
        d = get_double(inst, "ARE_J_P{0}_Dist".format(i))
        if m and m > 0:
            parts.append("{0}@{1}".format(fmt_num(m), fmt_num(d)))
    return "; ".join(parts)


def write_loads(inst, loads):
    # clear all slots first
    for i in range(1, MAXN + 1):
        set_val(inst, "ARE_J_P{0}_Mag".format(i), 0.0)
        set_val(inst, "ARE_J_P{0}_Dist".format(i), 0.0)
    callout_parts = []
    for idx, (mag, dist) in enumerate(loads, start=1):
        set_val(inst, "ARE_J_P{0}_Mag".format(idx), mag)
        set_val(inst, "ARE_J_P{0}_Dist".format(idx), dist)   # internal feet
        callout_parts.append("P{0}={1}k @ {2}".format(idx, fmt_num(mag), ft_in(dist)))
    set_val(inst, CALLOUT, "; ".join(callout_parts))
    set_val(inst, "ARE_J_HasPointLoads", 1 if loads else 0)


def length_warnings(joists, loads):
    """Return list of 'mark: dist > length' warnings (does not block)."""
    warns = []
    for inst in joists:
        L = joist_length_ft(inst)
        if L is None:
            continue
        for mag, dist in loads:
            if dist > L + 1e-6:
                warns.append("{0}: {1} > joist length {2}".format(
                    inst.Id, ft_in(dist), ft_in(L)))
    return warns


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    joists = []
    for eid in uidoc.Selection.GetElementIds():
        el = doc.GetElement(eid)
        try:
            if el is not None and el.LookupParameter(MARKER) is not None:
                joists.append(el)
        except Exception:
            pass

    if not joists:
        forms.alert("Select one or more joists (with the ARE_J_* schema) first.",
                    title="ARE Edit Point Loads")
        return

    # Determine the input string + whether we're clearing.
    if len(joists) == 1:
        default = current_string(joists[0])
        prompt = ("Point loads for this joist as  kips @ feet-from-grid; ...\n"
                  "(e.g. 1.5@6; 0.8@14.5).  Distance is measured from the grid "
                  "you note in the schedule's GRID column.  Blank = clear.")
        ans = forms.ask_for_string(default=default, prompt=prompt,
                                   title="ARE Edit Point Loads")
        if ans is None:
            return
    else:
        choice = forms.CommandSwitchWindow.show(
            ["Apply same loads to all", "Clear all"],
            message="{0} joists selected:".format(len(joists)))
        if not choice:
            return
        if choice == "Clear all":
            ans = ""
        else:
            ans = forms.ask_for_string(
                default="",
                prompt=("Point loads to apply to ALL {0} joists as  "
                        "kips @ feet-from-grid  (e.g. 1.5@6; 0.8@14.5). "
                        "Distance from the grid noted in the GRID column.".format(len(joists))),
                title="ARE Edit Point Loads")
            if ans is None:
                return

    try:
        loads = parse_loads(ans)
    except ValueError as exc:
        forms.alert("Could not read the point loads:\n\n{0}".format(exc),
                    title="ARE Edit Point Loads")
        return

    warns = length_warnings(joists, loads)
    if warns:
        if not forms.alert(
                "Some distances exceed the joist length:\n\n  " +
                "\n  ".join(warns[:10]) +
                "\n\nWrite anyway?",
                title="ARE Edit Point Loads", yes=True, no=True):
            return

    t = Transaction(doc, "ARE Edit Point Loads")
    t.Start()
    try:
        for inst in joists:
            write_loads(inst, loads)
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    if loads:
        summary = "Wrote {0} point load(s) to {1} joist(s):\n  {2}".format(
            len(loads), len(joists),
            "; ".join("P{0}={1}k @ {2}".format(i, fmt_num(m), ft_in(d))
                      for i, (m, d) in enumerate(loads, 1)))
    else:
        summary = "Cleared point loads on {0} joist(s).".format(len(joists))
    forms.alert(summary, title="ARE Edit Point Loads")


if RUNNING_IN_REVIT:
    _reset_log()
    _log(">> running main()")
    try:
        main()
        _log(">> main() finished OK")
    except Exception:
        tb = traceback.format_exc()
        _log(">> EXCEPTION:\n" + tb)
        try:
            forms.alert("Edit Point Loads error:\n\n" + tb,
                        title="ARE Edit Point Loads -- Traceback")
        except Exception:
            pass
