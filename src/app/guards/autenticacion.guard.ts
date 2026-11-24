import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionAutenticacion } from '../servicios/sesion-autenticacion';

/** Espera la restauración de Firebase y permite entrar solo con una sesión reconocida. */
export const autenticacionGuard: CanActivateFn = async () => {
  const sesion = inject(SesionAutenticacion);
  const router = inject(Router);
  const tipo = await sesion.esperarInicializacion();

  return tipo === 'firebase' ? true : router.createUrlTree(['/login']);
};
