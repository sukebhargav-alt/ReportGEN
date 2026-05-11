def build_cpet_interpretation_prompt(system_name: str, profile: dict, results: list) -> str:
    if system_name == "Overall Interpretation":
        focus_instruction = "Focus on providing a holistic, overall summary of the athlete's cardiovascular, metabolic, and ventilatory performance including VO2 max comparison. IMPORTANT: When analyzing VT1 and VT2, you MUST use Heart Rate (HR) values instead of VO2 values."
        section_constraints = """
- 1. Data Interpretation: 90 words
- 2. Performance Risk Assessment: 90 words
- 3. Key Findings: 90 words
        """.strip()
    elif system_name == "Cardiovascular System":
        focus_instruction = (
            "Focus strictly and ONLY on these specific variables: Heart Rate (HR), Heart Rate Reserve (HRR). "
            "IMPORTANT: At the very end of your interpretation, you MUST include a separate paragraph titled 'Aerobic Capacity Interpretation' "
            "that specifically analyzes the athlete's aerobic capacity and peak output performance markers. "
            "Keep this specific Aerobic Capacity paragraph extremely concise (maximum 3-4 sentences)."
        )
        section_constraints = """
- 1. Data Interpretation: 50 words
- 2. Performance Risk Assessment: 50 words
- 3. Key Findings: 50 words
        """.strip()
    elif system_name == "Ventilation System":
        focus_instruction = (
            "Focus strictly and ONLY on these specific variables: VO2, VO2 max (compare with ACSM norms), VCO2, Respiratory Frequency (RF), and O2 pulse (VO2/HR). "
            "IMPORTANT: At the very end of your interpretation, you MUST include a separate paragraph titled 'Ventilatory Thresholds Interpretation' "
            "that specifically analyzes the athlete's ventilatory equivalents (VE/VO2, VE/VCO2) and the identification of VT1/VT2 markers. "
            "Keep this specific Ventilatory Thresholds paragraph extremely concise (maximum 3-4 sentences)."
        )
        section_constraints = """
- 1. Data Interpretation: 50 words
- 2. Performance Risk Assessment: 50 words
- 3. Key Findings: 50 words
        """.strip()
    elif system_name == "Ventilatory Perfusion":
        focus_instruction = "Focus strictly and ONLY on these specific variables: VT1, VT2, PetO2, and PetCO2. IMPORTANT: You MUST explicitly state the numerical values of VT1 and VT2 and their respective heart rates in your analysis."
        section_constraints = """
- 1. Data Interpretation: 50 words
- 2. Performance Risk Assessment: 50 words
- 3. Key Findings: 50 words
        """.strip()
    elif system_name == "Metabolic System":
        focus_instruction = (
            "Focus strictly and ONLY on these specific variables: RQ (Respiratory Quotient), EEh, and METS. "
            "IMPORTANT: At the very end of your interpretation, you MUST include a separate paragraph titled 'RQ & HR vs Time Interpretation' "
            "that specifically analyzes the relationship between RQ and Heart Rate over time, focusing on the metabolic crossover point. "
            "Keep this specific RQ & HR vs Time Interpretation paragraph extremely concise (maximum 3-4 sentences)."
        )
        section_constraints = """
- 1. Data Interpretation: 50 words
- 2. Performance Risk Assessment: 50 words
- 3. Key Findings: 50 words
        """.strip()
    else:
        focus_instruction = f"Focus strictly on the selected variables for the {system_name}."
        section_constraints = """
- 1. Data Interpretation: 50 words
- 2. Performance Risk Assessment: 50 words
- 3. Key Findings: 90 words
        """.strip()

    overall_bullet_instruction = ""
    if system_name == "Overall Interpretation":
        overall_bullet_instruction = "IMPORTANT: You MUST write the ENTIRE interpretation strictly in bullet points. Do not write any paragraphs. Every point MUST be a bullet."

    return f"""
You are an elite sports physiologist and CPET (Cardiopulmonary Exercise Testing) analyst.

Athlete Profile:
{profile}

CPET Results Data:
{results}

Focusing specifically on the **{system_name}**, write a structured interpretation of this VO2/kg / CPET test.
You MUST use ACSM (American College of Sports Medicine) Standard normative values to compare the athlete's results against a baseline.

{focus_instruction}
{overall_bullet_instruction}
Do NOT mention or analyze variables outside of your assigned specific variables.

Strictly follow this 3-part framework (use these exact headings):
1. Data Interpretation
   (Compare the specific variables relevant to the {system_name} against ACSM normative standard values.)
2. Performance Risk Assessment
   (Identify specific deficits, limits, imbalances, or potential systemic risks in the {system_name}. Do NOT use numeric ranges or specific data values here; instead, clearly describe the qualitative findings and their implications for the athlete's current performance level.)
3. Key Findings
   (Explain how these {system_name} characteristics practically influence performance in the athlete's specified sport and provide actionable takeaways.)

Constraints:
- Strictly objective, clinical tone.
- Per-section word count constraints:
{section_constraints}
- Do not use motivational language.
- Provide actionable insights based strictly on the provided data and ACSM normative standards.
- Do NOT use outside references, external standard formulas not provided, or variables absent from the provided CPET data. Keep interpretations STRICTLY to the provided excel data. Specifically, note that we are using HRR to mean 'Heart Rate Reserve' (not Heart Rate Recovery) – evaluate it as such.
- Do NOT make unsupported claims about environmental conditions (e.g., "High temperature and humidity") affecting the results.
- Do NOT use the phrase "Unconfirmed Max Effort" or claim the effort was unconfirmed.
- Do NOT state that Heart Rate Reserve (HRR) or any other data point is missing or not provided. Treat the provided data as complete.
- Ensure descriptions of Respiratory Frequency (RF) strictly align with whether the data is above or below normal athletic ranges. Avoid making contradictory statements in different paragraphs.
- Accurately categorize the athlete's specific sport (e.g., Rally car racing is a motorsport, NOT an acrobatic sport).
""" 
