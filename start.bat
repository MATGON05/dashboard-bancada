@echo off
chcp 65001 >nul
echo Iniciando SUIT-TECH...
echo Acesse: http://localhost:3001
if not exist node_modules (
  echo Instalando dependencias, aguarde...
  npm install
)
if not exist .env (
  if exist .env.example (
    echo Criando .env a partir do exemplo...
    copy .env.example .env >nul
  )
)
node server.js
pause
