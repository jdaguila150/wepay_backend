import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Login.css';
import api from '../../services/api'


export default function Registro() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        // Validación básica en el frontend
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);

        try {
            // El registro suele enviarse como JSON estándar
            await api.post('/auth/registro', {
                email: email,
                password: password,
                // Si tu backend pide nombre, lo mandamos. Si no, lo ignorará.
                nombre_completo: nombre
            });

            setSuccess(true);

            // Esperamos 2 segundos y redirigimos al login
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            if (err.response) {
                const status = err.response.status;
                const detail = err.response.data?.detail;

                if (status === 400) {
                    setError('El correo ya está registrado.');
                } else if (status === 422) {
                    setError('Por favor, ingresa un correo válido.');
                } else {
                    setError(typeof detail === 'string' ? detail : `Error del servidor (${status}).`);
                }
            } else if (err.request) {
                setError('No se pudo conectar con WePay. Verifica el servidor.');
            } else {
                setError('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="family-login-wrapper d-flex align-items-center justify-content-center min-vh-100 p-3">

            <div className="family-login-card card shadow-lg p-4 p-md-5 border-0 col-12 col-md-8 col-lg-5 col-xl-4 rounded-4 bg-white">

                <div className="text-center mb-4 family-brand-header">
                    <h2 className="family-logo-text-modern m-0 fs-1">
                        WE<span className="family-orange-dot">PAY</span>
                    </h2>
                    <p className="family-brand-tagline text-muted mt-2">Crea tu cuenta y empieza a dividir.</p>
                </div>

                {error && (
                    <div className="alert alert-danger d-flex align-items-center mb-4 family-alert" role="alert">
                        <span className="material-icons me-2 family-icon-alert">error</span>
                        <div>{error}</div>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success d-flex align-items-center mb-4 family-alert" style={{ backgroundColor: '#dcfce7', color: '#166534' }} role="alert">
                        <span className="material-icons me-2 family-icon-alert">check_circle</span>
                        <div>¡Cuenta creada con éxito! Redirigiendo...</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="family-login-form">

                    {/* Nombre */}
                    <div className="mb-3">
                        <label htmlFor="nombre" className="form-label family-form-label">
                            <span className="material-icons family-label-icon">person</span>
                            Nombre Completo
                        </label>
                        <div className="input-group family-input-group-modern border-2">
                            <input
                                type="text"
                                id="nombre"
                                className="form-control family-form-control p-3"
                                placeholder="Tu nombre"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="mb-3">
                        <label htmlFor="email" className="form-label family-form-label">
                            <span className="material-icons family-label-icon">email</span>
                            Correo Electrónico
                        </label>
                        <div className="input-group family-input-group-modern border-2">
                            <input
                                type="email"
                                id="email"
                                className="form-control family-form-control p-3"
                                placeholder="ejemplo@wepay.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Contraseña */}
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label family-form-label">
                            <span className="material-icons family-label-icon">lock</span>
                            Contraseña
                        </label>
                        <div className="input-group family-input-group-modern border-2">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                className="form-control family-form-control p-3"
                                placeholder="Mínimo 6 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
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

                    {/* Confirmar Contraseña */}
                    <div className="mb-4">
                        <label htmlFor="confirmPassword" className="form-label family-form-label">
                            <span className="material-icons family-label-icon">check_circle_outline</span>
                            Confirmar Contraseña
                        </label>
                        <div className="input-group family-input-group-modern border-2">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="confirmPassword"
                                className="form-control family-form-control p-3"
                                placeholder="Repite tu contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="d-grid gap-2 mt-4">
                        <button
                            type="submit"
                            className="btn family-btn-primary btn-lg p-3 rounded-pill"
                            disabled={loading || success}
                        >
                            {loading ? 'CREANDO CUENTA...' : 'REGISTRARSE'}
                        </button>
                    </div>
                </form>

                <div className="family-form-footer text-center mt-4">
                    <p className="text-muted small">¿Ya tienes cuenta? <Link to="/login" className="family-link">Inicia sesión aquí</Link></p>
                </div>
            </div>
        </div>
    );
}