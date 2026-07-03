# -*- coding: utf-8 -*-
"""
ARE Create Joist Schedules -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 3 (output)

Builds two Structural Framing schedules filtered to joists:

  "ARE - Joist Loads"   -- per-joist detail (every instance, by Mark) for QA.

  "ARE - Load Schedule" -- the SJI-style load schedule: one row per LOAD MARK
      (J1, J2.../G1...) written by Assign Load Marks. Columns:
      MARK | DESIGNATION | DL | LL/Lr/S/R | WIND down | NET UPLIFT | ADD-LOAD |
      AXIAL | REMARKS.  Itemize OFF so each mark collapses to one row.

Run "Assign Load Marks" first so the marks exist. Idempotent: offers to rebuild
if the schedules already exist. To keep manual super-header merges, prefer
re-running Assign Load Marks (updates data live) over rebuilding.

CPython note: schedulable fields matched by GetName; no FamilyInstance.Symbol.
"""

from __future__ import print_function, unicode_literals

import os
import tempfile
import traceback

LOG_PATH = os.path.join(tempfile.gettempdir(), "are_create_schedule.log")


def _log(msg):
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


def _reset_log():
    try:
        with open(LOG_PATH, "w") as fh:
            fh.write("ARE Create Joist Schedules log\n")
    except Exception:
        pass


try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        ElementId,
        FilteredElementCollector,
        ScheduleFilter,
        ScheduleFilterType,
        ScheduleSortGroupField,
        SectionType,
        TableMergedCell,
        Transaction,
        ViewSchedule,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
    from pyrevit import forms

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

DETAIL_NAME = "ARE - Joist Loads"
SJI_NAME = "ARE - Load Schedule"
FILTER_FIELD = "Family and Type"

DETAIL_FIELDS = [
    "Mark", "Family and Type", "ARE_J_LoadMark",
    "ARE_J_is_Roof", "ARE_J_is_Floor", "ARE_J_has_Solar",
    "ARE_J_Spacing", "ARE_J_Spacing_Source",
    "ARE_J_DL_plf", "ARE_J_wLL_plf", "ARE_J_WindDownASD_plf", "ARE_J_NetUpliftASD_plf",
    "ARE_J_wTL_plf", "ARE_J_wUpliftASD_plf",
    "ARE_J_PointLoad_Callout", "ARE_J_Axial_k", "ARE_J_Remarks", "ARE_J_Calc_Status",
]
# SJI load schedule columns, in order. Depth/Series/Grid are editable text the
# engineer fills IN the schedule; ADD-LOAD is the point-load callout.
SJI_FIELDS = [
    "ARE_J_LoadMark", "ARE_J_Sched_Depth", "ARE_J_Sched_Series",
    "ARE_J_DL_plf", "ARE_J_wLL_plf",
    "ARE_J_WindDownASD_plf", "ARE_J_NetUpliftASD_plf",
    "ARE_J_Axial_k", "ARE_J_Remarks",
]
# The special point-load schedule (only point-loaded joists): mark + grid + the
# P/d pairs, up to however many point loads actually appear in the model.
SPECIAL_NAME = "ARE - Special Joist Loads"
SPECIAL_BASE_FIELDS = [
    "ARE_J_LoadMark", "ARE_J_Sched_Depth", "ARE_J_Sched_Series", "ARE_J_Grid_Ref",
]

# Clean column headings so the schedule reads like an SJI load schedule on every
# project (set on the field, independent of the parameter name).
HEADINGS = {
    "ARE_J_LoadMark": "MARK",
    "ARE_J_Sched_Depth": "DEPTH",
    "ARE_J_Sched_Series": "SERIES",
    "ARE_J_DL_plf": "DL (plf)",
    "ARE_J_wLL_plf": "LL / Lr / S / R (plf)",
    "ARE_J_WindDownASD_plf": "WIND DOWN (ASD)",
    "ARE_J_NetUpliftASD_plf": "NET UPLIFT (ASD)",
    "ARE_J_PointLoad_Callout": "ADD-LOAD",
    "ARE_J_Grid_Ref": "GRID",
    "ARE_J_Axial_k": "AXIAL (k)",
    "ARE_J_Remarks": "REMARKS",
    # detail-schedule extras
    "Mark": "MARK",
    "Family and Type": "FAMILY / TYPE",
    "ARE_J_is_Roof": "ROOF",
    "ARE_J_is_Floor": "FLOOR",
    "ARE_J_has_Solar": "SOLAR",
    "ARE_J_Spacing": "SPACING",
    "ARE_J_Spacing_Source": "SPACING SRC",
    "ARE_J_wTL_plf": "TOTAL TL (plf)",
    "ARE_J_wUpliftASD_plf": "UPLIFT signed (ASD)",
    "ARE_J_Calc_Status": "STATUS",
}


def add_field(definition, sf, name, field_ids):
    """Add a schedulable field and set its clean column heading."""
    fld = definition.AddField(sf)
    if name in HEADINGS:
        try:
            fld.ColumnHeading = HEADINGS[name]
        except Exception:
            pass
    field_ids[name] = fld.FieldId
    return fld


# Merged super-header banners: (label, first field, last field).
SUPER_HEADERS = [
    ("LOADING", "ARE_J_DL_plf", "ARE_J_wLL_plf"),
    ("W WIND", "ARE_J_WindDownASD_plf", "ARE_J_NetUpliftASD_plf"),
]


def _merged_cell(top, left, right):
    """Build a single-row TableMergedCell, using the 4-arg ctor (the no-arg +
    property-set form silently produces an invalid merge under pythonnet)."""
    try:
        return TableMergedCell(top, left, top, right)   # top, left, bottom, right
    except TypeError:
        mc = TableMergedCell()
        mc.Top = top
        mc.Bottom = top
        mc.Left = left
        mc.Right = right
        return mc


def add_super_headers(schedule, col_of):
    """Insert a merged banner row above the DL/LL and WIND-DOWN/UPLIFT columns.
    Finds the columns by their actual header TEXT (robust to hidden fields and
    index offsets) rather than field-add order. Own transaction, after commit.
    Returns a status/diagnostic string for the summary dialog."""
    diag = []
    try:
        hdr = schedule.GetTableData().GetSectionData(SectionType.Header)
        fr, fc = hdr.FirstRowNumber, hdr.FirstColumnNumber
        nR, nC = hdr.NumberOfRows, hdr.NumberOfColumns
        diag.append("hdr rows={0} cols={1} fr={2} fc={3}".format(nR, nC, fr, fc))

        # Locate the column-heading row (the one containing "MARK") and capture
        # each column's heading text.
        hrow = None
        texts = None
        for r in range(fr, fr + nR):
            row_texts = []
            for c in range(fc, fc + nC):
                try:
                    row_texts.append((hdr.GetCellText(r, c) or "").strip())
                except Exception:
                    row_texts.append("")
            if any(t.upper() == "MARK" for t in row_texts):
                hrow, texts = r, row_texts
                break
        if hrow is None:
            return "no heading row found | " + "; ".join(diag)

        def col_for(heading):
            for i, t in enumerate(texts):
                if t == heading:
                    return fc + i
            return None

        hdr.InsertRow(hrow)   # banner row = hrow; headings shift to hrow+1
        done = []
        for label, first, last in SUPER_HEADERS:
            c1 = col_for(HEADINGS.get(first, first))
            c2 = col_for(HEADINGS.get(last, last))
            if c1 is None or c2 is None:
                diag.append("{0}: cols not found".format(label))
                continue
            left, right = min(c1, c2), max(c1, c2)
            try:
                hdr.MergeCells(_merged_cell(hrow, left, right))
                hdr.SetCellText(hrow, left, label)
                done.append(label)
            except Exception as ex:
                diag.append("{0}: merge err {1}".format(label, ex))
        if done:
            return ""   # success -> dialog says "applied"
        return "FAILED | " + "; ".join(diag)
    except Exception as exc:
        return "{0} | {1}".format(exc, "; ".join(diag))


def name_map(doc, definition):
    out = {}
    for sf in definition.GetSchedulableFields():
        try:
            out[sf.GetName(doc)] = sf
        except Exception:
            pass
    return out


def add_joist_filter(definition, field_ids, by_name):
    if FILTER_FIELD in field_ids:
        fid = field_ids[FILTER_FIELD]
    else:
        sf = by_name.get(FILTER_FIELD)
        if sf is None:
            return
        fld = definition.AddField(sf)
        try:
            fld.IsHidden = True
        except Exception:
            pass
        fid = fld.FieldId
    try:
        definition.AddFilter(ScheduleFilter(fid, ScheduleFilterType.Contains, "Joist"))
    except Exception:
        pass


def build_detail(doc):
    sched = ViewSchedule.CreateSchedule(doc, ElementId(BuiltInCategory.OST_StructuralFraming))
    sched.Name = DETAIL_NAME
    d = sched.Definition
    by_name = name_map(doc, d)
    field_ids, missing = {}, []
    for name in DETAIL_FIELDS:
        sf = by_name.get(name)
        if sf is None:
            missing.append(name)
            continue
        try:
            add_field(d, sf, name, field_ids)
        except Exception:
            missing.append(name)
    add_joist_filter(d, field_ids, by_name)
    if "Mark" in field_ids:
        try:
            d.AddSortGroupField(ScheduleSortGroupField(field_ids["Mark"]))
        except Exception:
            pass
    return missing


def build_sji(doc):
    sched = ViewSchedule.CreateSchedule(doc, ElementId(BuiltInCategory.OST_StructuralFraming))
    sched.Name = SJI_NAME
    d = sched.Definition
    by_name = name_map(doc, d)

    field_ids, missing = {}, []
    col_of = {}
    col = 0
    for name in SJI_FIELDS:
        sf = by_name.get(name)
        if sf is None:
            missing.append(name)
            continue
        try:
            add_field(d, sf, name, field_ids)
            col_of[name] = col
            col += 1
        except Exception:
            missing.append(name)

    add_joist_filter(d, field_ids, by_name)
    # keep only marked (loaded) joists if the API supports a has-value filter
    if "ARE_J_LoadMark" in field_ids:
        try:
            d.AddFilter(ScheduleFilter(field_ids["ARE_J_LoadMark"], ScheduleFilterType.HasValue))
        except Exception:
            pass
        try:
            d.AddSortGroupField(ScheduleSortGroupField(field_ids["ARE_J_LoadMark"]))
        except Exception:
            pass
    try:
        d.IsItemized = False
    except Exception:
        pass
    # super-headers are applied AFTER commit (needs the view regenerated)
    return missing, col_of


def max_point_loads(doc):
    """Highest point-load slot actually used across joists (0..5)."""
    mx = 0
    for inst in (FilteredElementCollector(doc)
                 .OfCategory(BuiltInCategory.OST_StructuralFraming)
                 .WhereElementIsNotElementType()):
        try:
            if inst.LookupParameter("ARE_J_P1_Mag") is None:
                continue
            for i in range(1, 6):
                p = inst.LookupParameter("ARE_J_P{0}_Mag".format(i))
                if p is not None and p.AsDouble() > 0:
                    if i > mx:
                        mx = i
        except Exception:
            pass
    return mx


def build_special(doc, n_pl):
    """Special point-load schedule: only point-loaded joists, MARK|DEPTH|SERIES|
    GRID|P1(k)|d1|...  columns up to n_pl pairs. Filtered on the callout text."""
    n_pl = max(1, n_pl)
    sched = ViewSchedule.CreateSchedule(doc, ElementId(BuiltInCategory.OST_StructuralFraming))
    sched.Name = SPECIAL_NAME
    d = sched.Definition
    by_name = name_map(doc, d)

    field_ids, missing = {}, []
    for name in SPECIAL_BASE_FIELDS:
        sf = by_name.get(name)
        if sf is None:
            missing.append(name)
            continue
        try:
            add_field(d, sf, name, field_ids)
        except Exception:
            missing.append(name)

    # P/d column pairs with clean headings
    for i in range(1, n_pl + 1):
        for suffix, head in (("Mag", "P{0} (k)".format(i)), ("Dist", "d{0}".format(i))):
            nm = "ARE_J_P{0}_{1}".format(i, suffix)
            sf = by_name.get(nm)
            if sf is None:
                missing.append(nm)
                continue
            try:
                fld = d.AddField(sf)
                try:
                    fld.ColumnHeading = head
                except Exception:
                    pass
                field_ids[nm] = fld.FieldId
            except Exception:
                missing.append(nm)

    add_joist_filter(d, field_ids, by_name)
    # only point-loaded joists: P1_Mag > 0.01. P1 is always the nearest load, so
    # it is populated iff the joist has any point load. The threshold must be a
    # small POSITIVE number, not 0.0 -- GreaterThan 0.0 does not filter (verified
    # in the Revit UI: 0.01 works, 0.0 does not).
    if "ARE_J_P1_Mag" in field_ids:
        try:
            d.AddFilter(ScheduleFilter(field_ids["ARE_J_P1_Mag"],
                                       ScheduleFilterType.GreaterThan, 0.01))
        except Exception:
            pass
    if "ARE_J_LoadMark" in field_ids:
        try:
            d.AddSortGroupField(ScheduleSortGroupField(field_ids["ARE_J_LoadMark"]))
        except Exception:
            pass
    try:
        d.IsItemized = False
    except Exception:
        pass
    return missing


def find_existing(doc, name):
    for vs in FilteredElementCollector(doc).OfClass(ViewSchedule):
        try:
            if vs.Name == name:
                return vs
        except Exception:
            pass
    return None


def main():
    uidoc = __revit__.ActiveUIDocument  # noqa: F821
    doc = uidoc.Document

    if doc.IsFamilyDocument:
        forms.alert("Run this in a PROJECT.", title="ARE Create Joist Schedules")
        return

    # Always show all 5 point-load slots so adding a P3/P4/P5 later just fills an
    # existing column -- no schedule rebuild needed.
    n_pl = 5
    # Also delete a stale detail schedule from earlier versions, if present.
    existing = [s for s in (find_existing(doc, DETAIL_NAME),
                            find_existing(doc, SJI_NAME),
                            find_existing(doc, SPECIAL_NAME)) if s is not None]
    if existing:
        td = TaskDialog("ARE -- Create Joist Schedules")
        td.MainInstruction = "Joist schedule(s) already exist."
        td.MainContent = ("Rebuild them? Manual header merges / tweaks are lost.\n\n"
                          "Tip: to just refresh the data, re-run Assign Load Marks "
                          "instead -- the schedules update live and your formatting stays.")
        td.CommonButtons = TaskDialogCommonButtons.Yes | TaskDialogCommonButtons.No
        td.DefaultButton = TaskDialogResult.No
        if td.Show() != TaskDialogResult.Yes:
            try:
                uidoc.ActiveView = existing[0]
            except Exception:
                pass
            return

    t = Transaction(doc, "ARE Create Joist Schedules")
    t.Start()
    try:
        for s in existing:
            doc.Delete(s.Id)
        s_missing, col_of = build_sji(doc)
        sp_missing = build_special(doc, n_pl)
        # SAFETY: if the joist params aren't schedulable here, do NOT delete/replace
        # the existing schedules -- roll the whole thing back and explain.
        if "ARE_J_LoadMark" in s_missing:
            t.RollBack()
            forms.alert(
                "No joist parameters ('ARE_J_*') are available in THIS document, "
                "so the schedule would be blank -- nothing was changed.\n\n"
                "This usually means Setup Family (2) hasn't been run in this "
                "project, or the joists here aren't the enhanced K-series family.\n\n"
                "Run: 2 Setup Family -> 7 Assign Marks -> 9 Create Schedule.",
                title="ARE Create Joist Schedules")
            return
        t.Commit()
    except Exception:
        t.RollBack()
        raise

    # Super-headers must be applied after the schedule regenerates -> its own txn.
    sji = find_existing(doc, SJI_NAME)
    sh_err = ""
    if sji is not None:
        t2 = Transaction(doc, "ARE Joist super-headers")
        t2.Start()
        try:
            sh_err = add_super_headers(sji, col_of)
            t2.Commit()
        except Exception as exc:
            try:
                t2.RollBack()
            except Exception:
                pass
            sh_err = str(exc)

    try:
        if sji is not None:
            uidoc.ActiveView = sji
    except Exception:
        pass

    msg = ("Built two schedules:\n"
           "  '{0}' -- line loads by mark (point loads removed)\n"
           "  '{1}' -- point-loaded joists only, {2} P/d column(s)".format(
               SJI_NAME, SPECIAL_NAME, n_pl))
    if sh_err:
        msg += "\n\nSuper-headers (LOADING / W WIND) NOT applied: {0}".format(sh_err)
    else:
        msg += "\n\nSuper-headers LOADING / W WIND applied."
    miss = sorted(set(s_missing) | set(sp_missing))
    if miss:
        msg += "\n\nColumns skipped (param/field not found): " + ", ".join(miss)
    forms.alert(msg, title="ARE Create Joist Schedules")


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
            forms.alert("Create Joist Schedules error:\n\n" + tb,
                        title="ARE Create Joist Schedules -- Traceback")
        except Exception:
            pass
