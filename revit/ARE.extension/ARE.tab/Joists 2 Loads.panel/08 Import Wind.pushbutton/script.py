# -*- coding: utf-8 -*-
"""
ARE Import Wind -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Wind link

Live-links the MWFRS web wind calculator to the joist load schedule.

Three actions:
  * Import wind JSON (file)      -- read the calc's "Export for Revit" JSON,
                                    preview old -> new, then set the
                                    ARE_G_Wind_psf / ARE_G_WindDown_psf globals
                                    (creating + associating them if needed).
  * Paste wind JSON (clipboard)  -- same, from the calc's "Copy for Revit".
  * Open wind calc from model    -- read B / D / mean roof height from the
                                    modeled joists and open the MWFRS calc in
                                    the browser with those inputs pre-filled.

Because the joist family formulas already compute PLF = psf x spacing from the
globals, setting the two wind globals updates every joist line load and the
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

SCHEMA = "are.mwfrs.wind.v1"
CALC_PAGE = "/Calcs/asce716_mwfrs_calculator.html"
DEFAULT_BASE_URL = "https://calcs.andersonrohr.com"

# (label, global name, joist instance param) -- must match 03 Project Loads.
WIND_LOADS = [
    ("Wind uplift W", "ARE_G_Wind_psf", "ARE_J_Wind_psf"),
    ("Wind downward", "ARE_G_WindDown_psf", "ARE_J_WindDown_psf"),
]
SOURCE_GLOBAL = "ARE_G_Wind_Source"
MARKER_PARAM = "ARE_J_Spacing"


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
    """Returns (payload_dict, error_string). Validates schema + wind values."""
    try:
        data = json.loads(text)
    except Exception as exc:
        return None, "Not valid JSON: {0}".format(exc)
    if not isinstance(data, dict):
        return None, "JSON is not an object."
    if data.get("schema") != SCHEMA:
        return None, ("Not an MWFRS Revit export (schema is '{0}', expected "
                      "'{1}'). Use the calc's 'Export for Revit' button."
                      .format(data.get("schema"), SCHEMA))
    revit = data.get("revit") or {}
    roof = data.get("roof") or {}
    try:
        uplift = revit.get("ARE_G_Wind_psf")
        if uplift is None and roof.get("governing_uplift_psf") is not None:
            uplift = abs(float(roof.get("governing_uplift_psf")))
        down = revit.get("ARE_G_WindDown_psf")
        if down is None:
            down = max(0.0, float(roof.get("governing_down_psf") or 0.0))
        uplift = float(uplift)
        down = float(down)
    except Exception:
        return None, "Wind values in the file are not numeric."
    if uplift < 0:
        return None, ("ARE_G_Wind_psf in the file is negative ({0}). The "
                      "global expects uplift as a positive magnitude — "
                      "re-export from the calculator.".format(uplift))
    data["_uplift"] = uplift
    data["_down"] = down
    return data, ""


def payload_source_line(data):
    proj = data.get("project") or {}
    roof = data.get("roof") or {}
    label = proj.get("number") or proj.get("name") or "?"
    return ("MWFRS {0} | exported {1} | uplift {2:g} psf ({3}) | "
            "down {4:g} psf | imported {5}").format(
        label,
        data.get("generatedAt", "?"),
        data["_uplift"],
        roof.get("governing_uplift_zone", "?"),
        data["_down"],
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
    proj = data.get("project") or {}
    roof = data.get("roof") or {}

    # Preview: old -> new.
    lines = ["Wind calc: {0}  {1}".format(
        proj.get("name") or "?", proj.get("number") or ""),
        "Exported: {0}".format(data.get("generatedAt", "?")), ""]
    for (label, gname, jparam), new_v in zip(
            WIND_LOADS, [data["_uplift"], data["_down"]]):
        old = read_global_value(find_global(doc, gname))
        old_s = ("%g" % old) if old is not None else "(not set)"
        lines.append("  {0:<16} {1} -> {2:g} psf".format(label, old_s, new_v))
    if roof.get("governing_uplift_zone"):
        lines.append("")
        lines.append("Governing uplift zone: {0}".format(
            roof.get("governing_uplift_zone")))
    if data["_down"] > 0 and roof.get("governing_down_zone"):
        lines.append("Governing downward zone: {0}".format(
            roof.get("governing_down_zone")))
    lines.append("")
    if joists:
        lines.append("{0} joists will follow these globals "
                     "(PLF = psf x spacing, live).".format(len(joists)))
    else:
        lines.append("NOTE: no joists with the ARE_J_* schema found -- the "
                     "globals will still be set; run 'Setup Joist Family' "
                     "and 'Project Loads' later.")

    td = TaskDialog("ARE -- Import Wind")
    td.MainInstruction = "Set wind globals from the MWFRS calc?"
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
        for (label, gname, jparam), v in zip(
                WIND_LOADS, [data["_uplift"], data["_down"]]):
            gids.append(ensure_number_global(doc, gname, v))
        for inst in joists:
            for (label, gname, jparam), gid in zip(WIND_LOADS, gids):
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
        "- **ARE_G_Wind_psf = {0:g} psf** (uplift magnitude, {1})\n"
        "- **ARE_G_WindDown_psf = {2:g} psf**\n"
        "- Joists: **{3}** | associations newly set: **{4}**, already "
        "current: **{5}**, failed: **{6}**".format(
            data["_uplift"], roof.get("governing_uplift_zone", "n/a"),
            data["_down"], len(joists), set_count, ok_count, len(fail)))
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
        "## Next\nEvery joist's Wind / WindDown / NetUplift PLF and the "
        "'ARE - Load Schedule' update live from these globals. Re-run "
        "**Assign Marks** if net-uplift changes should regroup the marks.")


# ---------------------------------------------------------------------------
# Open the wind calc pre-filled from model geometry
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


def open_wind_calc(doc):
    joists = collect_joists(doc)
    geo = model_geometry(doc, joists) if joists else None
    defaults = geo or (60.0, 120.0, 20.0)
    note = ("Read from {0} modeled joists".format(len(joists)) if geo
            else "No ARE joists found -- using generic defaults")

    prompts = [
        ("Building width B (ft, plan X extent)", defaults[0]),
        ("Building depth D (ft, plan Y extent)", defaults[1]),
        ("Mean roof height h (ft, avg joist elevation)", defaults[2]),
    ]
    vals = []
    for label, dv in prompts:
        ans = forms.ask_for_string(
            default="%g" % dv,
            prompt="{0}\n({1} -- edit if needed):".format(label, note),
            title="ARE Import Wind -- Send Geometry")
        if ans is None:
            return
        try:
            vals.append(float(ans))
        except Exception:
            forms.alert("'{0}' is not a number. Aborted.".format(ans),
                        title="ARE Import Wind")
            return

    proj_name = ""
    proj_num = ""
    try:
        info = doc.ProjectInformation
        proj_name = info.Name or ""
        proj_num = info.Number or ""
    except Exception:
        pass

    try:
        from urllib.parse import urlencode
    except ImportError:
        from urllib import urlencode
    params = {"B": "%g" % vals[0], "D": "%g" % vals[1], "h": "%g" % vals[2]}
    if proj_name:
        params["projName"] = proj_name
    if proj_num:
        params["projNum"] = proj_num
    url = _config_base_url() + CALC_PAGE + "?" + urlencode(params)
    _log("opening: " + url)
    try:
        import webbrowser
        webbrowser.open(url)
    except Exception:
        os.startfile(url)  # noqa: startfile is Windows-only, fine here
    forms.alert(
        "Opened the MWFRS wind calc pre-filled with B={0:g} ft, D={1:g} ft, "
        "h={2:g} ft.\n\nIn the calc: review inputs, Calculate, then "
        "'Export for Revit' (or 'Copy for Revit') and run this button again "
        "to import.".format(vals[0], vals[1], vals[2]),
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
        "Open wind calc from model geometry",
    ]
    choice = forms.CommandSwitchWindow.show(
        opts, message="ARE Import Wind -- link the MWFRS calc:")
    if not choice:
        return

    if choice == opts[2]:
        open_wind_calc(doc)
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
