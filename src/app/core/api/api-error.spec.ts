import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, NETWORK_ERROR, toApiError } from './api-error';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: 'http://127.0.0.1:8000/api/x' });
}

describe('toApiError', () => {
  it('keeps the code, message and details of the error envelope', () => {
    const error = toApiError(
      httpError(422, {
        error: {
          code: 'validation_error',
          message: 'Los datos enviados no son válidos.',
          details: [{ field: 'body.weights.S', issue: 'less_than_equal' }],
        },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('validation_error');
    expect(error.message).toBe('Los datos enviados no son válidos.');
    expect(error.fieldIssues()).toEqual({ 'body.weights.S': 'less_than_equal' });
  });

  it('drops malformed details instead of trusting them', () => {
    const error = toApiError(
      httpError(400, {
        error: {
          code: 'invalid_cursor',
          message: 'El cursor no es válido.',
          details: [
            { field: 1 },
            'x',
            { field: 'query.cursor', issue: 'invalid', value: 'secret' },
          ],
        },
      }),
    );
    expect(error.details).toEqual([{ field: 'query.cursor', issue: 'invalid' }]);
  });

  it.each([
    [0, NETWORK_ERROR, 'No se pudo conectar con el servidor.'],
    [401, 'unauthorized', 'Tu sesión expiró.'],
    [403, 'forbidden', 'No tienes permiso'],
    [409, 'conflict', 'Alguien más cambió estos datos.'],
    [429, 'too_many_requests', 'Demasiadas solicitudes'],
    [502, 'internal_error', 'Ocurrió un error en el servidor.'],
    [418, 'unknown_error', 'Ocurrió un error inesperado.'],
  ])('falls back to a Spanish message for status %i without an envelope', (status, code, text) => {
    const error = toApiError(httpError(status, '<html>proxy error</html>'));
    expect(error.code).toBe(code);
    expect(error.message).toContain(text);
    expect(error.details).toEqual([]);
  });

  it('wraps anything else as an unknown error and passes ApiError through', () => {
    expect(toApiError(new Error('boom')).code).toBe('unknown_error');
    const original = new ApiError(404, 'not_found', 'No existe.');
    expect(toApiError(original)).toBe(original);
  });
});
