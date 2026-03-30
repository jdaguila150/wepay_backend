import redis
import json

# Conexión al contenedor de Redis que definimos en el docker-compose
redis_conn = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def actualizar_estado_mesa(sesion_id: str, data: dict):
    # Guardamos el estado de la mesa como un JSON en Redis
    redis_conn.set(f"mesa:{sesion_id}", json.dumps(data))

def obtener_estado_mesa(sesion_id: str):
    data = redis_conn.get(f"mesa:{sesion_id}")
    return json.loads(data) if data else None