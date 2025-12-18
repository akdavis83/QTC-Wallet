@echo off
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
    call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
) else (
    echo "vcvars64.bat not found"
    exit /b 1
)

if not exist build mkdir build

echo Building oqs_wallet_cli...
cl /EHsc /std:c++17 /I ..\..\..\build_liboqs_win\include src\main.cpp src\rng_deterministic.cpp src\json_emit.cpp /link /LIBPATH:..\..\..\build_liboqs_win\lib\Release oqs.lib Advapi32.lib /OUT:build\oqs_wallet_cli.exe
