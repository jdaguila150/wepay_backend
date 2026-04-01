import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api'

export default function CerrarPagar() {
    const { id } = useParams(); // ID de la sesión
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [misItems, setMisItems] = useState([]);
    const [miSubtotal, setMiSubtotal] = useState(0);
    const [propinaPct, setPropinaPct] = useState(0.10); // 10% por defecto
    const [procesando, setProcesando] = useState(false);

    const miUsuarioId = localStorage.getItem('wepay_user_id');

    useEffect(() => {
        const token = localStorage.getItem('wepay_token');
        if (!token) return navigate('/login');

        const cargarDatosPago = async () => {
            try {
                // 1. Traemos el estado de la mesa
                const resEstado = await api.get(`/sesiones/sesion/${id}/estado`, {
                // const resEstado = await axios.get(`http://192.168.100.26:8080/sesiones/sesion/${id}/estado`, {
                // const resEstado = await axios.get(`http://localhost:8080/sesiones/sesion/${id}/estado`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const estado = resEstado.data;

                // 2. Traemos el menú para los precios
                const resMenu = await api.get(`/menu/restaurantes/${estado.restaurante_id}/items`, {
                // const resMenu = await axios.get(`http://192.168.100.26:8080/menu/restaurantes/${estado.restaurante_id}/items`, {
                // const resMenu = await axios.get(`http://localhost:8080/menu/restaurantes/${estado.restaurante_id}/items`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const menu = resMenu.data;

                // 3. Filtramos SOLO lo que pidió este usuario
                let subtotal = 0;
                const miConsumoRaw = estado.items.filter(pedido => pedido.usuario_id === miUsuarioId);

                const miConsumoDetallado = miConsumoRaw.map(pedido => {
                    const detalleItem = menu.find(m => m.id === pedido.item_id);
                    const costoTotal = (detalleItem?.precio || 0) * pedido.cantidad;
                    subtotal += costoTotal;

                    return {
                        ...pedido,
                        nombre: detalleItem?.nombre || 'Producto Desconocido',
                        precioBase: detalleItem?.precio || 0,
                        costoTotal
                    };
                });

                setMisItems(miConsumoDetallado);
                setMiSubtotal(subtotal);

            } catch (err) {
                console.error("Error al cargar datos para pago:", err);
                alert("Hubo un problema al preparar tu pago.");
            } finally {
                setLoading(false);
            }
        };

        cargarDatosPago();
    }, [id, navigate, miUsuarioId]);

    const handlePagar = async () => {
        setProcesando(true);
        try {
            const token = localStorage.getItem('wepay_token');
            const miUsuarioId = localStorage.getItem('wepay_user_id');

            // ¡Ruta actualizada hacia el microservicio de PAGOS!
            const res = await api.post(`/pagos/procesar`, {
            // const res = await axios.post(`http://192.168.100.26:8080/pagos/procesar`, {
            // const res = await axios.post(`http://localhost:8080/pagos/procesar`, {
                sesion_id: id,             // Tu schema exige este campo
                usuario_id: miUsuarioId,
                monto: totalAPagar,
                metodo_pago: "tarjeta"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Extraemos el mensaje que Pagos recibió de Sesiones
            const mensajeFinal = res.data.estado_sesion?.mensaje || "Pago procesado con éxito";
            alert(mensajeFinal);

            navigate('/menu');

        } catch (error) {
            alert("Hubo un error al procesar tu pago");
            console.error(error);
        } finally {
            setProcesando(false);
        }
    };

    if (loading) {
        return (
            <div className="min-vh-100 bg-light d-flex flex-column align-items-center justify-content-center">
                <div className="spinner-border text-success" role="status"></div>
                <p className="mt-3 fw-bold text-muted">Preparando tu cuenta segura...</p>
            </div>
        );
    }

    const montoPropina = miSubtotal * propinaPct;
    const totalAPagar = miSubtotal + montoPropina;

    return (
        <div className="min-vh-100 bg-light pb-5">
            {/* Navbar Simple */}
            <nav className="navbar navbar-dark shadow-sm sticky-top" style={{ backgroundColor: '#2c3e50' }}>
                <div className="container d-flex align-items-center">
                    <button onClick={() => navigate(-1)} className="btn text-white p-0 d-flex align-items-center border-0">
                        <span className="material-icons fs-2 me-1">close</span>
                    </button>
                    <span className="mx-auto fw-bold text-white fs-5">Caja WePay</span>
                    <div style={{ width: '32px' }}></div> {/* Spacer para centrar el título */}
                </div>
            </nav>

            <main className="container py-4" style={{ maxWidth: '600px' }}>

                <h4 className="fw-bold text-dark mb-4 text-center">Resumen de tu parte</h4>

                {/* Lista de Consumo Personal */}
                <div className="card border-0 shadow-sm rounded-4 mb-4">
                    <div className="card-body p-4">
                        {misItems.length === 0 ? (
                            <p className="text-center text-muted m-0">No has agregado platillos a tu cuenta.</p>
                        ) : (
                            <ul className="list-group list-group-flush">
                                {misItems.map((item, idx) => (
                                    <li key={idx} className="list-group-item bg-transparent px-0 py-2 border-bottom-dashed d-flex justify-content-between align-items-center border-0 mb-2">
                                        <div className="d-flex align-items-center gap-3">
                                            <span className="badge bg-light text-dark border p-2 rounded-3">{item.cantidad}x</span>
                                            <span className="fw-medium text-dark">{item.nombre}</span>
                                        </div>
                                        <span className="text-muted fw-bold">${item.costoTotal.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="card-footer bg-light border-0 p-3 d-flex justify-content-between align-items-center rounded-bottom-4">
                        <span className="fw-bold text-muted">Subtotal Consumo</span>
                        <span className="fw-bold text-dark fs-5">${miSubtotal.toFixed(2)}</span>
                    </div>
                </div>

                {/* Selector de Propina */}
                {miSubtotal > 0 && (
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-body p-4">
                            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                <span className="material-icons text-warning">volunteer_activism</span>
                                Agregar Propina
                            </h6>
                            <div className="d-flex gap-2">
                                {[0.10, 0.15, 0.20].map((pct) => (
                                    <button
                                        key={pct}
                                        onClick={() => setPropinaPct(pct)}
                                        className={`btn flex-grow-1 rounded-3 fw-bold py-2 ${propinaPct === pct ? 'btn-dark shadow' : 'btn-outline-secondary border-1 bg-white'}`}
                                    >
                                        {pct * 100}%
                                    </button>
                                ))}
                            </div>
                            <div className="d-flex justify-content-between mt-3 text-muted small">
                                <span>Monto de propina:</span>
                                <span>${montoPropina.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Método de Pago (Visual) */}
                <div className="card border-0 shadow-sm rounded-4 mb-4">
                    <div className="card-body p-3 d-flex align-items-center gap-3">
                        <div className="bg-primary bg-opacity-10 p-2 rounded-3">
                            <span className="material-icons text-primary fs-3">credit_card</span>
                        </div>
                        <div className="flex-grow-1">
                            <h6 className="m-0 fw-bold">Tarjeta de Crédito/Débito</h6>
                            <small className="text-muted">Terminación **** 4242</small>
                        </div>
                        <span className="material-icons text-success">check_circle</span>
                    </div>
                </div>

            </main>

            {/* Footer Fijo con el Botón de Pago */}
            <div className="position-fixed bottom-0 start-0 w-100 bg-white border-top shadow-lg p-3" style={{ zIndex: 1030 }}>
                <div className="container d-flex justify-content-between align-items-center" style={{ maxWidth: '600px' }}>
                    <div>
                        <small className="text-muted d-block fw-bold mb-1">Total a Pagar</small>
                        <h3 className="fw-bold m-0 text-dark" style={{ lineHeight: '1' }}>${totalAPagar.toFixed(2)}</h3>
                    </div>
                    <button
                        onClick={handlePagar}
                        disabled={procesando || miSubtotal === 0}
                        className="btn btn-lg rounded-pill px-5 fw-bold text-white shadow d-flex align-items-center gap-2 transition-all"
                        style={{ backgroundColor: procesando ? '#95a5a6' : '#27ae60' }}
                    >
                        {procesando ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <span className="material-icons">lock</span>
                                PAGAR
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}