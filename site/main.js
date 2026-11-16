import sourceUrl from '../Customizable_Spoke_Guard.scad?url';
import { createViewer } from './viewer.js';
import './style.css';

const form = document.querySelector('#settings');
const fields = form.elements;
const generate = document.querySelector('#generate');
const cancel = document.querySelector('#cancel');
const download = document.querySelector('#download');
const status = document.querySelector('#status');
const modelLabel = document.querySelector('#model-label');
const rimText = fields.rim_text;
const defaultNames = [
  'rim_text', 'show_dividers', 'float_dividers',
  'center_hole_diameter', 'center_shoulder_height', 'export_part',
];
const fileNames = {
  'Complete guard': 'epic-spoke-guard.stl',
  'Black body': 'epic-spoke-guard-black.stl',
  'White letter faces': 'epic-spoke-guard-white.stl',
};

let source;
let defaults;
let running;
let result;
let viewer;

try {
  viewer = createViewer(document.querySelector('#viewport'));
  document.querySelector('#view-controls').hidden = false;
  document.querySelector('#top-view').addEventListener('click', viewer.top);
  document.querySelector('#reset-view').addEventListener('click', viewer.reset);
} catch {
  document.querySelector('#viewport').textContent = '3D preview requires WebGL. You can still generate and download an STL.';
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.toggleAttribute('data-error', error);
}

function settings() {
  return {
    rim_text: rimText.value,
    show_dividers: fields.show_dividers.checked,
    float_dividers: fields.float_dividers.checked,
    center_hole_diameter: fields.center_hole_diameter.valueAsNumber,
    center_shoulder_height: fields.center_shoulder_height.valueAsNumber,
    export_part: fields.export_part.value,
  };
}

function matches(current, previous) {
  return defaultNames.every((key) => current[key] === previous[key]);
}

function refresh() {
  generate.disabled = !source || Boolean(running);
  cancel.hidden = !running;
  form.setAttribute('aria-busy', String(Boolean(running)));
  download.disabled = Boolean(running) || !result || !matches(settings(), result.settings);
}

function onChange() {
  rimText.setCustomValidity('');
  refresh();
  if (running || !source) return;
  if (result && !download.disabled) {
    setStatus('Model ready · Drag to rotate, scroll or pinch to zoom.');
  } else {
    setStatus('Generate a model to apply these settings.');
  }
}

function applyDefaults() {
  for (const [name, value] of Object.entries(defaults)) {
    if (typeof value === 'boolean') fields[name].checked = value;
    else fields[name].value = value;
  }
  onChange();
}

function render() {
  const parameters = settings();
  const groups = parameters.rim_text.split('|').filter((group) => group.trim());
  let problem = '';
  if (/[^A-Za-z0-9 .,!?&'+/|\-]/.test(parameters.rim_text)) {
    problem = 'Use only the supported characters listed below Rim text.';
  } else if (groups.length > 11) {
    problem = 'Use at most 11 non-empty text groups.';
  } else if (!groups.length && parameters.export_part === 'White letter faces') {
    problem = 'Enter rim text to export the letter faces.';
  }
  rimText.setCustomValidity(problem);
  if (!form.reportValidity()) return;

  let worker;
  try {
    worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
  } catch {
    setStatus('Could not start the model generator. Reload the page to try again.', true);
    return;
  }

  function finish() {
    clearTimeout(timeout);
    worker.terminate();
    running = undefined;
    refresh();
  }

  const timeout = setTimeout(() => {
    finish();
    setStatus('Generation took too long. Try fewer characters and generate again.', true);
  }, 120_000);
  running = finish;
  worker.onmessage = ({ data }) => {
    if (data.error) {
      finish();
      setStatus(data.error, true);
      return;
    }

    result = { stl: data.stl, settings: parameters };
    finish();
    if (viewer) {
      try {
        viewer.show(data.stl, parameters.export_part);
      } catch {
        setStatus('STL ready to download. The 3D preview could not display this model.', true);
        return;
      }
    }
    modelLabel.textContent = parameters.export_part;
    if (download.disabled) {
      setStatus('The preview uses the previous settings. Generate again to apply your changes.');
    } else if (!groups.length && !parameters.show_dividers) {
      setStatus('Model ready. With no lettering or dividers, the centre and rim are separate pieces.');
    } else {
      setStatus(viewer ? 'Model ready · Drag to rotate, scroll or pinch to zoom.' : 'STL ready to download.');
    }
  };
  worker.onerror = () => {
    finish();
    setStatus('The model generator could not load. Generate again to retry.', true);
  };
  refresh();
  setStatus(result ? 'Generating… The previous model is shown while you wait.' : 'Generating model…');
  worker.postMessage({ source, settings: parameters });
}

form.addEventListener('input', onChange);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!generate.disabled) render();
});
document.querySelector('#reset').addEventListener('click', () => {
  if (defaults) applyDefaults();
});
cancel.addEventListener('click', () => {
  running?.();
  setStatus('Generation cancelled.');
});
download.addEventListener('click', () => {
  if (download.disabled) return;
  const url = URL.createObjectURL(new Blob([result.stl], { type: 'model/stl' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNames[result.settings.export_part];
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

refresh();
try {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error('OpenSCAD file unavailable');
  const model = await response.text();
  // Read the six public Customizer defaults from the checked-in model.
  defaults = Object.fromEntries(defaultNames.map((name) => [
    name, JSON.parse(model.match(new RegExp(`^${name}\\s*=\\s*(.+?);`, 'm'))[1]),
  ]));
  source = model;
  applyDefaults();
  render();
} catch {
  setStatus('Could not load the OpenSCAD model. Reload the page to try again.', true);
}
