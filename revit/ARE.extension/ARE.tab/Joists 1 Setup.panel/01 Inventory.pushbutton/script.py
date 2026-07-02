# -*- coding: utf-8 -*-
"""
ARE Joist Inventory -- pyRevit pushbutton script
Anderson Rohr Engineering - Joist Loading - Phase 0 (diagnostic)

READ-ONLY. Scans the active document and reports everything we need to know
before attaching automated joist loading:

  * Which Structural Framing families/types look like joists, and how many of
    each are placed.  (Tells us whether the modeled joists are the library
    "K-Series Bar Joist-*" families -> decides if live in-family formulas are
    available on the EXISTING instances, or if we go param-bind + pyRevit calc.)
  * Beam Systems present (the automatic-spacing source).
  * Whether the ARE_J_* load parameters are already bound here.
  * Editability blockers: instances inside Groups, in Design Options, pinned,
    or sitting in linked models -- anything that would reject a parameter write.

No Transaction is opened and no parameter is set. Running this cannot change
the model. Use it on the live 2024 project to scope the work, then do the
actual binding/calc on a Save-As copy.

Python 2/3 compatible (IronPython 2.7 + CPython 3.x). No f-strings.
"""

from __future__ import print_function, unicode_literals

# .NET / Revit API imports -- only resolve inside pyRevit / Revit.
try:
    import clr  # noqa: F401

    from Autodesk.Revit.DB import (
        BuiltInCategory,
        BuiltInParameter,
        ElementId,
        FilteredElementCollector,
        RevitLinkInstance,
    )
    from pyrevit import script, forms

    RUNNING_IN_REVIT = True
except ImportError:
    RUNNING_IN_REVIT = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Family-name fragments that mark a Structural Framing instance as joist-like.
# Lower-cased substring match against the FAMILY name.
JOIST_NAME_HINTS = (
    "joist",
    "bar joist",
    "k-series",
    "kseries",
    "k series",
    "lh-series",
    "lh series",
    "dlh",
    "slh",
    "open web",
    "vulcraft",
    "sji",
    "web",          # "K-Series Bar Joist-Angle Web" / "-Rod Web"
)

# The Phase-1 instance parameters we will eventually bind. We only probe for
# the spacing param here as a present/absent flag.
PROBE_PARAM = "ARE_J_Spacing"

# How many sample element ids to make clickable per family in the report.
MAX_LINKS_PER_FAMILY = 8

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def is_joist_name(fam_name):
    if not fam_name:
        return False
    low = fam_name.lower()
    for hint in JOIST_NAME_HINTS:
        if hint in low:
            return True
    return False


def _param_value_string(inst, bip):
    """AsValueString of a BuiltInParameter, or None. Engine-agnostic: uses
    only base-Element methods so it works under both IronPython and CPython
    (CPython/pythonnet does NOT downcast collector results to FamilyInstance,
    so FamilyInstance.Symbol is unavailable -- we avoid it entirely)."""
    try:
        p = inst.get_Parameter(bip)
        if p is None:
            return None
        s = p.AsValueString()
        if s:
            return s
        s = p.AsString()
        return s or None
    except Exception:
        return None


def family_and_type(inst, doc):
    """Return (family_name, type_name) using BuiltInParameters only."""
    fam_name = _param_value_string(inst, BuiltInParameter.ELEM_FAMILY_PARAM)
    type_name = _param_value_string(inst, BuiltInParameter.ELEM_TYPE_PARAM)

    # Fallback: the combined "Family: Type" parameter, then split.
    if not fam_name or not type_name:
        combined = _param_value_string(
            inst, BuiltInParameter.ELEM_FAMILY_AND_TYPE_PARAM)
        if combined and ":" in combined:
            left, right = combined.split(":", 1)
            fam_name = fam_name or left.strip()
            type_name = type_name or right.strip()

    return (fam_name or "(unknown)", type_name or "(unknown)")


def collect_framing(doc):
    """All placed Structural Framing instances in this document (not types)."""
    return list(
        FilteredElementCollector(doc)
        .OfCategory(BuiltInCategory.OST_StructuralFraming)
        .WhereElementIsNotElementType()
        .ToElements()
    )


def count_beam_systems(doc):
    try:
        return (
            FilteredElementCollector(doc)
            .OfCategory(BuiltInCategory.OST_StructuralFramingSystem)
            .WhereElementIsNotElementType()
            .GetElementCount()
        )
    except Exception:
        return 0


def count_links(doc):
    try:
        return (
            FilteredElementCollector(doc)
            .OfClass(RevitLinkInstance)
            .GetElementCount()
        )
    except Exception:
        return 0


def editability_flags(inst):
    """Return (in_group, in_design_option, pinned) booleans, best-effort."""
    in_group = False
    in_do = False
    pinned = False
    try:
        gid = inst.GroupId
        in_group = (gid is not None and gid != ElementId.InvalidElementId)
    except Exception:
        pass
    try:
        in_do = inst.DesignOption is not None
    except Exception:
        pass
    try:
        pinned = bool(inst.Pinned)
    except Exception:
        pass
    return in_group, in_do, pinned


def has_probe_param(inst):
    try:
        return inst.LookupParameter(PROBE_PARAM) is not None
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------


def build_inventory(doc):
    framing = collect_framing(doc)

    # Aggregate per family name.
    by_family = {}   # fam_name -> dict(count, joistlike, types set, ids list,
                     #                   in_group, in_do, pinned, has_param)
    total_joistlike = 0

    for inst in framing:
        fam_name, type_name = family_and_type(inst, doc)
        rec = by_family.get(fam_name)
        if rec is None:
            rec = {
                "count": 0,
                "joistlike": is_joist_name(fam_name),
                "types": set(),
                "ids": [],
                "in_group": 0,
                "in_do": 0,
                "pinned": 0,
                "has_param": 0,
            }
            by_family[fam_name] = rec

        rec["count"] += 1
        rec["types"].add(type_name)
        if len(rec["ids"]) < MAX_LINKS_PER_FAMILY:
            try:
                rec["ids"].append(inst.Id)
            except Exception:
                pass

        ig, ido, pin = editability_flags(inst)
        if ig:
            rec["in_group"] += 1
        if ido:
            rec["in_do"] += 1
        if pin:
            rec["pinned"] += 1
        if has_probe_param(inst):
            rec["has_param"] += 1

        if rec["joistlike"]:
            total_joistlike += 1

    return {
        "total_framing": len(framing),
        "total_joistlike": total_joistlike,
        "by_family": by_family,
        "beam_systems": count_beam_systems(doc),
        "links": count_links(doc),
        "workshared": bool(getattr(doc, "IsWorkshared", False)),
    }


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def report(doc, data):
    out = script.get_output()
    out.set_title("ARE -- Joist Inventory (read-only)")

    out.print_md("# ARE Joist Inventory")
    out.print_md(
        "**Read-only scan.** Nothing was changed in the model. "
        "Use this to scope joist loading before binding any parameters."
    )

    out.print_md("## Project summary")
    out.print_md("- Structural Framing instances: **{0}**".format(data["total_framing"]))
    out.print_md("- Joist-like instances: **{0}**".format(data["total_joistlike"]))
    out.print_md("- Beam Systems (auto-spacing source): **{0}**".format(data["beam_systems"]))
    out.print_md("- Linked models: **{0}**".format(data["links"]))
    out.print_md("- Workshared: **{0}**".format("yes" if data["workshared"] else "no"))

    # Split families into joist-like vs other, joist-like first, by count desc.
    fams = list(data["by_family"].items())
    fams.sort(key=lambda kv: (not kv[1]["joistlike"], -kv[1]["count"]))

    rows = []
    for fam_name, rec in fams:
        rows.append([
            "JOIST" if rec["joistlike"] else "-",
            fam_name,
            rec["count"],
            len(rec["types"]),
            "yes" if rec["has_param"] else "no",
            rec["in_group"],
            rec["in_do"],
            rec["pinned"],
        ])

    out.print_md("## Families (joist-like first)")
    if rows:
        out.print_table(
            table_data=rows,
            columns=[
                "Kind", "Family", "Count", "Types",
                PROBE_PARAM + "?", "In group", "In DO", "Pinned",
            ],
            formats=["", "", "", "", "", "", "", ""],
        )
    else:
        out.print_md("_No Structural Framing instances found._")

    # Clickable samples for each joist-like family.
    joist_fams = [(n, r) for n, r in fams if r["joistlike"]]
    if joist_fams:
        out.print_md("## Click a sample to zoom/select")
        for fam_name, rec in joist_fams:
            links = []
            for eid in rec["ids"]:
                try:
                    links.append(out.linkify(eid))
                except Exception:
                    pass
            out.print_md("**{0}** ({1} placed): {2}".format(
                fam_name, rec["count"],
                "  ".join(links) if links else "(no samples)"))

    # Plain-language read on what this means for the plan.
    out.print_md("## What this means")
    lib_hit = any(
        ("k-series" in n.lower() or "bar joist" in n.lower())
        for n, r in joist_fams
    )
    if lib_hit:
        out.print_md(
            "- A library **K-Series / Bar Joist** family is in use -> the existing "
            "joists CAN get live in-family PLF formulas via a family reload "
            "(no remodel). We can also bind params + calc, family-agnostic."
        )
    elif joist_fams:
        out.print_md(
            "- Joist-like families are present but not the stock K-Series naming. "
            "Safest path for the existing joists: bind ARE_J_* params to the "
            "Structural Framing category + pyRevit calc (family-agnostic). "
            "Live in-family formulas would require editing that specific family."
        )
    else:
        out.print_md(
            "- No joist-like families auto-detected. Check the 'Families' table "
            "above -- the modeled joists may use an unexpected name. Tell me the "
            "family name and I'll add it to the detector."
        )

    blockers = sum(r["in_group"] + r["in_do"] + r["pinned"] for _, r in joist_fams)
    if blockers:
        out.print_md(
            "- Some joists are in **groups / design options / pinned**. Parameter "
            "writes may be rejected for those; we'll handle or report them in the "
            "calc step."
        )
    if data["beam_systems"] == 0:
        out.print_md(
            "- **No Beam Systems** found -> automatic spacing-from-beam-system "
            "won't apply; we'll use manual spacing or nearest-neighbor inference."
        )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    try:
        doc = __revit__.ActiveUIDocument.Document  # noqa: F821
    except Exception:
        forms.alert(
            "Could not get the active Revit document.\n"
            "Open the project, then click Joist Inventory.",
            title="ARE Joist Inventory -- Error",
        )
        return

    data = build_inventory(doc)
    report(doc, data)


if RUNNING_IN_REVIT:
    main()
