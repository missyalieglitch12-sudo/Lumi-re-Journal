/**
 * Brutalist Workspace - Sticker Engine
 * Handles dragging, resizing, and rotating SVG/emoji stickers over the canvas.
 */

window.StickerEngine = {
  container: null,
  stickers: [],
  activeSticker: null,
  isDragging: false,
  isResizing: false,
  isRotating: false,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0,
  startAngle: 0,
  startLeft: 0,
  startTop: 0,

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Create overlay if it doesn't exist
    let overlay = document.getElementById('sticker-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sticker-overlay';
      overlay.className = 'sticker-overlay';
      this.container.appendChild(overlay);
    }
    
    // Bind global events for drag/resize
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // Deselect clicking outside
    this.container.addEventListener('mousedown', (e) => {
      if (e.target === this.container || e.target.id === 'view-text' || e.target.id === 'note-textarea') {
        this.deselectAll();
      }
    });
  },

  addSticker(type, value, x = 50, y = 50, size = 100, rotation = 0, id = null) {
    const overlay = document.getElementById('sticker-overlay');
    if (!overlay) return;

    const stickerId = id || 'sticker_' + Date.now();
    const stickerDiv = document.createElement('div');
    stickerDiv.className = 'sticker-item';
    stickerDiv.id = stickerId;
    stickerDiv.dataset.type = type;
    stickerDiv.dataset.value = value;
    stickerDiv.style.left = `${x}px`;
    stickerDiv.style.top = `${y}px`;
    stickerDiv.style.width = `${size}px`;
    stickerDiv.style.height = `${size}px`;
    stickerDiv.style.transform = `rotate(${rotation}deg)`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'sticker-content';
    if (type === 'emoji') {
      contentDiv.textContent = value;
      contentDiv.style.fontSize = `${size * 0.8}px`;
    } else if (type === 'image') {
      contentDiv.style.backgroundImage = `url('${value}')`;
    }
    stickerDiv.appendChild(contentDiv);

    // Controls
    const closeBtn = document.createElement('div');
    closeBtn.className = 'sticker-control sticker-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      stickerDiv.remove();
      this.stickers = this.stickers.filter(s => s.id !== stickerId);
      this.triggerSave();
    });

    const resizeBtn = document.createElement('div');
    resizeBtn.className = 'sticker-control sticker-resize';
    resizeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.activeSticker = stickerDiv;
      this.isResizing = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startWidth = stickerDiv.offsetWidth;
      this.startHeight = stickerDiv.offsetHeight;
    });

    const rotateBtn = document.createElement('div');
    rotateBtn.className = 'sticker-control sticker-rotate';
    rotateBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.activeSticker = stickerDiv;
      this.isRotating = true;
      
      const rect = stickerDiv.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      this.startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      const currentRotation = parseFloat(stickerDiv.dataset.rotation || 0);
      this.startAngle -= currentRotation;
    });

    stickerDiv.appendChild(closeBtn);
    stickerDiv.appendChild(resizeBtn);
    stickerDiv.appendChild(rotateBtn);

    // Drag
    stickerDiv.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('sticker-control')) return;
      this.deselectAll();
      stickerDiv.classList.add('selected');
      this.activeSticker = stickerDiv;
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startLeft = parseFloat(stickerDiv.style.left) || 0;
      this.startTop = parseFloat(stickerDiv.style.top) || 0;
    });

    overlay.appendChild(stickerDiv);
    this.stickers.push({
      id: stickerId,
      type,
      value,
      x, y, size, rotation
    });
    
    // Select newly added sticker
    this.deselectAll();
    stickerDiv.classList.add('selected');
    this.triggerSave();
  },

  onMouseMove(e) {
    if (!this.activeSticker) return;

    if (this.isDragging) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.activeSticker.style.left = `${this.startLeft + dx}px`;
      this.activeSticker.style.top = `${this.startTop + dy}px`;
    } 
    else if (this.isResizing) {
      const dx = e.clientX - this.startX;
      const newSize = Math.max(30, this.startWidth + dx);
      this.activeSticker.style.width = `${newSize}px`;
      this.activeSticker.style.height = `${newSize}px`;
      
      const content = this.activeSticker.querySelector('.sticker-content');
      if (this.activeSticker.dataset.type === 'emoji') {
        content.style.fontSize = `${newSize * 0.8}px`;
      }
    }
    else if (this.isRotating) {
      const rect = this.activeSticker.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      const rotation = angle - this.startAngle;
      
      this.activeSticker.style.transform = `rotate(${rotation}deg)`;
      this.activeSticker.dataset.rotation = rotation;
    }
  },

  onMouseUp() {
    if (this.isDragging || this.isResizing || this.isRotating) {
      this.isDragging = false;
      this.isResizing = false;
      this.isRotating = false;
      this.updateStickerData();
      this.triggerSave();
    }
  },

  deselectAll() {
    document.querySelectorAll('.sticker-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    this.activeSticker = null;
  },

  updateStickerData() {
    if (!this.activeSticker) return;
    const id = this.activeSticker.id;
    const sticker = this.stickers.find(s => s.id === id);
    if (sticker) {
      sticker.x = parseFloat(this.activeSticker.style.left) || 0;
      sticker.y = parseFloat(this.activeSticker.style.top) || 0;
      sticker.size = parseFloat(this.activeSticker.style.width) || 100;
      sticker.rotation = parseFloat(this.activeSticker.dataset.rotation || 0);
    }
  },

  serialize() {
    return this.stickers;
  },

  restore(data) {
    const overlay = document.getElementById('sticker-overlay');
    if (overlay) overlay.innerHTML = '';
    this.stickers = [];
    if (!data || !Array.isArray(data)) return;

    data.forEach(s => {
      this.addSticker(s.type, s.value, s.x, s.y, s.size, s.rotation, s.id);
    });
    this.deselectAll();
  },
  
  triggerSave() {
    if (window.triggerAutoSave) {
      window.triggerAutoSave();
    }
  }
};
