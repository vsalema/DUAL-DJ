// ============================================
// INTÉGRATION LIBRARY MANAGER POUR DUAL-DJ.JS
// ============================================
// Ajouter ce code dans Dual-dj.js

/**
 * Fonction appelée par LibraryManager pour charger une piste sur Deck A
 * @param {Object} track - Objet track avec {id, name, artist, src, duration, etc.}
 */
window.loadTrackFromLibrary = function(track) {
  if (!track || !track.src) {
    console.error('Invalid track data');
    return;
  }

  console.log('📀 Loading track from library:', track.name);

  // Récupérer les éléments du DOM
  const audio = document.getElementById('audio');
  const nowTitle = document.getElementById('nowTitle');
  const nowSub = document.getElementById('nowSub');
  const nowCover = document.getElementById('nowCover');
  const labelImg = document.getElementById('labelImg');
  const statusText = document.getElementById('statusText');
  const chipDot = document.getElementById('chipDot');

  if (!audio) {
    console.error('Audio element not found');
    return;
  }

  // Mettre à jour currentTrack (si vous avez une variable globale)
  // Si currentTrack n'existe pas dans votre code, créez-la
  if (typeof currentTrack !== 'undefined') {
    currentTrack = {
      title: track.name,
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      cover: null, // Pas de cover pour fichiers locaux
      src: track.src,
      duration: track.duration
    };
  }

  // Mettre à jour l'interface "Now Playing"
  if (nowTitle) {
    nowTitle.textContent = track.name;
    nowTitle.title = track.name;
  }
  
  if (nowSub) {
    nowSub.textContent = track.artist || 'Unknown Artist';
    nowSub.title = track.artist || 'Unknown Artist';
  }

  // Mettre à jour la cover du now playing (gradient par défaut)
  if (nowCover) {
    nowCover.style.backgroundImage = '';
    nowCover.style.background = 'linear-gradient(135deg, rgba(25,208,227,.18), rgba(124,255,178,.14), rgba(0,0,0,.55))';
  }

  // Charger l'audio
  audio.src = track.src;
  audio.load();

  // Mettre à jour le label du disque (centre du vinyle)
  if (labelImg && labelImg.parentElement) {
    labelImg.style.display = 'none';
    labelImg.src = '';
    
    // Appliquer un gradient élégant au label
    labelImg.parentElement.style.background = 
      `radial-gradient(circle at 50% 50%, 
        rgba(25,208,227,.28) 0%, 
        rgba(124,255,178,.16) 35%, 
        rgba(0,0,0,.65) 70%, 
        rgba(0,0,0,.88) 100%)`;
  }

  // Mettre à jour le background flou (si vous avez bgCover)
  const bgCover = document.getElementById('bgCover');
  if (bgCover) {
    bgCover.style.backgroundImage = '';
    bgCover.style.opacity = '0.35';
  }

  // Mettre à jour le statut
  if (statusText) {
    statusText.textContent = 'Piste chargée';
  }
  
  if (chipDot) {
    chipDot.classList.add('on');
  }

  // Animation du chargement (optionnel)
  const diskWrap = document.getElementById('wrapA');
  if (diskWrap) {
    diskWrap.style.opacity = '0.7';
    diskWrap.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      diskWrap.style.transition = 'all 0.4s cubic-bezier(0.2, 0.9, 0.2, 1)';
      diskWrap.style.opacity = '1';
      diskWrap.style.transform = 'scale(1)';
    }, 50);
  }

  console.log('✅ Track loaded successfully');
  
  // Vous pouvez auto-play si souhaité (décommenter la ligne ci-dessous)
  // setTimeout(() => audio.play(), 300);
};

// ============================================
// INITIALISATION LIBRARY MANAGER
// ============================================

let libraryManager = null;

// Fonction d'initialisation
function initLibraryManager() {
  if (typeof LibraryManager !== 'undefined') {
    try {
      libraryManager = new LibraryManager();
      console.log('✅ Library Manager initialized');
      
      // Optionnel : ajouter un bouton toggle dans l'interface
      addLibraryToggleButton();
    } catch (err) {
      console.error('❌ Failed to initialize Library Manager:', err);
    }
  } else {
    console.warn('⚠️ LibraryManager class not found. Make sure library-manager.js is loaded before Dual-dj.js');
  }
}

// Ajouter un bouton pour show/hide la bibliothèque (optionnel)
function addLibraryToggleButton() {
  const libManager = document.getElementById('libraryManager');
  if (!libManager) return;

  // Par défaut, la bibliothèque est visible
  // Si vous voulez qu'elle soit cachée au démarrage :
  // libManager.style.display = 'none';

  // Trouver un bouton existant ou créer le comportement toggle
  const btnLibrary = document.getElementById('btnLibrary');
  
  if (btnLibrary) {
    // Si le bouton existe déjà dans votre HTML
    btnLibrary.addEventListener('click', () => {
      const isHidden = libManager.style.display === 'none';
      libManager.style.display = isHidden ? 'block' : 'none';
      
      // Animation optionnelle
      if (!isHidden) {
        libManager.style.opacity = '0';
        libManager.style.transform = 'translateY(-10px)';
      }
      
      setTimeout(() => {
        libManager.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        libManager.style.opacity = isHidden ? '1' : '0';
        libManager.style.transform = isHidden ? 'translateY(0)' : 'translateY(-10px)';
      }, 10);
    });
    
    console.log('📚 Library toggle button connected');
  }
}

// Initialiser après le chargement complet du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Petit délai pour s'assurer que tous les scripts sont chargés
    setTimeout(initLibraryManager, 300);
  });
} else {
  // DOM déjà chargé
  setTimeout(initLibraryManager, 300);
}

// ============================================
// RACCOURCIS CLAVIER (OPTIONNEL)
// ============================================

document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + L : Toggle library
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    const libManager = document.getElementById('libraryManager');
    if (libManager) {
      libManager.style.display = libManager.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  // Ctrl/Cmd + I : Import files
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    document.getElementById('btnImportFiles')?.click();
  }
  
  // Ctrl/Cmd + N : New playlist
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    document.getElementById('btnNewPlaylist')?.click();
  }
  
  // Escape : Close modals / Deselect all
  if (e.key === 'Escape') {
    document.getElementById('closePlaylistModal')?.click();
    document.getElementById('closeAddModal')?.click();
    
    if (libraryManager) {
      libraryManager.deselectAll();
    }
  }
});

// ============================================
// EXPORT GLOBAL (pour debug dans console)
// ============================================

window.getLibraryStats = function() {
  if (!libraryManager) {
    console.log('Library Manager not initialized');
    return;
  }
  
  console.log('📊 Library Statistics:');
  console.log('• Total tracks:', libraryManager.library.length);
  console.log('• Total playlists:', Object.keys(libraryManager.playlists).length);
  console.log('• Current playlist:', libraryManager.currentPlaylist);
  console.log('• Total size:', libraryManager.library.reduce((sum, t) => sum + (t.size || 0), 0), 'bytes');
  console.log('• Total duration:', libraryManager.library.reduce((sum, t) => sum + (t.duration || 0), 0), 'seconds');
  
  return {
    tracks: libraryManager.library.length,
    playlists: Object.keys(libraryManager.playlists).length,
    totalSize: libraryManager.library.reduce((sum, t) => sum + (t.size || 0), 0),
    totalDuration: libraryManager.library.reduce((sum, t) => sum + (t.duration || 0), 0)
  };
};

console.log('📚 Library Manager integration loaded. Type getLibraryStats() for info.');
