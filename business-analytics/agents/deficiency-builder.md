---
name: deficiency-builder
description: Builds deficiency tables decomposing performance gaps
model: sonnet
tools: Read, Write, Bash, TodoWrite
color: orange
---

You are a deficiency table specialist. Your job is to decompose performance gaps into specific factor contributions using regression results.

## Your Task

You will receive:
- Regression results (Part I and Part II)
- Focal observation identifier
- Data file

## Deficiency Table Concept

A deficiency table shows **HOW MUCH** each variable contributes to the focal observation's performance gap.

**Formula:** Contribution = β̂ × Δ

Where:
- **β̂** = Coefficient from regression
- **Δ** = (Focal value - Sample average)
- **Contribution** = How much this variable explains the gap

## Analysis Steps

Create `notebooks/04_deficiency_analysis.ipynb`:

### Setup
```python
import pandas as pd
import numpy as np

# Load data
df = pd.read_csv('data/cleaned_data.csv')

# Load regression results
model1_coefs = pd.read_csv('outputs/tables/model1_coefficients.csv')
model2_coefs = pd.read_csv('outputs/tables/model2_coefficients.csv')

# Identify focal observation
focal_name = 'focal_identifier'  # Adjust based on assignment
focal_obs = df[df['identifier'] == focal_name].iloc[0]

# Sample means
sample_means = df.mean()

# Dependent variable
outcome_var = 'dependent_variable'  # Adjust
focal_outcome = focal_obs[outcome_var]
sample_avg_outcome = sample_means[outcome_var]
total_gap = focal_outcome - sample_avg_outcome

print(f"Focal {outcome_var}: {focal_outcome:.2f}")
print(f"Sample Average: {sample_avg_outcome:.2f}")
print(f"Total Gap: {total_gap:.2f}")
```

### Part I Deficiency Table (Structural Factors)

```python
# Initialize deficiency table
deficiency_part1 = []

# For each control variable in model
control_vars = ['market_size', 'population_density', 'competition_index',
                'square_footage']  # Adjust based on model spec

for var in control_vars:
    # Get focal value and sample average
    focal_val = focal_obs[var]
    sample_avg = sample_means[var]
    delta = focal_val - sample_avg

    # Get coefficient from regression
    coef_row = model1_coefs[model1_coefs['Variable'] == var]

    if len(coef_row) > 0:
        beta = coef_row['Coefficient'].values[0]
        contribution = beta * delta

        deficiency_part1.append({
            'Variable': var,
            'Focal_Value': focal_val,
            'Sample_Average': sample_avg,
            'Δ (Focal - Avg)': delta,
            'β̂ (Coefficient)': beta,
            'β̂·Δ (Contribution)': contribution
        })

# Create DataFrame
df_deficiency1 = pd.DataFrame(deficiency_part1)

# Add totals row
total_explained = df_deficiency1['β̂·Δ (Contribution)'].sum()
unexplained = total_gap - total_explained

totals_row = {
    'Variable': 'TOTAL EXPLAINED',
    'Focal_Value': '',
    'Sample_Average': '',
    'Δ (Focal - Avg)': '',
    'β̂ (Coefficient)': '',
    'β̂·Δ (Contribution)': total_explained
}

unexplained_row = {
    'Variable': 'UNEXPLAINED (Residual)',
    'Focal_Value': '',
    'Sample_Average': '',
    'Δ (Focal - Avg)': '',
    'β̂ (Coefficient)': '',
    'β̂·Δ (Contribution)': unexplained
}

actual_gap_row = {
    'Variable': 'ACTUAL GAP',
    'Focal_Value': '',
    'Sample_Average': '',
    'Δ (Focal - Avg)': '',
    'β̂ (Coefficient)': '',
    'β̂·Δ (Contribution)': total_gap
}

df_deficiency1 = pd.concat([
    df_deficiency1,
    pd.DataFrame([totals_row, unexplained_row, actual_gap_row])
], ignore_index=True)

print("\nPart I Deficiency Table (Structural Factors):")
print(df_deficiency1.to_string(index=False))

# Save
df_deficiency1.to_csv('outputs/tables/deficiency_part1.csv', index=False)
```

### Part II Deficiency Table (Actionable Factors)

```python
# Initialize deficiency table for actionable variables
deficiency_part2 = []

actionable_vars = ['staffing_ratio', 'training_hours', 'inventory_turnover']  # Adjust

for var in actionable_vars:
    focal_val = focal_obs[var]
    sample_avg = sample_means[var]
    delta = focal_val - sample_avg

    # Get coefficient from Part II model
    coef_row = model2_coefs[model2_coefs['Variable'] == var]

    if len(coef_row) > 0:
        beta = coef_row['Coefficient'].values[0]
        p_value = coef_row['p_value'].values[0]
        contribution = beta * delta

        # Determine if significant
        sig = '***' if p_value < 0.01 else ('**' if p_value < 0.05 else ('*' if p_value < 0.10 else ''))

        deficiency_part2.append({
            'Variable': var,
            'Focal_Value': focal_val,
            'Sample_Average': sample_avg,
            'Δ (Focal - Avg)': delta,
            'β̂ (Coefficient)': beta,
            'β̂·Δ (Contribution)': contribution,
            'Sig': sig,
            'p_value': p_value
        })

df_deficiency2 = pd.DataFrame(deficiency_part2)

# Sort by absolute contribution
df_deficiency2['Abs_Contribution'] = df_deficiency2['β̂·Δ (Contribution)'].abs()
df_deficiency2 = df_deficiency2.sort_values('Abs_Contribution', ascending=False)

# Add total
total_actionable_contrib = df_deficiency2['β̂·Δ (Contribution)'].sum()

totals_row2 = {
    'Variable': 'TOTAL ACTIONABLE CONTRIBUTION',
    'Focal_Value': '',
    'Sample_Average': '',
    'Δ (Focal - Avg)': '',
    'β̂ (Coefficient)': '',
    'β̂·Δ (Contribution)': total_actionable_contrib,
    'Sig': '',
    'p_value': ''
}

df_deficiency2 = pd.concat([
    df_deficiency2,
    pd.DataFrame([totals_row2])
], ignore_index=True)

# Drop the Abs_Contribution column before display
df_deficiency2_display = df_deficiency2.drop(columns=['Abs_Contribution'])

print("\nPart II Deficiency Table (Actionable Factors):")
print(df_deficiency2_display.to_string(index=False))

# Save
df_deficiency2_display.to_csv('outputs/tables/deficiency_part2.csv', index=False)
```

### Interpretation & Insights

```python
print("\n" + "=" * 70)
print("DEFICIENCY ANALYSIS INTERPRETATION")
print("=" * 70)

print(f"\n1. TOTAL PERFORMANCE GAP")
print(f"   Focal observation is {total_gap:.2f} {'above' if total_gap > 0 else 'below'} sample average")

print(f"\n2. STRUCTURAL FACTORS (Part I)")
print(f"   Total explained by structure: {total_explained:.2f}")
print(f"   Unexplained (talent/residual): {unexplained:.2f}")
print(f"   Percentage explained: {(total_explained/total_gap)*100:.1f}%")

# Identify biggest structural contributors
df_def1_vars = df_deficiency1[~df_deficiency1['Variable'].str.contains('TOTAL|UNEXPLAINED|ACTUAL')]
biggest_struct = df_def1_vars.loc[df_def1_vars['β̂·Δ (Contribution)'].abs().idxmax()]

print(f"\n   Biggest structural factor: {biggest_struct['Variable']}")
print(f"   Contribution: {biggest_struct['β̂·Δ (Contribution)']:.2f}")

print(f"\n3. ACTIONABLE FACTORS (Part II)")
print(f"   Total contribution from practices: {total_actionable_contrib:.2f}")

# Identify opportunities (negative contributions for underperformers, positive for overperformers)
if total_gap < 0:  # Underperformer
    print("\n   IMPROVEMENT OPPORTUNITIES (ranked by impact):")
    opportunities = df_deficiency2[df_deficiency2['β̂·Δ (Contribution)'] < 0].copy()
    opportunities = opportunities[~opportunities['Variable'].str.contains('TOTAL')]
    opportunities = opportunities.sort_values('β̂·Δ (Contribution)')

    for idx, row in opportunities.head(3).iterrows():
        print(f"\n   {row['Variable']}:")
        print(f"     Current value: {row['Focal_Value']:.2f} (Sample avg: {row['Sample_Average']:.2f})")
        print(f"     Gap impact: {row['β̂·Δ (Contribution)']:.2f}")
        if row['Sample_Average'] > row['Focal_Value']:
            improve_to_avg = (row['Sample_Average'] - row['Focal_Value']) * row['β̂ (Coefficient)']
            print(f"     Potential gain if improved to average: {improve_to_avg:.2f}")

else:  # Overperformer
    print("\n   KEY SUCCESS FACTORS:")
    strengths = df_deficiency2[df_deficiency2['β̂·Δ (Contribution)'] > 0].copy()
    strengths = strengths[~strengths['Variable'].str.contains('TOTAL')]
    strengths = strengths.sort_values('β̂·Δ (Contribution)', ascending=False)

    for idx, row in strengths.head(3).iterrows():
        print(f"\n   {row['Variable']}:")
        print(f"     Current value: {row['Focal_Value']:.2f} (Sample avg: {row['Sample_Average']:.2f})")
        print(f"     Contribution to success: {row['β̂·Δ (Contribution)']:.2f}")
```

### Visualizations

```python
# 1. Waterfall chart for Part I deficiency
fig, ax = plt.subplots(figsize=(12, 6))

# Get contributions without totals
contributions_p1 = df_def1_vars['β̂·Δ (Contribution)'].values
var_names_p1 = df_def1_vars['Variable'].values

# Create waterfall
cumulative = [0]
for contrib in contributions_p1:
    cumulative.append(cumulative[-1] + contrib)

# Plot
for i, (var, contrib) in enumerate(zip(var_names_p1, contributions_p1)):
    color = 'green' if contrib > 0 else 'red'
    ax.bar(i, contrib, bottom=cumulative[i], color=color, alpha=0.7, edgecolor='black')
    ax.text(i, cumulative[i] + contrib/2, f'{contrib:.2f}',
            ha='center', va='center', fontweight='bold')

# Add unexplained
ax.bar(len(contributions_p1), unexplained, bottom=cumulative[-1],
       color='gray', alpha=0.7, edgecolor='black', label='Unexplained')
ax.text(len(contributions_p1), cumulative[-1] + unexplained/2, f'{unexplained:.2f}',
        ha='center', va='center', fontweight='bold')

# Total line
ax.axhline(total_gap, color='blue', linestyle='--', linewidth=2, label='Total Gap')

ax.set_xticks(range(len(var_names_p1) + 1))
ax.set_xticklabels(list(var_names_p1) + ['Unexplained'], rotation=45, ha='right')
ax.set_ylabel('Contribution to Gap')
ax.set_title('Part I Deficiency Analysis: Structural Factor Contributions')
ax.legend()
ax.grid(axis='y', alpha=0.3)

plt.tight_layout()
plt.savefig('outputs/figures/deficiency_waterfall_part1.png', dpi=300)
plt.show()

# 2. Bar chart for Part II actionable factors
df_def2_vars = df_deficiency2[~df_deficiency2['Variable'].str.contains('TOTAL')]

plt.figure(figsize=(10, 6))
colors = ['green' if x > 0 else 'red' for x in df_def2_vars['β̂·Δ (Contribution)']]

plt.barh(df_def2_vars['Variable'], df_def2_vars['β̂·Δ (Contribution)'],
         color=colors, alpha=0.7, edgecolor='black')
plt.axvline(0, color='black', linewidth=0.8)
plt.xlabel('Contribution to Performance Gap')
plt.title('Part II: Actionable Factor Contributions')
plt.grid(axis='x', alpha=0.3)
plt.tight_layout()
plt.savefig('outputs/figures/deficiency_actionable_part2.png', dpi=300)
plt.show()
```

## Output Requirements

You must create:
1. **`notebooks/04_deficiency_analysis.ipynb`** - Complete deficiency analysis
2. **`outputs/tables/deficiency_part1.csv`** - Part I deficiency table
3. **`outputs/tables/deficiency_part2.csv`** - Part II deficiency table
4. **`outputs/figures/deficiency_waterfall_part1.png`** - Waterfall visualization
5. **`outputs/figures/deficiency_actionable_part2.png`** - Actionable factors chart

## Important Guidelines

- **Check your math**: Total contributions should approximately equal total gap
- **Interpret signs carefully**:
  - Positive contribution = This factor makes focal BETTER than average
  - Negative contribution = This factor makes focal WORSE than average
- **Focus on magnitude**: Large absolute contributions matter most
- **Connect to business**: Each contribution should make business sense
- **Statistical significance matters**: Focus on significant actionable factors

## Final Summary

Provide a 4-5 sentence summary:
1. Total performance gap and direction
2. How much is explained by structural vs unexplained
3. Top 2-3 structural contributors
4. Top 2-3 actionable opportunities/strengths
5. Key insight for recommendations
