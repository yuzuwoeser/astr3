import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransitAnimation } from '../../src/transit-animation.js';
import type { TransitCalculator } from '../../src/transit-animation.js';
import type { TransitChart } from '../../src/transit-renderer.js';
import { createTransitModel } from '../../src/model/transits.js';
import type { ChartInput } from '../../src/model/types.js';
import { DAY } from '../../src/transit-sampling.js';

const FROM = Date.UTC(2024, 0, 1);
const iso = (day: number) => new Date(FROM + day * DAY).toISOString();
const calculate: TransitCalculator = async ({ utc }) => {
  const time = new Date(utc).getTime();
  const day = (time - FROM) / DAY;
  return {
    bodies: [{ id: 'mercury', name: 'Mercury', longitude: (359 + day) % 360, speed: 1 }],
    metadata: { utc: new Date(time).toISOString() },
  };
};

function fixture(provider = calculate) {
  const motion = Object.assign(new EventTarget(), { matches: false });
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    defaultView: {
      matchMedia: () => motion,
      requestAnimationFrame: (callback: (time: number) => void) =>
        setTimeout(() => callback(Date.now()), 16),
      cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    },
  });
  const updates: ChartInput[] = [];
  const disposers = new Set<() => void>();
  let model = createTransitModel({
    natal: { bodies: [{ id: 'sun', name: 'Sun', longitude: 0 }] },
    transit: { bodies: [] },
  });
  const chart = {
    element: { ownerDocument: document },
    get model() {
      return model;
    },
    updateTransit(data: ChartInput) {
      model = Object.freeze({
        ...createTransitModel({ natal: model.natal, transit: data }),
        natal: model.natal,
      });
      updates.push(data);
    },
    on(event: string, listener: () => void) {
      if (event === 'dispose') disposers.add(listener);
      return () => disposers.delete(listener);
    },
    dispose() {
      for (const listener of disposers) listener();
    },
  } as unknown as TransitChart;
  const animation = createTransitAnimation(chart, provider);
  return { animation, chart, updates, document, motion, disposers };
}

describe('transit animation controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses one uniform clock, exact calculated positions, and an exact endpoint across wraparound', async () => {
    const { animation, chart, updates } = fixture();
    const natal = chart.model.natal;
    const finished = animation.play({ from: iso(0), to: iso(1) });
    await vi.runAllTimersAsync();
    await finished;
    expect(animation.state).toMatchObject({
      status: 'completed',
      currentTime: iso(1),
      progress: 1,
      durationMs: 1000,
    });
    expect(chart.model.natal).toBe(natal);
    expect(updates.length).toBe(31);
    const times = updates.map((data) => new Date(data.metadata!.utc as string).getTime());
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBe(DAY / 30);
    expect(updates[0]!.bodies[0]!.longitude).toBe(359);
    expect(updates.at(-1)!.bodies[0]!.longitude).toBe(0);
    animation.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses without advancing and resumes from the displayed time in reverse', async () => {
    const { animation, updates } = fixture();
    const finished = animation.play({ from: iso(1), to: iso(0) });
    await vi.advanceTimersByTimeAsync(400);
    animation.pause();
    const paused = animation.state.currentTime;
    const count = updates.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(animation.state).toMatchObject({ status: 'paused', currentTime: paused });
    expect(updates.length).toBe(count);
    animation.resume();
    await vi.runAllTimersAsync();
    await finished;
    expect(animation.state.currentTime).toBe(iso(0));
    const times = updates.map((data) => new Date(data.metadata!.utc as string).getTime());
    expect(times.every((time, i) => i === 0 || time < times[i - 1]!)).toBe(true);
    animation.dispose();
  });

  it('honors a pause requested synchronously by a playing-state listener', async () => {
    const { animation, updates } = fixture();
    let paused = false;
    animation.on('state', (state) => {
      if (state.status === 'playing' && !paused) {
        paused = true;
        animation.pause();
      }
    });
    const pending = animation.play({ from: iso(0), to: iso(1) });
    await vi.advanceTimersByTimeAsync(2000);
    expect(animation.state).toMatchObject({ status: 'paused', currentTime: iso(0) });
    expect(updates).toHaveLength(1);
    animation.resume();
    await vi.runAllTimersAsync();
    await pending;
    expect(updates).toHaveLength(31);
    animation.dispose();
  });

  it('replaces in-flight work even when the old provider ignores cancellation', async () => {
    let release: ((data: ChartInput) => void) | undefined;
    let calls = 0;
    const { animation, updates } = fixture(async (request) =>
      ++calls === 1
        ? new Promise((resolve) => {
            release = resolve;
          })
        : calculate(request),
    );
    const old = animation.play({ from: iso(0), to: iso(1) });
    const next = animation.play({ from: iso(2), to: iso(3) });
    release!(await calculate({ utc: iso(0) }));
    await vi.runAllTimersAsync();
    await Promise.all([old, next]);
    expect(animation.state.currentTime).toBe(iso(3));
    expect(
      updates.every((data) => new Date(data.metadata!.utc as string).getTime() >= FROM + 2 * DAY),
    ).toBe(true);
    animation.dispose();
  });

  it('restarts a partially displayed step from its current time', async () => {
    const { animation, updates } = fixture();
    const old = animation.play({ from: iso(0), to: iso(1) });
    await vi.advanceTimersByTimeAsync(400);
    const from = animation.state.currentTime!;
    const count = updates.length;
    const next = animation.play({ from, to: iso(-1) });
    await vi.runAllTimersAsync();
    await Promise.all([old, next]);
    expect(updates[count]!.metadata!.utc).toBe(from);
    expect(animation.state.currentTime).toBe(iso(-1));
    animation.dispose();
  });

  it('buffers a slow provider without skipping time samples', async () => {
    let calls = 0;
    const { animation, updates } = fixture(async (request) => {
      if (++calls > 61) await new Promise((resolve) => setTimeout(resolve, 100));
      return calculate(request);
    });
    const states: string[] = [];
    animation.on('state', (state) => states.push(state.status));
    const finished = animation.play({ from: iso(0), to: iso(1) });
    await vi.runAllTimersAsync();
    await finished;
    expect(states.filter((status) => status === 'buffering').length).toBeGreaterThan(1);
    expect(updates.length).toBe(31);
    expect(animation.state.currentTime).toBe(iso(1));
    animation.dispose();
  });

  it('keeps the last valid model on failure and reports the error once', async () => {
    let calls = 0;
    const { animation, chart } = fixture(async (request) => {
      if (++calls > 67) throw new Error('Sample unavailable');
      return calculate(request);
    });
    const error = vi.fn();
    animation.on('error', error);
    const failed = expect(animation.play({ from: iso(0), to: iso(1) })).rejects.toThrow(
      'Sample unavailable',
    );
    await vi.runAllTimersAsync();
    await failed;
    expect(animation.state.status).toBe('error');
    expect(chart.model.transit.metadata!.utc).toBe(animation.state.currentTime);
    expect(error).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    animation.dispose();
  });

  it('honors reduced motion both before playback and when the preference changes', async () => {
    const { animation, motion, updates } = fixture();
    motion.matches = true;
    await animation.play({ from: iso(0), to: iso(1) });
    expect(updates).toHaveLength(1);
    expect(animation.state.currentTime).toBe(iso(1));
    motion.matches = false;
    const pending = animation.play({ from: iso(1), to: iso(2) });
    await vi.advanceTimersByTimeAsync(400);
    motion.matches = true;
    motion.dispatchEvent(new Event('change'));
    await vi.runAllTimersAsync();
    await pending;
    expect(animation.state).toMatchObject({ status: 'completed', currentTime: iso(2) });
    animation.dispose();
  });

  it('suspends hidden playback and respects a user pause when the page returns', async () => {
    const { animation, document } = fixture();
    const pending = animation.play({ from: iso(0), to: iso(1) });
    await vi.advanceTimersByTimeAsync(400);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    const time = animation.state.currentTime;
    await vi.advanceTimersByTimeAsync(5000);
    expect(animation.state).toMatchObject({ status: 'paused', currentTime: time });
    animation.pause();
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(animation.state.currentTime).toBe(time);
    animation.resume();
    await vi.runAllTimersAsync();
    await pending;
    expect(animation.state.currentTime).toBe(iso(1));
    animation.dispose();
  });

  it('holds a reduced-motion endpoint while hidden and applies it on return', async () => {
    const { animation, document, motion, updates } = fixture();
    motion.matches = true;
    document.hidden = true;
    const pending = animation.play({ from: iso(0), to: iso(1) });
    await vi.advanceTimersByTimeAsync(1000);
    expect(animation.state.status).toBe('paused');
    expect(updates).toHaveLength(0);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.runAllTimersAsync();
    await pending;
    expect(updates).toHaveLength(1);
    expect(animation.state.currentTime).toBe(iso(1));
    animation.dispose();
  });

  it('rejects invalid ranges before interrupting a valid run', async () => {
    const { animation } = fixture();
    const pending = animation.play({ from: iso(0), to: iso(1) });
    expect(() => animation.play({ from: '2024-01-01T00:00', to: iso(1) })).toThrow('offset');
    expect(() => animation.play({ from: iso(0), to: iso(367) })).toThrow('366');
    expect(() => animation.play({ from: iso(0), to: '2101-01-01T00:00Z' })).toThrow('2100');
    await vi.runAllTimersAsync();
    await pending;
    expect(animation.state.currentTime).toBe(iso(1));
    animation.dispose();
  });

  it('cancels queued frames and provider requests when the chart is disposed', async () => {
    const { animation, chart, updates, disposers, document, motion } = fixture();
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const removeMotion = vi.spyOn(motion, 'removeEventListener');
    const pending = animation.play({ from: iso(0), to: iso(1) });
    await vi.advanceTimersByTimeAsync(400);
    const count = updates.length;
    chart.dispose();
    animation.dispose();
    await vi.runAllTimersAsync();
    await pending;
    expect(animation.state.status).toBe('disposed');
    expect(updates.length).toBe(count);
    expect(disposers.size).toBe(0);
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeMotion).toHaveBeenCalledWith('change', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    expect(() => animation.resume()).toThrow('disposed');
  });
});
