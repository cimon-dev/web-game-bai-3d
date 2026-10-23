/**
 * Procedural Audio Synthesizer for 3D Card Game
 * Generates all sounds dynamically using the Web Audio API without requiring any external audio files.
 */
export class SoundEffects {
  private static instance: SoundEffects;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private isSfxEnabled: boolean = true;
  private isBgmEnabled: boolean = true;
  private masterVolume: number = 0.8;

  private bgmOscillators: OscillatorNode[] = [];
  private bgmIntervalId: number | null = null;

  private constructor() {
    this.loadSettings();
  }

  public static getInstance(): SoundEffects {
    if (!SoundEffects.instance) {
      SoundEffects.instance = new SoundEffects();
    }
    return SoundEffects.instance;
  }

  private initContext(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.isSfxEnabled ? 1.0 : 0.0;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.isBgmEnabled ? 0.35 : 0.0;
      this.bgmGain.connect(this.masterGain);
    } catch (err) {
      console.warn('Web Audio not supported or blocked by user gesture:', err);
    }
  }

  public resume(): void {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Sound: Card dealing whoosh / flick
   */
  public playCardDeal(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(3, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Sound: Card placed onto the table (satisfying felt tap/thud)
   */
  public playCardPlace(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Sound: Card selection click
   */
  public playCardSelect(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Sound: Turn timer ticking (last 5 seconds warning)
   */
  public playTick(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playTimerTick(): void {
    this.playTick();
  }

  /**
   * Sound: Victory Fanfare
   */
  public playVictory(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  /**
   * Sound: Error / Invalid Action Buzz
   */
  public playError(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Sound: Generic UI Button Click
   */
  public playButtonClick(): void {
    if (!this.isSfxEnabled) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Ambient BGM: Smooth, soothing chill synth chord progression
   */
  public startBgm(): void {
    if (!this.isBgmEnabled || this.bgmIntervalId) return;
    this.resume();
    if (!this.ctx || !this.bgmGain) return;

    // Chords: Cmaj7, Am7, Fmaj7, G7 (calm, warm atmosphere)
    const progressions = [
      [261.63, 329.63, 392.0, 493.88], // C, E, G, B
      [220.0, 261.63, 329.63, 392.0],  // A, C, E, G
      [174.61, 220.0, 261.63, 329.63], // F, A, C, E
      [196.0, 246.94, 293.66, 349.23], // G, B, D, F
    ];

    let chordIndex = 0;
    const playNextChord = () => {
      if (!this.ctx || !this.bgmGain || !this.isBgmEnabled) return;
      const chord = progressions[chordIndex % progressions.length];
      chordIndex++;

      const now = this.ctx.currentTime;
      for (const freq of chord) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

        osc.connect(gain);
        gain.connect(this.bgmGain);

        osc.start(now);
        osc.stop(now + 4.0);
      }
    };

    playNextChord();
    this.bgmIntervalId = window.setInterval(playNextChord, 4000);
  }

  public stopBgm(): void {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  // --- Settings Getters & Setters ---

  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setSfxEnabled(enabled: boolean): void {
    this.isSfxEnabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(enabled ? 1.0 : 0.0, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public getSfxEnabled(): boolean {
    return this.isSfxEnabled;
  }

  public setBgmEnabled(enabled: boolean): void {
    this.isBgmEnabled = enabled;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(enabled ? 0.35 : 0.0, this.ctx.currentTime);
    }
    if (enabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
    this.saveSettings();
  }

  public getBgmEnabled(): boolean {
    return this.isBgmEnabled;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('game_audio_volume', String(this.masterVolume));
      localStorage.setItem('game_audio_sfx', String(this.isSfxEnabled));
      localStorage.setItem('game_audio_bgm', String(this.isBgmEnabled));
    } catch (e) {
      // Ignored
    }
  }

  private loadSettings(): void {
    try {
      const vol = localStorage.getItem('game_audio_volume');
      if (vol !== null) this.masterVolume = parseFloat(vol);
      const sfx = localStorage.getItem('game_audio_sfx');
      if (sfx !== null) this.isSfxEnabled = sfx === 'true';
      const bgm = localStorage.getItem('game_audio_bgm');
      if (bgm !== null) this.isBgmEnabled = bgm === 'true';
    } catch (e) {
      // Ignored
    }
  }
}
