@echo off
echo Testing --help flag
node scripts/agent/generate-morning-review.mjs --help
echo Exit code: %ERRORLEVEL%