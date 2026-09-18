class Camera {
  constructor() {
    this.x = 0;      // world pixel offset
    this.y = 0;
    this.vw = Config.VIEWPORT_WIDTH;
    this.vh = Config.VIEWPORT_HEIGHT;
    this.zoom = 1;
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragCamX = 0;
    this._dragCamY = 0;
  }

  clamp() {
    const worldW = Config.GRID_WIDTH * Config.TILE_SIZE;
    const worldH = Config.GRID_HEIGHT * Config.TILE_SIZE;
    this.x = Utils.clamp(this.x, 0, Math.max(0, worldW - this.vw));
    this.y = Utils.clamp(this.y, 0, Math.max(0, worldH - this.vh));
  }

  screenToWorld(sx, sy) {
    return {
      tx: Math.floor((sx + this.x) / Config.TILE_SIZE),
      ty: Math.floor((sy + this.y) / Config.TILE_SIZE),
    };
  }

  centerOn(worldTileX, worldTileY) {
    this.x = worldTileX * Config.TILE_SIZE - this.vw / 2;
    this.y = worldTileY * Config.TILE_SIZE - this.vh / 2;
    this.clamp();
  }
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = new Camera();

    this.worldRenderer    = new WorldRenderer(this.ctx, this.camera);
    this.buildingRenderer = new BuildingRenderer(this.ctx, this.camera);
    this.personRenderer   = new PersonRenderer(this.ctx, this.camera);
    this.lightingRenderer = new LightingRenderer(this.camera);
    this.uiRenderer       = new UIRenderer(this.ctx, this.camera);

    this.world = null;
    this.resize();

    // Camera drag
    this.setupCameraDrag();
  }

  init(world) {
    this.world = world;
    // Center camera on the middle of the world
    this.camera.centerOn(Config.GRID_WIDTH / 2, Config.GRID_HEIGHT / 2);
  }

  resize() {
    const w = Config.VIEWPORT_WIDTH;
    const h = Config.VIEWPORT_HEIGHT;
    this.canvas.width = w;
    this.canvas.height = h;
    this.camera.vw = w;
    this.camera.vh = h;
    this.lightingRenderer.resize(w, h);
  }

  render(alpha) {
    if (!this.world) return;
    const ctx = this.ctx;
    const cam = this.camera;

    // Clear with sky color
    ctx.fillStyle = this.world.clock.getSkyColor();
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    // Render layers
    this.worldRenderer.render(this.world, alpha);
    this.buildingRenderer.render(this.world, alpha);
    this.personRenderer.render(this.world, alpha);
    this.lightingRenderer.render(ctx, this.world, alpha);
    this.uiRenderer.render(this.world, alpha);
  }

  setupCameraDrag() {
    const canvas = this.canvas;
    const cam = this.camera;
    let dragging = false;
    let startX, startY, startCamX, startCamY;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) { // Middle or right click drag
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startCamX = cam.x;
        startCamY = cam.y;
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (dragging) {
        cam.x = startCamX - (e.clientX - startX);
        cam.y = startCamY - (e.clientY - startY);
        cam.clamp();
      }
    });

    canvas.addEventListener('mouseup', () => {
      dragging = false;
      canvas.style.cursor = 'default';
    });

    canvas.addEventListener('mouseleave', () => {
      dragging = false;
      canvas.style.cursor = 'default';
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // WASD / Arrow key pan
    const panSpeed = 8;
    const keys = {};
    document.addEventListener('keydown', (e) => { keys[e.key] = true; });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });

    const panLoop = () => {
      if (keys['ArrowLeft']  || keys['a']) cam.x -= panSpeed;
      if (keys['ArrowRight'] || keys['d']) cam.x += panSpeed;
      if (keys['ArrowUp']    || keys['w']) cam.y -= panSpeed;
      if (keys['ArrowDown']  || keys['s']) cam.y += panSpeed;
      cam.clamp();
      requestAnimationFrame(panLoop);
    };
    panLoop();
  }

  // Called by Inspector to highlight selected entity
  setSelected(person) {
    this.personRenderer.setSelected(person);
  }
}
