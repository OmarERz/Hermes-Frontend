import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppTitleStrategy } from './title-strategy';

@Component({ template: '' })
class EmptyScreen {}

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'activos', title: 'Activos', component: EmptyScreen },
          { path: 'sin-titulo', component: EmptyScreen },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
  });

  it('suffixes the route title with the app name', async () => {
    await RouterTestingHarness.create('/activos');
    expect(TestBed.inject(Title).getTitle()).toBe('Activos · Hermes Control');
  });

  it('uses the app name alone when the route has no title', async () => {
    await RouterTestingHarness.create('/sin-titulo');
    expect(TestBed.inject(Title).getTitle()).toBe('Hermes Control');
  });
});
