# PowerShell script to convert BLS Excel files to CSV for analysis
# Requires Excel to be installed

$sourceDir = "BLS_4_0_2025_DE"
$targetDir = "BLS_4_0_2025_DE_CSV"

# Create target directory if it doesn't exist
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir
}

# Function to convert Excel to CSV
function Convert-ExcelToCsv {
    param(
        [string]$ExcelFile,
        [string]$CsvFile
    )
    
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        
        $workbook = $excel.Workbooks.Open($ExcelFile)
        
        # Convert each worksheet to separate CSV
        $sheetIndex = 1
        foreach ($worksheet in $workbook.Worksheets) {
            $sheetName = $worksheet.Name
            $csvFileName = $CsvFile -replace "\.csv$", "_$sheetName.csv"
            
            Write-Host "Converting sheet '$sheetName' to $csvFileName"
            $worksheet.SaveAs($csvFileName, 6) # 6 = CSV format
            $sheetIndex++
        }
        
        $workbook.Close($false)
        $excel.Quit()
        
        # Clean up COM objects
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        
        Write-Host "Successfully converted $ExcelFile"
    }
    catch {
        Write-Error "Failed to convert $ExcelFile : $($_.Exception.Message)"
    }
}

# Convert BLS data file
$dataFile = Join-Path $sourceDir "BLS_4_0_Daten_2025_DE.xlsx"
$dataFileFullPath = Resolve-Path $dataFile
$dataCsvPath = Join-Path (Resolve-Path $targetDir) "BLS_4_0_Daten_2025_DE.csv"

if (Test-Path $dataFile) {
    Write-Host "Converting BLS data file..."
    Convert-ExcelToCsv -ExcelFile $dataFileFullPath -CsvFile $dataCsvPath
} else {
    Write-Error "BLS data file not found: $dataFile"
}

# Convert components file
$componentsFile = Join-Path $sourceDir "BLS_4_0_Components_DE_EN.xlsx"
$componentsFileFullPath = Resolve-Path $componentsFile
$componentsCsvPath = Join-Path (Resolve-Path $targetDir) "BLS_4_0_Components_DE_EN.csv"

if (Test-Path $componentsFile) {
    Write-Host "Converting BLS components file..."
    Convert-ExcelToCsv -ExcelFile $componentsFileFullPath -CsvFile $componentsCsvPath
} else {
    Write-Error "BLS components file not found: $componentsFile"
}

