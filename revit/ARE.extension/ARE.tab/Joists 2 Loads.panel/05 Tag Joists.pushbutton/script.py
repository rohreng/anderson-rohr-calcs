# -*- coding: utf-8 -*-
"""
ARE Tag Joists -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 2 helper

Select joists in the model, then run this to set their load-category checkboxes:
  * Roof          -> ARE_J_is_Roof = Yes, ARE_J_is_Floor = No
  * Floor         -> ARE_J_is_Floor = Yes, ARE_J_is_Roof = No
  * +Solar        -> ARE_J_has_Solar = Yes (leaves roof/floor as-is)
  * -Solar        -> ARE_J_has_Solar = No
  * Edge Zone Z2  -> ARE_J_is_EdgeZone = Yes (leaves roof/floor/solar as-is)
  * Interior Z1   -> ARE_J_is_EdgeZone = No
  * Clear         -> roof/floor/solar = No (edge zone left as-is)

Roof and Floor are mutually exclusive; Solar and the C&C wind zone are
independent toggles. The family formulas gate each load by these boxes, so
tagging changes the computed PLF live. Edge Zone (Z2) switches the wind uplift
formula from ARE_J_WindULT_psf (interior Z1) to ARE_J_Wind2ULT_psf (edge Z2).

CPython note: instance params via LookupParameter; never FamilyInstance.Symbol.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_tag_joists.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Tag Joists log\n")
    except Exception:
        pass


try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import Transaction
    from pyrevit import forms, script

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

ROOF = "ARE_J_is_Roof"
FLOOR = "ARE_J_is_Floor"
SOLAR = "ARE_J_has_Solar"
EDGE = "ARE_J_is_EdgeZone"
MARKER = ROOF  # an element is a taggable joist if it has this param

# Action -> dict of {param: 0/1} to set. None value = leave unchanged.
# Edge Zone (Z2) / Interior Zone (Z1) toggle ONLY ARE_J_is_EdgeZone; they do not
# disturb the roof/floor mutual exclusion or the solar flag.
ACTIONS = {
    "Roof":     {ROOF: 1, FLOOR: 0},
    "Floor":    {FLOOR: 1, ROOF: 0},
    "+ Solar":  {SOLAR: 1},
    "- Solar":  {SOLAR: 0},
    "Edge Zone (Z2)":     {EDGE: 1},
    "Interior Zone (Z1)": {EDGE: 0},
    "Clear all": {ROOF: 0, FLOOR: 0, SOLAR: 0},
}
ACTION_ORDER = ["Roof", "Floor", "+ Solar", "- Solar",
                "Edge Zone (Z2)", "Interior Zone (Z1)", "Clear all"]


def set_bool(inst, pname, val):
    p = inst.LookupParameter(pname)
    if p is None or p.IsReadOnly:
        return False
    try:
        p.Set(int(val))
        return True
    except Exception:
        return False


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    ids = list(uidoc.Selection.GetElementIds())
    joists = []
    for eid in ids:
        el = doc.GetElement(eid)
        try:
            if el is not None and el.LookupParameter(MARKER) is not None:
                joists.append(el)
        except Exception:
            pass

    if not joists:
        forms.alert(
            "Select one or more joists (that have the ARE_J_* schema) first, "
            "then run Tag Joists.\n\nSelected elements: {0}, of which joists: 0".format(
                len(ids)),
            title="ARE Tag Joists")
        return

    choice = forms.CommandSwitchWindow.show(
        ACTION_ORDER,
        message="Tag {0} selected joist(s) as:".format(len(joists)))
    if not choice:
        return

    sets = ACTIONS[choice]
    changed = 0
    failed = 0

    t = Transaction(doc, "ARE Tag Joists: " + choice)
    t.Start()
    try:
        for inst in joists:
            ok_any = False
            for pname, val in sets.items():
                if set_bool(inst, pname, val):
                    ok_any = True
                else:
                    failed += 1
            if ok_any:
                changed += 1
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    msg = "Tagged {0} joist(s) as '{1}'.".format(changed, choice)
    if failed:
        msg += "\n{0} parameter writes failed (read-only / locked).".format(failed)
    forms.alert(msg, title="ARE Tag Joists")


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
            forms.alert("Tag Joists error:\n\n" + tb,
                        title="ARE Tag Joists -- Traceback")
        except Exception:
            pass
