import { Card, CardCombination, Compare, sortCards } from '@game/shared';
import gsap from 'gsap';
import * as THREE from 'three';
import { SoundEffects } from '../../audio/SoundEffects';
import { CardMesh } from './CardMesh';

export class HandManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  public playerHandGroup: THREE.Group;
  public activeTrickGroup: THREE.Group;
  public discardPileGroup: THREE.Group;

  public playerCardMeshes: CardMesh[] = [];
  public selectedCards: Set<string> = new Set();
  private discardPileCount: number = 0;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  public onSelectionChanged?: (selectedCardIds: string[]) => void;
  public getTargetCombination?: () => CardCombination | null;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    // Local player hand group positioned low and near camera
    this.playerHandGroup = new THREE.Group();
    this.scene.add(this.playerHandGroup);

    // Active trick currently played (elevated, close to view, angled towards camera)
    this.activeTrickGroup = new THREE.Group();
    this.activeTrickGroup.position.set(0, 0.865, 0.35);
    this.scene.add(this.activeTrickGroup);

    // Accumulated discard pile resting on table felt in center-back
    this.discardPileGroup = new THREE.Group();
    this.discardPileGroup.position.set(0, 0.846, -0.10);
    this.scene.add(this.discardPileGroup);

    this.initInteraction();
  }

  /**
   * Calculates the exact stepX and startX so that ALL cards fit 100% within
   * the visible camera frustum with safe breathing room on both screen edges.
   */
  public calculateLayout(count: number): {
    stepX: number;
    startX: number;
    cardScale: number;
    handY: number;
    handZ: number;
    stepZ: number;
  } {
    const pCam = this.camera as THREE.PerspectiveCamera;
    const aspect = pCam.aspect || (window.innerWidth / window.innerHeight);
    const fov = pCam.fov || 55;

    const isMobileLandscape = window.innerHeight < 550 && (window.innerWidth / window.innerHeight) > 1.35;

    // Upright hand placement: floating comfortably above table felt (Y=0.84)
    const handY = isMobileLandscape ? 0.90 : 0.93;
    const handZ = isMobileLandscape ? 1.50 : 1.50;
    const cardScale = isMobileLandscape ? 0.31 : 0.33;
    const stepZ = 0.003; // Layer step: Card i is slightly closer to camera than Card i-1

    const cardWidth = CardMesh.WIDTH * cardScale;

    // Viewing distance from camera (0, 1.45, 2.2) to hand plane
    const dy = 1.45 - handY;
    const dz = 2.2 - handZ;
    const distToCards = Math.sqrt(dy * dy + dz * dz);

    const visibleHalfHeight = distToCards * Math.tan((fov * Math.PI) / 360);
    const visibleHalfWidth = visibleHalfHeight * aspect;

    // 82% of the frustum half-width is the maximum boundary for the entire hand
    // so there is always a safe margin on both left and right edges!
    const maxBoundX = visibleHalfWidth * 0.82;
    const maxUsableWidth = maxBoundX * 2;

    let stepX = 0;
    if (count > 1) {
      // Maximum stepX that guarantees the outermost card edges stay within [-maxBoundX, +maxBoundX]
      const maxAllowedStep = Math.max(0.060, (maxUsableWidth - cardWidth) / (count - 1));

      if (count === 2) {
        stepX = Math.min(0.32, maxAllowedStep);
      } else if (count === 3) {
        stepX = Math.min(0.28, maxAllowedStep);
      } else if (count === 4) {
        stepX = Math.min(0.24, maxAllowedStep);
      } else if (count === 5) {
        stepX = Math.min(0.20, maxAllowedStep);
      } else {
        // For larger hands (6 - 13 cards), cap at 0.16 and respect maxAllowedStep
        stepX = Math.min(0.16, maxAllowedStep);
        // Ensure index strip (needs ~0.060) remains readable
        stepX = Math.max(0.060, stepX);
      }
    }

    const startX = -((count - 1) * stepX) / 2;

    return { stepX, startX, cardScale, handY, handZ, stepZ };
  }

  /**
   * Smoothly re-positions cards when window resizes or phone orientation changes.
   */
  public updateLayout(animate: boolean = true): void {
    const count = this.playerCardMeshes.length;
    if (count === 0) return;

    const { stepX, startX, cardScale, handY, handZ, stepZ } = this.calculateLayout(count);

    // Sightline compensation factor K so all cards project to the exact same horizontal screen Y
    const K = (handY - 1.45) / (handZ - 2.2);

    this.playerCardMeshes.forEach((cardMesh, i) => {
      cardMesh.scale.set(cardScale, cardScale, cardScale);
      cardMesh.handIndex = i;
      cardMesh.renderOrder = i + 1;
      cardMesh.mesh.renderOrder = i + 1;

      const targetX = startX + i * stepX;
      const targetZ = handZ + i * stepZ;
      // Sightline compensation guarantees perfectly horizontal cards (zero diagonal slanting!)
      const targetY = 1.45 + K * (targetZ - 2.2);

      cardMesh.originalX = targetX;
      cardMesh.originalY = targetY;
      cardMesh.originalZ = targetZ;

      const currentY = cardMesh.isSelected ? targetY + 0.095 : targetY;

      if (animate) {
        gsap.to(cardMesh.position, {
          x: targetX,
          y: currentY,
          z: targetZ,
          duration: 0.3,
          ease: 'power2.out',
        });
      } else {
        cardMesh.position.set(targetX, currentY, targetZ);
      }
    });
  }

  /**
   * Sets and renders local player's cards upright, close to viewport, with non-overlapping indices.
   */
  public setPlayerCards(cards: Card[], animate: boolean = true): void {
    // Clean old meshes
    for (const mesh of this.playerCardMeshes) {
      this.playerHandGroup.remove(mesh);
    }
    this.playerCardMeshes = [];
    this.selectedCards.clear();

    const sorted = sortCards(cards);
    const count = sorted.length;
    if (count === 0) {
      if (this.onSelectionChanged) this.onSelectionChanged([]);
      return;
    }

    const { stepX, startX, cardScale, handY, handZ, stepZ } = this.calculateLayout(count);

    // Upright vertical cards ("thẳng đứng để dễ lên xuống quân")
    const targetRotX = 0;
    const targetRotY = 0;
    const targetRotZ = 0;

    sorted.forEach((card, i) => {
      const cardMesh = new CardMesh(card, true);
      cardMesh.scale.set(cardScale, cardScale, cardScale);
      cardMesh.handIndex = i;

      // Strict layer hierarchy: from left to right, layer increases gradually!
      cardMesh.renderOrder = i + 1;
      cardMesh.mesh.renderOrder = i + 1;

      const targetX = startX + i * stepX;
      const targetY = handY;
      const targetZ = handZ + i * stepZ;

      cardMesh.originalX = targetX;
      cardMesh.originalY = targetY;
      cardMesh.originalZ = targetZ;

      if (animate) {
        // Deal animation from table deck center
        cardMesh.position.set(0, 1.0, 0.2);
        cardMesh.rotation.set(-Math.PI / 2, 0, 0);
        cardMesh.scale.set(0.08, 0.08, 0.08);

        gsap.to(cardMesh.position, {
          x: targetX,
          y: targetY,
          z: targetZ,
          duration: 0.4,
          delay: i * 0.025,
          ease: 'power2.out',
        });

        gsap.to(cardMesh.rotation, {
          x: targetRotX,
          y: targetRotY,
          z: targetRotZ,
          duration: 0.4,
          delay: i * 0.025,
          ease: 'power2.out',
        });

        gsap.to(cardMesh.scale, {
          x: cardScale,
          y: cardScale,
          z: cardScale,
          duration: 0.35,
          delay: i * 0.025,
          ease: 'back.out(1.2)',
        });
      } else {
        cardMesh.position.set(targetX, targetY, targetZ);
        cardMesh.rotation.set(targetRotX, targetRotY, targetRotZ);
      }

      this.playerHandGroup.add(cardMesh);
      this.playerCardMeshes.push(cardMesh);
    });

    if (this.onSelectionChanged) {
      this.onSelectionChanged([]);
    }
  }

  /**
   * Shows newly played cards. Moves existing active trick down into discard pile.
   */
  public showPlayedCards(cards: Card[], isLocalPlayer: boolean = false, seatIndex: number = 0): void {
    // 1. Move existing active trick cards into discard pile
    this.settleActiveTrickToDiscardPile();

    // 2. Play new trick cards onto active trick group
    const count = cards.length;
    // Scale for crystal-clear readability (0.52 gives large, well-proportioned cards)
    const trickScale = 0.52;
    // Spacing between cards: wide enough to clearly see rank and suit of every card,
    // with realistic physical overlap (layering)
    const spacing = count > 1 ? Math.min(0.26, 0.95 / count) : 0.28;
    const startX = -((count - 1) * spacing) / 2;

    cards.forEach((card, idx) => {
      const cardMesh = new CardMesh(card, true);
      cardMesh.scale.set(trickScale, trickScale, trickScale);

      const targetX = startX + idx * spacing;
      // Slight fan rotation so it looks realistically played/thrown on the table
      const targetRotZ = (idx - (count - 1) / 2) * 0.035 + (Math.random() - 0.5) * 0.02;
      // Cards tilted up towards player camera (-56 deg) instead of flat,
      // eliminating grazing angle distortion and making the textures 100% sharp and readable!
      const targetRotX = -Math.PI / 3.2;

      // Realistic physical layering: each subsequent card is physically slightly higher in Y and closer in Z
      const targetY = 0.025 + idx * 0.005;
      const targetZ = idx * 0.006;

      // Explicit render order ensures crisp, glitch-free layering
      cardMesh.mesh.renderOrder = 200 + idx;

      // Starting flight origin based on seat
      if (isLocalPlayer) {
        cardMesh.position.set(targetX * 0.6, 0.95, 1.4);
        cardMesh.rotation.set(-Math.PI / 5, 0, targetRotZ);
      } else {
        if (seatIndex === 1) {
          cardMesh.position.set(1.6, 1.1, 0.2);
          cardMesh.rotation.set(-Math.PI / 3, 0.5, targetRotZ + 0.3);
        } else if (seatIndex === 3) {
          cardMesh.position.set(-1.6, 1.1, 0.2);
          cardMesh.rotation.set(-Math.PI / 3, -0.5, targetRotZ - 0.3);
        } else {
          // Opposite seat 2
          cardMesh.position.set(targetX, 1.2, -1.2);
          cardMesh.rotation.set(-Math.PI / 3, 0, targetRotZ);
        }
      }

      this.activeTrickGroup.add(cardMesh);

      // Animate smoothly landing onto table with realistic timing
      gsap.to(cardMesh.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.38,
        delay: idx * 0.035,
        ease: 'power2.out',
        onComplete: () => {
          if (idx === count - 1) {
            SoundEffects.getInstance().playCardPlace();
          }
        },
      });

      gsap.to(cardMesh.rotation, {
        x: targetRotX,
        y: 0,
        z: targetRotZ,
        duration: 0.38,
        delay: idx * 0.035,
        ease: 'power2.out',
      });
    });
  }

  /**
   * Settles active trick cards into the table discard pile.
   */
  public settleActiveTrickToDiscardPile(): void {
    const activeCards = [...this.activeTrickGroup.children] as CardMesh[];
    if (activeCards.length === 0) return;

    activeCards.forEach((cardMesh) => {
      this.discardPileCount++;
      const jitterRotZ = (Math.random() - 0.5) * 0.5;
      const jitterX = (Math.random() - 0.5) * 0.28;
      const jitterZ = (Math.random() - 0.5) * 0.22;
      const stackY = Math.min(0.045, this.discardPileCount * 0.0012);

      this.activeTrickGroup.remove(cardMesh);
      this.discardPileGroup.add(cardMesh);

      // Animate smoothly settling into the discard pile on the felt
      gsap.to(cardMesh.position, {
        x: jitterX,
        y: stackY,
        z: jitterZ,
        duration: 0.35,
        ease: 'power2.inOut',
      });
      gsap.to(cardMesh.rotation, {
        x: -Math.PI / 2,
        y: 0,
        z: jitterRotZ,
        duration: 0.35,
        ease: 'power2.inOut',
      });
      // Slightly reduce scale for discarded cards on table
      gsap.to(cardMesh.scale, {
        x: 0.44,
        y: 0.44,
        z: 0.44,
        duration: 0.35,
      });
    });
  }

  /**
   * Called on round reset: moves active trick to discard pile.
   */
  public onRoundReset(): void {
    this.settleActiveTrickToDiscardPile();
  }

  /**
   * Clears all cards from the table (called on new match or leave room).
   */
  public clearAllTableCards(): void {
    while (this.activeTrickGroup.children.length > 0) {
      this.activeTrickGroup.remove(this.activeTrickGroup.children[0]);
    }
    while (this.discardPileGroup.children.length > 0) {
      this.discardPileGroup.remove(this.discardPileGroup.children[0]);
    }
    this.discardPileCount = 0;
  }

  /**
   * Complete reset: table cards + local player cards (called on leave room).
   */
  public clearAll(): void {
    this.clearAllTableCards();
    this.setPlayerCards([], false);
  }

  private initInteraction(): void {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;
    let lastTapTimestamp = 0;

    const shouldIgnoreTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      // Only ignore if the user clicked an actual button, input, or open modal/dropdown
      return !!el.closest('button, input, textarea, select, .modal-content, .reactions-dropdown, .btn, .copy-badge, .color-swatch');
    };

    const onPointerStart = (clientX: number, clientY: number, target: EventTarget | null) => {
      if (shouldIgnoreTarget(target)) {
        isTracking = false;
        return;
      }
      startX = clientX;
      startY = clientY;
      startTime = performance.now();
      isTracking = true;
    };

    const onPointerEnd = (clientX: number, clientY: number, target: EventTarget | null) => {
      if (!isTracking) return;
      isTracking = false;

      if (shouldIgnoreTarget(target)) return;

      const dx = clientX - startX;
      const dy = clientY - startY;
      const dist = Math.hypot(dx, dy);
      const dt = performance.now() - startTime;

      // Tap gesture threshold: finger moved less than 20px and tap lasted under 450ms
      if (dist < 20 && dt < 450) {
        const now = performance.now();
        if (now - lastTapTimestamp > 120) {
          lastTapTimestamp = now;
          this.selectCardAt(clientX, clientY);
        }
      }
    };

    // 1. Pointer events (Desktop & modern Mobile)
    window.addEventListener('pointerdown', (e: PointerEvent) => {
      onPointerStart(e.clientX, e.clientY, e.target);
    });

    window.addEventListener('pointerup', (e: PointerEvent) => {
      onPointerEnd(e.clientX, e.clientY, e.target);
    });

    // 2. Direct touch events fallback for iOS Safari WebKit quirks
    window.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length === 1) {
          onPointerStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        if (e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          onPointerEnd(t.clientX, t.clientY, e.target);
        }
      },
      { passive: true }
    );

    // 3. Mouse click fallback for desktop
    window.addEventListener('click', (e: MouseEvent) => {
      if (shouldIgnoreTarget(e.target)) return;
      const now = performance.now();
      if (now - lastTapTimestamp > 250) {
        lastTapTimestamp = now;
        this.selectCardAt(e.clientX, e.clientY);
      }
    });
  }

  public selectCardAt(clientX: number, clientY: number): void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    if (!rect.width || !rect.height) return;

    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshesToTest = this.playerCardMeshes.map(cm => cm.mesh);
    const intersects = this.raycaster.intersectObjects(meshesToTest, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      const cardMesh = hit.userData.cardMesh as CardMesh;
      if (cardMesh) {
        this.handleCardClick(cardMesh);
      }
    }
  }

  public handleCardClick(cardMesh: CardMesh): void {
    // 1. If clicking an already selected card, deselect it
    if (cardMesh.isSelected) {
      this.toggleCardSelection(cardMesh, false);
      return;
    }

    // 2. If no cards are currently selected, try smart auto-prediction to beat table
    if (this.selectedCards.size === 0 && this.getTargetCombination) {
      const target = this.getTargetCombination();
      if (target) {
        const handCards = this.playerCardMeshes.map(cm => cm.card);
        const suggestion = Compare.findSmartSuggestion(cardMesh.card, handCards, target);

        if (suggestion && suggestion.length > 1) {
          const suggestionIds = new Set(suggestion.map(c => c.id));
          const meshesToSelect = this.playerCardMeshes.filter(cm => suggestionIds.has(cm.card.id));

          if (meshesToSelect.length === suggestion.length) {
            meshesToSelect.forEach(cm => {
              this.toggleCardSelection(cm, true, false);
            });
            SoundEffects.getInstance().playCardSelect();
            if (this.onSelectionChanged) {
              this.onSelectionChanged(Array.from(this.selectedCards));
            }
            return;
          }
        }
      }
    }

    // 3. Fallback: single card toggle
    this.toggleCardSelection(cardMesh, true);
  }

  public toggleCardSelection(cardMesh: CardMesh, forceState?: boolean, notify: boolean = true): void {
    const cardId = cardMesh.card.id;
    const isSelected = forceState !== undefined ? forceState : !cardMesh.isSelected;
    if (cardMesh.isSelected === isSelected && forceState !== undefined) {
      return;
    }
    cardMesh.setSelected(isSelected);

    const liftY = 0.095;

    if (isSelected) {
      this.selectedCards.add(cardId);
      // Lift vertically UP while keeping Z strictly at originalZ.
      // Card i remains in front of Card i-1 (higher layer) and behind Card i+1 (lower layer).
      // A card is only lower than the card to its right ("chỉ thấp hơn lá bên phải")!
      gsap.to(cardMesh.position, {
        y: cardMesh.originalY + liftY,
        z: cardMesh.originalZ,
        duration: 0.18,
        ease: 'power2.out',
      });
    } else {
      this.selectedCards.delete(cardId);
      // Lower vertically DOWN
      gsap.to(cardMesh.position, {
        y: cardMesh.originalY,
        z: cardMesh.originalZ,
        duration: 0.18,
        ease: 'power2.out',
      });
    }

    if (notify) {
      SoundEffects.getInstance().playCardSelect();

      if (this.onSelectionChanged) {
        this.onSelectionChanged(Array.from(this.selectedCards));
      }
    }
  }

  public clearSelection(): void {
    for (const cardMesh of this.playerCardMeshes) {
      if (cardMesh.isSelected) {
        cardMesh.setSelected(false);
        gsap.to(cardMesh.position, {
          y: cardMesh.originalY,
          z: cardMesh.originalZ,
          duration: 0.2,
          ease: 'power2.out',
        });
      }
    }
    this.selectedCards.clear();
    if (this.onSelectionChanged) {
      this.onSelectionChanged([]);
    }
  }
}
