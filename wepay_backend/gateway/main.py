from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="WePay API Gateway")

# --- CONFIGURACIÓN DE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Permite a tu app de React conectarse
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICES = {
    "menu": "http://localhost:8000",
    "auth": "http://localhost:8001",
    "sesiones": "http://localhost:8002",
    "pagos": "http://localhost:8003"
}

@app.api_route("/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def gateway(service: str, path: str, request: Request):
    # 1. Verificar si el servicio solicitado existe
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Servicio no encontrado en WePay")

    # 2. Construir la URL de destino
    url = f"{SERVICES[service]}/{path}"
    
    # 3. Reenviar la petición con los mismos headers y cuerpo
    async with httpx.AsyncClient() as client:
        try:
            # Capturamos el body de la petición original
            body = await request.body()
            
            # Reenviamos al microservicio correspondiente
            response = await client.request(
                method=request.method,
                url=url,
                params=request.query_params,
                content=body,
                headers=dict(request.headers)
            )
            
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con {service}: {str(e)}")