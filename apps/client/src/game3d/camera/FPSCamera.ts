import * as THREE from 'three';

export class FPSCamera {
  public camera: THREE.PerspectiveCamera;

  private targetRotation = new THREE.Euler(0, 0, 0, 'YXZ');
  private currentRotation = new THREE.Euler(0, 0, 0, 'YXZ');

  private basePosition = new THREE.Vector3(0, 1.45, 2.2);
  private baseLookAt = new THREE.Vector3(0, 0.75, 0.1);

  private maxPitch = 0.12; // rad (~7 deg)
  private maxYaw = 0.22;   // rad (~12.5 deg)

  private mouseX = 0;
  private mouseY = 0;

  // Mobile Gyroscope / DeviceTilt tracking
  private gyroActive = false;
  private calibPitch: number | null = null;
  private calibYaw: number | null = null;
  private hasSensorPermission = false;

  // Touch drag fallback for touch devices without gyro
  private touchStartX = 0;
  private touchStartY = 0;
  private isTouchDragging = false;

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.baseLookAt);

    this.initEvents();
  }

  private initEvents(): void {
    // 1. Desktop mouse parallax
    window.addEventListener('mousemove', (e) => {
      // Normalize mouse (-1 to 1)
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;

      // Invert Y for standard natural look
      this.targetRotation.x = -this.mouseY * this.maxPitch;
      this.targetRotation.y = -this.mouseX * this.maxYaw;
    });

    // 2. Mobile Gyroscope (DeviceOrientation) tracking
    window.addEventListener(
      'deviceorientation',
      (e: DeviceOrientationEvent) => {
        if (e.beta === null || e.gamma === null) return;
        this.gyroActive = true;

        // Determine orientation angle (landscape 90 vs -90/270)
        let angle = 0;
        if (screen.orientation && typeof screen.orientation.angle === 'number') {
          angle = screen.orientation.angle;
        } else if (typeof window.orientation === 'number') {
          angle = Number(window.orientation);
        }

        let rawPitch = 0;
        let rawYaw = 0;

        // Convert sensor coordinates to landscape screen viewing axis
        if (angle === 90) {
          // Landscape Left (rotated counter-clockwise)
          rawPitch = -e.gamma;
          rawYaw = e.beta;
        } else if (angle === -90 || angle === 270) {
          // Landscape Right (rotated clockwise)
          rawPitch = e.gamma;
          rawYaw = -e.beta;
        } else {
          // Portrait
          rawPitch = e.beta - 45;
          rawYaw = e.gamma;
        }

        // Auto-calibrate center on first detection
        if (this.calibPitch === null || this.calibYaw === null) {
          this.calibPitch = rawPitch;
          this.calibYaw = rawYaw;
        }

        // Slow low-pass drift compensation so phone re-centers naturally when grip shifts
        this.calibPitch += (rawPitch - this.calibPitch) * 0.004;
        this.calibYaw += (rawYaw - this.calibYaw) * 0.004;

        const deltaPitch = rawPitch - this.calibPitch;
        const deltaYaw = rawYaw - this.calibYaw;

        // Normalize with +-16 deg pitch, +-20 deg yaw threshold
        const normPitch = Math.max(-1, Math.min(1, deltaPitch / 16));
        const normYaw = Math.max(-1, Math.min(1, deltaYaw / 20));

        this.targetRotation.x = normPitch * this.maxPitch;
        this.targetRotation.y = -normYaw * this.maxYaw;
      },
      { passive: true }
    );

    // 3. Touch interaction fallback (also triggers sensor permission on iOS)
    window.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        this.requestSensorPermission();

        if (e.touches.length === 1) {
          const touch = e.touches[0];
          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
          this.isTouchDragging = true;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (!this.isTouchDragging || e.touches.length !== 1) return;
        if (this.gyroActive) return; // Gyro takes precedence if available

        const touch = e.touches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;

        const normX = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.4)));
        const normY = Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.4)));

        this.targetRotation.x = -normY * this.maxPitch;
        this.targetRotation.y = -normX * this.maxYaw;
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      () => {
        this.isTouchDragging = false;
        if (!this.gyroActive) {
          this.targetRotation.x = 0;
          this.targetRotation.y = 0;
        }
      },
      { passive: true }
    );
  }

  /**
   * Request motion/orientation sensor permission on iOS 13+ devices.
   */
  public async requestSensorPermission(): Promise<boolean> {
    if (this.hasSensorPermission) return true;
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          this.hasSensorPermission = true;
          return true;
        }
      } catch (err) {
        // Ignored
      }
      return false;
    }
    this.hasSensorPermission = true;
    return true;
  }

  public update(): void {
    // Smooth lerp damping
    const lerpFactor = 0.08;
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * lerpFactor;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * lerpFactor;

    // Reset camera position and re-apply lookAt + parallax offset
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.baseLookAt);

    this.camera.rotation.x += this.currentRotation.x;
    this.camera.rotation.y += this.currentRotation.y;
  }

  public handleResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
