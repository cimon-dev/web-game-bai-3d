import { Card } from '@game/shared';
import * as THREE from 'three';
import { CardTextureGenerator } from './CardTextureGenerator';

export class CardMesh extends THREE.Group {
  public card: Card;
  public isSelected: boolean = false;
  public isHovered: boolean = false;
  public isFaceUp: boolean = true;

  public mesh: THREE.Mesh;
  public originalX: number = 0;
  public originalY: number = 0;
  public originalZ: number = 0;
  public handIndex: number = 0;

  public static readonly WIDTH = 0.9;
  public static readonly HEIGHT = 1.35;
  public static readonly THICKNESS = 0.002;

  constructor(card: Card, isFaceUp: boolean = true) {
    super();
    this.card = card;
    this.isFaceUp = isFaceUp;

    // Geometry
    const geometry = new THREE.BoxGeometry(
      CardMesh.WIDTH,
      CardMesh.HEIGHT,
      CardMesh.THICKNESS
    );

    // Textures & Materials
    const frontTex = CardTextureGenerator.getCardTexture(card);
    const backTex = CardTextureGenerator.getBackTexture();

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
    });

    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.38,
      metalness: 0.0,
    });

    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.4,
      metalness: 0.0,
    });

    // Box faces: [Right, Left, Top, Bottom, Front (+Z), Back (-Z)]
    const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];

    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    // Set face up or face down
    if (!isFaceUp) {
      this.mesh.rotation.y = Math.PI;
    }

    // Attach reference
    this.mesh.userData = { cardMesh: this, cardId: card.id };
  }

  public setFaceUp(faceUp: boolean): void {
    this.isFaceUp = faceUp;
    this.mesh.rotation.y = faceUp ? 0 : Math.PI;
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected;
    const mats = this.mesh.material as THREE.MeshStandardMaterial[];
    if (Array.isArray(mats) && mats[4]) {
      mats[4].emissive = new THREE.Color(selected ? 0x2a1e05 : 0x000000);
    }
  }
}
