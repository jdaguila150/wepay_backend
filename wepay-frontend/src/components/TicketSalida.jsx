import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const TicketSalida = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Recuperamos los datos que nos mandó la pantalla de pagos
    const datosTicket = location.state;

    if (!datosTicket) {
        return (
            <div className="container mt-5 text-center">
                <h3>No hay un ticket activo.</h3>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>Volver</button>
            </div>
        );
    }

    const { sesionId, nombreUsuario, totalConsumido, totalPagado, fecha } = datosTicket;

    // Esto es lo que leerá el celular de la Hostess al escanear el QR
    const qrPayload = JSON.stringify({
        mesa_id: sesionId,
        cliente: nombreUsuario,
        pagado: totalPagado,
        verificado: true
    });

    // ... (parte superior del componente sin cambios) ...

    return (
        <div className="container min-vh-100 d-flex flex-column justify-content-center align-items-center bg-light py-5">
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ maxWidth: '400px', width: '100%' }}>
                
                {/* Cabecera Verde de Éxito */}
                <div className="bg-success text-white text-center py-4">
                    <span className="material-icons mb-2" style={{ fontSize: '64px' }}>check_circle</span>
                    <h2 className="fw-bold m-0">¡PAGADO!</h2>
                    <p className="m-0 opacity-75">Pase de salida autorizado</p>
                </div>

                <div className="card-body p-4 bg-white"> {/* Eliminamos position-relative si ya no se usa */}
                    
                    {/* 👇 EL BLOQUE DE LA MARCA DE AGUA SE HA ELIMINADO 👇 */}

                    {/* Información rápida para la Hostess */}
                    <div className="text-center mb-4">
                        <p className="text-muted small text-uppercase mb-1">Comensal</p>
                        {/* 👇 NUEVO: Icono pequeño de verificado junto al nombre 👇 */}
                        <h4 className="fw-bold text-dark d-flex justify-content-center align-items-center gap-2">
                            <span>{nombreUsuario}</span>
                            <span className="material-icons text-success" style={{ fontSize: '18px' }}>verified</span>
                        </h4>
                    </div>

                    <div className="row text-center mb-4 border-top border-bottom py-3">
                        <div className="col border-end">
                            <p className="text-muted small mb-0">Consumido</p>
                            <h5 className="fw-bold text-secondary m-0">${totalConsumido.toFixed(2)}</h5>
                        </div>
                        <div className="col">
                            <p className="text-muted small mb-0">Pagado</p>
                            <h5 className="fw-bold text-success m-0">${totalPagado.toFixed(2)}</h5>
                        </div>
                    </div>

                    {/* Código QR (AQUÍ ESTÁ EL AJUSTE PRINCIPAL) */}
                    <div className="text-center bg-light p-3 rounded-4 mb-4">
                        {/* El QR ahora estará completamente limpio */}
                        <QRCodeSVG value={qrPayload} size={180} level="H" />
                        <p className="text-muted small mt-2 mb-0">Escanea para auditar</p>
                    </div>

                    <div className="text-center text-muted small">
                        <p className="mb-0">ID de Mesa: <span className="text-truncate d-inline-block" style={{ maxWidth: '100px', verticalAlign: 'bottom' }}>{sesionId}</span></p>
                        <p className="mb-0">{fecha}</p>
                    </div>
                </div>
            </div>

            <button 
                className="btn btn-outline-secondary mt-4 rounded-pill px-4"
                onClick={() => navigate(`/local/Tu_Restaurante/mesa/${sesionId}`)}
            >
                Volver al Menú
            </button>
        </div>
    );
};

export default TicketSalida;

