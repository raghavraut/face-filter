const paths = {
  'flash-off': '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/><path d="m3 3 18 18" stroke-width="2.7"/>',
  camera: '<path d="m8 6 1.5-3h5L16 6h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
  sparkles: '<path d="m10 3 2.3 5.7L18 11l-5.7 2.3L10 19l-2.3-5.7L2 11l5.7-2.3L10 3ZM19 2v4m-2-2h4M20 16v6m-3-3h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10 10.5Z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.6" fill="#000" stroke="none"/><path d="m4 18 5-6 4 3 3-5 4 8Z" fill="#000" stroke="none"/>',
  flip: '<path d="M20 7A9 9 0 0 0 4.4 6M4 2v5h5M4 17a9 9 0 0 0 15.6 1M20 22v-5h-5"/>',
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
let cameraPending = false;
let capturing = false;
let toastTimeout;
let requestVersion = 0;
function toast(message) {
  clearTimeout(toastTimeout);
  byId('toast').textContent = message;
  byId('toast').hidden = false;
  toastTimeout = setTimeout(() => { byId('toast').hidden = true; }, 2800);
}
function syncCameraControls() {
  const ready = Boolean(stream?.active && video.readyState >= 2);
  shutter.disabled = !ready || capturing || cameraPending;
  flipButton.disabled = !ready || capturing || cameraPending;
  enableButton.disabled = cameraPending;
}
function showCameraOff(title, description) {
  stopRecording();
  video.hidden = true;
  byId('camera-request').hidden = false;
  byId('status-label').textContent = 'Camera is off';
  byId('request-title').textContent = title;
  byId('request-description').textContent = description;
  syncCameraControls();
}
async function openCamera() {
  if (cameraPending) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraOff('Camera unavailable', 'Open this page on localhost or HTTPS to use your camera.');
    return;
  }
  const version = ++requestVersion;
  cameraPending = true;
  syncCameraControls();
  byId('request-title').textContent = 'Opening camera';
  byId('request-description').textContent = 'Allow camera access in your browser to get started.';
  byId('status-label').textContent = 'Opening camera';
  enableButton.textContent = 'Waiting for permission';
  if (stream) {
    const previous = stream;
    stream = null;
    previous.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    video.hidden = true;
  }
  let nextStream;
  try {
    nextStream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}}});
    if (version !== requestVersion) { nextStream.getTracks().forEach(track => track.stop()); return; }
    video.srcObject = nextStream;
    await video.play();
    if (version !== requestVersion) { nextStream.getTracks().forEach(track => track.stop()); return; }
    stream = nextStream;
    const actualFacing = nextStream.getVideoTracks()[0]?.getSettings().facingMode;
    if (actualFacing) facingMode = actualFacing;
    video.classList.toggle('is-mirrored', facingMode === 'user');
    video.hidden = false;
    byId('camera-request').hidden = true;
    byId('status-label').textContent = 'Live camera';
    startRecording(nextStream);
    nextStream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (stream !== nextStream) return;
      stream = null;
      showCameraOff('Camera paused', 'Reconnect your camera, then try again.');
      enableButton.textContent = 'Try again';
    }));
  } catch (error) {
    nextStream?.getTracks().forEach(track => track.stop());
    if (version !== requestVersion) return;
    stream = null;
    video.srcObject = null;
    const messages = {
      NotAllowedError: ['Camera is off', 'Allow camera access in your browser, then try again.'],
      NotFoundError: ['No camera found', 'Connect a camera, then try again.'],
      NotReadableError: ['Camera is busy', 'Close other apps using your camera, then try again.'],
      OverconstrainedError: ['Camera unavailable', 'Check your camera connection, then try again.'],
    };
    showCameraOff(...(messages[error.name] || ['Camera unavailable', 'Check your camera connection, then try again.']));
    enableButton.textContent = 'Try again';
  } finally {
    if (version === requestVersion) { cameraPending = false; syncCameraControls(); }
  }
}
function selectLook(choice) {
  const selectedIndex = lookChoices.indexOf(choice);
  const positions = ['center', 'right', 'left'];
  lookChoices.forEach((button, index) => {
    const selected = button === choice;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.dataset.position = positions[(index - selectedIndex + lookChoices.length) % lookChoices.length];
  });
  byId('current-look-label').textContent = choice.dataset.look;
}
lookChoices.forEach((choice, index) => {
  choice.addEventListener('click', () => selectLook(choice));
  choice.addEventListener('keydown', event => {
    const movements = {ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1};
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
function renderFrame() {
  const bounds = byId('viewfinder').getBoundingClientRect();
  const outputRatio = bounds.width / bounds.height;
  const inputRatio = video.videoWidth / video.videoHeight;
  const sourceWidth = inputRatio > outputRatio ? video.videoHeight * outputRatio : video.videoWidth;
  const sourceHeight = inputRatio > outputRatio ? video.videoHeight : video.videoWidth / outputRatio;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth);
  canvas.height = Math.round(sourceHeight);
  const context = canvas.getContext('2d');
  if (facingMode === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1); }
  context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function takePhoto() {
  if (shutter.disabled || capturing || !stream?.active || !video.videoWidth) return;
  capturing = true;
  const version = requestVersion;
  syncCameraControls();
  try {
    const canvas = renderFrame();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .93));
    if (!blob || version !== requestVersion) return;
    const photo = {url:URL.createObjectURL(blob),time:new Date(),width:canvas.width,height:canvas.height};
    photos.unshift(photo);
    if (photos.length > 12) URL.revokeObjectURL(photos.pop().url);
    const thumbnail = new Image(); thumbnail.src = photo.url; thumbnail.alt = 'Your latest photo';
    byId('gallery-thumbnail').replaceChildren(thumbnail);
    byId('photo-count').textContent = String(photos.length);
    byId('photo-count').hidden = false;
    shutter.setAttribute('aria-label', 'Take another photo');
    const flash = byId('capture-flash'); flash.classList.remove('is-flashing');
    requestAnimationFrame(() => { requestAnimationFrame(() => flash.classList.add('is-flashing')); });
    toast('Photo saved. Open your photos to download it.');
    renderGallery();
  } catch { toast('Couldn’t save your photo. Try again.'); }
  finally { capturing = false; syncCameraControls(); }
}
function renderGallery() {
  byId('gallery-empty').hidden = photos.length > 0;
  const cards = photos.map(photo => {
    const card = document.createElement('figure'); card.className = 'photo-card';
    const image = new Image(); image.src = photo.url;
    image.alt = `Photo taken at ${photo.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    image.width = photo.width; image.height = photo.height;
    const download = document.createElement('a'); download.href = photo.url;
    download.download = `mira-${photo.time.toISOString().replace(/[:.]/g, '-')}.jpg`;
    download.innerHTML = `Download${icon('download')}`;
    download.setAttribute('aria-label', `Download ${image.alt.toLowerCase()}`);
    card.append(image, download); return card;
  });
  byId('gallery-grid').replaceChildren(...cards);
}
const CONFIG_KEY = 'mira.surveillance';
const config = {url:'', key:'', segmentSeconds:5, sensitivity:12};
const relayQueue = [];
const relayState = {uploading:false, wantClipFrom:0, lastAlertAt:0};
const recording = {instance:null, active:false, startedAt:0, segments:0, rotateTimer:0, clockTimer:0, snapshotTimer:0};
const motion = {canvas:document.createElement('canvas'), context:null, previous:null, hits:0, timer:0};
motion.canvas.width = 64;
motion.canvas.height = 48;
motion.context = motion.canvas.getContext('2d', {willReadFrequently:true});
const relayConfigured = () => Boolean(config.url && config.key);
function supportedMimeType() {
  if (!window.MediaRecorder) return '';
  return ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';
}
function setBadge(state, meta) { byId('rec-badge').dataset.state = state; byId('rec-meta').textContent = meta; }
function badgeClock() {
  const elapsed = Math.max(0, Math.floor((Date.now() - recording.startedAt) / 1000));
  const queued = relayQueue.length ? ` · ${relayQueue.length} queued` : '';
  setBadge('live', `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')} · ${recording.segments} seg${queued}`);
}
async function relayFetch(path, options = {}) {
  const response = await fetch(`${config.url.replace(/\/+$/, '')}${path}`, {...options, headers: {...(options.headers || {}), 'x-mira-key': config.key}});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `relay replied ${response.status}`);
  return payload;
}
function enqueueUpload(blob, kind) {
  if (!relayConfigured()) return;
  relayQueue.push({blob, kind});
  if (relayState.uploading) return;
  pumpQueue();
}
async function pumpQueue() {
  relayState.uploading = true;
  while (relayQueue.length) {
    const item = relayQueue[0];
    let stored = null;
    for (let attempt = 1; attempt <= 3 && !stored; attempt++) {
      try {
        stored = await relayFetch(`/upload?kind=${item.kind}`, {method:'POST', headers:{'content-type': item.kind === 'snapshot' ? 'image/jpeg' : 'video/webm'}, body:item.blob});
      } catch (error) {
        if (attempt === 3) console.warn('Mira relay upload failed, dropping this item.', error);
        else await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
    relayQueue.shift();
    if (!stored) { setBadge('error', 'upload failed'); continue; }
    const clip = item.kind === 'segment' && relayState.wantClipFrom && Date.now() >= relayState.wantClipFrom;
    if (!clip && item.kind !== 'snapshot') continue;
    if (clip) relayState.wantClipFrom = 0;
    try {
      await relayFetch('/notify', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({kind: clip ? 'clip' : 'snapshot', key: stored.key, note:'Motion detected', at:new Date().toISOString()})});
    } catch (error) { console.warn('Mira relay notify failed.', error); }
  }
  relayState.uploading = false;
  if (recording.active) badgeClock();
}
function beginSegment(activeStream) {
  const mimeType = supportedMimeType();
  const chunks = [];
  const instance = new MediaRecorder(activeStream, {mimeType, videoBitsPerSecond:1200000});
  instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  instance.onstop = () => {
    const stillCurrent = recording.instance === instance;
    if (stillCurrent) { recording.instance = null; clearTimeout(recording.rotateTimer); }
    const blob = new Blob(chunks, {type:mimeType.split(';')[0]});
    if (blob.size) { recording.segments += 1; enqueueUpload(blob, 'segment'); }
    if (stillCurrent && recording.active && stream?.active) beginSegment(stream);
  };
  recording.instance = instance;
  instance.start(1000);
  clearTimeout(recording.rotateTimer);
  recording.rotateTimer = setTimeout(() => {
    if (instance.state !== 'inactive') { instance.requestData(); instance.stop(); }
  }, config.segmentSeconds * 1000);
}
function stopRecording() {
  recording.active = false;
  clearInterval(recording.clockTimer);
  clearTimeout(recording.rotateTimer);
  clearInterval(recording.snapshotTimer);
  recording.snapshotTimer = 0;
  stopMotionWatch();
  const instance = recording.instance;
  recording.instance = null;
  if (instance && instance.state !== 'inactive') instance.stop();
  setBadge('off', 'paused');
}
function startRecording(activeStream) {
  stopRecording();
  if (!activeStream?.active) return;
  if (!supportedMimeType()) { setBadge('error', 'recording unsupported'); return; }
  recording.active = true;
  recording.startedAt = Date.now();
  beginSegment(activeStream);
  watchMotion();
  recording.clockTimer = setInterval(badgeClock, 1000);
  badgeClock();
  recording.snapshotTimer = setInterval(() => captureSnapshot(), 1000);
  captureSnapshot();
}
function measureMotion() {
  motion.context.drawImage(video, 0, 0, motion.canvas.width, motion.canvas.height);
  const frame = motion.context.getImageData(0, 0, motion.canvas.width, motion.canvas.height).data;
  const previous = motion.previous;
  motion.previous = frame;
  if (!previous) return 0;
  let total = 0;
  for (let index = 0; index < frame.length; index += 4) total += Math.abs(frame[index] - previous[index]);
  return total / (frame.length / 4);
}
function watchMotion() {
  stopMotionWatch();
  if (!stream?.active) return;
  motion.timer = setInterval(() => {
    if (!stream?.active || video.readyState < 2 || !video.videoWidth) return;
    motion.hits = measureMotion() >= config.sensitivity ? motion.hits + 1 : 0;
    if (motion.hits < 2) return;
    motion.hits = 0;
    if (Date.now() - relayState.lastAlertAt < 60000) return;
    relayState.lastAlertAt = Date.now();
    captureAlert();
  }, 1000);
}
function stopMotionWatch() { clearInterval(motion.timer); motion.timer = 0; motion.previous = null; motion.hits = 0; }
async function captureSnapshot() {
  if (!video.videoWidth) return;
  const blob = await new Promise(resolve => renderFrame().toBlob(resolve, 'image/jpeg', .8));
  if (blob) enqueueUpload(blob, 'snapshot');
}
async function captureAlert() {
  if (!video.videoWidth) return;
  relayState.wantClipFrom = Date.now();
  captureSnapshot();
}
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    if (typeof saved.url === 'string') config.url = saved.url;
    if (typeof saved.key === 'string') config.key = saved.key;
    if ([5, 30, 60, 300].includes(saved.segmentSeconds)) config.segmentSeconds = saved.segmentSeconds;
    if ([6, 12, 22].includes(saved.sensitivity)) config.sensitivity = saved.sensitivity;
  } catch { localStorage.removeItem(CONFIG_KEY); }
}
function storeConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* storage unavailable */ }
}
function openSettings() {
  byId('segment-seconds').value = String(config.segmentSeconds);
  byId('sensitivity').value = String(config.sensitivity);
  byId('relay-status').textContent = 'Recording starts automatically.';
  byId('settings-dialog').showModal();
}
async function saveSettings() {
  config.segmentSeconds = Number(byId('segment-seconds').value);
  config.sensitivity = Number(byId('sensitivity').value);
  storeConfig();
  if (stream?.active) startRecording(stream);
  byId('settings-dialog').close();
  toast('Recording settings saved.');
}
function clearSettings() {
  config.segmentSeconds = 60;
  config.sensitivity = 12;
  storeConfig();
  relayQueue.length = 0;
  stopRecording();
  byId('relay-status').textContent = 'Settings reset.';
  byId('segment-seconds').value = String(config.segmentSeconds);
  byId('sensitivity').value = String(config.sensitivity);
}
byId('rec-badge').addEventListener('click', openSettings);
byId('relay-save').addEventListener('click', saveSettings);
byId('relay-clear').addEventListener('click', clearSettings);
loadConfig();
setBadge('off', 'paused');
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
    video.classList.toggle('is-mirrored', facingMode === 'user');
    if (stream) toast('This device has one available camera.');
  } else if (previousFacing === facingMode) toast('This device has one available camera.');
});
byId('gallery-button').addEventListener('click', () => byId('gallery-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
byId('gallery-dialog').addEventListener('click', event => {
  const dialog = byId('gallery-dialog'); const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || document.querySelector('dialog[open]')) return;
  if (event.target.closest('button,a,input,select,textarea') || event.target.isContentEditable) return;
  event.preventDefault(); takePhoto();
});
window.addEventListener('pagehide', () => {
  requestVersion++; stopRecording();
  stream?.getTracks().forEach(track => track.stop());
  stream = null; video.srcObject = null; cameraPending = false; syncCameraControls();
});
window.addEventListener('pageshow', event => { if (event.persisted) openCamera(); });
openCamera();
