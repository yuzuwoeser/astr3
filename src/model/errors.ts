export class ChartDataError extends Error {
  readonly code = 'INVALID_CHART_DATA';
  constructor(message: string) {
    super(message);
    this.name = 'ChartDataError';
  }
}
