# 🏛️ WePay - Arquitectura del Sistema y Registro de Cambios (Changelog)

Documento técnico integral que detalla la arquitectura de software, especificaciones de microservicios, modelos de bases de datos relacionales y en memoria, protocolos de comunicación WebSockets en tiempo real, variables de entorno y el historial de cambios y correcciones de **WePay**.

---

## 📑 Tabla de Contenidos

1. [Visión General del Sistema](#-visión-general-del-sistema)
2. [Diagrama de Arquitectura Global](#-diagrama-de-arquitectura-global)
3. [Módulos y Catálogo de Microservicios](#-módulos-y-catálogo-de-microservicios)
   - [API Gateway (8080)](#1-api-gateway-puerto-8080)
   - [Auth Service (8001)](#2-auth-service-puerto-8001)
   - [Menu Service (8000)](#3-menu-service-puerto-8000)
   - [Session Service (8002)](#4-session-service-puerto-8002)
   - [Payment Service (8003)](#5-payment-service-puerto-8003)
   - [Frontend Client (React + Vite)](#6-frontend-client-puerto-5173)
4. [Modelos de Base de Datos y Esquemas ER](#-modelos-de-base-de-datos-y-esquemas-er)
   - [PostgreSQL: Multi-Database Architecture](#postgresql-multi-database-architecture)
   - [Diagrama Entidad-Relación](#diagrama-entidad-relación-er)
   - [Modelos Relacionales Detallados](#modelos-relacionales-detallados)
   - [Estructura en Memoria (Redis Cache)](#estructura-en-memoria-redis-cache)
5. [Protocolo de Comunicación en Tiempo Real (WebSockets)](#-protocolo-de-comunicación-en-tiempo-real-websockets)
   - [Túnel Bidireccional del Gateway](#túnel-bidireccional-del-gateway)
   - [Salas / Canales Activos](#salas--canales-activos)
   - [Eventos y Payloads](#eventos-y-payloads)
   - [Flujo Secuencial: Comanda en Cocina y Mesa](#flujo-secuencial-comanda-en-cocina-y-mesa)
6. [Sistema de Comandas de Cocina (KDS - Kitchen Display System)](#-sistema-de-comandas-de-cocina-kds)
7. [Variables de Entorno y Configuración](#-variables-de-entorno-y-configuración)
8. [Changelog & Historial de Correcciones](#-changelog--historial-de-correcciones)

---

## 🌐 Visión General del Sistema

**WePay** es una plataforma SaaS distribuida diseñada para digitalizar la experiencia de comensales en restaurantes, agilizando la toma de comandas, el seguimiento en tiempo real y la división equitativa o personalizada de cuentas grupales sin fricción.

### Principios de Diseño
* **Desacoplamiento Estricto:** Cada microservicio es dueño de su dominio de negocio y de su propia base de datos lógica.
* **Tolerancia a Fallos y Alta Disponibilidad:** El tráfico HTTP y WebSockets converge en un API Gateway centralizado que encapsula los servicios internos.
* **Latencia Ultra Baja en Sincronización:** Uso híbrido de PostgreSQL (persistencia duradera e inmutable) y Redis (estado volátil de alta concurrencia).
* **Experiencia de Usuario en Tiempo Real:** Canales WebSockets que transmiten eventos de pedidos, alertas visuales/sonoras en cocina y transferencias de deuda entre comensales al instante.

---

## 📊 Diagrama de Arquitectura Global

```mermaid
flowchart TD
    subgraph Clientes["💻 Clientes (Frontend React + Vite)"]
        UI_Comensal["📱 Vista Comensal / Mesa (/local/.../mesa/...)"]
        UI_Cuenta["🧮 Vista Cuenta Compartida (/cuenta/:id)"]
        UI_Cocina["👨‍🍳 KDS Cocina (/cocinero)"]
        UI_Admin["👑 Panel Admin / Root (/administrador)"]
    end

    subgraph Perimetro["🚪 Perímetro de Red"]
        Gateway["⚡ API Gateway (FastAPI / HTTPX / WebSockets)\nPuerto: 8080"]
    end

    subgraph BackendServices["⚙️ Microservicios Backend (FastAPI)"]
        AuthSvc["🔐 Auth Service\nPuerto: 8001\nOAuth2 / JWT / Bcrypt"]
        MenuSvc["📖 Menu Service\nPuerto: 8000\nRestaurantes / Categorías / Platillos"]
        SessionSvc["⏱️ Session Service\nPuerto: 8002\nMesas / Comandas / WebSocket Manager"]
        PaymentSvc["💳 Payment Service\nPuerto: 8003\nDivisión de Cuentas / Pagos"]
    end

    subgraph Persistencia["🗄️ Capa de Datos (Docker)"]
        subgraph Postgres["🐘 PostgreSQL (Puerto: 5432)"]
            DB_Auth[("wepay_auth")]
            DB_Menu[("wepay_menu")]
            DB_Sesiones[("wepay_sesiones")]
            DB_Pagos[("wepay_pagos")]
        end
        subgraph InMem["⚡ In-Memory Cache"]
            RedisDB[("Redis 7 (Puerto: 6379)\nEstado vivo de mesas")]
        end
    end

    Clientes -->|HTTP Requests| Gateway
    Clientes <==>|WebSockets (Túnel Bidireccional)| Gateway

    Gateway -->|HTTP Proxy /auth/*| AuthSvc
    Gateway -->|HTTP Proxy /menu/*| MenuSvc
    Gateway -->|HTTP Proxy /sesiones/*| SessionSvc
    Gateway -->|HTTP Proxy /pagos/*| PaymentSvc
    Gateway <==>|WS Proxy /sesiones/ws/*| SessionSvc

    AuthSvc --> DB_Auth
    MenuSvc --> DB_Menu
    SessionSvc --> DB_Sesiones
    SessionSvc <==> RedisDB
    PaymentSvc --> DB_Pagos
```

---

## 🧩 Módulos y Catálogo de Microservicios

### 1. API Gateway (Puerto 8080)
* **Archivo Principal:** `wepay_backend/gateway/main.py`
* **Función:** Puerta de enlace unificada (Reverse Proxy). Centraliza políticas CORS, enrutamiento asíncrono HTTP mediante `httpx.AsyncClient` y túnel bidireccional WebSockets con la librería `websockets`.
* **Endpoints Clave:**
  * `/{service}/{path:path}`: Enrutador genérico HTTP (soporta `GET`, `POST`, `PUT`, `DELETE`, `PATCH`).
  * `/{service}/ws/{path:path}`: Enrutador de túneles WebSocket. Captura conexiones desde el frontend y establece una conexión paralela como cliente hacia el microservicio interno, retransmitiendo mensajes en ambos sentidos de forma concurrente con `asyncio.gather`.

### 2. Auth Service (Puerto 8001)
* **Archivo Principal:** `wepay_backend/auth_service/main.py`
* **Módulos Auxiliares:** `models.py`, `schemas.py`, `database.py`, `auth_utils.py`
* **Responsabilidad:** Registro de comensales y administradores, hash seguro de contraseñas mediante Passlib (Bcrypt), generación y firma de JSON Web Tokens (JWT).
* **Seguridad y Parche de Estabilidad:** Carga `SECRET_KEY` desde variables de entorno con fallback seguro y trunca contraseñas a 72 bytes antes de hashear para prevenir excepciones nativas de bcrypt en Windows.
* **Endpoints:**
  * `POST /registro`: Registra usuario (`email`, `nombre_completo`, `password`).
  * `POST /login`: Valida credenciales y emite token JWT (`access_token`, `token_type`, `user_id`, `nombre`).
  * `GET /me`: Obtiene perfil del usuario autenticado vía cabecera `Authorization: Bearer <token>`.

### 3. Menu Service (Puerto 8000)
* **Archivo Principal:** `wepay_backend/menu_service/main.py`
* **Módulos Auxiliares:** `models.py`, `schemas.py`, `database.py`
* **Responsabilidad:** Catálogo estructurado para restaurantes, categorías y platillos. Manejo de disponibilidad (stock/agotado) y precios con precisión monetaria (`Numeric(10, 2)`).
* **Endpoints:**
  * `POST /restaurantes/` y `GET /restaurantes/`: CRUD de establecimientos.
  * `POST /categorias/` y `GET /restaurantes/{id}/categorias`: Organización jerárquica del menú.
  * `POST /items/` y `GET /categorias/{id}/items`: Gestión de ítems del catálogo.
  * `PATCH /items/{item_id}/disponibilidad`: Alterna el estado activo/agotado en tiempo real.

### 4. Session Service (Puerto 8002)
* **Archivo Principal:** `wepay_backend/session_service/main.py`
* **Módulos Auxiliares:** `models.py`, `schemas.py`, `database.py`, `redis_client.py`
* **Responsabilidad:** Núcleo interactivo de WePay. Gestiona mesas físicas, sesiones activas, comensales registrados e invitados, órdenes de comida, estado de preparación, abonos parciales, transferencias de deuda ("Tablas") y coordinación de WebSockets (`ConnectionManager`).
* **Endpoints Principales:**
  * `POST /sesion/verificar-fisica`: Identifica si una mesa ya posee una sesión abierta o inicializa una nueva, precalentando Redis.
  * `POST /sesion/abrir`: Apertura manual de sesión.
  * `POST /sesion/{sesion_id}/pedir`: Inserción de comanda con notificación dual: a la mesa y a la cocina.
  * `GET /sesion/{sesion_id}/estado`: Consulta híbrida (Cache-Aside: Redis prioritario, fallback a PostgreSQL).
  * `GET /ordenes/pendientes`: Retorna listado de ítems en espera para el personal de cocina.
  * `PUT /ordenes/{orden_id}/estado`: Modifica el estado del platillo (`pendiente` ➔ `preparando` ➔ `lista` ➔ `entregada`).
  * `POST /sesion/{sesion_id}/marcar-pagado`: Registro de abonos individuales o cruzados entre comensales.
  * `POST /sesion/{sesion_id}/registrar-transferencia`: Ajuste de balances de deuda (Tablas) sincronizado en Redis.
  * `WS /ws/sesion/{sesion_id}`: Canal en vivo para los dispositivos sentados en la mesa.
  * `WS /ws/cocina`: Canal en vivo para la pantalla de cocina (KDS).

### 5. Payment Service (Puerto 8003)
* **Archivo Principal:** `wepay_backend/payment_service/main.py`
* **Módulos Auxiliares:** `models.py`, `schemas.py`, `database.py`
* **Responsabilidad:** Algoritmos de cálculo para división equitativa o proporcional de la cuenta, propinas y registro de transacciones finales en la base de datos `wepay_pagos`.
* **Endpoints:**
  * `POST /pagos/calcular-division`: Simulación matemática de liquidación de cuentas compartidas.
  * `POST /pagos/registrar`: Persistencia de pago procesado con tarjeta, efectivo o transferencia.

### 6. Frontend Client (Puerto 5173)
* **Tecnología:** React 18, Vite, React Router DOM, Bootstrap 5, Axios.
* **Componentes Destacados:**
  * `VistaCocinero.jsx` (`/cocinero`): Pantalla Kanban para preparación de pedidos con campana de audio y alerta estroboscópica.
  * `Cuenta.jsx` (`/cuenta/:id`): Monitor multijugador del balance de la mesa en tiempo real vía WebSocket.
  * `Menu.jsx`: Navegación de categorías y selección de platillos con persistencia de comensal (autenticado o invitado).
  * `PuertaFisica.jsx`: Enrutamiento y verificación de mesas mediante escaneo de código QR.
  * `RootAdmin.jsx`: Gestión integral de cartas, restaurantes y mesas por parte del negocio.

---

## 🗄️ Modelos de Base de Datos y Esquemas ER

### PostgreSQL: Multi-Database Architecture
PostgreSQL corre en el puerto `5432` alojando 4 bases de datos lógicas aisladas creadas mediante `init-multiple-dbs.sh`:
1. `wepay_auth`
2. `wepay_menu`
3. `wepay_sesiones`
4. `wepay_pagos`

### Diagrama Entidad-Relación (ER)

```mermaid
erDiagram
    USUARIO {
        UUID id PK
        string email UK
        string nombre_completo
        string hashed_password
        timestamp creado_en
    }

    RESTAURANTE {
        UUID id PK
        string nombre
        string direccion
        string telefono
        timestamp creado_en
    }

    CATEGORIA_MENU {
        UUID id PK
        UUID restaurante_id FK
        string nombre
        string descripcion
    }

    ITEM_MENU {
        UUID id PK
        UUID categoria_id FK
        string nombre
        string descripcion
        numeric precio
        boolean disponible
    }

    SESION_MESA {
        UUID id PK
        UUID restaurante_id
        string numero_mesa
        boolean activa
        timestamp creada_en
    }

    MESA_FISICA {
        UUID id PK
        UUID restaurante_id
        string nombre
    }

    ORDEN_ITEM {
        UUID id PK
        UUID sesion_id FK
        UUID usuario_id "Nullable (Invitados)"
        string nombre_usuario "Ej: Paco, Ana"
        UUID item_menu_id
        int cantidad
        string estado "pendiente, preparando, lista, entregada"
        boolean pagado
    }

    ABONO_SESION {
        UUID id PK
        UUID sesion_id FK
        string identificador "UUID o Nombre"
        float monto
    }

    PAGO_FINAL {
        UUID id PK
        UUID sesion_id
        UUID usuario_id "Nullable"
        float monto
        string metodo_pago
        boolean completado
        timestamp fecha_pago
    }

    RESTAURANTE ||--o{ CATEGORIA_MENU : "organiza"
    CATEGORIA_MENU ||--o{ ITEM_MENU : "contiene"
    SESION_MESA ||--o{ ORDEN_ITEM : "registra"
    SESION_MESA ||--o{ ABONO_SESION : "acumula"
```

### Modelos Relacionales Detallados

#### 1. DB `wepay_auth`
* **Tabla `usuarios` (`models.Usuario`):**
  * `id`: UUID (Primary Key, auto-generado).
  * `email`: String (Unique, Indexado, Not Null).
  * `nombre_completo`: String (Not Null).
  * `hashed_password`: String (Not Null, Bcrypt hash truncado a 72 chars).
  * `creado_en`: DateTime con zona horaria (`server_default=func.now()`).

#### 2. DB `wepay_menu`
* **Tabla `restaurantes` (`models.Restaurante`):**
  * `id`: UUID (Primary Key).
  * `nombre`: String (Indexado, Not Null).
  * `direccion`: String (Opcional).
  * `telefono`: String (Opcional).
  * `creado_en`: DateTime con zona horaria.
* **Tabla `categorias_menu` (`models.CategoriaMenu`):**
  * `id`: UUID (Primary Key).
  * `restaurante_id`: UUID (Foreign Key ➔ `restaurantes.id`, On Delete Cascade).
  * `nombre`: String (Indexado, Not Null).
  * `descripcion`: String (Opcional).
* **Tabla `items_menu` (`models.ItemMenu`):**
  * `id`: UUID (Primary Key).
  * `categoria_id`: UUID (Foreign Key ➔ `categorias_menu.id`, On Delete Cascade).
  * `nombre`: String (Indexado, Not Null).
  * `descripcion`: String (Opcional).
  * `precio`: Numeric(10, 2) (Not Null, alta precisión monetaria).
  * `disponible`: Boolean (Default: True).

#### 3. DB `wepay_sesiones`
* **Tabla `sesiones_mesa` (`models.SesionMesa`):**
  * `id`: UUID (Primary Key).
  * `restaurante_id`: UUID (Not Null).
  * `numero_mesa`: String (Not Null).
  * `activa`: Boolean (Default: True).
  * `creada_en`: DateTime con zona horaria.
* **Tabla `mesas_fisicas` (`models.MesaFisica`):**
  * `id`: UUID (Primary Key).
  * `restaurante_id`: UUID (Not Null).
  * `nombre`: String (Not Null, ej. "Mesa 1", "Terraza 3").
* **Tabla `ordenes_items` (`models.OrdenItem`):**
  * `id`: UUID (Primary Key).
  * `sesion_id`: UUID (Foreign Key ➔ `sesiones_mesa.id`).
  * `usuario_id`: UUID (Nullable: permite comensales invitados sin cuenta).
  * `nombre_usuario`: String (Nullable: almacena el nombre del invitado).
  * `item_menu_id`: UUID (Not Null).
  * `cantidad`: Integer (Default: 1).
  * `estado`: String (Default: `'pendiente'`, valores: `'pendiente'`, `'preparando'`, `'lista'`, `'entregada'`).
  * `pagado`: Boolean (Default: False).
* **Tabla `abonos_sesion` (`models.AbonoSesion`):**
  * `id`: UUID (Primary Key).
  * `sesion_id`: UUID (Foreign Key ➔ `sesiones_mesa.id`).
  * `identificador`: String (UUID de usuario o Nombre de comensal).
  * `monto`: Float (Monto transferido o abonado; admite valores negativos para deudas cedidas).

#### 4. DB `wepay_pagos`
* **Tabla `pagos_finales` (`models.Pago`):**
  * `id`: UUID (Primary Key).
  * `sesion_id`: UUID (Not Null).
  * `usuario_id`: UUID (Nullable).
  * `monto`: Float (Not Null).
  * `metodo_pago`: String (Default: `'tarjeta'`, opciones: `'tarjeta'`, `'efectivo'`, `'transferencia'`).
  * `completado`: Boolean (Default: False).
  * `fecha_pago`: DateTime con zona horaria.

---

### Estructura en Memoria (Redis Cache)

Redis almacena bajo la clave `mesa:{sesion_id}` una representación deserializada en formato JSON que garantiza acceso con latencia sub-milisegundo.

**Ejemplo de Payload en Redis:**
```json
{
  "sesion_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "restaurante_id": "98765432-10ab-cdef-0123-456789abcdef",
  "numero_mesa": "4",
  "estado": "abierta",
  "items": [
    {
      "usuario_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "nombre_usuario": "Carlos",
      "item_id": "c9a646d3-9c61-4cc9-bc78-43890289f667",
      "cantidad": 2
    },
    {
      "usuario_id": null,
      "nombre_usuario": "Mariana (Invitada)",
      "item_id": "e2b10a45-1234-4bc3-9876-000000000001",
      "cantidad": 1
    }
  ],
  "abonos": {
    "f47ac10b-58cc-4372-a567-0e02b2c3d479": 150.00,
    "Mariana (Invitada)": 85.50
  },
  "propuesta_activa": null,
  "historial_apoyos": [
    {
      "de": "Carlos",
      "para": "Mariana (Invitada)",
      "monto": 50.00,
      "tipo": "tablas"
    }
  ]
}
```

---

## ⚡ Protocolo de Comunicación en Tiempo Real (WebSockets)

### Túnel Bidireccional del Gateway
El Frontend no se conecta de forma directa a los puertos internos de los microservicios, sino que apunta al Gateway en el puerto `8080`.
* **Ruta de conexión:** `ws://<host>:8080/{service}/ws/{path}`
* **Traducción interna:** El gateway reescribe el esquema a `ws://127.0.0.1:<puerto_servicio>/ws/{path}` y mantiene dos bucles asíncronos concurrentes (`forward_to_backend` y `forward_to_client`).

### Salas / Canales Activos

| Canal / Sala | Ruta Externa (Gateway) | Ruta Interna (Session Service) | Destinatarios | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **Mesa Activa** | `ws://<host>:8080/sesiones/ws/sesion/{sesion_id}` | `ws://127.0.0.1:8002/ws/sesion/{sesion_id}` | Comensales en la misma mesa | Notificar adición de platillos, abonos y recálculo de cuenta. |
| **Cocina (KDS)** | `ws://<host>:8080/sesiones/ws/cocina` | `ws://127.0.0.1:8002/ws/cocina` | Pantallas de cocina (`/cocinero`) | Alerta instantánea sonora/visual de nueva comanda ingresada. |

### Eventos y Payloads

#### 1. Evento: `actualizar_mesa`
* **Canal:** `sesion_{sesion_id}`
* **Payload:** String `"actualizar_mesa"` o JSON `{"accion": "actualizar_mesa"}`
* **Disparador:** Invocado al ejecutarse `POST /sesion/{sesion_id}/pedir` o `POST /sesion/{sesion_id}/marcar-pagado`.
* **Reacción en Cliente (`Cuenta.jsx`):** Ejecuta `cargarCuenta()` y re-renderiza los totales y divisiones en pantalla.

#### 2. Evento: `nueva_comanda`
* **Canal:** `cocina`
* **Payload:** JSON `{"accion": "nueva_comanda"}`
* **Disparador:** Emitido en background cuando cualquier mesa añade un ítem mediante `POST /sesion/{id}/pedir`.
* **Reacción en Cliente (`VistaCocinero.jsx`):**
  1. Reproducción sonora de alerta (`new Audio('/campana.mp3')`).
  2. Destello visual estroboscópico de advertencia (`bg-danger bg-opacity-25`).
  3. Petición automática a `GET /ordenes/pendientes` para actualizar el tablero de comandas.

---

### Flujo Secuencial: Comanda en Cocina y Mesa

```mermaid
sequenceDiagram
    autonumber
    actor Comensal as 📱 Comensal (Mesa 4)
    participant Gateway as 🚪 API Gateway (:8080)
    participant SessionSvc as ⏱️ Session Service (:8002)
    participant Redis as ⚡ Redis Cache (:6379)
    participant Postgres as 🐘 PostgreSQL (:5432)
    actor Cocinero as 👨‍🍳 Cocina (/cocinero)

    Note over Cocinero, Gateway: Cocinero conectado a ws://host:8080/sesiones/ws/cocina
    Note over Comensal, Gateway: Comensal conectado a ws://host:8080/sesiones/ws/sesion/{id}

    Comensal->>Gateway: POST /sesiones/sesion/{id}/pedir {item_id, cantidad: 2}
    Gateway->>SessionSvc: Forward request
    SessionSvc->>Postgres: INSERT INTO ordenes_items (estado='pendiente', ...)
    SessionSvc->>Redis: Actualizar estado vivo (mesa:{id}.items)
    
    par Notificación a Comensales
        SessionSvc-->>Gateway: WS Broadcast sala {id}: "actualizar_mesa"
        Gateway-->>Comensal: WS Message: "actualizar_mesa"
        Comensal->>Gateway: GET /sesiones/sesion/{id}/estado
        Gateway-->>Comensal: Estado actualizado (Totales actualizados)
    and Notificación a Cocina
        SessionSvc-->>Gateway: WS Broadcast sala "cocina": {"accion": "nueva_comanda"}
        Gateway-->>Cocinero: WS Message: {"accion": "nueva_comanda"}
        Note over Cocinero: 🔔 Campana sonora + Destello rojo
        Cocinero->>Gateway: GET /sesiones/ordenes/pendientes
        Gateway-->>Cocinero: Lista de comandas pendientes
    end

    SessionSvc-->>Gateway: 200 OK (OrdenItemResponse)
    Gateway-->>Comensal: 200 OK (OrdenItemResponse)

    Note over Cocinero: Cocinero presiona "Marcar como Lista"
    Cocinero->>Gateway: PUT /sesiones/ordenes/{orden_id}/estado?estado_nuevo=lista
    Gateway->>SessionSvc: Forward request
    SessionSvc->>Postgres: UPDATE ordenes_items SET estado='lista' WHERE id=orden_id
    SessionSvc-->>Gateway: 200 OK
    Gateway-->>Cocinero: 200 OK (Ticket actualizado / retirado)
```

---

## 👨‍🍳 Sistema de Comandas de Cocina (KDS)

El Kitchen Display System de WePay permite al personal gastronómico visualizar tickets de preparación en tiempo real, erradicando retrasos por comandas en papel.

### Componentes Clave:
1. **Frontend (`VistaCocinero.jsx` en `/cocinero`):**
   * Panel responsivo con diseño de tarjetas tipo ticket restaurante.
   * Auto-resolución dinámica del host WebSocket (`window.location.hostname:8080`) para operar en redes LAN locales o producción sin reconfiguración estática.
   * Reproductor de audio HTML5 que invoca `/campana.mp3` ubicado en la carpeta estática `public/`.
   * Banner de alerta animado con clases CSS de Bootstrap y animación de destello.
   * Botón de acción reactiva "Marcar como Lista" con actualización optimista de interfaz.

2. **Ciclo de Estados de una Comanda:**
   * `pendiente`: Recién ordenada por el comensal. Visible en `/cocinero`.
   * `preparando`: En proceso de cocción por el chef.
   * `lista`: Lista en barra para ser servida por el mesero.
   * `entregada`: Servida en la mesa del comensal.

---

## ⚙️ Variables de Entorno y Configuración

| Módulo / Servicio | Variable | Valor por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| **Frontend** | `VITE_API_BASE_URL` | `http://localhost:8080` | URL base del API Gateway HTTP. |
| **Gateway** | `CORS_ORIGINS` | `localhost:5173, 192.168.*` | Orígenes permitidos para peticiones cruzadas. |
| **Auth Service** | `SECRET_KEY` | *(Variable de entorno con fallback seguro)* | Llave criptográfica para firma simétrica HS256 de JWT. |
| **Auth Service** | `ALGORITHM` | `HS256` | Algoritmo de firma digital JWT. |
| **Auth Service** | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Tiempo de vida del token de acceso en minutos. |
| **Auth Service** | `DATABASE_URL` | `postgresql://admin_wepay:superpassword123@127.0.0.1:5432/wepay_auth` | Cadena de conexión para la base de datos de usuarios. |
| **Menu Service** | `DATABASE_URL` | `postgresql://admin_wepay:superpassword123@127.0.0.1:5432/wepay_menu` | Cadena de conexión para la base de datos del menú y locales. |
| **Session Service** | `DATABASE_URL` | `postgresql://admin_wepay:superpassword123@127.0.0.1:5432/wepay_sesiones` | Cadena de conexión para sesiones y comandas. |
| **Session Service** | `REDIS_HOST` | `localhost` | Host del servidor de caché Redis. |
| **Session Service** | `REDIS_PORT` | `6379` | Puerto de conexión a Redis. |
| **Payment Service** | `DATABASE_URL` | `postgresql://admin_wepay:superpassword123@127.0.0.1:5432/wepay_pagos` | Cadena de conexión para pagos y balances. |
| **Infraestructura** | `POSTGRES_USER` | `admin_wepay` | Usuario maestro de PostgreSQL en contenedor Docker. |
| **Infraestructura** | `POSTGRES_PASSWORD`| `superpassword123` | Contraseña maestra de PostgreSQL. |

---

## 📜 Changelog & Historial de Correcciones

### [v2.1.0] - Implementación de Cocina KDS y Robustecimiento de WebSockets
* **[Feature] Sistema de Comandas en Vivo para Cocina:**
  * Incorporada ruta `/cocinero` y componente `VistaCocinero.jsx`.
  * Canal WebSocket dedicado `/ws/cocina` en `Session Service` y tunelizado a través del `API Gateway`.
  * Integración de efecto sonoro `/campana.mp3` ubicado en el directorio público de Vite y alerta visual roja de 3 segundos ante nuevas comandas.
* **[Backend] Ciclo de Vida de Comandas:**
  * Incorporado campo `estado` en el modelo `OrdenItem` (`pendiente`, `preparando`, `lista`, `entregada`).
  * Creado endpoint `GET /ordenes/pendientes` para alimentar el tablero de cocina.
  * Creado endpoint `PUT /ordenes/{orden_id}/estado` para transición de estados de preparación.
  * Emisión automática de evento `{"accion": "nueva_comanda"}` a la sala `cocina` dentro de `agregar_item_a_cuenta`.
* **[Security] Hardening de Autenticación:**
  * Actualización en `auth_utils.py` para cargar `SECRET_KEY` vía `os.getenv` manteniendo un fallback seguro.
  * Mitigación de limitación de 72 bytes en Passlib/Bcrypt para entornos Windows mediante truncado seguro previo al hashing.
* **[Fix & Refactor] Resiliencia de Red y WebSockets Dinámicos:**
  * Corrección de rutas estáticas `localhost` en `VistaCocinero.jsx` y `Cuenta.jsx` reemplazadas por `window.location.hostname:8080`, posibilitando pruebas concurrentes desde múltiples dispositivos en red de área local (LAN).
  * Habilitación y verificación completa de la sincronización multijugador en `Cuenta.jsx`.
  * Verificación de compilación limpia de frontend con Vite (`npm run build`) con 0 advertencias o errores de resolución de assets.
