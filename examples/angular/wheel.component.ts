import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { createChart, type Chart, type ChartInput } from 'astr3';

@Component({
  selector: 'astr3-wheel',
  standalone: true,
  template:
    '<div #host class="chart-host" style="width: min(100%, 640px)"></div><p role="status">{{ status() }}</p>',
})
export class WheelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data!: ChartInput;
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  readonly status = signal('');
  private chart?: Chart;
  ngAfterViewInit() {
    this.chart = createChart(this.host.nativeElement, { data: this.data });
    this.status.set(this.chart.error?.message ?? 'Chart mounted.');
  }
  ngOnChanges() {
    this.chart?.update(this.data);
  }
  ngOnDestroy() {
    this.chart?.dispose();
  }
}
