const paths = {
  shield: '<path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.8 7.5-9.5V6L12 3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/>',
  settings: '<path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.4L4 10.7v2.6l-1.8 1.7 2 3.4 2.2-.7 2 .9L9 21h6l.6-2.4 2-.9 2.2.7 2-3.4-1.8-1.7v-2.6L21.8 9l-2-3.4-2.2.7-2-.9L15 3Z"/><circle cx="12" cy="12" r="3.2"/>',
  mirror: '<path d="M12 3v18M8 5 3 18h5V5Zm8 0 5 13h-5V5Z" stroke-linejoin="round"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9v4.5l2.5 1.5M9 2h6M12 2v3M18 5l2 2"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  camera: '<path d="m8 6 1.5-3h5L16 6h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  sparkles: '<path d="m10 3 2.3 5.7L18 11l-5.7 2.3L10 19l-2.3-5.7L2 11l5.7-2.3L10 3ZM19 2v4m-2-2h4M20 16v6m-3-3h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10 10.5Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  flip: '<path d="M20 7a9 9 0 0 0-15.6-1M4 3v4h4M4 17a9 9 0 0 0 15.6 1M20 21v-4h-4"/><rect x="8" y="8" width="8" height="8" rx="2"/><circle cx="12" cy="12" r="1.5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

const byId = id => document.getElementById(id);
const video = byId('camera-video');
const shutter = byId('shutter-button');
const enableButton = byId('enable-camera');
const flipButton = byId('flip-button');
const lookChoices = [...document.querySelectorAll('.look-choice')];
const photos = [];
let stream = null;
let facingMode = 'user';
let mirrored = true;
let gridVisible = false;
let timerSeconds = 0;
let selectedLook = 'Daylight';
let cameraPending = false;
let capturing = false;
let countdownController = null;
let toastTimeout;
let requestVersion = 0;

function toast(message) {
  clearTimeout(toastTimeout);
  byId('toast').textContent = message;
  byId('toast').hidden = false;
  toastTimeout = setTimeout(() => { byId('toast').hidden = true; }, 3200);
}

function syncCameraControls() {
  const ready = Boolean(stream?.active && video.readyState >= 2);
  shutter.disabled = !ready || capturing || cameraPending;
  flipButton.disabled = !ready || capturing || cameraPending;
  enableButton.disabled = cameraPending;
}

function showSample(title, description) {
  video.hidden = true;
  document.querySelector('.sample-image').hidden = false;
  byId('camera-request').hidden = false;
  byId('live-caption').hidden = true;
  byId('status-label').textContent = 'Sample preview';
  byId('camera-status').classList.remove('is-live');
  byId('request-title').textContent = title;
  byId('request-description').textContent = description;
  syncCameraControls();
}

async function openCamera() {
  if (cameraPending) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showSample('Your camera needs a secure connection.', 'Open this page on localhost or HTTPS to use your camera.');
    return;
  }

  const version = ++requestVersion;
  cameraPending = true;
  syncCameraControls();
  byId('request-title').textContent = 'A moment, we’re opening your camera.';
  byId('request-description').textContent = 'Allow camera access in your browser to get started.';
  byId('status-label').textContent = 'Opening camera';
  if (stream) {
    const previous = stream;
    stream = null;
    previous.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    video.hidden = true;
  }

  let nextStream;
  try {
    nextStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    if (version !== requestVersion) { nextStream.getTracks().forEach(track => track.stop()); return; }
    video.srcObject = nextStream;
    await video.play();
    if (version !== requestVersion) { nextStream.getTracks().forEach(track => track.stop()); return; }
    stream = nextStream;
    const actualFacing = nextStream.getVideoTracks()[0]?.getSettings().facingMode;
    if (actualFacing) facingMode = actualFacing;
    setMirror(mirrored);
    video.hidden = false;
    document.querySelector('.sample-image').hidden = true;
    byId('camera-request').hidden = true;
    byId('live-caption').hidden = false;
    byId('status-label').textContent = 'Live camera';
    byId('camera-status').classList.add('is-live');
    nextStream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (stream !== nextStream) return;
      stream = null;
      countdownController?.abort();
      showSample('Your camera has paused.', 'Reconnect your camera to get back into the frame.');
    }));
  } catch (error) {
    nextStream?.getTracks().forEach(track => track.stop());
    if (version !== requestVersion) return;
    stream = null;
    video.srcObject = null;
    const messages = {
      NotAllowedError: ['Your camera, whenever you’re ready.', 'Allow camera access in your browser, then try again.'],
      NotFoundError: ['No camera connected just yet.', 'Connect a camera, then try again.'],
      NotReadableError: ['Your camera is busy.', 'Close other apps using your camera, then try again.'],
      OverconstrainedError: ['Let’s try your camera again.', 'Check your camera connection, then try again.'],
    };
    showSample(...(messages[error.name] || ['We couldn’t open your camera.', 'Check your camera connection and try again.']));
    enableButton.innerHTML = `Try again${icon('arrow')}`;
  } finally {
    if (version === requestVersion) {
      cameraPending = false;
      syncCameraControls();
    }
  }
}

function setMirror(value) {
  mirrored = value;
  video.classList.toggle('is-mirrored', mirrored && facingMode === 'user');
  byId('mirror-button').setAttribute('aria-pressed', String(mirrored));
  byId('mirror-label').textContent = mirrored ? 'Mirror on' : 'Mirror off';
  byId('mirror-setting').checked = mirrored;
}

function setGrid(value) {
  gridVisible = value;
  byId('composition-grid').hidden = !value;
  byId('grid-button').setAttribute('aria-pressed', String(value));
  byId('grid-button').setAttribute('aria-label', `${value ? 'Hide' : 'Show'} composition grid`);
  byId('grid-setting').checked = value;
}

function setTimer(value) {
  timerSeconds = Number(value);
  byId('timer-label').textContent = timerSeconds ? `${timerSeconds}s timer` : 'Timer off';
  byId('timer-button').setAttribute('aria-label', `Set capture timer. Currently ${timerSeconds ? `${timerSeconds} seconds` : 'off'}`);
  byId('timer-setting').value = String(timerSeconds);
}

function selectLook(choice) {
  selectedLook = choice.dataset.look;
  lookChoices.forEach(button => {
    const selected = button === choice;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  byId('current-look-label').textContent = selectedLook;
}

lookChoices.forEach((choice, index) => {
  choice.addEventListener('click', () => selectLook(choice));
  choice.addEventListener('keydown', event => {
    const movements = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next;
    if (event.key in movements) next = (index + movements[event.key] + lookChoices.length) % lookChoices.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = lookChoices.length - 1;
    else return;
    event.preventDefault();
    selectLook(lookChoices[next]);
    lookChoices[next].focus();
  });
});

const delay = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
  const onAbort = () => { clearTimeout(timeout); reject(new DOMException('Cancelled', 'AbortError')); };
  const timeout = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
  signal.addEventListener('abort', onAbort, { once: true });
});

async function takePhoto() {
  if (shutter.disabled || capturing || !stream?.active || !video.videoWidth) return;
  capturing = true;
  countdownController = new AbortController();
  const { signal } = countdownController;
  syncCameraControls();
  try {
    for (let remaining = timerSeconds; remaining > 0; remaining--) {
      byId('countdown').hidden = false;
      byId('countdown').textContent = String(remaining);
      await delay(1000, signal);
    }
    byId('countdown').hidden = true;
    if (!stream?.active || signal.aborted) return;
    const bounds = byId('viewfinder').getBoundingClientRect();
    const outputRatio = bounds.width / bounds.height;
    const inputRatio = video.videoWidth / video.videoHeight;
    const sourceWidth = inputRatio > outputRatio ? video.videoHeight * outputRatio : video.videoWidth;
    const sourceHeight = inputRatio > outputRatio ? video.videoHeight : video.videoWidth / outputRatio;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth);
    canvas.height = Math.round(sourceHeight);
    const context = canvas.getContext('2d');
    if (mirrored && facingMode === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1); }
    context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .93));
    if (!blob || signal.aborted) return;
    const photo = { url: URL.createObjectURL(blob), time: new Date(), width: canvas.width, height: canvas.height };
    photos.unshift(photo);
    if (photos.length > 12) URL.revokeObjectURL(photos.pop().url);
    const thumbnail = new Image();
    thumbnail.src = photo.url;
    thumbnail.alt = 'Your latest photo';
    byId('gallery-thumbnail').replaceChildren(thumbnail);
    byId('photo-count').textContent = String(photos.length);
    byId('photo-count').hidden = false;
    shutter.setAttribute('aria-label', 'Take another photo');
    const flash = byId('capture-flash');
    flash.classList.remove('is-flashing');
    requestAnimationFrame(() => { requestAnimationFrame(() => flash.classList.add('is-flashing')); });
    toast('A moment, kept. Find it in Your photos.');
    renderGallery();
  } catch (error) {
    if (error.name !== 'AbortError') toast('Couldn’t save that moment. Try taking another photo.');
  } finally {
    byId('countdown').hidden = true;
    capturing = false;
    countdownController = null;
    syncCameraControls();
  }
}

function renderGallery() {
  byId('gallery-empty').hidden = photos.length > 0;
  const cards = photos.map(photo => {
    const card = document.createElement('figure');
    card.className = 'photo-card';
    const image = new Image();
    image.src = photo.url;
    image.alt = `Photo taken at ${photo.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    image.width = photo.width;
    image.height = photo.height;
    const download = document.createElement('a');
    download.href = photo.url;
    download.download = `mira-${photo.time.toISOString().replace(/[:.]/g, '-')}.jpg`;
    download.innerHTML = `Download${icon('download')}`;
    download.setAttribute('aria-label', `Download ${image.alt.toLowerCase()}`);
    card.append(image, download);
    return card;
  });
  byId('gallery-grid').replaceChildren(...cards);
}

enableButton.addEventListener('click', openCamera);
shutter.addEventListener('click', takePhoto);
flipButton.addEventListener('click', async () => {
  const previousFacing = facingMode;
  const previousDevice = stream?.getVideoTracks()[0]?.getSettings().deviceId;
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  await openCamera();
  const nextDevice = stream?.getVideoTracks()[0]?.getSettings().deviceId;
  if (!stream || (previousDevice && previousDevice === nextDevice)) {
    facingMode = previousFacing;
    setMirror(mirrored);
    if (stream) toast('This device has one available camera.');
  } else if (previousFacing === facingMode) toast('This device has one available camera.');
});
byId('mirror-button').addEventListener('click', () => setMirror(!mirrored));
byId('mirror-setting').addEventListener('change', event => setMirror(event.target.checked));
byId('grid-button').addEventListener('click', () => setGrid(!gridVisible));
byId('grid-setting').addEventListener('change', event => setGrid(event.target.checked));
byId('timer-button').addEventListener('click', () => { const options = [0, 3, 10]; setTimer(options[(options.indexOf(timerSeconds) + 1) % options.length]); });
byId('timer-setting').addEventListener('change', event => setTimer(event.target.value));

for (const [buttonId, dialogId] of [['settings-button', 'settings-dialog'], ['privacy-button', 'privacy-dialog'], ['gallery-button', 'gallery-dialog']]) {
  byId(buttonId).addEventListener('click', () => byId(dialogId).showModal());
}
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && capturing) countdownController?.abort();
  if (event.code !== 'Space' || event.repeat || document.querySelector('dialog[open]')) return;
  const target = event.target;
  if (target.closest('button,a,input,select,textarea') || target.isContentEditable) return;
  event.preventDefault();
  takePhoto();
});

window.addEventListener('pagehide', () => {
  requestVersion++;
  countdownController?.abort();
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  cameraPending = false;
  syncCameraControls();
});
window.addEventListener('pageshow', event => { if (event.persisted) openCamera(); });

openCamera();
