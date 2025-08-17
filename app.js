// ---------- Small helpers ----------
const $ = (sel) => document.querySelector(sel);
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const utf8 = new TextEncoder();
const utf8dec = new TextDecoder();

async function deriveKey(password, salt) {
  const enc = utf8.encode(password);
  const baseKey = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(password, message) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(message));
  const payload = {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256-100k',
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(ctBuf)
  };
  return JSON.stringify(payload);
}

async function decrypt(password, payloadStr) {
  try {
    const payload = JSON.parse(payloadStr);
    const salt = fromB64(payload.salt);
    const iv = fromB64(payload.iv);
    const ct = fromB64(payload.ct);
    const key = await deriveKey(password, salt);
    const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return utf8dec.decode(ptBuf);
  } catch (e) {
    throw new Error('Failed to decrypt. Check password or QR contents.');
  }
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------- Encrypt & Generate ----------
$('#btn-encrypt').addEventListener('click', async () => {
  const message = $('#message').value.trim();
  const password = $('#password').value;
  $('#enc-out').textContent = '';
  $('#qrcode').innerHTML = '';

  if (!message) { $('#enc-out').textContent = 'Please enter a message.'; return; }
  if (!password) { $('#enc-out').textContent = 'Please enter a password.'; return; }

  const payload = await encrypt(password, message);
  $('#enc-out').textContent = payload;

  // Generate QR
  const qrContainer = document.getElementById('qrcode');
  const qr = new QRCode(qrContainer, {
    text: payload,
    width: 256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.M
  });

  // enable download
  setTimeout(() => {
    const img = qrContainer.querySelector('img') || qrContainer.querySelector('canvas');
    $('#btn-download').disabled = false;
    $('#btn-download').onclick = () => {
      const href = img.tagName === 'IMG' ? img.src : img.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = href;
      a.download = 'encrypted_qr.png';
      a.click();
    };
  }, 200);
});

// ---------- Scan & Decrypt ----------
const codeReader = new ZXing.BrowserMultiFormatReader();

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d => d.kind === 'videoinput');
  const sel = $('#camera-select');
  sel.innerHTML = '';
  cams.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = c.deviceId;
    opt.textContent = c.label || `Camera ${i+1}`;
    sel.appendChild(opt);
  });
}

$('#btn-start').addEventListener('click', async () => {
  $('#scan-status').textContent = 'Starting camera...';
  await listCameras();
  const deviceId = $('#camera-select').value || undefined;
  try {
    await codeReader.decodeFromVideoDevice(deviceId, 'video', (res, err) => {
      if (res) {
        $('#scan-status').textContent = 'QR detected!';
        $('#scan-out').textContent = res.getText();
      }
      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.error(err);
      }
    });
    $('#scan-status').textContent = 'Scanning... show a QR to the camera.';
  } catch (e) {
    $('#scan-status').textContent = 'Could not start camera: ' + e.message;
  }
});

$('#btn-stop').addEventListener('click', () => {
  codeReader.reset();
  $('#scan-status').textContent = 'Camera stopped.';
});

// Decode from image
$('#file-input').addEventListener('change', async (e) => {
  $('#scan-out').textContent = '';
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = $('#img-preview');
  img.src = url;
  img.style.display = 'block';
  try {
    const res = await ZXing.BrowserQRCodeReader.decodeFromImageUrl(url);
    $('#scan-out').textContent = res.getText();
  } catch (err) {
    $('#scan-out').textContent = 'No QR code found in image.';
  }
});

// Decrypt button
$('#btn-decrypt').addEventListener('click', async () => {
  const payload = $('#scan-out').textContent.trim();
  const pwd = $('#password-scan').value;
  if (!payload) { alert('No QR payload to decrypt yet. Scan or load an image first.'); return; }
  if (!pwd) { alert('Enter the password used during encryption.'); return; }
  try {
    const plain = await decrypt(pwd, payload);
    alert('Decrypted message:\n\n' + plain);
  } catch (e) {
    alert(e.message);
  }
});

// Prepare camera list on load
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    stream.getTracks().forEach(t => t.stop());
    listCameras();
  }).catch(() => {/* ignore */});
}
