import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { CompanyService } from './company.service';

const API = 'http://127.0.0.1:8000';
const PROFILE = {
  sector: 'fintech',
  subsectors: [],
  countries: ['MX'],
  language: 'es',
  version: 2,
};
const PEER = {
  id: '5f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b',
  name: 'Pagos Ejemplo',
  aliases: ['PagosEj'],
  domain: 'pagos.example.test',
  sector: 'fintech',
  country: 'MX',
};

describe('CompanyService', () => {
  let service: CompanyService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: APP_CONFIG,
          useValue: {
            production: false,
            apiBaseUrl: API,
            firebase: null,
            authEmulatorUrl: null,
            itopBaseUrl: null,
          },
        },
      ],
    });
    service = TestBed.inject(CompanyService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the profile and saves it with the expected version', async () => {
    const read = firstValueFrom(service.getProfile());
    backend.expectOne(`${API}/api/profile`).flush(PROFILE);
    expect(await read).toEqual(PROFILE);

    const saved = firstValueFrom(
      service.updateProfile({
        sector: 'retail',
        subsectors: [],
        countries: ['MX'],
        language: 'es',
        expected_version: 2,
      }),
    );
    const request = backend.expectOne(`${API}/api/profile`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.expected_version).toBe(2);
    request.flush({ ...PROFILE, sector: 'retail', version: 3 });
    expect((await saved).version).toBe(3);
  });

  it('pages the peers with the opaque cursor and maps the page', async () => {
    const page = firstValueFrom(service.listPeers('c.sig', 50));
    const request = backend.expectOne((req) => req.url === `${API}/api/peer-companies`);
    expect(request.request.params.get('cursor')).toBe('c.sig');
    expect(request.request.params.get('limit')).toBe('50');
    request.flush({ items: [PEER], next_cursor: null });
    expect(await page).toEqual({ items: [PEER], nextCursor: null });
  });

  it('creates, updates and deletes a peer', async () => {
    const input = {
      name: 'Pagos Ejemplo',
      aliases: [],
      domain: null,
      sector: 'fintech',
      country: 'MX',
    };
    const created = firstValueFrom(service.createPeer(input));
    const post = backend.expectOne(`${API}/api/peer-companies`);
    expect(post.request.method).toBe('POST');
    post.flush(PEER, { status: 201, statusText: 'Created' });
    expect((await created).id).toBe(PEER.id);

    const updated = firstValueFrom(service.updatePeer(PEER.id, input));
    const put = backend.expectOne(`${API}/api/peer-companies/${PEER.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(input);
    put.flush(PEER);
    await updated;

    const deleted = firstValueFrom(service.deletePeer(PEER.id), { defaultValue: undefined });
    const del = backend.expectOne(`${API}/api/peer-companies/${PEER.id}`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await deleted;
  });
});
