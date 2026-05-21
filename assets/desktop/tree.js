(function () {
  const EPSILON = 0.5;

  function isWindow(node) {
    return Boolean(node && node.type === "window");
  }

  function collectWindows(node, list) {
    const result = list || [];
    if (!node) return result;
    if (isWindow(node)) {
      result.push(node);
      return result;
    }
    collectWindows(node.leftChild, result);
    collectWindows(node.rightChild, result);
    return result;
  }

  function findWindow(node, windowId) {
    if (!node || !windowId) return null;
    if (isWindow(node)) return node.id === windowId ? node : null;
    return findWindow(node.leftChild, windowId) || findWindow(node.rightChild, windowId);
  }

  function updateWindow(node, windowId, updater) {
    if (!node) return null;
    if (isWindow(node)) {
      return node.id === windowId ? updater(node) : node;
    }
    return {
      ...node,
      leftChild: updateWindow(node.leftChild, windowId, updater),
      rightChild: updateWindow(node.rightChild, windowId, updater)
    };
  }

  function setRootMeta(node, parentId, weight) {
    if (!node) return null;
    return {
      ...node,
      parentId,
      weight
    };
  }

  function insertWindow(root, activeWindowId, newWindow, splitDirection, createSplitId) {
    if (!root) {
      return setRootMeta(newWindow, null, 1);
    }

    if (isWindow(root)) {
      if (root.id !== activeWindowId) return root;
      const splitId = createSplitId();
      return {
        id: splitId,
        parentId: root.parentId,
        weight: root.weight || 1,
        type: "split",
        direction: splitDirection,
        leftChild: setRootMeta(root, splitId, 0.5),
        rightChild: setRootMeta(newWindow, splitId, 0.5)
      };
    }

    return {
      ...root,
      leftChild: insertWindow(root.leftChild, activeWindowId, newWindow, splitDirection, createSplitId),
      rightChild: insertWindow(root.rightChild, activeWindowId, newWindow, splitDirection, createSplitId)
    };
  }

  function removeWindow(root, windowId) {
    if (!root || !windowId) return root;
    if (isWindow(root)) return root.id === windowId ? null : root;

    if (isWindow(root.leftChild) && root.leftChild.id === windowId) {
      return setRootMeta(root.rightChild, root.parentId, root.weight || 1);
    }
    if (isWindow(root.rightChild) && root.rightChild.id === windowId) {
      return setRootMeta(root.leftChild, root.parentId, root.weight || 1);
    }

    return {
      ...root,
      leftChild: removeWindow(root.leftChild, windowId),
      rightChild: removeWindow(root.rightChild, windowId)
    };
  }

  function detachWindow(root, windowId) {
    const windowNode = findWindow(root, windowId);
    if (!windowNode) return { root, windowNode: null };
    return {
      root: removeWindow(root, windowId),
      windowNode: setRootMeta(windowNode, null, 1)
    };
  }

  function appendAsRoot(root, windowNode, splitDirection, createSplitId) {
    if (!root) return setRootMeta(windowNode, null, 1);
    const splitId = createSplitId();
    return {
      id: splitId,
      parentId: null,
      weight: 1,
      type: "split",
      direction: splitDirection,
      leftChild: setRootMeta(root, splitId, 0.5),
      rightChild: setRootMeta(windowNode, splitId, 0.5)
    };
  }

  function calculateLayout(node, rect, list) {
    const result = list || [];
    if (!node) return result;
    if (isWindow(node)) {
      result.push({ node, rect: { ...rect } });
      return result;
    }

    const leftWeight = Math.max(0.01, node.leftChild.weight || 0.5);
    const rightWeight = Math.max(0.01, node.rightChild.weight || 0.5);
    const ratio = leftWeight / (leftWeight + rightWeight);

    if (node.direction === "horizontal") {
      const leftWidth = rect.width * ratio;
      calculateLayout(node.leftChild, {
        x: rect.x,
        y: rect.y,
        width: leftWidth,
        height: rect.height
      }, result);
      calculateLayout(node.rightChild, {
        x: rect.x + leftWidth,
        y: rect.y,
        width: rect.width - leftWidth,
        height: rect.height
      }, result);
    } else {
      const topHeight = rect.height * ratio;
      calculateLayout(node.leftChild, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: topHeight
      }, result);
      calculateLayout(node.rightChild, {
        x: rect.x,
        y: rect.y + topHeight,
        width: rect.width,
        height: rect.height - topHeight
      }, result);
    }
    return result;
  }

  function findNeighbor(layouts, activeWindowId, direction) {
    const active = layouts.find((item) => item.node.id === activeWindowId);
    if (!active) return null;
    const activeRect = active.rect;
    const activeCenterX = activeRect.x + activeRect.width / 2;
    const activeCenterY = activeRect.y + activeRect.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (const item of layouts) {
      if (item.node.id === activeWindowId) continue;
      const rect = item.rect;
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      let primaryDistance = 0;
      let perpendicularDistance = 0;
      let valid = false;

      if (direction === "left") {
        valid = rect.x + rect.width <= activeRect.x + EPSILON || centerX < activeCenterX;
        primaryDistance = Math.max(0, activeRect.x - (rect.x + rect.width));
        perpendicularDistance = Math.abs(centerY - activeCenterY);
      } else if (direction === "right") {
        valid = rect.x >= activeRect.x + activeRect.width - EPSILON || centerX > activeCenterX;
        primaryDistance = Math.max(0, rect.x - (activeRect.x + activeRect.width));
        perpendicularDistance = Math.abs(centerY - activeCenterY);
      } else if (direction === "up") {
        valid = rect.y + rect.height <= activeRect.y + EPSILON || centerY < activeCenterY;
        primaryDistance = Math.max(0, activeRect.y - (rect.y + rect.height));
        perpendicularDistance = Math.abs(centerX - activeCenterX);
      } else if (direction === "down") {
        valid = rect.y >= activeRect.y + activeRect.height - EPSILON || centerY > activeCenterY;
        primaryDistance = Math.max(0, rect.y - (activeRect.y + activeRect.height));
        perpendicularDistance = Math.abs(centerX - activeCenterX);
      }

      if (!valid) continue;
      const score = primaryDistance * 1000 + perpendicularDistance;
      if (score < bestScore) {
        best = item.node;
        bestScore = score;
      }
    }

    return best;
  }

  window.TilingTree = {
    appendAsRoot,
    calculateLayout,
    collectWindows,
    detachWindow,
    findNeighbor,
    findWindow,
    insertWindow,
    removeWindow,
    updateWindow
  };
})();
