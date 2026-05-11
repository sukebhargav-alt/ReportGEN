def build_profiling_section_prompt(section_name: str, profile: dict, formatted_entries_text: str) -> str:
    if section_name.lower() == "physiological":
        return f"""
You are a high-performance sports scientist working in an elite performance lab.

Athlete Profile:
{profile}

Physiological Assessment Data:
{formatted_entries_text}

Write a structured interpretation in 2 paragraphs:

1. Performance Summary (what the numbers indicate)
2. Risk or Limitation Identification (imbalances, deficits, red flags) and Practical Performance Implication (impact on sport performance)

Constraints:
- No Repetitive Content
- Paragraphs to be 75–100 words each
- Clinical, objective tone
- No fluff
- No bullet points
"""
    elif section_name.lower() == "biomechanics":
        return f"""
You are a high-performance sports biomechanist.

Athlete Profile:
{profile}

Biomechanical Assessment Data:
{formatted_entries_text}

Write a structured interpretation in 5 paragraphs:

1. Upper Body Analysis
2. Lower Body Analysis
3. Identified Imbalances
4. Performance Implications
5. Sport-specific recommendations

Constraints:
- Dont Consider Trunk flexion and Trunk Extension imbalances and dont mention them in the report
- Give section headers clearly and maintain structure
- Concise, 80–120 words
- Technical and objective
- No motivational language
- No bullet points
"""
    elif section_name.lower() == "neuromuscular":
        return f"""
You are a neuromuscular performance specialist.

Athlete Profile:
{profile}

Neuromuscular Assessment Data:
{formatted_entries_text}

Write a structured interpretation in 4 paragraphs:

1. Explosive / Reactive Performance Summary
2. Asymmetry or Deficit Identification
3. Injury Risk Indicators
4. Sport-specific recommendations

Constraints:
- No Repetitive content
- Concise, 80–120 words
- Clinical tone
- No fluff
- No bullet points
"""
    elif section_name.lower() == "cognitive":
        return f"""
You are a cognitive performance analyst in elite sport.

Athlete Profile:
{profile}

Cognitive Assessment Data:
{formatted_entries_text}

Write a structured interpretation in 3 paragraphs:

1. Reaction / Decision-Making Summary
2. Fatigue or Processing Limitations
3. Performance Impact and Sport-specific recommendations

Constraints:
- No Repetitive Content
- Concise, 60–100 words
- Professional tone
- No fluff
- No bullet points
"""
    else:
        return f"""
You are a high-performance sports scientist.

Athlete Profile:
{profile}

Section: {section_name}

Assessment Data:
{formatted_entries_text}

Write a structured professional interpretation (150–200 words).
Be objective and technical.
"""
