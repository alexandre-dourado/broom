@echo off
REM ============================================================
REM THE BROOM — create-structure.bat
REM Cria a estrutura de pastas e arquivos vazios
REM ============================================================

mkdir the-broom
cd the-broom

mkdir backend
mkdir frontend
mkdir frontend\icons

type nul > backend\code.gs

type nul > frontend\index.html
type nul > frontend\styles.css
type nul > frontend\icons.js
type nul > frontend\db.js
type nul > frontend\api.js
type nul > frontend\ui.js
type nul > frontend\app.js
type nul > frontend\sw.js
type nul > frontend\manifest.json

echo.
echo Estrutura criada com sucesso:
echo.
echo the-broom/
echo   backend/
echo     code.gs
echo   frontend/
echo     index.html
echo     styles.css
echo     icons.js
echo     db.js
echo     api.js
echo     ui.js
echo     app.js
echo     sw.js
echo     manifest.json
echo     icons/ (adicione icon-192.png e icon-512.png)
echo.
pause
