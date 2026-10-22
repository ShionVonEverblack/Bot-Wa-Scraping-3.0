$testDir = "C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\teamwork\auditor_m1\.git_test2"
if (Test-Path $testDir) {
    Remove-Item -Recurse -Force $testDir
}
New-Item -ItemType Directory -Path $testDir | Out-Null
Copy-Item 'C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.gitignore' (Join-Path $testDir '.gitignore')
git -C $testDir init | Out-Null
New-Item -ItemType Directory -Path (Join-Path $testDir 'src\jobs') | Out-Null
New-Item -ItemType File -Path (Join-Path $testDir 'src\jobs\jobManager.js') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $testDir 'jobs') | Out-Null
New-Item -ItemType File -Path (Join-Path $testDir 'jobs\123.json') | Out-Null

Write-Output '--- Git Status (Before Add) ---'
git -C $testDir status --porcelain

Write-Output '--- Git Add and Status ---'
git -C $testDir add .
git -C $testDir status --porcelain

Remove-Item -Recurse -Force $testDir
