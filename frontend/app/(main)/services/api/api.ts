// services/api.ts
// const API_URL = 'http://localhost:3001/api';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

class ApiService {
    private getHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }

    async get(endpoint: string) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: this.getHeaders()
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/auth/login';
            throw new Error('Sessão expirada');
        }
        
        return response.json();
    }

    async post(endpoint: string, data: any) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/auth/login';
            throw new Error('Sessão expirada');
        }

        const json = await response.json();

        if (!response.ok) {
            throw new Error(json?.message || json?.error || 'Erro na requisição');
        }

        return json;
    }

    async put(endpoint: string, data: any) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/auth/login';
            throw new Error('Sessão expirada');
        }
        
        return response.json();
    }

    async delete(endpoint: string) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/auth/login';
            throw new Error('Sessão expirada');
        }
        
        return response.json();
    }
}

export default new ApiService();
