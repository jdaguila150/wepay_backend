import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

const VistaCocinero = () => {
    const [pedidosPendientes, setPedidosPendientes] = useState([]);
    const [alertaVisual, setAlertaVisual] = useState(false);
    
    // Referencia al audio (Busca el archivo en la carpeta public)
    const audioAlerta = useRef(new Audio('/campana.mp3'));

    // 1. Cargar las comandas pendientes al abrir la pantalla
    const cargarComandas = async () => {
        try {
            // Trae todas las ordenes con estado "pendiente"
            const res = await api.get('/sesiones/ordenes/pendientes');
            setPedidosPendientes(res.data);
        } catch (error) {
            console.error("Error al cargar comandas:", error);
        }
    };

    useEffect(() => {
        cargarComandas();

        // 2. Conectar al WebSocket de la Cocina
        const wsHost = window.location.hostname || 'localhost';
        const wsCocina = new WebSocket(`ws://${wsHost}:8080/sesiones/ws/cocina`);

        wsCocina.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.accion === "nueva_comanda") {
                // Disparamos la alerta visual y auditiva
                dispararAlerta();
                // Recargamos la lista (o agregamos el data.pedido al arreglo)
                cargarComandas();
            }
        };

        return () => wsCocina.close();
    }, []);

    // --- MAGIA DE ALERTAS ---
    const dispararAlerta = () => {
        // Reproducimos el sonido
        audioAlerta.current.play().catch(e => console.log("El navegador bloqueó el audio automático"));
        
        // Encendemos el destello rojo
        setAlertaVisual(true);
        
        // Lo apagamos después de 3 segundos
        setTimeout(() => {
            setAlertaVisual(false);
        }, 3000);
    };

    // --- ACCIÓN DEL COCINERO ---
    const marcarComoLista = async (ordenId) => {
        try {
            // Ocultamos la tarjeta temporalmente para dar sensación de rapidez
            setPedidosPendientes(prev => prev.filter(p => p.id !== ordenId));

            // Avisamos al backend
            await api.put(`/sesiones/ordenes/${ordenId}/estado?estado_nuevo=lista`);
        } catch (error) {
            alert("Error al actualizar. Intentando recargar...");
            cargarComandas();
        }
    };

    return (
        <div className={`min-vh-100 p-4 transition-all ${alertaVisual ? 'bg-danger bg-opacity-25' : 'bg-light'}`}>
            
            {/* Cabecera de la Cocina */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold m-0 d-flex align-items-center gap-2">
                    <span className="material-icons text-dark" style={{ fontSize: '32px' }}>restaurant_menu</span>
                    Cocina - WePay
                </h2>
                
                {/* Banner temporal de alerta */}
                {alertaVisual && (
                    <div className="badge bg-danger fs-5 animate__animated animate__flash">
                        ¡NUEVA COMANDA!
                    </div>
                )}
            </div>

            {/* Tablero Kanban de Tickets */}
            <div className="row g-3">
                {pedidosPendientes.length === 0 ? (
                    <div className="col-12 text-center text-muted mt-5">
                        <span className="material-icons mb-2" style={{ fontSize: '64px' }}>soup_kitchen</span>
                        <h4>Cocina despejada</h4>
                        <p>Esperando nuevos pedidos...</p>
                    </div>
                ) : (
                    pedidosPendientes.map((pedido) => (
                        <div className="col-12 col-md-4 col-lg-3" key={pedido.id}>
                            {/* Tarjeta estilo Ticket de Cocina */}
                            <div className="card shadow-sm border-warning border-top border-4 h-100">
                                <div className="card-header bg-white border-0 pb-0 d-flex justify-content-between align-items-center">
                                    <h5 className="fw-bold m-0">Mesa {pedido.mesa_id}</h5>
                                    <small className="text-muted">{new Date(pedido.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                                </div>
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <h3 className="fw-bold m-0">{pedido.cantidad}x {pedido.nombre_item}</h3>
                                    </div>
                                    
                                    {pedido.notas && (
                                        <div className="bg-light p-2 rounded small text-danger fw-bold mb-3">
                                            ⚠️ Notas: {pedido.notas}
                                        </div>
                                    )}

                                    <p className="text-muted small mb-0">Para: {pedido.nombre_usuario}</p>
                                </div>
                                <div className="card-footer bg-white border-0 pt-0">
                                    <button 
                                        className="btn btn-success w-100 fw-bold d-flex justify-content-center align-items-center gap-2 py-2"
                                        onClick={() => marcarComoLista(pedido.id)}
                                    >
                                        <span className="material-icons">check_circle</span>
                                        ¡PLATILLO LISTO!
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default VistaCocinero;