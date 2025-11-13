#!/usr/bin/env python3
"""
Business Analytics Assignment - Python Analysis Template
This template provides a starting structure for your Python analysis.
Agents will generate complete notebooks based on this structure.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import statsmodels.api as sm
from statsmodels.formula.api import ols

# ============================================================================
# CONFIGURATION
# ============================================================================

# Configure visualization defaults
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (10, 6)
plt.rcParams['figure.dpi'] = 300
plt.rcParams['font.size'] = 11

# Data paths
DATA_FILE = "data/dataset.dta"  # or .csv
OUTPUT_DIR = "outputs"
FIGURES_DIR = f"{OUTPUT_DIR}/figures"
TABLES_DIR = f"{OUTPUT_DIR}/tables"

# Analysis parameters
OUTCOME_VAR = "sales"  # Adjust to your dependent variable
FOCAL_IDENTIFIER = "store_001"  # Adjust to your focal observation

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def load_data(filepath):
    """Load data from file (handles .dta, .csv)"""
    if filepath.endswith('.dta'):
        return pd.read_stata(filepath)
    elif filepath.endswith('.csv'):
        return pd.read_csv(filepath)
    else:
        raise ValueError("Unsupported file format. Use .dta or .csv")

def save_table(df, filename):
    """Save dataframe as CSV in tables directory"""
    df.to_csv(f"{TABLES_DIR}/{filename}", index=False)
    print(f"✓ Saved: {TABLES_DIR}/{filename}")

def save_figure(filename):
    """Save current matplotlib figure"""
    plt.tight_layout()
    plt.savefig(f"{FIGURES_DIR}/{filename}", dpi=300, bbox_inches='tight')
    print(f"✓ Saved: {FIGURES_DIR}/{filename}")

def print_section(title):
    """Print formatted section header"""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70 + "\n")

# ============================================================================
# ANALYSIS WORKFLOW
# ============================================================================

def main():
    """Main analysis workflow"""

    # -------------------------------------------------------------------------
    # 1. DATA LOADING
    # -------------------------------------------------------------------------
    print_section("1. LOADING DATA")

    df = load_data(DATA_FILE)

    print(f"Shape: {df.shape}")
    print(f"Observations: {df.shape[0]}")
    print(f"Variables: {df.shape[1]}")

    print("\nFirst 5 rows:")
    print(df.head())

    # -------------------------------------------------------------------------
    # 2. DATA QUALITY CHECKS
    # -------------------------------------------------------------------------
    print_section("2. DATA QUALITY CHECKS")

    # Missing values
    missing = df.isnull().sum()
    if missing.sum() > 0:
        print("Variables with missing values:")
        print(missing[missing > 0])
    else:
        print("✓ No missing values")

    # Basic statistics
    print("\nSummary Statistics:")
    print(df.describe())

    # -------------------------------------------------------------------------
    # 3. EXPLORATORY DATA ANALYSIS
    # -------------------------------------------------------------------------
    print_section("3. EXPLORATORY DATA ANALYSIS")

    # Summary stats for outcome variable
    print(f"{OUTCOME_VAR} Statistics:")
    print(f"  Mean: {df[OUTCOME_VAR].mean():.2f}")
    print(f"  Median: {df[OUTCOME_VAR].median():.2f}")
    print(f"  Std Dev: {df[OUTCOME_VAR].std():.2f}")

    # Correlation matrix (example with key variables)
    # key_vars = [OUTCOME_VAR, 'var1', 'var2', 'var3']
    # corr_matrix = df[key_vars].corr()
    # print("\nCorrelation Matrix:")
    # print(corr_matrix)

    # -------------------------------------------------------------------------
    # 4. REGRESSION ANALYSIS
    # -------------------------------------------------------------------------
    print_section("4. REGRESSION ANALYSIS")

    # Example: Part I Model
    # Adjust formula based on your variables
    # formula = f'{OUTCOME_VAR} ~ var1 + var2 + C(categorical_var)'
    # model = ols(formula, data=df).fit()
    # print(model.summary())

    # -------------------------------------------------------------------------
    # 5. DEFICIENCY TABLE (if applicable)
    # -------------------------------------------------------------------------
    print_section("5. DEFICIENCY TABLE")

    # Example deficiency table calculation
    # focal_obs = df[df['identifier'] == FOCAL_IDENTIFIER].iloc[0]
    # sample_means = df.mean()
    # ...

    # -------------------------------------------------------------------------
    # 6. VISUALIZATION
    # -------------------------------------------------------------------------
    print_section("6. CREATING VISUALIZATIONS")

    # Example: Distribution of outcome variable
    plt.figure()
    plt.hist(df[OUTCOME_VAR], bins=30, edgecolor='black', alpha=0.7)
    plt.xlabel(OUTCOME_VAR)
    plt.ylabel('Frequency')
    plt.title(f'Distribution of {OUTCOME_VAR}')
    save_figure('outcome_distribution.png')
    plt.close()

    # -------------------------------------------------------------------------
    print_section("ANALYSIS COMPLETE")
    print("All outputs saved to:", OUTPUT_DIR)


if __name__ == "__main__":
    # Create output directories if they don't exist
    import os
    os.makedirs(FIGURES_DIR, exist_ok=True)
    os.makedirs(TABLES_DIR, exist_ok=True)

    # Run analysis
    main()
