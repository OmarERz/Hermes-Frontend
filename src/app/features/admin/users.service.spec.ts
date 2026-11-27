import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(UsersService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the accounts with the cursor as received', async () => {
    const result = firstValueFrom(service.list('a.b', 50));
    const request = backend.expectOne((req) => req.url === 'http://127.0.0.1:8000/api/admin/users');
    expect(request.request.params.get('cursor')).toBe('a.b');
    expect(request.request.params.get('limit')).toBe('50');
    request.flush({ items: [{ uid: 'u1' }], next_cursor: null });
    await expect(result).resolves.toEqual({ items: [{ uid: 'u1' }], nextCursor: null });
  });

  it('assigns a role with the stored role it read as expected_role', async () => {
    const result = firstValueFrom(service.assignRole('uid/1', 'analyst', 'reader'));
    const request = backend.expectOne(
      (req) => req.url === 'http://127.0.0.1:8000/api/admin/users/uid%2F1/role',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ role: 'analyst', expected_role: 'reader' });
    const answer = { uid: 'uid/1', role: 'analyst', sessions_revoked: true, known_user: true };
    request.flush(answer);
    await expect(result).resolves.toEqual(answer);
  });

  it('sends a null expected_role for someone who never signed in', async () => {
    const result = firstValueFrom(service.assignRole('u2', 'reader', null));
    const request = backend.expectOne((req) => req.url.endsWith('/api/admin/users/u2/role'));
    expect(request.request.body).toEqual({ role: 'reader', expected_role: null });
    request.flush({ uid: 'u2', role: 'reader', sessions_revoked: true, known_user: false });
    await result;
  });
});
