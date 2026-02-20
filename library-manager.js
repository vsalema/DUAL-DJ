/**
 * DUAL DJ - Library Manager
 * Gestion avancée de bibliothèque musicale avec drag & drop
 */

class LibraryManager {
  constructor() {
    this.library = this.loadLibrary();
    this.playlists = this.loadPlaylists();
    this.currentPlaylist = null;
    this.draggedItem = null;
    this.sortOrder = 'dateAdded'; // dateAdded, name, artist, duration
    this.searchQuery = '';
    
    this.initUI();
    this.setupEventListeners();
    this.render();
  }

  // ============================================
  // INITIALISATION
  // ============================================

  initUI() {
    // Créer l'interface de la bibliothèque
    const libraryHTML = `
      <div class="libraryManager" id="libraryManager">
        <!-- Header -->
        <div class="libHeader">
          <div class="libTitle">
            <h2>MA BIBLIOTHÈQUE</h2>
            <span class="libCount" id="libCount">0 tracks</span>
          </div>
          <div class="libActions">
            <button class="libBtn" id="btnImportFiles" title="Importer des fichiers audio">
              📁 Import Files
            </button>
            <button class="libBtn" id="btnExportLib" title="Exporter la bibliothèque">
              ⤓ Export
            </button>
            <button class="libBtn" id="btnImportLib" title="Importer une bibliothèque">
              ⤒ Import
            </button>
            <input type="file" id="libImportInput" accept="application/json" style="display:none">
            <input type="file" id="audioImportInput" accept="audio/*" multiple style="display:none">
          </div>
        </div>

        <!-- Search & Filter -->
        <div class="libToolbar">
          <div class="searchBox">
            <input type="search" id="libSearch" class="searchInput" 
                   placeholder="Rechercher titre, artiste..." />
            <span class="searchIcon">🔍</span>
          </div>
          
          <select id="libSort" class="sortSelect">
            <option value="dateAdded">Date d'ajout</option>
            <option value="name">Titre (A-Z)</option>
            <option value="artist">Artiste (A-Z)</option>
            <option value="duration">Durée</option>
          </select>

          <button class="libBtn mini" id="btnClearLib" title="Vider la bibliothèque">
            🗑️ Clear All
          </button>
        </div>

        <!-- Main Content -->
        <div class="libContent">
          <!-- Sidebar: Playlists -->
          <aside class="libSidebar">
            <div class="sidebarHeader">
              <h3>PLAYLISTS</h3>
              <button class="iconBtn" id="btnNewPlaylist" title="Nouvelle playlist">+</button>
            </div>
            
            <div class="playlistList" id="playlistList">
              <div class="playlistItem active" data-playlist="all">
                <span class="plIcon">📚</span>
                <span class="plName">Tous les titres</span>
                <span class="plCount">0</span>
              </div>
            </div>
          </aside>

          <!-- Main: Track List -->
          <div class="libMain">
            <!-- Drop Zone -->
            <div class="dropZone" id="dropZone">
              <div class="dropZoneContent">
                <div class="dropIcon">📂</div>
                <div class="dropText">Glisse des fichiers audio ici</div>
                <div class="dropHint">ou clique "Import Files" pour parcourir</div>
              </div>
            </div>

            <!-- Track Grid -->
            <div class="trackGrid" id="trackGrid"></div>

            <!-- Empty State -->
            <div class="emptyState" id="emptyState">
              <div class="emptyIcon">🎵</div>
              <div class="emptyText">Aucune piste dans cette playlist</div>
              <div class="emptyHint">Importe des fichiers ou glisse-les ici</div>
            </div>
          </div>
        </div>

        <!-- Bulk Actions Bar -->
        <div class="bulkBar" id="bulkBar" style="display:none">
          <div class="bulkInfo">
            <span id="bulkCount">0</span> sélectionné(s)
          </div>
          <div class="bulkActions">
            <button class="bulkBtn" id="btnAddToPlaylist">
              ➕ Ajouter à playlist
            </button>
            <button class="bulkBtn" id="btnRemoveSelected">
              🗑️ Supprimer
            </button>
            <button class="bulkBtn" id="btnDeselectAll">
              ✕ Désélectionner
            </button>
          </div>
        </div>
      </div>

      <!-- Modal: New Playlist -->
      <div class="modal" id="playlistModal" style="display:none">
        <div class="modalOverlay"></div>
        <div class="modalContent">
          <div class="modalHeader">
            <h3>Nouvelle Playlist</h3>
            <button class="modalClose" id="closePlaylistModal">✕</button>
          </div>
          <div class="modalBody">
            <label>Nom de la playlist</label>
            <input type="text" id="playlistNameInput" class="modalInput" 
                   placeholder="Ma super playlist" maxlength="50" />
          </div>
          <div class="modalFooter">
            <button class="modalBtn secondary" id="cancelPlaylist">Annuler</button>
            <button class="modalBtn primary" id="createPlaylist">Créer</button>
          </div>
        </div>
      </div>

      <!-- Modal: Add to Playlist -->
      <div class="modal" id="addToPlaylistModal" style="display:none">
        <div class="modalOverlay"></div>
        <div class="modalContent">
          <div class="modalHeader">
            <h3>Ajouter à une Playlist</h3>
            <button class="modalClose" id="closeAddModal">✕</button>
          </div>
          <div class="modalBody">
            <div class="playlistSelect" id="playlistSelect"></div>
          </div>
        </div>
      </div>
    `;

    // Insérer dans le drawer
    const drawerBody = document.querySelector('.drawerBody');
    if (drawerBody) {
      drawerBody.insertAdjacentHTML('beforebegin', libraryHTML);
    }
  }

  setupEventListeners() {
    // Import files
    document.getElementById('btnImportFiles')?.addEventListener('click', () => {
      document.getElementById('audioImportInput')?.click();
    });

    document.getElementById('audioImportInput')?.addEventListener('change', (e) => {
      this.handleFileImport(e.target.files);
      e.target.value = ''; // Reset pour permettre re-import du même fichier
    });

    // Export/Import library
    document.getElementById('btnExportLib')?.addEventListener('click', () => this.exportLibrary());
    document.getElementById('btnImportLib')?.addEventListener('click', () => {
      document.getElementById('libImportInput')?.click();
    });

    document.getElementById('libImportInput')?.addEventListener('change', (e) => {
      this.importLibrary(e.target.files[0]);
      e.target.value = '';
    });

    // Search & Sort
    document.getElementById('libSearch')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTracks();
    });

    document.getElementById('libSort')?.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.renderTracks();
    });

    // Clear library
    document.getElementById('btnClearLib')?.addEventListener('click', () => {
      if (confirm('Vider toute la bibliothèque ? Cette action est irréversible.')) {
        this.clearLibrary();
      }
    });

    // Drag & Drop
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, this.preventDefaults, false);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
      });

      dropZone.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    // Playlist management
    document.getElementById('btnNewPlaylist')?.addEventListener('click', () => this.showPlaylistModal());
    document.getElementById('createPlaylist')?.addEventListener('click', () => this.createPlaylist());
    document.getElementById('cancelPlaylist')?.addEventListener('click', () => this.hidePlaylistModal());
    document.getElementById('closePlaylistModal')?.addEventListener('click', () => this.hidePlaylistModal());
    document.getElementById('closeAddModal')?.addEventListener('click', () => this.hideAddToPlaylistModal());

    // Bulk actions
    document.getElementById('btnAddToPlaylist')?.addEventListener('click', () => this.showAddToPlaylistModal());
    document.getElementById('btnRemoveSelected')?.addEventListener('click', () => this.removeSelected());
    document.getElementById('btnDeselectAll')?.addEventListener('click', () => this.deselectAll());

    // Enter key pour créer playlist
    document.getElementById('playlistNameInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createPlaylist();
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // ============================================
  // GESTION DES FICHIERS
  // ============================================

  async handleFileImport(files) {
    if (!files || files.length === 0) return;

    const loadingToast = this.showToast('Import en cours...', 'info', 0);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      if (!file.type.startsWith('audio/')) {
        errorCount++;
        continue;
      }

      try {
        const track = await this.processAudioFile(file);
        this.addTrackToLibrary(track);
        successCount++;
      } catch (err) {
        console.error('Error processing file:', file.name, err);
        errorCount++;
      }
    }

    this.hideToast(loadingToast);
    
    if (successCount > 0) {
      this.showToast(`${successCount} piste(s) importée(s) avec succès`, 'success');
      this.saveLibrary();
      this.render();
    }

    if (errorCount > 0) {
      this.showToast(`${errorCount} fichier(s) ignoré(s)`, 'warning');
    }
  }

  async processAudioFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const audioData = e.target.result;
        const audio = new Audio(audioData);
        
        audio.addEventListener('loadedmetadata', () => {
          const track = {
            id: this.generateId(),
            name: this.cleanFileName(file.name),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: audio.duration,
            size: file.size,
            type: file.type,
            dateAdded: Date.now(),
            playCount: 0,
            src: audioData, // Base64 data URL
            file: null // On ne stocke pas l'objet File
          };

          resolve(track);
        });

        audio.addEventListener('error', () => {
          reject(new Error('Failed to load audio metadata'));
        });

        audio.src = audioData;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    this.handleFileImport(files);
  }

  cleanFileName(fileName) {
    return fileName
      .replace(/\.(mp3|wav|ogg|m4a|flac|aac)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim();
  }

  generateId() {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================
  // GESTION DE LA BIBLIOTHÈQUE
  // ============================================

  addTrackToLibrary(track) {
    // Éviter les doublons (même nom + durée similaire)
    const exists = this.library.some(t => 
      t.name === track.name && 
      Math.abs(t.duration - track.duration) < 1
    );

    if (!exists) {
      this.library.push(track);
    }
  }

  removeTrack(trackId) {
    this.library = this.library.filter(t => t.id !== trackId);
    
    // Retirer de toutes les playlists
    Object.keys(this.playlists).forEach(plId => {
      this.playlists[plId].tracks = this.playlists[plId].tracks.filter(id => id !== trackId);
    });

    this.saveLibrary();
    this.savePlaylists();
    this.render();
  }

  clearLibrary() {
    this.library = [];
    this.playlists = {};
    this.currentPlaylist = null;
    this.saveLibrary();
    this.savePlaylists();
    this.render();
    this.showToast('Bibliothèque vidée', 'success');
  }

  getFilteredTracks() {
    let tracks = [...this.library];

    // Filter by playlist
    if (this.currentPlaylist && this.currentPlaylist !== 'all') {
      const playlist = this.playlists[this.currentPlaylist];
      if (playlist) {
        const trackIds = new Set(playlist.tracks);
        tracks = tracks.filter(t => trackIds.has(t.id));
      }
    }

    // Filter by search
    if (this.searchQuery) {
      tracks = tracks.filter(t => 
        t.name.toLowerCase().includes(this.searchQuery) ||
        t.artist.toLowerCase().includes(this.searchQuery) ||
        t.album.toLowerCase().includes(this.searchQuery)
      );
    }

    // Sort
    tracks.sort((a, b) => {
      switch (this.sortOrder) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'artist':
          return a.artist.localeCompare(b.artist);
        case 'duration':
          return a.duration - b.duration;
        case 'dateAdded':
        default:
          return b.dateAdded - a.dateAdded;
      }
    });

    return tracks;
  }

  // ============================================
  // GESTION DES PLAYLISTS
  // ============================================

  createPlaylist() {
    const input = document.getElementById('playlistNameInput');
    const name = input.value.trim();

    if (!name) {
      this.showToast('Nom de playlist requis', 'warning');
      return;
    }

    const id = `pl_${Date.now()}`;
    this.playlists[id] = {
      id,
      name,
      tracks: [],
      dateCreated: Date.now()
    };

    this.savePlaylists();
    this.renderPlaylists();
    this.hidePlaylistModal();
    this.showToast(`Playlist "${name}" créée`, 'success');
    
    input.value = '';
  }

  deletePlaylist(playlistId) {
    const playlist = this.playlists[playlistId];
    if (!playlist) return;

    if (confirm(`Supprimer la playlist "${playlist.name}" ?`)) {
      delete this.playlists[playlistId];
      
      if (this.currentPlaylist === playlistId) {
        this.currentPlaylist = 'all';
      }

      this.savePlaylists();
      this.render();
      this.showToast('Playlist supprimée', 'success');
    }
  }

  addTracksToPlaylist(playlistId, trackIds) {
    const playlist = this.playlists[playlistId];
    if (!playlist) return;

    const existing = new Set(playlist.tracks);
    let addedCount = 0;

    trackIds.forEach(id => {
      if (!existing.has(id)) {
        playlist.tracks.push(id);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      this.savePlaylists();
      this.renderPlaylists();
      this.showToast(`${addedCount} piste(s) ajoutée(s)`, 'success');
    } else {
      this.showToast('Piste(s) déjà dans la playlist', 'info');
    }
  }

  removeTracksFromPlaylist(playlistId, trackIds) {
    const playlist = this.playlists[playlistId];
    if (!playlist) return;

    const toRemove = new Set(trackIds);
    playlist.tracks = playlist.tracks.filter(id => !toRemove.has(id));

    this.savePlaylists();
    this.renderTracks();
    this.showToast('Piste(s) retirée(s) de la playlist', 'success');
  }

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  exportLibrary() {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      library: this.library,
      playlists: this.playlists
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dual-dj-library-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast('Bibliothèque exportée', 'success');
  }

  async importLibrary(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.library || !Array.isArray(data.library)) {
        throw new Error('Format invalide');
      }

      const importAll = confirm(
        `Importer ${data.library.length} piste(s) ?\n\n` +
        `• Fusionner avec bibliothèque actuelle: OK\n` +
        `• Remplacer bibliothèque actuelle: Annuler puis vider avant import`
      );

      if (importAll) {
        data.library.forEach(track => {
          track.id = this.generateId(); // Nouveau ID pour éviter conflits
          this.addTrackToLibrary(track);
        });

        if (data.playlists) {
          Object.assign(this.playlists, data.playlists);
        }

        this.saveLibrary();
        this.savePlaylists();
        this.render();
        this.showToast(`${data.library.length} piste(s) importée(s)`, 'success');
      }
    } catch (err) {
      console.error('Import error:', err);
      this.showToast('Erreur d\'import: fichier invalide', 'error');
    }
  }

  // ============================================
  // SÉLECTION MULTIPLE
  // ============================================

  getSelectedTracks() {
    const selected = document.querySelectorAll('.trackCard.selected');
    return Array.from(selected).map(card => card.dataset.trackId);
  }

  removeSelected() {
    const selected = this.getSelectedTracks();
    
    if (selected.length === 0) {
      this.showToast('Aucune piste sélectionnée', 'warning');
      return;
    }

    const confirmMsg = this.currentPlaylist === 'all'
      ? `Supprimer ${selected.length} piste(s) de la bibliothèque ?`
      : `Retirer ${selected.length} piste(s) de cette playlist ?`;

    if (confirm(confirmMsg)) {
      if (this.currentPlaylist === 'all') {
        selected.forEach(id => this.removeTrack(id));
      } else {
        this.removeTracksFromPlaylist(this.currentPlaylist, selected);
      }
      
      this.deselectAll();
    }
  }

  deselectAll() {
    document.querySelectorAll('.trackCard.selected').forEach(card => {
      card.classList.remove('selected');
    });
    this.updateBulkBar();
  }

  updateBulkBar() {
    const selected = this.getSelectedTracks();
    const bulkBar = document.getElementById('bulkBar');
    const bulkCount = document.getElementById('bulkCount');

    if (selected.length > 0) {
      bulkBar.style.display = 'flex';
      bulkCount.textContent = selected.length;
    } else {
      bulkBar.style.display = 'none';
    }
  }

  // ============================================
  // UI RENDERING
  // ============================================

  render() {
    this.renderPlaylists();
    this.renderTracks();
    this.updateLibraryCount();
  }

  renderPlaylists() {
    const container = document.getElementById('playlistList');
    if (!container) return;

    const allCount = this.library.length;
    const allItem = container.querySelector('[data-playlist="all"]');
    if (allItem) {
      allItem.querySelector('.plCount').textContent = allCount;
      allItem.classList.toggle('active', this.currentPlaylist === 'all' || !this.currentPlaylist);
    }

    // Remove old custom playlists
    container.querySelectorAll('[data-playlist]:not([data-playlist="all"])').forEach(el => el.remove());

    // Render custom playlists
    Object.values(this.playlists).forEach(pl => {
      const item = document.createElement('div');
      item.className = 'playlistItem';
      item.dataset.playlist = pl.id;
      if (this.currentPlaylist === pl.id) item.classList.add('active');

      item.innerHTML = `
        <span class="plIcon">📁</span>
        <span class="plName">${this.escapeHtml(pl.name)}</span>
        <span class="plCount">${pl.tracks.length}</span>
        <button class="plDelete" data-pl-id="${pl.id}" title="Supprimer">✕</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('plDelete')) {
          this.deletePlaylist(e.target.dataset.plId);
        } else {
          this.switchPlaylist(pl.id);
        }
      });

      container.appendChild(item);
    });
  }

  switchPlaylist(playlistId) {
    this.currentPlaylist = playlistId;
    
    document.querySelectorAll('.playlistItem').forEach(item => {
      item.classList.toggle('active', item.dataset.playlist === playlistId);
    });

    this.renderTracks();
  }

  renderTracks() {
    const container = document.getElementById('trackGrid');
    const emptyState = document.getElementById('emptyState');
    const dropZone = document.getElementById('dropZone');
    
    if (!container) return;

    const tracks = this.getFilteredTracks();

    if (tracks.length === 0) {
      container.style.display = 'none';
      dropZone.style.display = 'flex';
      emptyState.style.display = this.library.length === 0 ? 'none' : 'flex';
      return;
    }

    container.style.display = 'grid';
    dropZone.style.display = 'none';
    emptyState.style.display = 'none';
    container.innerHTML = '';

    tracks.forEach(track => {
      const card = this.createTrackCard(track);
      container.appendChild(card);
    });
  }

  createTrackCard(track) {
    const card = document.createElement('div');
    card.className = 'trackCard';
    card.dataset.trackId = track.id;
    card.draggable = true;

    const duration = this.formatDuration(track.duration);
    const size = this.formatFileSize(track.size);

    card.innerHTML = `
      <div class="trackCardHeader">
        <input type="checkbox" class="trackCheck" />
        <div class="trackWaveform">
          <div class="waveBar" style="height:30%"></div>
          <div class="waveBar" style="height:60%"></div>
          <div class="waveBar" style="height:45%"></div>
          <div class="waveBar" style="height:80%"></div>
          <div class="waveBar" style="height:55%"></div>
          <div class="waveBar" style="height:70%"></div>
          <div class="waveBar" style="height:40%"></div>
          <div class="waveBar" style="height:85%"></div>
        </div>
      </div>
      
      <div class="trackCardBody">
        <div class="trackTitle" title="${this.escapeHtml(track.name)}">
          ${this.escapeHtml(track.name)}
        </div>
        <div class="trackArtist">${this.escapeHtml(track.artist)}</div>
        <div class="trackMeta">
          <span>${duration}</span>
          <span>•</span>
          <span>${size}</span>
        </div>
      </div>

      <div class="trackCardFooter">
        <button class="trackBtn" data-action="play" title="Charger sur Deck A">
          ▶️
        </button>
        <button class="trackBtn" data-action="addToPlaylist" title="Ajouter à playlist">
          ➕
        </button>
        <button class="trackBtn" data-action="remove" title="Supprimer">
          🗑️
        </button>
      </div>
    `;

    // Event listeners
    const checkbox = card.querySelector('.trackCheck');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      card.classList.toggle('selected', checkbox.checked);
      this.updateBulkBar();
    });

    card.addEventListener('click', (e) => {
      if (e.target.closest('.trackBtn, .trackCheck')) return;
      
      // Double-click pour jouer
      if (e.detail === 2) {
        this.playTrack(track);
      }
    });

    // Action buttons
    card.querySelector('[data-action="play"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.playTrack(track);
    });

    card.querySelector('[data-action="addToPlaylist"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showAddToPlaylistModal([track.id]);
    });

    card.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentPlaylist === 'all') {
        this.removeTrack(track.id);
      } else {
        this.removeTracksFromPlaylist(this.currentPlaylist, [track.id]);
      }
    });

    // Drag events
    card.addEventListener('dragstart', (e) => {
      this.draggedItem = track;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.draggedItem = null;
    });

    return card;
  }

  playTrack(track) {
    // Integration avec le système DJ existant
    if (typeof window.loadTrackFromLibrary === 'function') {
      window.loadTrackFromLibrary(track);
      this.showToast(`Chargé: ${track.name}`, 'success');
      
      // Update play count
      track.playCount++;
      this.saveLibrary();
    } else {
      console.warn('loadTrackFromLibrary not found');
    }
  }

  // ============================================
  // MODALS
  // ============================================

  showPlaylistModal() {
    document.getElementById('playlistModal').style.display = 'flex';
    setTimeout(() => document.getElementById('playlistNameInput')?.focus(), 100);
  }

  hidePlaylistModal() {
    document.getElementById('playlistModal').style.display = 'none';
    document.getElementById('playlistNameInput').value = '';
  }

  showAddToPlaylistModal(trackIds = null) {
    const ids = trackIds || this.getSelectedTracks();
    
    if (ids.length === 0) {
      this.showToast('Aucune piste sélectionnée', 'warning');
      return;
    }

    const modal = document.getElementById('addToPlaylistModal');
    const container = document.getElementById('playlistSelect');
    
    container.innerHTML = '';

    if (Object.keys(this.playlists).length === 0) {
      container.innerHTML = '<div class="emptyHint">Aucune playlist. Crée-en une d\'abord !</div>';
    } else {
      Object.values(this.playlists).forEach(pl => {
        const item = document.createElement('div');
        item.className = 'playlistSelectItem';
        item.innerHTML = `
          <span class="plIcon">📁</span>
          <span class="plName">${this.escapeHtml(pl.name)}</span>
          <span class="plCount">${pl.tracks.length}</span>
        `;
        
        item.addEventListener('click', () => {
          this.addTracksToPlaylist(pl.id, ids);
          this.hideAddToPlaylistModal();
        });

        container.appendChild(item);
      });
    }

    modal.style.display = 'flex';
  }

  hideAddToPlaylistModal() {
    document.getElementById('addToPlaylistModal').style.display = 'none';
  }

  // ============================================
  // HELPERS
  // ============================================

  updateLibraryCount() {
    const count = document.getElementById('libCount');
    if (count) {
      count.textContent = `${this.library.length} track${this.library.length !== 1 ? 's' : ''}`;
    }
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  }

  hideToast(toast) {
    if (toast && toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  loadLibrary() {
    try {
      const saved = localStorage.getItem('djLibrary');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error('Failed to load library:', err);
      return [];
    }
  }

  saveLibrary() {
    try {
      localStorage.setItem('djLibrary', JSON.stringify(this.library));
    } catch (err) {
      console.error('Failed to save library:', err);
      this.showToast('Erreur de sauvegarde', 'error');
    }
  }

  loadPlaylists() {
    try {
      const saved = localStorage.getItem('djPlaylists');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.error('Failed to load playlists:', err);
      return {};
    }
  }

  savePlaylists() {
    try {
      localStorage.setItem('djPlaylists', JSON.stringify(this.playlists));
    } catch (err) {
      console.error('Failed to save playlists:', err);
    }
  }
}

// Export pour utilisation globale
window.LibraryManager = LibraryManager;
