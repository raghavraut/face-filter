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
async function takePhoto() {
  if (shutter.disabled || capturing || !stream?.active || !video.videoWidth) return;
  capturing = true;
  const version = requestVersion;
  syncCameraControls();
  try {
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
  requestVersion++; stream?.getTracks().forEach(track => track.stop());
  stream = null; video.srcObject = null; cameraPending = false; syncCameraControls();
});
window.addEventListener('pageshow', event => { if (event.persisted) openCamera(); });
openCamera();
