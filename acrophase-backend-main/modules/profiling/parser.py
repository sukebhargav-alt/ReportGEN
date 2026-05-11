import pandas as pd
import math
import re

# ==============================
# CLEAN NAN + EMPTY VALUES
# ==============================

def clean_empty_values(data):
    if isinstance(data, dict):
        return {
            k: clean_empty_values(v)
            for k, v in data.items()
            if v not in [None, "", "nan"] and not (isinstance(v, float) and math.isnan(v))
        }
    elif isinstance(data, list):
        return [
            clean_empty_values(item)
            for item in data
            if item not in [None, "", "nan"]
        ]
    else:
        return data


# ==============================
# PROFILE EXTRACTION
# ==============================

def extract_profile_level1(df):
    df_profile = df.iloc[:, 0:2].dropna(how="all")
    profile_dict = {}

    for _, row in df_profile.iterrows():
        key = str(row.iloc[0]).strip()
        if key.startswith("---"):
            break

        value = row.iloc[1]

        if key and key != "Field":
            profile_dict[key] = value

    return profile_dict


# ===================================
# GROUP BILATERAL ENTRIES
# ===================================

def group_bilateral_entries(entries, name_field="Test Name", group_field="Test Group"):
    grouped = {}
    ordered = []
    
    for entry in entries:
        name = str(entry.get(name_field) or "").strip()
        
        match_left = re.search(r'(?: [-–] Left| \(Left\))(?: [\[\(][^\]\)]+[\]\)])?$', name, flags=re.IGNORECASE)
        match_right = re.search(r'(?: [-–] Right| \(Right\))(?: [\[\(][^\]\)]+[\]\)])?$', name, flags=re.IGNORECASE)
        # Also match (Asym) and - Asym variants used in AcroScout VALD Quiet Stand metrics
        match_asym = re.search(r'(?: [-–] Asymmetry| \(Asymmetry\)| \(Asym\)| [-–] Asym)(?: [\[\(][^\]\)]+[\]\)])?$', name, flags=re.IGNORECASE)
        
        if match_left or match_right or match_asym:
            if match_left:
                base_name = name[:match_left.start()].strip()
                key = "Left"
            elif match_right:
                base_name = name[:match_right.start()].strip()
                key = "Right"
            else:
                base_name = name[:match_asym.start()].strip()
                key = "Asymmetry"
                
            group_val = str(entry.get(group_field, ""))
            source_val = str(entry.get("Source", ""))
            group_id = f"{group_val}_{base_name}_{source_val}"
            
            if group_id not in grouped:
                new_entry = {k: v for k, v in entry.items() if k not in ["Value"]}
                new_entry[name_field] = base_name
                new_entry["Left"] = None
                new_entry["Right"] = None
                new_entry["Asymmetry"] = None
                grouped[group_id] = new_entry
                ordered.append(grouped[group_id])
            
            grouped[group_id][key] = entry.get("Value")
            if key == "Asymmetry" and entry.get("Unit"):
                grouped[group_id]["Asymmetry"] = f"{entry.get('Value')} {entry.get('Unit')}".strip()
        else:
            ordered.append(entry)
            
    return ordered


# ===================================
# SECTION EXTRACTION
# ===================================

def _is_header_row(row_values):
    """Check if a row is a column-header row for a data block."""
    sv = [str(v).strip() for v in row_values]
    return "Test Group" in sv and ("Test Name" in sv or "Movement" in sv)


def _extract_block_new_format(rows_values, header):
    """
    New format: columns are Test Group | Movement | Side | Value | Unit | Source | Test Date | Notes
    Side values are Right / Left / Asymmetry / nan (scalar).
    We pivot Side into Left/Right/Asymmetry fields.
    """
    sv = [str(v).strip() for v in header]

    def ci(name):
        try: return sv.index(name)
        except ValueError: return None

    c_group = ci("Test Group")
    c_move  = ci("Movement")
    c_side  = ci("Side")
    c_val   = ci("Value")
    c_unit  = ci("Unit")
    c_src   = ci("Source")
    c_notes = ci("Notes")

    def g(row, c):
        if c is None or c >= len(row): return None
        v = row[c]
        return None if (v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() in ("", "nan")) else v

    raw = []
    for row in rows_values:
        grp   = g(row, c_group)
        move  = g(row, c_move)
        side  = str(g(row, c_side) or "").strip().lower()
        val   = g(row, c_val)
        unit  = g(row, c_unit)
        src   = g(row, c_src)
        notes = g(row, c_notes)

        if not move:
            continue
        # Skip repeated header rows inside the block
        if str(move).strip() == "Movement":
            continue

        raw.append({
            "Test Group": grp,
            "Test Name":  move,
            "Side":       side,
            "Value":      val,
            "Unit":       unit,
            "Source":     src,
            "Notes":      notes,
        })

    # Pivot: group by (Test Group, Test Name, Source) and merge sides
    pivoted = {}
    ordered = []

    for r in raw:
        key = (str(r["Test Group"]), str(r["Test Name"]), str(r["Source"]))
        side = r["Side"]

        if key not in pivoted:
            entry = {
                "Test Group":  r["Test Group"],
                "Test Name":   r["Test Name"],
                "Left":        None,
                "Right":       None,
                "Asymmetry":   None,
                "Value":       None,
                "Unit":        r["Unit"],
                "Source":      r["Source"],
                "Notes":       r["Notes"],
            }
            pivoted[key] = entry
            ordered.append(entry)

        e = pivoted[key]
        if side in ("left",):
            e["Left"] = r["Value"]
        elif side in ("right",):
            e["Right"] = r["Value"]
        elif side in ("asymmetry", "asym"):
            asym_str = str(r["Value"]) if r["Value"] is not None else ""
            if r["Unit"]:
                asym_str = f"{asym_str} {r['Unit']}".strip()
            e["Asymmetry"] = asym_str or None
        else:
            # No side — scalar
            e["Value"] = r["Value"]

    return ordered


def _extract_block_old_format(rows_values, header):
    """
    Old format: columns are Test Group | Test Name | Left | Right | Asymmetry | Value | Unit | Source | Notes
    (also handles Rep, Test Date in any position)
    """
    required_fields = ["Test Group", "Test Name", "Value", "Unit", "Source", "Notes",
                       "Left", "Right", "Asymmetry", "Rep", "Test Date"]
    sv = [str(v).strip() for v in header]
    column_map = {}
    for idx, col_name in enumerate(sv):
        if col_name in required_fields:
            column_map[col_name] = idx

    extracted = []
    for row in rows_values:
        entry = {}
        for field in required_fields:
            if field in column_map:
                v = row[column_map[field]] if column_map[field] < len(row) else None
                entry[field] = None if (v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() in ("", "nan")) else v
            else:
                entry[field] = None

        test_name = entry.get("Test Name")
        if not test_name or str(test_name).strip() in ("", "nan", "Test Name"):
            continue
        extracted.append(entry)

    return group_bilateral_entries(extracted, name_field="Test Name", group_field="Test Group")


def extract_profiling_assessment_from_sheet(df):
    """
    Scan a sheet for one or more data blocks, each starting with a header row
    containing 'Test Group' and either 'Test Name' (old format) or 'Movement' (new format).
    Returns a unified list of standardised entries.
    """
    all_entries = []
    nrows = len(df)
    i = 0

    while i < nrows:
        row = df.iloc[i].tolist()

        if _is_header_row(row):
            header = row
            sv = [str(v).strip() for v in header]
            is_new = "Movement" in sv and "Side" in sv

            # Collect data rows until next blank-then-header or EOF
            data_rows = []
            i += 1
            while i < nrows:
                r = df.iloc[i].tolist()
                # Blank row — stop collecting for this block
                if all(v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() in ("", "nan") for v in r):
                    i += 1
                    break
                # Another header row — stop (outer loop will pick it up)
                if _is_header_row(r):
                    break
                data_rows.append(r)
                i += 1

            if data_rows:
                if is_new:
                    entries = _extract_block_new_format(data_rows, header)
                    # Also run bilateral grouping for movements where side is name-encoded
                    # (e.g. "True Limb Length - Right (TLLR)" / "- Left (TLLL)")
                    entries = group_bilateral_entries(entries, name_field="Test Name", group_field="Test Group")
                else:
                    entries = _extract_block_old_format(data_rows, header)
                all_entries.extend(entries)
        else:
            i += 1

    return all_entries


def extract_vald_raw_data_from_sheet(df):
    header_index = None

    for i in range(len(df)):
        row_str = str(df.iloc[i].tolist())
        if "Metric Name" in row_str and "Test Type" in row_str:
            header_index = i
            break

    if header_index is None:
        return []

    headers = df.iloc[header_index].tolist()

    required_fields = [
        "Device",
        "Test Type",
        "Test Date",
        "VALD Test ID",
        "Metric Name",
        "Value",
        "Unit"
    ]

    column_map = {}
    for idx, col_name in enumerate(headers):
        if col_name in required_fields:
            column_map[col_name] = idx

    extracted_data = []

    for i in range(header_index + 1, len(df)):
        row = df.iloc[i]

        if row.isna().all():
            continue

        entry = {}
        for field in required_fields:
            if field in column_map:
                entry[field] = row[column_map[field]]
            else:
                entry[field] = None

        if entry.get("Metric Name") and not pd.isna(entry.get("Metric Name")) and str(entry.get("Metric Name")).strip() != "Metric Name":
            extracted_data.append(entry)

    # Group by Metric Name base, using Test Type as the group field.
    return group_bilateral_entries(extracted_data, name_field="Metric Name", group_field="Test Type")


# ===================================
# MASTER PARSER
# ===================================

def parse_full_profiling_file(file_input):

    excel_file = pd.ExcelFile(file_input, engine="openpyxl")
    sheet_names = excel_file.sheet_names

    profile = {}
    assessments = {}

    for index, sheet_name in enumerate(sheet_names):
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)

        if index == 0:
            profile = extract_profile_level1(df)

        # Skip VALD Raw Data — excluded from all reporting pipelines
        if str(sheet_name).lower().strip() == "vald raw data":
            continue

        section_data = extract_profiling_assessment_from_sheet(df)

        if section_data:
            assessments[sheet_name] = section_data

    result = {
        "profile": profile,
        "assessments": assessments
    }

    return clean_empty_values(result)