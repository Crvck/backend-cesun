const API_BASE_URL = 'http://localhost:3000/api';

class ApiService {
  static getToken() {
    return localStorage.getItem('token');
  }

  static getHeaders() {
    const token = this.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async get(url) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  static async post(url, data) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  static async put(url, data) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  static async delete(url) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  static async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error en la petición');
    }
    return response.json();
  }
  static async getDashboardCoordinador() {
    return this.get('/dashboard/coordinador');
  }

  static async getMetricasGlobales(periodo = 'mes') {
    return this.get(`/dashboard/metricas-globales?periodo=${periodo}`);
  }

  static async getEstadisticas() {
    return this.get('/estadisticas/generales');
  }
}

export default ApiService;