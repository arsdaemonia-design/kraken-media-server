@echo off
echo Installing pywebview in venv...
venv\Scripts\python.exe -m pip install pywebview "pythonnet==3.1.0rc0" proxy_tools bottle --no-cache-dir
echo.
echo Checking...
venv\Scripts\python.exe -c "import webview; print('pywebview OK in venv')"
pause
