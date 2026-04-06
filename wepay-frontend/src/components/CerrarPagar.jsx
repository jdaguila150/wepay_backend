import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Asegúrate de tener api configurado
import api from '../../services/api';

export default function CerrarPagar() {
    const { id } = useParams(); // ID de la sesión
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);

    // Estados para "Mi Cuenta"
    const [misItems, setMisItems] = useState([]);
    const [miSubtotal, setMiSubtotal] = useState(0);

    const [miTotalOriginal, setMiTotalOriginal] = useState(0);
    const [miAbono, setMiAbono] = useState(0);

    // --- NUEVOS ESTADOS PARA VECINOS ---
    const [vecinos, setVecinos] = useState([]); // Guardará: [{ id_unico, nombre, subtotal }]
    const [aportaciones, setAportaciones] = useState({}); // Guardará: { "id_paco": 150.50 }

    const [propinaPct, setPropinaPct] = useState(0.10);
    const [procesando, setProcesando] = useState(false);

    // Lógica Híbrida: Saber quién soy yo (VIP o Invitado)
    const miUsuarioId = localStorage.getItem('wepay_user_id');
    const invitadoGuardado = localStorage.getItem('wepay_invitado');
    const miInvitado = invitadoGuardado ? JSON.parse(invitadoGuardado) : null;

    // --- ESTADOS PARA "IR A TABLAS" ---
    const [mostrarModalTablas, setMostrarModalTablas] = useState(false);
    // Guardaremos los IDs o Nombres de los amigos seleccionados
    const [amigosParaTablas, setAmigosParaTablas] = useState([]);

    // Guardará los datos de la propuesta si alguien nos invita
    const [propuestaEntrante, setPropuestaEntrante] = useState(null);

    // Lista negra temporal de quienes nos rechazan ir a tablas
    const [amigosQueDeclinaron, setAmigosQueDeclinaron] = useState([]);


    // Estados para el historial de favores
    const [apoyosDados, setApoyosDados] = useState([]);
    const [apoyosRecibidos, setApoyosRecibidos] = useState([]);

    const [estadoMesa, setEstadoMesa] = useState(null);


    useEffect(() => {
        // En esta vista, sí necesitamos saber quién es el que paga. 
        // Si no es VIP ni tiene nombre temporal, lo regresamos a que se identifique.
        const token = localStorage.getItem('wepay_token');
        if (!token && !miInvitado) return navigate(`/local/Tu_Restaurante/mesa/${id}`);

        const cargarDatosPago = async () => {
            try {
                // Configuración de Axios inteligente
                const configAxios = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

                // 1. Traemos el estado de la mesa y el menú
                const resEstado = await api.get(`/sesiones/sesion/${id}/estado`, configAxios);
                const estado = resEstado.data;

                setEstadoMesa(estado);

                // 👇 NUEVO: Clasificar el historial de apoyos
                const historial = estado.historial_apoyos || [];
                const miIdentificador = miUsuarioId || miInvitado?.nombre;

                // ¿A quién ayudé yo? (Yo soy el "de")
                const misApoyos = historial.filter(mov => mov.de === miIdentificador);

                // ¿Quién me ayudó a mí? (Yo soy el "para")
                const favoresRecibidos = historial.filter(mov => mov.para === miIdentificador);

                setApoyosDados(misApoyos);
                setApoyosRecibidos(favoresRecibidos);

                // Revisar si hay un "Post-it" de propuesta pendiente
                if (estado.propuesta_activa) {
                    const miIdentificador = miUsuarioId || miInvitado?.nombre;
                    if (estado.propuesta_activa.participantes.includes(miIdentificador)) {
                        setPropuestaEntrante(estado.propuesta_activa);
                    }
                } else {
                    // 👇 NUEVO: Si NO hay propuesta en el backend, cerramos el modal
                    setPropuestaEntrante(propuestaPrevia => {
                        // Si el usuario tenía el modal abierto y de repente se canceló...
                        if (propuestaPrevia) {
                            alert("⚠️ La propuesta de tablas se ha cancelado porque la cuenta de la mesa cambió (alguien pidió algo nuevo).");
                        }
                        return null; // Forzamos al modal a desaparecer
                    });
                }


                const resMenu = await api.get(`/menu/restaurantes/${estado.restaurante_id}/items`, configAxios);
                const menu = resMenu.data;

                // 👇 1. Preparación de variables y lectura de abonos
                const abonosMesa = estado.abonos || {};

                let miSub = 0;
                const misPedidosTemp = [];
                const consumoVecinosTemp = {};

                // 👇 2. UN SOLO FOREACH: Clasificamos pedidos y sumamos el total crudo
                estado.items.forEach(pedido => {
                    // Si un taco ya está pagado al 100%, ni siquiera lo sumamos
                    if (pedido.pagado === true) return;


                    const detalleItem = menu.find(m => m.id === pedido.item_id);
                    const costoBruto = (detalleItem?.precio || 0) * pedido.cantidad;
                    const costoTotal = Math.round(costoBruto * 100) / 100;


                    const itemProcesado = {
                        ...pedido,
                        nombre_producto: detalleItem?.nombre || 'Producto Desconocido',
                        precioBase: detalleItem?.precio || 0,
                        costoTotal
                    };

                    // ¿Este pedido es mío?
                    const esMio = (miUsuarioId && pedido.usuario_id === miUsuarioId) ||
                        (!miUsuarioId && pedido.nombre_usuario === miInvitado?.nombre);

                    if (esMio) {
                        misPedidosTemp.push(itemProcesado);
                        miSub += costoTotal;
                    } else {
                        // Es de un vecino. Lo agrupamos.
                        const keyVecino = pedido.usuario_id || pedido.nombre_usuario || 'Desconocido';

                        if (!consumoVecinosTemp[keyVecino]) {
                            consumoVecinosTemp[keyVecino] = {
                                id_unico: keyVecino,
                                nombre: pedido.nombre_usuario || 'Usuario Registrado',
                                total_consumido: 0
                            };
                        }
                        consumoVecinosTemp[keyVecino].total_consumido += costoTotal;

                    }
                });

                // 👇 3. LA MATEMÁTICA FINANCIERA (Restamos los abonos) 👇

                // Restamos mi abono de mi deuda
                const miAbono = abonosMesa[miIdentificador] || 0;
                let miDeudaReal = miSub - miAbono;
                if (miDeudaReal < 0) miDeudaReal = 0;

                // Restamos los abonos de los vecinos
                const vecinosProcesados = Object.values(consumoVecinosTemp).map(vecino => {
                    const abonoVecino = abonosMesa[vecino.id_unico] || 0;
                    let deudaVecino = vecino.total_consumido - abonoVecino;
                    if (deudaVecino < 0) deudaVecino = 0;

                    return {
                        ...vecino,
                        subtotal: deudaVecino // Esto es lo que verá la pantalla
                    };
                });

                // 👇 4. ACTUALIZAMOS EL ESTADO UNA SOLA VEZ 👇
                setMisItems(misPedidosTemp);
                setMiTotalOriginal(miSub);          // Guardamos cuánto costaban los tacos
                setMiAbono(miAbono);       // Guardamos cuánto dinero ya metió a la cuenta
                setMiSubtotal(miDeudaReal);
                // Solo mostramos a los vecinos que aún deben dinero
                setVecinos(vecinosProcesados.filter(v => v.subtotal > 0));



            } catch (err) {
                console.error("Error al cargar datos para pago:", err);
                alert("Hubo un problema al preparar tu pago.");
            } finally {
                setLoading(false);
            }
        };

        // 1. Cargamos los datos normales al entrar a la pantalla
        cargarDatosPago();

        // 2. --- CONEXIÓN AL WEBSOCKET EN TIEMPO REAL ---
        // Asegúrate de que esta URL apunte correctamente a tu API Gateway o al puerto de Pagos
        const ws = new WebSocket(`ws://localhost:8080/pagos/ws/${id}`);


        ws.onmessage = (event) => {
            try {
                // Parseamos el JSON que manda el backend
                const data = JSON.parse(event.data);

                // 1. Si el backend nos avisa que alguien acaba de pagar...
                if (data.accion === "recargar_mesa") {
                    console.log("¡Actualización en la mesa!", data.mensaje);
                    // ...volvemos a ejecutar la función silenciosamente para recalcular la cuenta
                    cargarDatosPago();
                }

                // 👇 2. NUEVA LÓGICA: Si el backend grita una propuesta de tablas...
                else if (data.accion === "nueva_propuesta_tablas") {
                    const miIdentificador = miUsuarioId || miInvitado?.nombre;

                    // Agregamos ?. por si "datos" o "participantes" no vienen en el JSON
                    if (data.datos?.participantes?.includes(miIdentificador)) {
                        console.log("¡Me acaban de invitar a tablas!");
                        setPropuestaEntrante(data.datos);
                    }
                }

                else if (data.accion === "propuesta_declinada") {
                    // Agregamos un fallback a {} por si "datos" viene vacío
                    const datos = data.datos || {};
                    const miIdentificador = miUsuarioId || miInvitado?.nombre;

                    alert(`❌ ${datos.declinador_nombre || 'Alguien'} no aceptó las tablas. La propuesta se ha cancelado.`);

                    if (miIdentificador === datos.creador_id && datos.declinador_id) {
                        setAmigosQueDeclinaron(prev => [...prev, datos.declinador_id]);
                    }

                    setPropuestaEntrante(null);
                }

            } catch (error) {
                // Respaldo de seguridad: por si el backend manda texto plano en lugar de JSON
                if (event.data === "actualizar_mesa") {
                    console.log("¡Actualización en la mesa (texto)!");
                    cargarDatosPago();
                }
            }
        };


        // 3. Limpieza de memoria
        // Si el usuario se sale de la pantalla "CerrarPagar", desconectamos el socket
        return () => {
            ws.close();
        };

    }, [id, navigate, miUsuarioId]);


    // --- NUEVA FUNCIÓN PARA APOYAR A VECINOS ---
    const handleApoyarVecino = (idVecino, porcentaje) => {
        const vecino = vecinos.find(v => v.id_unico === idVecino);
        if (!vecino) return;
        const montoAAportar = vecino.subtotal * (porcentaje / 100);

        setAportaciones(prev => ({ ...prev, [idVecino]: montoAAportar }));
    };

    // 👇 NUEVA FUNCIÓN PARA EL INPUT PERSONALIZADO 👇
    const handleMontoPersonalizado = (idVecino, valorIngresado, maximo) => {
        // Si borran el input, lo tomamos como 0
        if (valorIngresado === '') {
            setAportaciones(prev => ({ ...prev, [idVecino]: 0 }));
            return;
        }

        let monto = parseFloat(valorIngresado);

        // Validaciones de seguridad: ni negativo, ni más de lo que debe el amigo
        if (monto < 0) monto = 0;
        if (monto >= maximo) monto = maximo;

        setAportaciones(prev => ({
            ...prev,
            [idVecino]: monto
        }));
    };

    // --- CÁLCULOS FINALES ---
    // Sumamos todo lo que decidí pagar por mis amigos
    const totalAportaciones = Object.values(aportaciones).reduce((sum, monto) => sum + monto, 0);

    // Mi cuenta + Lo que le invito a los demás
    const subtotalFinal = miSubtotal + totalAportaciones;
    const montoPropina = subtotalFinal * propinaPct;
    const totalAPagar = subtotalFinal + montoPropina;

    const handlePagar = async () => {
        setProcesando(true);
        try {
            const token = localStorage.getItem('wepay_token');
            const configAxios = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

            // 👇 AQUÍ ESTÁ LA VARIABLE FALTANTE 👇
            // Calculamos cuánto de nuestro propio consumo estamos pagando
            const miDeudaRestante = miSubtotal > 0 ? miSubtotal : 0;

            const payloadPago = {
                sesion_id: id,
                usuario_id: miUsuarioId || null,
                nombre_usuario: miInvitado?.nombre || "Usuario Registrado",
                monto: totalAPagar, // Esto incluye la propina (lo que va al banco)
                metodo_pago: "tarjeta",
                abono_propio: miDeudaRestante, // Esto va a nuestro "Libro Mayor" sin propina
                aportaciones_vecinos: aportaciones // Lo que le invitas a la mesa
            };

            const res = await api.post(`/pagos/procesar`, payloadPago, configAxios);

            const mensajeFinal = res.data.estado_sesion?.mensaje || "Pago procesado con éxito";
            alert(mensajeFinal);

            // Al terminar de pagar, los regresamos a la pantalla del menú de su mesa
            navigate(`/ticket`, {
                state: {
                    sesionId: id,
                    nombreUsuario: miInvitado?.nombre || "Usuario Registrado",
                    totalConsumido: miSubtotal, // Lo que costaron sus tacos
                    totalPagado: payloadPago.monto, // Lo que realmente se cobró a la tarjeta
                    fecha: new Date().toLocaleString()
                }
            });


        } catch (error) {
            alert("Hubo un error al procesar tu pago");
            console.error(error);
        } finally {
            setProcesando(false);
        }
    };

    // --- RECUPERAR TICKET SI YA PAGÓ ---
    const verTicketSalida = () => {
        // 1. Identificamos quién eres
        const miIdentificador = miUsuarioId || miInvitado?.nombre;

        // 2. Leemos la verdad absoluta de nuestro Libro Mayor que acabamos de guardar
        const loQueHePagado = estadoMesa?.abonos?.[miIdentificador] || 0;

        navigate(`/ticket`, { 
            state: {
                sesionId: id,
                nombreUsuario: miInvitado?.nombre || "Usuario Registrado",
                totalConsumido: miTotalOriginal, // Lo que costaron los tacos que te comiste
                totalPagado: loQueHePagado, // Lo que tu cartera realmente pagó (tablas, propinas, etc)
                fecha: new Date().toLocaleString()
            }
        });
    };


    // --- LÓGICA DE TABLAS ---
    // 1. Obtenemos a los vecinos seleccionados usando el array de 'vecinos' que ya tienes
    const vecinosSeleccionados = vecinos.filter(v => amigosParaTablas.includes(v.id_unico));

    // 2. Sumamos mi deuda + la deuda de los vecinos seleccionados
    const totalDeudaGrupal = miSubtotal + vecinosSeleccionados.reduce((acc, v) => acc + v.subtotal, 0);

    // 3. Dividimos entre el total de personas (Yo + los amigos seleccionados)
    const personasEnTablas = 1 + vecinosSeleccionados.length;
    const cuotaPorPersona = totalDeudaGrupal / personasEnTablas;

    // Función para marcar/desmarcar a un amigo en la lista
    const toggleAmigoTablas = (idUnico) => {
        setAmigosParaTablas(prev =>
            prev.includes(idUnico)
                ? prev.filter(id => id !== idUnico)
                : [...prev, idUnico]
        );
    };


    const enviarPropuestaTablas = async () => {
        try {
            const miIdentificador = miUsuarioId || miInvitado?.nombre;
            const miNombre = miInvitado?.nombre || "Usuario Registrado";

            const payload = {
                creador_id: miIdentificador,
                creador_nombre: miNombre,
                participantes: amigosParaTablas, // El array de IDs seleccionados
                monto_por_persona: cuotaPorPersona
            };

            const token = localStorage.getItem('wepay_token');
            const configAxios = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

            // Apuntamos al Gateway (8080) -> servicio de sesiones
            await api.post(`/pagos/sesion/${id}/proponer-tablas`, payload, configAxios);
            setMostrarModalTablas(false);
            alert("¡Propuesta enviada! Esperando a que tus amigos acepten...");

        } catch (error) {
            console.error("Error proponiendo tablas:", error);
            alert("Hubo un error al enviar la propuesta.");
        }
    };


    // --- NUEVA LÓGICA: SOLO ACEPTAR LA DEUDA ---
    const aceptarTablas = async () => {
        try {
            const montoAceptado = propuestaEntrante.monto_por_persona;
            const miIdentificador = miUsuarioId || miInvitado?.nombre;

            // ¿Cuánto dinero extra estoy asumiendo para ayudar a mi amigo?
            // (Si yo debía 50 y acepto 150, estoy asumiendo 100 de su deuda)
            const montoTransferido = montoAceptado - miSubtotal;

            const payload = {
                creador_id: propuestaEntrante.creador_id,
                aceptador_id: miIdentificador,
                monto_transferido: montoTransferido
            };

            const token = localStorage.getItem('wepay_token');
            const configAxios = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

            // Enviamos el "acuerdo" al microservicio de Pagos
            await api.post(`/pagos/sesion/${id}/aceptar-tablas`, payload, configAxios);

            setPropuestaEntrante(null); // Cerramos el modal
            alert("¡Tablas aceptadas! Tu cuenta se ha ajustado.");

        } catch (error) {
            console.error("Error al aceptar tablas:", error);
            alert("Hubo un error al aceptar la propuesta.");
        }
    };


    const declinarTablas = async () => {
        try {
            const miIdentificador = miUsuarioId || miInvitado?.nombre;
            const miNombre = miInvitado?.nombre || "Usuario Registrado";

            const payload = {
                declinador_id: miIdentificador,
                declinador_nombre: miNombre,
                creador_id: propuestaEntrante.creador_id
            };

            const token = localStorage.getItem('wepay_token');
            const configAxios = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

            // Le avisamos al microservicio de Pagos
            await api.post(`/pagos/sesion/${id}/declinar-tablas`, payload, configAxios);

            setPropuestaEntrante(null); // Cerramos nuestro modal

        } catch (error) {
            console.error("Error al declinar:", error);
        }
    };


    if (loading) {
        return (
            <div className="min-vh-100 bg-light d-flex flex-column align-items-center justify-content-center">
                <div className="spinner-border text-success" role="status"></div>
                <p className="mt-3 fw-bold text-muted">Preparando la cuenta de la mesa...</p>
            </div>
        );
    }
    return (
        <div className="min-vh-100 bg-light pb-5">
            {/* Navbar Simple */}
            <nav className="navbar navbar-dark shadow-sm sticky-top" style={{ backgroundColor: '#2c3e50' }}>
                <div className="container d-flex align-items-center">
                    <button onClick={() => navigate(-1)} className="btn text-white p-0 d-flex align-items-center border-0">
                        <span className="material-icons fs-2 me-1">close</span>
                    </button>
                    <span className="mx-auto fw-bold text-white fs-5">Caja WePay</span>
                    <div style={{ width: '32px' }}></div>
                </div>
            </nav>

            <main className="container py-4" style={{ maxWidth: '600px' }}>

                <h4 className="fw-bold text-dark mb-4 text-center">Resumen de tu parte</h4>

                {/* --- 1. LISTA DE CONSUMO PERSONAL --- */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">

                    {/* Banner de Éxito si la deuda es 0 pero sí consumió algo */}
                    {miSubtotal === 0 && miTotalOriginal > 0 && (
                        <div className="bg-success text-white text-center py-2 fw-bold animate__animated animate__fadeIn">
                            <span className="material-icons align-text-bottom me-1" style={{ fontSize: '18px' }}>check_circle</span>
                            ¡Tu parte está totalmente pagada!
                        </div>
                    )}



                    <div className="card-body p-4">
                        {misItems.length === 0 ? (
                            <p className="text-center text-muted m-0">No has agregado platillos a tu cuenta.</p>
                        ) : (
                            // Si ya pagó todo, bajamos un poco la opacidad para que se vea "desactivado"
                            <ul className="list-group list-group-flush" style={{ opacity: miSubtotal === 0 ? 0.5 : 1, transition: 'all 0.3s ease' }}>
                                {misItems.map((item, idx) => (
                                    <li key={idx} className="list-group-item bg-transparent px-0 py-2 border-bottom-dashed d-flex justify-content-between align-items-center border-0 mb-2">
                                        <div className="d-flex align-items-center gap-3">
                                            <span className="badge bg-light text-dark border p-2 rounded-3">{item.cantidad}x</span>
                                            <span className="fw-medium text-dark">{item.nombre_producto}</span>
                                        </div>
                                        <span className="text-muted fw-bold">${item.costoTotal.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Footer tipo Ticket Desglosado */}
                    <div className="card-footer bg-light border-0 p-3 rounded-bottom-4">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-muted small">Total Consumido</span>
                            <span className="text-muted small">${miTotalOriginal.toFixed(2)}</span>
                        </div>

                        {miAbono > 0 && (
                            <div className="d-flex justify-content-between align-items-center mb-2 animate__animated animate__fadeIn">
                                <span className="text-success small fw-bold">Abonos Realizados</span>
                                <span className="text-success small fw-bold">-${miAbono.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="d-flex justify-content-between align-items-center border-top pt-2 mt-2">
                            <span className="fw-bold text-dark">Mi Deuda Restante</span>
                            <span className="fw-bold text-dark fs-5">${miSubtotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* --- 2. SECCIÓN: APOYAR A LA MESA (NUEVO) --- */}
                {vecinos.length > 0 && (
                    <>
                        <h4 className="fw-bold text-dark mt-5 mb-4 text-center">Apoyar a tus amigos</h4>

                        {/* --- 2. HISTORIAL DE APOYOS (Solo se muestra si hay movimientos) --- */}
                        {(apoyosDados.length > 0 || apoyosRecibidos.length > 0) && (
                            <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden animate__animated animate__fadeInUp">
                                <div className="card-header bg-white border-bottom-0 pt-4 pb-0">
                                    <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                                        <span className="material-icons text-primary">handshake</span>
                                        Resumen de Apoyos
                                    </h5>
                                </div>
                                <div className="card-body">

                                    {/* Lo que yo he pagado por otros */}
                                    {apoyosDados.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-success small fw-bold mb-2">Has apoyado a:</p>
                                            <ul className="list-group list-group-flush">
                                                {apoyosDados.map((mov, idx) => (
                                                    <li key={idx} className="list-group-item px-0 py-1 border-0 d-flex justify-content-between align-items-center small">
                                                        <span className="text-muted">
                                                            {mov.para} <span className="badge bg-light text-secondary ms-1">{mov.tipo}</span>
                                                        </span>
                                                        <span className="fw-medium text-success">+${mov.monto.toFixed(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Lo que otros han pagado por mí */}
                                    {apoyosRecibidos.length > 0 && (
                                        <div>
                                            <p className="text-info small fw-bold mb-2">Te han apoyado:</p>
                                            <ul className="list-group list-group-flush">
                                                {apoyosRecibidos.map((mov, idx) => (
                                                    <li key={idx} className="list-group-item px-0 py-1 border-0 d-flex justify-content-between align-items-center small">
                                                        <span className="text-muted">
                                                            {mov.de} <span className="badge bg-light text-secondary ms-1">{mov.tipo}</span>
                                                        </span>
                                                        <span className="fw-medium text-info">-${mov.monto.toFixed(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}
                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-body p-4">
                                {/* Botón para Proponer Tablas */}
                                {vecinos.length > 0 && (
                                    <div className="d-grid mb-3">
                                        <button
                                            className="btn btn-outline-primary fw-bold d-flex align-items-center justify-content-center gap-2"
                                            onClick={() => {
                                                setAmigosParaTablas([]); // Limpiamos selecciones previas
                                                setMostrarModalTablas(true);
                                            }}
                                        >
                                            <span className="material-icons">pie_chart</span>
                                            ¡Proponer ir a Tablas!
                                        </button>
                                    </div>
                                )}
                                <ul className="list-group list-group-flush">
                                    {vecinos.map((vecino) => {
                                        const aportacionActual = aportaciones[vecino.id_unico] || 0;
                                        // Calculamos el porcentaje para iluminar los botones rápidos si coinciden
                                        const pctActual = vecino.subtotal > 0 ? (aportacionActual / vecino.subtotal) * 100 : 0;

                                        return (
                                            <li key={vecino.id_unico} className="list-group-item px-0 py-3 border-bottom-dashed border-0">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: '35px', height: '35px' }}>
                                                            <span className="fw-bold">{vecino.nombre.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                        <span className="fw-bold text-dark">{vecino.nombre}</span>
                                                    </div>
                                                    <div className="text-end">
                                                        <span className="text-muted small d-block" style={{ lineHeight: '1' }}>Su cuenta</span>
                                                        <span className="text-dark fw-bold">${vecino.subtotal.toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                {/* --- CONTROLES DE APORTACIÓN --- */}
                                                <div className="mt-3 bg-light p-2 rounded-4 border">
                                                    {/* 1. Botones Rápidos */}
                                                    <div className="d-flex gap-2 mb-2">
                                                        {[0, 50, 100].map(pct => (
                                                            <button
                                                                key={pct}
                                                                onClick={() => handleApoyarVecino(vecino.id_unico, pct)}
                                                                className={`btn btn-sm flex-grow-1 rounded-pill fw-bold transition-all ${pctActual === pct ? 'btn-primary shadow-sm text-white' : 'btn-outline-primary bg-white'}`}
                                                            >
                                                                {pct === 0 ? 'Nada' : pct === 100 ? 'Todo' : `Mitad`}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* 2. Input Personalizado */}
                                                    <div className="input-group input-group-sm shadow-sm rounded-pill overflow-hidden border bg-white">
                                                        <span className="input-group-text bg-transparent border-0 text-muted fw-bold ps-3">$</span>
                                                        <input
                                                            type="number"
                                                            className="form-control border-0 shadow-none fw-bold text-primary"
                                                            placeholder="Monto exacto a invitar..."
                                                            value={aportacionActual > 0 ? aportacionActual : ''}
                                                            onChange={(e) => handleMontoPersonalizado(vecino.id_unico, e.target.value, vecino.subtotal)}
                                                            min="0"
                                                            max={vecino.subtotal}
                                                            step="0.01"
                                                        />
                                                        <button
                                                            className="btn btn-light border-0 text-secondary pe-3 fw-bold small bg-transparent"
                                                            onClick={() => handleApoyarVecino(vecino.id_unico, 100)}
                                                        >
                                                            MAX
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mensaje de confirmación visual */}
                                                {aportacionActual > 0 && (
                                                    <div className="text-end mt-2 animate__animated animate__fadeIn">
                                                        <small className="text-success fw-bold">
                                                            <span className="material-icons align-text-bottom me-1" style={{ fontSize: '14px' }}>favorite</span>
                                                            Aportas: ${aportacionActual.toFixed(2)}
                                                        </small>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            {/* Resumen de aportaciones */}
                            {totalAportaciones > 0 && (
                                <div className="card-footer bg-success bg-opacity-10 border-0 p-3 d-flex justify-content-between align-items-center rounded-bottom-4">
                                    <span className="fw-bold text-success">Total de tu apoyo</span>
                                    <span className="fw-bold text-success fs-5">+ ${totalAportaciones.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* --- 3. SELECTOR DE PROPINA --- */}
                {/* Nota: Ahora usamos subtotalFinal, que incluye lo tuyo + lo de tus amigos */}
                {subtotalFinal > 0 && (
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
                                        className={`btn flex-grow-1 rounded-3 fw-bold py-2 transition-all ${propinaPct === pct ? 'btn-dark shadow' : 'btn-outline-secondary border-1 bg-white'}`}
                                    >
                                        {pct * 100}%
                                    </button>
                                ))}
                            </div>
                            <div className="d-flex justify-content-between mt-3 text-muted small">
                                <span>Calculado sobre ${subtotalFinal.toFixed(2)}:</span>
                                <span className="fw-bold text-dark">${montoPropina.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 4. MÉTODO DE PAGO --- */}
                <div className="card border-0 shadow-sm rounded-4 mb-5">
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

            {/* --- FOOTER FIJO --- */}
            <div className="position-fixed bottom-0 start-0 w-100 bg-white border-top shadow-lg p-3" style={{ zIndex: 1030 }}>
                <div className="container d-flex justify-content-between align-items-center" style={{ maxWidth: '600px' }}>
                    <div>
                        <small className="text-muted d-block fw-bold mb-1">Total a Pagar</small>
                        <h3 className="fw-bold m-0 text-dark" style={{ lineHeight: '1' }}>${totalAPagar.toFixed(2)}</h3>
                    </div>

                    {/* --- LÓGICA DEL BOTÓN INTELIGENTE --- */}
                    {subtotalFinal > 0 ? (
                        /* Botón de Pagar (Si aún hay deuda) */
                        <button
                            onClick={handlePagar}
                            disabled={procesando}
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
                    ) : (
                        /* Botón de QR de Salida (Si la deuda es 0) */
                        <button
                            onClick={verTicketSalida}
                            className="btn btn-lg rounded-pill px-4 fw-bold text-white shadow d-flex align-items-center gap-2 transition-all"
                            style={{ backgroundColor: '#0d6efd' }} // Azul elegante para diferenciarlo del cobro
                        >
                            <span className="material-icons">qr_code_2</span>
                            QR SALIDA
                        </button>
                    )}
                </div>
            </div>
            {/* --- MODAL PARA PROPONER TABLAS --- */}
            {mostrarModalTablas && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">🤝 Dividir Cuenta (Ir a Tablas)</h5>
                                <button type="button" className="btn-close" onClick={() => setMostrarModalTablas(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="text-muted small">Selecciona con quién quieres dividir la cuenta a partes iguales.</p>

                                <ul className="list-group mb-3">
                                    {/* Yo siempre estoy en las tablas */}
                                    <li className="list-group-item bg-light d-flex justify-content-between align-items-center">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="material-icons text-primary">person</span>
                                            <span>Mi deuda actual</span>
                                        </div>
                                        <span className="fw-bold">${miSubtotal.toFixed(2)}</span>
                                    </li>

                                    {/* Lista de vecinos para seleccionar */}
                                    {vecinos.map((v, idx) => {
                                        const meDeclino = amigosQueDeclinaron.includes(v.id_unico);
                                        return (
                                            <li key={idx}
                                                className={`list-group-item d-flex justify-content-between align-items-center ${meDeclino ? 'bg-light text-muted' : 'cursor-pointer'}`}
                                                onClick={() => !meDeclino && toggleAmigoTablas(v.id_unico)}
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    <input
                                                        className="form-check-input mt-0"
                                                        type="checkbox"
                                                        checked={amigosParaTablas.includes(v.id_unico)}
                                                        disabled={meDeclino} // 🚫 Lo bloqueamos
                                                        readOnly
                                                    />
                                                    <span>{v.nombre} {meDeclino && "(Rechazó)"}</span>
                                                </div>
                                                <span className={`${meDeclino ? 'text-muted' : 'text-dark'}`}>${v.subtotal.toFixed(2)}</span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                {/* Resumen Matemático */}
                                {amigosParaTablas.length > 0 && (
                                    <div className="bg-primary text-white p-3 rounded-3 text-center animate__animated animate__fadeIn">
                                        <p className="m-0 small text-white-50">Total a dividir: ${totalDeudaGrupal.toFixed(2)}</p>
                                        <h4 className="m-0 fw-bold mt-1">
                                            Nos toca de: ${cuotaPorPersona.toFixed(2)}
                                        </h4>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top-0 pt-0">
                                <button type="button" className="btn btn-light" onClick={() => setMostrarModalTablas(false)}>Cancelar</button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={amigosParaTablas.length === 0}
                                    onClick={enviarPropuestaTablas}
                                >
                                    Enviar Propuesta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- MODAL DE INVITACIÓN RECIBIDA (Para los amigos) --- */}
            {propuestaEntrante && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg text-center p-4 rounded-4 animate__animated animate__bounceIn">
                            <div className="mb-3">
                                <span className="material-icons text-warning" style={{ fontSize: '48px' }}>celebration</span>
                            </div>
                            <h4 className="fw-bold mb-3">¡Propuesta de Tablas!</h4>

                            <p className="text-muted mb-4 text-balance">
                                <strong className="text-dark">{propuestaEntrante.creador_nombre}</strong> te ha propuesto dividir la cuenta a partes iguales con el grupo.
                            </p>

                            <div className="bg-light rounded-3 p-3 mb-4 border">
                                <p className="small text-muted m-0">Si aceptas, tu nueva cuota será de:</p>
                                <h2 className="fw-bold text-success m-0">${propuestaEntrante.monto_por_persona.toFixed(2)}</h2>
                            </div>

                            <div className="d-grid gap-2">
                                <button
                                    className="btn btn-success fw-bold py-2"
                                    onClick={aceptarTablas}
                                >
                                    ¡Sí, acepto!
                                </button>
                                <button
                                    className="btn btn-outline-danger"
                                    onClick={declinarTablas} // 👇 AQUÍ LLAMAMOS A LA NUEVA FUNCIÓN
                                >
                                    Declinar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}