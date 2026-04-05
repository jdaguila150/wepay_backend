from fastapi import FastAPI, Request, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
import websockets
import asyncio

app = FastAPI(title="WePay API Gateway")

# --- CONFIGURACIÓN DE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",          
        "http://192.168.100.26:5173" 
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICES = {
    "menu": "http://127.0.0.1:8000",
    "auth": "http://127.0.0.1:8001",
    "sesiones": "http://127.0.0.1:8002",
    "pagos": "http://127.0.0.1:8003"
}

# =====================================================================
# 1. ENRUTADOR DE WEBSOCKETS (El túnel en tiempo real)
# =====================================================================
@app.websocket("/{service}/ws/{path:path}")
async def websocket_gateway(websocket: WebSocket, service: str, path: str):
    """
    Atrapa peticiones y funciona como un túnel bidireccional real.
    """
    if service not in SERVICES:
        await websocket.close(code=4004, reason="Servicio no encontrado")
        return

    # Construimos la URL objetivo. 
    # Asegúrate de que SERVICES["sesiones"] sea "http://localhost:8002"
    target_url = SERVICES[service].replace("http", "ws") + f"/ws/{path}"

    await websocket.accept()

    try:
        # El Gateway se conecta como "cliente" al microservicio
        async with websockets.connect(target_url) as backend_ws:
            
            # Tarea 1: Leer del Frontend y enviar al Microservicio
            async def forward_to_backend():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await backend_ws.send(data)
                except WebSocketDisconnect:
                    pass # El cliente se desconectó

            # Tarea 2: Leer del Microservicio y enviar al Frontend
            async def forward_to_client():
                try:
                    while True:
                        data = await backend_ws.recv()
                        await websocket.send_text(data)
                except websockets.exceptions.ConnectionClosed:
                    pass # El backend cerró la conexión

            # Ejecutamos ambos túneles al mismo tiempo
            await asyncio.gather(
                forward_to_backend(),
                forward_to_client(),
            )
            
    except Exception as e:
        print(f"Error conectando al backend: {e}")
    finally:
        # Si algo falla o las tareas terminan, nos aseguramos de cerrar el socket del frontend
        try:
            await websocket.close()
        except RuntimeError:
            pass # Ya estaba cerrado

# =====================================================================
# 2. ENRUTADOR HTTP (Las peticiones tradicionales)
# =====================================================================
@app.api_route("/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def gateway(service: str, path: str, request: Request):
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail="Servicio no encontrado en WePay")

    url = f"{SERVICES[service]}/{path}"
    
    async with httpx.AsyncClient() as client:
        try:
            body = await request.body()
            
            response = await client.request(
                method=request.method,
                url=url,
                params=request.query_params,
                content=body,
                headers=dict(request.headers)
            )
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con {service}: {str(e)}")