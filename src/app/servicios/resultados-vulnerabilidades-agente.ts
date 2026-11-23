import { Injectable, signal } from '@angular/core';

export type PrioridadVulnerabilidad = 'critical' | 'high' | 'medium' | 'low';
export type EstadoExplotacionConocida = 'known' | 'not-known' | 'unknown';

export interface HallazgoVulnerabilidadActivo {
  findingId: string;
  assetId: string;
  technologyId: string | null;
  assetCriticality: string | null;
  priority: PrioridadVulnerabilidad;
}

/** Contrato propuesto: una entrada única por vulnerabilityId y hallazgos separados por activo. */
export interface VulnerabilidadClasificada {
  vulnerabilityId: string;
  cveId: string | null;
  priority: PrioridadVulnerabilidad;
  analysisId: string;
  justification: string;
  technicalSeverity: {
    cvssScore: number | null;
    cvssVersion: string | null;
    source: string | null;
  };
  knownExploitation: {
    status: EstadoExplotacionConocida;
    source: string | null;
    checkedAt: string | null;
  };
  findings: HallazgoVulnerabilidadActivo[];
}

export interface ResultadoAgenteVulnerabilidades {
  resultId: string;
  generatedAt: string;
  vulnerabilities: VulnerabilidadClasificada[];
}

/** Almacén de resultados del agente. El adaptador HTTP queda pendiente del contrato del backend. */
@Injectable({ providedIn: 'root' })
export class ResultadosVulnerabilidadesAgente {
  private readonly resultadoActual = signal<ResultadoAgenteVulnerabilidades | null>(null);
  readonly resultado = this.resultadoActual.asReadonly();

  recibir(resultado: ResultadoAgenteVulnerabilidades): void {
    this.resultadoActual.set(resultado);
  }

  limpiar(): void {
    this.resultadoActual.set(null);
  }
}
