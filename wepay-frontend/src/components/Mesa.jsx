import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import axios from 'axios';
import {QRCode} from "react-qr-code";
import api from '../../services/api'


export default function Mesa() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [sesion, setSesion] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [categorias, setCategorias] = useState([]); // <-- Nuevo estado para categorías
    const [categoriaActiva, setCategoriaActiva] = useState('todas'); // <-- Para el filtro

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pedidoEnCurso, setPedidoEnCurso] = useState(null);
    const [cantidades, setCantidades] = useState({});

    const [mostrarQR, setMostrarQR] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('wepay_token');
        if (!token) {
            const rutaActual = window.location.pathname;
            // Solo guardamos el destino si la ruta actual contiene la palabra "mesa"
            if (rutaActual.includes('/mesa')) {
                localStorage.setItem('wepay_redirect', rutaActual);
            }
            return navigate('/login');
        }

        const cargarDatosMesa = async () => {
            try {
                // 1. Consultar detalles de la sesión
                const resSesion = await api.get(`/sesiones/sesion/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const datosSesion = resSesion.data;
                setSesion(datosSesion);

                // 2. Traer las CATEGORÍAS de este restaurante
                const resCat = await api.get(`/menu/restaurantes/${datosSesion.restaurante_id}/menu`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCategorias(resCat.data);

                // 3. Traer los PLATILLOS
                const resMenu = await api.get(`/menu/restaurantes/${datosSesion.restaurante_id}/items`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMenuItems(resMenu.data);

            } catch (err) {
                console.error(err);
                setError('No pudimos conectar con tu mesa. Verifica tu conexión.');
            } finally {
                setLoading(false);
            }
        };

        cargarDatosMesa();

        
    }, [id, navigate]);

    const agregarALaCuenta = async (item) => {
        setPedidoEnCurso(item.id);
        const cantidadAPedir = getCantidad(item.id);
        try {
            const token = localStorage.getItem('wepay_user_id');

            await api.post(`/sesiones/sesion/${id}/pedir`, {
                usuario_id: token,
                item_menu_id: item.id,
                cantidad: cantidadAPedir
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });


            alert(`¡${cantidadAPedir}x ${item.nombre} agregados!`);

            setCantidades(prev => ({ ...prev, [item.id]: 1 }));

        } catch (err) {
            alert('Error al agregar el producto. Intenta de nuevo.');
        } finally {
            setPedidoEnCurso(null);
        }
    };

    if (loading) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light">
                <div className="spinner-grow text-warning" role="status"></div>
                <p className="mt-3 fw-bold text-muted">Sincronizando con la cocina...</p>
            </div>
        );
    }

    // --- LÓGICA DE FILTRADO ---
    // 1. Solo mostramos los que están disponibles
    const itemsDisponibles = menuItems.filter(item => item.disponible !== false);

    // 2. Filtramos por la categoría seleccionada
    const itemsMostrar = categoriaActiva === 'todas'
        ? itemsDisponibles
        : itemsDisponibles.filter(item => item.categoria_id === categoriaActiva);


    const cambiarCantidad = (itemId, delta) => {
        setCantidades(prev => {
            const actual = prev[itemId] || 1;
            const nueva = Math.max(1, actual + delta); // Evitamos que baje de 1
            return { ...prev, [itemId]: nueva };
        });
    };

    const getCantidad = (itemId) => cantidades[itemId] || 1;
    return (
        <div className="min-vh-100 bg-light pb-5">
            {/* Navbar */}
            <nav className="navbar navbar-expand-lg sticky-top shadow-sm" style={{ backgroundColor: '#F37A20' }}>
                <div className="container d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center text-white">
                        <button onClick={() => navigate('/menu')} className="btn text-white p-0 me-3 border-0">
                            <span className="material-icons fs-2">chevron_left</span>
                        </button>
                        <div>
                            <h5 className="m-0 fw-bold">Mesa {sesion?.numero_mesa}</h5>
                            <small className="opacity-75">Comensales unidos</small>
                        </div>
                    </div>

                    <div className="d-flex gap-2">
                        {/* BOTÓN NUEVO: Invitar Amigos */}
                        <button
                            onClick={() => setMostrarQR(true)}
                            className="btn btn-light rounded-pill px-3 fw-bold shadow-sm d-flex align-items-center gap-1 text-dark"
                        >
                            <span className="material-icons fs-5">qr_code_scanner</span>
                            <span className="d-none d-sm-inline">Invitar</span>
                        </button>

                        <button onClick={() => navigate(`/cuenta/${id}`)} className="btn btn-dark rounded-pill px-3 fw-bold shadow-sm d-flex align-items-center gap-2">
                            <span className="material-icons fs-5">shopping_cart</span>
                            <span className="d-none d-sm-inline">Ver Cuenta</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Píldoras de Categorías (Deslizables horizontalmente) */}
            <div className="bg-white shadow-sm sticky-top" style={{ top: '60px', zIndex: 1020 }}>
                <div className="container py-3 overflow-auto family-menu-scroll" style={{ whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
                    <button
                        className={`btn rounded-pill px-4 fw-bold me-2 ${categoriaActiva === 'todas' ? 'btn-dark' : 'btn-outline-secondary border-0 bg-light'}`}
                        onClick={() => setCategoriaActiva('todas')}
                    >
                        Todo
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            className={`btn rounded-pill px-4 fw-bold me-2 ${categoriaActiva === cat.id ? 'btn-dark' : 'btn-outline-secondary border-0 bg-light'}`}
                            onClick={() => setCategoriaActiva(cat.id)}
                        >
                            {cat.nombre}
                        </button>
                    ))}
                </div>
            </div>

            <main className="container py-4">
                <div className="bg-white rounded-4 p-4 shadow-sm mb-4 border-start border-5" style={{ borderColor: '#F37A20' }}>
                    <h3 className="fw-bold text-dark mb-1">¡A pedir se ha dicho!</h3>
                    <p className="text-muted m-0">Selecciona los productos y se sumarán a la cuenta compartida.</p>
                </div>

                {/* Listado de Platillos Filtrados */}
                <div className="row g-4">
                    {itemsMostrar.length === 0 ? (
                        <div className="col-12 text-center py-5">
                            <span className="material-icons text-muted fs-1 mb-3">restaurant_menu</span>
                            <p className="text-muted fw-bold">No hay platillos en esta sección.</p>
                        </div>
                    ) : (
                        itemsMostrar.map((item) => (
                            <div className="col-12 col-md-6 col-lg-4" key={item.id}>
                                <div className="card h-100 border-0 shadow-sm rounded-4 p-3 d-flex flex-row align-items-center gap-3">
                                    <div className="bg-light rounded-3 d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', minWidth: '80px' }}>
                                        <span className="material-icons text-muted opacity-50 fs-1">fastfood</span>
                                    </div>

                                    <div className="flex-grow-1">
                                        <h6 className="fw-bold text-dark mb-1">{item.nombre}</h6>
                                        <p className="text-muted small mb-2 text-truncate" style={{ maxWidth: '150px' }}>
                                            {item.descripcion || 'Sin descripción'}
                                        </p>

                                        <div className="d-flex flex-column gap-3 mt-2">
                                            {/* Selector de Cantidad (Botones - y +) */}
                                            <div className="d-flex align-items-center justify-content-center bg-light rounded-pill p-1 shadow-sm" style={{ width: 'fit-content' }}>
                                                <button
                                                    className="btn btn-sm btn-white rounded-circle shadow-sm d-flex align-items-center p-1 border-0"
                                                    onClick={() => cambiarCantidad(item.id, -1)}
                                                >
                                                    <span className="material-icons fs-6 text-dark">remove</span>
                                                </button>

                                                <span className="px-3 fw-bold text-dark" style={{ minWidth: '35px', textAlign: 'center' }}>
                                                    {getCantidad(item.id)}
                                                </span>

                                                <button
                                                    className="btn btn-sm btn-white rounded-circle shadow-sm d-flex align-items-center p-1 border-0"
                                                    onClick={() => cambiarCantidad(item.id, 1)}
                                                >
                                                    <span className="material-icons fs-6 text-dark">add</span>
                                                </button>
                                            </div>

                                            {/* Fila del precio total y el botón de envío */}
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="fw-bold text-dark fs-5">
                                                    ${(item.precio * getCantidad(item.id)).toFixed(2)}
                                                </span>
                                                <button
                                                    onClick={() => agregarALaCuenta(item)}
                                                    disabled={pedidoEnCurso === item.id}
                                                    className="btn btn-sm rounded-pill px-4 fw-bold text-white shadow-sm border-0"
                                                    style={{ backgroundColor: '#F37A20' }}
                                                >
                                                    {pedidoEnCurso === item.id ? '...' : 'PEDIR'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Floating Action Button para pagar*/}
            <div className="position-fixed bottom-0 end-0 p-4" style={{ zIndex: 1030 }}>
                <button
                    onClick={() => navigate(`/pagar/${id}`)}
                    className="btn btn-lg rounded-pill shadow-lg text-white fw-bold px-4 d-flex align-items-center gap-2"
                    style={{ backgroundColor: '#2c3e50', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <span className="material-icons">payments</span>
                    CERRAR Y PAGAR
                </button>
            </div>







            {/* Modal para mostrar el QR */}
            {mostrarQR && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow-lg text-center p-4">
                            <div className="d-flex justify-content-end">
                                <button type="button" className="btn-close" onClick={() => setMostrarQR(false)}></button>
                            </div>
                            <h4 className="fw-bold mb-1" style={{ color: '#F37A20' }}>Mesa {sesion?.numero_mesa}</h4>
                            <p className="text-muted small mb-4">¡Que tus amigos escaneen este código para unirse a la cuenta!</p>

                            <div className="bg-white p-3 rounded-4 mx-auto shadow-sm" style={{ width: 'fit-content', border: '2px dashed #ccc' }}>
                                {/* Aquí generamos el QR mágicamente con la URL actual */}
                                <QRCode
                                    value={window.location.href}
                                    size={200}
                                    fgColor="#2c3e50"
                                />
                            </div>

                            <p className="mt-4 small text-muted">
                                O comparte este enlace:<br />
                                <code className="bg-light px-2 py-1 rounded user-select-all">
                                    {window.location.href}
                                </code>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}