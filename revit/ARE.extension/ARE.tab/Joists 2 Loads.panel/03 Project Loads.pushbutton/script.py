# -*- coding: utf-8 -*-
"""
ARE Set Project Loads -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 2

Enter the project-level PSF loads once (D / Lr / L / S / W). This:
  * creates (or updates) 5 global parameters: ARE_G_DL_psf ... ARE_G_Wind_psf,
  * associates each global to the matching ARE_J_*_psf INSTANCE parameter on
    every joist that carries the joist-loading schema.

Result: the joist family formulas turn PSF x spacing into live line loads, and
changing a load in one place (the global) updates every joist with no script.

Idempotent. Shows a preview before committing. Writes only to the active doc.
Python 2/3 compatible. CPython note: family/type read via BuiltInParameter and
instance params via LookupParameter -- never FamilyInstance.Symbol.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_set_project_loads.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Set Project Loads log\n")
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
        Transaction,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
    from pyrevit import forms, script

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

# ---------------------------------------------------------------------------
# Configuration: (label, global name, joist instance param)
# ---------------------------------------------------------------------------

LOADS = [
    ("Roof dead D",   "ARE_G_DLroof_psf",  "ARE_J_DLroof_psf"),
    ("Floor dead D",  "ARE_G_DLfloor_psf", "ARE_J_DLfloor_psf"),
    ("Roof live Lr",  "ARE_G_Lr_psf",      "ARE_J_Lr_psf"),
    ("Live L",        "ARE_G_LL_psf",      "ARE_J_LL_psf"),
    ("Snow S",        "ARE_G_Snow_psf",    "ARE_J_Snow_psf"),
    ("Wind uplift W interior Z1 (ULT)", "ARE_G_Wind_psf",  "ARE_J_WindULT_psf"),
    ("Wind uplift W edge Z2 (ULT)",     "ARE_G_Wind2_psf", "ARE_J_Wind2ULT_psf"),
    ("Wind downward (ULT)", "ARE_G_WindDown_psf", "ARE_J_WindDownULT_psf"),
    ("Solar (dead)",  "ARE_G_Solar_psf",    "ARE_J_Solar_psf"),
]

# A joist instance is any Structural Framing instance that carries this param.
# Use a permanent param (spacing) as the marker, not a load that may be renamed.
MARKER_PARAM = "ARE_J_Spacing"


def spec_number():
    try:
        from Autodesk.Revit.DB import SpecTypeId
        return SpecTypeId.Number
    except Exception:
        from Autodesk.Revit.DB import ParameterType
        return ParameterType.Number


def eid_int(eid):
    """Integer value of an ElementId -- robust comparison under pythonnet,
    where ElementId '==' can fall back to reference equality."""
    if eid is None:
        return None
    try:
        return eid.IntegerValue
    except Exception:
        try:
            return eid.Value
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------


def find_global(doc, name):
    try:
        gid = GlobalParametersManager.FindByName(doc, name)
    except Exception:
        return None
    if gid is None or gid == ElementId.InvalidElementId:
        return None
    return doc.GetElement(gid)


def read_global_value(gp):
    try:
        pv = gp.GetValue()
        return pv.Value
    except Exception:
        return None


def ensure_global(doc, name, value):
    """Create or update a Number global parameter. Returns its ElementId."""
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


# ---------------------------------------------------------------------------
# Joist discovery
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Association
# ---------------------------------------------------------------------------


def associate(inst, jparam_name, gid):
    """Associate one instance param with a global.
    Returns (status, reason): status in 'set'/'ok'/'fail'."""
    p = inst.LookupParameter(jparam_name)
    if p is None:
        return "fail", "param not found"
    try:
        if p.IsReadOnly:
            return "fail", "param is read-only"
        invalid = eid_int(ElementId.InvalidElementId)
        cur = eid_int(p.GetAssociatedGlobalParameter())
        if cur == eid_int(gid):
            return "ok", ""                       # already on this global
        if cur not in (None, invalid):
            p.DissociateFromGlobalParameter()     # was on a different global
        if p.CanBeAssociatedWithGlobalParameter(gid):
            p.AssociateWithGlobalParameter(gid)
            return "set", ""
        return "fail", "not associable (StorageType={0})".format(p.StorageType)
    except Exception as exc:
        return "fail", str(exc)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    if doc.IsFamilyDocument:
        forms.alert("Run this in a PROJECT.", title="ARE Set Project Loads")
        return

    if not GlobalParametersManager.AreGlobalParametersAllowed(doc):
        forms.alert("Global parameters aren't allowed in this document.",
                    title="ARE Set Project Loads")
        return

    joists = collect_joists(doc)
    if not joists:
        forms.alert("No joists with the ARE_J_* schema found. Run "
                    "'Setup Joist Family' first.", title="ARE Set Project Loads")
        return

    # Prompt for each load, defaulting to the current global value.
    values = []
    for label, gname, jparam in LOADS:
        gp = find_global(doc, gname)
        default = read_global_value(gp)
        default_str = ("%g" % default) if default is not None else "0"
        ans = forms.ask_for_string(
            default=default_str,
            prompt="{0} ({1}) in psf:".format(label, gname),
            title="ARE Set Project Loads")
        if ans is None:
            return  # cancelled
        try:
            values.append(float(ans))
        except Exception:
            forms.alert("'{0}' is not a number. Aborted.".format(ans),
                        title="ARE Set Project Loads")
            return

    # Preview.
    body = ["Set these project loads and associate to {0} joists:".format(len(joists)), ""]
    for (label, gname, jparam), v in zip(LOADS, values):
        body.append("  {0:<16} = {1:g} psf".format(label, v))
    td = TaskDialog("ARE -- Set Project Loads")
    td.MainInstruction = "Apply project loads to {0} joists?".format(len(joists))
    td.MainContent = "\n".join(body)
    td.CommonButtons = TaskDialogCommonButtons.Yes | TaskDialogCommonButtons.No
    td.DefaultButton = TaskDialogResult.No
    if td.Show() != TaskDialogResult.Yes:
        return

    set_count = 0
    ok_count = 0
    fail = []

    t = Transaction(doc, "ARE Set Project Loads")
    t.Start()
    try:
        gids = []
        for (label, gname, jparam), v in zip(LOADS, values):
            gids.append(ensure_global(doc, gname, v))

        for inst in joists:
            for (label, gname, jparam), gid in zip(LOADS, gids):
                r, reason = associate(inst, jparam, gid)
                if r == "set":
                    set_count += 1
                elif r == "ok":
                    ok_count += 1
                else:
                    fail.append("{0} on {1}: {2}".format(jparam, inst.Id, reason))
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    out = script.get_output()
    out.set_title("ARE -- Set Project Loads (results)")
    out.print_md("# Set Project Loads -- results")
    out.print_md(
        "- Globals set: **{0}**\n- Joists: **{1}**\n"
        "- Associations newly set: **{2}**, already current: **{3}**, "
        "failed: **{4}**".format(len(LOADS), len(joists), set_count, ok_count, len(fail)))
    for (label, gname, jparam), v in zip(LOADS, values):
        out.print_md("  - {0} = **{1:g} psf**  ->  {2}".format(gname, v, jparam))
    if fail:
        out.print_md("## Failed associations")
        for f in fail[:40]:
            out.print_md("- {0}".format(f))
        if len(fail) > 40:
            out.print_md("- ...and {0} more".format(len(fail) - 40))
    out.print_md(
        "## Next\nRun **Resolve Spacing** so each joist's PLF computes "
        "(PLF = psf x spacing). Loads are now live -- change a global in "
        "Manage > Global Parameters and every joist updates.")


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
            forms.alert("Set Project Loads error:\n\n" + tb,
                        title="ARE Set Project Loads -- Traceback")
        except Exception:
            pass
