import { Component } from '@angular/core';

@Component({
  selector: 'app-tarjeta',
  templateUrl: './tarjeta.html'
})
export class Tarjeta {
  nombre = 'José Miguel';
  contador = 0;

  sumar() {
    this.contador++;
  }
}