import * as THREE from 'three';
import gsap from 'gsap';
import { CardMesh } from '../cards/CardMesh';
import { Card, AvatarCustomization } from '@game/shared';

export interface AvatarOptions {
  name: string;
  relativeSeat: number; // 1: Right, 2: Across/Opposite, 3: Left
  customization?: AvatarCustomization;
}

export class CharacterAvatar extends THREE.Group {
  public relativeSeat: number;
  public playerName: string;
  public customization: AvatarCustomization;

  public headGroup!: THREE.Group;
  public torsoMesh!: THREE.Mesh;
  public leftArmGroup!: THREE.Group;
  public rightArmGroup!: THREE.Group;
  public cardsHolderGroup!: THREE.Group;
  public turnGlowMesh!: THREE.Mesh;

  private opponentCardMeshes: CardMesh[] = [];
  private idleTimeline: gsap.core.Timeline | null = null;
  private isThinking: boolean = false;

  constructor(options: AvatarOptions) {
    super();
    this.relativeSeat = options.relativeSeat;
    this.playerName = options.name;

    // Default colorful cartoon defaults if not specified
    const defaultPalette = this.getDefaultPalette(options.relativeSeat);
    this.customization = {
      gender: options.customization?.gender || 'male',
      hairStyle: options.customization?.hairStyle || (options.relativeSeat === 2 ? 'cap' : 'short'),
      hairColor: options.customization?.hairColor || defaultPalette.hairColor,
      shirtColor: options.customization?.shirtColor || defaultPalette.shirtColor,
      pantsColor: options.customization?.pantsColor || defaultPalette.pantsColor,
      skinColor: options.customization?.skinColor || defaultPalette.skinColor,
      accessory: options.customization?.accessory || 'none',
    };

    this.buildCharacter();
    this.startIdleAnimation();
  }

  private getDefaultPalette(relativeSeat: number) {
    const palettes = [
      { shirtColor: '#2563eb', pantsColor: '#1e293b', skinColor: '#fed7aa', hairColor: '#451a03' }, // Blue
      { shirtColor: '#dc2626', pantsColor: '#1e293b', skinColor: '#ffedd5', hairColor: '#171717' }, // Red
      { shirtColor: '#16a34a', pantsColor: '#1e293b', skinColor: '#fcd34d', hairColor: '#78350f' }, // Green
      { shirtColor: '#9333ea', pantsColor: '#1e293b', skinColor: '#fde047', hairColor: '#0f172a' }, // Purple
    ];
    return palettes[relativeSeat % palettes.length];
  }

  private parseColor(col?: string | number): number {
    if (!col) return 0x2563eb;
    if (typeof col === 'number') return col;
    if (col.startsWith('#')) return parseInt(col.slice(1), 16);
    return 0x2563eb;
  }

  private buildCharacter(): void {
    const skinMat = new THREE.MeshStandardMaterial({
      color: this.parseColor(this.customization.skinColor),
      roughness: 0.6,
      metalness: 0.05,
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: this.parseColor(this.customization.shirtColor),
      roughness: 0.5,
      metalness: 0.08,
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: this.parseColor(this.customization.pantsColor),
      roughness: 0.6,
      metalness: 0.05,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: this.parseColor(this.customization.hairColor),
      roughness: 0.65,
      metalness: 0.0,
    });

    // 1. Legs / Pants Base
    const legsGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.35, 16);
    const legsMesh = new THREE.Mesh(legsGeo, pantsMat);
    legsMesh.position.y = 0.22;
    legsMesh.castShadow = true;
    this.add(legsMesh);

    // 2. Torso / Hoodie
    const torsoGeo = new THREE.CylinderGeometry(0.25, 0.27, 0.46, 16);
    this.torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    this.torsoMesh.position.y = 0.62;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.add(this.torsoMesh);

    // Hoodie collar
    const collarGeo = new THREE.TorusGeometry(0.14, 0.04, 8, 16);
    const collar = new THREE.Mesh(collarGeo, shirtMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.24;
    this.torsoMesh.add(collar);

    // 3. Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.42, 0);
    this.torsoMesh.add(this.headGroup);

    // Stylized Head
    const headGeo = new THREE.SphereGeometry(0.21, 24, 24);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Hair Style
    this.buildHair(hairMat);

    // Face (Eyes, Blush cheeks)
    this.buildFace();

    // Accessory (Glasses, Sunglasses, Headphones)
    this.buildAccessory();

    // 4. Arms
    // Left Arm (bent to hold cards in front)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.28, 0.16, 0.02);
    this.torsoMesh.add(this.leftArmGroup);

    // Right Arm (free hand, interacts on card select and play)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.28, 0.16, 0.02);
    this.torsoMesh.add(this.rightArmGroup);

    const armGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.32, 12);
    const handGeo = new THREE.SphereGeometry(0.065, 12, 12);

    // Left Arm Mesh (Holding cards)
    const leftArmMesh = new THREE.Mesh(armGeo, shirtMat);
    leftArmMesh.position.set(0.05, -0.12, 0.12);
    leftArmMesh.rotation.set(Math.PI / 3, -Math.PI / 10, -Math.PI / 8);
    this.leftArmGroup.add(leftArmMesh);

    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(0.08, -0.24, 0.24);
    this.leftArmGroup.add(leftHand);

    // Right Arm Mesh (Free arm for gestures)
    const rightArmMesh = new THREE.Mesh(armGeo, shirtMat);
    rightArmMesh.position.set(-0.02, -0.14, 0.05);
    rightArmMesh.rotation.set(Math.PI / 5, 0, Math.PI / 12);
    this.rightArmGroup.add(rightArmMesh);

    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.set(-0.02, -0.28, 0.14);
    this.rightArmGroup.add(rightHand);

    // 5. Cards Holder in hands
    this.cardsHolderGroup = new THREE.Group();
    this.cardsHolderGroup.position.set(0, 0.60, 0.36);
    this.add(this.cardsHolderGroup);

    // 6. Turn Glow Ring on floor
    const ringGeo = new THREE.RingGeometry(0.48, 0.64, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.turnGlowMesh = new THREE.Mesh(ringGeo, ringMat);
    this.turnGlowMesh.rotation.x = -Math.PI / 2;
    this.turnGlowMesh.position.y = 0.02;
    this.add(this.turnGlowMesh);
  }

  private buildHair(hairMat: THREE.Material): void {
    const style = this.customization.hairStyle;

    if (style === 'cap') {
      // Baseball Snapback Cap
      const capGeo = new THREE.SphereGeometry(0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMesh = new THREE.Mesh(capGeo, hairMat);
      capMesh.position.y = 0.04;
      this.headGroup.add(capMesh);

      const visorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16, 1, false, -Math.PI / 3, (Math.PI * 2) / 3);
      const visorMesh = new THREE.Mesh(visorGeo, hairMat);
      visorMesh.position.set(0, 0.04, 0.12);
      this.headGroup.add(visorMesh);
    } else if (style === 'beanie') {
      // Cozy Knit Beanie
      const beanieGeo = new THREE.SphereGeometry(0.225, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65);
      const beanieMesh = new THREE.Mesh(beanieGeo, hairMat);
      beanieMesh.position.y = 0.05;
      this.headGroup.add(beanieMesh);

      // Pompom on top
      const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), hairMat);
      pompom.position.set(0, 0.28, 0);
      this.headGroup.add(pompom);
    } else if (style === 'long') {
      // Long Hair with flowing side locks
      const baseHair = new THREE.Mesh(
        new THREE.SphereGeometry(0.225, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
        hairMat
      );
      baseHair.position.y = 0.04;
      this.headGroup.add(baseHair);

      // Left and right flowing locks past shoulders
      [-0.17, 0.17].forEach((x) => {
        const lockGeo = new THREE.CylinderGeometry(0.05, 0.025, 0.38, 8);
        const lock = new THREE.Mesh(lockGeo, hairMat);
        lock.position.set(x, -0.12, 0.08);
        lock.rotation.z = x > 0 ? -0.15 : 0.15;
        this.headGroup.add(lock);
      });
    } else if (style === 'spiky') {
      // Anime Spiky Hair
      const baseHair = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
        hairMat
      );
      baseHair.position.y = 0.04;
      this.headGroup.add(baseHair);

      const spikeAngles = [-0.15, -0.07, 0, 0.07, 0.15];
      spikeAngles.forEach((xOffset, idx) => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), hairMat);
        spike.position.set(xOffset, 0.22, 0.08 - Math.abs(xOffset) * 0.2);
        spike.rotation.z = -xOffset * 3;
        spike.rotation.x = -0.2;
        this.headGroup.add(spike);
      });
    } else {
      // Default: Short neat cartoon hair
      const hairMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.225, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        hairMat
      );
      hairMesh.position.y = 0.04;
      this.headGroup.add(hairMesh);

      // Cute bangs/tufts in front
      for (let i = -2; i <= 2; i++) {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), hairMat);
        tuft.position.set(i * 0.06, 0.16, 0.16);
        this.headGroup.add(tuft);
      }
    }
  }

  private buildFace(): void {
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    [-0.075, 0.075].forEach((x) => {
      // White of eye
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), eyeWhiteMat);
      eyeWhite.scale.set(1, 1.25, 0.5);
      eyeWhite.position.set(x, 0.02, 0.195);
      this.headGroup.add(eyeWhite);

      // Pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), pupilMat);
      pupil.position.set(x, 0.02, 0.21);
      this.headGroup.add(pupil);
    });

    // Cute blush cheeks
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.65 });
    [-0.11, 0.11].forEach((x) => {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), blushMat);
      blush.position.set(x, -0.045, 0.20);
      blush.rotation.y = x > 0 ? 0.35 : -0.35;
      this.headGroup.add(blush);
    });
  }

  private buildAccessory(): void {
    const acc = this.customization.accessory;
    if (acc === 'none') return;

    if (acc === 'glasses' || acc === 'sunglasses') {
      const isSun = acc === 'sunglasses';
      const frameMat = new THREE.MeshStandardMaterial({
        color: isSun ? 0x0f172a : 0xd97706,
        roughness: 0.2,
        metalness: 0.8,
      });
      const lensMat = new THREE.MeshBasicMaterial({
        color: isSun ? 0x09090b : 0x93c5fd,
        transparent: true,
        opacity: isSun ? 0.88 : 0.25,
      });

      [-0.075, 0.075].forEach((x) => {
        // Frame
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 8, 16), frameMat);
        rim.position.set(x, 0.02, 0.215);
        this.headGroup.add(rim);

        // Lens
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16), lensMat);
        lens.position.set(x, 0.02, 0.216);
        this.headGroup.add(lens);
      });

      // Glasses bridge
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), frameMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.025, 0.215);
      this.headGroup.add(bridge);
    } else if (acc === 'headphone') {
      // Gaming Headphones
      const phoneMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.5 });
      const padMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

      // Headband
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.016, 8, 24, Math.PI), phoneMat);
      band.position.set(0, 0.06, 0);
      this.headGroup.add(band);

      // Ear cups
      [-0.22, 0.22].forEach((x) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16), phoneMat);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(x, 0.02, 0);
        this.headGroup.add(cup);

        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16), padMat);
        pad.rotation.z = Math.PI / 2;
        pad.position.set(x > 0 ? x - 0.025 : x + 0.025, 0.02, 0);
        this.headGroup.add(pad);
      });
    }
  }

  private startIdleAnimation(): void {
    this.idleTimeline = gsap.timeline({ repeat: -1, yoyo: true });
    this.idleTimeline.to(this.torsoMesh.position, {
      y: 0.635,
      duration: 1.8,
      ease: 'sine.inOut',
    });
    this.idleTimeline.to(
      this.headGroup.rotation,
      {
        x: -0.04,
        z: 0.02,
        duration: 2.2,
        ease: 'sine.inOut',
      },
      0
    );
  }

  public setTurnActive(isTurn: boolean): void {
    this.isThinking = isTurn;

    if (isTurn) {
      gsap.to(this.turnGlowMesh.material, { opacity: 0.85, duration: 0.4 });
      gsap.to(this.headGroup.rotation, { x: 0.16, duration: 0.5, ease: 'power2.out' });
    } else {
      gsap.to(this.turnGlowMesh.material, { opacity: 0, duration: 0.3 });
      gsap.to(this.headGroup.rotation, { x: 0, duration: 0.5, ease: 'power2.out' });
    }
  }

  /**
   * Displays the avatar holding a curved fan of face-down cards in their hand.
   */
  public setCardsInHand(count: number): void {
    while (this.cardsHolderGroup.children.length > 0) {
      this.cardsHolderGroup.remove(this.cardsHolderGroup.children[0]);
    }
    this.opponentCardMeshes = [];

    if (count <= 0) return;

    const visibleCards = Math.min(count, 13);
    const stepAngle = Math.min(0.065, 0.48 / Math.max(1, visibleCards - 1));
    const startAngle = -((visibleCards - 1) * stepAngle) / 2;

    for (let i = 0; i < visibleCards; i++) {
      const dummyCard: Card = {
        id: `avatar_${this.relativeSeat}_${i}`,
        rank: '3',
        suit: 'spade',
        rankValue: 3,
        suitValue: 0,
        weight: 12,
      };
      // Face-down card
      const cardMesh = new CardMesh(dummyCard, false);
      cardMesh.scale.set(0.44, 0.44, 0.44);

      const angle = startAngle + i * stepAngle;
      const cardZ = Math.cos(angle) * 0.05 + i * 0.003;
      cardMesh.position.set(Math.sin(angle) * 0.22, 0, cardZ);
      cardMesh.rotation.set(-0.32, angle * 0.5, -angle * 0.8);
      cardMesh.originalY = 0;
      cardMesh.originalZ = cardZ;

      this.cardsHolderGroup.add(cardMesh);
      this.opponentCardMeshes.push(cardMesh);
    }
  }

  /**
   * Synchronizes opponent's card selection in real-time!
   * When opponent clicks/lifts cards, those exact cards in their curved fan lift up,
   * and their right arm moves towards their cards.
   */
  public setSelectedCardIndices(indices: number[]): void {
    const selectedSet = new Set(indices);

    this.opponentCardMeshes.forEach((cardMesh, idx) => {
      const isSelected = selectedSet.has(idx);
      if (isSelected) {
        // Lift card up in curved fan
        gsap.to(cardMesh.position, {
          y: cardMesh.originalY + 0.07,
          z: cardMesh.originalZ + 0.02,
          duration: 0.2,
          ease: 'power2.out',
        });
      } else {
        gsap.to(cardMesh.position, {
          y: cardMesh.originalY,
          z: cardMesh.originalZ,
          duration: 0.2,
          ease: 'power2.out',
        });
      }
    });

    // Gesture with right arm when selecting cards
    if (indices.length > 0) {
      gsap.to(this.rightArmGroup.rotation, {
        x: 0.45,
        y: -0.25,
        z: 0.15,
        duration: 0.25,
        ease: 'power2.out',
      });
    } else {
      gsap.to(this.rightArmGroup.rotation, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }

  /**
   * Action animation: Character swings hand forward energetically as cards are thrown onto the table.
   */
  public playCardAnimation(): void {
    const tl = gsap.timeline();
    tl.to(this.rightArmGroup.rotation, {
      x: 0.75,
      y: -0.15,
      z: -0.2,
      duration: 0.18,
      ease: 'power2.out',
    });
    tl.to(this.headGroup.rotation, {
      x: 0.2,
      duration: 0.18,
    }, 0);
    tl.to(this.rightArmGroup.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.35,
      ease: 'back.out(1.5)',
    });
    tl.to(this.headGroup.rotation, {
      x: 0,
      duration: 0.35,
    }, '-=0.2');
  }

  /**
   * Pass action animation: Character shakes head gently side to side.
   */
  public passAnimation(): void {
    const tl = gsap.timeline();
    tl.to(this.headGroup.rotation, { y: 0.25, duration: 0.12 });
    tl.to(this.headGroup.rotation, { y: -0.25, duration: 0.18 });
    tl.to(this.headGroup.rotation, { y: 0.15, duration: 0.15 });
    tl.to(this.headGroup.rotation, { y: 0, duration: 0.2 });
  }

  public destroy(): void {
    if (this.idleTimeline) {
      this.idleTimeline.kill();
    }
  }
}
