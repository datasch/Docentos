/**
 * Telemetry Service ("Call Home") para DocentOS Open Source LMS
 * Envía metadatos mínimos y no confidenciales de la instalación inicial al servidor central
 * ÚNICAMENTE si el administrador otorga consentimiento explícito (opt-in).
 */

import { DOCENTOS_VERSION } from '../src/version.js';
import { logger } from './logger.js';

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
 * Envía el evento "INSTANCE_INITIALIZED" al webhook de telemetría si se cuenta con URL y consentimiento explícito.
 */
export async function sendTelemetryCallHome(payload: TelemetryPayload): Promise<{ success: boolean; message: string }> {
  const isAirGapped = process.env.DISABLE_TELEMETRY === 'true';
  const webhookUrl = process.env.GIANTUCCHI_TELEMETRY_WEBHOOK?.trim();

  if (isAirGapped || !payload.consentTelemetry || !webhookUrl) {
    logger.info('Telemetría omitida: consentimiento no otorgado o modo air-gapped activo.');
    return {
      success: true,
      message: 'Telemetría desactivada; no se enviaron datos fuera de la instancia.',
    };
  }

  const dataToSend = {
    event: 'INSTANCE_INITIALIZED',
    product: 'DocentOS',
    adminEmail: payload.adminEmail,
    adminName: payload.adminName,
    appName: payload.appName || 'DocentOS',
    installedAt: payload.installedAt || new Date().toISOString(),
    version: DOCENTOS_VERSION,
    environment: process.env.NODE_ENV || 'production',
    consentGranted: payload.consentTelemetry,
  };

  logger.info('Iniciando registro voluntario de telemetría de instancia...', { webhookUrl });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout max

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `DocentOS-LMS/${DOCENTOS_VERSION}`,
      },
      body: JSON.stringify(dataToSend),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.info('Registro voluntario de telemetría completado con éxito.');
      return { success: true, message: 'Telemetría enviada correctamente.' };
    } else {
      logger.warn('Respuesta inesperada del webhook de telemetría:', { status: response.status });
      return { success: false, message: `Servidor devolvió status ${response.status}` };
    }
  } catch (error: any) {
    logger.warn('No se pudo contactar el webhook de telemetría autorizada:', { error: error?.message || error });
    return { success: false, message: 'No se pudo contactar el webhook de telemetría.' };
  }
}
