# 💸 WePay - Microservicio de Menú y Restaurantes

**WePay** es una plataforma basada en microservicios diseñada para resolver el caos de pagar la cuenta en grupo. Este repositorio contiene el primer microservicio encargado de la gestión de catálogos, menús y precios.

## 🚀 Tecnologías Utilizadas
* **Backend:** Python 3.11+ con **FastAPI**.
* **Base de Datos:** PostgreSQL 15 (Relacional) y Redis (Cache/Tiempo Real).
* **ORM:** SQLAlchemy con soporte para UUIDs nativos.
* **Infraestructura:** Docker y Docker Compose.
* **Validación:** Pydantic v2.

## 🛠️ Instalación desde Cero

### 1. Clonar el repositorio

git clone [https://github.com/TU_USUARIO/wepay_backend.git](https://github.com/TU_USUARIO/wepay_backend.git)
cd wepay_backend

2. Levantar la Infraestructura (Docker)

Asegúrate de tener Docker Desktop abierto. Este comando creará automáticamente las 4 bases de datos lógicas (menu, usuarios, sesiones, pagos).


docker-compose up -d


3. Configurar el Microservicio de Menú
Entra a la carpeta del servicio y crea el entorno virtual:

cd menu_service
python -m venv venv

# Activar (Windows)
.\venv\Scripts\activate

# Activar (Mac/Linux)
source venv/bin/activate

# Instalar dependencias
pip install fastapi uvicorn sqlalchemy psycopg2-binary


4. Ejecutar el Servidor

uvicorn main:app --reload


📖 Documentación Interactiva

Una vez encendido el servidor, puedes probar todos los endpoints (Crear, Ver, Editar y Borrar restaurantes o platillos) en:
👉 http://localhost:8000/docs