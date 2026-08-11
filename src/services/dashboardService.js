// frontend/src/services/dashboardService.js
import ApiService from './api';

class DashboardService {
  static async obtenerDashboardCoordinador() {
    try {
      const response = await ApiService.getDashboardCoordinador();
      return response.data;
    } catch (error) {
      console.error('Error obteniendo dashboard coordinador:', error);
      throw error;
    }
  }

  static async obtenerMetricasGlobales(periodo = 'mes') {
    try {
      const response = await ApiService.getMetricasGlobales(periodo);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo métricas globales:', error);
      throw error;
    }
  }

  static async obtenerEstadisticas() {
    try {
      const response = await ApiService.getEstadisticas();
      return response.data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  // Método para transformar los datos del backend al formato que usa el frontend
  static transformarDatosCoordinador(datosBackend) {
    const { estadisticas, top_psicologos, alertas, evolucion_mensual, citas_por_dia } = datosBackend;
    
    // Transformar estadísticas principales
    const estadisticasTransformadas = {
      becariosActivos: estadisticas.becarios_activos || 0,
      psicologosActivos: estadisticas.psicologos_activos || 0,
      pacientesActivos: estadisticas.pacientes_activos || 0,
      citasHoy: estadisticas.citas_hoy || 0,
      citasCompletadasHoy: estadisticas.citas_completadas_hoy || 0,
      altasMesActual: estadisticas.altas_mes || 0
    };

    // Transformar actividad reciente (puedes obtener esto de otra fuente o simularlo)
    const actividadReciente = this.generarActividadReciente(datosBackend);

    // Transformar distribución de citas por psicólogo
    const distribucionPsicologos = top_psicologos.map(psicologo => ({
      nombre: psicologo.nombre_completo,
      citas: psicologo.total_citas || 0,
      color: this.asignarColor(psicologo.id)
    }));

    // Transformar alertas
    const alertasTransformadas = alertas.map(alerta => ({
      tipo: alerta.tipo,
      descripcion: alerta.descripcion,
      cantidad: alerta.cantidad
    }));

    return {
      estadisticas: estadisticasTransformadas,
      actividadReciente,
      distribucionPsicologos,
      alertas: alertasTransformadas,
      evolucionMensual: evolucion_mensual,
      citasPorDia: citas_por_dia
    };
  }

  static asignarColor(id) {
    const colores = ['var(--grnb)', 'var(--blu)', 'var(--yy)', 'var(--grnd)', 'var(--grnl)', 'var(--rr)'];
    return colores[id % colores.length];
  }

  static generarActividadReciente(datosBackend) {
    // Aquí puedes implementar lógica para generar actividad reciente
    // basada en los datos del backend, logs, o mantenerlo simulado
    // por ahora devolveré datos de ejemplo transformados
    const actividades = [];
    
    // Ejemplo: si hay nuevas altas hoy
    if (datosBackend.estadisticas.altas_hoy > 0) {
      actividades.push({
        id: 1,
        tipo: 'alta_paciente',
        descripcion: `${datosBackend.estadisticas.altas_hoy} paciente(s) dado(s) de alta hoy`,
        fecha: new Date().toISOString(),
        usuario: 'Sistema'
      });
    }

    // Ejemplo: si hay pacientes nuevos hoy
    if (datosBackend.estadisticas.pacientes_nuevos_hoy > 0) {
      actividades.push({
        id: 2,
        tipo: 'nuevo_paciente',
        descripcion: `${datosBackend.estadisticas.pacientes_nuevos_hoy} nuevo(s) paciente(s) registrado(s) hoy`,
        fecha: new Date().toISOString(),
        usuario: 'Sistema'
      });
    }

    return actividades.length > 0 ? actividades : [
      {
        id: 1,
        tipo: 'sistema',
        descripcion: 'Dashboard sincronizado con datos reales',
        fecha: new Date().toISOString(),
        usuario: 'Sistema'
      }
    ];
  }
}

export default DashboardService;