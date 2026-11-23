import { Injectable, inject, signal } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type TipoSesion = 'verificando' | 'firebase' | 'sin-sesion';

/** Centraliza el estado autenticado y la sesión persistida por Firebase Authentication. */
@Injectable({ providedIn: 'root' })
export class SesionAutenticacion {
  private readonly auth = inject(Auth);
  private resolverInicializacion!: () => void;
  private readonly inicializacion = new Promise<void>(resolve => {
    this.resolverInicializacion = resolve;
  });

  readonly tipo = signal<TipoSesion>('verificando');
  readonly usuarioFirebase = signal<User | null>(null);

  constructor() {
    authState(this.auth).pipe(takeUntilDestroyed()).subscribe({
      next: usuario => {
        this.usuarioFirebase.set(usuario);
        this.tipo.set(usuario ? 'firebase' : 'sin-sesion');
        this.resolverInicializacion();
      },
      error: () => {
        if (this.tipo() === 'verificando') this.tipo.set('sin-sesion');
        this.resolverInicializacion();
      }
    });
  }

  /** Espera a que Firebase restaure la sesión persistida antes de autorizar una ruta. */
  async esperarInicializacion(): Promise<TipoSesion> {
    await this.inicializacion;
    return this.tipo();
  }

  /** Autentica una cuenta real usando exclusivamente Firebase Authentication. */
  async iniciarSesionFirebase(correo: string, contrasena: string): Promise<void> {
    await this.esperarInicializacion();
    const credencial = await signInWithEmailAndPassword(this.auth, correo, contrasena);
    this.usuarioFirebase.set(credencial.user);
    this.tipo.set('firebase');
  }

  /** Cierra la sesión exclusivamente mediante Firebase Authentication. */
  async cerrarSesion(): Promise<void> {
    await this.esperarInicializacion();
    await signOut(this.auth);
    this.usuarioFirebase.set(null);
    this.tipo.set('sin-sesion');
  }
}
