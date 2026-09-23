/** A real task boundary lets RN deliver touches and paint between CPU slices. */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function drainSync<T>(steps: Generator<void, T, void>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

export async function drainCooperatively<T>(steps: Generator<void, T, void>): Promise<T> {
  let sliceStart = Date.now();
  let next = steps.next();
  while (!next.done) {
    if (Date.now() - sliceStart >= 4) {
      await yieldToUI();
      sliceStart = Date.now();
    }
    next = steps.next();
  }
  return next.value;
}
