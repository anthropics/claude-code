# Test script for OMER toolkit
$pwd
$csv = @"
date,description,category,amount
2026-01-01,Maas,Gelir,10000
2026-01-03,Market,Gida,-450
2026-01-06,Elektrik,Fatura,-320
2026-01-15,Freelance,Gelir,3200
2026-01-20,Internet,Fatura,-120
2026-02-01,Maas,Gelir,10000
2026-02-05,Restaurant,Yemek,-280
"@
$csv | Set-Content -Path transactions.csv -Encoding utf8
Write-Host "Running run.py run..."
python run.py run
Write-Host "Running analyze.py..."
python analyze.py transactions.csv
Write-Host "Running finance_analysis.py with dashboard..."
python finance_analysis.py transactions.csv --top-category 5 --dashboard --save report.txt --chart-file cashflow.png --start 2026-01-01 --end 2026-02-28
Write-Host "Done tests. Files generated:"
Get-ChildItem -Path *.txt, *.png
