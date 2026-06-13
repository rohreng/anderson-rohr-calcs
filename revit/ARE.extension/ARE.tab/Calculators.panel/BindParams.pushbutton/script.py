# -*- coding: utf-8 -*-
"""
ARE Bind Params -- pyRevit pushbutton script
Anderson Rohr Engineering - Phase 3 helper - v1.0

One-click binding of the 11 ARE_* shared parameters as INSTANCE project
parameters on Structural Framing, Structural Columns, and Walls in the active
document. Run once per project before using "Send to Calculator".

Idempotent: re-running refreshes the category set for params that are already
bound (ReInsert) rather than erroring. Reuses the bundled ARE_StructCalc.txt
shared-parameter file so the GUIDs match the SendToCalc button and the web
calc schema exactly.

Python 2/3 compatible (IronPython 2.7 + CPython 3.x). No f-strings.
"""

from __future__ import print_function, unicode_literals

import os

# .NET / Revit API imports -- only resolve inside pyRevit / Revit.
try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        CategorySet,
        Transaction,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons
    from pyrevit import forms

    RUNNING_IN_REVIT = True
except ImportError:
    # Allow py_compile / syntax checking outside Revit.
    RUNNING_IN_REVIT = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Shared-parameter group names as written in ARE_StructCalc.txt.
INPUTS_GROUP_NAME = "ARE Calc Inputs"
WRITEBACK_GROUP_NAME = "ARE Calc Writeback"

# Every ARE_* parameter is bound (as an instance parameter) to these categories.
TARGET_CATEGORY_BICS = (
    "OST_StructuralFraming",   # beams, braces
    "OST_StructuralColumns",   # columns
    "OST_Walls",               # shear walls
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def shared_param_file_path():
    """ARE_StructCalc.txt is bundled alongside this script inside the button."""
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(here, "ARE_StructCalc.txt")


def resolve_palette_group(group_name):
    """
    Return a Properties-palette grouping identifier appropriate to the running
    Revit version: Inputs -> Data, Writeback -> Identity Data.

    Revit 2022+ deprecates BuiltInParameterGroup in favour of GroupTypeId
    (a ForgeTypeId). Try the modern API first, then the legacy enum, then give
    up (None -> caller uses the 2-argument Insert with a default group).
    """
    want_identity = (group_name == WRITEBACK_GROUP_NAME)

    # Revit 2022+ : GroupTypeId (ForgeTypeId)
    try:
        from Autodesk.Revit.DB import GroupTypeId
        return GroupTypeId.IdentityData if want_identity else GroupTypeId.Data
    except Exception:
        pass

    # Revit <= 2023 : BuiltInParameterGroup (deprecated but still present)
    try:
        from Autodesk.Revit.DB import BuiltInParameterGroup
        return (BuiltInParameterGroup.PG_IDENTITY_DATA
                if want_identity else BuiltInParameterGroup.PG_DATA)
    except Exception:
        return None


def build_category_set(doc):
    """CategorySet of the three target structural categories that exist here."""
    cats = CategorySet()
    categories = doc.Settings.Categories
    added = []
    for bic_name in TARGET_CATEGORY_BICS:
        bic = getattr(BuiltInCategory, bic_name)
        try:
            cat = categories.get_Item(bic)
        except Exception:
            cat = None
        if cat is not None:
            cats.Insert(cat)
            added.append(cat.Name)
    return cats, added


def insert_or_update(bindings, definition, binding, palette_group):
    """
    Insert a fresh binding, or ReInsert to refresh the category set if the
    parameter is already bound. Returns 'added', 'updated', or 'failed'.
    """
    exists = bindings.Contains(definition)

    def _do(grouped):
        if grouped and palette_group is not None:
            return (bindings.ReInsert(definition, binding, palette_group)
                    if exists else
                    bindings.Insert(definition, binding, palette_group))
        return (bindings.ReInsert(definition, binding)
                if exists else
                bindings.Insert(definition, binding))

    try:
        ok = _do(True)
    except Exception:
        # Fall back to the simplest 2-argument form across API versions.
        try:
            ok = _do(False)
        except Exception:
            return "failed"

    if not ok:
        return "failed"
    return "updated" if exists else "added"


def bind_all(doc, app):
    """
    Core worker. Returns (results, category_names, error_string).
    results: list of (param_name, group_name, status).
    """
    sp_path = shared_param_file_path()
    if not os.path.isfile(sp_path):
        return None, None, (
            "Shared-parameter file not found next to this button:\n  {}\n\n"
            "It should ship inside ARE.extension. Re-copy the extension from "
            "the repo's revit/ folder.".format(sp_path)
        )

    # Point Revit at our shared-param file; restore the user's setting after.
    original_sp = app.SharedParametersFilename
    results = []
    cat_names = []
    try:
        app.SharedParametersFilename = sp_path
        def_file = app.OpenSharedParameterFile()
        if def_file is None:
            return None, None, (
                "Revit could not open the shared-parameter file:\n  {}".format(sp_path)
            )

        cats, cat_names = build_category_set(doc)
        if cats.IsEmpty:
            return None, None, (
                "None of the target structural categories "
                "(Structural Framing / Columns / Walls) exist in this document."
            )

        bindings = doc.ParameterBindings

        t = Transaction(doc, "Bind ARE Calc Parameters")
        t.Start()
        try:
            for group in def_file.Groups:
                palette_group = resolve_palette_group(group.Name)
                for definition in group.Definitions:
                    # A fresh InstanceBinding per parameter.
                    binding = app.Create.NewInstanceBinding(cats)
                    status = insert_or_update(
                        bindings, definition, binding, palette_group)
                    results.append((definition.Name, group.Name, status))
            t.Commit()
        except Exception as exc:
            t.RollBack()
            return None, None, "Binding transaction failed:\n{}".format(exc)
    finally:
        try:
            app.SharedParametersFilename = original_sp
        except Exception:
            pass

    return results, cat_names, None

# ---------------------------------------------------------------------------
# Results dialog
# ---------------------------------------------------------------------------


def show_summary(results, cat_names):
    added = [r for r in results if r[2] == "added"]
    updated = [r for r in results if r[2] == "updated"]
    failed = [r for r in results if r[2] == "failed"]

    lines = []
    lines.append("Bound {} of {} ARE_* parameters as INSTANCE parameters.".format(
        len(added) + len(updated), len(results)))
    lines.append("Categories: {}".format(
        ", ".join(cat_names) if cat_names else "(none)"))
    lines.append("")
    lines.append("Added:   {}".format(len(added)))
    lines.append("Updated: {}".format(len(updated)))
    if failed:
        lines.append("Failed:  {}".format(len(failed)))
    lines.append("")
    for name, group, status in results:
        lines.append("  {0:<14} [{1}]  {2}".format(name, group, status))

    td = TaskDialog("ARE -- Bind Calc Parameters")
    td.MainInstruction = (
        "ARE calc parameters bound" if not failed else "Bound with some failures")
    td.MainContent = "\n".join(lines)
    td.CommonButtons = TaskDialogCommonButtons.Ok
    td.Show()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    try:
        uidoc = __revit__.ActiveUIDocument  # noqa: F821
        doc = uidoc.Document
        app = __revit__.Application         # noqa: F821
    except Exception:
        forms.alert(
            "Could not get the active Revit document.\n"
            "Open a project, then click Bind ARE Params.",
            title="ARE Bind Params -- Error",
        )
        return

    results, cat_names, err = bind_all(doc, app)
    if err:
        forms.alert(err, title="ARE Bind Params -- Error")
        return

    show_summary(results, cat_names)


# Run when pyRevit executes this script.
if RUNNING_IN_REVIT:
    main()
