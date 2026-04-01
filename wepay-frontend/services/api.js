import axios from 'axios';

// Creamos una instancia de Axios con la URL de nuestra variable de entorno
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
});

// También podemos configurar un "Interceptor" para que pegue el token 
// automáticamente en TODAS las peticiones si existe.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('wepay_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;