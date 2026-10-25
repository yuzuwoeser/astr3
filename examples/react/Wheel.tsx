import { useEffect, useRef, useState } from 'react';
import { createChart, type Chart, type ChartInput, type SelectionDetails } from '@yuzuwoeser/astr3';

export function Wheel({ data }: { data: ChartInput }) {
  const initialData = useRef(data);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<Chart | undefined>(undefined);
  const [status, setStatus] = useState('');
  const [details, setDetails] = useState<SelectionDetails | null>(null);
  // Mount once. In development, Strict Mode exercises this setup/cleanup twice.
  useEffect(() => {
    const instance = createChart(host.current!, { data: initialData.current });
    chart.current = instance;
    setStatus(instance.error?.message ?? 'Chart mounted.');
    const unsubscribe = instance.on('selection', ({ details }) => setDetails(details));
    return () => {
      unsubscribe();
      instance.dispose();
      chart.current = undefined;
    };
    // Data changes are handled by the separate update effect below.
  }, []);
  useEffect(() => {
    chart.current?.update(data);
  }, [data]);
  return (
    <>
      <div ref={host} className="chart-host" style={{ width: 'min(100%, 640px)' }} />
      <p role="status">{status}</p>
      <section aria-label="Selected chart object" aria-live="polite">
        <h2>
          {details
            ? 'name' in details.object
              ? details.object.name
              : 'type' in details.object
                ? `${details.object.type} aspect`
                : `House ${details.object.number}`
            : 'Select a planet or aspect'}
        </h2>
        <p>
          {details
            ? 'This panel belongs to your application. Connect the selection to your own content.'
            : 'Click the wheel or choose an entry in its accessible object list.'}
        </p>
        {details && (
          <ul>
            {details.aspects.map((aspect) => (
              <li key={aspect.id}>
                {aspect.bodyIds
                  .map((id) => details.bodies.find((body) => body.id === id)?.name ?? id)
                  .join(' / ')}
                {`: ${aspect.type}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
