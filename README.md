# 🚀 WePay - Sistema Inteligente para Cuentas Compartidas

WePay es una plataforma SaaS (Software as a Service) diseñada para revolucionar la experiencia en restaurantes. Permite a los comensales abrir mesas virtuales, escanear el menú en tiempo real, agregar platillos a una cuenta compartida y, eventualmente, dividir el pago sin fricciones. 

Este proyecto está construido bajo una robusta arquitectura de **Microservicios**, separando responsabilidades para garantizar escalabilidad, seguridad y alta disponibilidad.

---

## 🛠️ Stack Tecnológico

### Frontend (Cliente)
* **Framework:** React.js (Vite)
* **Estilos:** Bootstrap 5 + CSS Custom (Diseño Premium)
* **Iconografía:** Google Material Icons
* **Rutas:** React Router DOM
* **Peticiones HTTP:** Axios
* **Gestión de Estado y Auth:** LocalStorage + JWT Token

### Backend (Microservicios)
* **Framework:** FastAPI (Python)
* **Gateway:** FastAPI + HTTPX (Enrutamiento asíncrono)
* **ORM & Base de Datos:** SQLAlchemy + PostgreSQL
* **Caché y Tiempo Real:** Redis (Gestión de sesiones de mesas activas)
* **Validación de Datos:** Pydantic

---

## 🏗️ Arquitectura de Microservicios

El backend no es un monolito, sino un ecosistema de servicios independientes que se comunican a través de un **API Gateway**. Todo el tráfico del Frontend pasa obligatoriamente por el Gateway (Puerto 8080).

| Servicio | Puerto Local | Descripción |
| :--- | :--- | :--- |
| **API Gateway** | `8080` | Puerta de entrada única. Enruta peticiones y maneja el CORS. |
| **Menu Service** | `8000` | CRUD de Restaurantes, Categorías y Platillos (Catálogo). |
| **Auth Service** | `8001` | Registro de usuarios, Login y generación de JWT Tokens. |
| **Sesiones Service** | `8002` | Lógica en vivo: Abrir mesas, agregar pedidos a la cuenta (Usa Redis). |
| **Pagos Service** | `8003` | *(En desarrollo)* Integración con pasarelas de pago y división de cuentas. |

---

## ✨ Características Principales

* 🔒 **Autenticación Segura:** Sistema de Login/Registro basado en JWT Tokens. El Frontend extrae y almacena el `user_id` y el token de acceso para peticiones firmadas.
* 👑 **Modo Root (Admin Dashboard):** Panel de control interactivo para gestionar múltiples sucursales. Permite crear categorías, añadir platillos y alternar el estado de disponibilidad (Agotado/Disponible) en tiempo real mediante un DataTable reactivo.
* 📱 **Experiencia de Comensal:** * Vista de inicio con catálogo de restaurantes disponibles.
  * Interfaz de "Mesa Abierta" que consulta la sesión actual.
  * Menú navegable por categorías mediante píldoras deslizables.
  * Botón de añadir al carrito sincronizado con el ID del usuario y la sesión activa.
* ⚡ **Alta Velocidad:** Implementación de Redis en el microservicio de Sesiones para gestionar pedidos concurrentes sin saturar la base de datos relacional (PostgreSQL).

---

## 🚀 Instalación y Ejecución en Desarrollo

### 1. Requisitos Previos
* Node.js (v18+)
* Python (v3.10+)
* PostgreSQL (Corriendo en el puerto 5432)
* Redis Server (Corriendo en el puerto 6379)

### 2. Configuración del Backend (Microservicios)
Debes levantar cada microservicio de manera independiente (o usar un gestor como Docker Compose si está configurado).

1. Clona el repositorio.
2. Crea un entorno virtual (`python -m venv venv`) y actívalo.
3. Instala las dependencias: `pip install -r requirements.txt`.
4. Inicia los microservicios usando Uvicorn en sus puertos respectivos:
   ```bash
   uvicorn menu_service.main:app --port 8000 --reload
   uvicorn auth_service.main:app --port 8001 --reload
   uvicorn sesiones_service.main:app --port 8002 --reload
   uvicorn gateway.main:app --port 8080 --reload
3. Configuración del Frontend
Navega a la carpeta del frontend: cd wepay-frontend

Instala los paquetes de Node:

Bash
npm install
Levanta el servidor de desarrollo (Vite):

Bash
npm run dev
Abre tu navegador en http://localhost:5173.

📚 Documentación de la API
Gracias a FastAPI, la documentación de todos los endpoints se genera automáticamente. Una vez que los servicios estén corriendo, puedes visitar:

Gateway Swagger UI: http://localhost:8080/docs

Menu Service Schemas: http://localhost:8000/docs

Sesiones Service Schemas: http://localhost:8002/docs

🗺️ Próximos Pasos (Roadmap)
[ ] Vista de "Mi Cuenta" (Resumen del carrito de la mesa).

[ ] Implementación de WebSockets para notificar a la cocina y a otros comensales sobre nuevos pedidos en tiempo real.

[ ] Microservicio de Pagos para dividir la cuenta equitativamente.
