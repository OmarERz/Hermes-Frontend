import { HttpErrorResponse } from '@angular/common/http';

/** One problem of a request: where it is and which rule failed (the backend never echoes the value). */
export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/**
 * An API failure, from the error envelope `{"error": {"code", "message", "details"}}` (FRONTEND.md §4).
 * `code` is stable and drives the behaviour; `message` is for the person, in Spanish, shown as is.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The `issue` of each field, for forms: `{"body.weights.S": "less_than_equal"}`. */
  fieldIssues(): Record<string, string> {
    return Object.fromEntries(this.details.map((detail) => [detail.field, detail.issue]));
  }
}

/** Code used when the request never reached the API (offline, DNS, CORS). */
export const NETWORK_ERROR = 'network_error';

const MESSAGES_BY_STATUS: Record<number, [code: string, message: string]> = {
  0: [
    NETWORK_ERROR,
    'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  ],
  400: ['bad_request', 'La solicitud no es válida.'],
  401: ['unauthorized', 'Tu sesión expiró. Inicia sesión de nuevo.'],
  403: ['forbidden', 'No tienes permiso para realizar esta acción.'],
  404: ['not_found', 'El recurso solicitado no existe.'],
  409: ['conflict', 'Alguien más cambió estos datos. Recarga para ver la versión actual.'],
  413: ['payload_too_large', 'La solicitud es demasiado grande.'],
  422: ['validation_error', 'Los datos enviados no son válidos.'],
  429: ['too_many_requests', 'Demasiadas solicitudes; intenta de nuevo en un momento.'],
  503: ['service_unavailable', 'El servicio no está disponible por ahora; intenta más tarde.'],
};
const SERVER_ERROR: [string, string] = [
  'internal_error',
  'Ocurrió un error en el servidor. Intenta de nuevo más tarde.',
];
const UNKNOWN_ERROR: [string, string] = ['unknown_error', 'Ocurrió un error inesperado.'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function envelope(
  body: unknown,
): { code: string; message: string; details: ApiErrorDetail[] } | null {
  if (!isRecord(body) || !isRecord(body['error'])) return null;
  const { code, message, details } = body['error'];
  if (typeof code !== 'string' || !code || typeof message !== 'string' || !message) return null;
  const valid = Array.isArray(details)
    ? details.filter(
        (item): item is ApiErrorDetail =>
          isRecord(item) && typeof item['field'] === 'string' && typeof item['issue'] === 'string',
      )
    : [];
  return { code, message, details: valid.map(({ field, issue }) => ({ field, issue })) };
}

/** Maps any failure of an API call to an ApiError with a Spanish message. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(-1, UNKNOWN_ERROR[0], UNKNOWN_ERROR[1]);
  }
  const fromBody = envelope(error.error);
  if (fromBody)
    return new ApiError(error.status, fromBody.code, fromBody.message, fromBody.details);
  const [code, message] =
    MESSAGES_BY_STATUS[error.status] ?? (error.status >= 500 ? SERVER_ERROR : UNKNOWN_ERROR);
  return new ApiError(error.status, code, message);
}
