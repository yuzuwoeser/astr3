import '@hotwired/turbo';
import { Application } from '@hotwired/stimulus';
import ChartController from './chart_controller.js';
import '../shared/preview.css';

const application = Application.start();
application.register('chart', ChartController);
