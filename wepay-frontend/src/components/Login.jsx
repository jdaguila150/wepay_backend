import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Login.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // Nuevo estado para ver clave

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        try {
            const response = await axios.post('http://localhost:8080/auth/login', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            // Si Axios no saltó al catch, significa que fue un 200 OK
            
            localStorage.setItem('wepay_token', response.data.access_token);
            localStorage.setItem('wepay_user_id', response.data.user_id);
            navigate('/menu');

        } catch (err) {
            // 1. El servidor respondió con un código de error (ej. 400, 401, 500)
            if (err.response) {
                const status = err.response.status;
                const detail = err.response.data?.detail; // Aquí FastAPI manda sus mensajes

                if (status === 401) {
                    setError('Correo o contraseña incorrectos. Intenta de nuevo.');
                } else if (status === 404) {
                    setError('Servicio de autenticación no encontrado. Verifica el Gateway.');
                } else if (status === 422) {
                    setError('Por favor, ingresa los datos en el formato correcto.');
                } else {
                    // Si hay un error específico del backend, lo mostramos. Si no, uno genérico.
                    setError(typeof detail === 'string' ? detail : `Error del servidor (${status}).`);
                }
            }
            // 2. La petición salió, pero el backend nunca respondió (está apagado)
            else if (err.request) {
                setError('No se pudo conectar con WePay. Verifica que el servidor esté encendido.');
            }
            // 3. Error en la configuración de React antes de enviar la petición
            else {
                setError('Ocurrió un error inesperado en la aplicación.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        // Clase d-flex y justify-content-center para centrado absoluto en pantalla completa
        <div className="family-login-wrapper d-flex align-items-center justify-content-center min-vh-100 p-3">

            {/* Tarjeta de login moderna con Bootstrap (col-md-6 col-lg-4 para responsividad) */}
            <div className="family-login-card card shadow-lg p-4 p-md-5 border-0 col-12 col-md-8 col-lg-5 col-xl-4 rounded-4 bg-white">

                {/* Encabezado con el Logo centrado */}
                <div className="text-center mb-5 family-brand-header">
                    <h1 className="family-logo-text-modern m-0">
                        WE<span className="family-orange-dot">PAY</span>
                    </h1>
                    <p className="family-brand-tagline text-muted">Dividir la cuenta, nunca fue tan fácil.</p>
                </div>

                {/* Mensaje de Error (Bootstrap Alert) */}
                {error && (
                    <div className="alert alert-danger d-flex align-items-center mb-4 family-alert" role="alert">
                        <span className="material-icons me-2 family-icon-alert">error</span>
                        <div>{error}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="family-login-form">

                    {/* Input de Correo con Icono */}
                    <div className="mb-4">
                        <label htmlFor="email" className="form-label family-form-label">
                            <span className="material-icons family-label-icon">email</span>
                            Correo Electrónico
                        </label>
                        <div className="input-group family-input-group-modern">
                            <input
                                type="email"
                                id="email"
                                className="form-control family-form-control p-3 border-2"
                                placeholder="ejemplo@wepay.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Input de Contraseña con Icono y Opción de ver Clave */}
                    <div className="mb-4">
                        <label htmlFor="password" className="form-label family-form-label">
                            <span className="material-icons family-label-icon">lock</span>
                            Contraseña
                        </label>
                        <div className="input-group family-input-group-modern border-2">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                className="form-control family-form-control p-3"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {/* Botón para mostrar/ocultar contraseña (Material Icon) */}
                            <button
                                className="btn btn-outline-secondary border-0 d-flex align-items-center px-3 family-password-toggle"
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span className="material-icons family-icon-toggle">
                                    {showPassword ? "visibility_off" : "visibility"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Botón de Submit (Bootstrap Button) */}
                    <div className="d-grid gap-2 mt-5">
                        <button
                            type="submit"
                            className="btn family-btn-primary btn-lg p-3 rounded-pill"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="spinner-border spinner-border-sm text-white me-2" role="status">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                            ) : null}
                            {loading ? 'INGRESANDO...' : 'ENTRAR'}
                        </button>
                    </div>
                </form>

                {/* Footer (Bootstrap Text classes) */}
                <div className="family-form-footer text-center mt-5">
                    <p className="text-muted small">
                        ¿No tienes cuenta? <Link to="/registro" className="family-link">Regístrate aquí</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}