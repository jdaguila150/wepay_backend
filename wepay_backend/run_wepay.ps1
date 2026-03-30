# Iniciar todos los microservicios de WePay en ventanas nuevas
Start-Process powershell "-NoExit", "-Command", "cd menu_service; .\venv\Scripts\activate; uvicorn main:app --port 8000"
Start-Process powershell "-NoExit", "-Command", "cd auth_service; .\venv\Scripts\activate; uvicorn main:app --port 8001"
Start-Process powershell "-NoExit", "-Command", "cd session_service; .\venv\Scripts\activate; uvicorn main:app --port 8002"
Start-Process powershell "-NoExit", "-Command", "cd payment_service; .\venv\Scripts\activate; uvicorn main:app --port 8003"