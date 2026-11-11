# 🚀 WePay - Sistema Inteligente para Cuentas Compartidas y Comandas en Vivo

**WePay** es una solución SaaS integral diseñada para transformar la experiencia operativa y de consumo en restaurantes. Permite a los comensales abrir mesas virtuales mediante códigos QR, explorar el catálogo gastronómico digital, realizar pedidos sincronizados a una comanda compartida, monitorear la preparación en tiempo real y dividir o transferir cuentas entre amigos sin fricción.

El sistema incorpora un **Kitchen Display System (KDS)** para la cocina y opera bajo una arquitectura de **Microservicios** de alta concurrencia respaldada por **FastAPI**, **PostgreSQL**, **Redis** y **React (Vite)**.

---

## 📑 Tabla de Contenidos

- [🛠️ Stack Tecnológico](#️-stack-tecnológico)
- [🏗️ Arquitectura de Microservicios](#️-arquitectura-de-microservicios)
- [👨‍🍳 Sistema de Comandas para Cocina (KDS - /cocinero)](#-sistema-de-comandas-para-cocina-kds---cocinero)
- [⚡ Arquitectura de WebSockets en Tiempo Real](#-arquitectura-de-websockets-en-tiempo-real)
- [⚙️ Variables de Entorno](#️-variables-de-entorno)
- [🚀 Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
  - [1. Requisitos Previos](#1-requisitos-previos)
  - [2. Infraestructura con Docker (PostgreSQL y Redis)](#2-infraestructura-con-docker-postgresql-y-redis)
  - [3. Backend (Microservicios)](#3-backend-microservicios)
  - [4. Frontend (Cliente Web)](#4-frontend-cliente-web)
- [📱 Flujos de Usuario Principales](#-flujos-de-usuario-principales)
- [📚 Documentación Técnica Adicional](#-documentación-técnica-adicional)

---

## 🛠️ Stack Tecnológico

### Frontend (Cliente Web)
* **Framework:** React 18 (Vite)
* **Diseño & Estilos:** Bootstrap 5, Bootstrap Icons, Google Material Icons & CSS personalizado
* **Rutas:** React Router DOM v6
* **Cliente HTTP:** Axios (con interceptores JWT)
* **Tiempo Real:** WebSockets nativos con auto-resolución dinámica de host (`window.location.hostname`)
* **Audio Feedback:** HTML5 Audio API con alerta sonora (`/campana.mp3`)

### Backend (Microservicios)
* **Framework:** FastAPI (Python 3.10+)
* **Gateway & Proxy:** FastAPI + HTTPX (asíncrono) + `websockets` (túnel bidireccional)
* **Bases de Datos Relacionales:** PostgreSQL 15 (4 bases de datos lógicas aisladas)
* **ORM:** SQLAlchemy + Psycopg2
* **Caché & Sincronización:** Redis 7 (gestión de estado de mesa viva y persistencia volátil)
* **Autenticación & Criptografía:** OAuth2 Password Bearer, JWT (Jose), Passlib (Bcrypt con mitigación de 72 caracteres para Windows)
* **Validación de Esquemas:** Pydantic v1/v2

---

## 🏗️ Arquitectura de Microservicios

Toda comunicación externa se centraliza en el **API Gateway** (Puerto `8080`), el cual actúa como Proxy Inverso HTTP y multiplexor de WebSockets hacia los microservicios especializados.

```mermaid
flowchart TD
    subgraph UI["💻 Clientes Frontend (React)"]
        Mesa["📱 Comensal / Mesa"]
        Cuenta["🧮 Cuenta Compartida"]
        Cocina["👨‍🍳 KDS Cocina (/cocinero)"]
        Admin["👑 Panel Administrador"]
    end

    Gateway["🚪 API Gateway (:8080)\nProxy Inverso HTTP & Túnel WebSockets"]

    subgraph Servicios["⚙️ Microservicios Internos"]
        MenuSvc["📖 Menu Service (:8000)\nCRUD Catálogo y Restaurantes"]
        AuthSvc["🔐 Auth Service (:8001)\nUsuarios, Hashing & JWT"]
        SessionSvc["⏱️ Session Service (:8002)\nMesas, Pedidos, Cocina & WS"]
        PaymentSvc["💳 Payment Service (:8003)\nDivisión de Cuentas & Pagos"]
    end

    subgraph Data["🗄️ Persistencia"]
        PG[("🐘 PostgreSQL (:5432)\n4 DBs Lógicas")]
        RD[("⚡ Redis 7 (:6379)\nEstado en Memoria")]
    end

    UI -->|HTTP / WS| Gateway
    Gateway --> MenuSvc
    Gateway --> AuthSvc
    Gateway --> SessionSvc
    Gateway --> PaymentSvc

    MenuSvc --> PG
    AuthSvc --> PG
    SessionSvc --> PG
    SessionSvc <--> RD
    PaymentSvc --> PG
```

### Mapa de Puertos y Servicios

| Componente | Puerto | Protocolo | Descripción |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `5173` | HTTP / WS | Aplicación SPA de comensales, cocina y administración. |
| **API Gateway** | `8080` | HTTP / WS | Entrada única del sistema. CORS unificado y túneles en tiempo real. |
| **Menu Service** | `8000` | HTTP Interno | Gestión de restaurantes, categorías de menú y platillos con disponibilidad. |
| **Auth Service** | `8001` | HTTP Interno | Registro, login seguro con JWT y perfiles de usuario. |
| **Session Service** | `8002` | HTTP / WS Interno | Gestión de sesiones de mesa, comandas, KDS cocina y sincronización Redis. |
| **Payment Service** | `8003` | HTTP Interno | Lógica de cálculo para división equitativa y pagos parciales. |
| **PostgreSQL** | `5432` | TCP | Motor relacional (`wepay_menu`, `wepay_auth`, `wepay_sesiones`, `wepay_pagos`). |
| **Redis** | `6379` | TCP | Almacenamiento clave-valor de alta velocidad para sesiones vivas. |

---

## 👨‍🍳 Sistema de Comandas para Cocina (KDS - /cocinero)

La nueva pantalla de **Cocina** (`/cocinero`) moderniza la recepción de pedidos reemplazando las impresoras térmicas tradicionales por un tablero Kanban digital en tiempo real:

1. **Recepción Automática:** Cuando un comensal añade platillos a la mesa desde su celular, el backend dispara un evento WebSocket inmediato a la cocina.
2. **Alertas Multimodales:**
   * **Auditiva:** Reproducción automática del sonido de campana ([campana.mp3](file:///wepay-frontend/public/campana.mp3)).
   * **Visual:** Destello rojo intermitente durante 3 segundos en toda la pantalla para captar la atención del chef.
3. **Control del Ciclo de Vida del Platillo:**
   * `pendiente`: Comanda recién emitida.
   * `preparando`: Platillo en cocción.
   * `lista`: Terminado, listo para ser despachado por el mesero.
   * `entregada`: Concretado en la mesa.
4. **Acción Rápida:** Botón "Marcar como Lista" que actualiza el estado en la base de datos vía `PUT /sesiones/ordenes/{orden_id}/estado` y despeja la tarjeta con actualización optimista de interfaz.

---

## ⚡ Arquitectura de WebSockets en Tiempo Real

WePay cuenta con una arquitectura de WebSocket de baja latencia con enrutamiento dinámico y soporte multi-dispositivo en red LAN:

```mermaid
sequenceDiagram
    autonumber
    actor Comensal as 📱 Comensal (Mesa 3)
    participant Gateway as 🚪 API Gateway (:8080)
    participant SessionSvc as ⏱️ Session Service (:8002)
    actor Cocina as 👨‍🍳 Cocina (/cocinero)

    Note over Cocina, Gateway: Conexión WebSocket a ws://host:8080/sesiones/ws/cocina
    Note over Comensal, Gateway: Conexión WebSocket a ws://host:8080/sesiones/ws/sesion/{id}

    Comensal->>Gateway: POST /sesiones/sesion/{id}/pedir (Hamburguesa x2)
    Gateway->>SessionSvc: Forward pedido
    SessionSvc->>SessionSvc: Persistir en PostgreSQL + Actualizar Redis

    par Notificación a Mesa
        SessionSvc-->>Gateway: WS Broadcast canal mesa {id}: "actualizar_mesa"
        Gateway-->>Comensal: WS Event: "actualizar_mesa"
        Note over Comensal: Recalcula total de mesa y división
    and Notificación a Cocina
        SessionSvc-->>Gateway: WS Broadcast canal "cocina": {"accion": "nueva_comanda"}
        Gateway-->>Cocina: WS Event: {"accion": "nueva_comanda"}
        Note over Cocina: 🔔 Campana sonora + Alerta visual + Recarga tickets
    end
```

### Canales Activos
* **Mesa (`ws://<host>:8080/sesiones/ws/sesion/{id}`):** Todos los comensales sentados a la misma mesa ven aparecer los ítems pedidos por los demás en tiempo real.
* **Cocina (`ws://<host>:8080/sesiones/ws/cocina`):** Mantiene suscritos a los monitores de cocina para recibir alertas globales de nuevas comandas emitidas por cualquier mesa activa.

---

## ⚙️ Variables de Entorno

### Frontend (`wepay-frontend/.env`)
```bash
# Para pruebas locales en la misma máquina:
VITE_API_BASE_URL=http://localhost:8080

# Para pruebas en red local con celulares (reemplazar por la IP LAN):
# VITE_API_BASE_URL=http://192.168.1.100:8080
```

### Backend (`wepay_backend/`)
| Variable | Módulo | Descripción | Valor por Defecto |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | `auth_service` | Semilla criptográfica para firma de JWT. | Configurable vía `os.getenv` |
| `ALGORITHM` | `auth_service` | Algoritmo de encriptación de tokens. | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `auth_service` | Vigencia de la sesión en minutos. | `60` |
| `SQLALCHEMY_DATABASE_URL` | Microservicios | Cadena de conexión al motor PostgreSQL. | `postgresql://admin_wepay:superpassword123@127.0.0.1:5432/<db_name>` |
| `REDIS_HOST` | `session_service`| Host del contenedor de Redis. | `localhost` |
| `REDIS_PORT` | `session_service`| Puerto del contenedor de Redis. | `6379` |
| `POSTGRES_USER` | `docker-compose`| Usuario maestro de base de datos. | `admin_wepay` |
| `POSTGRES_PASSWORD` | `docker-compose`| Clave maestra de base de datos. | `superpassword123` |

---

## 🚀 Instalación y Puesta en Marcha

### 1. Requisitos Previos
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) en ejecución.
* Node.js (v18+) y npm.
* Python (v3.10+) con `pip` y `venv`.

---

### 2. Infraestructura con Docker (PostgreSQL y Redis)
Desde el directorio `wepay_backend/`, inicia los contenedores:
```bash
cd wepay_backend
docker-compose up -d
```
> Esto creará automáticamente las bases de datos `wepay_menu`, `wepay_auth`, `wepay_sesiones` y `wepay_pagos` gracias al script [`init-multiple-dbs.sh`](wepay_backend/init-multiple-dbs.sh), además del servidor Redis 7.

---

### 3. Backend (Microservicios)

#### Opción A: Inicio Rápido con PowerShell (Windows)
```powershell
cd wepay_backend
.\run_wepay.ps1
```
*(Inicia automáticamente los 4 microservicios en ventanas independientes).*

#### Opción B: Inicio Manual
En ventanas de consola independientes:
```bash
# 1. Menu Service (Puerto 8000)
uvicorn wepay_backend.menu_service.main:app --port 8000 --reload

# 2. Auth Service (Puerto 8001)
uvicorn wepay_backend.auth_service.main:app --port 8001 --reload

# 3. Session Service (Puerto 8002)
uvicorn wepay_backend.session_service.main:app --port 8002 --reload

# 4. Payment Service (Puerto 8003)
uvicorn wepay_backend.payment_service.main:app --port 8003 --reload

# 5. API Gateway (Puerto 8080)
uvicorn wepay_backend.gateway.main:app --port 8080 --reload
```

---

### 4. Frontend (Cliente Web)
Navega a la carpeta del frontend e inicia el servidor de desarrollo Vite:
```bash
cd wepay-frontend
npm install
npm run dev
```
Abre tu navegador en: [http://localhost:5173](http://localhost:5173).

Para generar el build optimizado de producción:
```bash
npm run build
```

---

## 📱 Flujos de Usuario Principales

1. **Comensal (Diner Experience):**
   * Escanea el código QR de la mesa física (`/local/:restaurante/id/:id/mesa_fisica/:mesa`).
   * Explora el menú por categorías interactivas y agrega platillos a la comanda compartida.
   * Admite usuarios autenticados con cuenta WePay e invitados anónimos (identificados por nombre).
   * Consulta el desglose en tiempo real en `/cuenta/:id` con recálculo dinámico de totales.

2. **Cocina (KDS Experience):**
   * Ingresa a `/cocinero`.
   * Escucha la campana y observa la alerta roja en cuanto un pedido es registrado en el sistema.
   * Consulta el ticket con nombre del platillo, cantidad y comensal/mesa solicitante.
   * Cambia el estado a "Lista" para notificar al personal de piso.

3. **Administrador (Root Dashboard):**
   * Acceso en `/administrador`.
   * Permite crear y configurar nuevos restaurantes, mesas físicas y categorías de platillos.
   * Alterna la disponibilidad de productos (disponible / agotado) con un clic.

4. **División de Cuentas y Transferencias ("Tablas"):**
   * Cálculo de aportes individuales y abonos directos.
   * Transferencia de saldo entre comensales sincronizada en memoria y registrada en la base de datos.

---

## 📚 Documentación Técnica Adicional

Para consultar especificaciones completas de esquemas de datos, diagramas Entidad-Relación (ER), contratos JSON de endpoints, detalles criptográficos y el historial de cambios, revisa el archivo maestro:

👉 **[docs/ARCHITECTURE_AND_CHANGELOG.md](file:///docs/ARCHITECTURE_AND_CHANGELOG.md)**
