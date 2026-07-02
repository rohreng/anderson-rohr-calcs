# -*- coding: utf-8 -*-
"""
ARE Assign Load Marks -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 3 (SJI schedule)

Clusters joists into unique LOADING groups and writes an SJI-style load mark
(J1, J2.../G1... for girders) to ARE_J_LoadMark, so the load schedule shows one
row per unique loading instead of one per joist. Also writes ARE_J_LoadKey (the
signature, for QA), ARE_J_Axial_k (governing = max|wind|,|seismic|), and
ARE_J_Remarks ("Wind"/"Seismic"/"Wind/Seismic").

Two modes:
  Preserve  -- keep existing J#/G# for unchanged loading; new loading gets the
               next free number (safe once drawings reference the marks).
  Renumber  -- re-derive all marks cleanly from scratch (J1 = shallowest/lightest).

Cluster key = type + depth + DL_plf + governing-live + wind-down + net-uplift +
point-load signature + axial. Values are already rounded (to 5 plf), so grouping
is stable.

CPython note: names/type via BuiltInParameter; type params via GetTypeId; no
FamilyInstance.Symbol.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_assign_marks.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Assign Load Marks log\n")
    except Exception:
        pass


try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        BuiltInParameter,
        FilteredElementCollector,
        Transaction,
    )
    from pyrevit import forms, script

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

MARKER = "ARE_J_wTL_plf"   # present on joists after Setup


# ---------------------------------------------------------------------------
# Param reads (CPython-safe)
# ---------------------------------------------------------------------------


def getd(inst, name):
    try:
        p = inst.LookupParameter(name)
        return p.AsDouble() if p is not None else 0.0
    except Exception:
        return 0.0


def set_str(inst, name, value):
    p = inst.LookupParameter(name)
    if p is None or p.IsReadOnly:
        return False
    try:
        p.Set(value)
        return True
    except Exception:
        return False


def set_num(inst, name, value):
    p = inst.LookupParameter(name)
    if p is None or p.IsReadOnly:
        return False
    try:
        p.Set(value)
        return True
    except Exception:
        return False


def set_if_blank(inst, name, value):
    """Pre-fill a text param only if it's currently empty (preserve manual edits)."""
    p = inst.LookupParameter(name)
    if p is None or p.IsReadOnly or not value:
        return
    try:
        if not (p.AsString() or ""):
            p.Set(value)
    except Exception:
        pass


def series_from_family(inst):
    fam = family_name(inst)
    if "dlh" in fam:
        return "DLH"
    if "slh" in fam:
        return "SLH"
    if "lh" in fam:
        return "LH"
    if "k-series" in fam or "k series" in fam or "kseries" in fam:
        return "K"
    return ""


def bip_str(inst, bip):
    try:
        p = inst.get_Parameter(bip)
        return p.AsValueString() if p is not None else None
    except Exception:
        return None


def type_name(inst):
    return bip_str(inst, BuiltInParameter.ELEM_TYPE_PARAM) or "(type)"


def family_name(inst):
    return (bip_str(inst, BuiltInParameter.ELEM_FAMILY_PARAM) or "").lower()


def depth_in(doc, inst):
    try:
        typ = doc.GetElement(inst.GetTypeId())
        if typ is not None:
            p = typ.LookupParameter("Depth")
            if p is not None:
                return int(round(p.AsDouble() * 12.0))
    except Exception:
        pass
    return 0


def pointload_sig(inst):
    pls = []
    for i in range(1, 6):
        m = getd(inst, "ARE_J_P{0}_Mag".format(i))
        d = getd(inst, "ARE_J_P{0}_Dist".format(i))
        if m > 0:
            pls.append((round(m, 2), int(round(d * 12.0))))
    pls.sort()
    if not pls:
        return "--"
    return ";".join("{0:g}@{1}in".format(m, di) for m, di in pls)


# ---------------------------------------------------------------------------
# Build per-joist load record
# ---------------------------------------------------------------------------


def build_record(doc, inst):
    axw = getd(inst, "ARE_J_Axial_Wind_k")
    axe = getd(inst, "ARE_J_Axial_Seismic_k")
    axial = max(abs(axw), abs(axe))
    if abs(axe) > abs(axw) + 1e-6:
        rem = "Seismic"
    elif abs(axw) > abs(axe) + 1e-6:
        rem = "Wind"
    elif axial > 1e-6:
        rem = "Wind/Seismic"
    else:
        rem = ""

    dep = depth_in(doc, inst)
    dl = int(round(getd(inst, "ARE_J_DL_plf")))
    ll = int(round(getd(inst, "ARE_J_wLL_plf")))
    wd = int(round(getd(inst, "ARE_J_WindDown_plf")))
    up = int(round(getd(inst, "ARE_J_NetUplift_plf")))
    sig = pointload_sig(inst)
    wtl = int(round(getd(inst, "ARE_J_wTL_plf")))

    # Point-loaded joists get a "SEE SPECIAL SCHED" note in the main schedule
    # REMARKS (combined with any Wind/Seismic axial note).
    if sig != "--":
        rem = (rem + "; SEE SPECIAL SCHED") if rem else "SEE SPECIAL SCHED"

    # Cluster by DEPTH + loading (not the modeled type name) -- the engineer
    # specifies the final series (K/KSP/LH/DLH) per mark in the schedule.
    key = ("D={0}|DL={1}|LL={2}|WD={3}|UP={4}|ADD={5}|AXW={6:.1f}|AXE={7:.1f}"
           .format(dep, dl, ll, wd, up, sig, axw, axe))

    prefix = "G" if "girder" in family_name(inst) else "J"
    old = ""
    try:
        p = inst.LookupParameter("ARE_J_LoadMark")
        if p is not None:
            old = p.AsString() or ""
    except Exception:
        pass

    # A joist with no gravity total, no point loads, and no axial is "unloaded".
    loaded = (wtl > 0) or (sig != "--") or (axial > 1e-6)

    return {
        "inst": inst, "key": key, "prefix": prefix, "old": old,
        "axial": axial, "rem": rem, "loaded": loaded,
        "depth": dep, "series": series_from_family(inst),
        "has_pl": sig != "--",
        "sort": (dep, dl, ll, up, wd, sig),
    }


# ---------------------------------------------------------------------------
# Mark assignment
# ---------------------------------------------------------------------------


def assign_marks(records, preserve):
    """Return dict key -> mark. Separate J and G sequences."""
    # Group by prefix then key.
    by_prefix = {}
    for r in records:
        if not r["loaded"]:
            continue
        by_prefix.setdefault(r["prefix"], {}).setdefault(r["key"], r)

    key_to_mark = {}
    for prefix, keys in by_prefix.items():
        # existing key -> mark (only marks with this prefix)
        existing = {}
        if preserve:
            for r in records:
                if r["prefix"] != prefix:
                    continue
                m = r["old"]
                if m.startswith(prefix) and m[len(prefix):].isdigit():
                    existing.setdefault(r["key"], m)

        used_nums = set()
        for m in existing.values():
            try:
                used_nums.add(int(m[len(prefix):]))
            except Exception:
                pass

        # deterministic order: by (depth, DL, LL, UP, WD, sig)
        ordered = sorted(keys.keys(), key=lambda k: keys[k]["sort"])

        # preserve existing, assign new to the rest
        nxt = 1

        def next_free():
            n = 1
            while n in used_nums:
                n += 1
            return n

        for k in ordered:
            if preserve and k in existing:
                key_to_mark[k] = existing[k]
            else:
                n = next_free()
                used_nums.add(n)
                key_to_mark[k] = "{0}{1}".format(prefix, n)
    return key_to_mark


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    joists = []
    for inst in (FilteredElementCollector(doc)
                 .OfCategory(BuiltInCategory.OST_StructuralFraming)
                 .WhereElementIsNotElementType()):
        try:
            if inst.LookupParameter(MARKER) is not None:
                joists.append(inst)
        except Exception:
            pass

    if not joists:
        forms.alert("No joists with the ARE_J_* schema. Run Setup Family first.",
                    title="ARE Assign Load Marks")
        return

    mode = forms.CommandSwitchWindow.show(
        ["Assign (preserve marks)", "Renumber compact"],
        message="{0} joists found. Load-mark mode:".format(len(joists)))
    if not mode:
        return
    preserve = mode.startswith("Assign")

    records = [build_record(doc, j) for j in joists]
    key_to_mark = assign_marks(records, preserve)

    unloaded = 0
    t = Transaction(doc, "ARE Assign Load Marks")
    t.Start()
    try:
        for r in records:
            inst = r["inst"]
            set_num(inst, "ARE_J_Axial_k", r["axial"])
            set_str(inst, "ARE_J_Remarks", r["rem"])
            set_str(inst, "ARE_J_LoadKey", r["key"])
            set_if_blank(inst, "ARE_J_Sched_Depth", str(r["depth"]) if r["depth"] else "")
            set_if_blank(inst, "ARE_J_Sched_Series", r["series"])
            set_num(inst, "ARE_J_HasPointLoads", 1 if r["has_pl"] else 0)
            if r["loaded"]:
                set_str(inst, "ARE_J_LoadMark", key_to_mark.get(r["key"], ""))
            else:
                set_str(inst, "ARE_J_LoadMark", "")
                unloaded += 1
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    # Report.
    out = script.get_output()
    out.set_title("ARE -- Assign Load Marks")
    out.print_md("# Assign Load Marks")
    marks = sorted(set(key_to_mark.values()),
                   key=lambda m: (m[0], int(m[1:]) if m[1:].isdigit() else 0))
    out.print_md("- Joists: **{0}**  |  Load marks: **{1}**  |  Unloaded (blank): **{2}**  |  Mode: **{3}**"
                 .format(len(joists), len(marks), unloaded,
                         "preserve" if preserve else "renumber"))
    # one row per mark
    rev = {}
    for k, m in key_to_mark.items():
        rev[m] = k
    rows = []
    counts = {}
    for r in records:
        if r["loaded"]:
            m = key_to_mark.get(r["key"], "")
            counts[m] = counts.get(m, 0) + 1
    for m in marks:
        rows.append([m, counts.get(m, 0), rev.get(m, "")])
    out.print_table(table_data=rows, columns=["Mark", "Count", "Load key"])
    out.print_md("## Next\nRun **Create Schedule** (or refresh it) -- the SJI Load "
                 "Schedule groups by these marks.")


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
            forms.alert("Assign Load Marks error:\n\n" + tb,
                        title="ARE Assign Load Marks -- Traceback")
        except Exception:
            pass
