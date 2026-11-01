// Proximity voice chat (online games): press T (or the 🎙 button) to switch your microphone on, and the
// players near you in the game hear you: louder up close, quieter further away, fading out altogether
// across the plane, and from the left or right depending on where you are. Everyone's voice goes straight
// to everyone else (PeerJS calls), not through the host.
'use strict';
const VOICE = { on: false, stream: null, out: new Map(), in: new Map(), hooked: null };
const VOICE_FAR = 22;                        // (metres: past this you can't hear them)
const peerIdOf = id => id === 'host' ? PEER_PREFIX + NET.room : id;   // a player's id in the snapshot → their PeerJS id
const playerIdOf = pid => pid === PEER_PREFIX + NET.room ? 'host' : pid;

async function toggleVoice() {
  if (NET.mode === 'solo') return sayLocal('🎙 Voice chat is for online games: host a room or join one.');
  if (VOICE.on) {
    VOICE.on = false;
    for (const c of VOICE.out.values()) c.close();
    VOICE.out.clear();
    if (VOICE.stream) VOICE.stream.getTracks().forEach(t => t.stop());
    VOICE.stream = null;
    return sayLocal('🎙 Microphone off');
  }
  try { VOICE.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { return sayLocal('🎙 Couldn\'t use a microphone (none plugged in, or the browser said no).'); }
  VOICE.on = true;
  sayLocal('🎙 Microphone ON: players near you can hear you. (T to switch it off)');
}
// everyone else in the room, by their snapshot id
function voicePeers() {
  if (NET.mode === 'host') return NET.remotes.map(r => r.id);
  return (NET.players || []).map(p => p.id).filter(id => id !== myId);
}
// where another player is, on your screen
function voicePos(id) {
  if (NET.mode === 'host') { const r = NET.remotes.find(r => r.id === id); return r && r.pose; }
  return (NET.players || []).find(p => p.id === id);
}
// somebody's voice arriving: through a (silent) audio element, as browsers need, then a volume and a left/right pan
function hearVoice(call, stream) {
  dropVoice(call.peer);
  initAudio(); if (!AC) return;
  const el = new Audio(); el.muted = true; el.srcObject = stream; el.play().catch(() => {});
  const src = AC.createMediaStreamSource(stream), gain = AC.createGain(), pan = AC.createStereoPanner(), meter = AC.createAnalyser();
  gain.gain.value = 0; meter.fftSize = 256;
  src.connect(gain).connect(pan).connect(AC.destination); src.connect(meter);
  VOICE.in.set(call.peer, { call, el, src, gain, pan, meter, buf: new Uint8Array(meter.fftSize), level: 0 });
}
function dropVoice(pid) {
  const v = VOICE.in.get(pid); if (!v) return;
  try { v.src.disconnect(); v.gain.disconnect(); v.pan.disconnect(); } catch (e) {}
  v.el.srcObject = null; VOICE.in.delete(pid);
}
// keep the calls going: call anyone you aren't sending your voice to yet (while your mic's on), and turn
// everyone's voice up or down by how far away they are
function voiceTick() {
  if (NET.mode === 'solo' || !peer) return;
  if (VOICE.hooked !== peer) {
    VOICE.hooked = peer;
    peer.on('call', call => {
      call.answer();
      call.on('stream', s => hearVoice(call, s));
      call.on('close', () => dropVoice(call.peer)); call.on('error', () => dropVoice(call.peer));
    });
  }
  const here = new Set(voicePeers());
  for (const [id, c] of VOICE.out) if (!here.has(id) || !c.open && c.done) { c.close(); VOICE.out.delete(id); }
  if (VOICE.on && VOICE.stream) for (const id of here) if (!VOICE.out.has(id)) {
    const c = peer.call(peerIdOf(id), VOICE.stream);
    if (!c) continue;
    VOICE.out.set(id, c);
    c.on('close', () => { c.done = true; VOICE.out.delete(id); }); c.on('error', () => { c.done = true; VOICE.out.delete(id); });
  }
}
const voiceTalking = [];
function updateVoices() {
  voiceTalking.length = 0;
  for (const [pid, v] of VOICE.in) {
    const p = voicePos(playerIdOf(pid));
    if (!p) { v.gain.gain.value = 0; continue; }
    const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz, (p.y || 0) - P.y);
    const k = clamp(1 - (d - 2) / (VOICE_FAR - 2), 0, 1);
    v.gain.gain.setTargetAtTime(k * k * 1.6, AC.currentTime, 0.1);
    v.pan.pan.setTargetAtTime(clamp((dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw)) / Math.max(d, 1), -1, 1) * 0.8, AC.currentTime, 0.1);
    // who's talking (for the little list on screen)
    v.meter.getByteTimeDomainData(v.buf);
    let sum = 0; for (const b of v.buf) sum += (b - 128) * (b - 128);
    v.level += (Math.sqrt(sum / v.buf.length) - v.level) * 0.3;
    if (v.level > 4 && k > 0) { const pl = (NET.players || []).find(q => q.id === playerIdOf(pid)) || NET.remotes.find(r => r.id === pid); voiceTalking.push(pl ? pl.name : 'Someone'); }
  }
  const box = $('voiceList');
  if (box) box.textContent = (VOICE.on ? '🎙 mic on' : '') + (voiceTalking.length ? (VOICE.on ? ' · ' : '') + '🔊 ' + voiceTalking.join(', ') : '');
}
setInterval(voiceTick, 1000);
setInterval(updateVoices, 100);
