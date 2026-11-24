import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLockKeyhole, LucideMail, LucideUserRound } from '@lucide/angular';
import { SesionAutenticacion } from '../../servicios/sesion-autenticacion';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LucideLockKeyhole, LucideMail, LucideUserRound],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private readonly sesion = inject(SesionAutenticacion);

  form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  verPassword = signal(false);
  cargando = signal(false);
  error = signal('');

  /** Valida el formulario, autentica con Firebase y navega solo tras una respuesta válida. */
  async entrar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    const { correo, password } = this.form.getRawValue();

    try {
      await this.sesion.iniciarSesionFirebase(correo.trim(), password);
      await this.router.navigate(['/inicio']);
    } catch (error) {
      this.error.set(this.mensajeErrorAutenticacion(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Traduce errores comunes de Firebase sin revelar si una cuenta está registrada. */
  private mensajeErrorAutenticacion(error: unknown): string {
    const codigo =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : '';
    if (codigo === 'auth/network-request-failed')
      return 'No fue posible conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.';
    if (codigo === 'auth/too-many-requests')
      return 'Se realizaron demasiados intentos. Espera un momento e inténtalo de nuevo.';
    if (
      ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(codigo)
    ) {
      return 'Correo o contraseña incorrectos.';
    }
    return 'No se pudo iniciar sesión. Verifica tus datos e inténtalo de nuevo.';
  }
}
