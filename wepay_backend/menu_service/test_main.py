from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_main():
    # Prueba que el servidor responda
    response = client.get("/restaurantes/")
    assert response.status_code == 200

def test_create_restaurante():
    # Prueba crear un restaurante
    payload = {
        "nombre": "Test Place",
        "direccion": "Calle Falsa 123",
        "telefono": "000000"
    }
    response = client.post("/restaurantes/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["nombre"] == "Test Place"
    assert "id" in data