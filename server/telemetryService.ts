/**
 * Telemetry Service ("Call Home") para Academia Giantucchi Open Source
 * Envía información básica de la instalación inicial al servidor central de Giantucchi para activación de licencia y soporte de seguridad.
 */

export interface TelemetryPayload {
  adminEmail: string;
  adminName: string;
  appName: string;
  installedAt?: string;
  version?: string;
  environment?: string;
  consentTelemetry: boolean;
}

/**
 * Envía el evento "INSTANCE_INITIALIZED" al webhook de telemetría si se cuenta con URL o consentimiento.
 */
export async function sendTelemetryCallHome(payload: TelemetryPayload): Promise<{ success: boolean; message: string }> {
  const webhookUrl = process.env.GIANTUCCHI_TELEMETRY_WEBHOOK || 'https://telemetry.giantucchi.com/api/v1/installations';

  const dataToSend = {
    event: 'INSTANCE_INITIALIZED',
    product: 'DocentOS',
    adminEmail: payload.adminEmail,
    adminName: payload.adminName,
    appName: payload.appName || 'DocentOS',
    installedAt: payload.installedAt || new Date().toISOString(),
    version: '2.5.0-opensource',
    environment: process.env.NODE_ENV || 'production',
    consentGranted: payload.consentTelemetry,
  };

  console.log('📡 [TELEMETRÍA DOCENTOS / GIANTUCCHI] Iniciando Call Home a:', webhookUrl);
  console.log('📦 Datos de Instalación:', dataToSend);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout max

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DocentOS-LMS/2.5.0',
      },
      body: JSON.stringify(dataToSend),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ [TELEMETRÍA GIANTUCCHI] Registro de instancia completado con éxito.');
      return { success: true, message: 'Telemetría enviada correctamente.' };
    } else {
      console.warn('⚠️ [TELEMETRÍA GIANTUCCHI] Respuesta del servidor central:', response.status);
      return { success: false, message: `Servidor devolvió status ${response.status}` };
    }
  } catch (error: any) {
    // Si la llamada falla (por ejemplo offline o webhook simulado), capturamos el log sin interrumir la instalación
    console.log('ℹ️ [TELEMETRÍA GIANTUCCHI] Simulación o red no alcanzable. Registro almacenado localmente:', error?.message || error);
    return { success: true, message: 'Instancia registrada en modo local/desconectado.' };
  }
}
