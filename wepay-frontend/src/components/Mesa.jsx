import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import axios from 'axios';

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

    useEffect(() => {
        const token = localStorage.getItem('wepay_token');
        if (!token) {
            navigate('/login');
            return;
        }

        const cargarDatosMesa = async () => {
            try {
                // 1. Consultar detalles de la sesión
                const resSesion = await axios.get(`http://localhost:8080/sesiones/sesion/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const datosSesion = resSesion.data;
                setSesion(datosSesion);

                // 2. Traer las CATEGORÍAS de este restaurante
                const resCat = await axios.get(`http://localhost:8080/menu/restaurantes/${datosSesion.restaurante_id}/menu`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCategorias(resCat.data);

                // 3. Traer los PLATILLOS
                const resMenu = await axios.get(`http://localhost:8080/menu/restaurantes/${datosSesion.restaurante_id}/items`, {
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
        try {
            const token = localStorage.getItem('wepay_user_id');
            
            // 2. ¡Abrimos el token para sacar el ID!
            // const decodedToken = jwtDecode(token);
            
            // console.log("DECODE TOKEN", decodedToken);

            // Normalmente FastAPI guarda el ID en 'sub' o en 'id'. 
            // Revisa qué nombre le pusiste en tu backend al crear el token.
            // const miUsuarioId = decodedToken.sub || decodedToken.id;

            // 3. Lo mandamos en la petición real
            await axios.post(`http://localhost:8080/sesiones/sesion/${id}/pedir`, {
                usuario_id: token,  // <-- ¡Adiós al UUID falso!
                item_menu_id: item.id,
                cantidad: 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(`¡${item.nombre} agregado a la cuenta!`);
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
                            <small className="opacity-75">ID: {id.substring(0, 8)}...</small>
                        </div>
                    </div>

                    <button className="btn btn-dark rounded-pill px-3 fw-bold shadow-sm d-flex align-items-center gap-2">
                        <span className="material-icons fs-5">shopping_cart</span>
                        <span>Ver Cuenta</span>
                    </button>
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
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span className="fw-bold text-dark fs-5">${item.precio.toFixed(2)}</span>
                                            <button
                                                onClick={() => agregarALaCuenta(item)}
                                                disabled={pedidoEnCurso === item.id}
                                                className="btn btn-sm rounded-pill px-3 fw-bold text-white shadow-sm"
                                                style={{ backgroundColor: '#F37A20' }}
                                            >
                                                {pedidoEnCurso === item.id ? '...' : '+ Agregar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Floating Action Button */}
            <div className="position-fixed bottom-0 end-0 p-4" style={{ zIndex: 1030 }}>
                <button className="btn btn-lg rounded-pill shadow-lg text-white fw-bold px-4 d-flex align-items-center gap-2" style={{ backgroundColor: '#2c3e50' }}>
                    <span className="material-icons">payments</span>
                    CERRAR Y PAGAR
                </button>
            </div>
        </div>
    );
}