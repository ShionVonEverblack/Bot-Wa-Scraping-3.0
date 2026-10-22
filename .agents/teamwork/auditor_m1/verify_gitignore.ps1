$testDir = "C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\teamwork\auditor_m1\.git_test"
if (Test-Path $testDir) {
    Remove-Item -Recurse -Force $testDir
}
New-Item -ItemType Directory -Path $testDir | Out-Null

$origGitignore = "C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.gitignore"
Copy-Item $origGitignore (Join-Path $testDir ".gitignore")

# Init temp git repo
git -C $testDir init | Out-Null

$testPaths = @(
    "src/jobs/jobManager.js",
    "src/services/cache/cacheService.js",
    "tests/jobs/jobStore.test.js",
    "jobs/job_123.json",
    "cache/cache_data.json",
    "auth/session.json",
    "outputs/report.csv",
    ".env",
    "node_modules/package/index.js",
    "debug.log"
)

Write-Output "=== Git Check-Ignore Empirical Verification ==="
foreach ($p in $testPaths) {
    $fullPath = Join-Path $testDir $p
    $dir = Split-Path $fullPath -Parent
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    New-Item -ItemType File -Path $fullPath | Out-Null
    
    $check = git -C $testDir check-ignore -v $p 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output "IGNORED: $p -> Rule: $check"
    } else {
        Write-Output "TRACKED: $p (NOT ignored)"
    }
}

Remove-Item -Recurse -Force $testDir
