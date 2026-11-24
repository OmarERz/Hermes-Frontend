import { Component, computed, inject, signal } from '@angular/core';
import {
  LucideCircleCheck,
  LucideCirclePause,
  LucideLayers,
  LucideRefreshCw,
  LucideRss,
  LucideShield,
  LucideSignal,
} from '@lucide/angular';
import {
  FeedInteligencia,
  FeedsInteligenciaServicio,
  TipoFeedInteligencia,
} from '../../servicios/feeds-inteligencia';

@Component({
  selector: 'app-feeds-inteligencia',
  imports: [
    LucideCircleCheck,
    LucideCirclePause,
    LucideLayers,
    LucideRefreshCw,
    LucideRss,
    LucideShield,
    LucideSignal,
  ],
  templateUrl: './feeds-inteligencia.html',
})
export class FeedsInteligencia {
  readonly servicio = inject(FeedsInteligenciaServicio);
  readonly categoria = signal<TipoFeedInteligencia>('Amenazas');
  private readonly indiceCarrusel = signal(0);
  private readonly feedSeleccionadoId = signal<string | null>(null);
  readonly feedsFiltrados = computed(() =>
    this.servicio.feeds().filter((feed) => feed.tipo === this.categoria()),
  );
  readonly totalFeeds = computed(() =>
    this.servicio.integracionPendiente() ? null : this.servicio.feeds().length,
  );
  readonly totalActivos = computed(() =>
    this.servicio.integracionPendiente()
      ? null
      : this.servicio.feeds().filter((feed) => feed.activo).length,
  );
  readonly totalInactivos = computed(() =>
    this.servicio.integracionPendiente()
      ? null
      : this.servicio.feeds().filter((feed) => !feed.activo).length,
  );
  readonly totalSincronizados24h = computed(() => {
    const feeds = this.servicio.feeds();
    const sincronizaciones = feeds.map((feed) =>
      feed.ultimaSincronizacion ? Date.parse(feed.ultimaSincronizacion) : Number.NaN,
    );
    if (
      this.servicio.integracionPendiente() ||
      !feeds.length ||
      sincronizaciones.some((fecha) => !Number.isFinite(fecha))
    )
      return null;
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    return sincronizaciones.filter((fecha) => fecha >= limite).length;
  });
  readonly amenazas = computed(() =>
    this.servicio.integracionPendiente()
      ? null
      : this.servicio.feeds().filter((feed) => feed.tipo === 'Amenazas').length,
  );
  readonly vulnerabilidades = computed(() =>
    this.servicio.integracionPendiente()
      ? null
      : this.servicio.feeds().filter((feed) => feed.tipo === 'Vulnerabilidades').length,
  );
  readonly indiceSeleccionado = computed(() => {
    const feeds = this.feedsFiltrados();
    const cantidad = feeds.length;
    if (!cantidad) return 0;
    const indiceId = feeds.findIndex((feed) => feed.id === this.feedSeleccionadoId());
    if (indiceId >= 0) return indiceId;
    return ((this.indiceCarrusel() % cantidad) + cantidad) % cantidad;
  });
  readonly feedSeleccionado = computed(
    () => this.feedsFiltrados()[this.indiceSeleccionado()] ?? null,
  );
  readonly posiciones = computed(() => {
    const cantidad = this.feedsFiltrados().length;
    if (cantidad === 0) return [];
    if (cantidad === 1) return [0];
    // Con dos feeds mostramos solo un vecino para no duplicar la misma tarjeta a ambos lados.
    if (cantidad === 2) return [0, 1];
    const radio = Math.min(2, Math.floor((cantidad - 1) / 2));
    return Array.from({ length: radio * 2 + 1 }, (_, indice) => indice - radio);
  });
  readonly tarjetasCarrusel = computed(() => {
    const feeds = this.feedsFiltrados();
    if (!feeds.length) return [];
    return this.posiciones().map((posicion) => {
      const indiceVirtual = this.indiceCarrusel() + posicion;
      const indiceFeed = (this.indiceSeleccionado() + posicion + feeds.length) % feeds.length;
      return { indiceVirtual, posicion, feed: feeds[indiceFeed] };
    });
  });
  private pointerInicial: { id: number; x: number } | null = null;
  private bloquearSeleccionHasta = 0;

  /** Selecciona una categoría y centra su primer feed si existe. */
  seleccionarCategoria(tipo: TipoFeedInteligencia): void {
    this.categoria.set(tipo);
    this.indiceCarrusel.set(0);
    this.feedSeleccionadoId.set(
      this.servicio.feeds().find((feed) => feed.tipo === tipo)?.id ?? null,
    );
  }

  /** Centra el feed pulsado conservando su identidad y el desplazamiento visual del carrusel. */
  seleccionarPosicion(feedId: string, indiceVirtual: number): void {
    if (Date.now() < this.bloquearSeleccionHasta) return;
    if (!this.feedsFiltrados().some((feed) => feed.id === feedId)) return;
    this.feedSeleccionadoId.set(feedId);
    this.indiceCarrusel.set(indiceVirtual);
  }

  /** Avanza o retrocede una posición y conecta ambos extremos del carrusel. */
  mover(direccion: -1 | 1): void {
    const feeds = this.feedsFiltrados();
    if (!feeds.length) return;
    const siguienteIndice = (this.indiceSeleccionado() + direccion + feeds.length) % feeds.length;
    this.feedSeleccionadoId.set(feeds[siguienteIndice].id);
    this.indiceCarrusel.update((indice) => indice + direccion);
  }

  /** Alterna solo el feed indicado y delega al servicio, que lo bloquea mientras falte la integración. */
  alternarFeed(feed: FeedInteligencia, evento: Event): void {
    evento.stopPropagation();
    this.servicio.cambiarEstado(feed.id, !feed.activo);
  }

  /** Registra el inicio del gesto sin capturar el puntero para preservar el clic de las tarjetas. */
  iniciarArrastre(evento: PointerEvent): void {
    if (evento.target instanceof Element && evento.target.closest('.feed-toggle')) return;
    this.pointerInicial = { id: evento.pointerId, x: evento.clientX };
  }

  /** Captura el puntero solo cuando el movimiento ya confirma un arrastre horizontal. */
  actualizarArrastre(evento: PointerEvent): void {
    if (!this.pointerInicial || this.pointerInicial.id !== evento.pointerId) return;
    if (Math.abs(evento.clientX - this.pointerInicial.x) < 45) return;
    const contenedor = evento.currentTarget as HTMLElement;
    if (!contenedor.hasPointerCapture(evento.pointerId))
      contenedor.setPointerCapture(evento.pointerId);
  }

  /** Cambia la selección al terminar un arrastre horizontal válido. */
  finalizarArrastre(evento: PointerEvent): void {
    if (!this.pointerInicial || this.pointerInicial.id !== evento.pointerId) return;
    const diferencia = evento.clientX - this.pointerInicial.x;
    this.pointerInicial = null;
    if (Math.abs(diferencia) < 45) return;
    this.bloquearSeleccionHasta = Date.now() + 350;
    this.mover(diferencia > 0 ? -1 : 1);
  }

  /** Permite avanzar con gestos horizontales del trackpad sin afectar la página vertical. */
  desplazarConRueda(evento: WheelEvent): void {
    if (Math.abs(evento.deltaX) < 18 || Math.abs(evento.deltaX) < Math.abs(evento.deltaY)) return;
    evento.preventDefault();
    this.mover(evento.deltaX > 0 ? 1 : -1);
  }
}
