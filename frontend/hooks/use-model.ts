/// https://jsr.io/@furry/model

import { useMemo, useState } from "react";

interface FieldHandler<T> {
  set: (value: T) => void;
  reset: () => void;
}

interface BaseHandler<T extends Record<string, unknown>> {
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  reset: (key?: keyof T) => void;
}

type EventProxy<T extends Record<string, unknown>> = BaseHandler<T> & {
  [K in keyof T]: FieldHandler<T[K]>;
};

/**
 * Nýtist þannig:
 *
 * ```ts
 * const [state, event] = useModel({
 *   someKey: 1,
 *   someOtherKey: 2
 * });
 *
 * console.log(state.someKey) // 1
 *
 * state.someKey.set(2)
 *
 * console.log(state.someKey) // 2
 * ```
 *
 * Eins og useState nema hvað hver lykill er eins og sér state.
 *
 * @param initialState
 * @returns [state, event]
 */
function useModel<T extends Record<string, unknown>>(initialState: T): [T, EventProxy<T>] {
  const [state, setState] = useState<T>(initialState);

  const event = useMemo(() => {
    const createHandler = <K extends keyof T>(key: K): FieldHandler<T[K]> => ({
      set: (value: T[K]) => setState((prev) => ({ ...prev, [key]: value })),
      reset: () => setState((prev) => ({ ...prev, [key]: initialState[key] })),
    });

    const handler: BaseHandler<T> = {
      set: <K extends keyof T>(key: K, value: T[K]) =>
        setState((prev) => ({ ...prev, [key]: value })),
      reset: (key?: keyof T) => {
        if (key) {
          setState((prev) => ({ ...prev, [key]: initialState[key] }));
        } else {
          setState(initialState);
        }
      },
    };

    return new Proxy(handler, {
      get: (target, prop: string | symbol) => {
        if (prop in target) return target[prop as keyof typeof target];
        if (prop in initialState) {
          return createHandler(prop as keyof T);
        }
        return undefined;
      },
      set: (target, prop: string | symbol, value: unknown): boolean => {
        if (prop in initialState) {
          setState((prev) => ({ ...prev, [prop as keyof T]: value as T[keyof T] }));
          return true;
        }
        return false;
      },
    }) as EventProxy<T>;
  }, [initialState]);

  return [state, event];
}

export { useModel };
