import { Controller } from '@hotwired/stimulus';
import { createChart } from 'astr3';

export default class extends Controller {
  static targets = ['host', 'status', 'longitude'];
  static values = { data: Object };

  connect() {
    this.mount();
  }
  disconnect() {
    this.dispose();
  }
  dataValueChanged(data) {
    this.chart?.update(data);
  }

  mount() {
    if (this.chart) return;
    this.chart = createChart(this.hostTarget, { data: this.dataValue });
    this.statusTarget.textContent = this.chart.error?.message ?? 'Chart mounted.';
    this.renderLongitude();
  }
  dispose() {
    this.chart?.dispose();
    this.chart = undefined;
    this.statusTarget.textContent = 'Chart unmounted.';
  }
  // Turbo snapshots must not retain copied canvases/HTML from a live chart.
  beforeCache() {
    this.dispose();
  }
  rotate() {
    this.dataValue = {
      ...this.dataValue,
      bodies: this.dataValue.bodies.map((body) => ({
        ...body,
        longitude: (body.longitude + 15) % 360,
      })),
    };
    this.renderLongitude();
  }
  toggle(event) {
    if (this.chart) {
      this.dispose();
      event.currentTarget.textContent = 'Mount chart';
    } else {
      this.mount();
      event.currentTarget.textContent = 'Unmount chart';
    }
  }
  renderLongitude() {
    this.longitudeTarget.textContent = `Sun longitude: ${this.dataValue.bodies[0].longitude}°`;
  }
}
