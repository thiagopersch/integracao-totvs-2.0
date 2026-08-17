#!/bin/bash
set -e

echo "========================================"
echo " Integracao TOTVS RM - Setup Completo"
echo "========================================"
echo ""

echo "[1/4] Iniciando banco de dados PostgreSQL..."
docker compose up -d postgres

echo "Aguardando PostgreSQL ficar pronto..."
until docker compose exec postgres pg_isready -U admin > /dev/null 2>&1 || docker exec integracao-totvs-db pg_isready -U admin > /dev/null 2>&1; do
  sleep 2
done
echo "Banco de dados pronto!"
echo ""

echo "[2/4] Executando Prisma Migrations..."
npx prisma migrate dev --schema=prisma/schema.prisma --name init
echo ""

echo "[3/4] Executando Seed..."
npx tsx prisma/seed.ts
echo ""

echo "[4/4] Iniciando servidor de desenvolvimento..."
echo ""
echo "========================================"
echo " Acesse: http://localhost:3000"
echo " Login:  admin@totvs.com.br / admin123"
echo "========================================"
echo ""
npm run dev
