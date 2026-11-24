import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Role } from '../api/api-types';
import { IfRoleDirective } from './if-role.directive';
import { roleAtLeast } from './roles';
import { SessionService } from './session.service';

@Component({
  imports: [IfRoleDirective],
  template: `<button *appIfRole="'analyst'">Lanzar escaneo</button>`,
})
class Host {}

describe('IfRoleDirective', () => {
  const role = signal<Role | null>('reader');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        {
          provide: SessionService,
          useValue: { hasRole: (minimum: Role) => roleAtLeast(role(), minimum) },
        },
      ],
    });
  });

  it('shows the action only while the role reaches the minimum', async () => {
    role.set('reader');
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    role.set('admin');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')?.textContent).toBe('Lanzar escaneo');

    role.set(null);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
