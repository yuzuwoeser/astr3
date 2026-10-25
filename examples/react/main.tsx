import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Wheel } from './Wheel.js';
import { chartData } from '../shared/data.js';
import '../shared/preview.css';

function App() {
  const [offset, setOffset] = useState(0);
  const [mounted, setMounted] = useState(true);
  return (
    <main>
      <h1>React + ASTR3</h1>
      <div className="controls">
        <button onClick={() => setOffset((n) => (n + 15) % 360)}>Rotate positions</button>
        <button onClick={() => setMounted((value) => !value)}>
          {mounted ? 'Unmount chart' : 'Mount chart'}
        </button>
      </div>
      <output>Sun longitude: {offset}°</output>
      {mounted ? <Wheel data={chartData(offset)} /> : <p role="status">Chart unmounted.</p>}
    </main>
  );
}
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
