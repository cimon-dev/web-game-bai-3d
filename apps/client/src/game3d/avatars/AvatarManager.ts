import * as THREE from 'three';
import { PlayerPublicInfo } from '@game/shared';
import { CharacterAvatar } from './CharacterAvatar';

export class AvatarManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  public avatars: Map<string, CharacterAvatar> = new Map();

  // Color schemes for up to 4 cartoon characters
  private static readonly COLOR_PALETTES = [
    { shirt: 0x2563eb, pants: 0x1e293b, skin: 0xfed7aa, hair: 0x451a03 }, // Royal Blue
    { shirt: 0xdc2626, pants: 0x1e293b, skin: 0xffedd5, hair: 0x171717 }, // Crimson Red
    { shirt: 0x16a34a, pants: 0x1e293b, skin: 0xfcd34d, hair: 0x78350f }, // Emerald Green
    { shirt: 0x9333ea, pants: 0x1e293b, skin: 0xfde047, hair: 0x0f172a }, // Royal Purple
  ];

  // Positions corresponding to relative seats 1 (Right), 2 (Across), 3 (Left)
  private static readonly SEAT_TRANSFORMS: Record<number, { pos: THREE.Vector3; rotY: number }> = {
    1: { pos: new THREE.Vector3(2.25, 0, 0), rotY: -Math.PI / 2 },
    2: { pos: new THREE.Vector3(0, 0, -2.25), rotY: 0 },
    3: { pos: new THREE.Vector3(-2.25, 0, 0), rotY: Math.PI / 2 },
  };

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Updates all 3D avatars based on current players in room.
   */
  public updatePlayers(players: PlayerPublicInfo[], myId: string): void {
    const myPlayer = players.find(p => p.id === myId);
    const mySeat = myPlayer?.seatIndex ?? 0;

    const currentOpponentIds = new Set<string>();

    for (const player of players) {
      if (player.id === myId) continue;

      currentOpponentIds.add(player.id);

      // Compute relative seat from local player's perspective
      const relativeSeat = (player.seatIndex - mySeat + 4) % 4;
      if (relativeSeat === 0) continue; // local player

      let avatar = this.avatars.get(player.id);
      if (!avatar || avatar.relativeSeat !== relativeSeat) {
        // Destroy old avatar if seat changed
        if (avatar) {
          this.scene.remove(avatar);
          avatar.destroy();
        }

        avatar = new CharacterAvatar({
          name: player.name,
          relativeSeat,
          customization: player.avatar,
        });

        const transform = AvatarManager.SEAT_TRANSFORMS[relativeSeat];
        if (transform) {
          avatar.position.copy(transform.pos);
          avatar.rotation.y = transform.rotY;
        }

        this.scene.add(avatar);
        this.avatars.set(player.id, avatar);
      }

      // Update state
      avatar.setTurnActive(player.isTurn);
      avatar.setCardsInHand(player.cardCount);
      if (player.selectedCardIndices) {
        avatar.setSelectedCardIndices(player.selectedCardIndices);
      }
    }

    // Remove avatars for players that left
    for (const [id, avatar] of this.avatars.entries()) {
      if (!currentOpponentIds.has(id)) {
        this.scene.remove(avatar);
        avatar.destroy();
        this.avatars.delete(id);
      }
    }
  }

  public getAvatar(playerId: string): CharacterAvatar | undefined {
    return this.avatars.get(playerId);
  }

  /**
   * Projects an avatar's head to 2D screen coordinates (percentage strings for CSS top/left).
   */
  public getHeadScreenPosition(playerId: string): { top: string; left: string } | null {
    const avatar = this.avatars.get(playerId);
    if (!avatar) return null;

    const headWorldPos = new THREE.Vector3();
    avatar.headGroup.getWorldPosition(headWorldPos);
    headWorldPos.y += 0.35; // slightly above head

    const projected = headWorldPos.project(this.camera);

    // If behind camera
    if (projected.z > 1) return null;

    const x = (projected.x * 0.5 + 0.5) * 100;
    const y = (-(projected.y * 0.5) + 0.5) * 100;

    return {
      left: `${x.toFixed(1)}%`,
      top: `${y.toFixed(1)}%`,
    };
  }

  public removeAvatar(playerId: string): void {
    const avatar = this.avatars.get(playerId);
    if (avatar) {
      this.scene.remove(avatar);
      avatar.destroy();
      this.avatars.delete(playerId);
    }
  }

  public clear(): void {
    for (const avatar of this.avatars.values()) {
      this.scene.remove(avatar);
      avatar.destroy();
    }
    this.avatars.clear();
  }
}
