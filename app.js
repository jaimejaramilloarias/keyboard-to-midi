const MIN_NOTE = 36; // C2
const MAX_NOTE = 84; // C6
const SHIFT_LAYER_SEMITONES = 24; // +2 octavas

const KEYBOARD_LAYOUT = [
  ['KeyA', 0],
  ['KeyW', 1],
  ['KeyS', 2],
  ['KeyE', 3],
  ['KeyD', 4],
  ['KeyF', 5],
  ['KeyT', 6],
  ['KeyG', 7],
  ['KeyY', 8],
  ['KeyH', 9],
  ['KeyU', 10],
  ['KeyJ', 11],
  ['KeyK', 12],
  ['KeyO', 13],
  ['KeyL', 14],
  ['KeyP', 15],
  ['Semicolon', 16],
  ['Quote', 17],
  ['BracketRight', 18],
  ['Backslash', 19],
  ['KeyZ', 20],
  ['KeyX', 21],
  ['KeyC', 22],
  ['KeyV', 23],
  ['KeyB', 24],
];

const outputSelect = document.getElementById('midi-output');
const refreshButton = document.getElementById('refresh');
const statusElement = document.getElementById('status');
const velocityInput = document.getElementById('velocity');
const velocityValue = document.getElementById('velocity-value');
const keysContainer = document.getElementById('keys');

let midiAccess;
let activeOutput;
const activeNotes = new Map();

function setStatus(message) {
  statusElement.textContent = message;
}

function midiToName(note) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

function keyLabelFromCode(code) {
  const map = { Semicolon: ';', Quote: "'", BracketRight: ']', Backslash: '\\' };
  return map[code] ?? code.replace('Key', '');
}

function keyOffsetForCode(code) {
  const hit = KEYBOARD_LAYOUT.find(([key]) => key === code);
  return hit ? hit[1] : null;
}

function noteNumberForEvent(event) {
  const offset = keyOffsetForCode(event.code);
  if (offset === null) return null;

  const layerOffset = event.shiftKey ? SHIFT_LAYER_SEMITONES : 0;
  const note = MIN_NOTE + offset + layerOffset;
  return note >= MIN_NOTE && note <= MAX_NOTE ? note : null;
}

function renderKeyMapUI() {
  keysContainer.innerHTML = '';

  KEYBOARD_LAYOUT.forEach(([code, offset]) => {
    const baseNote = MIN_NOTE + offset;
    const shiftedNote = baseNote + SHIFT_LAYER_SEMITONES;

    const key = document.createElement('div');
    key.className = 'key';
    key.dataset.code = code;
    key.innerHTML = `
      <strong>${keyLabelFromCode(code)}</strong>
      <span class="note">${midiToName(baseNote)}</span>
      <span class="note alt">Shift: ${midiToName(shiftedNote)}</span>
    `;

    keysContainer.appendChild(key);
  });
}

function setKeyVisual(code, pressed) {
  const keyElement = keysContainer.querySelector(`[data-code="${code}"]`);
  if (keyElement) keyElement.classList.toggle('active', pressed);
}

function sendNoteOn(event) {
  if (!activeOutput || activeNotes.has(event.code)) return;

  const note = noteNumberForEvent(event);
  if (note === null) return;

  activeOutput.send([0x90, note, Number(velocityInput.value)]);
  activeNotes.set(event.code, note);
  setKeyVisual(event.code, true);
}

function sendNoteOff(code) {
  if (!activeOutput || !activeNotes.has(code)) return;

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

velocityInput.addEventListener('input', () => {
  velocityValue.textContent = velocityInput.value;
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  sendNoteOn(event);
});

window.addEventListener('keyup', (event) => {
  sendNoteOff(event.code);
});

window.addEventListener('blur', stopAllNotes);

async function init() {
  renderKeyMapUI();
  velocityValue.textContent = velocityInput.value;

  if (!('requestMIDIAccess' in navigator)) {
    setStatus('Tu navegador no soporta Web MIDI. Usa Chrome o Edge.');
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
