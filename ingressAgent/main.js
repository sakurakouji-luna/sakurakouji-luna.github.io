(function () {
  const agentHandle = "slchy";
  const defaultIngressLink = `https://link.ingress.com/agent/${agentHandle}`;

  const params = new URLSearchParams(window.location.search);
  const ingressLink = params.get("link") || defaultIngressLink;
  const openButton = document.getElementById("openIngress");
  const biocard = document.getElementById("biocard");
  const cardFace = document.getElementById("cardFace");
  const cardImages = {
    front: "./img/f1.png",
    back: "./img/biocard_back.png"
  };
  const rotation = {
    x: 0,
    y: 0,
    z: 0,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    dragging: false,
    animating: false,
    visibleFace: "front"
  };

  function handleOpen(event) {
    event.preventDefault();
    window.location.href = ingressLink;
  }

  function renderCardRotation() {
    const face = getVisibleFace(rotation.y);
    if (face.name !== rotation.visibleFace) {
      rotation.visibleFace = face.name;
      cardFace.src = cardImages[face.name];
    }

    biocard.style.setProperty("--rx", `${rotation.x}deg`);
    biocard.style.setProperty("--ry", `${face.y}deg`);
    biocard.style.setProperty("--rz", `${rotation.z}deg`);
  }

  function getVisibleFace(rawY) {
    const normalized = ((rawY % 360) + 360) % 360;
    if (normalized > 90 && normalized < 270) {
      return {
        name: "back",
        y: normalized - 180
      };
    }

    return {
      name: "front",
      y: normalized > 270 ? normalized - 360 : normalized
    };
  }

  function setTargetRotation(x, y, z) {
    rotation.targetX = Math.max(-18, Math.min(18, x));
    rotation.targetY = y;
    rotation.targetZ = Math.max(-6, Math.min(6, z));
    startRotationLoop();
  }

  function startRotationLoop() {
    if (rotation.animating) return;
    rotation.animating = true;
    requestAnimationFrame(tickRotation);
  }

  function tickRotation() {
    const ease = rotation.dragging ? 1 : 0.18;
    rotation.x += (rotation.targetX - rotation.x) * ease;
    rotation.y += (rotation.targetY - rotation.y) * ease;
    rotation.z += (rotation.targetZ - rotation.z) * ease;
    renderCardRotation();

    const settled =
      Math.abs(rotation.targetX - rotation.x) < 0.02 &&
      Math.abs(rotation.targetY - rotation.y) < 0.02 &&
      Math.abs(rotation.targetZ - rotation.z) < 0.02;

    if (settled) {
      rotation.x = rotation.targetX;
      rotation.y = rotation.targetY;
      rotation.z = rotation.targetZ;
      renderCardRotation();
      rotation.animating = false;
      return;
    }

    requestAnimationFrame(tickRotation);
  }

  function handlePointerDown(event) {
    event.preventDefault();
    rotation.dragging = true;
    rotation.startX = event.clientX;
    rotation.startY = event.clientY;
    rotation.baseX = rotation.targetX;
    rotation.baseY = rotation.targetY;
    biocard.classList.add("is-dragging");
    document.body.classList.add("is-card-dragging");
    biocard.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!rotation.dragging) return;
    event.preventDefault();
    const deltaX = event.clientX - rotation.startX;
    const deltaY = event.clientY - rotation.startY;
    setTargetRotation(
      rotation.baseX - deltaY * 0.09,
      rotation.baseY + deltaX * 0.42,
      deltaX * 0.015
    );
  }

  function handlePointerEnd(event) {
    if (!rotation.dragging) return;
    event.preventDefault();
    rotation.dragging = false;
    biocard.classList.remove("is-dragging");
    document.body.classList.remove("is-card-dragging");
    if (biocard.hasPointerCapture(event.pointerId)) {
      biocard.releasePointerCapture(event.pointerId);
    }

    const normalizedY = Math.round(rotation.targetY / 180) * 180;
    setTargetRotation(0, normalizedY, 0);
  }

  openButton.href = ingressLink;
  openButton.addEventListener("click", handleOpen);
  biocard.addEventListener("pointerdown", handlePointerDown);
  biocard.addEventListener("pointermove", handlePointerMove);
  biocard.addEventListener("pointerup", handlePointerEnd);
  biocard.addEventListener("pointercancel", handlePointerEnd);
  biocard.addEventListener("dragstart", (event) => event.preventDefault());
  biocard.addEventListener("selectstart", (event) => event.preventDefault());
})();
