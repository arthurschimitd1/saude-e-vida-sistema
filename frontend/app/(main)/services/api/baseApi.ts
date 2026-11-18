// frontend/app/(main)/services/api/baseApi.ts
import axios from 'axios';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

// Interceptor de request: injeta o JWT e o header de empresa (MASTER) em toda requisição
const attachToken = (config: any) => {
    if (typeof window !== 'undefined') {
        const isAuthRequest = typeof config.url === 'string' && config.url.includes('/auth/login');
        const token = localStorage.getItem('token');
        if (token && !isAuthRequest) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // MASTER pode escolher a empresa pela topbar — backend lê esse header
        // Apenas usuários MASTER podem enviar esse header
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const isMaster = user?.tipo === 'MASTER' || user?.email === 'admin@master.com';
        const empresaSelected = localStorage.getItem('empresa_selecionada');
        if (!isAuthRequest && isMaster && empresaSelected && !isNaN(Number(empresaSelected))) {
            config.headers['X-Empresa-Override'] = empresaSelected;
        }
    }
    return config;
};

// Interceptor de response: padroniza erros e desloga se token inválido
const handleError = (error: any) => {
    if (error.response) {
        const skipRedirect = error.config?.skipAuthInterceptor === true
            || error.config?.url?.includes('/auth/login')
            || error.config?.url?.includes('/auth/verificar-senha');
        if (error.response.status === 401 && !skipRedirect && typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.includes('/auth/login')) {
                window.location.href = '/auth/login';
            }
        }
        const data = error.response.data;
        let message = 'Erro na requisição';
        if (typeof data?.message === 'string') message = data.message;
        else if (typeof data?.error === 'string') message = data.error;
        else if (typeof data?.error?.message === 'string') message = data.error.message;
        else if (Array.isArray(data?.errors) && data.errors.length > 0) {
            // formato express-validator: [{ campo: 'mensagem' }]
            message = data.errors.map((e: any) => Object.values(e)[0]).join(', ');
        }
        return Promise.reject({
            message,
            status: error.response.status
        });
    }
    return Promise.reject(error);
};

// API principal - usando URL dinâmica
const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});
api.interceptors.request.use(attachToken);
api.interceptors.response.use((r) => r, handleError);

// APIs específicas - também usando URL dinâmica
export const productsApi = axios.create({
    baseURL: `${API_URL}/products`,
    headers: { 'Content-Type': 'application/json' }
});
productsApi.interceptors.request.use(attachToken);
productsApi.interceptors.response.use((r) => r, handleError);

export const usersApi = axios.create({
    baseURL: `${API_URL}/users`,
    headers: { 'Content-Type': 'application/json' }
});
usersApi.interceptors.request.use(attachToken);
usersApi.interceptors.response.use((r) => r, handleError);

export default api;
