# -*- coding: utf-8 -*-
"""
ARE Setup Joist Family -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 1 automation

ONE CLICK. Injects the joist-loading schema into the K-series joist families
that are ALREADY loaded in the active project, then reloads them in place so
the existing placed joists pick up the parameters and live formulas WITHOUT
remodeling and WITHOUT manually adding 27 parameters in the Family Editor.

For each target family it:
  * adds the 27 ARE_J_* shared parameters (from the office master shared-param
    file) as INSTANCE parameters, idempotently (skips ones already present;
    reports a conflict if a name exists with a different GUID),
  * adds the non-shared helper ARE_J_ref_1ft (Length) driven by a constant
    formula 1', used to turn the Length spacing into a unitless multiplier,
  * sets the 7 line-load / total / uplift formulas,
  * reloads the family back into the project (overwrite) so the placed
    instances update in place.

Shows a dry-run preview (what it WILL do) before changing anything, and a
summary afterwards. Safe to run multiple times.

Runs on Revit <= 2024 (pyRevit). Do this before migrating the project to
Revit 2025/2026 -- the formulas it bakes in are version-independent and keep
working after upgrade, but pyRevit (and therefore this button) does not run on
2025/2026.

Python 2/3 compatible (IronPython 2.7 + CPython 3.x). No f-strings.
CPython note: this engine does NOT downcast collector results, so family/type
names are read via BuiltInParameter, never FamilyInstance.Symbol.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

# --- diagnostic logging (so failures are visible even if a generic Revit
#     dialog masks the real Python error) ---------------------------------
LOG_PATH = os.path.join(tempfile.gettempdir(), "are_joist_setup.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Setup Joist Family log\n")
    except Exception:
        pass


_log(">> module import reached")

try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        BuiltInParameter,
        Family,
        FilteredElementCollector,
        Transaction,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
    from pyrevit import forms, script

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Office master shared-parameter file (canonical). Falls back to the reference
# copy bundled next to this button if the master can't be found.
MASTER_SP_FILE = (
    "C:/Users/nickh/OneDrive - Rohr Engineering/"
    "Drafting Libraries - Documents/SHARED PARAMETERS.txt"
)

# Shared-parameter groups that hold the joist params (in the .txt file).
SP_GROUPS = ("ARE JOIST INPUTS", "ARE JOIST WRITEBACK")

# Family-name substrings (lower-cased) that identify the target joist families.
TARGET_SUBSTRINGS = ("k-series bar joist",)

# Broader hint used only to *report* joist-ish families that did NOT match the
# strict target list, so a renamed family doesn't get silently missed.
JOISTISH_HINT = "joist"

# Non-shared helper parameter and its constant formula.
HELPER_NAME = "ARE_J_ref_1ft"
HELPER_FORMULA = "1'"

# The 7 managed formulas, in dependency order. (param_name, formula)
FORMULAS = [
    # Loads gated by Yes/No checkboxes (roof loads only when is_Roof, floor live
    # only when is_Floor, solar added to dead only when has_Solar), then each
    # component is rounded UP to the next multiple of 5 plf: roundup(x/5)*5.
    ("ARE_J_DL_plf",
     "roundup(((if(ARE_J_is_Roof, ARE_J_DLroof_psf, 0) "
     "+ if(ARE_J_is_Floor, ARE_J_DLfloor_psf, 0) "
     "+ if(ARE_J_has_Solar, ARE_J_Solar_psf, 0)) "
     "* (ARE_J_Spacing / ARE_J_ref_1ft)) / 5) * 5"),
    ("ARE_J_Lr_plf",
     "roundup((if(ARE_J_is_Roof, ARE_J_Lr_psf, 0) "
     "* (ARE_J_Spacing / ARE_J_ref_1ft)) / 5) * 5"),
    ("ARE_J_LL_plf",
     "roundup((if(ARE_J_is_Floor, ARE_J_LL_psf, 0) "
     "* (ARE_J_Spacing / ARE_J_ref_1ft)) / 5) * 5"),
    ("ARE_J_Snow_plf",
     "roundup((if(ARE_J_is_Roof, ARE_J_Snow_psf, 0) "
     "* (ARE_J_Spacing / ARE_J_ref_1ft)) / 5) * 5"),
    ("ARE_J_Wind_plf",
     "roundup((if(ARE_J_is_Roof, ARE_J_Wind_psf, 0) "
     "* (ARE_J_Spacing / ARE_J_ref_1ft)) / 5) * 5"),
    # Governing live = max(Lr, Snow, LL). Revit has no max() -> nested if().
    ("ARE_J_wLL_plf",
     "if(ARE_J_Lr_plf > ARE_J_Snow_plf, "
     "if(ARE_J_Lr_plf > ARE_J_LL_plf, ARE_J_Lr_plf, ARE_J_LL_plf), "
     "if(ARE_J_Snow_plf > ARE_J_LL_plf, ARE_J_Snow_plf, ARE_J_LL_plf))"),
    # Downward wind (roof), gated + rounded like the other components.
    ("ARE_J_WindDown_plf",
     "roundup((if(ARE_J_is_Roof, ARE_J_WindDown_psf, 0) "
     "* (ARE_J_Spacing / ARE_J_ref_1ft)) / 5) * 5"),
    # Total gravity = dead + governing live (both already rounded to 5).
    ("ARE_J_wTL_plf", "ARE_J_DL_plf + ARE_J_wLL_plf"),
    # Net ASD uplift (negative = uplift). roundup() on a negative rounds toward
    # zero (unconservative), so round the MAGNITUDE away from zero.
    ("ARE_J_wUplift_plf",
     "if((0.6 * ARE_J_DL_plf - ARE_J_Wind_plf) < 0, "
     "rounddown((0.6 * ARE_J_DL_plf - ARE_J_Wind_plf) / 5) * 5, "
     "roundup((0.6 * ARE_J_DL_plf - ARE_J_Wind_plf) / 5) * 5)"),
    # Net uplift as a POSITIVE magnitude for the SJI schedule column.
    ("ARE_J_NetUplift_plf",
     "if(ARE_J_wUplift_plf < 0, -ARE_J_wUplift_plf, 0)"),
]

# Superseded params to remove from the family once formulas no longer reference
# them (e.g. the generic dead load, split into roof/floor dead).
RETIRE_PARAMS = ["ARE_J_DL_psf"]

# Writeback param names get the Identity Data palette group; everything else Data.
WRITEBACK_NAMES = set([
    "ARE_J_DL_plf", "ARE_J_Lr_plf", "ARE_J_LL_plf", "ARE_J_Snow_plf",
    "ARE_J_Wind_plf", "ARE_J_wTL_plf", "ARE_J_wUplift_plf",
    "ARE_J_PointLoad_Callout", "ARE_J_Calc_Status", "ARE_J_Calc_Date",
    "ARE_J_wLL_plf", "ARE_J_WindDown_plf", "ARE_J_NetUplift_plf",
    "ARE_J_Axial_k", "ARE_J_LoadMark", "ARE_J_LoadKey", "ARE_J_Remarks",
    "ARE_J_HasPointLoads",
])

# ---------------------------------------------------------------------------
# Version-robust ForgeTypeId / legacy-enum resolution
# ---------------------------------------------------------------------------


def group_data():
    try:
        from Autodesk.Revit.DB import GroupTypeId
        return GroupTypeId.Data
    except Exception:
        from Autodesk.Revit.DB import BuiltInParameterGroup
        return BuiltInParameterGroup.PG_DATA


def group_identity():
    try:
        from Autodesk.Revit.DB import GroupTypeId
        return GroupTypeId.IdentityData
    except Exception:
        from Autodesk.Revit.DB import BuiltInParameterGroup
        return BuiltInParameterGroup.PG_IDENTITY_DATA


def spec_length():
    try:
        from Autodesk.Revit.DB import SpecTypeId
        return SpecTypeId.Length
    except Exception:
        from Autodesk.Revit.DB import ParameterType
        return ParameterType.Length


def palette_group_for(name):
    return group_identity() if name in WRITEBACK_NAMES else group_data()


def revit_name(elem):
    """Element name, with a pythonnet-safe fallback for inherited Element.Name."""
    try:
        return elem.Name
    except Exception:
        try:
            from Autodesk.Revit.DB import Element
            return Element.Name.GetValue(elem)
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Family load options (reload-with-overwrite)
# ---------------------------------------------------------------------------
# Defined lazily inside a factory so that implementing the .NET interface can
# never crash module import (some pyRevit CPython builds are fragile about
# subclassing a Revit interface at top level).


def make_load_options():
    from Autodesk.Revit.DB import IFamilyLoadOptions, FamilySource

    class _Opts(IFamilyLoadOptions):
        """Overwrite the existing family definition; keep instances in place."""

        def OnFamilyFound(self, familyInUse, overwriteParameterValues):
            try:
                overwriteParameterValues.Value = True
            except Exception:
                pass
            return True

        def OnSharedFamilyFound(self, sharedFamily, familyInUse,
                                source, overwriteParameterValues):
            try:
                source.Value = FamilySource.Family
            except Exception:
                pass
            try:
                overwriteParameterValues.Value = True
            except Exception:
                pass
            return True

    return _Opts()


# ---------------------------------------------------------------------------
# Shared-parameter definitions
# ---------------------------------------------------------------------------


def open_joist_defs(app):
    """Point Revit at the joist shared-param file and collect ExternalDefinitions.

    Returns (defs_by_name, original_sp_path, error). Does NOT restore the
    shared-parameter filename -- ExternalDefinitions are only usable by
    FamilyManager.AddParameter while THEIR shared-parameter file is the active
    one, so the caller must keep it active across all adds and restore at the
    very end.
    """
    sp_path = MASTER_SP_FILE
    if not os.path.isfile(sp_path):
        here = os.path.dirname(os.path.abspath(__file__))
        alt = os.path.join(here, "ARE_JoistLoads.txt")
        if os.path.isfile(alt):
            sp_path = alt

    if not os.path.isfile(sp_path):
        return None, None, None, ("Shared-parameter file not found:\n  {0}".format(MASTER_SP_FILE))

    original = app.SharedParametersFilename
    try:
        app.SharedParametersFilename = sp_path
        def_file = app.OpenSharedParameterFile()
    except Exception as exc:
        return None, None, original, "Could not open shared-parameter file:\n  {0}\n{1}".format(sp_path, exc)

    if def_file is None:
        return None, None, original, "Revit could not open the shared-parameter file:\n  {0}".format(sp_path)

    defs = {}
    for group in def_file.Groups:
        if group.Name in SP_GROUPS:
            for d in group.Definitions:
                defs[d.Name] = d

    if not defs:
        return None, def_file, original, ("No parameters found in groups {0} of:\n  {1}".format(
            ", ".join(SP_GROUPS), sp_path))
    # def_file is returned so main() can keep it referenced -- ExternalDefinitions
    # can be invalidated if the DefinitionFile is garbage-collected.
    return defs, def_file, original, None


# ---------------------------------------------------------------------------
# Target family discovery
# ---------------------------------------------------------------------------


def _fam_name_of_instance(inst):
    try:
        p = inst.get_Parameter(BuiltInParameter.ELEM_FAMILY_PARAM)
        if p is not None:
            return p.AsValueString()
    except Exception:
        pass
    return None


def discover(doc):
    """Return (targets, placed_counts, joistish_other)."""
    # Placed structural framing instances -> family-name counts (CPython-safe).
    placed_counts = {}
    for inst in (FilteredElementCollector(doc)
                 .OfCategory(BuiltInCategory.OST_StructuralFraming)
                 .WhereElementIsNotElementType()):
        fn = _fam_name_of_instance(inst)
        if fn:
            placed_counts[fn] = placed_counts.get(fn, 0) + 1

    # Only families that ACTUALLY have placed structural-framing instances are
    # real modeled joists. This excludes the 2D Detail Item (-Section/-Side) and
    # PROFILE families that share the "K-Series Bar Joist" name.
    placed_names = set(placed_counts.keys())

    targets = []
    joistish_other = []
    for fam in FilteredElementCollector(doc).OfClass(Family):
        name = revit_name(fam)
        if not name:
            continue
        low = name.lower()
        is_target = any(sub in low for sub in TARGET_SUBSTRINGS)
        if is_target and name in placed_names:
            targets.append(fam)
        elif JOISTISH_HINT in low:
            note = "  [no placed framing - skipped]" if is_target else ""
            joistish_other.append(name + note)

    return targets, placed_counts, joistish_other


# ---------------------------------------------------------------------------
# Per-family injection
# ---------------------------------------------------------------------------


def inject_into_family(doc, family, defs):
    """EditFamily -> add params/helper/formulas -> reload. Returns a result dict."""
    res = {
        "family": None, "added": 0, "skipped": 0, "conflicts": [],
        "formulas_set": 0, "reloaded": False, "error": None,
    }
    res["family"] = revit_name(family) or "(family)"

    fam_doc = None
    t = None
    try:
        fam_doc = doc.EditFamily(family)
        fm = fam_doc.FamilyManager

        existing = {}
        for p in fm.Parameters:
            try:
                existing[p.Definition.Name] = p
            except Exception:
                pass

        t = Transaction(fam_doc, "Inject ARE joist parameters")
        t.Start()

        # 1) Shared parameters (idempotent + strict conflict checks).
        for name, d in defs.items():
            if name in existing:
                fp = existing[name]
                # A same-name parameter that is NOT shared is a hard conflict --
                # formulas could otherwise bind to the wrong (rogue) parameter.
                if not getattr(fp, "IsShared", False):
                    res["conflicts"].append(name + " (existing param is not shared)")
                    continue
                try:
                    if str(fp.GUID).lower() != str(d.GUID).lower():
                        res["conflicts"].append(name + " (GUID mismatch)")
                        continue
                except Exception as exc:
                    res["conflicts"].append(name + " (GUID check failed: {0})".format(exc))
                    continue
                res["skipped"] += 1
                continue
            try:
                fm.AddParameter(d, palette_group_for(name), True)
                res["added"] += 1
            except Exception as exc:
                res["conflicts"].append("{0} (add failed: {1})".format(name, exc))

        # 2) Helper parameter -- a constant unit shim, so a TYPE parameter (not
        # instance): same for every joist, no extra editable instance field.
        if HELPER_NAME not in existing:
            try:
                fm.AddParameter(HELPER_NAME, group_data(), spec_length(), False)
            except Exception as exc:
                res["conflicts"].append("{0} (add failed: {1})".format(HELPER_NAME, exc))

        # Re-read parameters after additions.
        params = {}
        for p in fm.Parameters:
            try:
                params[p.Definition.Name] = p
            except Exception:
                pass

        # Set the helper's constant formula (fallback: per-type value 1 ft).
        helper = params.get(HELPER_NAME)
        if helper is not None:
            try:
                if (helper.Formula or "") != HELPER_FORMULA:
                    fm.SetFormula(helper, HELPER_FORMULA)
            except Exception:
                try:
                    for ftype in fm.Types:
                        fm.CurrentType = ftype
                        fm.Set(helper, 1.0)  # 1.0 ft internal (FamilyManager.Set)
                except Exception as exc:
                    res["conflicts"].append("helper value set failed: {0}".format(exc))

        # 3) Managed formulas (dependency order).
        for name, formula in FORMULAS:
            fp = params.get(name)
            if fp is None:
                res["conflicts"].append(name + " (missing, formula skipped)")
                continue
            try:
                if (fp.Formula or "") != formula:
                    fm.SetFormula(fp, formula)
                    res["formulas_set"] += 1
            except Exception as exc:
                res["conflicts"].append("{0} (formula failed: {1})".format(name, exc))

        # Retire superseded params now that no formula references them.
        for rname in RETIRE_PARAMS:
            rp = params.get(rname)
            if rp is not None:
                try:
                    fm.RemoveParameter(rp)
                    res["retired"] = res.get("retired", 0) + 1
                except Exception as exc:
                    res["conflicts"].append(rname + " (retire failed: {0})".format(exc))

        t.Commit()
        t = None

        # 4) Reload into the project (overwrite, instances stay).
        fam_doc.LoadFamily(doc, make_load_options())
        res["reloaded"] = True

    except Exception as exc:
        res["error"] = str(exc)
        try:
            if t is not None and t.HasStarted():
                t.RollBack()
        except Exception:
            pass
    finally:
        try:
            if fam_doc is not None and fam_doc.IsValidObject:
                fam_doc.Close(False)
        except Exception:
            pass

    return res


# ---------------------------------------------------------------------------
# Preview + summary
# ---------------------------------------------------------------------------


def preview_and_confirm(doc, targets, placed_counts, joistish_other, defs):
    lines = []
    total_placed = 0
    for fam in targets:
        nm = revit_name(fam) or "(family)"
        cnt = placed_counts.get(nm, 0)
        total_placed += cnt
        lines.append("  - {0}  ({1} placed)".format(nm, cnt))

    body = []
    body.append("Target joist families: {0}".format(len(targets)))
    body.extend(lines)
    body.append("")
    body.append("Placed joist instances affected: {0}".format(total_placed))
    body.append("Shared parameters to ensure: {0} (+ helper {1})".format(
        len(defs), HELPER_NAME))
    body.append("Formulas to ensure: {0}".format(len(FORMULAS)))
    body.append("")
    body.append("Already-present parameters are skipped. Existing instances")
    body.append("keep their geometry -- families are reloaded in place.")
    if joistish_other:
        body.append("")
        body.append("Joist-ish families NOT targeted (check naming):")
        for n in joistish_other[:8]:
            body.append("  - {0}".format(n))

    if doc.IsWorkshared:
        body.append("")
        body.append("NOTE: workshared model -- you must be able to borrow these")
        body.append("families. Any that are owned by others will be reported.")

    td = TaskDialog("ARE -- Setup Joist Family")
    td.MainInstruction = "Inject joist parameters + formulas into {0} family(ies)?".format(
        len(targets))
    td.MainContent = "\n".join(body)
    td.CommonButtons = TaskDialogCommonButtons.Yes | TaskDialogCommonButtons.No
    td.DefaultButton = TaskDialogResult.No
    return td.Show() == TaskDialogResult.Yes


def show_summary(results):
    out = script.get_output()
    out.set_title("ARE -- Setup Joist Family (results)")
    out.print_md("# Setup Joist Family -- results")

    tadded = sum(r["added"] for r in results)
    tskip = sum(r["skipped"] for r in results)
    tform = sum(r["formulas_set"] for r in results)
    ok = [r for r in results if r["reloaded"] and not r["error"]]
    failed = [r for r in results if r["error"] or not r["reloaded"]]
    conflicts = [(r["family"], c) for r in results for c in r["conflicts"]]

    out.print_md(
        "- Families processed: **{0}**  (reloaded OK: **{1}**, failed: **{2}**)\n"
        "- Parameters added: **{3}**, already present: **{4}**\n"
        "- Formulas set: **{5}**".format(
            len(results), len(ok), len(failed), tadded, tskip, tform))

    rows = []
    for r in results:
        rows.append([
            r["family"], r["added"], r["skipped"], r["formulas_set"],
            "yes" if r["reloaded"] else "NO",
            (r["error"][:40] + "...") if r["error"] else "",
        ])
    out.print_table(
        table_data=rows,
        columns=["Family", "Added", "Skipped", "Formulas", "Reloaded", "Error"],
    )

    if conflicts:
        out.print_md("## Conflicts / notes")
        for fam, c in conflicts:
            out.print_md("- **{0}**: {1}".format(fam, c))

    if ok:
        out.print_md(
            "## Next\nSelect a joist and confirm the ARE_J_* parameters appear, "
            "then set a project load + spacing to verify the PLF computes. "
            "Geometry is unchanged -- nothing was remodeled.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    try:
        uidoc = __revit__.ActiveUIDocument  # noqa: F821
        doc = uidoc.Document
        app = __revit__.Application         # noqa: F821
    except Exception:
        forms.alert("Could not get the active Revit document.",
                    title="ARE Setup Joist Family")
        return

    if doc.IsFamilyDocument:
        forms.alert("Run this in a PROJECT, not the Family Editor.",
                    title="ARE Setup Joist Family")
        return

    defs, def_file, original_sp, err = open_joist_defs(app)
    if err:
        if original_sp is not None:
            try:
                app.SharedParametersFilename = original_sp
            except Exception:
                pass
        forms.alert(err, title="ARE Setup Joist Family -- Error")
        return

    # Hold a reference to def_file for the whole run so the ExternalDefinitions
    # aren't invalidated by garbage collection, and keep OUR shared-param file
    # active for every AddParameter; restore the original only at the very end.
    _keep_alive = def_file  # noqa: F841
    try:
        targets, placed_counts, joistish_other = discover(doc)
        if not targets:
            msg = ("No MODELED joist families matching {0} were found "
                   "(families with placed structural framing).".format(TARGET_SUBSTRINGS))
            if joistish_other:
                msg += "\n\nName-matching families with no placed framing:\n  " + \
                    "\n  ".join(joistish_other[:10])
            forms.alert(msg, title="ARE Setup Joist Family")
            return

        if not preview_and_confirm(doc, targets, placed_counts, joistish_other, defs):
            return

        results = []
        for fam in targets:
            results.append(inject_into_family(doc, fam, defs))

        show_summary(results)
    finally:
        try:
            app.SharedParametersFilename = original_sp
        except Exception:
            pass


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
            forms.alert(
                "Setup Joist Family hit an error. Full traceback:\n\n" + tb,
                title="ARE Setup Joist Family -- Traceback",
            )
        except Exception:
            pass
else:
    _log(">> RUNNING_IN_REVIT is False (a Revit/pyRevit import failed)")
