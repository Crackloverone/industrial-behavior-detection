@echo off
REM Clean Next.js .next cache before building

echo Cleaning .next cache...

if exist ".next" (
    rd /s /q ".next"
    echo .next cache cleared.
) else (
    echo No .next cache found.
)

if exist "node_modules\.cache" (
    rd /s /q "node_modules\.cache"
    echo Node modules cache cleared.
)

echo Done.