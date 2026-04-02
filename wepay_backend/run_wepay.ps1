$services = @(
    @{name="menu_service"; port=8000},
    @{name="auth_service"; port=8001},
    @{name="session_service"; port=8002},
    @{name="payment_service"; port=8003}
)

foreach ($service in $services) {

    Write-Host "Iniciando $($service.name) en puerto $($service.port)..."

    $cmd = "cd $($service.name); .\venv\Scripts\activate; uvicorn main:app --port $($service.port) --reload"

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd
}