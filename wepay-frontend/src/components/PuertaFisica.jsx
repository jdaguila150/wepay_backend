import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const PuertaFisica = () => {
    const { nombre_restaurante, restaurante_id, numero_mesa } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);

    // Limpiamos los nombres para mostrarlos bonitos en la pantalla de carga
    const nombreLimpio = nombre_restaurante ? nombre_restaurante.replaceAll('_', ' ') : '';
    const mesaLimpia = numero_mesa ? numero_mesa.replaceAll('_', ' ') : '';

    useEffect(() => {
        const verificarMesa = async () => {
            try {
                // Le tocamos la puerta al nuevo endpoint de FastAPI
                const response = await api.post('/sesiones/sesion/verificar-fisica', {
                    restaurante_id: restaurante_id,
                    numero_mesa: mesaLimpia
                });

                // El backend nos devuelve el UUID de la sesión (sea nueva o existente)
                const sesionId = response.data.id;

                // ¡LA MAGIA! Redirigimos a la burbuja aislada
                // Usamos 'replace: true' para que si el usuario le da al botón de "Atrás" en su celular, 
                // no regrese a esta pantalla de carga, sino que salga de la app.
                navigate(`/local/${nombre_restaurante}/mesa/${sesionId}?modo=qr`, { replace: true });

                
            } catch (err) {
                console.error("Error al verificar la mesa física:", err);
                setError("Hubo un problema al preparar tu mesa. Por favor, escanea el QR nuevamente.");
            }
        };

        verificarMesa();
    }, [restaurante_id, mesaLimpia, nombre_restaurante, navigate]);

    return (
        <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center" style={{ backgroundColor: '#F8F9FA' }}>
            {error ? (
                <div className="text-center p-4">
                    <span className="material-icons text-danger mb-3" style={{ fontSize: '4rem' }}>error_outline</span>
                    <h4 className="text-dark fw-bold">¡Ups!</h4>
                    <p className="text-muted">{error}</p>
                </div>
            ) : (
                <div className="text-center p-4 animation-fade-in">
                    <div className="spinner-border mb-4" style={{ width: '4rem', height: '4rem', color: '#F37A20' }} role="status">
                        <span className="visually-hidden">Cargando...</span>
                    </div>
                    <h3 className="fw-bold text-dark mb-1">Preparando tu mesa...</h3>
                    <p className="text-muted fs-5">
                        Bienvenidos a <strong>{nombreLimpio}</strong><br/>
                        Mesa {mesaLimpia}
                    </p>
                </div>
            )}
        </div>
    );
};

export default PuertaFisica;