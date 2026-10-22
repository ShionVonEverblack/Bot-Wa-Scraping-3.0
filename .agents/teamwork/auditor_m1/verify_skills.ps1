$baseDir = "C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main"

Write-Output "=== 1. Checking superpowers ==="
$spDir = Join-Path $baseDir "skills\superpowers\skills"
$spSkills = Get-ChildItem -Directory $spDir
Write-Output "Superpowers skill count: $($spSkills.Count)"
foreach ($s in $spSkills | Select-Object -First 5) {
    $skillFile = Join-Path $s.FullName "SKILL.md"
    $hasFile = Test-Path $skillFile
    $size = if ($hasFile) { (Get-Item $skillFile).Length } else { 0 }
    Write-Output "  Skill: $($s.Name), SKILL.md exists: $hasFile, size: $size bytes"
}

Write-Output "`n=== 2. Checking mattpocock ==="
$mpDir = Join-Path $baseDir "skills\mattpocock\skills"
$mpCats = Get-ChildItem -Directory $mpDir
Write-Output "Mattpocock categories: $($mpCats.Name -join ', ')"
$totalMp = 0
foreach ($cat in $mpCats) {
    $catSkills = Get-ChildItem -Directory $cat.FullName
    $totalMp += $catSkills.Count
    Write-Output "  Category $($cat.Name): $($catSkills.Count) skills"
    $sample = $catSkills | Select-Object -First 1
    if ($sample) {
        $skillFile = Join-Path $sample.FullName "SKILL.md"
        Write-Output "    Sample skill: $($sample.Name), size: $((Get-Item $skillFile).Length) bytes"
    }
}
Write-Output "Total mattpocock skills: $totalMp"

Write-Output "`n=== 3. Checking ecc ==="
$eccDir = Join-Path $baseDir "skills\ecc\skills"
$eccSkills = Get-ChildItem -Directory $eccDir
Write-Output "ECC skills count: $($eccSkills.Count)"
foreach ($s in $eccSkills | Select-Object -First 5) {
    $skillFile = Join-Path $s.FullName "SKILL.md"
    $hasFile = Test-Path $skillFile
    $size = if ($hasFile) { (Get-Item $skillFile).Length } else { 0 }
    Write-Output "  Skill: $($s.Name), size: $size bytes"
}

Write-Output "`n=== 4. Checking anthropics ==="
$antDir = Join-Path $baseDir "skills\anthropics\skills"
$antSkills = Get-ChildItem -Directory $antDir
Write-Output "Anthropics skills count: $($antSkills.Count)"
foreach ($s in $antSkills | Select-Object -First 5) {
    $skillFile = Join-Path $s.FullName "SKILL.md"
    $hasFile = Test-Path $skillFile
    $size = if ($hasFile) { (Get-Item $skillFile).Length } else { 0 }
    Write-Output "  Skill: $($s.Name), size: $size bytes"
}

Write-Output "`n=== 5. Checking Tier-1 (.agents/skills) ==="
$tier1Dir = Join-Path $baseDir ".agents\skills"
$tier1Skills = Get-ChildItem -Directory $tier1Dir
Write-Output "Tier-1 skills count: $($tier1Skills.Count)"
foreach ($s in $tier1Skills) {
    $skillFile = Join-Path $s.FullName "SKILL.md"
    $hasFile = Test-Path $skillFile
    $size = if ($hasFile) { (Get-Item $skillFile).Length } else { 0 }
    Write-Output "  Skill: $($s.Name), size: $size bytes"
}

Write-Output "`n=== 6. Validating .agents/skills.json ==="
$cfgPath = Join-Path $baseDir ".agents\skills.json"
$cfgJson = Get-Content $cfgPath -Raw | ConvertFrom-Json
Write-Output "Config entries count: $($cfgJson.entries.Count)"
foreach ($entry in $cfgJson.entries) {
    $fullPath = Join-Path $baseDir $entry.path
    $exists = Test-Path $fullPath
    $incCount = if ($entry.include_only) { $entry.include_only.Count } else { "ALL" }
    Write-Output "  Entry: $($entry.path) (Exists: $exists, include_only: $incCount)"
}
