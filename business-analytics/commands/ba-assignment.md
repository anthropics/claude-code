---
allowed-tools: Task, Read, Write, Bash, Glob, Grep, TodoWrite
description: Complete business analytics assignment workflow with multi-agent analysis
---

You are orchestrating a complete business analytics assignment workflow. This is a **structured 11-phase process** with specialized agents for each analytical component.

## Context

The user is working on a business analytics course assignment that involves:
- Understanding a business problem from case materials
- Loading and analyzing data (Python)
- Running regression analysis (Python)
- Building deficiency tables (Python)
- Creating an R Markdown report with interpretations

## Workflow Overview

You will launch specialized agents sequentially, with each phase building on previous results. After each agent completes, you'll aggregate results and provide context to the next agent.

---

## PHASE 0-1: PROBLEM UNDERSTANDING & FRAMING

**Actions:**
1. Ask the user to provide:
   - Assignment PDF path
   - Data file path(s)
   - Any case study materials
   - Project knowledge/resources directory

2. Launch **problem-framer** agent with these files to:
   - Read assignment requirements
   - Identify the business problem and stakeholder
   - Determine analytical approach needed
   - List specific questions to answer
   - Understand data structure and variables

3. Once agent returns, create a `project_brief.md` with:
   - Business problem statement
   - Analytical approach (benchmarking, A/B testing, prediction, etc.)
   - List of deliverables
   - Key variables identified

**Output:** `project_brief.md`

---

## PHASE 2: DATA LOADING & INSPECTION

**Actions:**
1. Launch **data-inspector** agent to:
   - Load data into Python (pandas)
   - Perform data quality checks
   - Generate summary statistics
   - Identify data issues (missing values, outliers)
   - Create initial inspection notebook

2. Agent creates: `notebooks/01_data_inspection.ipynb`

3. Review the notebook and identify any data issues that need addressing

**Output:** `notebooks/01_data_inspection.ipynb`, data quality report

---

## PHASE 3: EXPLORATORY DATA ANALYSIS

**Actions:**
1. Launch **eda-analyst** agent with:
   - Data file path
   - Key variables from project brief
   - Focal observation identifier (if applicable)

2. Agent performs:
   - Summary statistics by group
   - Correlation analysis
   - Naive rankings/comparisons
   - Creates visualizations (scatter plots, histograms, box plots)
   - Identifies patterns and relationships

3. Agent creates: `notebooks/02_exploratory_analysis.ipynb` and `outputs/figures/eda/`

4. Review EDA findings and note key patterns for model specification

**Output:** `notebooks/02_exploratory_analysis.ipynb`, visualization files

---

## PHASE 4: MODEL SPECIFICATION

**Actions:**
1. Launch **model-specifier** agent with:
   - EDA results
   - Assignment questions
   - Project knowledge resources

2. Agent determines:
   - Control variables (structural factors) with business justifications
   - Actionable variables (management practices) with justifications
   - Functional form (linear, log, polynomials, interactions)
   - Potential omitted variable bias
   - Benchmarking group definition (if needed)

3. Agent creates: `model_specification.md` with:
   - Part I model (benchmarking with controls)
   - Part II model (with actionable variables)
   - Variable justifications
   - OVB assessment

4. Review specification and confirm with user before proceeding

**Output:** `model_specification.md`

---

## PHASE 5-6: REGRESSION ANALYSIS & INFERENCE

**Actions:**
1. Launch **regression-analyst** agent with:
   - Data file
   - Model specification
   - Focal observation identifier

2. Agent performs:
   - Part I regression (benchmarking/structural)
   - Residual-based ranking
   - Comparison of naive vs adjusted rankings
   - Part II regression (with actionable variables)
   - Statistical significance testing
   - Confidence interval calculation
   - Coefficient interpretation in business terms

3. Agent creates:
   - `notebooks/03_regression_analysis.ipynb`
   - `outputs/tables/regression_results.csv`
   - `outputs/tables/rankings.csv`
   - `outputs/tables/coefficients_with_ci.csv`

4. Review regression results and interpretations

**Output:** Regression notebooks and result tables

---

## PHASE 7: DEFICIENCY TABLE & DECOMPOSITION

**Actions:**
1. Launch **deficiency-builder** agent with:
   - Regression results
   - Focal observation identifier
   - Model specifications

2. Agent builds:
   - Part I deficiency table (structural factors)
   - Part II deficiency table (actionable factors)
   - Calculates contributions (β̂·Δ) for each variable
   - Compares total explained vs actual gap
   - Identifies unexplained performance

3. Agent creates:
   - `outputs/tables/deficiency_part1.csv`
   - `outputs/tables/deficiency_part2.csv`
   - Formatted tables ready for report

**Output:** Deficiency tables

---

## PHASE 8: VISUALIZATION FOR COMMUNICATION

**Actions:**
1. Launch **viz-specialist** agent with:
   - All analysis results
   - Assignment questions
   - Focal observation

2. Agent creates professional visualizations:
   - Regression fit plots with focal observation highlighted
   - Coefficient plots with confidence intervals
   - Deficiency table visualizations
   - Ranking comparison charts
   - Summary dashboard if appropriate

3. Agent ensures all plots are:
   - High resolution (300 dpi)
   - Properly labeled
   - Publication quality
   - Saved in `outputs/figures/`

**Output:** Publication-quality visualization files

---

## PHASE 9: BUSINESS RECOMMENDATIONS

**Actions:**
1. Launch **business-advisor** agent with:
   - All analysis results
   - Regression interpretations
   - Deficiency tables
   - Assignment questions

2. Agent synthesizes:
   - Key findings from analysis
   - Structural vs actionable factor insights
   - Prioritized recommendations based on:
     - Statistical significance
     - Economic magnitude
     - Feasibility
   - Quantified expected impacts
   - Limitations and caveats
   - Correlation vs causation discussion

3. Agent creates: `business_recommendations.md`

**Output:** `business_recommendations.md`

---

## PHASE 10: R MARKDOWN REPORT ASSEMBLY

**Actions:**
1. Launch **report-builder** agent with:
   - Assignment questions
   - All Python analysis outputs
   - All visualizations
   - Business recommendations
   - Project brief

2. Agent creates: `report.Rmd` that:
   - Structures content by assignment question
   - Imports Python analysis results
   - Includes relevant tables and figures
   - Provides clear interpretations in plain English
   - Shows all code (Python + R)
   - Meets submission requirements
   - Is properly formatted and professional

3. Agent then compiles: `report.pdf`

4. Review the PDF for completeness and quality

**Output:** `report.Rmd` and `report.pdf`

---

## PHASE 11: QUALITY ASSURANCE

**Actions:**
1. Create a checklist reviewing:
   - All assignment questions answered
   - Justifications provided where required
   - Statistical analysis correct
   - Interpretations in business language
   - Visualizations clear and professional
   - Code reproducible
   - Meets submission requirements

2. If issues found, loop back to relevant phase and fix

3. When quality checks pass, mark assignment as ready for submission

**Output:** Final reviewed PDF ready for submission

---

## IMPORTANT GUIDELINES

**Between Phases:**
- Always save intermediate outputs
- Review each agent's work before proceeding
- Ask user for clarification if needed
- Keep user informed of progress

**File Organization:**
- Use consistent directory structure:
  ```
  assignment_name/
  ├── data/
  ├── notebooks/
  ├── outputs/
  │   ├── figures/
  │   └── tables/
  ├── project_brief.md
  ├── model_specification.md
  ├── business_recommendations.md
  ├── report.Rmd
  └── report.pdf
  ```

**Code Quality:**
- All Python code should be well-commented
- Use meaningful variable names
- Follow best practices from course materials
- Ensure reproducibility

**Communication:**
- Interpret statistics in business language
- Avoid unnecessary jargon
- Connect analysis back to original problem
- Be precise with numbers

**Limitations:**
- Always acknowledge assumptions
- Discuss correlation vs causation
- Identify unexplained variation
- Note data limitations

---

## Getting Started

Ask the user to provide the required files, then begin with Phase 0-1 by launching the problem-framer agent.
