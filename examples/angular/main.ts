import { Component, computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { WheelComponent } from './wheel.component.js';
import { chartData } from '../shared/data.js';
import '../shared/preview.css';

@Component({
  selector: 'example-app',
  standalone: true,
  imports: [WheelComponent],
  template: `<main>
    <h1>Angular + ASTR3</h1>
    <div class="controls">
      <button (click)="rotate()">Rotate positions</button>
      <button (click)="mounted.set(!mounted())">
        {{ mounted() ? 'Unmount chart' : 'Mount chart' }}
      </button>
    </div>
    <output>Sun longitude: {{ offset() }}°</output>
    @if (mounted()) {
      <astr3-wheel [data]="data()" />
    } @else {
      <p role="status">Chart unmounted.</p>
    }
  </main>`,
})
class AppComponent {
  readonly offset = signal(0);
  readonly mounted = signal(true);
  readonly data = computed(() => chartData(this.offset()));
  rotate() {
    this.offset.update((n) => (n + 15) % 360);
  }
}
bootstrapApplication(AppComponent, { providers: [provideZonelessChangeDetection()] }).catch(
  (error: unknown) => {
    console.error(error);
  },
);
