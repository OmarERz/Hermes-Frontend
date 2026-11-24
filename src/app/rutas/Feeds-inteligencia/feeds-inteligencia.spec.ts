import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FeedsInteligencia } from './feeds-inteligencia';
import { FeedInteligencia, FeedsInteligenciaServicio } from '../../servicios/feeds-inteligencia';

describe('FeedsInteligencia carrusel', () => {
  let fixture: ComponentFixture<FeedsInteligencia>;
  let feeds: ReturnType<typeof signal<FeedInteligencia[]>>;

  beforeEach(async () => {
    feeds = signal<FeedInteligencia[]>([
      {
        id: 'otx',
        nombre: 'AlienVault OTX',
        tipo: 'Amenazas',
        descripcion: 'Amenazas de ejemplo',
        proveedor: 'OTX',
        activo: true,
        frecuenciaActualizacion: null,
        ultimaSincronizacion: null,
        estadoSincronizacion: null,
        cobertura: null,
        severidad: null,
      },
      {
        id: 'abuse',
        nombre: 'AbuseIPDB',
        tipo: 'Amenazas',
        descripcion: 'Amenazas de ejemplo',
        proveedor: 'AbuseIPDB',
        activo: true,
        frecuenciaActualizacion: null,
        ultimaSincronizacion: null,
        estadoSincronizacion: null,
        cobertura: null,
        severidad: null,
      },
      {
        id: 'misp',
        nombre: 'MISP',
        tipo: 'Amenazas',
        descripcion: 'Amenazas de ejemplo',
        proveedor: 'MISP',
        activo: false,
        frecuenciaActualizacion: null,
        ultimaSincronizacion: null,
        estadoSincronizacion: null,
        cobertura: null,
        severidad: null,
      },
      {
        id: 'cisa',
        nombre: 'CISA KEV',
        tipo: 'Vulnerabilidades',
        descripcion: 'Vulnerabilidades de ejemplo',
        proveedor: 'CISA',
        activo: true,
        frecuenciaActualizacion: null,
        ultimaSincronizacion: null,
        estadoSincronizacion: null,
        cobertura: null,
        severidad: null,
      },
    ]);
    await TestBed.configureTestingModule({
      imports: [FeedsInteligencia],
      providers: [
        {
          provide: FeedsInteligenciaServicio,
          useValue: {
            feeds,
            modo: signal<'demo' | 'real'>('demo'),
            integracionPendiente: signal(false),
            cambiarEstadoDemo: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FeedsInteligencia);
    fixture.detectChanges();
  });

  it('no captura el puntero al pulsar y deja que la tarjeta lateral seleccione el feed', () => {
    const section = fixture.nativeElement.querySelector('.carousel-section') as HTMLElement;
    const captura = vi.fn();
    Object.defineProperty(section, 'setPointerCapture', { configurable: true, value: captura });
    const pointerDown = new Event('pointerdown', { bubbles: true });
    Object.assign(pointerDown, { pointerId: 7, clientX: 120 });
    section.querySelector('.feed-card-select')?.dispatchEvent(pointerDown);

    expect(captura).not.toHaveBeenCalled();
    const abuseCard = [...fixture.nativeElement.querySelectorAll('.feed-card-select')].find(
      (button) => button.textContent?.includes('AbuseIPDB'),
    ) as HTMLButtonElement;
    abuseCard.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('abuse');
    expect(fixture.nativeElement.querySelector('#feed-details-title')?.textContent).toContain(
      'AbuseIPDB',
    );
  });

  it('selecciona vecinos laterales sin cambiar su estado de activación', () => {
    const mispCard = [...fixture.nativeElement.querySelectorAll('.feed-card-select')].find(
      (button) => button.textContent?.includes('MISP'),
    ) as HTMLButtonElement;
    mispCard.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('misp');
    expect(fixture.componentInstance.servicio.cambiarEstadoDemo).not.toHaveBeenCalled();
  });

  it('conserva navegación circular y filtros para listas dinámicas', () => {
    const mispCard = [...fixture.nativeElement.querySelectorAll('.feed-card-select')].find(
      (button) => button.textContent?.includes('MISP'),
    ) as HTMLButtonElement;
    mispCard.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('misp');
    fixture.componentInstance.seleccionarCategoria('Amenazas');
    fixture.detectChanges();
    const abuseCard = [...fixture.nativeElement.querySelectorAll('.feed-card-select')].find(
      (button) => button.textContent?.includes('AbuseIPDB'),
    ) as HTMLButtonElement;
    abuseCard.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('abuse');
    const wrapToFirst = [...fixture.nativeElement.querySelectorAll('.feed-card-select')].find(
      (button) => button.textContent?.includes('MISP'),
    ) as HTMLButtonElement;
    wrapToFirst.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('misp');
    const returnToFirst = [...fixture.nativeElement.querySelectorAll('.feed-card-select')].find(
      (button) => button.textContent?.includes('AlienVault OTX'),
    ) as HTMLButtonElement;
    returnToFirst.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('otx');
    fixture.componentInstance.seleccionarCategoria('Vulnerabilidades');
    fixture.detectChanges();
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('cisa');
  });

  it('permite activar el switch sin seleccionar otra tarjeta', () => {
    const toggle = fixture.nativeElement.querySelector('.feed-toggle input') as HTMLInputElement;
    toggle.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe('otx');
    expect(fixture.componentInstance.servicio.cambiarEstadoDemo).toHaveBeenCalledWith('misp', true);
  });

  it('maneja listas vacías, de un feed y de dos feeds sin duplicar tarjetas', () => {
    const feedsOriginales = feeds();
    feeds.set([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.tarjetasCarrusel()).toHaveLength(0);
    expect(fixture.componentInstance.feedSeleccionado()).toBeNull();

    fixture.componentInstance.seleccionarCategoria('Vulnerabilidades');
    feeds.set([feedsOriginales[3]]);
    fixture.detectChanges();
    expect(fixture.componentInstance.tarjetasCarrusel().map((tarjeta) => tarjeta.feed.id)).toEqual([
      'cisa',
    ]);

    fixture.componentInstance.seleccionarCategoria('Amenazas');
    feeds.set([feedsOriginales[0], feedsOriginales[2]]);
    fixture.detectChanges();
    const ids = fixture.componentInstance.tarjetasCarrusel().map((tarjeta) => tarjeta.feed.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    fixture.componentInstance.mover(1);
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe(ids[1]);
    fixture.componentInstance.mover(1);
    expect(fixture.componentInstance.feedSeleccionado()?.id).toBe(ids[0]);
  });
});
