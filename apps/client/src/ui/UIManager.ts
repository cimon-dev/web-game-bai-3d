import { AvatarCustomization, PlayerPublicInfo, RoomSummary, ScoreboardEntry } from '@game/shared';
import * as THREE from 'three';
import { SoundEffects } from '../audio/SoundEffects';
import { CharacterAvatar } from '../game3d/avatars/CharacterAvatar';
import { NetworkClient } from '../network/NetworkClient';

export interface WelcomeCallbacks {
  onCreateRoom: (name: string) => void;
  onJoinByCode: (code: string) => void;
  onQuickJoin: () => void;
  onJoinRoomId: (roomId: string) => void;
  onNameChange: (name: string) => void;
  onAvatarChanged?: (avatar: AvatarCustomization) => void;
}

export interface InGameCallbacks {
  onPlayCards: () => void;
  onPassTurn: () => void;
  onSortCards: () => void;
  onDeselectCards: () => void;
  onReadyToggle: (ready: boolean) => void;
  onHostStartGame: () => void;
  onLeaveRoom: () => void;
  onSendReaction?: (emoji: string) => void;
  onKickPlayer?: (playerId: string) => void;
}

export class UIManager {
  private container: HTMLElement;
  private sfx: SoundEffects;

  private currentScreen: 'welcome' | 'in_game' = 'welcome';
  private inGameCallbacks?: InGameCallbacks;
  private rooms: RoomSummary[] = [];
  private searchQuery: string = '';

  private timerInterval: number | null = null;
  private toastTimeout: number | null = null;

  constructor(containerId: string = 'ui-root') {
    this.container = document.getElementById(containerId)!;
    this.sfx = SoundEffects.getInstance();
    this.initOrientationOverlay();
  }

  private initOrientationOverlay(): void {
    if (document.getElementById('orientation-lock-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'orientation-lock-overlay';
    overlay.innerHTML = `
      <div class="orientation-card glass-panel">
        <div class="phone-rotate-icon">
          <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="3" ry="3"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
            <path d="M19 9a7 7 0 0 1-7 7m0-14a7 7 0 0 1 7 7"></path>
          </svg>
        </div>
        <h2>VUI LÒNG XOAY NGANG MÀN HÌNH</h2>
        <p>Game bài 3D Tiến Lên Miền Nam được tối ưu hóa cho màn hình ngang (Landscape) để hiển thị trọn vẹn toàn bộ các quân bài trên tay.</p>
        <div class="rotate-hint-pill">
          <span>🔄</span>
          <span>Xoay ngang điện thoại để chơi</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  public showWelcome(playerName: string, callbacks: WelcomeCallbacks): void {
    this.currentScreen = 'welcome';
    this.container.innerHTML = `
      <div class="screen-welcome ui-interactive">
        <!-- Header -->
        <header class="lobby-header">
          <div class="logo-container">
            <span class="lobby-logo-icon">🎴</span>
            <div>
              <h1 class="game-title">TIẾN LÊN MIỀN NAM 3D</h1>
              <p class="game-subtitle">Góc nhìn thứ nhất FPS • Đồ họa Hoạt hình 3D Cao cấp</p>
            </div>
          </div>

          <div class="user-profile-bar glass-panel">
            <span class="user-profile-icon">👤</span>
            <input type="text" id="player-name-input" value="${this.escapeHtml(playerName)}" maxlength="16" placeholder="Tên của bạn" />
            <button class="btn btn-secondary btn-profile-action" id="btn-custom-avatar">
              🎨 Tùy chọn nhân vật
            </button>
            <button class="btn btn-secondary btn-profile-action" id="btn-open-settings">
              ⚙️ Cài đặt
            </button>
          </div>
        </header>

        <!-- Main Content -->
        <main class="lobby-main">
          <!-- Sidebar Actions -->
          <div class="lobby-actions-sidebar">
            <!-- Quick Join -->
            <div class="action-card glass-panel">
              <h3>⚡ Vào Bàn Nhanh</h3>
              <p class="action-card-desc">Tự động tìm kiếm phòng chơi đang còn ghế trống và tham gia ngay lập tức.</p>
              <button class="btn btn-primary" id="btn-quick-join">Vào Nhanh Ngay</button>
            </div>

            <!-- Join by Code -->
            <div class="action-card glass-panel">
              <h3>🔑 Tham Gia Bằng Mã</h3>
              <div class="join-code-input">
                <input type="text" id="input-room-code" placeholder="MÃ PHÒNG" maxlength="6" />
                <button class="btn btn-secondary" id="btn-join-code">Vào</button>
              </div>
            </div>

            <!-- Create Room -->
            <div class="action-card glass-panel">
              <h3>➕ Tạo Bàn Chơi Mới</h3>
              <input type="text" id="input-new-room-name" placeholder="Tên phòng (tùy chọn)" class="room-search-input" style="width: 100%;" />
              <button class="btn btn-success" id="btn-create-room">Tạo Phòng</button>
            </div>
          </div>

          <!-- Room Browser -->
          <div class="room-browser glass-panel">
            <div class="room-browser-header">
              <div class="room-browser-title-wrap">
                <h2 class="room-browser-title">Danh Sách Bàn Chơi</h2>
                <span class="room-code-tag" id="room-count-badge">0 phòng</span>
              </div>
              <input type="text" id="input-room-search" class="room-search-input" placeholder="🔍 Tìm kiếm tên phòng..." />
            </div>

            <div class="rooms-grid" id="rooms-grid-container">
              <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">
                Đang tải dữ liệu bàn chơi...
              </div>
            </div>
          </div>
        </main>
      </div>
    `;

    // Bind Welcome events
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
    nameInput?.addEventListener('change', () => {
      callbacks.onNameChange(nameInput.value.trim());
    });

    document.getElementById('btn-custom-avatar')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      const client = NetworkClient.getInstance();
      this.showAvatarCustomizerModal(client.avatar, (newAvatar) => {
        client.setAvatar(newAvatar);
        if (callbacks.onAvatarChanged) {
          callbacks.onAvatarChanged(newAvatar);
        }
      });
    });

    document.getElementById('btn-quick-join')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onQuickJoin();
    });

    document.getElementById('btn-join-code')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      const codeInput = document.getElementById('input-room-code') as HTMLInputElement;
      const code = codeInput?.value.trim().toUpperCase();
      if (code) {
        callbacks.onJoinByCode(code);
      } else {
        this.showToast('Vui lòng nhập mã phòng.', 'error');
      }
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      const nameInputNew = document.getElementById('input-new-room-name') as HTMLInputElement;
      callbacks.onCreateRoom(nameInputNew?.value.trim() || '');
    });

    const searchInput = document.getElementById('input-room-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.renderRoomGrid(callbacks.onJoinRoomId);
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      this.showSettingsModal();
    });

    this.renderRoomGrid(callbacks.onJoinRoomId);
  }

  public updateRooms(rooms: RoomSummary[], onJoinRoomId: (id: string) => void): void {
    this.rooms = rooms;
    if (this.currentScreen === 'welcome') {
      this.renderRoomGrid(onJoinRoomId);
    }
  }

  private renderRoomGrid(onJoinRoomId: (id: string) => void): void {
    const grid = document.getElementById('rooms-grid-container');
    const badge = document.getElementById('room-count-badge');
    if (!grid) return;

    const filtered = this.rooms.filter(r =>
      r.name.toLowerCase().includes(this.searchQuery) || r.code.toLowerCase().includes(this.searchQuery)
    );

    if (badge) {
      badge.textContent = `${filtered.length} phòng`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">
          Chưa có phòng nào đang mở. Hãy bấm "Tạo Phòng Mới" để bắt đầu!
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(room => {
      const isFull = room.playerCount >= room.maxPlayers;
      const isPlaying = room.phase === 'playing';
      let statusBadge = '<span style="color: #10b981;">Đang chờ</span>';
      if (isPlaying) statusBadge = '<span style="color: #f59e0b;">Đang chơi</span>';
      if (isFull) statusBadge = '<span style="color: #ef4444;">Đã đầy</span>';

      return `
        <div class="room-card">
          <div class="room-card-header">
            <span class="room-name" title="${this.escapeHtml(room.name)}">${this.escapeHtml(room.name)}</span>
            <span class="room-code-tag">${room.code}</span>
          </div>
          <div class="room-status">
            <span>${statusBadge}</span>
            <span>👤 ${room.playerCount}/${room.maxPlayers}</span>
          </div>
          <button class="btn btn-primary" data-room-id="${room.id}" ${isFull || isPlaying ? 'disabled' : ''} style="width: 100%; padding: 8px;">
            ${isFull ? 'Phòng Đầy' : isPlaying ? 'Đang Chơi' : 'Vào Bàn'}
          </button>
        </div>
      `;
    }).join('');

    const joinBtns = grid.querySelectorAll('button[data-room-id]');
    joinBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sfx.playButtonClick();
        const roomId = (e.currentTarget as HTMLElement).getAttribute('data-room-id');
        if (roomId) onJoinRoomId(roomId);
      });
    });
  }

  public showGameHUD(
    roomName: string,
    roomCode: string,
    callbacks: InGameCallbacks
  ): void {
    this.currentScreen = 'in_game';
    this.inGameCallbacks = callbacks;
    this.container.innerHTML = `
      <div class="hud-container">
        <!-- Countdown Banner Overlay -->
        <div id="countdown-banner-overlay" class="countdown-banner" style="display: none;"></div>

        <!-- Top HUD -->
        <div class="hud-top">
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
            <div class="room-info-pill glass-panel ui-interactive">
              <span style="font-size: 1.2rem;">🎲</span>
              <span style="font-family: var(--font-display); font-weight: 700;">${this.escapeHtml(roomName)}</span>
              <span class="copy-badge" id="btn-copy-code" title="Bấm để sao chép link bàn chơi">Mã: ${roomCode} 📋</span>
            </div>
            <!-- Small indicator showing whose turn it currently is at the corner of the screen -->
            <div id="turn-indicator-badge" class="turn-indicator-badge glass-panel" style="display: none;">
              <span class="turn-dot"></span>
              <span id="turn-indicator-text">Lượt của: Bạn</span>
            </div>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;" class="ui-interactive">
            <button class="btn btn-success" id="btn-host-start" style="display: none; padding: 8px 18px; font-size: 0.9rem;">
              ▶ Bắt Đầu Ván
            </button>
            <button class="btn btn-success" id="btn-ready-toggle" style="padding: 8px 18px; font-size: 0.9rem;">
              ✅ Đã Sẵn Sàng
            </button>
            <!-- Quick Reaction Dropdown Toggle at Top (doesn't cover hand cards!) -->
            <div class="reactions-dropdown-wrap ui-interactive">
              <button class="btn btn-secondary btn-header" id="btn-toggle-reactions" title="Biểu cảm" style="padding: 8px 12px; font-size: 1.1rem;">
                😊
              </button>
              <div id="reactions-dropdown" class="reactions-dropdown glass-panel" style="display: none;">
                <button class="reaction-btn" data-emoji="👍" title="Like">👍</button>
                <button class="reaction-btn" data-emoji="🔥" title="Cháy quá">🔥</button>
                <button class="reaction-btn" data-emoji="😎" title="Đẳng cấp">😎</button>
                <button class="reaction-btn" data-emoji="😂" title="Haha">😂</button>
                <button class="reaction-btn" data-emoji="😭" title="Khóc thét">😭</button>
                <button class="reaction-btn" data-emoji="💣" title="Chặt heo!">💣</button>
              </div>
            </div>
            <button class="btn btn-secondary" id="btn-hud-settings" style="padding: 8px 14px;">
              ⚙️
            </button>
            <button class="btn btn-danger" id="btn-leave-room" style="padding: 8px 16px; font-size: 0.9rem;">
              🚪 Rời Bàn
            </button>
          </div>
        </div>

        <!-- Opponents Minimalist Nameplates Overlay Layer -->
        <div class="opponent-hud-layer" id="opponent-plates-container"></div>

        <!-- Bottom Action Bar & Turn Timer -->
        <div class="hud-bottom" style="display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;">
          <div class="action-bar glass-panel not-my-turn ui-interactive">
            <!-- Turn Countdown Timer -->
            <div class="timer-container" id="hud-timer-container">
              <svg class="timer-svg" width="68" height="68">
                <circle class="timer-circle-bg" cx="34" cy="34" r="28" />
                <circle class="timer-circle-bar" id="timer-bar" cx="34" cy="34" r="28" stroke-dasharray="175.9" stroke-dashoffset="0" />
              </svg>
              <span class="timer-text" id="timer-text">30</span>
            </div>

            <!-- Action Buttons -->
            <button class="btn btn-secondary" id="btn-sort-cards" title="Sắp xếp bài từ bé đến lớn">
              🔄 Sắp Bài
            </button>
            <button class="btn btn-secondary" id="btn-deselect-cards" style="display: none;">
              ❌ Bỏ Chọn
            </button>
            <button class="btn btn-secondary" id="btn-pass-turn" disabled>
              🛑 Bỏ Lượt
            </button>
            <button class="btn btn-primary" id="btn-play-cards" disabled>
              🚀 Đánh Bài
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind in-game events
    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      navigator.clipboard.writeText(shareUrl);
      this.showToast(`Đã sao chép liên kết bàn chơi: ${shareUrl}`, 'success');
    });

    let isReady = true; // Default ready state as requested
    const readyBtn = document.getElementById('btn-ready-toggle');
    readyBtn?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      isReady = !isReady;
      if (isReady) {
        readyBtn.textContent = '✅ Đã Sẵn Sàng';
        readyBtn.className = 'btn btn-success';
      } else {
        readyBtn.textContent = '⏳ Chờ';
        readyBtn.className = 'btn btn-warning';
      }
      callbacks.onReadyToggle(isReady);
    });

    document.getElementById('btn-host-start')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onHostStartGame();
    });

    document.getElementById('btn-hud-settings')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      this.showSettingsModal();
    });

    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onLeaveRoom();
    });

    document.getElementById('btn-sort-cards')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onSortCards();
    });

    document.getElementById('btn-deselect-cards')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onDeselectCards();
    });

    document.getElementById('btn-pass-turn')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onPassTurn();
    });

    document.getElementById('btn-play-cards')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      callbacks.onPlayCards();
    });

    // Reaction dropdown toggle
    const toggleReactionsBtn = document.getElementById('btn-toggle-reactions');
    const reactionsDropdown = document.getElementById('reactions-dropdown');
    toggleReactionsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sfx.playButtonClick();
      if (reactionsDropdown) {
        const isOpen = reactionsDropdown.style.display === 'flex';
        reactionsDropdown.style.display = isOpen ? 'none' : 'flex';
      }
    });

    // Close reaction dropdown when clicking outside
    window.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (reactionsDropdown && !target.closest('.reactions-dropdown-wrap')) {
        reactionsDropdown.style.display = 'none';
      }
    });

    // Reaction buttons inside dropdown
    const reactionBtns = document.querySelectorAll<HTMLElement>('.reaction-btn');
    reactionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (reactionsDropdown) reactionsDropdown.style.display = 'none';
        if (emoji && callbacks.onSendReaction) {
          this.sfx.playButtonClick();
          callbacks.onSendReaction(emoji);
        }
      });
    });
  }

  /**
   * Minimalist floating nameplate directly on top of opponent's head in 3D space.
   */
  public updateOpponentPlates(
    players: PlayerPublicInfo[],
    myId: string,
    getPositionForPlayer?: (playerId: string) => { top: string; left: string } | null,
    isHost: boolean = false,
    isPlaying: boolean = false
  ): void {
    const container = document.getElementById('opponent-plates-container');
    if (!container) return;

    const myPlayer = players.find(p => p.id === myId);
    const mySeat = myPlayer?.seatIndex ?? 0;
    const opponents = players.filter(p => p.id !== myId);

    const seatScreenPositions: Record<number, { top: string; left: string }> = {
      1: { top: '48%', left: '86%' },
      2: { top: '16%', left: '50%' },
      3: { top: '48%', left: '14%' },
    };

    container.innerHTML = opponents.map(p => {
      const relativeSeat = (p.seatIndex - mySeat + 4) % 4;
      const projectedPos = getPositionForPlayer ? getPositionForPlayer(p.id) : null;
      const pos = projectedPos || seatScreenPositions[relativeSeat] || { top: '20%', left: '50%' };
      const turnClass = p.isTurn ? 'is-turn' : '';

      // "khi bắt đầu đã đánh rồi vẫn hiển thị ở cùng chỗ tên người dùng chữ sẵn sàng (khi vào trận chỉ hiển thị mỗi tên thôi)"
      let statusBadge = '';
      if (!isPlaying) {
        statusBadge = p.isReady
          ? '<span class="status-badge ready">Sẵn sàng</span>'
          : '<span class="status-badge" style="background: rgba(245,158,11,0.25); color: #fbbf24;">Chờ</span>';
      } else {
        if (p.hasPassed) {
          statusBadge = '<span class="status-badge passed">Bỏ lượt</span>';
        }
      }

      const kickBtn = (isHost && !isPlaying)
        ? `<button class="btn-kick-player" data-kick-id="${p.id}" title="Mời người chơi này ra khỏi phòng">👢 Kick</button>`
        : '';

      return `
        <div class="opponent-name-tag ${turnClass}" data-player-id="${p.id}" style="top: ${pos.top}; left: ${pos.left};">
          ${p.isTurn ? '<span class="turn-dot"></span>' : ''}
          <span class="name-text">👤 ${this.escapeHtml(p.name)}</span>
          ${statusBadge}
          ${kickBtn}
        </div>
      `;
    }).join('');

    if (isHost && !isPlaying) {
      container.querySelectorAll('.btn-kick-player').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetId = (e.currentTarget as HTMLElement).getAttribute('data-kick-id');
          if (targetId && this.inGameCallbacks?.onKickPlayer) {
            this.sfx.playButtonClick();
            this.inGameCallbacks.onKickPlayer(targetId);
          }
        });
      });
    }
  }

  /**
   * Displays a small, elegant indicator at the corner of the screen
   * showing whose turn it currently is.
   */
  public updateTurnIndicator(isMyTurn: boolean, playerName: string, isPlaying: boolean): void {
    const el = document.getElementById('turn-indicator-badge');
    const textEl = document.getElementById('turn-indicator-text');
    if (!el || !textEl) return;
    if (!isPlaying) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'inline-flex';
    if (isMyTurn) {
      el.classList.add('is-my-turn');
      textEl.innerHTML = `👉 Đang là lượt của: <strong>BẠN</strong>`;
    } else {
      el.classList.remove('is-my-turn');
      textEl.innerHTML = `⏳ Đang là lượt của: <strong>${this.escapeHtml(playerName)}</strong>`;
    }
  }

  /**
   * Toggles in-game controls between waiting and playing phases.
   */
  public setGamePhase(phase: 'waiting' | 'playing' | 'finished'): void {
    const readyBtn = document.getElementById('btn-ready-toggle');
    const hostBtn = document.getElementById('btn-host-start');
    if (readyBtn) {
      readyBtn.style.display = phase === 'playing' ? 'none' : 'inline-flex';
    }
    if (hostBtn && phase === 'playing') {
      hostBtn.style.display = 'none';
    }
    if (phase !== 'playing') {
      const turnBadge = document.getElementById('turn-indicator-badge');
      if (turnBadge) turnBadge.style.display = 'none';
    }
  }

  public showCountdown(seconds: number): void {
    this.hideScoreboardModal();
    const el = document.getElementById('countdown-banner-overlay');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="countdown-box glass-panel">
        <div class="countdown-sub">TRẬN ĐẤU BẮT ĐẦU SAU</div>
        <div class="countdown-number" id="countdown-num">${seconds}</div>
        <div class="countdown-hint">Tất cả người chơi đã sẵn sàng!</div>
      </div>
    `;
    this.sfx.playTimerTick();
  }

  public updateCountdown(secondsRemaining: number): void {
    this.hideScoreboardModal();
    const numEl = document.getElementById('countdown-num');
    if (numEl) {
      numEl.textContent = String(secondsRemaining);
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = 'numberPunch 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.sfx.playTimerTick();
    }
  }

  public hideCountdown(): void {
    const el = document.getElementById('countdown-banner-overlay');
    if (el) {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  public updatePlatePositions(getPositionForPlayer: (playerId: string) => { top: string; left: string } | null): void {
    const plates = document.querySelectorAll<HTMLElement>('.opponent-name-tag[data-player-id]');
    plates.forEach(plate => {
      const playerId = plate.getAttribute('data-player-id');
      if (playerId) {
        const pos = getPositionForPlayer(playerId);
        if (pos) {
          plate.style.top = pos.top;
          plate.style.left = pos.left;
        }
      }
    });
  }

  public setHostControls(isHost: boolean, canStart: boolean): void {
    const hostBtn = document.getElementById('btn-host-start') as HTMLButtonElement;
    if (hostBtn) {
      hostBtn.style.display = isHost ? 'inline-flex' : 'none';
      hostBtn.disabled = !canStart;
    }
  }

  public setDeselectVisible(visible: boolean): void {
    const deselectBtn = document.getElementById('btn-deselect-cards');
    if (deselectBtn) {
      deselectBtn.style.display = visible ? 'inline-flex' : 'none';
    }
  }

  public updateComboHint(text: string | null, isValid: boolean): void {
    this.setDeselectVisible(Boolean(text));
  }

  /**
   * Sets turn controls. Dims timer, pass, play buttons when not my turn.
   */
  public setTurnControls(isMyTurn: boolean, canPass: boolean, canPlaySelected: boolean): void {
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) {
      if (isMyTurn) {
        actionBar.classList.remove('not-my-turn');
      } else {
        actionBar.classList.add('not-my-turn');
      }
    }

    const playBtn = document.getElementById('btn-play-cards') as HTMLButtonElement;
    const passBtn = document.getElementById('btn-pass-turn') as HTMLButtonElement;

    if (playBtn) {
      playBtn.disabled = !isMyTurn || !canPlaySelected;
    }

    if (passBtn) {
      passBtn.disabled = !isMyTurn || !canPass;
    }
  }

  public startTimer(seconds: number): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    let remaining = seconds;
    const total = seconds || 30;
    const radius = 28;
    const circumference = 2 * Math.PI * radius; // ~175.9

    const timerText = document.getElementById('timer-text');
    const timerBar = document.getElementById('timer-bar');

    const updateUI = () => {
      if (timerText) timerText.textContent = String(Math.max(0, remaining));
      if (timerBar) {
        const offset = circumference - (remaining / total) * circumference;
        timerBar.style.strokeDashoffset = String(offset);
        if (remaining <= 4) {
          timerBar.style.stroke = '#ef4444';
          this.sfx.playTick();
        } else if (remaining <= 8) {
          timerBar.style.stroke = '#f59e0b';
        } else {
          timerBar.style.stroke = '#10b981';
        }
      }
    };

    updateUI();
    this.timerInterval = window.setInterval(() => {
      remaining--;
      updateUI();
      if (remaining <= 0) {
        clearInterval(this.timerInterval!);
        this.timerInterval = null;
      }
    }, 1000);
  }

  public stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Spawns a floating reaction emoji over an avatar's head.
   */
  public showReactionAt(
    playerId: string,
    emoji: string,
    getPositionForPlayer?: (id: string) => { top: string; left: string } | null
  ): void {
    const container = document.getElementById('opponent-plates-container');
    if (!container) return;

    const pos = getPositionForPlayer ? getPositionForPlayer(playerId) : { top: '35%', left: '50%' };
    if (!pos) return;

    const el = document.createElement('div');
    el.className = 'floating-reaction';
    el.style.top = pos.top;
    el.style.left = pos.left;
    el.textContent = emoji;
    container.appendChild(el);

    this.sfx.playButtonClick();

    setTimeout(() => {
      el.remove();
    }, 1800);
  }

  /**
   * Character Customizer Modal for customizable 3D cartoon avatar.
   */
  public showAvatarCustomizerModal(
    current: AvatarCustomization,
    onSave: (avatar: AvatarCustomization) => void
  ): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay ui-interactive';

    const draft = { ...current };

    const hairStyles: { id: AvatarCustomization['hairStyle']; label: string }[] = [
      { id: 'cap', label: '🧢 Mũ Snapback' },
      { id: 'short', label: '🧑 Tóc Ngắn' },
      { id: 'long', label: '👧 Tóc Dài' },
      { id: 'beanie', label: '🧶 Mũ Len' },
      { id: 'spiky', label: '⚡ Tóc Gai' },
    ];

    const hairColors = [
      { col: '#171717', name: 'Đen' },
      { col: '#451a03', name: 'Nâu' },
      { col: '#ca8a04', name: 'Vàng' },
      { col: '#2563eb', name: 'Xanh' },
      { col: '#db2777', name: 'Hồng' },
    ];

    const shirtColors = [
      { col: '#2563eb', name: 'Xanh dương' },
      { col: '#dc2626', name: 'Đỏ ruby' },
      { col: '#16a34a', name: 'Lục bảo' },
      { col: '#9333ea', name: 'Tím huyền' },
      { col: '#ea580c', name: 'Cam cháy' },
      { col: '#1e293b', name: 'Đen xám' },
    ];

    const skinColors = [
      { col: '#fed7aa', name: 'Tự nhiên' },
      { col: '#ffedd5', name: 'Trắng sáng' },
      { col: '#fcd34d', name: 'Ấm áp' },
    ];

    const accessories: { id: AvatarCustomization['accessory']; label: string }[] = [
      { id: 'none', label: '❌ Không' },
      { id: 'glasses', label: '👓 Kính Tròn' },
      { id: 'sunglasses', label: '😎 Kính Râm' },
      { id: 'headphone', label: '🎧 Tai Nghe' },
    ];

    modal.innerHTML = `
      <div class="modal-content modal-avatar-customizer glass-panel">
        <div class="modal-header">
          <h2>🎨 Tùy Chỉnh Nhân Vật 3D</h2>
          <button class="btn btn-secondary btn-close-modal" id="btn-close-customizer">✕</button>
        </div>

        <div class="avatar-customizer-body">
          <!-- Left: 3D Preview Column -->
          <div class="avatar-preview-card">
            <span class="avatar-preview-title">Xem Trước 3D</span>
            <div id="avatar-preview-container" class="avatar-preview-box"></div>
            <span class="avatar-preview-hint">Kéo để xoay xem các góc</span>
          </div>

          <!-- Right: Customization Options Column -->
          <div class="avatar-options-column">
            <!-- Hair Style -->
            <div class="customizer-section">
              <span class="customizer-label">Kiểu tóc / Mũ</span>
              <div class="chips-row" id="hair-style-chips">
                ${hairStyles.map(h => `
                  <button class="chip-btn avatar-pill-btn ${draft.hairStyle === h.id ? 'active' : ''}" data-style="${h.id}">${h.label}</button>
                `).join('')}
              </div>
            </div>

            <!-- Hair Color -->
            <div class="customizer-section">
              <span class="customizer-label">Màu tóc / Mũ</span>
              <div class="chips-row" id="hair-color-chips">
                ${hairColors.map(c => `
                  <div class="color-swatch ${draft.hairColor === c.col ? 'active' : ''}" data-col="${c.col}" style="background: ${c.col};" title="${c.name}"></div>
                `).join('')}
              </div>
            </div>

            <!-- Shirt Color -->
            <div class="customizer-section">
              <span class="customizer-label">Màu áo Hoodie</span>
              <div class="chips-row" id="shirt-color-chips">
                ${shirtColors.map(c => `
                  <div class="color-swatch ${draft.shirtColor === c.col ? 'active' : ''}" data-col="${c.col}" style="background: ${c.col};" title="${c.name}"></div>
                `).join('')}
              </div>
            </div>

            <!-- Skin Tone -->
            <div class="customizer-section">
              <span class="customizer-label">Màu da</span>
              <div class="chips-row" id="skin-color-chips">
                ${skinColors.map(s => `
                  <div class="color-swatch ${draft.skinColor === s.col ? 'active' : ''}" data-col="${s.col}" style="background: ${s.col};" title="${s.name}"></div>
                `).join('')}
              </div>
            </div>

            <!-- Accessory -->
            <div class="customizer-section">
              <span class="customizer-label">Phụ kiện khuôn mặt</span>
              <div class="chips-row" id="accessory-chips">
                ${accessories.map(a => `
                  <button class="chip-btn avatar-pill-btn ${draft.accessory === a.id ? 'active' : ''}" data-acc="${a.id}">${a.label}</button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-save-avatar" id="btn-save-avatar">
          Lưu Nhân Vật
        </button>
      </div>
    `;

    this.container.appendChild(modal);

    // 3D Preview Engine
    const previewContainer = modal.querySelector('#avatar-preview-container') as HTMLElement;
    let animId: number = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cleanPreview = () => {};

    if (previewContainer) {
      const pWidth = previewContainer.clientWidth || 208;
      const pHeight = previewContainer.clientHeight || 230;
      const previewScene = new THREE.Scene();
      const previewCam = new THREE.PerspectiveCamera(40, pWidth / pHeight, 0.1, 10);
      previewCam.position.set(0, 0.65, 1.85);
      previewCam.lookAt(0, 0.52, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(pWidth, pHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      previewContainer.appendChild(renderer.domElement);

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          if (w > 0 && h > 0 && renderer) {
            renderer.setSize(w, h);
            previewCam.aspect = w / h;
            previewCam.updateProjectionMatrix();
          }
        }
      });
      resizeObserver.observe(previewContainer);

      const ambLight = new THREE.AmbientLight(0xfff7ed, 1.2);
      previewScene.add(ambLight);

      const dirLight = new THREE.DirectionalLight(0xffedd5, 1.5);
      dirLight.position.set(2, 4, 3);
      previewScene.add(dirLight);

      const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.5);
      rimLight.position.set(-2, 2, -2);
      previewScene.add(rimLight);

      let currentAvatarMesh: CharacterAvatar | null = null;
      let targetRotY = 0;
      let isDragging = false;
      let startX = 0;

      const refreshPreview = () => {
        if (currentAvatarMesh) {
          previewScene.remove(currentAvatarMesh);
        }
        currentAvatarMesh = new CharacterAvatar({
          name: 'Preview',
          relativeSeat: 0,
          customization: draft,
        });
        currentAvatarMesh.position.set(0, 0, 0);
        previewScene.add(currentAvatarMesh);
      };

      refreshPreview();

      // Mouse drag rotation
      renderer.domElement.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        if (renderer) renderer.domElement.style.cursor = 'grabbing';
      });

      const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        startX = e.clientX;
        targetRotY += dx * 0.02;
      };
      const onPointerUp = () => {
        isDragging = false;
        if (renderer) renderer.domElement.style.cursor = 'grab';
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      const renderPreview = () => {
        if (!isDragging) {
          targetRotY += 0.008; // slow gentle idle rotation
        }
        if (currentAvatarMesh) {
          currentAvatarMesh.rotation.y = targetRotY;
        }
        if (renderer) {
          renderer.render(previewScene, previewCam);
          animId = requestAnimationFrame(renderPreview);
        }
      };
      animId = requestAnimationFrame(renderPreview);

      cleanPreview = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (resizeObserver) resizeObserver.disconnect();
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss();
          renderer = null;
        }
      };

      // Event bindings for customizer with live refresh
      modal.querySelectorAll('#hair-style-chips .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('#hair-style-chips .chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          draft.hairStyle = btn.getAttribute('data-style') as AvatarCustomization['hairStyle'];
          this.sfx.playButtonClick();
          refreshPreview();
        });
      });

      modal.querySelectorAll('#hair-color-chips .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          modal.querySelectorAll('#hair-color-chips .color-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          draft.hairColor = sw.getAttribute('data-col')!;
          this.sfx.playButtonClick();
          refreshPreview();
        });
      });

      modal.querySelectorAll('#shirt-color-chips .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          modal.querySelectorAll('#shirt-color-chips .color-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          draft.shirtColor = sw.getAttribute('data-col')!;
          this.sfx.playButtonClick();
          refreshPreview();
        });
      });

      modal.querySelectorAll('#skin-color-chips .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          modal.querySelectorAll('#skin-color-chips .color-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          draft.skinColor = sw.getAttribute('data-col')!;
          this.sfx.playButtonClick();
          refreshPreview();
        });
      });

      modal.querySelectorAll('#accessory-chips .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('#accessory-chips .chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          draft.accessory = btn.getAttribute('data-acc') as AvatarCustomization['accessory'];
          this.sfx.playButtonClick();
          refreshPreview();
        });
      });
    }

    modal.querySelector('#btn-close-customizer')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      cleanPreview();
      modal.remove();
    });

    modal.querySelector('#btn-save-avatar')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      cleanPreview();
      onSave(draft);
      this.showToast('Đã lưu tùy chỉnh nhân vật!', 'success');
      modal.remove();
    });
  }

  public showScoreboardModal(
    winnerId: string,
    myId: string,
    scoreboard: ScoreboardEntry[],
    onReadyNewGame: () => void,
    onBackToLobby: () => void
  ): void {
    const isWinner = winnerId === myId;
    if (isWinner) {
      this.sfx.playVictory();
    }

    const modal = document.createElement('div');
    modal.id = 'modal-scoreboard';
    modal.className = 'modal-overlay ui-interactive';
    modal.innerHTML = `
      <div class="modal-content glass-panel" style="width: 580px;">
        <div style="text-align: center;">
          <h2 style="font-family: var(--font-display); font-size: 2.2rem; color: ${isWinner ? '#10b981' : '#f59e0b'};">
            ${isWinner ? '🏆 BẠN ĐÃ CHIẾN THẮNG!' : '🏁 VÁN ĐẤU KẾT THÚC'}
          </h2>
          <p style="color: var(--text-muted);">Bảng tổng kết điểm và phạt thối heo / cóng</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; margin: 12px 0;">
          ${scoreboard.map((entry, idx) => {
            const isMe = entry.playerId === myId;
            const deltaColor = entry.scoreDelta >= 0 ? '#10b981' : '#ef4444';
            const deltaSign = entry.scoreDelta > 0 ? '+' : '';
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-radius: 12px; background: ${isMe ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isMe ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.08)'};">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-weight: 800; font-size: 1.1rem; width: 24px;">#${idx + 1}</span>
                  <div>
                    <div style="font-weight: 700;">${this.escapeHtml(entry.playerName)} ${isMe ? '(Bạn)' : ''}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Còn lại: ${entry.remainingCards} lá</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="font-family: var(--font-display); font-weight: 800; font-size: 1.25rem; color: ${deltaColor};">
                    ${deltaSign}${entry.scoreDelta} đ
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" id="btn-score-lobby" style="flex: 1;">Về Sảnh</button>
          <button class="btn btn-success" id="btn-score-ready" style="flex: 1;">Sẵn Sàng Ván Mới</button>
        </div>
      </div>
    `;

    this.container.appendChild(modal);

    modal.querySelector('#btn-score-lobby')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      modal.remove();
      onBackToLobby();
    });

    modal.querySelector('#btn-score-ready')?.addEventListener('click', () => {
      this.sfx.playButtonClick();
      modal.remove();
      onReadyNewGame();
    });
  }

  public hideScoreboardModal(): void {
    const modal = document.getElementById('modal-scoreboard');
    if (modal) {
      modal.remove();
    }
  }

  public showSettingsModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay ui-interactive';
    modal.innerHTML = `
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <h2>⚙️ Cài Đặt Hệ Thống</h2>
          <button class="btn btn-secondary" id="btn-close-settings" style="padding: 4px 10px;">✕</button>
        </div>

        <div class="settings-group">
          <div class="setting-row">
            <span>Âm lượng tổng</span>
            <input type="range" id="setting-volume" min="0" max="1" step="0.05" value="${this.sfx.getMasterVolume()}" />
          </div>

          <div class="setting-row">
            <span>Hiệu ứng âm thanh (SFX)</span>
            <input type="checkbox" id="setting-sfx" ${this.sfx.getSfxEnabled() ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #f59e0b;" />
          </div>

          <div class="setting-row">
            <span>Nhạc nền (BGM)</span>
            <input type="checkbox" id="setting-bgm" ${this.sfx.getBgmEnabled() ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #f59e0b;" />
          </div>

          <div class="setting-row">
            <span>Chất lượng đồ họa</span>
            <select id="setting-graphics" style="background: rgba(0,0,0,0.4); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 8px; outline: none;">
              <option value="high">Cao (60 FPS Mượt mà)</option>
              <option value="low">Tiết kiệm pin</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-save-settings" style="width: 100%;">Hoàn Tất</button>
      </div>
    `;

    this.container.appendChild(modal);

    const volSlider = modal.querySelector('#setting-volume') as HTMLInputElement;
    volSlider?.addEventListener('input', () => {
      this.sfx.setMasterVolume(parseFloat(volSlider.value));
    });

    const sfxCheckbox = modal.querySelector('#setting-sfx') as HTMLInputElement;
    sfxCheckbox?.addEventListener('change', () => {
      this.sfx.setSfxEnabled(sfxCheckbox.checked);
    });

    const bgmCheckbox = modal.querySelector('#setting-bgm') as HTMLInputElement;
    bgmCheckbox?.addEventListener('change', () => {
      this.sfx.setBgmEnabled(bgmCheckbox.checked);
    });

    const close = () => {
      this.sfx.playButtonClick();
      modal.remove();
    };

    modal.querySelector('#btn-close-settings')?.addEventListener('click', close);
    modal.querySelector('#btn-save-settings')?.addEventListener('click', close);
  }

  public showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    const existing = document.getElementById('toast-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'toast-banner';
    banner.className = `toast-banner toast-${type} glass-panel`;

    let bgColor = 'rgba(15, 23, 42, 0.9)';
    let borderColor = 'rgba(255, 255, 255, 0.2)';
    if (type === 'success') {
      bgColor = 'rgba(16, 185, 129, 0.9)';
      borderColor = '#10b981';
    } else if (type === 'error') {
      bgColor = 'rgba(239, 68, 68, 0.9)';
      borderColor = '#ef4444';
      this.sfx.playError();
    }

    banner.style.background = bgColor;
    banner.style.borderColor = borderColor;
    banner.textContent = message;

    this.container.appendChild(banner);
    this.toastTimeout = window.setTimeout(() => {
      banner.remove();
    }, 3200);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
