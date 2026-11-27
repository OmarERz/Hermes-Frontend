import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { auditActionLabel, KNOWN_AUDIT_ACTIONS } from './audit-labels';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(AuditService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the audit trail with the filters and the cursor as received', async () => {
    const result = firstValueFrom(
      service.list(
        {
          actor: 'sistema',
          action: 'source.enable',
          date_from: null,
          date_to: '2026-11-21T05:59:59.999Z',
        },
        'a.b',
        50,
      ),
    );
    const request = backend.expectOne((req) => req.url === 'http://127.0.0.1:8000/api/audit');
    expect(request.request.params.get('actor')).toBe('sistema');
    expect(request.request.params.get('action')).toBe('source.enable');
    expect(request.request.params.has('date_from')).toBe(false);
    expect(request.request.params.get('date_to')).toBe('2026-11-21T05:59:59.999Z');
    expect(request.request.params.get('cursor')).toBe('a.b');
    request.flush({ items: [{ id: 'e1' }], next_cursor: 'c.d' });
    await expect(result).resolves.toEqual({ items: [{ id: 'e1' }], nextCursor: 'c.d' });
  });
});

describe('audit labels', () => {
  it('names the known actions and leaves the others unnamed', () => {
    expect(auditActionLabel('source.enable')).toBe('Activó una fuente');
    expect(auditActionLabel('role_assigned')).toBe('Asignó un rol');
    expect(auditActionLabel('something.new')).toBeNull();
    expect(auditActionLabel('toString')).toBeNull();
    expect(KNOWN_AUDIT_ACTIONS).toContain('config.restore');
  });
});
