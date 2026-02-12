const NOTE_LAYOUT = [
  ['KeyA', 0, 'C'],
  ['KeyW', 1, 'C#'],
  ['KeyS', 2, 'D'],
  ['KeyE', 3, 'D#'],
  ['KeyD', 4, 'E'],
  ['KeyF', 5, 'F'],
  ['KeyT', 6, 'F#'],
  ['KeyG', 7, 'G'],
  ['KeyY', 8, 'G#'],
  ['KeyH', 9, 'A'],
  ['KeyU', 10, 'A#'],
  ['KeyJ', 11, 'B'],
  ['KeyK', 12, 'C'],
];

const outputSelect = document.getElementById('midi-output');
const refreshButton = document.getElementById('refresh');
const statusElement = document.getElementById('status');
const octaveInput = document.getElementById('octave');
const octaveValue = document.getElementById('octave-value');
const velocityInput = document.getElementById('velocity');
const velocityValue = document.getElementById('velocity-value');
const keysContainer = document.getElementById('keys');

let midiAccess;
let activeOutput;
const activeNotes = new Map();

function setStatus(message) {
  statusElement.textContent = message;
}

function buildKeyMapUI() {
  keysContainer.innerHTML = '';
  NOTE_LAYOUT.forEach(([code, semitone, label]) => {
    const key = document.createElement('div');
    key.className = 'key';
    key.dataset.code = code;
    key.innerHTML = `<strong>${code.replace('Key', '')}</strong><span class="note">${label}${semitone > 11 ? '+' : ''}</span>`;
    keysContainer.appendChild(key);
  });
}

function setKeyVisual(code, pressed) {
  const keyElement = keysContainer.querySelector(`[data-code="${code}"]`);
  if (keyElement) {
    keyElement.classList.toggle('active', pressed);
  }
}

function noteNumberForCode(code) {
  const hit = NOTE_LAYOUT.find((item) => item[0] === code);
  if (!hit) {
    return null;
  }
  const semitone = hit[1];
  const octave = Number(octaveInput.value);
  return octave * 12 + semitone;
}

function sendNoteOn(code) {
  if (!activeOutput || activeNotes.has(code)) {
    return;
  }
  const note = noteNumberForCode(code);
  if (note === null) {
    return;
  }
  const velocity = Number(velocityInput.value);
  activeOutput.send([0x90, note, velocity]);
  activeNotes.set(code, note);
  setKeyVisual(code, true);
}

function sendNoteOff(code) {
  if (!activeOutput || !activeNotes.has(code)) {
    return;
  }
  const note = activeNotes.get(code);
  activeOutput.send([0x80, note, 0]);
  activeNotes.delete(code);
  setKeyVisual(code, false);
}

function stopAllNotes() {
  for (const [code, note] of activeNotes.entries()) {
    activeOutput?.send([0x80, note, 0]);
    setKeyVisual(code, false);
  }
  activeNotes.clear();
}

function populateOutputs() {
  const outputs = [...midiAccess.outputs.values()];
  outputSelect.innerHTML = '';

  if (outputs.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay dispositivos MIDI';
    outputSelect.appendChild(option);
    activeOutput = null;
    setStatus('Conecta un dispositivo MIDI y pulsa Actualizar.');
    return;
  }

  outputs.forEach((output, index) => {
    const option = document.createElement('option');
    option.value = output.id;
    option.textContent = output.name ?? `MIDI ${index + 1}`;
    outputSelect.appendChild(option);
  });

  activeOutput = outputs[0];
  outputSelect.value = activeOutput.id;
  setStatus(`Conectado a: ${activeOutput.name}`);
}

outputSelect.addEventListener('change', () => {
  stopAllNotes();
  activeOutput = midiAccess.outputs.get(outputSelect.value);
  setStatus(activeOutput ? `Conectado a: ${activeOutput.name}` : 'Sin salida MIDI activa.');
});

refreshButton.addEventListener('click', () => {
  stopAllNotes();
  populateOutputs();
});

octaveInput.addEventListener('input', () => {
  octaveValue.textContent = octaveInput.value;
  stopAllNotes();
});

velocityInput.addEventListener('input', () => {
  velocityValue.textContent = velocityInput.value;
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }
  sendNoteOn(event.code);
});

window.addEventListener('keyup', (event) => {
  sendNoteOff(event.code);
});

window.addEventListener('blur', stopAllNotes);

async function init() {
  buildKeyMapUI();
  octaveValue.textContent = octaveInput.value;
  velocityValue.textContent = velocityInput.value;

  if (!('requestMIDIAccess' in navigator)) {
    setStatus('Tu navegador no soporta Web MIDI. Usa una versión reciente de Chrome o Edge.');
    outputSelect.disabled = true;
    refreshButton.disabled = true;
    return;
  }

  try {
    midiAccess = await navigator.requestMIDIAccess();
    populateOutputs();
    midiAccess.onstatechange = populateOutputs;
  } catch {
    setStatus('No se pudo obtener acceso MIDI. Revisa permisos del navegador.');
  }
}

init();
