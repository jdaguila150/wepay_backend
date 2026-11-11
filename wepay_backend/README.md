# 💸 WePay - Ecosistema de Microservicios Backend

Backend distribuido de **WePay**, construido sobre **FastAPI**, **PostgreSQL** y **Redis**, diseñado para la gestión en tiempo real de mesas, cartas gastronómicas, autenticación de usuarios, sistema de comandas para cocina (KDS) y división inteligente de cuentas compartidas.

---

## 🏗️ Arquitectura de Microservicios

El sistema opera bajo un patrón de microservicios desacoplados donde todo el tráfico externo (HTTP y WebSockets) es canalizado a través del **API Gateway** centralizado.

```mermaid
flowchart LR
    Cliente["💻 Clientes (HTTP / WS)"] -->|Puerto 8080| Gateway["🚪 API Gateway"]
    
    Gateway -->|8000| MenuSvc["📖 Menu Service\n(wepay_menu)"]
    Gateway -->|8001| AuthSvc["🔐 Auth Service\n(wepay_auth)"]
    Gateway -->|8002| SessionSvc["⏱️ Session Service\n(wepay_sesiones + Redis)"]
    Gateway -->|8003| PaymentSvc["💳 Payment Service\n(wepay_pagos)"]
```

### Tabla de Topología de Servicios

| Servicio | Puerto Interno | Base de Datos | Responsabilidad Principal |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `8080` | N/A | Reverse Proxy HTTP y multiplexor de túneles bidireccionales WebSocket. Gestión de CORS. |
| **Menu Service** | `8000` | PostgreSQL (`wepay_menu`) | Catálogo gastronómico: Restaurantes, Categorías e Ítems del menú. Control de disponibilidad. |
| **Auth Service** | `8001` | PostgreSQL (`wepay_auth`) | Identidad, autenticación JWT, hashing Bcrypt seguro (compatible con Windows). |
| **Session Service** | `8002` | PostgreSQL (`wepay_sesiones`) + Redis | Gestión de mesas activas, comandas, KDS cocina, WebSockets (`ConnectionManager`) y abonos en vivo. |
| **Payment Service** | `8003` | PostgreSQL (`wepay_pagos`) | Cálculo matemático de división de cuentas, propinas y liquidación de pagos. |

---

## 🗄️ Arquitectura de Bases de Datos

### 1. PostgreSQL (Multi-Database en Contenedor)
PostgreSQL ejecuta en el puerto `5432`. El script de inicialización [`init-multiple-dbs.sh`](./init-multiple-dbs.sh) crea de forma automatizada 4 bases de datos lógicas independientes al levantar Docker:
1. `wepay_auth`: Credenciales de comensales y administradores.
2. `wepay_menu`: Estructura jerárquica de restaurantes, categorías y platillos.
3. `wepay_sesiones`: Mesas físicas, sesiones históricas, órdenes y abonos de comensales.
4. `wepay_pagos`: Registros contables de pagos finales concretados.

### 2. Redis 7 (Caché en Memoria y Estado Vivo)
Redis opera en el puerto `6379`. Proporciona latencia casi nula para la sincronización multijugador:
* **Clave de Mesa:** `mesa:{sesion_id}` almacena el JSON completo del estado de la mesa (ítems pedidos, comensal asignado, abonos directos y transferencias "Tablas").
* **Estrategia Cache-Aside:** Las consultas de estado verifican Redis en primera instancia; ante un *cache miss*, el estado se reconstruye desde PostgreSQL y se vuelve a inyectar en Redis.

---

## ⚡ Arquitectura de WebSockets en Tiempo Real

### Túnel Bidireccional en el Gateway
El API Gateway captura peticiones WebSocket en la ruta `/{service}/ws/{path:path}`. Mediante `websockets.connect()` y `asyncio.gather()`, mantiene dos túneles asíncronos concurrentes:
1. Lectura del frontend y retransmisión al microservicio interno.
2. Lectura del microservicio interno y retransmisión al frontend.

### Salas y Protocolos

1. **Canal de Mesa (`/ws/sesion/{sesion_id}`):**
   * **Ruta Gateway:** `ws://<host>:8080/sesiones/ws/sesion/{sesion_id}`
   * **Ruta Interna:** `ws://127.0.0.1:8002/ws/sesion/{sesion_id}`
   * **Mensajes:** Emite `"actualizar_mesa"` cuando cualquier comensal añade un platillo o abona saldo.

2. **Canal de Cocina (`/ws/cocina`):**
   * **Ruta Gateway:** `ws://<host>:8080/sesiones/ws/cocina`
   * **Ruta Interna:** `ws://127.0.0.1:8002/ws/cocina`
   * **Mensajes:** Emite `{"accion": "nueva_comanda"}` a través de `BackgroundTasks` cuando entra cualquier pedido nuevo al restaurante.

---

## 👨‍🍳 Sistema de Comandas para Cocina (KDS)

El microservicio de sesiones incorpora control de estado y visualización para la cocina del restaurante:

### Ciclo de Estados (`OrdenItem.estado`)
* `pendiente`: Comanda enviada por el comensal, en espera de atención.
* `preparando`: Chef trabajando en la preparación.
* `lista`: Platillo terminado, listo para entrega por mesero.
* `entregada`: Servido en la mesa.

### Endpoints de Cocina

* `GET /ordenes/pendientes` (Gateway: `GET /sesiones/ordenes/pendientes`):
  * Retorna todos los ítems de órdenes activas con estado `'pendiente'`.
* `PUT /ordenes/{orden_id}/estado?estado_nuevo={estado}` (Gateway: `PUT /sesiones/ordenes/{orden_id}/estado`):
  * Actualiza la etapa del platillo en la base de datos PostgreSQL.

---

## ⚙️ Variables de Entorno y Seguridad

| Variable | Servicio | Descripción | Valor por Defecto / Ejemplo |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | `auth_service` | Clave secreta para firma simétrica HS256 de tokens JWT. | Configurable vía `os.getenv("SECRET_KEY", ...)` |
| `ALGORITHM` | `auth_service` | Algoritmo de encriptación de tokens. | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `auth_service` | Minutos de vigencia del token. | `60` |
| `SQLALCHEMY_DATABASE_URL` | Todos | Cadena de conexión al motor PostgreSQL. | `postgresql://admin_wepay:superpassword123@127.0.0.1:5432/<db_name>` |
| `REDIS_HOST` | `session_service` | Host de conexión al contenedor Redis. | `localhost` |
| `REDIS_PORT` | `session_service` | Puerto del contenedor Redis. | `6379` |
| `POSTGRES_USER` | Docker | Usuario administrador de PostgreSQL. | `admin_wepay` |
| `POSTGRES_PASSWORD` | Docker | Contraseña de PostgreSQL. | `superpassword123` |

> [!IMPORTANT]
> **Hardening de Passlib en Windows:** Las funciones de hashing en `auth_utils.py` truncan la contraseña a 72 caracteres antes de invocar `bcrypt.hash()` para evitar excepciones de buffer en entornos Windows.

---

## 🚀 Guía de Instalación y Despliegue Local

### 1. Requisitos Previos
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) en ejecución.
* Python 3.10 o superior.
* PowerShell (en Windows) o Bash (en Linux/macOS).

### 2. Levantar Motores de Datos (Docker)
Desde la carpeta `wepay_backend/`:
```bash
docker-compose up -d
```
Verifica que los contenedores `wepay_postgres` y `wepay_redis` estén en estado `Up`.

### 3. Instalación de Dependencias
Se recomienda instalar las librerías en cada microservicio o en un entorno virtual central:
```bash
python -m venv venv
.\venv\Scripts\activate   # En Windows
# source venv/bin/activate  # En Linux/macOS

pip install fastapi uvicorn[standard] sqlalchemy psycopg2-binary redis passlib[bcrypt] python-jose[cryptography] httpx websockets pydantic
```

### 4. Ejecución Automatizada de los Microservicios
Puedes iniciar todos los microservicios simultáneamente usando el script PowerShell provisto:
```powershell
.\run_wepay.ps1
```
O iniciar cada servicio manualmente en terminales separadas:
```bash
# Terminal 1: Menu Service
uvicorn menu_service.main:app --port 8000 --reload

# Terminal 2: Auth Service
uvicorn auth_service.main:app --port 8001 --reload

# Terminal 3: Session Service
uvicorn session_service.main:app --port 8002 --reload

# Terminal 4: Payment Service
uvicorn payment_service.main:app --port 8003 --reload

# Terminal 5: API Gateway
uvicorn gateway.main:app --port 8080 --reload
```

---

## 🧪 Pruebas de Sintaxis y Compilación

Para certificar que todos los archivos de Python están libres de errores sintácticos antes de producción:
```powershell
python -m py_compile gateway/main.py
python -m py_compile auth_service/main.py auth_service/models.py auth_service/schemas.py auth_service/auth_utils.py auth_service/database.py
python -m py_compile menu_service/main.py menu_service/models.py menu_service/schemas.py menu_service/database.py
python -m py_compile session_service/main.py session_service/models.py session_service/schemas.py session_service/redis_client.py session_service/database.py
python -m py_compile payment_service/main.py payment_service/models.py payment_service/schemas.py payment_service/database.py
```

---

## 📚 Documentación Interactiva (Swagger / OpenAPI)

FastAPI genera automáticamente documentación interactiva accesible desde el navegador:

* **API Gateway (Swagger):** [http://localhost:8080/docs](http://localhost:8080/docs)
* **Menu Service:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Auth Service:** [http://localhost:8001/docs](http://localhost:8001/docs)
* **Session Service:** [http://localhost:8002/docs](http://localhost:8002/docs)
* **Payment Service:** [http://localhost:8003/docs](http://localhost:8003/docs)
