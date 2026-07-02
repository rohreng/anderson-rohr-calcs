# -*- coding: utf-8 -*-
"""
ARE Resolve Spacing -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 2

Infers each joist's tributary spacing from its nearest PARALLEL neighbors and
writes ARE_J_Spacing (Length) + ARE_J_Spacing_Source (text) + ARE_J_Calc_Date.

Method (geometry, works regardless of beam systems):
  * get each joist's axis (midpoint + horizontal direction),
  * for each joist, look at parallel joists at a similar elevation,
  * measure the perpendicular gap to the nearest neighbor on each side,
  * spacing = average of the two gaps (interior) or the single gap (edge),
  * flag "Missing" if no parallel neighbor is found.

Shows a preview (a spacing histogram + edge/missing counts) before writing.
Re-runnable. Writes only instance parameters -- no geometry changes.

CPython note: family/type via BuiltInParameter, instance params via
LookupParameter; never FamilyInstance.Symbol. XYZ math uses methods (Add/
Subtract/Multiply/DotProduct/CrossProduct) not operators, for engine safety.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_resolve_spacing.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Resolve Spacing log\n")
    except Exception:
        pass


try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        FilteredElementCollector,
        Transaction,
        XYZ,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
    from pyrevit import forms, script

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SPACING_PARAM = "ARE_J_Spacing"
SOURCE_PARAM = "ARE_J_Spacing_Source"
DATE_PARAM = "ARE_J_Calc_Date"

PARALLEL_DOT = 0.999     # |d_i . d_j| above this => parallel (~2.5 deg)
Z_TOL_FT = 2.0           # only compare joists within this elevation band
MIN_GAP_FT = 0.25        # ignore neighbors closer than this (duplicates)
MAX_GAP_FT = 30.0        # ignore "neighbors" farther than this


def now_stamp():
    try:
        from System import DateTime
        return DateTime.Now.ToString("yyyy-MM-dd HH:mm")
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Joist axis extraction (CPython-safe with bounding-box fallback)
# ---------------------------------------------------------------------------


def joist_axis(inst):
    """Return (mid XYZ, unit horizontal dir XYZ, z, half_len_ft, method) or None.

    method is 'curve' (reliable) or 'bbox' (axis-aligned guess -- tagged in the
    source so skewed framing is visible for review).
    """
    # Preferred: location curve, duck-typed (pythonnet isinstance vs Revit
    # interfaces is unreliable; getattr avoids over-falling-back to bbox).
    try:
        loc = inst.Location
        curve = getattr(loc, "Curve", None)
        if curve is not None:
            p0 = curve.GetEndPoint(0)
            p1 = curve.GetEndPoint(1)
            v = p1.Subtract(p0)
            d = XYZ(v.X, v.Y, 0.0)            # flatten to plan for spacing
            if d.GetLength() > 1e-6:
                mid = p0.Add(p1).Multiply(0.5)
                return mid, d.Normalize(), mid.Z, d.GetLength() / 2.0, "curve"
    except Exception:
        pass
    # Fallback: bounding box, axis-aligned guess.
    try:
        bb = inst.get_BoundingBox(None)
        if bb is not None:
            mn = bb.Min
            mx = bb.Max
            mid = mn.Add(mx).Multiply(0.5)
            dx = mx.X - mn.X
            dy = mx.Y - mn.Y
            if dx >= dy:
                return mid, XYZ(1.0, 0.0, 0.0), mid.Z, dx / 2.0, "bbox"
            return mid, XYZ(0.0, 1.0, 0.0), mid.Z, dy / 2.0, "bbox"
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Collect joists + axes
# ---------------------------------------------------------------------------


def collect_joists(doc):
    """Return list of dicts: {inst, mid, dir, z} for joists with the schema."""
    out = []
    for inst in (FilteredElementCollector(doc)
                 .OfCategory(BuiltInCategory.OST_StructuralFraming)
                 .WhereElementIsNotElementType()):
        try:
            if inst.LookupParameter(SPACING_PARAM) is None:
                continue
        except Exception:
            continue
        ax = joist_axis(inst)
        if ax is None:
            out.append({"inst": inst, "mid": None, "dir": None, "z": None,
                        "half": 0.0, "method": None})
            continue
        mid, d, z, half, method = ax
        out.append({"inst": inst, "mid": mid, "dir": d, "z": z,
                    "half": half, "method": method})
    return out


# ---------------------------------------------------------------------------
# Spacing inference
# ---------------------------------------------------------------------------


def infer_spacing(j, others):
    """Return (spacing_ft or None, source_text)."""
    if j["mid"] is None:
        return None, "Missing (no geometry)"

    mid = j["mid"]
    d = j["dir"]
    z = j["z"]
    # In-plane perpendicular to the joist run.
    perp = XYZ.BasisZ.CrossProduct(d)
    if perp.GetLength() < 1e-6:
        return None, "Missing (vertical?)"
    perp = perp.Normalize()

    offsets = []
    for o in others:
        if o is j or o["mid"] is None:
            continue
        if abs(o["z"] - z) > Z_TOL_FT:
            continue
        if abs(d.DotProduct(o["dir"])) < PARALLEL_DOT:
            continue
        diff = o["mid"].Subtract(mid)
        # Require overlap ALONG the run -- otherwise a parallel joist in a
        # different bay (same axis, far down the line) is a false neighbor.
        along = diff.DotProduct(d)
        if abs(along) > (j["half"] + o["half"]):
            continue
        off = diff.DotProduct(perp)
        if abs(off) < MIN_GAP_FT or abs(off) > MAX_GAP_FT:
            continue
        offsets.append(off)

    neg = [o for o in offsets if o < 0]
    pos = [o for o in offsets if o > 0]
    gap_left = abs(max(neg)) if neg else None      # nearest below
    gap_right = min(pos) if pos else None          # nearest above

    if gap_left is not None and gap_right is not None:
        sp, src = (gap_left + gap_right) / 2.0, "Inferred"
    elif gap_left is not None:
        sp, src = gap_left, "Inferred (edge)"
    elif gap_right is not None:
        sp, src = gap_right, "Inferred (edge)"
    else:
        return None, "Missing (no neighbor)"

    if j.get("method") == "bbox":
        src += " bbox-dir"   # axis guessed from bounding box -- review skewed
    return sp, src


def ft_inch(ft):
    if ft is None:
        return "-"
    inches_total = int(round(ft * 12.0))
    return "{0}'-{1}\"".format(inches_total // 12, inches_total % 12)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    if doc.IsFamilyDocument:
        forms.alert("Run this in a PROJECT.", title="ARE Resolve Spacing")
        return

    joists = collect_joists(doc)
    if not joists:
        forms.alert("No joists with the ARE_J_* schema found. Run "
                    "'Setup Joist Family' first.", title="ARE Resolve Spacing")
        return

    # Infer spacing for each.
    results = []  # (jdict, spacing_ft, source)
    for j in joists:
        sp, src = infer_spacing(j, joists)
        results.append((j, sp, src))

    # Preview histogram by rounded spacing.
    hist = {}
    edge = 0
    missing = 0
    for j, sp, src in results:
        if sp is None:
            missing += 1
            continue
        if src.startswith("Inferred (edge)"):
            edge += 1
        key = ft_inch(sp)
        hist[key] = hist.get(key, 0) + 1

    body = ["Inferred spacing for {0} joists:".format(len(joists)), ""]
    for key in sorted(hist, key=lambda k: hist[k], reverse=True):
        body.append("  {0:<8} x {1}".format(key, hist[key]))
    body.append("")
    body.append("Edge (one neighbor): {0}".format(edge))
    body.append("Missing (no neighbor / no geometry): {0}".format(missing))
    body.append("")
    body.append("Writes ARE_J_Spacing + source. No geometry changes.")

    td = TaskDialog("ARE -- Resolve Spacing")
    td.MainInstruction = "Write inferred spacing to {0} joists?".format(
        len(joists) - missing)
    td.MainContent = "\n".join(body)
    td.CommonButtons = TaskDialogCommonButtons.Yes | TaskDialogCommonButtons.No
    td.DefaultButton = TaskDialogResult.No
    if td.Show() != TaskDialogResult.Yes:
        return

    stamp = now_stamp()
    written = 0
    flagged = 0
    fail = []

    t = Transaction(doc, "ARE Resolve Spacing")
    t.Start()
    try:
        for j, sp, src in results:
            inst = j["inst"]
            try:
                sp_p = inst.LookupParameter(SPACING_PARAM)
                src_p = inst.LookupParameter(SOURCE_PARAM)
                date_p = inst.LookupParameter(DATE_PARAM)
                if sp is not None and sp_p is not None and not sp_p.IsReadOnly:
                    sp_p.Set(float(sp))   # internal feet
                    written += 1
                else:
                    flagged += 1
                if src_p is not None and not src_p.IsReadOnly:
                    src_p.Set(src)
                if date_p is not None and not date_p.IsReadOnly:
                    date_p.Set(stamp)
            except Exception as exc:
                fail.append("{0}: {1}".format(inst.Id, exc))
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    out = script.get_output()
    out.set_title("ARE -- Resolve Spacing (results)")
    out.print_md("# Resolve Spacing -- results")
    out.print_md(
        "- Joists: **{0}**\n- Spacing written: **{1}**\n"
        "- Flagged (no spacing): **{2}**\n- Write errors: **{3}**".format(
            len(joists), written, flagged, len(fail)))
    out.print_md("## Spacing distribution")
    for key in sorted(hist, key=lambda k: hist[k], reverse=True):
        out.print_md("- {0}: {1}".format(key, hist[key]))
    if fail:
        out.print_md("## Errors")
        for f in fail[:40]:
            out.print_md("- {0}".format(f))
    out.print_md(
        "## Check\nSelect a joist: ARE_J_Spacing should read its o.c. spacing, "
        "and (with project loads set) the ARE_J_*_plf values should now compute. "
        "Edge joists use the single-neighbor gap -- verify a few by eye.")


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
            forms.alert("Resolve Spacing error:\n\n" + tb,
                        title="ARE Resolve Spacing -- Traceback")
        except Exception:
            pass
