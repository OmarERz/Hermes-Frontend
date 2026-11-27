import { KERNEL, OPENSSL } from './inventory.fixtures';
import { catalogueTotals, chartHasData, softwareChart } from './software-charts';

interface BarOption {
  xAxis: { data: string[] };
  series: { data: { value: number }[] }[];
}
interface PieOption {
  series: { data: { name: string; value: number }[] }[];
}

describe('software charts', () => {
  it('adds up installations by category, status and licence, and products by level and CPE', () => {
    const totals = catalogueTotals([OPENSSL, KERNEL]);
    expect(totals.products).toBe(2);
    expect(totals.instances).toBe(4);
    expect(totals.byCategory).toEqual({
      DBServer: 0,
      Middleware: 0,
      OtherSoftware: 2,
      PCSoftware: 0,
      WebServer: 1,
    });
    expect(totals.withoutCategory).toBe(1);
    expect(totals.byStatus).toEqual({ active: 1, inactive: 1, unknown: 2 });
    expect(totals.byLevel).toEqual({ critical: 1, high: 0, medium: 0, low: 0, none: 1 });
    expect(totals.withCpe).toBe(1);
    expect(totals.licensedInstances).toBe(1);
    expect(totals.licences).toEqual([
      {
        key: expect.any(String),
        product: 'OpenSSL',
        name: 'Soporte OpenSSL',
        usageLimit: '10 servidores',
        validity: expect.stringMatching(/^Del /),
        instances: 1,
      },
    ]);
  });

  it('reads products without the optional aggregates as zeros', () => {
    const bare = { ...KERNEL, by_category: undefined, by_status: undefined, licences: undefined };
    const totals = catalogueTotals([bare]);
    expect(totals.byStatus).toEqual({ active: 0, inactive: 0, unknown: 0 });
    expect(totals.withoutCategory).toBe(1);
    expect(totals.licensedInstances).toBe(0);
  });

  it('draws installations by category, with the ones still without one', () => {
    const option = softwareChart(
      'category',
      catalogueTotals([OPENSSL, KERNEL]),
    ) as unknown as BarOption;
    expect(option.xAxis.data).toEqual([
      'Servidor de base de datos',
      'Middleware',
      'Otro software',
      'Software de PC',
      'Servidor web',
      'Sin categoría',
    ]);
    expect(option.series[0]!.data.map((point) => point.value)).toEqual([0, 0, 2, 0, 1, 1]);
    const categorized = softwareChart(
      'category',
      catalogueTotals([OPENSSL]),
    ) as unknown as BarOption;
    expect(categorized.xAxis.data).not.toContain('Sin categoría');
  });

  it('draws products by worst level and with or without a CPE', () => {
    const totals = catalogueTotals([OPENSSL, KERNEL]);
    const levels = softwareChart('level', totals) as unknown as BarOption;
    expect(levels.xAxis.data).toEqual(['Crítica', 'Alta', 'Media', 'Baja', 'Sin vulnerabilidades']);
    expect(levels.series[0]!.data.map((point) => point.value)).toEqual([1, 0, 0, 0, 1]);
    const cpe = softwareChart('cpe', totals) as unknown as PieOption;
    expect(cpe.series[0]!.data.map(({ name, value }) => [name, value])).toEqual([
      ['Con CPE', 1],
      ['Sin CPE', 1],
    ]);
  });

  it('knows when there is nothing to draw', () => {
    const empty = catalogueTotals([]);
    expect(chartHasData('category', empty)).toBe(false);
    expect(chartHasData('cpe', empty)).toBe(false);
    expect(chartHasData('level', catalogueTotals([KERNEL]))).toBe(true);
  });
});
