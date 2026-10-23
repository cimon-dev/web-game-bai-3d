import { Card, SUIT_COLORS, SUIT_SYMBOLS } from '@game/shared';
import * as THREE from 'three';

export class CardTextureGenerator {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();
  private static backTexture: THREE.CanvasTexture | null = null;

  /**
   * Generates or retrieves from cache the texture for a given card.
   */
  public static getCardTexture(card: Card): THREE.CanvasTexture {
    if (this.cache.has(card.id)) {
      return this.cache.get(card.id)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const width = 768;
    const height = 1024;
    const radius = 48;

    // 1. Draw Card Background with rounded corners & shadow border
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, 6, 6, width - 12, height - 12, radius);
    ctx.fill();

    // Subtle inner border with crisp contrast
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    this.roundRect(ctx, 24, 24, width - 48, height - 48, radius - 10);
    ctx.stroke();

    // Gold decorative border for Heo (Rank 2)
    if (card.rank === '2') {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 12;
      this.roundRect(ctx, 36, 36, width - 72, height - 72, radius - 16);
      ctx.stroke();
    }

    const color = SUIT_COLORS[card.suit];
    const symbol = SUIT_SYMBOLS[card.suit];

    // 2. Draw Top-Left Rank & Suit (High contrast, bold, large)
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 115px "Outfit", "Segoe UI", sans-serif';
    ctx.fillText(card.rank, 105, 120);

    ctx.font = 'bold 85px "Segoe UI", sans-serif';
    ctx.fillText(symbol, 105, 215);

    // 3. Draw Bottom-Right Rank & Suit (Upside down)
    ctx.save();
    ctx.translate(width - 105, height - 120);
    ctx.rotate(Math.PI);
    ctx.font = '900 115px "Outfit", "Segoe UI", sans-serif';
    ctx.fillText(card.rank, 0, 0);
    ctx.font = 'bold 85px "Segoe UI", sans-serif';
    ctx.fillText(symbol, 0, -95);
    ctx.restore();

    // 4. Draw Center Graphics / Emblem (Very prominent from afar)
    if (card.rank === '2') {
      // Golden Heo Emblem
      ctx.save();
      ctx.translate(width / 2, height / 2);

      // Gold radiant glow
      const grad = ctx.createRadialGradient(0, 0, 30, 0, 0, 240);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.5, '#facc15');
      grad.addColorStop(1, '#ca8a04');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 195, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Huge Suit Symbol inside
      ctx.fillStyle = color;
      ctx.font = 'bold 220px "Segoe UI", sans-serif';
      ctx.fillText(symbol, 0, 20);

      // Crown / "HEO ★" Banner
      ctx.fillStyle = '#78350f';
      ctx.font = '900 58px "Outfit", sans-serif';
      ctx.fillText('HEO ★', 0, 245);
      ctx.restore();
    } else if (['J', 'Q', 'K', 'A'].includes(card.rank)) {
      // Face card stylized cartoon crest
      ctx.save();
      ctx.translate(width / 2, height / 2);

      ctx.fillStyle = color === '#dc2626' ? '#fee2e2' : '#f1f5f9';
      ctx.beginPath();
      ctx.arc(0, 0, 180, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = '900 190px "Outfit", sans-serif';
      ctx.fillText(card.rank, 0, -15);

      ctx.font = 'bold 95px "Segoe UI", sans-serif';
      ctx.fillText(symbol, 0, 110);
      ctx.restore();
    } else {
      // Number Cards: Giant center suit symbol with high visibility
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.fillStyle = color;
      ctx.font = 'bold 260px "Segoe UI", sans-serif';
      ctx.fillText(symbol, 0, 20);
      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.cache.set(card.id, texture);
    return texture;
  }

  /**
   * Generates or retrieves from cache the cartoon card back texture.
   */
  public static getBackTexture(): THREE.CanvasTexture {
    if (this.backTexture) {
      return this.backTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const width = 768;
    const height = 1024;
    const radius = 48;

    // Card border
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, 6, 6, width - 12, height - 12, radius);
    ctx.fill();

    // Classic Casino Crimson Red background
    ctx.fillStyle = '#b91c1c';
    this.roundRect(ctx, 28, 28, width - 56, height - 56, radius - 10);
    ctx.fill();

    // Pattern: Diamond Lattice
    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, 28, 28, width - 56, height - 56, radius - 10);
    ctx.clip();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    const step = 56;
    for (let x = -width; x < width * 2; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + height, 0);
      ctx.stroke();
    }

    // Inner white pinstripe
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 3;
    this.roundRect(ctx, 48, 48, width - 96, height - 96, radius - 18);
    ctx.stroke();

    // Golden Center Crest
    ctx.translate(width / 2, height / 2);
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(0, 0, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 70px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♠ ♥', 0, -20);
    ctx.fillText('♦ ♣', 0, 35);
    ctx.restore();

    this.backTexture = new THREE.CanvasTexture(canvas);
    this.backTexture.colorSpace = THREE.SRGBColorSpace;
    this.backTexture.anisotropy = 16;
    this.backTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.backTexture.magFilter = THREE.LinearFilter;
    this.backTexture.generateMipmaps = true;
    this.backTexture.needsUpdate = true;
    return this.backTexture;
  }

  private static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
