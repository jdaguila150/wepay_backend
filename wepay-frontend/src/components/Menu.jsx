import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api';
import { QRCode } from 'react-qr-code';


export default function Menu() {
    const [restaurantes, setRestaurantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Nuevos estados para el Modal de Abrir Mesa
    const [restauranteSeleccionado, setRestauranteSeleccionado] = useState(null);
    const [numeroMesa, setNumeroMesa] = useState('');
    const [creandoMesa, setCreandoMesa] = useState(false);

    // ESTADOS PARA LOS QRs ESTÁTICOS
    const [restauranteParaQR, setRestauranteParaQR] = useState(null);
    // Por el momento las predefinimos aquí en el frontend, luego las traeremos de la BD
    const [mesasFisicas, setMesasFisicas] = useState([]);
    const [cargandoQRs, setCargandoQRs] = useState(false);


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
                restaurante_id: restauranteSeleccionado.id,
                numero_mesa: numeroMesa
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // ¡Éxito! El backend nos devuelve el ID de la sesión en Redis/Postgres
            const sesionId = response.data.id;

            // 1. Tomamos el nombre del restaurante que el usuario seleccionó
            const nombreOriginal = restauranteSeleccionado.nombre;

            // 2. Reemplazamos los espacios por guiones bajos (ej. "Los Tacos" -> "Los_Tacos")
            const nombreRestaurante = nombreOriginal.replaceAll(' ', '_');

            // Cerramos el modal y navegamos a la vista de la mesa
            setRestauranteSeleccionado(null);
            navigate(`/local/${nombreRestaurante}/mesa/${sesionId}`);

        } catch (err) {
            console.error(err);
            alert('Hubo un error al intentar abrir la mesa. Intenta de nuevo.');
        } finally {
            setCreandoMesa(false);
        }
    };


    const abrirModalQRs = async (restaurante) => {
        setRestauranteParaQR(restaurante); // Abrimos el modal visualmente
        setCargandoQRs(true);
        setMesasFisicas([]); // Limpiamos por si había QRs de otro restaurante

        try {
            const token = localStorage.getItem('wepay_token');
            const res = await api.get(`/sesiones/restaurantes/${restaurante.id}/mesas`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMesasFisicas(res.data);
        } catch (error) {
            console.error("Error al cargar las mesas:", error);
            alert("No se pudieron cargar las mesas de este restaurante.");
        } finally {
            setCargandoQRs(false);
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

            {/* --- MODAL PARA GENERAR QRs FÍSICOS --- */}
            {restauranteParaQR && (
                <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050, backdropFilter: 'blur(5px)' }}>
                    <div className="card border-0 shadow-lg rounded-4 p-4" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', animation: 'cardFadeIn 0.3s ease-out' }}>

                        <div className="d-flex justify-content-between align-items-center mb-4 sticky-top bg-white py-2">
                            <div>
                                <h4 className="fw-bold m-0 text-dark">QRs de Mesas</h4>
                                <p className="text-muted m-0 small">Imprime estos QRs y colócalos en el restaurante: <strong>{restauranteParaQR.nombre}</strong></p>
                            </div>
                            <button className="btn-close" onClick={() => setRestauranteParaQR(null)}></button>
                        </div>

                        <div className="row g-4">
                            {cargandoQRs ? (
                                <div className="col-12 text-center py-5">
                                    <div className="spinner-border text-primary mb-3" role="status"></div>
                                    <p className="text-muted fw-bold">Buscando mesas en la base de datos...</p>
                                </div>
                            ) : mesasFisicas.length === 0 ? (
                                <div className="col-12 text-center py-5">
                                    <span className="material-icons text-muted opacity-25 mb-3" style={{ fontSize: '4rem' }}>table_restaurant</span>
                                    <h5 className="text-muted fw-bold">No hay mesas configuradas</h5>
                                    <p className="text-muted small">Ve al panel de Administrador para agregar mesas a este restaurante.</p>
                                </div>
                            ) : (
                                mesasFisicas.map((mesa) => {
                                    const nombreRestauranteURL = restauranteParaQR.nombre.replaceAll(' ', '_');
                                    // Usamos el nombre real de la mesa desde la base de datos
                                    const nombreMesaURL = mesa.nombre.replaceAll(' ', '_');

                                    // Construimos la URL
                                    const urlFisica = `${window.location.origin}/local/${nombreRestauranteURL}/id/${restauranteParaQR.id}/mesa_fisica/${nombreMesaURL}`;


                                    const descargarQR = (idMesa, nombreMesa) => {
                                        const qrElement = document.getElementById(`qr-${idMesa}`);
                                        if (!qrElement) return;

                                        // Comprobamos si la librería renderizó un SVG o un Canvas
                                        if (qrElement.nodeName.toLowerCase() === 'svg') {
                                            const svgData = new XMLSerializer().serializeToString(qrElement);
                                            const canvas = document.createElement("canvas");
                                            const ctx = canvas.getContext("2d");
                                            const img = new Image();

                                            // Hacemos el canvas más grande para que la descarga tenga excelente calidad de impresión
                                            const scale = 5;
                                            canvas.width = 120 * scale;
                                            canvas.height = 120 * scale;

                                            img.onload = () => {
                                                // Le ponemos un fondo blanco (si no, el PNG sale transparente y puede verse mal al imprimir)
                                                ctx.fillStyle = "white";
                                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                                                const pngUrl = canvas.toDataURL("image/png");
                                                const downloadLink = document.createElement("a");
                                                downloadLink.href = pngUrl;
                                                downloadLink.download = `QR_Mesa_${nombreMesa}.png`;
                                                downloadLink.click();
                                            };
                                            img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));

                                        } else if (qrElement.nodeName.toLowerCase() === 'canvas') {
                                            const pngUrl = qrElement.toDataURL("image/png");
                                            const downloadLink = document.createElement("a");
                                            downloadLink.href = pngUrl;
                                            downloadLink.download = `QR_Mesa_${nombreMesa}.png`;
                                            downloadLink.click();
                                        }
                                    };


                                    return (
                                        <div className="col-12 col-sm-6 col-md-4 text-center" key={mesa.id}>
                                            <div className="border rounded-4 p-3 bg-light h-100 d-flex flex-column align-items-center justify-content-between">
                                                <div>
                                                    <h5 className="fw-bold text-secondary mb-3">Mesa: {mesa.nombre}</h5>

                                                    <div className="bg-white p-2 rounded mb-3 shadow-sm d-inline-block">
                                                        <QRCode
                                                            id={`qr-${mesa.id}`} // 👇 NUEVO: Identificador único
                                                            value={urlFisica}
                                                            size={120}
                                                            fgColor="#2c3e50"
                                                        />
                                                    </div>

                                                    <button 
                                                        className="btn btn-sm btn-outline-primary rounded-pill w-100 mb-3"
                                                        onClick={() => descargarQR(mesa.id, mesa.nombre)} // 👇 NUEVO: Acción de descarga
                                                    >
                                                        <span className="material-icons fs-6 align-text-bottom me-1">download</span>
                                                        Descargar
                                                    </button>
                                                </div>

                                                {/* URL PARA PRUEBAS EN COMPUTADORA */}
                                                <div className="w-100 mt-2">
                                                    <p className="small text-muted mb-1" style={{ fontSize: '0.8rem' }}>Enlace de prueba:</p>
                                                    <a
                                                        href={urlFisica}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="d-block bg-white text-primary p-2 rounded border text-decoration-none"
                                                        style={{ wordBreak: 'break-all', fontSize: '0.7rem', lineHeight: '1.2' }}
                                                    >
                                                        {urlFisica}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* --- FIN DEL MODAL DE QRs --- */}

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

                                    <div className="d-flex flex-column gap-2 mt-3">
                                        {/* AL HACER CLIC, ABRIMOS EL MODAL */}
                                        <button
                                            onClick={() => setRestauranteSeleccionado(restaurante)}
                                            className="btn w-100 rounded-pill fw-bold text-white shadow-sm"
                                            style={{ backgroundColor: '#F37A20' }}
                                        >
                                            Abrir Mesa Aquí
                                        </button>
                                        <button
                                            onClick={() => abrirModalQRs(restaurante)} // 👈 ¡ESTE ES EL CAMBIO!
                                            className="btn w-100 rounded-pill fw-bold text-secondary shadow-sm bg-light border"
                                        >
                                            <span className="material-icons fs-6 align-text-bottom me-1">qr_code_2</span>
                                            Generar QRs Físicos
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}