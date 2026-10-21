let tail = Promise.resolve();
let waiting = 0;
let deferredRender = null;

function flush() {
  if (waiting > 0 || !deferredRender) return;
  const render = deferredRender;
  deferredRender = null;
  render();
}

export function enqueueCartWrite(task) {
  waiting += 1;
  const run = tail.then(() => {
    waiting -= 1;
    return task();
  });
  tail = run.catch(() => {}).then(flush);
  return run;
}

export function cartWritesWaiting() {
  return waiting;
}

export function renderWhenSettled(render) {
  if (waiting > 0) {
    deferredRender = render;
    return;
  }
  deferredRender = null;
  render();
}
