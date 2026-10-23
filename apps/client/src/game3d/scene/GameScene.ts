import * as THREE from 'three';

export class GameScene {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public canvas: HTMLCanvasElement;

  public tableTopMesh!: THREE.Mesh;
  public centerDropZone!: THREE.Group;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep modern dark slate
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.04);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.setupLighting();
    this.setupRoomAndTable();

    // Center drop zone for played cards
    this.centerDropZone = new THREE.Group();
    this.centerDropZone.position.set(0, 0.81, 0);
    this.scene.add(this.centerDropZone);
  }

  private setupLighting(): void {
    // 1. Ambient Light
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.9);
    this.scene.add(ambientLight);

    // 2. Key Directional Light (Warm sun/room light with soft shadow)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    keyLight.position.set(2.5, 6, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.001;
    const d = 3;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    this.scene.add(keyLight);

    // 3. Table Top Warm Chandelier Point Light
    const chandelier = new THREE.PointLight(0xfef08a, 1.0, 8, 1.5);
    chandelier.position.set(0, 3.2, 0);
    this.scene.add(chandelier);

    // 4. Fill Rim Light (Cool subtle backlight)
    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);
  }

  private setupRoomAndTable(): void {
    // 1. Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Stylized round carpet under the table
    const carpetGeo = new THREE.CircleGeometry(3.6, 64);
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
    });
    const carpet = new THREE.Mesh(carpetGeo, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.005;
    carpet.receiveShadow = true;
    this.scene.add(carpet);

    // 2. Stylized Round Table
    const tableRadius = 1.7;
    const tableHeight = 0.8;

    // Wood Rim (Torus/Cylinder)
    const rimGeo = new THREE.CylinderGeometry(tableRadius + 0.12, tableRadius + 0.12, 0.08, 64);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Warm rich cartoon mahogany
      roughness: 0.35,
      metalness: 0.1,
    });
    const rim = new THREE.Mesh(rimGeo, woodMat);
    rim.position.y = tableHeight - 0.02;
    rim.castShadow = true;
    rim.receiveShadow = true;
    this.scene.add(rim);

    // Felt Mat Tabletop (Green Felt / Indigo Felt)
    const feltGeo = new THREE.CylinderGeometry(tableRadius, tableRadius, 0.08, 64);
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x14532d, // Classic lush dark emerald felt
      roughness: 0.85,
      metalness: 0.0,
    });
    this.tableTopMesh = new THREE.Mesh(feltGeo, feltMat);
    this.tableTopMesh.position.y = tableHeight;
    this.tableTopMesh.receiveShadow = true;
    this.scene.add(this.tableTopMesh);

    // Decorative inner gold trim on felt
    const goldTrimGeo = new THREE.RingGeometry(tableRadius - 0.15, tableRadius - 0.12, 64);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.6,
    });
    const goldTrim = new THREE.Mesh(goldTrimGeo, goldMat);
    goldTrim.rotation.x = -Math.PI / 2;
    goldTrim.position.y = tableHeight + 0.041;
    this.scene.add(goldTrim);

    // Table Pedestal & Base
    const pedestalGeo = new THREE.CylinderGeometry(0.28, 0.45, tableHeight, 32);
    const pedestal = new THREE.Mesh(pedestalGeo, woodMat);
    pedestal.position.y = tableHeight / 2;
    pedestal.castShadow = true;
    this.scene.add(pedestal);

    const baseGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.06, 32);
    const base = new THREE.Mesh(baseGeo, woodMat);
    base.position.y = 0.03;
    base.castShadow = true;
    this.scene.add(base);

    // 3. Seat markers around the table
    this.createSeats(tableRadius);
  }

  private createSeats(tableRadius: number): void {
    const seatDistance = tableRadius + 0.55;
    const seatAngles = [
      0,               // Seat 0 (Local player - bottom)
      -Math.PI / 2,    // Seat 1 (Right)
      Math.PI,         // Seat 2 (Opposite)
      Math.PI / 2,     // Seat 3 (Left)
    ];

    const cushionGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 32);
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.7,
    });

    seatAngles.forEach((angle, idx) => {
      // Don't render full chair for seat 0 so local player view is clean
      if (idx === 0) return;

      const x = Math.sin(angle) * seatDistance;
      const z = Math.cos(angle) * seatDistance;

      const chair = new THREE.Group();
      chair.position.set(x, 0.4, z);

      const cushion = new THREE.Mesh(cushionGeo, cushionMat);
      cushion.castShadow = true;
      chair.add(cushion);

      // Backrest
      const backGeo = new THREE.BoxGeometry(0.6, 0.5, 0.08);
      const back = new THREE.Mesh(backGeo, cushionMat);
      back.position.set(0, 0.32, 0.3);
      chair.add(back);

      chair.lookAt(0, 0.4, 0);
      this.scene.add(chair);
    });
  }

  public handleResize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
