import type { ChartInput } from './model/types.js';
import type { TransitChart } from './transit-renderer.js';
import { animationTime, DAY, prepareTransitAnimation, transitSample } from './transit-sampling.js';
import type { TransitCalculator } from './transit-sampling.js';

export type { TransitCalculator } from './transit-sampling.js';
export type TransitAnimationStatus =
  'idle' | 'preparing' | 'playing' | 'buffering' | 'paused' | 'completed' | 'error' | 'disposed';
export interface TransitAnimationState {
  readonly status: TransitAnimationStatus;
  readonly from: string | null;
  readonly to: string | null;
  readonly currentTime: string | null;
  readonly progress: number;
  /** Planned active playback time, excluding preparation, pauses and buffering. */
  readonly durationMs: number;
}
export interface TransitAnimationEvents {
  state: TransitAnimationState;
  progress: { state: TransitAnimationState; data: ChartInput };
  error: { message: string; cause: unknown };
}
export interface TransitAnimationOptions {
  /** IDs whose paths retain full detail in long steps. Defaults to the five
   * lowercase Jupiter-through-Pluto IDs used by the Astronomy Engine adapter. */
  readonly outerBodyIds?: readonly string[];
}
export interface TransitAnimation {
  readonly state: TransitAnimationState;
  /** Resolves on completion or cancellation; rejects on calculation/validation failure. */
  play(interval: { from: Date | string; to: Date | string }): Promise<void>;
  pause(): void;
  resume(): void;
  /** Stops at the last displayed time. */
  cancel(): void;
  on<K extends keyof TransitAnimationEvents>(
    event: K,
    listener: (payload: TransitAnimationEvents[K]) => void,
  ): () => void;
  dispose(): void;
}

interface Run {
  from: number;
  to: number;
  abort: AbortController;
  frames: number;
  index: number;
  next: number;
  duration: number;
  deadline: number;
  raf: number;
  paused: boolean;
  ready: boolean;
  pumping: boolean;
  buffer: { index: number; time: number; data: ChartInput }[];
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** Browser playback with injected astronomy; imports remain SSR-safe. */
export function createTransitAnimation(
  chart: TransitChart,
  calculateTransits: TransitCalculator,
  options: TransitAnimationOptions = {},
): TransitAnimation {
  const outerBodyIds = options.outerBodyIds ? new Set(options.outerBodyIds) : undefined;
  if (outerBodyIds && [...outerBodyIds].some((id) => typeof id !== 'string' || !id.trim()))
    throw new RangeError('Outer body IDs must be nonempty strings.');
  const doc = chart.element.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('Transit animation needs a browser window.');
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new Map<keyof TransitAnimationEvents, Set<(payload: never) => void>>();
  let disposed = false;
  let run: Run | null = null;
  let state: TransitAnimationState = Object.freeze({
    status: 'idle',
    from: null,
    to: null,
    currentTime: null,
    progress: 0,
    durationMs: 0,
  });
  const emit = <K extends keyof TransitAnimationEvents>(
    event: K,
    payload: TransitAnimationEvents[K],
  ) => {
    for (const listener of listeners.get(event) ?? []) listener(payload as never);
  };
  function setState(patch: Partial<TransitAnimationState>) {
    const previous = state;
    state = Object.freeze({ ...state, ...patch });
    if (
      previous.status !== state.status ||
      previous.durationMs !== state.durationMs ||
      previous.from !== state.from ||
      previous.to !== state.to
    )
      emit('state', state);
  }
  function assertLive() {
    if (disposed) throw new Error('This transit animation has been disposed.');
  }
  const live = (own: Run) => run === own && !disposed;
  function stop() {
    if (!run) return;
    const previous = run;
    run = null;
    previous.abort.abort();
    win!.cancelAnimationFrame(previous.raf);
    previous.buffer.length = 0;
    previous.resolve();
  }
  function fail(own: Run, cause: unknown) {
    if (!live(own)) return;
    run = null;
    own.abort.abort();
    win!.cancelAnimationFrame(own.raf);
    own.buffer.length = 0;
    setState({ status: 'error' });
    own.reject(cause);
    emit('error', {
      message: cause instanceof Error ? cause.message : 'Transit animation failed.',
      cause,
    });
  }
  function apply(own: Run, time: number, data: ChartInput, progress: number) {
    if (!live(own)) return;
    chart.updateTransit(data);
    if (!live(own)) return;
    setState({ currentTime: new Date(time).toISOString(), progress });
    emit('progress', { state, data });
  }
  function complete(own: Run) {
    if (!live(own)) return;
    run = null;
    own.abort.abort();
    setState({ status: 'completed', progress: 1 });
    own.resolve();
  }
  function wake(own: Run) {
    if (!live(own) || !own.ready || own.raf) return;
    if (own.paused || doc.hidden) {
      own.deadline = 0;
      setState({ status: 'paused' });
      return;
    }
    own.raf = win!.requestAnimationFrame((now) => tick(own, now));
  }
  async function pump(own: Run) {
    if (!live(own) || own.pumping) return;
    own.pumping = true;
    try {
      // Bounded lookahead; a paused or hidden chart never advances its clock.
      while (live(own) && own.buffer.length < 4 && own.next <= own.frames) {
        const index = own.next++;
        const time = own.from + ((own.to - own.from) * index) / own.frames;
        const data = await transitSample(calculateTransits, time, own.abort.signal);
        if (!live(own)) return;
        own.buffer.push({ index, time, data });
        wake(own);
      }
    } catch (cause) {
      fail(own, cause);
    } finally {
      own.pumping = false;
    }
  }
  function tick(own: Run, now: number) {
    own.raf = 0;
    if (!live(own)) return;
    if (own.paused || doc.hidden) {
      wake(own);
      return;
    }
    const period = own.duration / own.frames;
    if (!own.buffer.length) {
      own.deadline = 0;
      setState({ status: 'buffering' });
      return; // The producer wakes us when a sample is available.
    }
    if (!own.deadline) own.deadline = now + period;
    if (now + 0.1 < own.deadline) {
      wake(own);
      return;
    }
    try {
      setState({ status: 'playing' });
      if (!live(own) || own.paused || doc.hidden) return;
      const next = own.buffer.shift()!;
      own.index = next.index;
      apply(own, next.time, next.data, own.index / own.frames);
      if (!live(own)) return;
      if (own.index === own.frames) {
        complete(own);
        return;
      }
      // Never skip samples to catch up after a slow render or a suspended tab.
      own.deadline = Math.max(own.deadline + period, now);
      void pump(own);
      wake(own);
    } catch (cause) {
      fail(own, cause);
    }
  }
  async function start(own: Run) {
    try {
      if (motion.matches || own.from === own.to) {
        const data = await transitSample(calculateTransits, own.to, own.abort.signal);
        if (!live(own)) return;
        if (doc.hidden || own.paused) {
          own.frames = 1;
          own.next = 2;
          own.ready = true;
          own.buffer.push({ index: 1, time: own.to, data });
          wake(own);
          return;
        }
        apply(own, own.to, data, 1);
        complete(own);
        return;
      }
      const prepared = await prepareTransitAnimation(
        calculateTransits,
        own.from,
        own.to,
        own.abort.signal,
        outerBodyIds,
      );
      if (!live(own)) return;
      own.frames = prepared.frames;
      own.duration = prepared.durationMs;
      own.ready = true;
      setState({
        durationMs: own.duration,
        status: own.paused || doc.hidden ? 'paused' : 'buffering',
      });
      if (!live(own)) return;
      apply(own, own.from, prepared.first, 0);
      if (live(own)) void pump(own);
    } catch (cause) {
      fail(own, cause);
    }
  }
  function visibility() {
    if (!run) return;
    win!.cancelAnimationFrame(run.raf);
    run.raf = 0;
    run.deadline = 0;
    if (run.ready) wake(run);
  }
  function reducedMotion() {
    if (motion.matches && run) {
      const to = run.to,
        from = state.currentTime ?? new Date(run.from).toISOString();
      void controller.play({ from, to: new Date(to) }).catch(() => {}); // Error event reports failures.
    }
  }
  const unsubscribe = chart.on('dispose', () => controller.dispose());
  doc.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', reducedMotion);
  const controller: TransitAnimation = {
    get state() {
      return state;
    },
    play(interval) {
      assertLive();
      const from = animationTime(interval.from),
        to = animationTime(interval.to);
      if (Math.abs(to - from) > 366 * DAY)
        throw new RangeError('Animate at most 366 days per step.');
      stop();
      return new Promise<void>((resolve, reject) => {
        const own: Run = {
          from,
          to,
          abort: new AbortController(),
          frames: 0,
          index: 0,
          next: 1,
          duration: 0,
          deadline: 0,
          raf: 0,
          paused: false,
          ready: false,
          pumping: false,
          buffer: [],
          resolve,
          reject,
        };
        run = own;
        setState({
          status: 'preparing',
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          progress: 0,
          durationMs: 0,
        });
        if (live(own)) void start(own);
      });
    },
    pause() {
      assertLive();
      if (!run) return;
      run.paused = true;
      win!.cancelAnimationFrame(run.raf);
      run.raf = 0;
      run.deadline = 0;
      setState({ status: 'paused' });
    },
    resume() {
      assertLive();
      if (!run) return;
      run.paused = false;
      if (run.ready) wake(run);
      else setState({ status: 'preparing' });
    },
    cancel() {
      assertLive();
      stop();
      setState({ status: 'idle' });
    },
    on(event, listener) {
      assertLive();
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as (payload: never) => void);
      return () => set.delete(listener as (payload: never) => void);
    },
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      unsubscribe();
      doc.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', reducedMotion);
      try {
        setState({ status: 'disposed' });
      } finally {
        listeners.clear();
      }
    },
  };
  return controller;
}
