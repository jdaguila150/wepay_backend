import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api'


export default function Menu() {
    const [restaurantes, setRestaurantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Nuevos estados para el Modal de Abrir Mesa
    const [restauranteSeleccionado, setRestauranteSeleccionado] = useState(null);
    const [numeroMesa, setNumeroMesa] = useState('');
    const [creandoMesa, setCreandoMesa] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('wepay_token');
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        const cargarRestaurantes = async () => {
            try {
                const response = await api.get('/menu/restaurantes/', {
                // const response = await axios.get('http://192.168.100.26:8080/menu/restaurantes/', {
                // const response = await axios.get('http://localhost:8080/menu/restaurantes/', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRestaurantes(response.data);
            } catch (err) {
                setError('No pudimos cargar los restaurantes. Verifica que WePay Backend esté encendido.');
            } finally {
                setLoading(false);
            }
        };

        cargarRestaurantes();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('wepay_token');
        navigate('/login', { replace: true });
    };

    // Función para enviar la petición al Microservicio de Sesiones
    const confirmarAbrirMesa = async (e) => {
        e.preventDefault();
        setCreandoMesa(true);

        try {
            const token = localStorage.getItem('wepay_token');

            const response = await api.post('/sesiones/sesion/abrir', {
            // const response = await axios.post('http://localhost:8080/sesiones/sesion/abrir', {
            restaurante_id: restauranteSeleccionado.id,
                numero_mesa: numeroMesa
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // ¡Éxito! El backend nos devuelve el ID de la sesión en Redis/Postgres
            const sesionId = response.data.id;

            // Cerramos el modal y navegamos a la vista de la mesa
            setRestauranteSeleccionado(null);
            navigate(`/mesa/${sesionId}`);

        } catch (err) {
            console.error(err);
            alert('Hubo un error al intentar abrir la mesa. Intenta de nuevo.');
        } finally {
            setCreandoMesa(false);
        }
    };

    return (
        <div className="min-vh-100 bg-light pb-5 position-relative">

            {/* --- MODAL SUPERPUESTO (Solo se muestra si hay un restaurante seleccionado) --- */}
            {restauranteSeleccionado && (
                <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050, backdropFilter: 'blur(5px)' }}>
                    <div className="card border-0 shadow-lg rounded-4 p-4" style={{ width: '90%', maxWidth: '400px', animation: 'cardFadeIn 0.3s ease-out' }}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4 className="fw-bold m-0" style={{ color: '#F37A20' }}>Abrir Mesa</h4>
                            <button className="btn-close" onClick={() => setRestauranteSeleccionado(null)}></button>
                        </div>

                        <p className="text-muted mb-4">
                            Estás abriendo una cuenta en <strong>{restauranteSeleccionado.nombre}</strong>.
                        </p>

                        <form onSubmit={confirmarAbrirMesa}>
                            <div className="mb-4">
                                <label className="form-label fw-bold text-dark">¿En qué número de mesa estás?</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0">
                                        <span className="material-icons text-muted">table_restaurant</span>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 ps-0 focus-ring"
                                        placeholder="Ej. Mesa 5, Barra, Terraza..."
                                        value={numeroMesa}
                                        onChange={(e) => setNumeroMesa(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="d-grid">
                                <button type="submit" className="btn text-white fw-bold py-2 rounded-pill shadow-sm" style={{ backgroundColor: '#F37A20' }} disabled={creandoMesa}>
                                    {creandoMesa ? 'ABRIENDO MESA...' : 'COMENZAR A PEDIR'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* --- FIN DEL MODAL --- */}

            {/* Barra de Navegación (Igual que antes) */}
            <nav className="navbar navbar-expand-lg shadow-sm mb-5" style={{ backgroundColor: '#F37A20' }}>
                <div className="container">
                    <span className="navbar-brand mb-0 h1 text-white fw-bold fs-3" style={{ letterSpacing: '-1px' }}>
                        WE<span className="text-dark">PAY</span>
                    </span>
                    <button onClick={handleLogout} className="btn btn-light rounded-pill px-4 fw-bold d-flex align-items-center gap-2 border-0 shadow-sm" style={{ color: '#F37A20' }}>
                        <span className="material-icons fs-5">logout</span> Salir
                    </button>
                </div>
            </nav>

            {/* Contenedor Principal */}
            <main className="container">
                <div className="text-center mb-5">
                    <h2 className="fw-bold text-dark mb-2">Descubre lugares increíbles</h2>
                    <p className="text-muted fs-5">Elige un restaurante y nosotros nos encargamos de dividir la cuenta.</p>
                </div>

                {/* Manejo de Estados (Cargando, Error, Vacío)... */}
                {loading && (
                    <div className="text-center py-5">
                        <div className="spinner-border text-warning" style={{ width: '3rem', height: '3rem' }} role="status">
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    </div>
                )}

                {!loading && !error && restaurantes.length === 0 && (
                    <div className="text-center py-5 bg-white rounded-4 shadow-sm border p-5">
                        <span className="material-icons text-muted mb-3" style={{ fontSize: '4rem', opacity: '0.5' }}>storefront</span>
                        <h4 className="fw-bold text-dark">Aún no hay restaurantes</h4>
                    </div>
                )}

                {/* La Cuadrícula de Restaurantes */}
                <div className="row g-4">
                    {!loading && !error && restaurantes.map((restaurante) => (
                        <div className="col-12 col-md-6 col-lg-4" key={restaurante.id}>
                            <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden" style={{ transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                <div className="bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ height: '140px' }}>
                                    <span className="material-icons text-muted" style={{ fontSize: '4rem', opacity: '0.3' }}>restaurant</span>
                                </div>

                                <div className="card-body p-4 text-center">
                                    <h5 className="card-title fw-bold text-dark mb-1">{restaurante.nombre}</h5>
                                    <p className="text-muted small mb-4">
                                        <span className="material-icons fs-6 align-text-bottom me-1 text-warning">location_on</span>
                                        {restaurante.direccion || 'Dirección no especificada'}
                                    </p>

                                    {/* AL HACER CLIC, ABRIMOS EL MODAL */}
                                    <button
                                        onClick={() => setRestauranteSeleccionado(restaurante)}
                                        className="btn w-100 rounded-pill fw-bold text-white shadow-sm"
                                        style={{ backgroundColor: '#F37A20' }}
                                    >
                                        Abrir Mesa Aquí
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}