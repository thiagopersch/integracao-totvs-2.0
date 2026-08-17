@echo off
echo ========================================
echo  Integracao TOTVS RM - Setup Completo
echo ========================================
echo.

echo [1/4] Iniciando banco de dados PostgreSQL...
docker compose up -d postgres
if %errorlevel% neq 0 (
    echo ERRO: Falha ao iniciar PostgreSQL
    exit /b 1
)

echo Aguardando PostgreSQL ficar pronto...
:waitloop
docker compose exec postgres pg_isready -U admin 2>nul >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto waitloop
)
echo Banco de dados pronto!
echo.

echo [2/4] Executando Prisma Migrations...
call npx prisma migrate dev --schema=prisma/schema.prisma --name init
if %errorlevel% neq 0 (
    echo ERRO: Falha ao executar migrations
    exit /b 1
)
echo.

echo [3/4] Executando Seed...
call npx tsx prisma/seed.ts
if %errorlevel% neq 0 (
    echo ERRO: Falha ao executar seed
    exit /b 1
)
echo.

echo [4/4] Iniciando servidor de desenvolvimento...
echo.
echo ========================================
echo  Acesse: http://localhost:3000
echo  Login:  admin@totvs.com.br / admin123
echo ========================================
echo.
call npm run dev
