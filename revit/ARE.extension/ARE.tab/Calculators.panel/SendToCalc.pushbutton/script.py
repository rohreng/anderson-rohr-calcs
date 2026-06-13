# -*- coding: utf-8 -*-
"""
ARE Send to Calculator -- pyRevit pushbutton script
Anderson Rohr Engineering - Phase 3 - v1.0

Reads ARE_* shared parameters from selected structural element(s), builds the
ARE Calc State v1 JSON, POSTs it to calcs.andersonrohr.com/api/calc/run, and
writes the result back to ARE_CalcURL / ARE_CalcDate / ARE_DCR / ARE_Status.

Python 2/3 compatible (IronPython 2.7 + CPython 3.x). No f-strings.
"""

from __future__ import print_function, unicode_literals

# ---------------------------------------------------------------------------
# Standard-library imports (available under IronPython inside Revit)
# ---------------------------------------------------------------------------
import os
import sys
import json
import datetime
import re

# .NET / Revit API imports -- these only resolve inside pyRevit / Revit
try:
    import clr
    clr.AddReference("System")
    clr.AddReference("System.Net")
    clr.AddReference("System.IO")

    from System import Environment, String
    from System.Net import (
        HttpWebRequest, ServicePointManager, SecurityProtocolType, WebException
    )
    from System.IO import StreamReader
    from System.Text import Encoding

    # Force TLS 1.2 -- required by modern servers; Revit's .NET runtime defaults to TLS 1.0
    ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12

    from Autodesk.Revit.DB import (
        FilteredElementCollector,
        BuiltInCategory,
        Element,
        Transaction,
        StorageType,
    )
    from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
    from pyrevit import forms, script as pyscript

    RUNNING_IN_REVIT = True
except ImportError:
    # Allow py_compile / syntax checking outside Revit
    RUNNING_IN_REVIT = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VALID_CALC_TYPES = ("w-to-hss-column", "base-plate", "hss-to-hss-branch")

VALID_CATEGORIES = (
    "Structural Framing",
    "Structural Columns",
    "Walls",
)

# Revit shared-param names
INPUT_PARAM_NAMES = [
    "ARE_Mu", "ARE_Vu", "ARE_Pu", "ARE_Span", "ARE_Lb",
    "ARE_Section", "ARE_CalcType",
]
WRITEBACK_PARAM_NAMES = [
    "ARE_DCR", "ARE_Status", "ARE_CalcURL", "ARE_CalcDate",
]

# Config file: %APPDATA%\ARE\calc_config.json
CONFIG_DIR = os.path.join(
    os.environ.get("APPDATA", os.path.expanduser("~")),
    "ARE",
)
CONFIG_PATH = os.path.join(CONFIG_DIR, "calc_config.json")

# ---------------------------------------------------------------------------
# Section-name normalisation helpers
# ---------------------------------------------------------------------------

# Decimal wall-thickness -> standard fraction (nearest, to 3 dp)
DECIMAL_TO_FRAC = {
    "0.125": "1/8",   ".125":  "1/8",
    "0.188": "3/16",  ".188":  "3/16",
    "0.1875":"3/16",  ".1875": "3/16",
    "0.250": "1/4",   ".250":  "1/4",  ".25": "1/4",
    "0.313": "5/16",  ".313":  "5/16",
    "0.3125":"5/16",  ".3125": "5/16",
    "0.375": "3/8",   ".375":  "3/8",
    "0.500": "1/2",   ".500":  "1/2",  ".5":  "1/2",
    "0.625": "5/8",   ".625":  "5/8",
    "0.750": "3/4",   ".750":  "3/4",  ".75": "3/4",
}


def _frac_from_decimal(dec_str):
    """Return fraction string for a decimal wall thickness, or None."""
    try:
        val = float(dec_str)
    except ValueError:
        return None
    for k, v in DECIMAL_TO_FRAC.items():
        if abs(float(k) - val) < 0.0005:
            return v
    return None


_SECTION_MAP = {}   # Revit type-name (upper) -> AISC_Manual_Label (upper)


def load_section_map(csv_path):
    """Load revit/section-map.csv into _SECTION_MAP (best-effort)."""
    global _SECTION_MAP
    if not os.path.isfile(csv_path):
        return
    try:
        with open(csv_path, "r") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(",")
                if len(parts) >= 2:
                    key = parts[0].strip().upper()
                    val = parts[1].strip().upper()
                    if key and val:
                        _SECTION_MAP[key] = val
    except Exception:
        pass


def normalize_section(raw_name):
    """
    Convert a Revit type-name to an AISC_Manual_Label (uppercase).

    Steps:
    1. CSV lookup (exact after uppercasing).
    2. Heuristic normalisation:
       a. Uppercase; strip leading/trailing whitespace.
       b. Strip internal spaces (e.g. 'HSS 10X10X1/2' -> 'HSS10X10X1/2').
       c. Replace lowercase 'x' with 'X'.
       d. Convert decimal wall thickness to fraction for rect/square HSS.
       e. Round HSS: convert OD.000xWALL decimal -> fraction wall.
    """
    if not raw_name:
        return ""

    upper = raw_name.strip().upper()
    if upper in _SECTION_MAP:
        return _SECTION_MAP[upper]

    s = upper.replace(" ", "")
    # lowercase x already uppercased; belt+braces for mixed input
    s = s.replace("x", "X")

    # Rectangular/square HSS with decimal wall: HSS{D}X{B}X{dec}
    hss_rect = re.match(r"^(HSS\d+(?:\.\d+)?X\d+(?:\.\d+)?)X(\d*\.\d+)$", s)
    if hss_rect:
        prefix = hss_rect.group(1)
        dec = hss_rect.group(2)
        frac = _frac_from_decimal(dec)
        if frac:
            s = prefix + "X" + frac

    # Round HSS decimal wall: HSS{OD.000}X{dec}
    rnd = re.match(r"^(HSS\d+\.\d{3})X(\d+\.\d+)$", s)
    if rnd:
        od_part = rnd.group(1)
        wall_dec = rnd.group(2)
        frac = _frac_from_decimal(wall_dec)
        if frac:
            s = od_part + "X" + frac

    return s

# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------


def load_config():
    """
    Load %APPDATA%/ARE/calc_config.json.
    Returns dict with 'base_url' and 'api_key', or raises RuntimeError.
    """
    if not os.path.isfile(CONFIG_PATH):
        raise RuntimeError(
            "Config file not found:\n  {}\n\n"
            "Create it from revit/calc_config.example.json and fill in your API key.\n"
            "See docs/setup-revit.md for step-by-step instructions.".format(CONFIG_PATH)
        )
    try:
        with open(CONFIG_PATH, "r") as fh:
            cfg = json.load(fh)
    except ValueError as exc:
        raise RuntimeError("calc_config.json is invalid JSON:\n  {}".format(exc))

    missing = [k for k in ("base_url", "api_key") if not cfg.get(k)]
    if missing:
        raise RuntimeError(
            "calc_config.json is missing required key(s): {}\n"
            "See docs/setup-revit.md.".format(", ".join(missing))
        )
    return cfg

# ---------------------------------------------------------------------------
# Revit parameter helpers
# ---------------------------------------------------------------------------


def get_param_value(elem, param_name):
    """Return the value of a shared parameter by name, or None."""
    param = elem.LookupParameter(param_name)
    if param is None or not param.HasValue:
        return None
    if param.StorageType == StorageType.Double:
        return param.AsDouble()
    if param.StorageType == StorageType.String:
        val = param.AsString()
        return val if val else None
    if param.StorageType == StorageType.Integer:
        return float(param.AsInteger())
    return None


def set_param_value(elem, param_name, value):
    """Set a shared parameter by name. Returns True on success."""
    param = elem.LookupParameter(param_name)
    if param is None or param.IsReadOnly:
        return False
    if value is None:
        return False
    if param.StorageType == StorageType.String:
        param.Set(str(value))
    elif param.StorageType == StorageType.Double:
        param.Set(float(value))
    elif param.StorageType == StorageType.Integer:
        param.Set(int(value))
    return True

# ---------------------------------------------------------------------------
# Category validation
# ---------------------------------------------------------------------------


def get_element_category_name(elem):
    if elem.Category is not None:
        return elem.Category.Name
    return ""


def is_valid_category(elem):
    cat = get_element_category_name(elem)
    for valid in VALID_CATEGORIES:
        if valid.lower() in cat.lower():
            return True
    return False

# ---------------------------------------------------------------------------
# HTTP helper (IronPython-compatible, uses System.Net.HttpWebRequest)
# ---------------------------------------------------------------------------


def http_post_json(url, payload_dict, api_key):
    """
    POST payload_dict as JSON to url with x-api-key header.
    Returns (response_dict, None) on success, (None, error_string) on failure.
    """
    body_str = json.dumps(payload_dict)
    body_bytes = Encoding.UTF8.GetBytes(body_str)

    req = HttpWebRequest.Create(url)
    req.Method = "POST"
    req.ContentType = "application/json"
    req.Accept = "application/json"
    req.Headers.Add("x-api-key", api_key)
    req.ContentLength = body_bytes.Length
    req.Timeout = 30000  # 30 seconds

    try:
        req_stream = req.GetRequestStream()
        req_stream.Write(body_bytes, 0, body_bytes.Length)
        req_stream.Close()
    except Exception as exc:
        return None, "Could not open request stream:\n{}".format(exc)

    try:
        response = req.GetResponse()
        resp_stream = response.GetResponseStream()
        reader = StreamReader(resp_stream, Encoding.UTF8)
        resp_body = reader.ReadToEnd()
        reader.Close()
        response.Close()
        result = json.loads(resp_body)
        return result, None
    except WebException as exc:
        try:
            err_stream = exc.Response.GetResponseStream()
            err_reader = StreamReader(err_stream, Encoding.UTF8)
            err_body = err_reader.ReadToEnd()
            err_reader.Close()
            http_code = int(exc.Response.StatusCode)
        except Exception:
            err_body = str(exc)
            http_code = 0

        if http_code == 401:
            return None, (
                "401 Unauthorized -- API key rejected.\n"
                "Check 'api_key' in {}.\n"
                "The key must match ARE_API_KEY on the server.".format(CONFIG_PATH)
            )
        if http_code == 400:
            return None, (
                "400 Bad Request -- the server rejected the Calc State payload.\n"
                "Details:\n{}".format(err_body)
            )
        if http_code == 0:
            return None, (
                "Network error -- could not reach the server.\n"
                "Check your internet connection and 'base_url' in {}.\n"
                "Error: {}".format(CONFIG_PATH, exc)
            )
        return None, "HTTP {} error from server.\n{}".format(http_code, err_body)
    except Exception as exc:
        return None, "Unexpected error during HTTP call:\n{}".format(exc)

# ---------------------------------------------------------------------------
# Secondary-member dialog helpers (pyRevit forms)
# ---------------------------------------------------------------------------


def prompt_hss_section(label, default="HSS10X10X1/2"):
    """Show an input box to collect an HSS section label."""
    result = forms.ask_for_string(
        default=default,
        prompt=(
            "Enter the AISC_Manual_Label for the {} (uppercase).\n"
            "Examples: HSS10X10X1/2  HSS4X4X3/8  HSS12.750X0.500\n\n"
            "This section has no dedicated Revit shared parameter in v1.\n"
            "It will be used for this calc run only.".format(label)
        ),
        title="ARE Calc -- {} Section".format(label),
    )
    if result is None:
        return None
    return normalize_section(result.strip())


def prompt_base_plate_connection():
    """
    Collect base-plate connection defaults.
    Returns dict with plate/anchors/concrete, or None if cancelled.
    """
    plate_n = forms.ask_for_string(
        default="14", prompt="Base plate length N (in):", title="Base Plate -- N")
    if plate_n is None:
        return None
    plate_b = forms.ask_for_string(
        default="14", prompt="Base plate width B (in):", title="Base Plate -- B")
    if plate_b is None:
        return None
    plate_tp = forms.ask_for_string(
        default="0.75", prompt="Plate thickness tp (in):", title="Base Plate -- tp")
    if plate_tp is None:
        return None
    plate_fy = forms.ask_for_string(
        default="36", prompt="Plate yield stress Fyp (ksi):", title="Base Plate -- Fyp")
    if plate_fy is None:
        return None

    anchor_n = forms.ask_for_string(
        default="4", prompt="Number of anchor rods n:", title="Anchors -- n")
    if anchor_n is None:
        return None
    anchor_dia = forms.ask_for_string(
        default="0.75",
        prompt="Anchor rod diameter (in): 0.75 | 0.875 | 1.0 | 1.125 | 1.25 | 1.5",
        title="Anchors -- dia")
    if anchor_dia is None:
        return None
    anchor_g = forms.ask_for_string(
        default="11", prompt="Bolt-to-bolt gauge sg (in):", title="Anchors -- gauge")
    if anchor_g is None:
        return None

    conc_fc = forms.ask_for_string(
        default="3", prompt="Concrete f'c (ksi):", title="Concrete -- f'c")
    if conc_fc is None:
        return None
    conc_hef = forms.ask_for_string(
        default="8", prompt="Anchor embedment hef (in):", title="Concrete -- hef")
    if conc_hef is None:
        return None
    conc_edge = forms.ask_for_string(
        default="18", prompt="Min edge distance cEdge (in):", title="Concrete -- cEdge")
    if conc_edge is None:
        return None

    try:
        return {
            "plate": {
                "N":   float(plate_n),
                "B":   float(plate_b),
                "tp":  float(plate_tp),
                "Fyp": float(plate_fy),
            },
            "anchors": {
                "n":     int(float(anchor_n)),
                "dia":   float(anchor_dia),
                "gauge": float(anchor_g),
                "grade": "F1554 Gr.36",
            },
            "concrete": {
                "fc":    float(conc_fc),
                "hef":   float(conc_hef),
                "cEdge": float(conc_edge),
            },
        }
    except ValueError as exc:
        forms.alert(
            "Invalid numeric input:\n{}".format(exc),
            title="ARE Calc -- Input Error",
        )
        return None


def prompt_hss_branch_connection(branch_section):
    """
    Collect hss-to-hss-branch connection details.
    Returns dict for connection block, or None if cancelled.
    """
    chord_raw = forms.ask_for_string(
        default="HSS4X4X3/8",
        prompt=(
            "Enter the AISC label for the HSS CHORD (through member).\n"
            "Example: HSS4X4X3/8  HSS6X6X1/2"
        ),
        title="HSS Branch -- Chord Section",
    )
    if chord_raw is None:
        return None
    chord_section = normalize_section(chord_raw.strip())

    sub_type = forms.ask_for_one_item(
        ["rect-moment", "round-moment", "truss"],
        prompt="Select connection sub-type:",
        title="HSS Branch -- Sub-type",
    )
    if sub_type is None:
        return None

    conn_type = forms.ask_for_one_item(
        ["T", "Y", "X", "KG", "KO"],
        prompt="Select joint topology (connType):",
        title="HSS Branch -- connType",
    )
    if conn_type is None:
        return None

    theta_str = forms.ask_for_string(
        default="90",
        prompt="Branch-to-chord angle theta (degrees, 30-90):",
        title="HSS Branch -- theta",
    )
    if theta_str is None:
        return None

    orient = "H"
    if sub_type == "rect-moment":
        orient_choice = forms.ask_for_one_item(
            ["H (strong axis in-plane)", "B (weak axis in-plane)"],
            prompt="Branch in-plane orientation:",
            title="HSS Branch -- orient",
        )
        if orient_choice is None:
            return None
        orient = "H" if orient_choice.startswith("H") else "B"

    qf_str = forms.ask_for_string(
        default="1.00",
        prompt="Chord stress interaction factor Qf (dimensionless, default 1.00):",
        title="HSS Branch -- Qf",
    )
    if qf_str is None:
        return None

    chord_fy_str = forms.ask_for_string(
        default="46",
        prompt="Chord Fy (ksi, default 46 for A500):",
        title="HSS Branch -- Chord Fy",
    )
    if chord_fy_str is None:
        return None

    branch_fy_str = forms.ask_for_string(
        default="46",
        prompt="Branch Fy (ksi, default 46 for A500):",
        title="HSS Branch -- Branch Fy",
    )
    if branch_fy_str is None:
        return None

    try:
        theta = float(theta_str)
        qf = float(qf_str)
        chord_fy = float(chord_fy_str)
        branch_fy = float(branch_fy_str)
    except ValueError as exc:
        forms.alert(
            "Invalid numeric input:\n{}".format(exc),
            title="ARE Calc -- Input Error",
        )
        return None

    return {
        "subType":  sub_type,
        "connType": conn_type,
        "chord": {
            "section": chord_section,
            "Fy": chord_fy,
        },
        "branchFy": branch_fy,
        "theta": theta,
        "Qf": qf,
        "orient": orient,
        "gap": None,
        "overlap": None,
    }

# ---------------------------------------------------------------------------
# Calc State builder
# ---------------------------------------------------------------------------


def build_calc_state(elem, calc_type, params, connection_block):
    """
    Assemble the ARE Calc State v1 dict from a Revit element's ARE_* params.

    params: dict of param-name -> value (already read from the element)
    connection_block: per-calcType dict

    Returns a dict ready for json.dumps.
    Raises ValueError with a user-readable message on validation failure.
    """
    # Section
    raw_section = params.get("ARE_Section") or ""
    section = normalize_section(raw_section)
    if not section:
        raise ValueError(
            "ARE_Section is blank on element Mark='{}'. "
            "Set the AISC_Manual_Label (e.g. W18X50) before running.".format(
                params.get("mark", "?")
            )
        )

    # Member type from category name
    cat = params.get("_category", "")
    if "column" in cat.lower():
        member_type = "column"
    elif "wall" in cat.lower():
        member_type = "wall"
    else:
        member_type = "beam"  # Structural Framing default

    # Demands
    # ARE_Mu is always stored by the user in kip-ft.
    # For hss-to-hss-branch, the JSON spec demands kip-in -- multiply by 12.
    # See spec §4.1 and §4.2.
    mu_kft = params.get("ARE_Mu")
    vu = params.get("ARE_Vu")
    pu = params.get("ARE_Pu")

    if calc_type == "hss-to-hss-branch" and mu_kft is not None:
        mu_json = mu_kft * 12.0   # kip-ft -> kip-in (spec §4.1 unit conversion)
    else:
        mu_json = mu_kft           # kip-ft for w-to-hss-column and base-plate

    demands = {
        "Mu": mu_json,
        "Vu": vu,
        "Pu": pu,
    }
    # hss-to-hss-branch also carries Mu_op (no Revit param in v1; default 0)
    if calc_type == "hss-to-hss-branch":
        demands["Mu_op"] = 0.0

    # Geometry (spec §1.3: all lengths in inches)
    # ARE_Span and ARE_Lb are NUMBER params; user enters values in INCHES per
    # spec §7 table (display unit "inches"), so no unit conversion needed here.
    geometry = {
        "L":  params.get("ARE_Span"),
        "Lb": params.get("ARE_Lb"),
        "Cb": None,
    }

    # Default Fy by section family
    section_up = section.upper()
    fy_default = 46.0 if section_up.startswith("HSS") else 50.0

    # Mark
    mark = params.get("mark")

    state = {
        "schema":   "are.calc.v1",
        "calcType": calc_type,
        "member": {
            "mark":    mark,
            "type":    member_type,
            "section": section,
            "material": {
                "Fy": fy_default,
                "E":  29000,
            },
        },
        "demands":    demands,
        "geometry":   geometry,
        "connection": connection_block,
        "results":    None,
        "meta": {
            "source":    "revit",
            "createdBy": "pyrevit",
        },
    }
    return state

# ---------------------------------------------------------------------------
# Writeback
# ---------------------------------------------------------------------------


def writeback_results(doc, elem, api_response, iso_date):
    """
    Write API response values back to ARE_* writeback params inside a Transaction.
    Returns (True, None) on success, (False, error_string) on failure.
    """
    t = Transaction(doc, "ARE Calc Writeback")
    t.Start()
    try:
        url    = api_response.get("url") or ""
        dcr    = api_response.get("dcr")       # None in store-only v1
        status = api_response.get("status") or "PENDING"

        set_param_value(elem, "ARE_CalcURL",  url)
        set_param_value(elem, "ARE_CalcDate", iso_date)
        set_param_value(elem, "ARE_Status",   status)

        # Only write DCR when the engine has computed a real value
        if dcr is not None:
            set_param_value(elem, "ARE_DCR", dcr)

        t.Commit()
        return True, None
    except Exception as exc:
        t.RollBack()
        return False, str(exc)

# ---------------------------------------------------------------------------
# Per-element processing
# ---------------------------------------------------------------------------


def process_element(doc, elem, cfg, section_map_path):
    """
    Full pipeline for one element.
    Returns dict: { mark, calc_type, url, dcr, status, error }
    error is None on success, a string on failure.
    """
    load_section_map(section_map_path)

    # Category check
    if not is_valid_category(elem):
        cat = get_element_category_name(elem)
        return {
            "mark": None, "calc_type": None,
            "url": None, "dcr": None, "status": None,
            "error": (
                "Element category '{}' is not supported. "
                "Must be Structural Framing, Structural Columns, or Walls.".format(cat)
            ),
        }

    # Read ARE_* input params
    params = {}
    for pname in INPUT_PARAM_NAMES:
        params[pname] = get_param_value(elem, pname)

    # Element mark
    mark_param = elem.LookupParameter("Mark")
    params["mark"] = (
        mark_param.AsString()
        if (mark_param and mark_param.HasValue)
        else str(elem.Id)
    )
    params["_category"] = get_element_category_name(elem)

    # Validate ARE_CalcType
    calc_type = params.get("ARE_CalcType") or ""
    calc_type = calc_type.strip().lower()
    if calc_type not in VALID_CALC_TYPES:
        return {
            "mark": params["mark"], "calc_type": calc_type,
            "url": None, "dcr": None, "status": None,
            "error": (
                "ARE_CalcType '{}' is not valid on element Mark='{}'.\n"
                "Must be one of: {}".format(
                    calc_type, params["mark"], ", ".join(VALID_CALC_TYPES)
                )
            ),
        }

    # Validate at least one load param is set
    load_vals = [params.get(p) for p in ("ARE_Mu", "ARE_Vu", "ARE_Pu")]
    if all(v is None for v in load_vals):
        return {
            "mark": params["mark"], "calc_type": calc_type,
            "url": None, "dcr": None, "status": None,
            "error": (
                "No load parameters (ARE_Mu / ARE_Vu / ARE_Pu) are set "
                "on element Mark='{}'. Set at least one before running.".format(params["mark"])
            ),
        }

    # Build per-calcType connection block (with secondary-member prompts)
    connection_block = None

    if calc_type == "w-to-hss-column":
        hss_col_section = prompt_hss_section(
            label="HSS Column (chord)",
            default="HSS10X10X1/2",
        )
        if hss_col_section is None:
            return {
                "mark": params["mark"], "calc_type": calc_type,
                "url": None, "dcr": None, "status": None,
                "error": "Cancelled -- HSS column section not entered for Mark='{}'.".format(params["mark"]),
            }
        connection_block = {
            "column": {
                "section": hss_col_section,
                "Fy": 46.0,   # A500 Gr.B/C per spec §3.1 default
            },
            "beamFy": 50.0,   # A992 default
        }

    elif calc_type == "base-plate":
        connection_block = prompt_base_plate_connection()
        if connection_block is None:
            return {
                "mark": params["mark"], "calc_type": calc_type,
                "url": None, "dcr": None, "status": None,
                "error": "Cancelled -- base plate details not entered for Mark='{}'.".format(params["mark"]),
            }

    elif calc_type == "hss-to-hss-branch":
        primary_section = normalize_section(params.get("ARE_Section") or "")
        connection_block = prompt_hss_branch_connection(primary_section)
        if connection_block is None:
            return {
                "mark": params["mark"], "calc_type": calc_type,
                "url": None, "dcr": None, "status": None,
                "error": "Cancelled -- HSS branch details not entered for Mark='{}'.".format(params["mark"]),
            }

    # Build Calc State
    try:
        state = build_calc_state(elem, calc_type, params, connection_block)
    except ValueError as exc:
        return {
            "mark": params["mark"], "calc_type": calc_type,
            "url": None, "dcr": None, "status": None,
            "error": str(exc),
        }

    # POST to API
    endpoint = cfg["base_url"].rstrip("/") + "/api/calc/run"
    api_key  = cfg["api_key"]

    api_response, err = http_post_json(endpoint, state, api_key)
    if err:
        return {
            "mark": params["mark"], "calc_type": calc_type,
            "url": None, "dcr": None, "status": None,
            "error": "API error for Mark='{}':\n{}".format(params["mark"], err),
        }

    # Writeback
    iso_date = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    ok, wb_err = writeback_results(doc, elem, api_response, iso_date)
    if not ok:
        return {
            "mark": params["mark"], "calc_type": calc_type,
            "url": api_response.get("url"), "dcr": api_response.get("dcr"),
            "status": api_response.get("status"),
            "error": "Calc sent OK but writeback failed:\n{}".format(wb_err),
        }

    return {
        "mark":      params["mark"],
        "calc_type": calc_type,
        "url":       api_response.get("url"),
        "dcr":       api_response.get("dcr"),
        "status":    api_response.get("status") or "PENDING",
        "error":     None,
    }

# ---------------------------------------------------------------------------
# Results summary dialog
# ---------------------------------------------------------------------------


def show_results_summary(results):
    """Display a TaskDialog summarising per-element results."""
    successes = [r for r in results if r["error"] is None]
    failures  = [r for r in results if r["error"] is not None]

    lines = []
    lines.append("=== ARE Calc Results ===\n")
    lines.append("{} sent successfully, {} failed.\n".format(len(successes), len(failures)))

    if successes:
        lines.append("\nSUCCESS:")
        for r in successes:
            dcr_str = "{:.3f}".format(r["dcr"]) if r["dcr"] is not None else "--"
            lines.append(
                "  Mark {:<12}  {}  DCR={}  {}".format(
                    r["mark"] or "?",
                    r["calc_type"] or "",
                    dcr_str,
                    r["status"] or "",
                )
            )
            if r.get("url"):
                lines.append("    URL: {}".format(r["url"]))

    if failures:
        lines.append("\nFAILED:")
        for r in failures:
            lines.append(
                "  Mark {}: {}".format(r["mark"] or "?", r["error"])
            )

    summary = "\n".join(lines)

    td = TaskDialog("ARE Send to Calculator")
    td.MainInstruction = "Calc State submitted"
    td.MainContent = summary
    td.CommonButtons = TaskDialogCommonButtons.Ok
    td.Show()

# ---------------------------------------------------------------------------
# Entry point (called by pyRevit when the button is clicked)
# ---------------------------------------------------------------------------


def main():
    # pyRevit provides __revit__ as a global
    try:
        uidoc = __revit__.ActiveUIDocument  # noqa: F821
        doc   = uidoc.Document
    except Exception:
        forms.alert(
            "Could not get active Revit document. "
            "Make sure a project is open.",
            title="ARE Calc -- Error",
        )
        return

    # Load config
    try:
        cfg = load_config()
    except RuntimeError as exc:
        forms.alert(str(exc), title="ARE Calc -- Config Error")
        return

    # Get selection
    selection = uidoc.Selection.GetElementIds()
    if not selection or selection.Count == 0:
        forms.alert(
            "No elements selected.\n\n"
            "Select one or more structural beams, columns, or walls "
            "with ARE_CalcType and load parameters set, then click Send to Calculator.",
            title="ARE Calc -- No Selection",
        )
        return

    elements = [doc.GetElement(eid) for eid in selection]

    # Locate section-map.csv: lives in revit/ alongside ARE.extension/
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # script is at: revit/ARE.extension/ARE.tab/Calculators.panel/SendToCalc.pushbutton/
    # extension root:                  ^ARE.extension
    # revit/ folder:                   ^revit
    # Walk up 4 levels from script to reach revit/
    revit_dir = script_dir
    for _ in range(4):
        revit_dir = os.path.dirname(revit_dir)
    section_map_path = os.path.join(revit_dir, "section-map.csv")

    # Process each element
    results = []
    for elem in elements:
        result = process_element(doc, elem, cfg, section_map_path)
        results.append(result)

    # Show summary
    show_results_summary(results)


# Run when pyRevit executes this script
if RUNNING_IN_REVIT:
    main()
