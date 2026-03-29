#!/bin/bash
set -e

echo "Creando bases de datos adicionales para los microservicios de wepay..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE wepay_usuarios;
    CREATE DATABASE wepay_sesiones;
    CREATE DATABASE wepay_pagos;
EOSQL

echo "Bases de datos creadas exitosamente."
