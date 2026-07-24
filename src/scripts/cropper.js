(() => {
  const canvas = document.getElementById("view-canvas");
  const ctx = canvas.getContext("2d");
  const magnifier = document.getElementById("magnifier");
  const magCanvas = document.getElementById("mag-canvas");
  const magCtx = magCanvas.getContext("2d");
  const magText = document.getElementById("mag-text");

  // Floating Toolbar Elements
  const toolbar = document.getElementById("cropper-toolbar");
  const btnCaptureDropdown = document.getElementById("btn-capture-dropdown");
  const dropdownMenu = document.getElementById("capture-dropdown-menu");
  const captureLabel = document.getElementById("capture-label");

  // Menu items
  const btnEditor = document.getElementById("menu-editor");
  const btnClipboard = document.getElementById("menu-clipboard");
  const btnDesktop = document.getElementById("menu-desktop");
  const btnPrint = document.getElementById("menu-print");

  // Tool buttons
  const btnShare = document.getElementById("tool-share");
  const btnMove = document.getElementById("tool-move");
  const btnPen = document.getElementById("tool-pen");
  const btnPixelate = document.getElementById("tool-pixelate");
  const btnBlur = document.getElementById("tool-blur");
  const btnUndo = document.getElementById("tool-undo");
  const btnRedo = document.getElementById("tool-redo");
  const btnDelete = document.getElementById("tool-delete");
  const penColorDot = document.getElementById("pen-color-dot");
  const colorPopover = document.getElementById("color-palette-popover");

  let displayOffset = { x: 0, y: 0 };
  let displayWidth = 0;
  let displayHeight = 0;
  let compositeCanvas = null;
  let compositeReady = false;

  let isDragging = false;
  let isResizing = false;
  let isMoving = false;
  let isDrawing = false;
  let isBoxSelecting = false;
  let activeHandle = null;
  let moveStart = { x: 0, y: 0 };
  let boxStart = { x: 0, y: 0 };
  let currentBox = null;

  let globalStartX = 0;
  let globalStartY = 0;
  let globalCurrentX = 0;
  let globalCurrentY = 0;

  let isFrozen = false;
  let croppedRect = null;
  let mouseOnScreen = false;
  let isMouseCurrentlyActiveHere = false;
  let localMouseX = 0;
  let localMouseY = 0;
  let dpr = window.devicePixelRatio || 1;

  // Cropper Fade Animation State
  let cropperFadeOpacity = 1;
  let isFadingOut = false;

  const MAG_SIZE = 130;
  magCanvas.width = MAG_SIZE;
  magCanvas.height = MAG_SIZE;
  let zoomPixels = 16;

  // Active Tool & History State ('move' | 'pen' | 'pixelate' | 'blur' | 'none')
  let currentTool = "move";
  let currentColor = "#ff4757";
  let historyStack = [];
  let redoStack = [];
  let currentStroke = null;

  function toGlobal(lx, ly) {
    return { x: lx + displayOffset.x, y: ly + displayOffset.y };
  }

  function toLocal(gx, gy) {
    return { x: gx - displayOffset.x, y: gy - displayOffset.y };
  }

  const cropperTranslations = {
    en: {
      "capture-label": "Capture",
      "menu-editor": "Open in Editor",
      "menu-clipboard": "Copy to Clipboard",
      "menu-desktop": "Save to Desktop",
      "menu-print": "Print",
      "hint-overlay": "Drag to crop | Esc to cancel"
    },
    pt: {
      "capture-label": "Capturar",
      "menu-editor": "Abrir no Editor",
      "menu-clipboard": "Copiar para a Área de Transferência",
      "menu-desktop": "Salvar na Área de Trabalho",
      "menu-print": "Imprimir",
      "hint-overlay": "Arraste para cortar | Esc para cancelar"
    }
  };

  function applyTranslations(lang) {
    const t = cropperTranslations[lang] || cropperTranslations.en;
    if (captureLabel) captureLabel.textContent = t["capture-label"];
    const menuEditor = document.querySelector("#menu-editor span");
    const menuClipboard = document.querySelector("#menu-clipboard span");
    const menuDesktop = document.querySelector("#menu-desktop span");
    const menuPrint = document.querySelector("#menu-print span");
    const hintOverlay = document.querySelector("#hint-overlay span");
    if (menuEditor) menuEditor.textContent = t["menu-editor"];
    if (menuClipboard) menuClipboard.textContent = t["menu-clipboard"];
    if (menuDesktop) menuDesktop.textContent = t["menu-desktop"];
    if (menuPrint) menuPrint.textContent = t["menu-print"];
    if (hintOverlay) hintOverlay.textContent = t["hint-overlay"];
  }

  let defaultAction = "editor";
  let showRuler = true;

  window.api.onCaptureImage((data, lang) => {
    applyTranslations(lang || "en");
    if (data.theme) {
      document.documentElement.setAttribute("data-theme", data.theme);
    }
    if (data.defaultAction) {
      defaultAction = data.defaultAction;
    }
    if (data.showRuler !== undefined) {
      showRuler = data.showRuler !== false;
    }
    displayOffset = data.displayOffset;
    displayWidth = data.displaySize.width;
    displayHeight = data.displaySize.height;
    compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = data.totalSize.width;
    compositeCanvas.height = data.totalSize.height;
    const compCtx = compositeCanvas.getContext("2d");
    let loaded = 0;
    const captures = data.displayCaptures;
    captures.forEach((capture) => {
      const img = new Image();
      img.onload = () => {
        compCtx.drawImage(
          img,
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
          capture.x,
          capture.y,
          capture.width,
          capture.height
        );
        if (++loaded === captures.length) {
          compositeReady = true;
          resizeCanvas();
          draw();
        }
      };
      img.onerror = () => {
        console.error("Failed to load display capture at", capture.x, capture.y);
        if (++loaded === captures.length) {
          compositeReady = true;
          resizeCanvas();
          draw();
        }
      };
      img.src = capture.url;
    });
  });

  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener("resize", () => {
    if (compositeReady) {
      resizeCanvas();
      draw();
      if (isFrozen && croppedRect) {
        updateToolbarPosition();
      }
    }
  });

  function getGlobalSelectionRect() {
    return {
      x: Math.min(globalStartX, globalCurrentX),
      y: Math.min(globalStartY, globalCurrentY),
      w: Math.abs(globalStartX - globalCurrentX),
      h: Math.abs(globalStartY - globalCurrentY)
    };
  }

  function getHandleAt(lx, ly) {
    if (!isFrozen || !croppedRect || isFadingOut) return null;
    const localX = croppedRect.x - displayOffset.x;
    const localY = croppedRect.y - displayOffset.y;
    const rw = croppedRect.w;
    const rh = croppedRect.h;
    const handleSize = 14;

    const corners = [
      { name: "nw", x: localX, y: localY },
      { name: "ne", x: localX + rw, y: localY },
      { name: "se", x: localX + rw, y: localY + rh },
      { name: "sw", x: localX, y: localY + rh }
    ];

    for (let c of corners) {
      if (Math.abs(lx - c.x) <= handleSize && Math.abs(ly - c.y) <= handleSize) {
        return c.name;
      }
    }

    const edges = [
      { name: "n", x: localX + rw / 2, y: localY },
      { name: "s", x: localX + rw / 2, y: localY + rh },
      { name: "w", x: localX, y: localY + rh / 2 },
      { name: "e", x: localX + rw, y: localY + rh / 2 }
    ];

    for (let e of edges) {
      if (Math.abs(lx - e.x) <= handleSize && Math.abs(ly - e.y) <= handleSize) {
        return e.name;
      }
    }

    if (lx >= localX && lx <= localX + rw && ly >= localY && ly <= localY + rh) {
      return "move";
    }

    return null;
  }

  function updateCursor(lx, ly) {
    if (!isFrozen || isFadingOut) {
      canvas.style.cursor = "crosshair";
      return;
    }
    const handle = getHandleAt(lx, ly);
    if (handle === "nw" || handle === "se") {
      canvas.style.cursor = "nwse-resize";
    } else if (handle === "ne" || handle === "sw") {
      canvas.style.cursor = "nesw-resize";
    } else if (handle === "n" || handle === "s") {
      canvas.style.cursor = "ns-resize";
    } else if (handle === "e" || handle === "w") {
      canvas.style.cursor = "ew-resize";
    } else if (handle === "move") {
      if (currentTool === "move") {
        canvas.style.cursor = "move";
      } else {
        canvas.style.cursor = "crosshair";
      }
    } else {
      canvas.style.cursor = "crosshair";
    }
  }

  // Mouse Event Handlers
  window.addEventListener("mouseenter", () => {
    mouseOnScreen = true;
    draw();
  });

  window.addEventListener("mouseleave", () => {
    mouseOnScreen = false;
    isMouseCurrentlyActiveHere = false;
    magnifier.style.display = "none";
    draw();
  });

  window.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || isFadingOut) return;

    if (toolbar.contains(e.target) || (colorPopover && colorPopover.contains(e.target)) || (dropdownMenu && dropdownMenu.contains(e.target))) {
      return;
    }

    if (isFrozen) {
      const handle = getHandleAt(e.clientX, e.clientY);
      const g = toGlobal(e.clientX, e.clientY);

      if (handle && handle !== "move") {
        isResizing = true;
        activeHandle = handle;
        moveStart = g;
        return;
      }

      if (handle === "move") {
        if (currentTool === "move") {
          isMoving = true;
          moveStart = g;
        } else if (currentTool === "pen") {
          isDrawing = true;
          currentStroke = {
            tool: "pen",
            color: currentColor,
            width: 3,
            points: [g]
          };
          historyStack.push(currentStroke);
          redoStack = [];
        } else if (currentTool === "pixelate" || currentTool === "blur") {
          isBoxSelecting = true;
          boxStart = g;
          currentBox = { tool: currentTool, x: g.x, y: g.y, w: 0, h: 0 };
        }
        return;
      }

      // Clicked outside frozen crop selection -> reset crop & start new selection drag
      isFrozen = false;
      croppedRect = null;
      toolbar.style.display = "none";
      if (dropdownMenu) dropdownMenu.style.display = "none";
      if (colorPopover) colorPopover.style.display = "none";
      historyStack = [];
      redoStack = [];

      isDragging = true;
      globalStartX = g.x;
      globalStartY = g.y;
      globalCurrentX = g.x;
      globalCurrentY = g.y;
      localMouseX = e.clientX;
      localMouseY = e.clientY;
      window.api.sendCropperEvent({ type: "start", sx: g.x, sy: g.y });
      draw();
      updateMagnifier(e.clientX, e.clientY);
      return;
    }

    const g = toGlobal(e.clientX, e.clientY);
    isDragging = true;
    globalStartX = g.x;
    globalStartY = g.y;
    globalCurrentX = g.x;
    globalCurrentY = g.y;
    localMouseX = e.clientX;
    localMouseY = e.clientY;
    window.api.sendCropperEvent({ type: "start", sx: g.x, sy: g.y });
    draw();
  });

  window.addEventListener("mousemove", (e) => {
    if (isFadingOut) return;
    mouseOnScreen = true;
    localMouseX = e.clientX;
    localMouseY = e.clientY;
    const g = toGlobal(e.clientX, e.clientY);

    updateCursor(e.clientX, e.clientY);

    if (isResizing && activeHandle && croppedRect) {
      let left = croppedRect.x;
      let top = croppedRect.y;
      let right = croppedRect.x + croppedRect.w;
      let bottom = croppedRect.y + croppedRect.h;

      if (activeHandle.includes("w")) left = g.x;
      if (activeHandle.includes("e")) right = g.x;
      if (activeHandle.includes("n")) top = g.y;
      if (activeHandle.includes("s")) bottom = g.y;

      globalStartX = left;
      globalStartY = top;
      globalCurrentX = right;
      globalCurrentY = bottom;
      croppedRect = getGlobalSelectionRect();
      draw();
      updateToolbarPosition();
      return;
    }

    if (isMoving && croppedRect) {
      const dx = g.x - moveStart.x;
      const dy = g.y - moveStart.y;
      globalStartX += dx;
      globalCurrentX += dx;
      globalStartY += dy;
      globalCurrentY += dy;
      moveStart = g;
      croppedRect = getGlobalSelectionRect();
      draw();
      updateToolbarPosition();
      return;
    }

    if (isDrawing && currentStroke) {
      currentStroke.points.push(g);
      draw();
      return;
    }

    if (isBoxSelecting && currentBox) {
      currentBox.x = Math.min(boxStart.x, g.x);
      currentBox.y = Math.min(boxStart.y, g.y);
      currentBox.w = Math.abs(boxStart.x - g.x);
      currentBox.h = Math.abs(boxStart.y - g.y);
      draw();
      return;
    }

    if (!isFrozen) {
      globalCurrentX = g.x;
      globalCurrentY = g.y;
      if (compositeReady) {
        if (isDragging) {
          window.api.sendCropperEvent({ type: "move", cx: g.x, cy: g.y });
        }
        draw();
        updateMagnifier(e.clientX, e.clientY);
        if (!isMouseCurrentlyActiveHere) {
          isMouseCurrentlyActiveHere = true;
          window.api.reportMouseActive();
        }
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (isFadingOut) return;

    if (isResizing || isMoving || isDrawing) {
      isResizing = false;
      isMoving = false;
      isDrawing = false;
      activeHandle = null;
      currentStroke = null;
      if (croppedRect) {
        updateToolbarPosition();
      }
      return;
    }

    if (isBoxSelecting && currentBox) {
      isBoxSelecting = false;
      if (currentBox.w > 4 && currentBox.h > 4) {
        historyStack.push({ ...currentBox });
        redoStack = [];
      }
      currentBox = null;
      draw();
      return;
    }

    if (isFrozen) return;
    if (!isDragging) return;

    isDragging = false;
    const g = toGlobal(e.clientX, e.clientY);
    globalCurrentX = g.x;
    globalCurrentY = g.y;
    localMouseX = e.clientX;
    localMouseY = e.clientY;
    const rect = getGlobalSelectionRect();

    if (rect.w > 5 && rect.h > 5) {
      isFrozen = true;
      croppedRect = rect;
      magnifier.style.display = "none";
      window.api.sendCropperEvent({ type: "end", frozen: true, rect });
      showToolbar();
    } else {
      window.api.sendCropperEvent({ type: "end", frozen: false });
      draw();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      window.api.cancelCrop();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      redo();
    }
  });

  window.api.onCropperSync((data) => {
    switch (data.type) {
      case "start":
        if (isFrozen) {
          isFrozen = false;
          croppedRect = null;
          toolbar.style.display = "none";
        }
        isDragging = true;
        globalStartX = data.sx;
        globalStartY = data.sy;
        globalCurrentX = data.sx;
        globalCurrentY = data.sy;
        draw();
        break;
      case "move":
        globalCurrentX = data.cx;
        globalCurrentY = data.cy;
        if (isDragging) draw();
        break;
      case "end":
        isDragging = false;
        if (data.frozen) {
          isFrozen = true;
          croppedRect = data.rect;
          showToolbar();
        }
        draw();
        break;
    }
  });

  window.addEventListener("wheel", (e) => {
    if (!compositeReady) return;
    if (e.deltaY < 0) {
      zoomPixels = Math.max(4, zoomPixels - 2);
    } else {
      zoomPixels = Math.min(64, zoomPixels + 2);
    }
    updateMagnifier(localMouseX, localMouseY);
  });

  // Floating Toolbar Position Helper
  function showToolbar() {
    toolbar.style.display = "flex";
    toolbar.style.opacity = "1";
    updateToolbarPosition();
  }

  function updateToolbarPosition() {
    if (!croppedRect) return;
    const localX = croppedRect.x - displayOffset.x;
    const localY = croppedRect.y - displayOffset.y;
    const localW = croppedRect.w;
    const localH = croppedRect.h;

    const tbWidth = toolbar.offsetWidth || 340;
    const tbHeight = toolbar.offsetHeight || 44;

    let tbX = localX + (localW - tbWidth) / 2;
    let tbY = localY + localH + 12;

    if (tbX < 10) tbX = 10;
    if (tbX + tbWidth > window.innerWidth - 10) {
      tbX = window.innerWidth - tbWidth - 10;
    }

    if (tbY + tbHeight > window.innerHeight - 10) {
      tbY = localY + localH - tbHeight - 12;
      if (tbY < localY + 10) {
        tbY = localY - tbHeight - 12;
      }
    }

    toolbar.style.left = `${Math.round(tbX)}px`;
    toolbar.style.top = `${Math.round(tbY)}px`;
  }

  // Toggle Tools Logic (Clicking an active tool deactivates/toggles it!)
  function setActiveTool(toolName) {
    if (isFadingOut) return;

    if (currentTool === toolName) {
      // Toggle off!
      currentTool = "none";
      [btnMove, btnPen, btnPixelate, btnBlur].forEach((b) => {
        if (b) b.classList.remove("active");
      });
      if (colorPopover) colorPopover.style.display = "none";
      return;
    }

    currentTool = toolName;
    [btnMove, btnPen, btnPixelate, btnBlur].forEach((b) => {
      if (b) b.classList.remove("active");
    });

    if (toolName === "move" && btnMove) btnMove.classList.add("active");
    if (toolName === "pen" && btnPen) btnPen.classList.add("active");
    if (toolName === "pixelate" && btnPixelate) btnPixelate.classList.add("active");
    if (toolName === "blur" && btnBlur) btnBlur.classList.add("active");

    if (toolName !== "pen" && colorPopover) {
      colorPopover.style.display = "none";
    }
  }

  if (btnMove) {
    btnMove.addEventListener("click", () => setActiveTool("move"));
  }

  if (btnPen) {
    btnPen.addEventListener("click", () => {
      if (currentTool === "pen" && colorPopover) {
        colorPopover.style.display = colorPopover.style.display === "none" ? "flex" : "none";
      } else {
        setActiveTool("pen");
      }
    });
  }

  if (btnPixelate) {
    btnPixelate.addEventListener("click", () => setActiveTool("pixelate"));
  }

  if (btnBlur) {
    btnBlur.addEventListener("click", () => setActiveTool("blur"));
  }

  if (btnUndo) {
    btnUndo.addEventListener("click", undo);
  }

  if (btnRedo) {
    btnRedo.addEventListener("click", redo);
  }

  if (btnDelete) {
    btnDelete.addEventListener("click", () => window.api.cancelCrop());
  }

  // Color Swatches
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.addEventListener("click", (e) => {
      currentColor = e.target.getAttribute("data-color");
      if (penColorDot) penColorDot.style.backgroundColor = currentColor;
      if (colorPopover) colorPopover.style.display = "none";
    });
  });

  // Capture Dropdown Menu Toggle
  if (btnCaptureDropdown && dropdownMenu) {
    btnCaptureDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.style.display = dropdownMenu.style.display === "none" ? "flex" : "none";
    });
    document.addEventListener("click", (e) => {
      if (!btnCaptureDropdown.contains(e.target)) {
        dropdownMenu.style.display = "none";
      }
    });
  }

  // Action Buttons
  if (btnEditor) {
    btnEditor.addEventListener("click", () => executeCaptureAction("editor"));
  }
  if (btnClipboard) {
    btnClipboard.addEventListener("click", () => executeCaptureAction("clipboard"));
  }
  if (btnDesktop) {
    btnDesktop.addEventListener("click", () => executeCaptureAction("desktop"));
  }
  if (btnPrint) {
    btnPrint.addEventListener("click", () => executeCaptureAction("print"));
  }
  if (btnShare) {
    btnShare.addEventListener("click", () => executeCaptureAction("clipboard"));
  }

  // Smooth Fade Out of Cropper Selection & Toolbar
  function executeCaptureAction(actionType) {
    const dataUrl = getCroppedDataUrl();
    if (!dataUrl || !croppedRect || isFadingOut) return;

    isFadingOut = true;
    if (dropdownMenu) dropdownMenu.style.display = "none";
    if (colorPopover) colorPopover.style.display = "none";

    const startTime = performance.now();
    const duration = 220;

    function fadeStep(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      cropperFadeOpacity = 1 - progress;
      toolbar.style.opacity = `${cropperFadeOpacity}`;
      draw();

      if (progress < 1) {
        requestAnimationFrame(fadeStep);
      } else {
        if (actionType === "editor") {
          window.api.cropCompleted(dataUrl, croppedRect.w, croppedRect.h);
        } else if (actionType === "clipboard") {
          window.api.copyToClipboard(dataUrl);
          window.api.cancelCrop();
        } else if (actionType === "desktop") {
          window.api.saveToDesktop(dataUrl);
          window.api.cancelCrop();
        } else if (actionType === "print") {
          window.api.printImage(dataUrl);
          window.api.cancelCrop();
        }
      }
    }

    requestAnimationFrame(fadeStep);
  }

  function undo() {
    if (historyStack.length > 0 && !isFadingOut) {
      redoStack.push(historyStack.pop());
      draw();
    }
  }

  function redo() {
    if (redoStack.length > 0 && !isFadingOut) {
      historyStack.push(redoStack.pop());
      draw();
    }
  }

  // Canvas Compositer & Drawing
  function renderHistoryItem(item, targetCtx, isExport = false, exportRect = null) {
    targetCtx.save();
    const transformPoint = (gx, gy) => {
      if (isExport && exportRect) {
        return { x: gx - exportRect.x, y: gy - exportRect.y };
      }
      return toLocal(gx, gy);
    };

    if (item.tool === "pen") {
      targetCtx.strokeStyle = item.color;
      targetCtx.lineWidth = item.width || 3;
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";
      targetCtx.beginPath();
      item.points.forEach((p, i) => {
        const tp = transformPoint(p.x, p.y);
        if (i === 0) targetCtx.moveTo(tp.x, tp.y);
        else targetCtx.lineTo(tp.x, tp.y);
      });
      targetCtx.stroke();
    } else if (item.tool === "pixelate") {
      const box = item;
      const bx = Math.floor(box.x);
      const by = Math.floor(box.y);
      const bw = Math.floor(box.w);
      const bh = Math.floor(box.h);

      if (bw > 0 && bh > 0) {
        const compCtx = compositeCanvas.getContext("2d");
        const blockSize = 10;

        for (let x = bx; x < bx + bw; x += blockSize) {
          for (let y = by; y < by + bh; y += blockSize) {
            const w = Math.min(blockSize, bx + bw - x);
            const h = Math.min(blockSize, by + bh - y);
            try {
              const imgData = compCtx.getImageData(x, y, w, h);
              let r = 0, g = 0, b = 0, count = 0;
              for (let i = 0; i < imgData.data.length; i += 4) {
                r += imgData.data[i];
                g += imgData.data[i + 1];
                b += imgData.data[i + 2];
                count++;
              }
              if (count > 0) {
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                const tp = transformPoint(x, y);
                targetCtx.fillStyle = `rgb(${r},${g},${b})`;
                targetCtx.fillRect(tp.x, tp.y, w, h);
              }
            } catch (_) {}
          }
        }
      }
    } else if (item.tool === "blur") {
      const box = item;
      const bx = Math.floor(box.x);
      const by = Math.floor(box.y);
      const bw = Math.floor(box.w);
      const bh = Math.floor(box.h);

      if (bw > 0 && bh > 0) {
        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = bw;
        blurCanvas.height = bh;
        const blurCtx = blurCanvas.getContext("2d");

        blurCtx.drawImage(compositeCanvas, bx, by, bw, bh, 0, 0, bw, bh);
        blurCtx.filter = "blur(8px)";
        blurCtx.drawImage(blurCanvas, 0, 0, bw, bh);

        const tp = transformPoint(bx, by);
        targetCtx.drawImage(blurCanvas, tp.x, tp.y, bw, bh);
      }
    }
    targetCtx.restore();
  }

  function renderAnnotations(targetCtx) {
    historyStack.forEach((item) => {
      renderHistoryItem(item, targetCtx, false, null);
    });

    if (isBoxSelecting && currentBox) {
      ctx.save();
      const tp = toLocal(currentBox.x, currentBox.y);
      ctx.strokeStyle = currentBox.tool === "pixelate" ? "#ff4757" : "#00e5ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(tp.x, tp.y, currentBox.w, currentBox.h);
      ctx.fillStyle = currentBox.tool === "pixelate" ? "rgba(255, 71, 87, 0.15)" : "rgba(0, 229, 255, 0.15)";
      ctx.fillRect(tp.x, tp.y, currentBox.w, currentBox.h);
      ctx.restore();
    }
  }

  function getCroppedDataUrl() {
    if (!croppedRect || !compositeCanvas) return null;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = croppedRect.w;
    cropCanvas.height = croppedRect.h;
    const cropCtx = cropCanvas.getContext("2d");

    // 1. Draw base original screenshot
    cropCtx.drawImage(
      compositeCanvas,
      croppedRect.x,
      croppedRect.y,
      croppedRect.w,
      croppedRect.h,
      0,
      0,
      croppedRect.w,
      croppedRect.h
    );

    // 2. Render pixelate, blur, and freehand paint history onto export canvas
    historyStack.forEach((item) => {
      renderHistoryItem(item, cropCtx, true, croppedRect);
    });

    return cropCanvas.toDataURL("image/png");
  }

  function draw() {
    if (!compositeReady) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Always draw full clear base screenshot
    ctx.drawImage(
      compositeCanvas,
      displayOffset.x,
      displayOffset.y,
      w,
      h,
      0,
      0,
      w,
      h
    );

    // Dim background overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * cropperFadeOpacity})`;
    ctx.fillRect(0, 0, w, h);

    // Magnifier when starting selection
    if (mouseOnScreen && !isFrozen && !isFadingOut) {
      ctx.save();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(0, localMouseY);
      ctx.lineTo(w, localMouseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(localMouseX, 0);
      ctx.lineTo(localMouseX, h);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(localMouseX, localMouseY, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(localMouseX, localMouseY, 1.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      const coordText = `${Math.round(localMouseX)} × ${Math.round(localMouseY)}`;
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      const textW = ctx.measureText(coordText).width;
      const px = localMouseX + 12;
      const py = localMouseY + 4;
      ctx.fillStyle = "rgba(167, 243, 208, 0.9)";
      ctx.beginPath();
      ctx.roundRect(px, py, textW + 12, 18, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, textW + 12, 18);
      ctx.fillStyle = "#065f46";
      ctx.fillText(coordText, px + 6, py + 13);
      ctx.restore();
    }

    // Render active selection area
    if (isDragging || isFrozen) {
      const globalRect = getGlobalSelectionRect();
      const localX = globalRect.x - displayOffset.x;
      const localY = globalRect.y - displayOffset.y;
      const localRight = localX + globalRect.w;
      const localBottom = localY + globalRect.h;
      const visLeft = Math.max(0, localX);
      const visTop = Math.max(0, localY);
      const visRight = Math.min(w, localRight);
      const visBottom = Math.min(h, localBottom);

      if (visRight > visLeft && visBottom > visTop) {
        ctx.save();
        ctx.globalAlpha = cropperFadeOpacity;

        ctx.drawImage(
          compositeCanvas,
          visLeft + displayOffset.x,
          visTop + displayOffset.y,
          visRight - visLeft,
          visBottom - visTop,
          visLeft,
          visTop,
          visRight - visLeft,
          visBottom - visTop
        );

        renderAnnotations(ctx);

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(localX, localY, globalRect.w, globalRect.h);
        ctx.restore();

        if (showRuler) {
          ctx.save();
          ctx.strokeStyle = "rgba(0, 229, 255, 0.7)";
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.font = "9px sans-serif";
          ctx.lineWidth = 1;
          const rw = globalRect.w;
          const rh = globalRect.h;
          for (let step = 0; step <= rw; step += 10) {
            const tx = localX + step;
            const th = step % 50 === 0 ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(tx, localY);
            ctx.lineTo(tx, localY + th);
            ctx.stroke();
            if (step % 50 === 0 && step > 0 && step < rw - 15) {
              ctx.fillText(`${step}`, tx - 6, localY + 14);
            }
          }
          for (let step = 0; step <= rh; step += 10) {
            const ty = localY + step;
            const tw = step % 50 === 0 ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(localX, ty);
            ctx.lineTo(localX + tw, ty);
            ctx.stroke();
            if (step % 50 === 0 && step > 0 && step < rh - 15) {
              ctx.fillText(`${step}`, localX + 8, ty + 3);
            }
          }
          ctx.restore();
        }

        // Render Corner Brackets ┌ ┐ └ ┘ & Edge Handles ━ ┃
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;

        const bracketLen = 14;

        // Top-Left ┌
        ctx.beginPath();
        ctx.moveTo(localX, localY + bracketLen);
        ctx.lineTo(localX, localY);
        ctx.lineTo(localX + bracketLen, localY);
        ctx.stroke();

        // Top-Right ┐
        ctx.beginPath();
        ctx.moveTo(localRight - bracketLen, localY);
        ctx.lineTo(localRight, localY);
        ctx.lineTo(localRight, localY + bracketLen);
        ctx.stroke();

        // Bottom-Left └
        ctx.beginPath();
        ctx.moveTo(localX, localBottom - bracketLen);
        ctx.lineTo(localX, localBottom);
        ctx.lineTo(localX + bracketLen, localBottom);
        ctx.stroke();

        // Bottom-Right ┘
        ctx.beginPath();
        ctx.moveTo(localRight - bracketLen, localBottom);
        ctx.lineTo(localRight, localBottom);
        ctx.lineTo(localRight, localBottom - bracketLen);
        ctx.stroke();

        // Edge Handles ━ ┃
        const pillLen = 16;
        const pillThick = 4;

        ctx.beginPath();
        ctx.roundRect(localX + globalRect.w / 2 - pillLen / 2, localY - pillThick / 2, pillLen, pillThick, 2);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(localX + globalRect.w / 2 - pillLen / 2, localBottom - pillThick / 2, pillLen, pillThick, 2);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(localX - pillThick / 2, localY + globalRect.h / 2 - pillLen / 2, pillThick, pillLen, 2);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(localRight - pillThick / 2, localY + globalRect.h / 2 - pillLen / 2, pillThick, pillLen, 2);
        ctx.fill();

        ctx.restore();

        // Tag
        const tagText = `${globalRect.w} × ${globalRect.h}`;
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        const tagWidth = ctx.measureText(tagText).width;
        ctx.fillStyle = "rgba(0, 229, 255, 0.9)";
        let tagY = localY - 12;
        if (tagY < 20) tagY = localY + 22;
        let tagX = localX + globalRect.w / 2 - tagWidth / 2 - 8;
        ctx.beginPath();
        ctx.roundRect(tagX, tagY - 12, tagWidth + 16, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.fillText(tagText, tagX + 8, tagY + 2);

        ctx.restore();
      }
    }
  }

  function updateMagnifier(mouseX, mouseY) {
    if (!compositeReady || isFadingOut) return;
    magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
    const gx = mouseX + displayOffset.x;
    const gy = mouseY + displayOffset.y;
    const zoomSrcX = gx - zoomPixels / 2;
    const zoomSrcY = gy - zoomPixels / 2;
    magCtx.imageSmoothingEnabled = false;
    magCtx.drawImage(
      compositeCanvas,
      zoomSrcX,
      zoomSrcY,
      zoomPixels,
      zoomPixels,
      0,
      0,
      MAG_SIZE,
      MAG_SIZE
    );
    const pixelSize = MAG_SIZE / zoomPixels;
    magCtx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    magCtx.lineWidth = 0.5;
    for (let x = 0; x <= MAG_SIZE; x += pixelSize) {
      magCtx.beginPath();
      magCtx.moveTo(x, 0);
      magCtx.lineTo(x, MAG_SIZE);
      magCtx.stroke();
    }
    for (let y = 0; y <= MAG_SIZE; y += pixelSize) {
      magCtx.beginPath();
      magCtx.moveTo(0, y);
      magCtx.lineTo(MAG_SIZE, y);
      magCtx.stroke();
    }
    magCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    magCtx.lineWidth = 1;
    magCtx.beginPath();
    magCtx.moveTo(0, MAG_SIZE / 2);
    magCtx.lineTo(MAG_SIZE, MAG_SIZE / 2);
    magCtx.stroke();
    magCtx.beginPath();
    magCtx.moveTo(MAG_SIZE / 2, 0);
    magCtx.lineTo(MAG_SIZE / 2, MAG_SIZE);
    magCtx.stroke();
    magCtx.strokeStyle = "#00e5ff";
    magCtx.lineWidth = 1;
    magCtx.strokeRect((MAG_SIZE - pixelSize) / 2, (MAG_SIZE - pixelSize) / 2, pixelSize, pixelSize);
    let magX = mouseX + 15;
    let magY = mouseY + 15;
    if (magX + MAG_SIZE > window.innerWidth) magX = mouseX - MAG_SIZE - 15;
    if (magY + MAG_SIZE > window.innerHeight) magY = mouseY - MAG_SIZE - 15;

    let colorText = "";
    try {
      const compCtx = compositeCanvas.getContext("2d");
      const pxData = compCtx.getImageData(Math.floor(gx), Math.floor(gy), 1, 1).data;
      const hex = "#" + [pxData[0], pxData[1], pxData[2]].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
      colorText = ` | ${hex}`;
    } catch (_) {}

    if (mouseOnScreen) {
      magnifier.style.left = `${magX}px`;
      magnifier.style.top = `${magY}px`;
      magnifier.style.display = "block";
      magText.textContent = `X: ${Math.round(mouseX)} | Y: ${Math.round(mouseY)}${colorText}`;
    } else {
      magnifier.style.display = "none";
    }
  }

  window.api.onHideMagnifier(() => {
    isMouseCurrentlyActiveHere = false;
    mouseOnScreen = false;
    magnifier.style.display = "none";
    draw();
  });
})();
