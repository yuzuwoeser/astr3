import { mount } from 'svelte';
import App from './App.svelte';
import '../shared/preview.css';
mount(App, { target: document.getElementById('app')! });
