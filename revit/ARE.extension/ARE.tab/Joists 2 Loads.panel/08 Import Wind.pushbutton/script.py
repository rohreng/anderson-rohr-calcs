# -*- coding: utf-8 -*-
"""
ARE Import Wind -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Wind link

Live-links the ARE web wind calculators to the joist load schedule.

Accepts BOTH export schemas:
  * are.cc.wind.v1     (C&C calculator -- the correct ASCE 7-16 methodology
                        for joist member design): Zone 1 interior uplift ->
                        ARE_G_Wind_psf, Zone 2 edge uplift -> ARE_G_Wind2_psf,
                        governing downward -> ARE_G_WindDown_psf. Per-joist
                        zone choice = ARE_J_is_EdgeZone checkbox (manual).
  * are.mwfrs.wind.v1  (MWFRS calculator): governing envelope pressure is
                        written to BOTH zone globals (toggle then neutral).

Actions:
  * Import wind JSON (file)          -- preview old -> new, set the globals.
  * Paste wind JSON (clipboard)      -- same, from "Copy for Revit".
  * Open C&C calc from model         -- median joist span + spacing + h ->
                                        browser, calc pre-filled.
  * Open MWFRS calc from model       -- B / D / mean roof height -> browser.

Because the joist family formulas compute
  Wind_plf = if(is_EdgeZone, Wind2_psf, Wind_psf) x spacing
from the globals, setting them updates every joist line load and the
"ARE - Load Schedule" instantly. Idempotent; writes only to the active doc.

CPython notes: BuiltInParameter / LookupParameter only (no .Symbol downcast),
forward-slash paths only, ElementId compared via IntegerValue.
"""

from __future__ import print_function, unicode_literals

import json
import os
import tempfile
import traceback
from datetime import datetime

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_import_wind.log")

SCHEMA_MWFRS = "are.mwfrs.wind.v1"
SCHEMA_CC = "are.cc.wind.v1"
MWFRS_PAGE = "/Calcs/asce716_mwfrs_calculator.html"
CC_PAGE = "/Calcs/asce716_cc_wind_calculator.html"
DEFAULT_BASE_URL = "https://calcs.andersonrohr.com"

# (label, global name, joist instance param, payload key) -- globals must
# match 03 Project Loads; instance params must match the family schema.
WIND_LOADS = [
    ("Wind uplift Z1 (int.)", "ARE_G_Wind_psf", "ARE_J_Wind_psf", "_uplift1"),
    ("Wind uplift Z2 (edge)", "ARE_G_Wind2_psf", "ARE_J_Wind2_psf", "_uplift2"),
    ("Wind downward", "ARE_G_WindDown_psf", "ARE_J_WindDown_psf", "_down"),
]
SOURCE_GLOBAL = "ARE_G_Wind_Source"
MARKER_PARAM = "ARE_J_Spacing"
EDGE_PARAM = "ARE_J_is_EdgeZone"


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Import Wind log\n")
    except Exception:
        pass


try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        BuiltInParameter,
        DoubleParameterValue,
        ElementId,
        FilteredElementCollector,
        GlobalParameter,
        GlobalParametersManager,
        StringParameterValue,
        Transaction,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
    from pyrevit import forms, script

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False


# ---------------------------------------------------------------------------
# Shared helpers (same patterns as 03 Project Loads)
# ---------------------------------------------------------------------------


def spec_number():
    try:
        from Autodesk.Revit.DB import SpecTypeId
        return SpecTypeId.Number
    except Exception:
        from Autodesk.Revit.DB import ParameterType
        return ParameterType.Number


def spec_text():
    try:
        from Autodesk.Revit.DB import SpecTypeId
        return SpecTypeId.String.Text
    except Exception:
        from Autodesk.Revit.DB import ParameterType
        return ParameterType.Text


def eid_int(eid):
    if eid is None:
        return None
    try:
        return eid.IntegerValue
    except Exception:
        try:
            return eid.Value
        except Exception:
            return None


def find_global(doc, name):
    try:
        gid = GlobalParametersManager.FindByName(doc, name)
    except Exception:
        return None
    if gid is None or eid_int(gid) in (None, eid_int(ElementId.InvalidElementId)):
        return None
    return doc.GetElement(gid)


def read_global_value(gp):
    if gp is None:
        return None
    try:
        pv = gp.GetValue()
        return pv.Value
    except Exception:
        return None


def ensure_number_global(doc, name, value):
    gp = find_global(doc, name)
    if gp is None:
        gp = GlobalParameter.Create(doc, name, spec_number())
    try:
        gp.SetValue(DoubleParameterValue(float(value)))
    except Exception:
        raise Exception(
            "Global '{0}' already exists but is not a Number global. "
            "Delete it in Manage > Global Parameters and re-run.".format(name))
    return gp.Id


def ensure_text_global(doc, name, value):
    """Create/update a Text global. Returns error string ('' on success)."""
    try:
        gp = find_global(doc, name)
        if gp is None:
            gp = GlobalParameter.Create(doc, name, spec_text())
        gp.SetValue(StringParameterValue(value))
        return ""
    except Exception as exc:
        return "{0}: {1}".format(name, exc)


def collect_joists(doc):
    out = []
    for inst in (FilteredElementCollector(doc)
                 .OfCategory(BuiltInCategory.OST_StructuralFraming)
                 .WhereElementIsNotElementType()):
        try:
            if inst.LookupParameter(MARKER_PARAM) is not None:
                out.append(inst)
        except Exception:
            pass
    return out


def count_edge_joists(joists):
    n = 0
    for inst in joists:
        try:
            p = inst.LookupParameter(EDGE_PARAM)
            if p is not None and p.AsInteger() == 1:
                n += 1
        except Exception:
            pass
    return n


def associate(inst, jparam_name, gid):
    p = inst.LookupParameter(jparam_name)
    if p is None:
        return "fail", "param not found"
    try:
        if p.IsReadOnly:
            return "fail", "param is read-only"
        invalid = eid_int(ElementId.InvalidElementId)
        cur = eid_int(p.GetAssociatedGlobalParameter())
        if cur == eid_int(gid):
            return "ok", ""
        if cur not in (None, invalid):
            p.DissociateFromGlobalParameter()
        if p.CanBeAssociatedWithGlobalParameter(gid):
            p.AssociateWithGlobalParameter(gid)
            return "set", ""
        return "fail", "not associable (StorageType={0})".format(p.StorageType)
    except Exception as exc:
        return "fail", str(exc)


# ---------------------------------------------------------------------------
# Payload handling
# ---------------------------------------------------------------------------


def parse_payload(text):
    """Returns (payload_dict, error_string). Handles both export schemas.

    Normalizes onto the dict: _schema, _uplift1, _uplift2, _down (all
    positive-magnitude psf floats) plus _zone_notes (list of strings for the
    preview, e.g. governing zone labels and the Zone-3 corner warning)."""
    try:
        data = json.loads(text)
    except Exception as exc:
        return None, "Not valid JSON: {0}".format(exc)
    if not isinstance(data, dict):
        return None, "JSON is not an object."
    schema = data.get("schema")
    if schema not in (SCHEMA_MWFRS, SCHEMA_CC):
        return None, ("Not an ARE wind export (schema is '{0}'). Use the "
                      "calculator's 'Export for Revit' button."
                      .format(schema))
    revit = data.get("revit") or {}
    roof = data.get("roof") or {}
    notes = []
    try:
        if schema == SCHEMA_MWFRS:
            up = revit.get("ARE_G_Wind_psf")
            if up is None and roof.get("governing_uplift_psf") is not None:
                up = abs(float(roof.get("governing_uplift_psf")))
            down = revit.get("ARE_G_WindDown_psf")
            if down is None:
                down = max(0.0, float(roof.get("governing_down_psf") or 0.0))
            up1 = up2 = float(up)
            down = float(down)
            if roof.get("governing_uplift_zone"):
                notes.append("MWFRS governing zone: {0}".format(
                    roof.get("governing_uplift_zone")))
            notes.append("MWFRS envelope: same pressure applied to Z1 and Z2 "
                         "(edge toggle has no effect).")
        else:
            up1 = revit.get("ARE_G_Wind_psf")
            up2 = revit.get("ARE_G_Wind2_psf")
            down = revit.get("ARE_G_WindDown_psf")
            if up1 is None and roof.get("zone1_uplift_psf") is not None:
                up1 = abs(float(roof.get("zone1_uplift_psf")))
            if up2 is None and roof.get("zone2_uplift_psf") is not None:
                up2 = abs(float(roof.get("zone2_uplift_psf")))
            if down is None:
                down = max(0.0, float(roof.get("governing_down_psf") or 0.0))
            up1 = float(up1)
            up2 = float(up2)
            down = float(down)
            # Fail closed: a C&C export with no roof figure selected carries
            # zeroed roof buckets -- importing that would silently zero out
            # the joist wind loads.
            if up1 == 0 or up2 == 0:
                return None, (
                    "The C&C export has no roof Zone 1 / Zone 2 pressures "
                    "(Z1={0:g}, Z2={1:g}). In the calculator, select a ROOF "
                    "figure, Calculate, and re-export.".format(up1, up2))
            if roof.get("zone1_label"):
                notes.append("Z1 interior governed by: {0}".format(
                    roof.get("zone1_label")))
            if roof.get("zone2_label"):
                notes.append("Z2 edge governed by: {0}".format(
                    roof.get("zone2_label")))
            z3 = roof.get("zone3_uplift_psf")
            if z3 is not None:
                try:
                    z3m = abs(float(z3))
                    if z3m > up2:
                        notes.append(
                            "WARNING: corner Zone 3 uplift ({0:g} psf) exceeds "
                            "Zone 2 ({1:g} psf). Consider raising "
                            "ARE_G_Wind2_psf for corner joists.".format(
                                z3m, up2))
                    else:
                        notes.append("Zone 3 corner: {0:g} psf (does not "
                                     "govern Z2).".format(z3m))
                except Exception:
                    pass
    except Exception:
        return None, "Wind values in the file are not numeric."
    if up1 < 0 or up2 < 0:
        return None, ("Uplift values in the file are negative. The globals "
                      "expect uplift as a positive magnitude -- re-export "
                      "from the calculator.")
    down = max(0.0, down)  # negative downward = no downward case
    data["_schema"] = schema
    data["_uplift1"] = up1
    data["_uplift2"] = up2
    data["_down"] = down
    data["_zone_notes"] = notes
    return data, ""


def payload_source_line(data):
    proj = data.get("project") or {}
    kind = "C&C" if data["_schema"] == SCHEMA_CC else "MWFRS"
    label = proj.get("number") or proj.get("name") or ""
    return ("{0} {1}| exported {2} | Z1 {3:g} / Z2 {4:g} / down {5:g} psf "
            "| imported {6}").format(
        kind,
        (label + " ") if label else "",
        data.get("generatedAt", "?"),
        data["_uplift1"], data["_uplift2"], data["_down"],
        datetime.now().strftime("%Y-%m-%d %H:%M"))


def read_clipboard_text():
    """Clipboard text via WinForms, PowerShell fallback. '' if empty."""
    try:
        clr.AddReference("System.Windows.Forms")
        from System.Windows.Forms import Clipboard
        if Clipboard.ContainsText():
            return Clipboard.GetText()
        return ""
    except Exception as exc:
        _log("WinForms clipboard failed: {0}".format(exc))
    try:
        import subprocess
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"])
        return out.decode("utf-8", "replace")
    except Exception as exc:
        _log("PowerShell clipboard failed: {0}".format(exc))
        return ""


# ---------------------------------------------------------------------------
# Apply wind globals
# ---------------------------------------------------------------------------


def apply_wind(doc, data):
    if not GlobalParametersManager.AreGlobalParametersAllowed(doc):
        forms.alert("Global parameters aren't allowed in this document.",
                    title="ARE Import Wind")
        return

    joists = collect_joists(doc)
    n_edge = count_edge_joists(joists)
    proj = data.get("project") or {}

    # Preview: old -> new.
    lines = ["Source: {0} export{1}".format(
        "C&C (Ch.30)" if data["_schema"] == SCHEMA_CC else "MWFRS (Ch.27)",
        "  " + (proj.get("name") or "") if proj.get("name") else ""),
        "Exported: {0}".format(data.get("generatedAt", "?")), ""]
    for label, gname, jparam, key in WIND_LOADS:
        old = read_global_value(find_global(doc, gname))
        old_s = ("%g" % old) if old is not None else "(not set)"
        lines.append("  {0:<22} {1} -> {2:g} psf".format(
            label, old_s, data[key]))
    for note in data.get("_zone_notes", []):
        lines.append("")
        lines.append(note)
    lines.append("")
    if joists:
        lines.append("{0} joists follow these globals ({1} tagged EDGE Z2, "
                     "{2} interior Z1).".format(
                         len(joists), n_edge, len(joists) - n_edge))
        lines.append("Toggle per joist: ARE_J_is_EdgeZone checkbox "
                     "(or Tag Joists button).")
        if (n_edge == 0 and data["_schema"] == SCHEMA_CC
                and data["_uplift2"] > data["_uplift1"]):
            lines.append("")
            lines.append("WARNING: no joists are tagged Edge Z2 yet -- every "
                         "joist will use the LOWER interior Z1 pressure. Tag "
                         "the perimeter joists after importing.")
    else:
        lines.append("NOTE: no joists with the ARE_J_* schema found -- the "
                     "globals will still be set; run 'Setup Joist Family' "
                     "and 'Project Loads' later.")

    td = TaskDialog("ARE -- Import Wind")
    td.MainInstruction = "Set wind globals from the {0} calc?".format(
        "C&C" if data["_schema"] == SCHEMA_CC else "MWFRS")
    td.MainContent = "\n".join(lines)
    td.CommonButtons = TaskDialogCommonButtons.Yes | TaskDialogCommonButtons.No
    td.DefaultButton = TaskDialogResult.No
    if td.Show() != TaskDialogResult.Yes:
        return

    set_count = 0
    ok_count = 0
    fail = []
    src_err = ""

    t = Transaction(doc, "ARE Import Wind")
    t.Start()
    try:
        gids = []
        for label, gname, jparam, key in WIND_LOADS:
            gids.append(ensure_number_global(doc, gname, data[key]))
        for inst in joists:
            for (label, gname, jparam, key), gid in zip(WIND_LOADS, gids):
                r, reason = associate(inst, jparam, gid)
                if r == "set":
                    set_count += 1
                elif r == "ok":
                    ok_count += 1
                else:
                    fail.append("{0} on {1}: {2}".format(
                        jparam, inst.Id, reason))
        src_err = ensure_text_global(
            doc, SOURCE_GLOBAL, payload_source_line(data))
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    out = script.get_output()
    out.set_title("ARE -- Import Wind (results)")
    out.print_md("# Import Wind -- results")
    out.print_md(
        "- **ARE_G_Wind_psf = {0:g} psf** (Z1 interior)\n"
        "- **ARE_G_Wind2_psf = {1:g} psf** (Z2 edge)\n"
        "- **ARE_G_WindDown_psf = {2:g} psf**\n"
        "- Joists: **{3}** ({4} edge-tagged) | associations newly set: "
        "**{5}**, already current: **{6}**, failed: **{7}**".format(
            data["_uplift1"], data["_uplift2"], data["_down"],
            len(joists), n_edge, set_count, ok_count, len(fail)))
    for note in data.get("_zone_notes", []):
        out.print_md("- {0}".format(note))
    if src_err:
        out.print_md("- Provenance global NOT written: {0}".format(src_err))
    else:
        out.print_md("- {0} = *{1}*".format(
            SOURCE_GLOBAL, payload_source_line(data)))
    if fail:
        out.print_md("## Failed associations")
        for f in fail[:40]:
            out.print_md("- {0}".format(f))
        if len(fail) > 40:
            out.print_md("- ...and {0} more".format(len(fail) - 40))
    out.print_md(
        "## Next\nTag edge joists (Tag Joists > Edge Zone, or the "
        "ARE_J_is_EdgeZone checkbox) -- every joist's Wind / NetUplift PLF "
        "and the 'ARE - Load Schedule' update live. Re-run **Assign Marks** "
        "so zone-split marks regroup.")


# ---------------------------------------------------------------------------
# Open a calculator pre-filled from model geometry
# ---------------------------------------------------------------------------


def _config_base_url():
    user = os.environ.get("USERNAME", "")
    candidates = [
        (os.environ.get("APPDATA", "") + "/ARE/calc_config.json"),
        "C:/Users/{0}/AppData/Roaming/ARE/calc_config.json".format(user),
        "C:/ProgramData/ARE/calc_config.json",
    ]
    for path in candidates:
        p = path.replace("\\", "/")
        try:
            if p and os.path.exists(p):
                with open(p, "r") as fh:
                    cfg = json.load(fh)
                base = (cfg.get("base_url") or "").rstrip("/")
                if base:
                    return base
        except Exception as exc:
            _log("config read failed {0}: {1}".format(p, exc))
    return DEFAULT_BASE_URL


def _is_roof_joist(inst):
    try:
        p = inst.LookupParameter("ARE_J_is_Roof")
        return p is not None and p.AsInteger() == 1
    except Exception:
        return False


def _median(vals):
    if not vals:
        return None
    s = sorted(vals)
    n = len(s)
    mid = n // 2
    if n % 2:
        return s[mid]
    return (s[mid - 1] + s[mid]) / 2.0


def model_geometry(doc, joists):
    """(B_ft, D_ft, h_ft) from the joists' bounding boxes; None on failure.

    Plan extents use ALL joists (footprint, model X/Y axes); mean roof
    height uses only roof-tagged joists (ARE_J_is_Roof) so floor joists
    don't drag the average down -- falls back to all if none are tagged.
    """
    min_x = min_y = 1e30
    max_x = max_y = -1e30
    z_all = []
    z_roof = []
    for inst in joists:
        try:
            bb = inst.get_BoundingBox(None)
            if bb is None:
                continue
            mn, mx = bb.Min, bb.Max
            if mn.X < min_x:
                min_x = mn.X
            if mn.Y < min_y:
                min_y = mn.Y
            if mx.X > max_x:
                max_x = mx.X
            if mx.Y > max_y:
                max_y = mx.Y
            zm = (mn.Z + mx.Z) / 2.0
            z_all.append(zm)
            if _is_roof_joist(inst):
                z_roof.append(zm)
        except Exception:
            pass
    if not z_all or max_x <= min_x or max_y <= min_y:
        return None
    b = max_x - min_x
    d = max_y - min_y
    z_mids = z_roof if z_roof else z_all
    h = sum(z_mids) / len(z_mids)
    return (round(b * 2) / 2.0, round(d * 2) / 2.0, max(0.5, round(h * 2) / 2.0))


def joist_span_spacing(joists):
    """(median_span_ft, median_spacing_ft) from the modeled joists.
    Prefers roof-tagged joists; falls back to all. Either value may be None."""
    pool = [j for j in joists if _is_roof_joist(j)] or joists
    spans = []
    spacings = []
    for inst in pool:
        try:
            p = inst.get_Parameter(BuiltInParameter.INSTANCE_LENGTH_PARAM)
            if p is not None:
                v = p.AsDouble()
                if v and v > 0:
                    spans.append(v)
        except Exception:
            pass
        try:
            sp = inst.LookupParameter(MARKER_PARAM)
            if sp is not None:
                v = sp.AsDouble()
                if v and v > 0:
                    spacings.append(v)
        except Exception:
            pass
    return _median(spans), _median(spacings)


def _prompt_floats(prompts, note, title):
    """Sequential numeric prompts. Returns list of floats or None."""
    vals = []
    for label, dv in prompts:
        ans = forms.ask_for_string(
            default="%g" % dv,
            prompt="{0}\n({1} -- edit if needed):".format(label, note),
            title=title)
        if ans is None:
            return None
        try:
            vals.append(float(ans))
        except Exception:
            forms.alert("'{0}' is not a number. Aborted.".format(ans),
                        title="ARE Import Wind")
            return None
    return vals


def _open_url(url):
    _log("opening: " + url)
    try:
        import webbrowser
        webbrowser.open(url)
    except Exception:
        os.startfile(url)  # noqa: startfile is Windows-only, fine here


def _urlencode(params):
    try:
        from urllib.parse import urlencode
    except ImportError:
        from urllib import urlencode
    return urlencode(params)


def open_mwfrs_calc(doc):
    joists = collect_joists(doc)
    geo = model_geometry(doc, joists) if joists else None
    defaults = geo or (60.0, 120.0, 20.0)
    note = ("Read from {0} modeled joists".format(len(joists)) if geo
            else "No ARE joists found -- using generic defaults")

    vals = _prompt_floats([
        ("Building width B (ft, plan X extent)", defaults[0]),
        ("Building depth D (ft, plan Y extent)", defaults[1]),
        ("Mean roof height h (ft, avg joist elevation)", defaults[2]),
    ], note, "ARE Import Wind -- Send Geometry (MWFRS)")
    if vals is None:
        return

    params = {"B": "%g" % vals[0], "D": "%g" % vals[1], "h": "%g" % vals[2]}
    try:
        info = doc.ProjectInformation
        if info.Name:
            params["projName"] = info.Name
        if info.Number:
            params["projNum"] = info.Number
    except Exception:
        pass
    _open_url(_config_base_url() + MWFRS_PAGE + "?" + _urlencode(params))
    forms.alert(
        "Opened the MWFRS wind calc pre-filled with B={0:g} ft, D={1:g} ft, "
        "h={2:g} ft.\n\nMWFRS is for the lateral system (diaphragms, base "
        "shear). For JOIST member design pressures use the C&C calculator "
        "instead (ASCE 7-16 Ch.30).\n\nIn the calc: review, Calculate, "
        "'Export for Revit', then run this button again to import."
        .format(vals[0], vals[1], vals[2]),
        title="ARE Import Wind")


def open_cc_calc(doc):
    joists = collect_joists(doc)
    span = spacing = None
    h = 20.0
    if joists:
        span, spacing = joist_span_spacing(joists)
        geo = model_geometry(doc, joists)
        if geo:
            h = geo[2]
    note = ("Read from {0} modeled joists".format(len(joists))
            if joists and span else
            "No ARE joist data found -- edit these defaults")

    vals = _prompt_floats([
        ("Joist span L (ft, median modeled length)", span or 40.0),
        ("Tributary width / spacing (ft)", spacing or 5.0),
        ("Mean roof height h (ft)", h),
    ], note, "ARE Import Wind -- Send Geometry (C&C)")
    if vals is None:
        return

    params = {
        "spanL": "%g" % vals[0],
        "tribW": "%g" % vals[1],
        "h": "%g" % vals[2],
        # Low-slope roof figure default so the export carries roof zones;
        # the engineer changes it in the calc if the roof differs.
        "roofFig": "30.3-2A",
    }
    _open_url(_config_base_url() + CC_PAGE + "?" + _urlencode(params))
    forms.alert(
        "Opened the C&C wind calc pre-filled with span={0:g} ft, "
        "trib={1:g} ft, h={2:g} ft (effective wind area computes in the "
        "calc, incl. the span/3 minimum width).\n\nIn the calc: pick the "
        "roof figure, review inputs, Calculate, then 'Export for Revit' "
        "and run this button again to import. Zone 1 -> interior joists, "
        "Zone 2 -> edge joists (ARE_J_is_EdgeZone).".format(
            vals[0], vals[1], vals[2]),
        title="ARE Import Wind")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    if doc.IsFamilyDocument:
        forms.alert("Run this in a PROJECT.", title="ARE Import Wind")
        return

    opts = [
        "Import wind JSON (file)",
        "Paste wind JSON (clipboard)",
        "Open C&C calc from model (joist design)",
        "Open MWFRS calc from model (lateral system)",
    ]
    choice = forms.CommandSwitchWindow.show(
        opts, message="ARE Import Wind -- link the wind calcs:")
    if not choice:
        return

    if choice == opts[2]:
        open_cc_calc(doc)
        return
    if choice == opts[3]:
        open_mwfrs_calc(doc)
        return

    if choice == opts[0]:
        path = forms.pick_file(file_ext="json")
        if not path:
            return
        path = path.replace("\\", "/")
        try:
            with open(path, "r") as fh:
                text = fh.read()
        except Exception as exc:
            forms.alert("Could not read file:\n{0}".format(exc),
                        title="ARE Import Wind")
            return
    else:
        text = read_clipboard_text()
        if not (text or "").strip():
            forms.alert("Clipboard is empty. In the wind calc, click "
                        "'Copy for Revit' first.", title="ARE Import Wind")
            return

    data, err = parse_payload(text)
    if err:
        forms.alert(err, title="ARE Import Wind")
        return

    apply_wind(doc, data)


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
            forms.alert("Import Wind error:\n\n" + tb,
                        title="ARE Import Wind -- Traceback")
        except Exception:
            pass
