import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [restaurantes, setRestaurantes] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    // Le pegamos al API Gateway, ¡y él hace el resto!
    axios.get('http://localhost:8080/menu/restaurantes/')
      .then(response => {
        setRestaurantes(response.data)
      })
      .catch(err => {
        console.error(err)
        setError("No se pudo conectar con el backend.")
      })
  }, [])

  return (
    <div className="family-container">
      <header className="family-header">
        <h1 className="family-title">WePay - Pantalla de Prueba</h1>
      </header>

      <main className="family-content">
        <h2>Restaurantes Disponibles</h2>
        
        {error && <p className="family-error" style={{color: 'red'}}>{error}</p>}
        
        {restaurantes.length === 0 && !error ? (
          <p>No hay restaurantes registrados aún o cargando...</p>
        ) : (
          <ul className="family-list">
            {restaurantes.map(rest => (
              <li key={rest.id} className="family-list-item">
                {rest.nombre}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

export default App