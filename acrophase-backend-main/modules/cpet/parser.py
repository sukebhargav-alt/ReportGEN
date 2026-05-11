import pandas as pd
import math
import datetime


def format_t_value(val):
    """Convert the 't' column to an HH:MM:SS string.

    COSMED (and similar CPET devices) export time as an Excel fractional-day
    float (e.g. 0.0000231 ≈ 2 seconds).  openpyxl may also return a
    datetime.time object — both forms are handled here.
    """
    if isinstance(val, datetime.time):
        return val.strftime("%H:%M:%S")
    if isinstance(val, float) and 0 <= val < 1:
        total_seconds = round(val * 86400)
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        s = total_seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"
    # Fallback: plain string (already formatted or unexpected type)
    return str(val)

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

def extract_cpet_profile(df):
    profile = {}
    for i in range(min(50, len(df))):
        row = df.iloc[i].tolist()
        
        # We know profile KV pairs are located at cols [0,1], [3,4], [6,7]
        for col_idx in [0, 3, 6]:
            if col_idx + 1 < len(row):
                key = str(row[col_idx]).strip()
                val = row[col_idx + 1]
                
                if pd.isna(key) or key in ['nan', 'None', '']:
                    continue
                    
                if not pd.isna(val) and str(val) != 'nan':
                    # Parse out timestamps
                    if isinstance(val, datetime.time):
                        val = str(val)
                    profile[key] = val
    return profile

def extract_cpet_data_sheet(df):
    header_row = None
    t_col_idx = None
    
    # Locate the header row containing 't' and 'VO2'
    for i in range(min(20, len(df))):
        row_str = [str(x).strip() for x in df.iloc[i].tolist()]
        if 't' in row_str and 'VO2' in row_str:
            header_row = i
            t_col_idx = row_str.index('t')
            break
            
    if header_row is None or t_col_idx is None:
        return []
        
    headers = [str(col).strip() for col in df.iloc[header_row].tolist()[t_col_idx:]]
    
    data = []
    for i in range(header_row + 1, len(df)):
        row = df.iloc[i].tolist()
        
        # Stop if we hit totally empty rows
        if df.iloc[i].isna().all():
            continue
            
        t_val = row[t_col_idx]
        if pd.isna(t_val) or str(t_val).strip() in ['s', 'nan', '---', '']:
             continue # Skip empty/unit rows
             
        entry = {}
        row_data = row[t_col_idx:]
        
        for j, col_name in enumerate(headers):
             if pd.notna(col_name) and col_name and j < len(row_data):
                  val = row_data[j]
                  if col_name == "t":
                      val = format_t_value(val)
                  elif isinstance(val, datetime.time):
                      val = str(val)
                  entry[col_name] = val
                  
        if entry.get("t"):
            data.append(entry)
            
    return data

def extract_cpet_results_sheet(df):
    """Collect all Parameter rows from ALL sub-tables in the Results sheet.

    The Results sheet may contain several sub-tables (Protocol, Metabolic,
    Ventilatory, Cardiovascular, Gas Exchange, Substrates) each preceded by a
    'Parameter / Meas.' header row.  This function iterates every such header
    and captures rows from all of them.
    """
    all_data = []
    current_headers = None

    for i in range(len(df)):
        row_str = [str(x).strip() for x in df.iloc[i].tolist()]

        # Detect a new Parameter header row → update active headers
        if 'Parameter' in row_str and 'Meas.' in row_str:
            current_headers = [
                str(col).strip() if pd.notna(col) else f"Col_{idx}"
                for idx, col in enumerate(df.iloc[i].tolist())
            ]
            continue

        # Skip section title rows (e.g. "Metabolic", "Cardiovascular", blank)
        first_cell = str(df.iloc[i].iloc[0]).strip()
        if first_cell in ["", "nan", "None"] or df.iloc[i].isna().all():
            continue
        if current_headers is None:
            continue

        # Skip unit rows (second row under a header that says "um")
        if 'um' in row_str:
            continue

        row = df.iloc[i]
        entry = {}
        for col_idx, col_name in enumerate(current_headers):
            if col_name and "Col_" not in col_name:
                val = row.iloc[col_idx]
                if isinstance(val, datetime.time):
                    val = str(val)
                entry[col_name] = val

        param = entry.get("Parameter")
        if param and pd.notna(param) and str(param).strip() not in ["", "nan"]:
            all_data.append(entry)

    return all_data

def parse_full_cpet_file(file_input):
    excel_file = pd.ExcelFile(file_input, engine="openpyxl")
    sheet_names = excel_file.sheet_names

    profile = {}
    data_sheet = []
    results = []

    for sheet_name in sheet_names:
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)

        if str(sheet_name).strip() == "Data":
            profile = extract_cpet_profile(df)
            data_sheet = extract_cpet_data_sheet(df)
            
        elif str(sheet_name).strip() == "Results":
            df_results = df
            all_results = []
            
            # Find all instances of "Parameter" table headers just in case there are multiple
            for i in range(len(df_results)):
                row_str = [str(x).strip() for x in df_results.iloc[i].tolist()]
                if 'Parameter' in row_str and 'Meas.' in row_str:
                    headers = [str(col).strip() if pd.notna(col) else f"Col_{idx}" for idx, col in enumerate(df_results.iloc[i].tolist())]
                    
                    j = i + 1
                    if j < len(df_results) and "um" in [str(x).strip() for x in df_results.iloc[j].tolist()]:
                         j += 1
                         
                    while j < len(df_results):
                        # Use type safety in checking the "Parameter" and "Metabolic" headers
                        current_header = str(df_results.iloc[j].iloc[0]).strip() if len(df_results.iloc[j]) > 0 else ""
                        if current_header in ["Metabolic", "Parameter", ""]:
                            break
                        
                        row = df_results.iloc[j]
                        entry = {}
                        for col_idx, col_name in enumerate(headers):
                             if col_name and "Col_" not in col_name:
                                  val = row.iloc[col_idx]
                                  if isinstance(val, datetime.time):
                                      val = str(val)
                                  entry[col_name] = val
                                  
                        if entry.get("Parameter") and pd.notna(entry["Parameter"]):
                            all_results.append(entry)
                        j += 1
            if all_results:
                results = all_results
            else:
                results = extract_cpet_results_sheet(df)

    result = {
        "profile": profile,
        "data_sheet": data_sheet,
        "results": results
    }

    return clean_empty_values(result)
