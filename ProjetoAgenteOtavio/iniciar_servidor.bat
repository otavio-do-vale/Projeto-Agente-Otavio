@echo off
title Agente Otavio - Azure AI Foundry Web
echo ========================================================
echo   Iniciando o Servidor Web do Agente Otavio...
echo   Recurso: Azure AI Foundry
echo ========================================================
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python app.py
pause
