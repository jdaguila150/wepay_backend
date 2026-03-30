# 💸 WePay - Ecosistema de Microservicios para Pagos Grupales

**WePay** es una plataforma escalable diseñada para eliminar la fricción al pagar cuentas compartidas en restaurantes. Permite gestionar menús, usuarios, sesiones de mesa en tiempo real y la división equitativa de gastos.

---

## 🏗️ Arquitectura del Sistema

El sistema está construido bajo una arquitectura de microservicios, aislados e independientes, que se comunican a través de un **API Gateway**:

1. **API Gateway (Puerto 8080):** Punto de entrada único (Proxy Inverso). Redirige el tráfico al microservicio correspondiente.
2. **Auth Service (Puerto 8001):** Gestión de usuarios, hashing de contraseñas (Bcrypt) y emisión de seguridad con tokens JWT.
3. **Menu Service (Puerto 8000):** Catálogo de restaurantes, categorías y platillos.
4. **Session Service (Puerto 8002):** Gestión de mesas activas. Utiliza **Redis** para sincronización rápida del estado de la cuenta y PostgreSQL para el registro histórico.
5. **Payment Service (Puerto 8003):** Lógica matemática de división de cuentas y registro de transacciones.

## 🛠️ Stack Tecnológico

* **Lenguaje:** Python 3.11+
* **Framework:** FastAPI
* **Bases de Datos:** PostgreSQL (4 Bases de datos lógicas independientes) y Redis.
* **Seguridad:** OAuth2 con JWT, Passlib (Bcrypt).
* **Infraestructura:** Docker & Docker Compose.

---

## 🚀 Guía de Instalación y Despliegue

### 1. Requisitos Previos
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.
* Python 3.11+ instalado.

### 2. Levantar la Infraestructura (Bases de Datos)
Desde la raíz del proyecto, activa los contenedores de PostgreSQL y Redis:
```bash
docker-compose up -d


cd [nombre_del_servicio]
python -m venv venv
# Activar en Windows:
.\venv\Scripts\activate  
# Instalar dependencias requeridas (ejemplo general):
pip install fastapi uvicorn sqlalchemy psycopg2-binary



Servicio,Comando de Inicio,Puerto Interno
Menú,uvicorn main:app --port 8000,8000
Auth,uvicorn main:app --port 8001,8001
Sesiones,uvicorn main:app --port 8002,8002
Pagos,uvicorn main:app --port 8003,8003
Gateway,uvicorn main:app --port 8080,8080



🚦 Cómo probar el flujo completo
Utiliza el API Gateway (http://localhost:8080) como tu única URL base para interactuar con todo el sistema:

Registrar Usuario: POST http://localhost:8080/auth/registro

Login: POST http://localhost:8080/auth/login (Obtén tu Token JWT).

Ver Restaurantes: GET http://localhost:8080/menu/restaurantes/

Abrir una Mesa: POST http://localhost:8080/sesiones/sesion/abrir

Pedir un Platillo: POST http://localhost:8080/sesiones/sesion/{id}/pedir

Dividir Cuenta: POST http://localhost:8080/pagos/pagos/calcular-division