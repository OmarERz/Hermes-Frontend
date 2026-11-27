import { PENDING } from './inventory.fixtures';
import type { InventoryPending } from './inventory.service';
import { PENDING_PAGE, pendingCount, pendingItemId } from './pending-counts';

const TOTALS: NonNullable<InventoryPending['totals']> = {
  software_without_cpe: 1,
  without_classification: 0,
  without_exposure: 1,
  without_owner: 1,
  without_custodian: 1,
  outside_delivery_model: 0,
};

const full = Array.from({ length: PENDING_PAGE }, (_item, index) => ({
  ci_id: `CI-${index}`,
  name: `ci-${index}`,
  detail: '',
}));

describe('pending counts', () => {
  it('reads a full list without totals as «200+»: there are at least that many', () => {
    expect(pendingCount({ ...PENDING, without_owner: full }, 'without_owner')).toEqual({
      count: PENDING_PAGE,
      atLeast: true,
      countLabel: `${PENDING_PAGE}+`,
      capped: true,
      cappedText: `Se muestran los primeros ${PENDING_PAGE}; puede haber más.`,
    });
    expect(pendingCount(PENDING, 'without_owner')).toEqual({
      count: 1,
      atLeast: false,
      countLabel: '1',
      capped: false,
      cappedText: '',
    });
  });

  it('takes the exact count from the totals and says how much of a cut list it shows', () => {
    expect(pendingCount({ ...PENDING, totals: TOTALS }, 'without_owner')).toEqual({
      count: 1,
      atLeast: false,
      countLabel: '1',
      capped: false,
      cappedText: '',
    });
    expect(
      pendingCount(
        { ...PENDING, without_owner: full, totals: { ...TOTALS, without_owner: 206 } },
        'without_owner',
      ),
    ).toEqual({
      count: 206,
      atLeast: false,
      countLabel: '206',
      capped: true,
      cappedText: `Se muestran los primeros ${PENDING_PAGE} de 206.`,
    });
    // A total below the list never hides an item.
    expect(
      pendingCount({ ...PENDING, totals: { ...TOTALS, without_owner: 0 } }, 'without_owner').count,
    ).toBe(1);
  });

  it('gives the product id of a software item and the CI id of the others', () => {
    const software = { ci_id: 'CI-1', name: 'x', detail: '', software_product_id: 'product' };
    expect(pendingItemId(software, true)).toBe('product');
    expect(pendingItemId(software, false)).toBe('CI-1');
    // Before F18.6 the software carried its product id in `ci_id`.
    expect(pendingItemId({ ci_id: 'CI-1', name: 'x', detail: '' }, true)).toBe('CI-1');
    expect(pendingItemId({ ...software, software_product_id: null }, true)).toBe('CI-1');
  });
});
