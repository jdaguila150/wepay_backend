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
        "http://127.0.0.1:5173",
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

def http_to_ws(url: str) -> str:
    """Convierte URL HTTP/HTTPS a WS/WSS."""
    if url.startswith("https://"):
        return "wss://" + url[8:]
    elif url.startswith("http://"):
        return "ws://" + url[7:]
    return url

async def tunnel_ws(websocket: WebSocket, target_url: str):
    """Túnel bidireccional entre el cliente y el microservicio WebSocket."""
    await websocket.accept()
    try:
        async with websockets.connect(target_url) as backend_ws:
            async def forward_to_backend():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await backend_ws.send(data)
                except WebSocketDisconnect:
                    pass

            async def forward_to_client():
                try:
                    while True:
                        data = await backend_ws.recv()
                        await websocket.send_text(data)
                except websockets.exceptions.ConnectionClosed:
                    pass

            await asyncio.gather(
                forward_to_backend(),
                forward_to_client(),
            )
    except Exception as e:
        print(f"Error conectando al WebSocket backend ({target_url}): {e}")
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass

# =====================================================================
# 1. ENRUTADOR DE WEBSOCKETS (El túnel en tiempo real)
# =====================================================================
@app.websocket("/{service}/ws/{path:path}")
async def websocket_gateway(websocket: WebSocket, service: str, path: str):
    """
    Atrapa peticiones y funciona como un túnel bidireccional real.
    Túnel para /sesiones/ws/cocina -> ws://127.0.0.1:8002/ws/cocina
    """
    if service not in SERVICES:
        await websocket.close(code=4004, reason="Servicio no encontrado")
        return

    target_url = f"{http_to_ws(SERVICES[service])}/ws/{path}"
    await tunnel_ws(websocket, target_url)

@app.websocket("/ws/cocina")
async def websocket_cocina_direct(websocket: WebSocket):
    """
    Ruta directa de conveniencia para /ws/cocina hacia session_service
    """
    target_url = f"{http_to_ws(SERVICES['sesiones'])}/ws/cocina"
    await tunnel_ws(websocket, target_url)

# =====================================================================
# 2. ENRUTADOR HTTP (Las peticiones tradicionales)
# =====================================================================
@app.api_route("/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def gateway(service: str, path: str, request: Request):
    if service == "ordenes":
        url = f"{SERVICES['sesiones']}/ordenes/{path}"
    elif service not in SERVICES:
        raise HTTPException(status_code=404, detail="Servicio no encontrado en WePay")
    else:
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