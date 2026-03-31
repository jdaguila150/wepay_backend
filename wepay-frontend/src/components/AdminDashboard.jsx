import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const [restaurantes, setRestaurantes] = useState([]);
    const [restauranteSeleccionado, setRestauranteSeleccionado] = useState(null);

    // Estados para el Menú Interno
    const [categorias, setCategorias] = useState([]);
    const [productos, setProductos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Estados para crear Nuevo Restaurante
    const [showModalRest, setShowModalRest] = useState(false);
    const [nuevoRest, setNuevoRest] = useState({ nombre: '', direccion: '', telefono: '' });

    // Estados para edición de categorías
    const [nuevaCategoria, setNuevaCategoria] = useState('');
    const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', descripcion: '', precio: '', categoria_id: '' });
    const [editandoCategoriaId, setEditandoCategoriaId] = useState(null);
    const [categoriaEditada, setCategoriaEditada] = useState('');
    const [mostrarCategorias, setMostrarCategorias] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('wepay_token');
        if (!token) return navigate('/login');
        cargarRestaurantes();
    }, []);

    const cargarRestaurantes = async () => {
        const token = localStorage.getItem('wepay_token');
        try {
            const res = await axios.get('http://localhost:8080/menu/restaurantes/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRestaurantes(res.data);
        } catch (err) { console.error(err); }
    };

    // --- ACCIÓN: CREAR RESTAURANTE ---
    const handleCrearRestaurante = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('wepay_token');
        try {
            await axios.post('http://localhost:8080/menu/restaurantes/', nuevoRest, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNuevoRest({ nombre: '', direccion: '', telefono: '' });
            setShowModalRest(false);
            cargarRestaurantes(); // Refrescar cuadrícula
        } catch (err) { alert("Error al crear restaurante"); }
    };

    // --- ACCIÓN: ENTRAR A GESTIONAR UN RESTAURANTE ---
    const entrarARestaurante = async (rest) => {
        setRestauranteSeleccionado(rest);
        const token = localStorage.getItem('wepay_token');

        // Cargar sus datos específicos (Rutas que ya teníamos)
        try {
            const resCat = await axios.get(`http://localhost:8080/menu/restaurantes/${rest.id}/menu`, { headers: { Authorization: `Bearer ${token}` } });
            setCategorias(resCat.data);
            const resProd = await axios.get(`http://localhost:8080/menu/restaurantes/${rest.id}/items`, { headers: { Authorization: `Bearer ${token}` } });
            setProductos(resProd.data);
        } catch (err) {
            setCategorias([]);
            setProductos([]);
        }
    };

    // --- LÓGICA DE CATEGORÍAS Y PRODUCTOS (REUTILIZADA) ---
    const toggleDisponibilidad = async (producto) => {
        const token = localStorage.getItem('wepay_token');
        const nuevoEstado = !producto.disponible;
        await axios.patch(`http://localhost:8080/menu/items/${producto.id}`, { disponible: nuevoEstado }, { headers: { Authorization: `Bearer ${token}` } });
        setProductos(productos.map(p => p.id === producto.id ? { ...p, disponible: nuevoEstado } : p));
    };

    const handleCrearCategoria = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('wepay_token');
        await axios.post('http://localhost:8080/menu/categorias/', { nombre: nuevaCategoria, restaurante_id: restauranteSeleccionado.id }, { headers: { Authorization: `Bearer ${token}` } });
        setNuevaCategoria('');
        entrarARestaurante(restauranteSeleccionado);
    };

    const handleCrearProducto = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('wepay_token');
        await axios.post('http://localhost:8080/menu/items/', { ...nuevoProducto, precio: parseFloat(nuevoProducto.precio), restaurante_id: restauranteSeleccionado.id }, { headers: { Authorization: `Bearer ${token}` } });
        setNuevoProducto({ nombre: '', descripcion: '', precio: '', categoria_id: '' });
        entrarARestaurante(restauranteSeleccionado);
    };

    const eliminarProducto = async (id) => {
        if (!window.confirm('¿Eliminar?')) return;
        const token = localStorage.getItem('wepay_token');
        await axios.delete(`http://localhost:8080/menu/items/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        entrarARestaurante(restauranteSeleccionado);
    };

    const productosFiltrados = productos.filter(prod =>
        prod.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (categorias.find(c => c.id === prod.categoria_id)?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-vh-100 bg-light pb-5">
            {/* Navbar Superior */}
            <nav className="navbar navbar-dark shadow-sm mb-4" style={{ backgroundColor: '#2c3e50' }}>
                <div className="container">
                    <span className="navbar-brand mb-0 h1 fw-bold d-flex align-items-center gap-2">
                        <span className="material-icons text-warning">admin_panel_settings</span> WePay Root Dashboard
                    </span>
                    <button onClick={() => navigate('/menu')} className="btn btn-outline-light btn-sm">Cerrar Admin</button>
                </div>
            </nav>

            <div className="container">

                {/* --- VISTA 1: DASHBOARD DE TARJETAS --- */}
                {!restauranteSeleccionado ? (
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="fw-bold text-dark m-0">Mis Restaurantes</h2>
                            <span className="badge bg-dark px-3 py-2 rounded-pill">{restaurantes.length} Activos</span>
                        </div>

                        <div className="row g-4">
                            {/* Tarjeta de "Agregar Nuevo" */}
                            <div className="col-12 col-md-6 col-lg-4 col-xl-3">
                                <div
                                    onClick={() => setShowModalRest(true)}
                                    className="card h-100 border-2 border-dashed d-flex align-items-center justify-content-center text-muted"
                                    style={{ minHeight: '200px', cursor: 'pointer', borderStyle: 'dashed', borderColor: '#ccc' }}
                                >
                                    <div className="text-center">
                                        <span className="material-icons fs-1 mb-2">add_circle_outline</span>
                                        <h6 className="fw-bold">Añadir Sucursal</h6>
                                    </div>
                                </div>
                            </div>

                            {/* Lista de Restaurantes existentes */}
                            {restaurantes.map(rest => (
                                <div key={rest.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                                    <div
                                        className="card h-100 border-0 shadow-sm rounded-4 position-relative overflow-hidden"
                                        style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                                        onClick={() => entrarARestaurante(rest)}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <div className="p-4">
                                            <div className="d-flex align-items-center gap-3 mb-3">
                                                <div className="bg-warning bg-opacity-10 p-3 rounded-3">
                                                    <span className="material-icons text-warning">storefront</span>
                                                </div>
                                                <h5 className="fw-bold m-0 text-dark">{rest.nombre}</h5>
                                            </div>
                                            <p className="text-muted small mb-1 d-flex align-items-center gap-2">
                                                <span className="material-icons fs-6">location_on</span> {rest.direccion}
                                            </p>
                                            <p className="text-muted small mb-0 d-flex align-items-center gap-2">
                                                <span className="material-icons fs-6">phone</span> {rest.telefono}
                                            </p>
                                        </div>
                                        <div className="card-footer bg-white border-0 text-end p-3">
                                            <span className="text-warning fw-bold small d-flex align-items-center justify-content-end gap-1">
                                                Gestionar Menú <span className="material-icons fs-6">arrow_forward</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* --- VISTA 2: EDITOR DEL RESTAURANTE (LO QUE YA TENÍAMOS) --- */
                    <div className="animate__animated animate__fadeIn">
                        {/* Botón de Regresar */}
                        <button
                            onClick={() => { setRestauranteSeleccionado(null); cargarRestaurantes(); }}
                            className="btn btn-link text-dark text-decoration-none d-flex align-items-center gap-2 mb-4 p-0"
                        >
                            <span className="material-icons">arrow_back</span>
                            <span className="fw-bold">Volver al Dashboard</span>
                        </button>

                        {/* ... Aquí va exactamente el código que teníamos antes: el editor de categorías, productos y datatable ... */}
                        {/* (Omito repetirlo todo para no saturar, pero mantén la estructura de Columnas y DataTable aquí) */}
                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h3 className="fw-bold" style={{ color: '#F37A20' }}>{restauranteSeleccionado.nombre}</h3>
                            <p className="text-muted">Gestionando categorías y platillos</p>
                        </div>

                        <div className="row g-4">
                            {/* Columna Categorías */}
                            <div className="col-md-5">
                    <div className="card border-0 shadow-sm rounded-4 p-4">
                        
                        {/* 1. Título con botón para ocultar/mostrar */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold m-0">Categorías</h6>
                            <button 
                                type="button" 
                                className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center p-1" 
                                onClick={() => setMostrarCategorias(!mostrarCategorias)}
                            >
                                <span className="material-icons">
                                    {mostrarCategorias ? 'expand_less' : 'expand_more'}
                                </span>
                            </button>
                        </div>

                        {/* 2. Contenido que se oculta o muestra */}
                        {mostrarCategorias && (
                            <div>
                                <form onSubmit={handleCrearCategoria} className="d-flex gap-2 mb-3">
                                    <input type="text" className="form-control" placeholder="Nueva..." value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} required />
                                    <button type="submit" className="btn btn-primary">+</button>
                                </form>
                                <ul className="list-group list-group-flush">
                                    {categorias.map(cat => (
                                        <li key={cat.id} className="list-group-item bg-transparent d-flex justify-content-between">
                                            {cat.nombre} 
                                            <span className="material-icons text-danger fs-6" style={{cursor:'pointer'}} onClick={() => eliminarCategoria(cat.id)}>delete</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                    </div>
                 </div>
                            {/* Columna Nuevo Producto */}
                            <div className="col-md-7">
                                <div className="card border-0 shadow-sm rounded-4 p-4">
                                    <h6 className="fw-bold mb-3">Añadir Platillo</h6>
                                    <form onSubmit={handleCrearProducto} className="row g-2">
                                        <div className="col-6">
                                            <select className="form-select" value={nuevoProducto.categoria_id} onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoria_id: e.target.value })} required>
                                                <option value="">Categoría...</option>
                                                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-6"><input type="number" step="0.01" className="form-control" placeholder="Precio" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })} required /></div>
                                        <div className="col-12"><input type="text" className="form-control" placeholder="Nombre del platillo" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} required /></div>
                                        <div className="col-12"><button type="submit" className="btn w-100 text-white fw-bold" style={{ backgroundColor: '#F37A20' }}>Guardar</button></div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {/* DataTable */}
                        <div className="card border-0 shadow-sm rounded-4 mt-4 overflow-hidden">
                            <div className="card-header bg-white p-3 d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold m-0 text-uppercase">Menú</h6>
                                <input type="text" className="form-control w-25" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="ps-4">Platillo</th>
                                            <th>Precio</th>
                                            <th className="text-center">Estado</th>
                                            <th className="text-end pe-4">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productosFiltrados.map(prod => (
                                            <tr key={prod.id}>
                                                <td className="ps-4 fw-bold">{prod.nombre}</td>
                                                <td>${prod.precio}</td>
                                                <td className="text-center">
                                                    <div className="form-check form-switch d-inline-block">
                                                        <input className="form-check-input" type="checkbox" checked={prod.disponible !== false} onChange={() => toggleDisponibilidad(prod)} />
                                                    </div>
                                                </td>
                                                <td className="text-end pe-4">
                                                    <span className="material-icons text-danger" style={{ cursor: 'pointer' }} onClick={() => eliminarProducto(prod.id)}>delete</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODAL PARA NUEVO RESTAURANTE --- */}
            {showModalRest && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow-lg">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="fw-bold" style={{ color: '#F37A20' }}>Nueva Sucursal</h5>
                                <button type="button" className="btn-close" onClick={() => setShowModalRest(false)}></button>
                            </div>
                            <form onSubmit={handleCrearRestaurante}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Nombre del Restaurante</label>
                                        <input type="text" className="form-control bg-light border-0" placeholder="Ej. Tacos WePay" value={nuevoRest.nombre} onChange={(e) => setNuevoRest({ ...nuevoRest, nombre: e.target.value })} required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Dirección Completa</label>
                                        <input type="text" className="form-control bg-light border-0" placeholder="Ej. Av. Reforma 123, CDMX" value={nuevoRest.direccion} onChange={(e) => setNuevoRest({ ...nuevoRest, direccion: e.target.value })} required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Teléfono de Contacto</label>
                                        <input type="text" className="form-control bg-light border-0" placeholder="Ej. 5512345678" value={nuevoRest.telefono} onChange={(e) => setNuevoRest({ ...nuevoRest, telefono: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="modal-footer border-0 pt-0">
                                    <button type="button" className="btn btn-light rounded-pill" onClick={() => setShowModalRest(false)}>Cancelar</button>
                                    <button type="submit" className="btn text-white fw-bold rounded-pill px-4" style={{ backgroundColor: '#F37A20' }}>CREAR RESTAURANTE</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}