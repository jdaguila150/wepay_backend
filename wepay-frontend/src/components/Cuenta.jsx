import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api'

export default function Cuenta() {
    const { id } = useParams(); // ID de la sesión
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [estadoMesa, setEstadoMesa] = useState(null);
    const [cuentasAgrupadas, setCuentasAgrupadas] = useState({});
    const [granTotal, setGranTotal] = useState(0);
    
    const miUsuarioId = localStorage.getItem('wepay_user_id');

   useEffect(() => {
        const token = localStorage.getItem('wepay_token');
        if (!token) {
            navigate('/login');
            return;
        }

        const cargarCuenta = async () => {
            try {
                // 1. Traer el estado en vivo desde Redis (Microservicio de Sesiones)
                const resEstado = await api.get(`/sesiones/sesion/${id}/estado`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const estado = resEstado.data;
                setEstadoMesa(estado);

                // 2. Traer el menú para saber los nombres y precios reales
                const resMenu = await api.get(`/menu/restaurantes/${estado.restaurante_id}/items`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const menu = resMenu.data;

                // 3. Cruzar los datos y hacer las matemáticas
                let totalMesa = 0;
                const agrupado = estado.items.reduce((acc, pedido) => {
                    // Buscar detalles del platillo
                    const detalleItem = menu.find(m => m.id === pedido.item_id);
                    if (!detalleItem) return acc;

                    const subtotal = detalleItem.precio * pedido.cantidad;
                    totalMesa += subtotal;

                    // Agrupar por usuario_id
                    if (!acc[pedido.usuario_id]) {
                        acc[pedido.usuario_id] = { total: 0, items: [] };
                    }
                    
                    acc[pedido.usuario_id].items.push({
                        ...pedido,
                        nombre: detalleItem.nombre,
                        precio: detalleItem.precio,
                        subtotal: subtotal
                    });
                    acc[pedido.usuario_id].total += subtotal;

                    return acc;
                }, {});

                setCuentasAgrupadas(agrupado);
                setGranTotal(totalMesa);

            } catch (err) {
                console.error("Error al cargar la cuenta:", err);
                alert("Hubo un problema al cargar los detalles de la cuenta.");
            } finally {
                setLoading(false);
            }
        };

        // Carga inicial al abrir la pantalla
        cargarCuenta();

        // // --- 🚀 MAGIA MULTIJUGADOR: WEBSOCKETS EN LA CUENTA 🚀 ---
        
        // // Abrimos el túnel directo al microservicio de Sesiones (Puerto 8002)
        // const socket = new WebSocket(`ws://192.168.100.26:8002/ws/sesion/${id}`);

        // socket.onopen = () => {
        //     console.log("🟢 Cuenta conectada en vivo a WePay");
        // };

        // socket.onmessage = (event) => {
        //     if (event.data === "actualizar_mesa") {
        //         console.log("¡Alguien pidió algo! Recargando las matemáticas de la cuenta... 🧮🚀");
                
        //         // Ejecutamos tu función para descargar la cuenta fresca y hacer el cruce de nuevo
        //         cargarCuenta(); 
        //     }
        // };

        // // Limpieza al salir de la pantalla de la cuenta
        // return () => {
        //     socket.close();
        //     console.log("🔴 Cuenta desconectada");
        // };

    }, [id, navigate]);

    if (loading) {
        return (
            <div className="min-vh-100 bg-light d-flex flex-column align-items-center justify-content-center">
                <div className="spinner-border text-warning" role="status"></div>
                <p className="mt-3 fw-bold text-muted">Calculando los totales...</p>
            </div>
        );
    }

    return (
        <div className="min-vh-100 bg-light pb-5">
            {/* Navbar */}
            <nav className="navbar navbar-expand-lg sticky-top shadow-sm" style={{ backgroundColor: '#2c3e50' }}>
                <div className="container d-flex justify-content-between align-items-center">
                    <button onClick={() => navigate(`/mesa/${id}`)} className="btn text-white p-0 d-flex align-items-center border-0">
                        <span className="material-icons fs-2 me-1">arrow_back</span>
                        <span className="fw-bold">Volver a la Mesa</span>
                    </button>
                    <h5 className="m-0 text-white fw-bold">Mesa {estadoMesa?.numero_mesa}</h5>
                </div>
            </nav>

            <main className="container py-4">
                
                {/* Tarjeta del Gran Total */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 text-center p-4 text-white" style={{ backgroundColor: '#F37A20' }}>
                    <h6 className="text-uppercase fw-bold mb-1 opacity-75">Total de la Mesa</h6>
                    <h1 className="display-4 fw-bold m-0">${granTotal.toFixed(2)}</h1>
                    <p className="small m-0 mt-2 opacity-75">
                        {Object.keys(cuentasAgrupadas).length} comensal(es) en esta cuenta
                    </p>
                </div>

                <h5 className="fw-bold text-dark mb-3">Desglose por Comensal</h5>

                {/* Si no hay pedidos aún */}
                {Object.keys(cuentasAgrupadas).length === 0 && (
                    <div className="text-center py-5 bg-white rounded-4 shadow-sm">
                        <span className="material-icons fs-1 text-muted opacity-50 mb-2">receipt_long</span>
                        <h6 className="text-muted fw-bold">La cuenta está en ceros</h6>
                        <p className="small text-muted">Aún no han pedido nada en esta mesa.</p>
                    </div>
                )}

                {/* Iteramos sobre cada usuario que ha pedido algo */}
                <div className="row g-4">
                    {Object.entries(cuentasAgrupadas).map(([usuarioId, datos]) => {
                        const esMiCuenta = usuarioId === miUsuarioId;

                        return (
                            <div className="col-12 col-md-6" key={usuarioId}>
                                <div className={`card h-100 border-0 shadow-sm rounded-4 overflow-hidden ${esMiCuenta ? 'border-start border-5' : ''}`} style={{ borderColor: esMiCuenta ? '#F37A20' : 'transparent' }}>
                                    
                                    <div className="card-header bg-white p-3 d-flex justify-content-between align-items-center border-bottom-0 pt-4">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className={`rounded-circle d-flex align-items-center justify-content-center text-white ${esMiCuenta ? 'bg-primary' : 'bg-secondary'}`} style={{ width: '40px', height: '40px' }}>
                                                <span className="material-icons">{esMiCuenta ? 'person' : 'person_outline'}</span>
                                            </div>
                                            <div>
                                                <h6 className="fw-bold m-0 text-dark">
                                                    {esMiCuenta ? 'Mi Consumo' : `Comensal ${usuarioId.substring(0,4)}`}
                                                </h6>
                                                {esMiCuenta && <small className="text-success fw-bold" style={{fontSize: '0.7rem'}}>TÚ</small>}
                                            </div>
                                        </div>
                                        <h4 className="fw-bold m-0 text-dark">${datos.total.toFixed(2)}</h4>
                                    </div>

                                    <div className="card-body p-3">
                                        <ul className="list-group list-group-flush">
                                            {datos.items.map((item, index) => (
                                                <li key={index} className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between align-items-start border-0">
                                                    <div>
                                                        <span className="fw-bold text-dark small">{item.cantidad}x {item.nombre}</span>
                                                    </div>
                                                    <span className="text-muted small">${item.subtotal.toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* {esMiCuenta && (
                                        <div className="card-footer bg-white border-0 p-3 pt-0">
                                            <button className="btn w-100 rounded-pill text-white fw-bold shadow-sm" style={{ backgroundColor: '#F37A20' }}>
                                                PAGAR MI PARTE
                                            </button>
                                        </div>
                                    )} */}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}