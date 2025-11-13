# Business Analytics Assignment Plugin

A comprehensive multi-agent workflow system for business analytics course assignments. This plugin orchestrates specialized AI agents to guide you through data analysis, regression modeling, and professional report generation.

## Overview

This plugin automates the complete business analytics assignment workflow:

```
Assignment PDF → Problem Framing → Data Analysis → Regression →
Deficiency Tables → Visualizations → Recommendations → R Markdown Report
```

### What This Plugin Does

- **Understands** your assignment requirements and business problem
- **Loads and inspects** your data for quality issues
- **Explores** patterns and relationships through EDA
- **Specifies** regression models with justified variable selection
- **Runs** OLS regression and statistical inference
- **Builds** deficiency tables decomposing performance gaps
- **Creates** publication-quality visualizations
- **Generates** business recommendations with expected impacts
- **Assembles** a complete R Markdown report ready for submission

### Multi-Agent Architecture

The plugin uses **9 specialized agents**, each expert in a specific analytical phase:

| Agent | Phase | Responsibility |
|-------|-------|----------------|
| `problem-framer` | 0-1 | Reads assignment, frames business problem |
| `data-inspector` | 2 | Loads data, performs quality checks |
| `eda-analyst` | 3 | Exploratory analysis, visualizations |
| `model-specifier` | 4 | Designs regression models with justifications |
| `regression-analyst` | 5-6 | Runs OLS, statistical inference |
| `deficiency-builder` | 7 | Creates deficiency tables |
| `viz-specialist` | 8 | Publication-quality visualizations |
| `business-advisor` | 9 | Synthesizes recommendations |
| `report-builder` | 10 | Assembles R Markdown report |

## Installation

### Prerequisites

- Claude Code CLI installed
- Python 3.8+ with packages:
  - `pandas`, `numpy`, `matplotlib`, `seaborn`, `scipy`, `statsmodels`
- R 4.0+ with packages:
  - `tidyverse`, `haven`, `knitr`, `kableExtra`, `stargazer`
- RStudio (recommended for R Markdown)

### Install Plugin

1. Clone or copy the `business-analytics` directory to your Claude Code plugins location:

```bash
# If you have a .claude directory:
cp -r business-analytics ~/.claude/plugins/

# Or place in your project:
cp -r business-analytics ./project/.claude/plugins/
```

2. Verify installation:

```bash
claude
# In Claude Code:
/help
# You should see /ba-assignment listed
```

## Usage

### Quick Start

1. **Prepare your files:**
   ```
   your-assignment/
   ├── assignment.pdf           # Assignment instructions
   ├── data/
   │   └── dataset.dta         # Your data file
   └── resources/              # Optional: course materials
   ```

2. **Start the workflow:**
   ```bash
   cd your-assignment
   claude
   ```

3. **Run the command:**
   ```
   /ba-assignment
   ```

4. **Provide file paths when prompted:**
   - Assignment PDF path
   - Data file path(s)
   - Any case materials
   - Project knowledge directory

5. **Follow the guided workflow:**
   - Review each agent's output
   - Confirm before proceeding to next phase
   - Provide clarifications when needed

### Workflow Phases

#### Phase 0-1: Problem Understanding (5-10 min)

**Agent:** `problem-framer`

**What it does:**
- Reads your assignment PDF
- Identifies business problem and stakeholder
- Determines analytical approach (benchmarking, A/B testing, etc.)
- Lists all questions to answer
- Maps variables to research questions

**Output:** `project_brief.md`

**Your role:** Review and confirm the problem framing is correct

---

#### Phase 2: Data Loading & Inspection (10-15 min)

**Agent:** `data-inspector`

**What it does:**
- Loads data into Python
- Checks for missing values, outliers, data quality issues
- Generates summary statistics
- Creates initial inspection report

**Output:**
- `notebooks/01_data_inspection.ipynb`
- `data_quality_report.md`
- `data/cleaned_data.csv` (if cleaning needed)

**Your role:** Review data issues and approve cleaning strategy

---

#### Phase 3: Exploratory Data Analysis (15-20 min)

**Agent:** `eda-analyst`

**What it does:**
- Calculates summary statistics
- Analyzes focal observation vs sample
- Creates correlation matrices
- Generates visualizations (scatter plots, histograms, box plots)
- Performs naive rankings

**Output:**
- `notebooks/02_exploratory_analysis.ipynb`
- `outputs/figures/eda/` (multiple visualizations)
- `outputs/tables/summary_statistics.csv`

**Your role:** Review patterns and note insights for model specification

---

#### Phase 4: Model Specification (15-20 min)

**Agent:** `model-specifier`

**What it does:**
- Classifies variables (structural vs actionable)
- Provides business justifications for each variable
- Determines functional forms (linear, log, interactions)
- Assesses omitted variable bias
- Specifies Part I and Part II models

**Output:** `model_specification.md`

**Your role:** **CRITICAL** - Review and confirm model specification before proceeding

---

#### Phase 5-6: Regression Analysis (20-25 min)

**Agent:** `regression-analyst`

**What it does:**
- Runs Part I regression (structural factors)
- Creates adjusted rankings based on residuals
- Runs Part II regression (with actionable variables)
- Performs statistical inference
- Calculates confidence intervals
- Checks model assumptions (residual plots, VIF)
- Interprets coefficients in business terms

**Output:**
- `notebooks/03_regression_analysis.ipynb`
- `outputs/tables/model1_coefficients.csv`
- `outputs/tables/model2_coefficients.csv`
- `outputs/tables/adjusted_rankings.csv`
- `outputs/figures/model1_diagnostics.png`

**Your role:** Review regression results and interpretations

---

#### Phase 7: Deficiency Tables (15-20 min)

**Agent:** `deficiency-builder`

**What it does:**
- Builds Part I deficiency table (structural factors)
- Builds Part II deficiency table (actionable factors)
- Calculates contributions (β̂·Δ) for each variable
- Identifies biggest contributors to performance gap
- Creates waterfall visualizations

**Output:**
- `notebooks/04_deficiency_analysis.ipynb`
- `outputs/tables/deficiency_part1.csv`
- `outputs/tables/deficiency_part2.csv`
- `outputs/figures/deficiency_waterfall_part1.png`

**Your role:** Review decomposition and note opportunities

---

#### Phase 8: Visualization (15-20 min)

**Agent:** `viz-specialist`

**What it does:**
- Creates regression fit plots
- Generates coefficient plots with CIs
- Creates ranking comparison visualizations
- Builds deficiency table charts
- Produces summary dashboard
- Ensures all plots are publication-quality (300 dpi)

**Output:**
- `notebooks/05_visualizations.ipynb`
- `outputs/figures/report/` (multiple figures ready for report)

**Your role:** Review visualizations for clarity and accuracy

---

#### Phase 9: Business Recommendations (15-20 min)

**Agent:** `business-advisor`

**What it does:**
- Synthesizes all analysis findings
- Translates statistics into business insights
- Develops prioritized recommendations
- Quantifies expected impacts
- Acknowledges limitations (correlation vs causation)
- Identifies next steps

**Output:** `business_recommendations.md`

**Your role:** Review recommendations for feasibility and clarity

---

#### Phase 10: R Markdown Report (20-30 min)

**Agent:** `report-builder`

**What it does:**
- Creates R Markdown document structured by assignment questions
- Imports Python analysis results
- Includes all tables and figures
- Writes interpretations in plain English
- Formats professionally with proper citations
- Compiles to PDF

**Output:**
- `report.Rmd`
- `report.pdf`

**Your role:** Review PDF, make final edits if needed, submit!

---

#### Phase 11: Quality Assurance (10 min)

**What you do:**
- Check all questions answered
- Verify numbers are consistent
- Ensure visualizations are clear
- Confirm code is reproducible
- Proofread text
- Submit!

---

### Total Time: 2.5-3.5 hours (vs 8-12 hours manual)

## File Structure

After running the workflow, you'll have:

```
your-assignment/
├── project_brief.md                    # Problem framing
├── model_specification.md              # Model design
├── business_recommendations.md         # Strategic recommendations
├── data_quality_report.md             # Data inspection results
├── report.Rmd                         # R Markdown source
├── report.pdf                         # Final submission
├── data/
│   ├── dataset.dta                    # Original data
│   └── cleaned_data.csv               # Cleaned data
├── notebooks/
│   ├── 01_data_inspection.ipynb
│   ├── 02_exploratory_analysis.ipynb
│   ├── 03_regression_analysis.ipynb
│   ├── 04_deficiency_analysis.ipynb
│   └── 05_visualizations.ipynb
└── outputs/
    ├── figures/
    │   ├── eda/                       # EDA plots
    │   └── report/                    # Report-ready figures
    └── tables/                        # All result tables (CSV)
```

## Customization

### Adjust for Your Course

Edit `commands/ba-assignment.md` to modify:
- Specific assignment requirements
- Grading rubric emphasis
- Report formatting requirements
- Number of phases

### Modify Agent Behavior

Edit individual agent files in `agents/` to:
- Change analytical approaches
- Add/remove analytical steps
- Adjust output formats
- Include course-specific techniques

### Add Course Materials

Place course materials in a `resources/` directory:
- Lecture slides (PDF)
- Past assignment solutions
- Case studies
- Textbook excerpts

Agents will search these when needed for guidance.

## Tips for Best Results

### Before Running

1. **Read the assignment** yourself first - understand what's being asked
2. **Organize files** clearly - clear file paths prevent issues
3. **Check data file** - ensure it loads correctly in Python/R
4. **Review variable names** - know what each column represents

### During Workflow

1. **Review each phase** - don't blindly accept agent outputs
2. **Ask questions** - if something is unclear, ask Claude to explain
3. **Provide context** - share business knowledge agents might not have
4. **Iterate if needed** - you can re-run phases with adjustments

### For Model Specification (Phase 4)

**This is the most critical phase.** Take time to:
- Ensure business justifications make sense
- Check that structural vs actionable classification is correct
- Verify functional forms are appropriate
- Consider omitted variables seriously

A good model specification → good regression results → good recommendations

### For Report Building (Phase 10)

- **Personalize interpretations** - make sure language sounds like you
- **Add examples** - concrete business examples strengthen arguments
- **Check consistency** - ensure numbers match across all sections
- **Proofread carefully** - agents are good but not perfect at grammar

## Troubleshooting

### "File not found" errors

- Check file paths are absolute or relative to project root
- Use forward slashes `/` even on Windows
- Verify file actually exists at that path

### Python packages missing

```bash
pip install pandas numpy matplotlib seaborn scipy statsmodels
```

### R packages missing

```r
install.packages(c("tidyverse", "haven", "knitr", "kableExtra", "stargazer"))
```

### R Markdown won't compile

- Install LaTeX: `install.packages("tinytex"); tinytex::install_tinytex()`
- Check for special characters that need escaping: `\&`, `\%`, `\_`
- Verify all figure paths are correct

### Agent produces incorrect analysis

- Provide more context about your specific business problem
- Review and edit the output before proceeding
- Ask Claude to revise with specific guidance
- Edit agent instructions in `agents/` for future assignments

### Results don't match expectations

- Check model specification - are the right variables included?
- Review data quality - any outliers or errors?
- Consider if expectations are realistic given the data
- Discuss with instructor if unsure

## Course-Specific Adaptations

### For Different Analysis Types

**A/B Testing / Experiments:**
- Modify agents to focus on treatment effects
- Add difference-in-differences analysis
- Include parallel trends checks

**Prediction / Forecasting:**
- Add cross-validation agents
- Include out-of-sample testing
- Add prediction accuracy metrics

**Optimization:**
- Add constraint specification
- Include sensitivity analysis
- Calculate optimal values

### For Different Data Types

**Panel Data:**
- Add fixed effects models
- Include time trend analysis
- Handle repeated observations

**Time Series:**
- Add autocorrelation checks
- Include lagged variables
- Test for stationarity

**Survey Data:**
- Handle Likert scales
- Include factor analysis
- Adjust for sampling weights

## Advanced Features

### Parallel Agent Execution

The workflow runs agents sequentially by default, but you can request parallel execution:

```
/ba-assignment

# When at Phase 3, you can say:
"Run both the EDA analysis and model specification in parallel"
```

### Custom Agent Prompts

You can override agent behavior with custom instructions:

```
"For the regression analysis, also include:
- Heteroskedasticity-robust standard errors
- Polynomial terms for experience
- Interaction between region and market size"
```

### Integration with Course Resources

If you have a `resources/` directory with course materials:

```
resources/
├── lectures/
│   ├── regression_lecture.pdf
│   └── deficiency_tables_lecture.pdf
├── solutions/
│   └── assignment1_solution.pdf
└── textbook/
    └── chapter5.pdf
```

Agents will reference these automatically when they need guidance.

## FAQ

**Q: Do I need to know Python and R?**

A: Basic familiarity helps, but agents generate most code. You should understand what the code does to verify correctness.

**Q: Can I use this for group projects?**

A: Yes! Each team member can run different phases, then merge results. Clearly document who did what.

**Q: Will my professor know I used this?**

A: The plugin is a productivity tool, like using Excel or SPSS. You still need to:
- Understand the analysis
- Verify correctness
- Provide business insights
- Write in your own voice

Always follow your course's academic integrity policies.

**Q: What if my assignment is slightly different?**

A: The workflow is flexible. Skip phases that don't apply, or ask Claude to adapt specific steps.

**Q: Can I edit the generated code?**

A: Absolutely! The code is yours. Edit Python notebooks and R Markdown as needed.

**Q: How do I cite this in my report?**

A: Mention tools used in a methodology section:
> "Analysis conducted using Python (pandas, statsmodels) and R (tidyverse). Report generated with R Markdown."

**Q: Does this guarantee a good grade?**

A: No tool guarantees grades. This ensures:
- ✅ Technical correctness (if data/specification are right)
- ✅ Professional presentation
- ✅ Complete analysis
- ❌ But NOT: Business insight (you provide), Domain knowledge (you provide), Creative thinking (you provide)

## Contributing

Found a bug or have an improvement?

1. Edit the relevant agent file in `agents/`
2. Test with a sample assignment
3. Document the change
4. Share with classmates (if allowed by course policy)

## License

This plugin is designed for educational use in business analytics courses.

## Support

- **Claude Code docs:** https://docs.claude.com/en/docs/claude-code
- **Course instructor:** Your professor/TA
- **Classmates:** Form study groups to share learnings

## Version History

- **v1.0** (2024): Initial release
  - 9 specialized agents
  - Complete workflow from assignment to report
  - Python + R Markdown integration
  - Publication-quality outputs

---

**Happy analyzing! 📊📈**

Remember: This tool helps you work *efficiently*, but **understanding** the analysis is still your job. Review everything, ask questions, and learn from each assignment.
