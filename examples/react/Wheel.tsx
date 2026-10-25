import { useEffect, useRef, useState } from 'react';
import { createChart, type Chart, type ChartInput } from 'astr3';

export function Wheel({ data }: { data: ChartInput }) {
  const initialData = useRef(data);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<Chart | undefined>(undefined);
  const [status, setStatus] = useState('');
  // Mount once. In development, Strict Mode exercises this setup/cleanup twice.
  useEffect(() => {
    const instance = createChart(host.current!, { data: initialData.current });
    chart.current = instance;
    setStatus(instance.error?.message ?? 'Chart mounted.');
    return () => {
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
    </>
  );
}
