'use client';

/**
 * Procedurally generates a short "radio squelch" or click sound to simulate
 * ATC (Air Traffic Control) or Dispatch communications opening.
 */
export const playSquelchSound = () => {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    
    // Create a very short buffer (e.g. 0.05 seconds of noise)
    const bufferSize = audioCtx.sampleRate * 0.05; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill the buffer with white noise (random values between -1.0 and 1.0)
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Apply a bandpass filter to make it sound like comms radio
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000; // 1kHz focus
    filter.Q.value = 1.0;

    // Fade out very fast
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noise.start();
    
    // Stop and cleanup
    setTimeout(() => {
        noise.stop();
        audioCtx.close();
    }, 100);

  } catch (e) {
    console.error('AudioContext squelch failed', e);
  }
};
