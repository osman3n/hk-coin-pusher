/* 一蚊雞 — render.js
 * three.js scene. Everything is built from primitives at load time: no model
 * files, no texture files. The same builders feed the game table and the
 * museum thumbnails, so a prop can never look like two different objects.
 */
(function (G) {
  'use strict';

  var THREE = G.THREE;
  var R = {};

  // ── material cache ─────────────────────────────────────────────────────
  var _mats = {};
  function M(color, rough, metal) {
    var k = color + '|' + (rough == null ? 0.7 : rough) + '|' + (metal || 0);
    if (_mats[k]) return _mats[k];
    _mats[k] = new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0,
      flatShading: true
    });
    return _mats[k];
  }
  /* Flat shading is right for a plank, a cabinet, a stack of crates -- it
   * gives hard edges that read as built things. It is wrong for every round
   * object: at ten segments a sphere renders as a faceted ball, so the
   * 垃圾蟲 looked like a disco lamp and the 他媽哥池 like a cut gem.
   * Curved primitives therefore borrow a smooth twin of whatever material
   * they were handed. Materials stay shared and cached, so this costs one
   * clone per (colour, roughness, metalness) trio, not one per prop.
   */
  var _smoothMats = {};
  function smoothOf(mat) {
    if (!mat || !mat.isMeshStandardMaterial) return mat;
    var k = mat.uuid;
    if (_smoothMats[k]) return _smoothMats[k];
    var m = mat.clone();
    m.flatShading = false;
    _smoothMats[k] = m;
    return m;
  }

  var GOLD = 0xd9a441, CREAM = 0xf2e6d0, DARK = 0x2a241c;
  // geometry has to match the simulation exactly, so read the radius from sim.js
  var COIN_R = (G.Sim && G.Sim.COIN_R) || 0.036;
  var COIN_MAT = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.34, metalness: 0.85 });
  var COIN_EDGE = new THREE.MeshStandardMaterial({ color: 0x8e6f18, roughness: 0.5, metalness: 0.7 });

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z) {
    seg = seg || 12;
    // a 6- or 8-sided cylinder is meant to be angular (a pencil, a post);
    // at 12+ it is meant to be round, so it gets the smooth material
    var use = seg >= 12 ? smoothOf(mat) : mat;
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), use);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function sph(r, mat, x, y, z, seg) {
    var n = seg || 16;
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.max(6, Math.round(n * 0.7))), smoothOf(mat));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function tor(r, t, mat, x, y, z, rotX) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 24), smoothOf(mat));
    m.position.set(x || 0, y || 0, z || 0);
    if (rotX) m.rotation.x = rotX;
    m.castShadow = true;
    return m;
  }
  function cone(r, h, seg, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 8), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    return m;
  }
  // texture from a canvas draw callback
  function tex(w, h, draw) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    draw(g, w, h);
    var t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }
  function plateTex(w, h, draw) {
    var t = tex(w, h, draw);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0.05 });
  }

  // ── prop builders ──────────────────────────────────────────────────────
  // Every builder returns a Group whose base sits at y = 0.
  var B = {};

  // ═══ 1972 ═══
  B.sodaCase = function () {
    var g = new THREE.Group();
    g.add(box(0.20, 0.13, 0.15, M(0x2f6b8f, 0.6), 0, 0.065, 0));
    g.add(box(0.21, 0.02, 0.16, M(CREAM, 0.5), 0, 0.135, 0));
    for (var i = 0; i < 4; i++) {
      g.add(cyl(0.016, 0.016, 0.075, 8, M(0x2f6b3d, 0.45), -0.07 + i * 0.046, 0.175, 0));
    }
    g.add(box(0.19, 0.05, 0.001, plateTex(64, 24, function (c, w, h) {
      c.fillStyle = '#2f6b8f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2e6d0'; c.font = 'bold 15px sans-serif';
      c.fillText('汽水', 6, 17);
    }), 0, 0.08, 0.076));
    return g;
  };
  B.crtTv = function () {
    var g = new THREE.Group();
    g.add(box(0.24, 0.20, 0.19, M(0x6b4526, 0.8), 0, 0.10, 0));
    g.add(box(0.17, 0.14, 0.01, M(0x14100c, 0.3), -0.02, 0.11, 0.098));
    g.add(box(0.155, 0.125, 0.005, M(0x3d4a3a, 0.25, 0.1), -0.02, 0.11, 0.104));
    for (var i = 0; i < 2; i++) g.add(cyl(0.013, 0.013, 0.012, 8, M(0x1a1a1a, 0.5), 0.085, 0.145 - i * 0.045, 0.10));
    g.add(cyl(0.006, 0.006, 0.06, 6, M(0x9a9a9a, 0.4, 0.6), 0.08, 0.23, 0.05));
    g.add(cyl(0.006, 0.006, 0.06, 6, M(0x9a9a9a, 0.4, 0.6), -0.02, 0.23, 0.05));
    return g;
  };
  B.mahjongTable = function () {
    var g = new THREE.Group();
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), M(0x2f5c3a, 0.75));
    top.position.y = 0.10; top.castShadow = top.receiveShadow = true;
    g.add(top);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + 0.78;
      g.add(box(0.018, 0.10, 0.018, M(0x4a3020, 0.8), Math.cos(a) * 0.105, 0.05, Math.sin(a) * 0.105));
    }
    // a few tiles on top
    for (var j = 0; j < 6; j++) {
      var t = box(0.026, 0.014, 0.034, M(CREAM, 0.55),
        (j % 3 - 1) * 0.031, 0.122, (Math.floor(j / 3) - 0.5) * 0.04);
      t.rotation.y = (j * 0.7) % 0.4;
      g.add(t);
    }
    return g;
  };
  B.lapSapChung = function () {
    var g = new THREE.Group();
    g.add(sph(0.075, M(0x3f8f4a, 0.7), 0, 0.085, 0, 10));
    for (var i = 0; i < 5; i++) {
      var a = i * 1.2566;
      var c = cone(0.016, 0.055, 6, M(0x3f8f4a, 0.7), Math.cos(a) * 0.06, 0.152, Math.sin(a) * 0.06);
      c.rotation.z = -Math.cos(a) * 0.5; c.rotation.x = Math.sin(a) * 0.5;
      g.add(c);
    }
    g.add(sph(0.017, M(0xffffff, 0.4), -0.026, 0.105, 0.066, 8));
    g.add(sph(0.017, M(0xffffff, 0.4), 0.026, 0.105, 0.066, 8));
    g.add(sph(0.009, M(0x111111, 0.3), -0.026, 0.106, 0.078, 6));
    g.add(sph(0.009, M(0x111111, 0.3), 0.026, 0.106, 0.078, 6));
    return g;
  };
  B.minibusSign = function () {
    var g = new THREE.Group();
    g.add(box(0.19, 0.075, 0.012, M(0x8f2b24, 0.7), 0, 0.05, 0));
    g.add(box(0.185, 0.065, 0.002, plateTex(96, 34, function (c, w, h) {
      c.fillStyle = '#8f2b24'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2e6d0'; c.font = 'bold 17px serif';
      c.fillText('旺角', 8, 24);
    }), 0, 0.05, 0.008));
    g.add(box(0.02, 0.03, 0.02, M(0x333333, 0.6), -0.06, 0.012, 0));
    g.add(box(0.02, 0.03, 0.02, M(0x333333, 0.6), 0.06, 0.012, 0));
    return g;
  };
  B.hongLokKei = function () {
    var g = new THREE.Group();
    g.add(box(0.19, 0.008, 0.19, M(0xd8c9a8, 0.85), 0, 0.004, 0));
    g.add(box(0.17, 0.002, 0.17, plateTex(96, 96, function (c, w, h) {
      c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2;
      for (var i = 1; i < 5; i++) {
        c.beginPath(); c.moveTo(i * w / 5, 4); c.lineTo(i * w / 5, h - 4); c.stroke();
        c.beginPath(); c.moveTo(4, i * h / 5); c.lineTo(w - 4, i * h / 5); c.stroke();
      }
      var cols = ['#c8342b', '#2f6b8f', '#3f8f4a', '#d9a441'];
      for (var j = 0; j < 9; j++) {
        c.fillStyle = cols[j % 4];
        c.beginPath(); c.arc(10 + (j * 43) % (w - 20), 14 + (j * 29) % (h - 28), 5, 0, 7); c.fill();
      }
    }), 0, 0.0055, 0));
    for (var i = 0; i < 3; i++) g.add(sph(0.009, M(i === 0 ? 0xc8342b : 0x2f6b8f, 0.4), -0.05 + i * 0.05, 0.013, 0.03, 6));
    return g;
  };
  B.lukBo = function () {
    var g = new THREE.Group();
    // 綠寶 was a squat green glass bottle, not a can: a wide body that
    // shoulders down to a short neck, gold crown, and a paper label that
    // stops short of the shoulder.
    var glass = M(0x2f6b3d, 0.28);
    g.add(cyl(0.042, 0.046, 0.095, 18, glass, 0, 0.050, 0));
    g.add(cyl(0.0435, 0.0465, 0.007, 18, M(0x275c34, 0.30), 0, 0.0025, 0));  // base
    g.add(cyl(0.023, 0.042, 0.030, 18, glass, 0, 0.1125, 0));                 // shoulder
    g.add(cyl(0.019, 0.021, 0.026, 16, glass, 0, 0.1405, 0));                 // neck
    g.add(cyl(0.0235, 0.0225, 0.011, 16, M(0xc9a227, 0.34, 0.85), 0, 0.1590, 0));  // crown
    for (var r = 0; r < 10; r++) {                                            // crown ridges
      var ra = r * Math.PI / 5;
      g.add(box(0.003, 0.010, 0.003, M(0xa8861e, 0.4, 0.8),
        Math.cos(ra) * 0.0225, 0.159, Math.sin(ra) * 0.0225));
    }
    g.add(cyl(0.0432, 0.0452, 0.052, 18, plateTex(128, 128, function (c, w, h) {
      c.fillStyle = '#f2ece0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2f6b3d'; c.fillRect(0, 0, w, 16);
      c.fillStyle = '#e8862f';
      c.beginPath(); c.arc(w / 2, 46, 15, 0, 7); c.fill();
      c.fillStyle = '#f2ece0'; c.font = 'bold 10px sans-serif';
      c.textAlign = 'center'; c.fillText('綠寶', w / 2, 49);
      c.fillStyle = '#2f6b3d'; c.font = 'bold 13px sans-serif';
      c.fillText('橙汁', w / 2, 76);
      c.font = '7px sans-serif'; c.fillStyle = '#6b6b5c';
      c.fillText('GREEN SPOT', w / 2, 90);
    }), 0, 0.056, 0));
    return g;
  };
  B.newspaper = function () {
    var g = new THREE.Group();
    g.add(box(0.16, 0.004, 0.11, M(0xe0d8c4, 0.9), 0, 0.042, 0));
    g.add(box(0.16, 0.004, 0.11, M(0xd8d0bc, 0.9), 0.004, 0.048, 0.004));
    g.add(box(0.155, 0.002, 0.10, plateTex(64, 48, function (c, w, h) {
      c.fillStyle = '#eee6d2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3a3a3a';
      for (var i = 0; i < 10; i++) c.fillRect(4, 5 + i * 4, 20 + (i * 13) % 30, 1.4);
      c.fillStyle = '#8f2b24'; c.font = 'bold 9px serif'; c.fillText('華僑日報', 3, 7);
    }), 0, 0.0505, 0));
    g.add(box(0.014, 0.042, 0.014, M(0x6b4a2f, 0.85), -0.06, 0.021, 0.045));
    g.add(box(0.014, 0.042, 0.014, M(0x6b4a2f, 0.85), 0.06, 0.021, 0.045));
    return g;
  };
  B.chalkHopscotch = function () {
    var g = new THREE.Group();
    // Drawn on the ground, so the mark is a painted plate: eight squares and
    // the numbers are legible from above, which stacks of boxes never were.
    var ground = tex(256, 256, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = '#efe9dc'; c.lineWidth = 5; c.lineCap = 'round';
      var cols = 3, cw = w / cols, ch = h / 5;
      var cells = [[1, 0], [1, 1], [0, 2], [2, 2], [1, 3], [1, 4]];
      for (var i = 0; i < cells.length; i++) {
        var cx = cells[i][0] * cw, cy = cells[i][1] * ch;
        c.strokeRect(cx + 7, cy + 7, cw - 14, ch - 14);
        c.fillStyle = 'rgba(239,233,220,.92)';
        c.font = 'bold 34px serif'; c.textAlign = 'center';
        c.fillText(String(i + 1), cx + cw / 2, cy + ch / 2 + 12);
      }
      // the chalk drags, so nothing is perfectly straight
      c.globalAlpha = 0.28; c.lineWidth = 2;
      for (var j = 0; j < 18; j++) {
        c.beginPath();
        c.moveTo((j * 53) % w, (j * 37) % h);
        c.lineTo((j * 53) % w + 22, (j * 37) % h + 9);
        c.stroke();
      }
    });
    g.add(box(0.155, 0.002, 0.155,
      new THREE.MeshStandardMaterial({ map: ground, roughness: 0.95, transparent: true }),
      0, 0.001, 0));
    // a stub of chalk left lying on it
    var ch = cyl(0.008, 0.009, 0.046, 6, M(0xf2eee2, 0.95), 0.055, 0.011, -0.052);
    ch.rotation.z = Math.PI / 2; ch.rotation.y = 0.6;
    g.add(ch);
    return g;
  };

  // ═══ 1980 ═══
  B.neonSign = function () {
    var g = new THREE.Group();
    g.add(box(0.035, 0.22, 0.035, M(0x3a3a40, 0.6, 0.4), 0, 0.11, -0.02));
    var neon = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff2d4d, emissiveIntensity: 1.6, roughness: 0.4 });
    g.add(tor(0.055, 0.007, neon, 0, 0.15, 0.005, 0));
    g.add(box(0.09, 0.007, 0.007, neon, 0, 0.075, 0.005));
    g.add(box(0.007, 0.05, 0.007, neon, -0.045, 0.075, 0.005));
    g.add(box(0.007, 0.05, 0.007, neon, 0.045, 0.075, 0.005));
    g.add(box(0.11, 0.05, 0.012, M(0x1a1a1e, 0.7), 0, 0.222, 0));
    return g;
  };
  B.arcadeCab = function () {
    var g = new THREE.Group();
    g.add(box(0.17, 0.24, 0.13, M(0x1e2438, 0.7), 0, 0.12, 0));
    g.add(box(0.145, 0.10, 0.01, M(0x0a0a10, 0.3), 0, 0.185, 0.066));
    g.add(box(0.135, 0.088, 0.004, M(0x2a3f6b, 0.2, 0.1), 0, 0.185, 0.072));
    // screen content: pixel invasion
    g.add(box(0.13, 0.03, 0.002, plateTex(64, 16, function (c, w, h) {
      c.fillStyle = '#0a0a14'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7ee787';
      for (var i = 0; i < 9; i++) c.fillRect(4 + i * 7, 6 + (i % 3) * 3, 3, 3);
      c.fillStyle = '#ffd166'; c.fillRect(30, 10, 4, 2);
    }), 0, 0.152, 0.073));
    g.add(box(0.13, 0.03, 0.05, M(0x141824, 0.7), 0, 0.09, 0.05));
    g.add(cyl(0.008, 0.008, 0.018, 8, M(0x8f2b24, 0.5), -0.035, 0.108, 0.045));
    g.add(sph(0.007, M(0x2f6b8f, 0.5), -0.035, 0.12, 0.045, 6));
    g.add(box(0.016, 0.004, 0.006, M(0x3a3a3a, 0.6), 0, 0.108, 0.038));
    g.add(box(0.17, 0.02, 0.13, M(0x2a1d12, 0.8), 0, 0.01, 0));
    return g;
  };
  B.cassetteDeck = function () {
    var g = new THREE.Group();
    g.add(box(0.18, 0.075, 0.11, M(0x14141a, 0.6, 0.2), 0, 0.038, 0));
    g.add(box(0.09, 0.05, 0.005, M(0x2a2a34, 0.4, 0.3), -0.04, 0.045, 0.056));
    g.add(box(0.075, 0.038, 0.004, M(0x3a2f24, 0.5), -0.04, 0.045, 0.059));
    g.add(box(0.03, 0.012, 0.002, M(0xc8342b, 0.5), -0.04, 0.045, 0.062));
    for (var i = 0; i < 2; i++) {
      g.add(cyl(0.011, 0.011, 0.004, 10, M(0xd9a441, 0.4, 0.5), 0.055, 0.055 - i * 0.03, 0.057));
    }
    for (var j = 0; j < 2; j++) g.add(box(0.02, 0.008, 0.004, M(0x555555, 0.6), 0.055, 0.02 + j * 0.012, 0.057));
    g.add(box(0.015, 0.03, 0.015, M(GOLD, 0.4, 0.6), 0.075, 0.09, -0.03));
    return g;
  };
  B.brickPhone = function () {
    var g = new THREE.Group();
    // The 大哥大's whole joke is the size: a long body, a stubby antenna
    // twice the length of the handset, and a number pad you could dial with
    // a thumb. Builders kept flattening it into a black slab.
    var case_ = M(0x24242a, 0.55), rubber = M(0x141418, 0.75);
    g.add(box(0.058, 0.185, 0.040, case_, 0, 0.098, 0));           // body
    g.add(box(0.060, 0.016, 0.042, rubber, 0, 0.012, 0));          // boot
    g.add(box(0.052, 0.030, 0.006, M(0x3a3a42, 0.5), 0, 0.176, 0.019)); // earpiece
    for (var h = 0; h < 5; h++) {
      g.add(box(0.0055, 0.004, 0.003, M(0x0d0d10, 0.6), -0.016 + h * 0.008, 0.180, 0.0225));
    }
    g.add(box(0.044, 0.032, 0.005, M(0x0e1418, 0.28), 0, 0.140, 0.0205));  // screen
    g.add(box(0.036, 0.024, 0.002, M(0x2a4a34, 0.20), 0, 0.140, 0.0230));  // LCD
    for (var r = 0; r < 4; r++) {                                   // keypad
      for (var c = 0; c < 3; c++) {
        g.add(box(0.0115, 0.0095, 0.0035, M(0x4a4a52, 0.55),
          -0.0155 + c * 0.0155, 0.104 - r * 0.0145, 0.0205));
      }
    }
    g.add(box(0.0075, 0.052, 0.0075, M(0x1a1a1e, 0.5), 0.027, 0.222, -0.012)); // stub antenna
    g.add(cyl(0.0050, 0.0050, 0.014, 8, M(0x3a3a40, 0.45), 0.027, 0.255, -0.012)); // tip
    return g;
  };
  B.redWhiteBlue = function () {
    var g = new THREE.Group();
    g.add(box(0.16, 0.14, 0.09, M(0xc8342b, 0.85), 0, 0.07, 0));
    g.add(box(0.161, 0.045, 0.091, M(0xf2f2f2, 0.85), 0, 0.098, 0));
    g.add(box(0.161, 0.045, 0.091, M(0x2f5c9f, 0.85), 0, 0.048, 0));
    for (var i = 0; i < 2; i++) {
      g.add(tor(0.018, 0.004, M(0xc8342b, 0.8), -0.045 + i * 0.09, 0.165, 0, Math.PI / 2));
    }
    return g;
  };
  B.mtrTicket = function () {
    var g = new THREE.Group();
    g.add(box(0.11, 0.004, 0.065, M(0xe8e4d8, 0.9), 0, 0.004, 0));
    g.add(box(0.10, 0.002, 0.055, plateTex(64, 40, function (c, w, h) {
      c.fillStyle = '#e8e4d8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c8342b'; c.fillRect(0, 0, w, 8);
      c.fillStyle = '#2a2a2a'; c.font = 'bold 7px monospace';
      c.fillText('MTR', 4, 16);
      for (var i = 0; i < 14; i++) c.fillRect(4 + i * 4, 28, (i % 3) + 1, 8);
    }), 0, 0.0055, 0));
    return g;
  };
  B.sharkFinBowl = function () {
    var g = new THREE.Group();
    /* The two chopsticks stood outside the bowl, so the whole thing read as a
     * basket. A 魚翅撈飯 is a bowl, a mound of rice, a fin standing up in it
     * and two chopsticks resting across the rim.
     */
    var porcelain = M(0xf4f0e6, 0.34), rim = M(0x1e4a7a, 0.30), rice = M(0xfbf8ee, 0.86);
    // bowl: a lathed profile rather than a cone, so it has a foot and a lip
    var prof = [];
    prof.push(new THREE.Vector2(0.030, 0.000));
    prof.push(new THREE.Vector2(0.034, 0.006));
    prof.push(new THREE.Vector2(0.052, 0.020));
    prof.push(new THREE.Vector2(0.072, 0.046));
    prof.push(new THREE.Vector2(0.078, 0.058));
    prof.push(new THREE.Vector2(0.074, 0.060));
    prof.push(new THREE.Vector2(0.066, 0.050));
    prof.push(new THREE.Vector2(0.046, 0.026));
    prof.push(new THREE.Vector2(0.030, 0.014));
    prof.push(new THREE.Vector2(0.000, 0.012));
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), smoothOf(porcelain));
    bowl.castShadow = bowl.receiveShadow = true;
    g.add(bowl);
    // the blue band every HK bowl had
    var band = cyl(0.0765, 0.0695, 0.010, 24, rim, 0, 0.0545, 0);
    g.add(band);
    // rice mound, sitting inside the rim
    var mound = sph(0.055, rice, 0, 0.046, 0, 18);
    mound.scale.set(1, 0.62, 1);
    g.add(mound);
    // the fin: a swept triangle, undercut so it reads as cartilage
    var finMat = M(0xc2a878, 0.55);
    var finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.030, 0.014);
    finShape.lineTo(0.038, 0.062);
    finShape.lineTo(0.016, 0.040);
    finShape.lineTo(0.002, 0.012);
    finShape.lineTo(0, 0);
    var fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, {
      depth: 0.010, bevelEnabled: true, bevelSize: 0.0018, bevelThickness: 0.0018,
      bevelSegments: 2, curveSegments: 2
    }), smoothOf(finMat));
    fin.position.set(-0.014, 0.050, -0.005);
    fin.rotation.y = 0.35;
    fin.castShadow = true;
    g.add(fin);
    // chopsticks resting across the rim, not standing in the air
    var stick = M(0x8a5a2a, 0.68);
    for (var i = 0; i < 2; i++) {
      var st = cyl(0.0032, 0.0042, 0.150, 8, stick, 0.004 + i * 0.011, 0.066, -0.012);
      st.rotation.z = Math.PI / 2 - 0.06;
      st.rotation.y = 0.42;
      g.add(st);
    }
    return g;
  };
  B.yukLong = function () {
    var g = new THREE.Group();
    // 玉郎漫畫 is a stapled booklet with a lurid cover, a spine and page
    // edges -- a flat plate reads as a poster, not an object on a table.
    var yellow = M(0xe8c84a, 0.82);
    g.add(box(0.150, 0.196, 0.009, yellow, 0, 0.098, 0));             // back cover
    g.add(box(0.144, 0.188, 0.011, M(0xf2ecd8, 0.9), 0, 0.094, 0));   // page block
    for (var p2 = 0; p2 < 9; p2++) {                                   // page edges
      g.add(box(0.142, 0.0012, 0.0118, M(0xe2dcc8 - p2 * 0x000101, 0.95),
        0, 0.006 + p2 * 0.0205, 0));
    }
    g.add(box(0.150, 0.196, 0.005, plateTex(128, 168, function (c, w, h) {
      c.fillStyle = '#e8c84a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c8342b'; c.fillRect(6, 6, w - 12, 44);
      c.fillStyle = '#f2e6d0'; c.font = 'bold 24px serif'; c.textAlign = 'center';
      c.fillText('小流氓', w / 2, 38);
      // a crude cover drawing: a figure and an explosion
      c.fillStyle = '#2a2a2a';
      c.beginPath(); c.arc(w * 0.34, 96, 15, 0, 7); c.fill();
      c.fillRect(w * 0.34 - 13, 110, 26, 34);
      c.fillStyle = '#e8862f';
      c.beginPath(); c.arc(w * 0.70, 104, 22, 0, 7); c.fill();
      c.fillStyle = '#f2e6d0';
      for (var k = 0; k < 8; k++) {
        var a = k * 0.785;
        c.beginPath(); c.arc(w * 0.70 + Math.cos(a) * 26, 104 + Math.sin(a) * 26, 4, 0, 7); c.fill();
      }
      c.fillStyle = '#c8342b'; c.font = 'bold 11px serif';
      c.fillText('第 88 期', w / 2, h - 10);
    }), 0, 0.100, 0.0075));                                            // front cover
    g.add(box(0.004, 0.196, 0.020, M(0xd8b83a, 0.8), -0.073, 0.098, 0.002)); // spine
    for (var s2 = 0; s2 < 2; s2++) {                                   // staples
      g.add(box(0.014, 0.0025, 0.0015, M(0xb0b0b8, 0.4, 0.7), -0.060, 0.052 + s2 * 0.092, 0.0095));
    }
    return g;
  };
  B.digitalWatch = function () {
    var g = new THREE.Group();
    /* A 電子錶 is a strap with a module clipped to it. The old builder put two
     * upright bars either side of the case, which read as a buckle, not a
     * wrist. Lay the strap flat and let the module sit proud of it.
     */
    var case_ = M(0x4a4a54, 0.36, 0.45), strap = M(0x39393f, 0.70), glass = M(0x1e2a20, 0.16);
    g.add(box(0.052, 0.034, 0.013, case_, 0, 0.017, 0));              // module body
    g.add(box(0.054, 0.004, 0.015, M(0xb8b8c0, 0.28, 0.75), 0, 0.0335, 0)); // chrome bezel
    g.add(box(0.040, 0.021, 0.003, glass, 0, 0.018, 0.0068));         // window
    g.add(box(0.030, 0.013, 0.0015, plateTex(64, 32, function (c, w, h) {
      c.fillStyle = '#0e2014'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7ee787'; c.font = 'bold 13px monospace'; c.textAlign = 'center';
      c.fillText('18:88', w / 2, 16);
      c.font = '7px monospace'; c.fillStyle = '#4a9a52';
      c.fillText('THU 8', w / 2, 27);
    }), 0, 0.018, 0.0078));
    g.add(box(0.012, 0.006, 0.004, M(0x3a3a44, 0.55), -0.016, 0.0065, 0.0068)); // button
    // a short strap keeps the module dominant; laid out long it read as a
    // stick with a lump on it, because the module is only 13 mm thick
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var len = 0.030;
      var st = box(0.026, 0.005, len, strap, 0, 0.012, s2 * (len / 2 + 0.014));
      st.rotation.x = s2 * 0.16;
      g.add(st);
      g.add(box(0.028, 0.0014, 0.0035, M(0x1a1a1e, 0.75),
        0, 0.0148, s2 * 0.020));                                       // keeper
    }
    return g;
  };

  // ═══ 1997 ═══
  B.kaiTakPlane = function () {
    var g = new THREE.Group();
    /* The old builder laid the fuselage along Y, so the aeroplane stood on its
     * tail like a chimney -- the single worst silhouette in the museum. A
     * plane has to be long, low and pointed, banking towards the rooftops.
     */
    var hull = M(0xe8e8ea, 0.45), wing = M(0xdcdce2, 0.5);
    var fus = cyl(0.030, 0.016, 0.20, 14, hull, 0, 0.0, 0);
    fus.rotation.x = Math.PI / 2;                 // lie the fuselage down
    fus.position.set(0, 0.062, -0.01);
    g.add(fus);
    var nose = sph(0.030, hull, 0, 0.062, 0.090, 14);
    nose.scale.set(1, 1, 1.25); g.add(nose);
    g.add(box(0.26, 0.007, 0.055, wing, 0, 0.060, 0.006));      // main wing
    var dih = box(0.26, 0.005, 0.030, wing, 0, 0.070, 0.030);
    dih.rotation.x = -0.12; g.add(dih);                          // wing box
    g.add(box(0.018, 0.010, 0.028, wing, -0.128, 0.058, 0.012)); // wingtip fins
    g.add(box(0.018, 0.010, 0.028, wing, 0.128, 0.058, 0.012));
    g.add(box(0.075, 0.042, 0.006, wing, 0, 0.092, -0.088));     // tail fin
    g.add(box(0.115, 0.006, 0.032, wing, 0, 0.062, -0.092));     // tailplane
    for (var s2 = -1; s2 <= 1; s2 += 2) {                        // engines
      var e = cyl(0.014, 0.014, 0.042, 12, M(0xb8b8c0, 0.45), s2 * 0.070, 0.046, 0.004);
      e.rotation.x = Math.PI / 2; g.add(e);
    }
    // the red cheatline that made 啟德 arrivals recognisable
    var stripe = cyl(0.0305, 0.0305, 0.115, 14, M(0xc8342b, 0.55), 0, 0.062, -0.052);
    stripe.rotation.x = Math.PI / 2; g.add(stripe);
    var stand = cyl(0.036, 0.044, 0.016, 16, M(0x2a2a30, 0.6), 0, 0.008, -0.01);
    g.add(stand);
    g.add(cyl(0.006, 0.006, 0.040, 8, M(0x8a8a92, 0.4, 0.5), 0, 0.032, -0.01));
    return g;
  };
  B.emigrationCase = function () {
    var g = new THREE.Group();
    g.add(box(0.15, 0.11, 0.09, M(0x5a3f28, 0.75), 0, 0.055, 0));
    g.add(box(0.152, 0.008, 0.092, M(0x3a2718, 0.75), 0, 0.10, 0));
    g.add(tor(0.035, 0.005, M(0x2a2a2a, 0.5, 0.4), 0, 0.128, 0, 0));
    g.add(box(0.03, 0.02, 0.008, M(GOLD, 0.4, 0.6), 0, 0.072, 0.047));
    g.add(box(0.02, 0.09, 0.002, M(0x8f2b24, 0.8), -0.03, 0.055, 0.048));
    g.add(box(0.02, 0.09, 0.002, M(0x2f5c9f, 0.8), 0.03, 0.055, 0.048));
    g.add(box(0.152, 0.014, 0.092, M(0x6b4a2f, 0.75), 0, 0.018, 0));
    return g;
  };
  B.karaokeCabinet = function () {
    var g = new THREE.Group();
    g.add(box(0.22, 0.20, 0.16, M(0x2a1a1a, 0.8), 0, 0.10, 0));
    g.add(box(0.135, 0.12, 0.008, M(0x0d0d12, 0.3), 0, 0.115, 0.082));
    g.add(box(0.125, 0.11, 0.004, M(0x3a2a5a, 0.3, 0.1), 0, 0.115, 0.087));
    g.add(box(0.10, 0.02, 0.002, M(0xff6bb6, 0.5), 0, 0.135, 0.090));
    g.add(box(0.06, 0.012, 0.002, M(0xd9a441, 0.5), 0, 0.105, 0.090));
    g.add(cyl(0.005, 0.005, 0.12, 6, M(0x8a8a8a, 0.4, 0.6), 0.085, 0.155, 0.075));
    g.add(sph(0.016, M(0x222228, 0.5), 0.085, 0.222, 0.075, 8));
    g.add(cyl(0.005, 0.005, 0.12, 6, M(0x8a8a8a, 0.4, 0.6), -0.085, 0.155, 0.075));
    g.add(sph(0.016, M(0x222228, 0.5), -0.085, 0.222, 0.075, 8));
    g.add(box(0.10, 0.02, 0.05, M(0x1a1a1a, 0.7), 0, 0.012, 0.06));
    return g;
  };
  B.arcadeToken = function () {
    var g = new THREE.Group();
    // A token reads by its edge, not its face: milled rim, raised inner
    // field so the light catches two rings, and a punched star.
    var brass = M(0xb8a04a, 0.34, 0.85);
    g.add(cyl(0.036, 0.036, 0.0075, 22, brass, 0, 0.00375, 0));
    g.add(tor(0.0338, 0.0022, M(0xd8c06a, 0.28, 0.9), 0, 0.0075, 0, Math.PI / 2));
    g.add(cyl(0.027, 0.027, 0.0012, 22, M(0x8a7020, 0.42, 0.75), 0, 0.0081, 0));
    g.add(tor(0.0205, 0.0016, M(0xd8c06a, 0.30, 0.88), 0, 0.0089, 0, Math.PI / 2));
    for (var i = 0; i < 26; i++) {                        // milled edge
      var a = i * Math.PI * 2 / 26;
      g.add(box(0.0016, 0.0060, 0.0016, M(0x9a8438, 0.45, 0.8),
        Math.cos(a) * 0.0354, 0.00375, Math.sin(a) * 0.0354));
    }
    for (var k = 0; k < 5; k++) {                         // punched star
      var sa = k * Math.PI * 2 / 5 - Math.PI / 2;
      g.add(box(0.0055, 0.0009, 0.0055, M(0x6b5618, 0.5, 0.7),
        Math.cos(sa) * 0.008, 0.0088, Math.sin(sa) * 0.008));
    }
    return g;
  };
  B.yesCard = function () {
    var g = new THREE.Group();
    g.add(box(0.08, 0.11, 0.004, M(0xffc814, 0.5), 0, 0.055, 0));
    g.add(box(0.07, 0.06, 0.002, plateTex(64, 56, function (c, w, h) {
      var i, g2;
      for (i = 0; i < 6; i++) {
        g2 = c.createLinearGradient(i * 12, 0, i * 12 + 12, h);
        g2.addColorStop(0, ['#ff6bb6', '#7ee787', '#5eb9ff', '#ffd166', '#ff6b5e', '#c9a2ff'][i]);
        g2.addColorStop(1, '#ffffff');
        c.fillStyle = g2; c.fillRect(i * 11, 0, 11, h);
      }
      c.fillStyle = 'rgba(0,0,0,.55)'; c.font = 'bold 10px sans-serif'; c.fillText('YES!', 4, h - 6);
    }), 0, 0.08, 0.003));
    g.add(box(0.08, 0.012, 0.001, M(0xff3d7f, 0.5), 0, 0.016, 0.003));
    return g;
  };
  B.tamagotchi = function () {
    var g = new THREE.Group();
    g.add(sph(0.045, M(0x50c8d8, 0.45), 0, 0.045, 0, 10));
    g.add(cyl(0.028, 0.028, 0.006, 12, M(0x1a1a1a, 0.3), 0, 0.045, 0.040));
    g.add(cyl(0.022, 0.022, 0.002, 12, M(0x9fdc7a, 0.4), 0, 0.049, 0.042));
    for (var i = 0; i < 3; i++) {
      g.add(sph(0.006, M(0xf2f2f2, 0.5), -0.015 + i * 0.015, 0.02, 0.042, 6));
    }
    g.add(tor(0.012, 0.004, M(0x8a8a8a, 0.4, 0.5), 0, 0.09, 0, Math.PI / 2));
    return g;
  };
  B.pager = function () {
    var g = new THREE.Group();
    // The beeper is a clip-on box with a screen on one end, not a remote
    // control: the clip is the silhouette that identifies it.
    /* A near-black beeper against a near-black backdrop has no silhouette.
     * The 1990s case was charcoal with a lighter faceplate, and that two-tone
     * edge is what makes it read as an object rather than a smudge.
     */
    g.add(box(0.048, 0.030, 0.084, M(0x3c3c46, 0.44), 0, 0.015, 0));          // body
    g.add(box(0.042, 0.004, 0.070, M(0x585864, 0.40, 0.15), 0, 0.0305, 0.002)); // faceplate
    g.add(box(0.048, 0.006, 0.086, M(0x2a2a34, 0.55), 0, 0.033, 0));          // top shell
    g.add(box(0.034, 0.005, 0.026, M(0x16161c, 0.35), 0, 0.0355, 0.024));     // bezel
    g.add(box(0.030, 0.002, 0.018, plateTex(64, 40, function (c, w, h) {
      c.fillStyle = '#0d1a0d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#6fdc7a'; c.font = 'bold 13px monospace'; c.textAlign = 'center';
      c.fillText('998', w / 2, 16);
      c.font = '7px monospace'; c.fillStyle = '#4a9a52';
      c.fillText('CALL', w / 2, 30);
    }), 0, 0.0378, 0.024));                                                  // LCD
    g.add(box(0.010, 0.004, 0.004, M(0x8a8a96, 0.45, 0.20), -0.012, 0.0355, 0.044)); // button
    g.add(box(0.046, 0.040, 0.006, M(0x4a4a56, 0.50), 0, 0.018, -0.044));      // clip back
    g.add(box(0.046, 0.008, 0.030, M(0x4a4a56, 0.50), 0, 0.040, -0.030));      // clip arm
    return g;
  };
  B.octopus = function () {
    var g = new THREE.Group();
    g.add(box(0.085, 0.054, 0.002, M(0x2f6b8f, 0.5), 0, 0.027, 0));
    g.add(box(0.03, 0.03, 0.001, M(0xd9a441, 0.4, 0.5), 0.022, 0.032, 0.0015));
    g.add(cyl(0.012, 0.012, 0.001, 10, M(0xf2f2f2, 0.4), 0.022, 0.032, 0.0025));
    g.add(box(0.02, 0.001, 0.001, M(0x2a2a2a, 0.6), 0.022, 0.032, 0.0035));
    return g;
  };
  B.cantoTape = function () {
    var g = new THREE.Group();
    g.add(box(0.10, 0.065, 0.014, M(0x1a1a1e, 0.6), 0, 0.033, 0));
    g.add(box(0.088, 0.05, 0.005, plateTex(64, 40, function (c, w, h) {
      c.fillStyle = '#c8342b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2e6d0'; c.font = 'bold 9px serif';
      c.fillText('四大天王', 4, 14);
      c.font = '7px serif'; c.fillText('A 面', 4, 28);
    }), 0, 0.038, 0.008));
    for (var i = 0; i < 2; i++) {
      g.add(cyl(0.014, 0.014, 0.002, 10, M(0xd9a441, 0.4, 0.5), -0.02 + i * 0.04, 0.033, 0.008));
    }
    return g;
  };

  // ═══ 2003 ═══
  B.starFerryClock = function () {
    var g = new THREE.Group();
    /* The old one was a stack of two cubes -- a chair, not a tower. The
     * 尖沙咀 clock tower is tapered, has a clock on every face, and was the
     * thing everyone used to meet under, so the dials are the point.
     */
    var stone = M(0xe6ddc6, 0.82), stoneDark = M(0xd2c8ae, 0.85);
    g.add(box(0.112, 0.014, 0.112, stoneDark, 0, 0.007, 0));          // plinth
    g.add(box(0.096, 0.020, 0.096, stone, 0, 0.024, 0));             // base moulding
    g.add(box(0.084, 0.116, 0.084, stone, 0, 0.092, 0));             // shaft
    g.add(box(0.070, 0.030, 0.070, stoneDark, 0, 0.165, 0));          // string course
    g.add(box(0.062, 0.020, 0.062, stone, 0, 0.190, 0));             // gallery
    // four clock faces, each a disc with hands, on every side
    for (var f = 0; f < 4; f++) {
      var a = f * Math.PI / 2;
      var face = cyl(0.026, 0.026, 0.004, 18, M(0xf6f2e6, 0.5), Math.sin(a) * 0.031, 0.190, Math.cos(a) * 0.031);
      face.rotation.x = Math.PI / 2;
      face.rotation.z = -a;
      g.add(face);
      g.add(box(0.0015, 0.014, 0.002, M(0x1a1a1a, 0.5),
        Math.sin(a) * 0.0334, 0.196, Math.cos(a) * 0.0334));
      g.add(box(0.010, 0.0015, 0.002, M(0x1a1a1a, 0.5),
        Math.sin(a) * 0.0334, 0.190, Math.cos(a) * 0.0334));
    }
    // the copper cupola and its finial
    g.add(cone(0.046, 0.040, 8, M(0x3f7a52, 0.55, 0.35), 0, 0.222, 0));
    g.add(cyl(0.004, 0.004, 0.020, 8, M(0xb8a04a, 0.4, 0.7), 0, 0.252, 0));
    g.add(sph(0.0055, M(0xb8a04a, 0.35, 0.8), 0, 0.264, 0, 10));
    // corner brackets, so the shaft reads as stone rather than a box
    for (var c2 = 0; c2 < 4; c2++) {
      var ca = c2 * Math.PI / 2 + Math.PI / 4;
      g.add(box(0.012, 0.100, 0.012, stoneDark,
        Math.sin(ca) * 0.036, 0.092, Math.cos(ca) * 0.036));
    }
    return g;
  };
  B.disneyCastle = function () {
    var g = new THREE.Group();
    g.add(box(0.19, 0.08, 0.12, M(0xf0e8e0, 0.7), 0, 0.04, 0));
    var cols = [0x5eb9ff, 0x7ee787, 0xffd166, 0xff6bb6];
    for (var i = 0; i < 4; i++) {
      var x = -0.065 + i * 0.043;
      g.add(cyl(0.018, 0.018, 0.09, 8, M(0xf0e8e0, 0.7), x, 0.115, 0));
      g.add(cone(0.024, 0.06, 8, M(cols[i], 0.5), x, 0.19, 0));
    }
    g.add(cyl(0.012, 0.012, 0.13, 8, M(0xf0e8e0, 0.7), 0, 0.14, 0));
    g.add(cone(0.017, 0.05, 8, M(0xc8342b, 0.5), 0, 0.23, 0));
    g.add(box(0.03, 0.045, 0.002, M(0x3a2a1a, 0.7), 0, 0.025, 0.061));
    return g;
  };
  B.internetCafePc = function () {
    var g = new THREE.Group();
    g.add(box(0.14, 0.006, 0.10, M(0x3a3a40, 0.7), 0, 0.003, 0));
    g.add(box(0.03, 0.16, 0.03, M(0x2a2a30, 0.7), 0, 0.085, -0.03));
    g.add(box(0.15, 0.10, 0.005, M(0x1a1a20, 0.5), 0, 0.10, -0.02));
    g.add(box(0.135, 0.088, 0.002, M(0x1d3a5c, 0.3, 0.1), 0, 0.10, -0.016));
    g.add(box(0.13, 0.02, 0.001, M(0x7ee787, 0.5), 0, 0.115, -0.014));
    g.add(box(0.04, 0.005, 0.12, M(0x2a2a30, 0.7), 0, 0.018, 0.03));
    g.add(box(0.10, 0.015, 0.035, M(0x1a1a20, 0.6), 0, 0.012, -0.02));
    return g;
  };
  B.mask = function () {
    var g = new THREE.Group();
    // A surgical mask is a stack of pleats, not a block: alternating strips
    // with a slight offset is what makes it read at thumbnail size.
    var cloth = M(0xeaf2f7, 0.88), shade = M(0xd6e2ea, 0.88);
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      g.add(box(0.082 - t * 0.010, 0.0125, 0.022 + t * 0.004,
        i % 2 ? shade : cloth, 0, 0.0075 + i * 0.0125, -t * 0.002));
    }
    g.add(box(0.080, 0.0035, 0.024, M(0xc2d2dc, 0.9), 0, 0.0500, -0.002));   // top hem
    g.add(box(0.070, 0.0022, 0.0028, M(0xb0bcc4, 0.5, 0.2), 0, 0.0350, 0.0125)); // nose wire
    for (var s2 = -1; s2 <= 1; s2 += 2) {                                     // ear loops
      var loop = tor(0.019, 0.0016, M(0xe4e9ec, 0.9), s2 * 0.042, 0.029, -0.004, 0);
      loop.rotation.y = s2 * 0.55;
      g.add(loop);
    }
    return g;
  };
  B.flipPhone = function () {
    var g = new THREE.Group();
    g.add(box(0.05, 0.09, 0.014, M(0x9aa0a8, 0.45, 0.5), 0, 0.085, 0));
    g.add(box(0.042, 0.03, 0.003, M(0x1d3a5c, 0.2), 0, 0.095, 0.009));
    g.add(box(0.05, 0.06, 0.014, M(0x9aa0a8, 0.45, 0.5), 0, 0.032, 0.008));
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
      g.add(box(0.008, 0.004, 0.002, M(0x3a3a40, 0.6), -0.014 + i * 0.014, 0.045 - j * 0.011, 0.016));
    return g;
  };
  B.mp3Player = function () {
    var g = new THREE.Group();
    g.add(box(0.045, 0.085, 0.012, M(0xf0f0f2, 0.5), 0, 0.042, 0));
    g.add(box(0.032, 0.03, 0.002, M(0x2a2a30, 0.3), 0, 0.058, 0.007));
    g.add(cyl(0.012, 0.012, 0.002, 12, M(0x8a8a90, 0.5), 0, 0.028, 0.007));
    g.add(cyl(0.002, 0.002, 0.11, 6, M(0xf2f2f2, 0.6), 0, 0.14, 0));
    g.add(cyl(0.003, 0.003, 0.02, 6, M(0x3a3a40, 0.6), 0, 0.09, 0));
    return g;
  };
  B.weddingCard = function () {
    var g = new THREE.Group();
    g.add(box(0.11, 0.15, 0.006, M(0xc8342b, 0.6), 0, 0.075, 0));
    g.add(box(0.10, 0.14, 0.002, plateTex(64, 80, function (c, w, h) {
      c.fillStyle = '#c8342b'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d9a441'; c.lineWidth = 2; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#f5d98a'; c.font = 'bold 28px serif'; c.fillText('囍', w / 2 - 15, 42);
      c.font = '7px serif'; c.fillText('聯婚之喜', w / 2 - 14, 58);
      c.fillStyle = '#d9a441'; c.fillRect(12, 66, w - 24, 1);
    }), 0, 0.075, 0.004));
    return g;
  };
  B.milkPowder = function () {
    var g = new THREE.Group();
    g.add(cyl(0.045, 0.045, 0.11, 12, M(0x1a4a8a, 0.6), 0, 0.055, 0));
    g.add(cyl(0.047, 0.047, 0.02, 12, M(0xd9a441, 0.5, 0.3), 0, 0.115, 0));
    g.add(cyl(0.048, 0.048, 0.06, 12, plateTex(64, 48, function (c, w, h) {
      c.fillStyle = '#1a4a8a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.font = 'bold 9px sans-serif'; c.fillText('奶粉', 6, 20);
      c.fillStyle = '#ffd166'; c.beginPath(); c.arc(32, 36, 9, 0, 7); c.fill();
    }), 0, 0.06, 0));
    return g;
  };
  B.eDictionary = function () {
    var g = new THREE.Group();
    g.add(box(0.075, 0.11, 0.016, M(0x2a3a5a, 0.55), 0, 0.055, 0));
    g.add(box(0.062, 0.045, 0.002, M(0x3d4a3a, 0.25), 0, 0.078, 0.009));
    g.add(box(0.05, 0.02, 0.001, plateTex(48, 20, function (c, w, h) {
      c.fillStyle = '#0f1f14'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7ee787'; c.font = 'bold 9px monospace'; c.fillText('香港', 4, 13);
    }), 0, 0.078, 0.0105));
    for (var i = 0; i < 4; i++) for (var j = 0; j < 3; j++)
      g.add(box(0.012, 0.006, 0.002, M(0x1a1a2a, 0.6), -0.021 + i * 0.014, 0.038 - j * 0.011, 0.009));
    return g;
  };

  // ═══ 2010 ═══
  B.clawMachine = function () {
    var g = new THREE.Group();
    g.add(box(0.17, 0.06, 0.14, M(0xff6bb6, 0.6), 0, 0.03, 0));
    for (var i = 0; i < 4; i++) {
      var x = i < 2 ? -0.075 : 0.075, z = i % 2 ? -0.06 : 0.06;
      g.add(box(0.008, 0.15, 0.008, M(0xf2e6d0, 0.6), x, 0.135, z));
    }
    g.add(box(0.17, 0.05, 0.14, M(0xffd166, 0.6), 0, 0.235, 0));
    var glass = new THREE.MeshStandardMaterial({
      color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.1, side: THREE.DoubleSide
    });
    g.add(box(0.15, 0.15, 0.12, glass, 0, 0.135, 0));
    for (var j = 0; j < 5; j++) {
      var cols = [0xff6bb6, 0x7ee787, 0x5eb9ff, 0xffd166, 0xc9a2ff];
      g.add(sph(0.022, M(cols[j], 0.7), -0.05 + (j % 3) * 0.045, 0.075, -0.03 + Math.floor(j / 3) * 0.05, 8));
    }
    g.add(box(0.006, 0.06, 0.006, M(0x9a9a9a, 0.4, 0.7), 0.02, 0.185, 0));
    g.add(cyl(0.005, 0.005, 0.03, 6, M(0x9a9a9a, 0.4, 0.7), 0.02, 0.165, 0));
    g.add(box(0.04, 0.014, 0.03, M(0x8f2b24, 0.5), 0, 0.265, 0.05));
    return g;
  };
  B.bubbleTeaSign = function () {
    var g = new THREE.Group();
    g.add(box(0.14, 0.22, 0.02, M(0x6b3a2a, 0.8), 0, 0.11, 0));
    g.add(box(0.125, 0.20, 0.002, plateTex(64, 96, function (c, w, h) {
      c.fillStyle = '#f5e8d0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#6b3a2a'; c.beginPath();
      c.roundRect ? c.roundRect(20, 12, 24, 34, 4) : c.rect(20, 12, 24, 34); c.fill();
      c.fillStyle = '#c9a2ff'; c.beginPath(); c.arc(28, 26, 3, 0, 7); c.fill();
      c.beginPath(); c.arc(36, 30, 3, 0, 7); c.fill();
      c.beginPath(); c.arc(32, 20, 3, 0, 7); c.fill();
      c.fillStyle = '#3a2a1a'; c.font = 'bold 11px serif'; c.fillText('珍奶', 20, 62);
      c.font = '8px serif'; c.fillText('半糖', 22, 76);
      c.fillText('少冰', 22, 88);
    }), 0, 0.11, 0.011));
    g.add(box(0.03, 0.02, 0.02, M(0x3a2a1a, 0.7), 0, 0.008, 0));
    return g;
  };
  B.lightStickBoard = function () {
    var g = new THREE.Group();
    g.add(box(0.20, 0.13, 0.008, M(0x1a1a1e, 0.6), 0, 0.085, 0));
    g.add(box(0.19, 0.12, 0.002, plateTex(96, 60, function (c, w, h) {
      var gr = c.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#ff6bb6'); gr.addColorStop(0.5, '#c9a2ff'); gr.addColorStop(1, '#5eb9ff');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 12px sans-serif';
      c.fillText('♥ 我愛你 ♥', 12, 26);
      c.font = '8px monospace'; c.fillStyle = 'rgba(255,255,255,.75)';
      c.fillText('SEOUL 2019', 26, 44);
    }), 0, 0.085, 0.006));
    g.add(box(0.03, 0.006, 0.006, M(0xd9a441, 0.4, 0.6), 0, 0.155, 0.03));
    return g;
  };
  B.smartphone = function () {
    var g = new THREE.Group();
    // A slab needs its bezel, its cam bump and a screen that is actually
    // doing something, or it is indistinguishable from a novelty card.
    g.add(box(0.052, 0.104, 0.009, M(0x1a1a1e, 0.35, 0.45), 0, 0.052, 0));
    g.add(box(0.0485, 0.0975, 0.0095, M(0x141418, 0.40, 0.40), 0, 0.052, 0));
    g.add(box(0.0435, 0.089, 0.0015, plateTex(96, 192, function (c, w, h) {
      var grd = c.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#12324f'); grd.addColorStop(1, '#2a6a8c');
      c.fillStyle = grd; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.72)';           // message bubbles
      c.fillRect(9, 26, 44, 11); c.fillRect(9, 42, 34, 11);
      c.fillStyle = 'rgba(126,231,135,.85)';
      c.fillRect(40, 62, 46, 11); c.fillRect(52, 78, 34, 11);
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(0, 0, w, 12); c.fillRect(0, h - 14, w, 14);
      c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center';
      c.fillText('6:42', w / 2, 9);
    }), 0, 0.052, 0.0052));
    g.add(box(0.0525, 0.0105, 0.0092, M(0x141418, 0.40, 0.40), 0, 0.0052, 0));  // chin
    g.add(box(0.014, 0.0016, 0.0022, M(0x2a2a30, 0.6), 0, 0.1025, 0.0048));    // earpiece
    g.add(box(0.013, 0.013, 0.0035, M(0x0e0e12, 0.35), -0.012, 0.096, -0.0056)); // cam bump
    g.add(sph(0.0038, M(0x1e2a3a, 0.12, 0.85), -0.012, 0.096, -0.0074, 12));     // lens
    return g;
  };
  B.taobaoParcel = function () {
    var g = new THREE.Group();
    g.add(box(0.16, 0.12, 0.12, M(0xc9a878, 0.9), 0, 0.06, 0));
    g.add(box(0.162, 0.02, 0.122, M(0xd8bc90, 0.9), 0, 0.06, 0));
    g.add(box(0.05, 0.001, 0.06, plateTex(48, 56, function (c, w, h) {
      c.fillStyle = '#f2ece0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2a2a2a'; c.font = '5px monospace';
      for (var i = 0; i < 8; i++) c.fillRect(3, 6 + i * 5, 16 + (i * 7) % 22, 1.2);
      c.fillStyle = '#8f2b24'; c.fillRect(34, 6, 10, 10);
    }), 0, 0.121, 0.03, 0));
    return g;
  };
  B.lightStick = function () {
    var g = new THREE.Group();
    // A concert light stick is mostly glow: the tube has to be a lit cylinder
    // and the handle has to read as something a hand holds.
    var glow = new THREE.MeshStandardMaterial({
      color: 0xff9fd4, emissive: 0xff4d9d, emissiveIntensity: 1.9,
      roughness: 0.35, transparent: true, opacity: 0.92
    });
    var glowSoft = new THREE.MeshStandardMaterial({
      color: 0xffc4e2, emissive: 0xff6fb2, emissiveIntensity: 0.9,
      roughness: 0.5, transparent: true, opacity: 0.34, depthWrite: false
    });
    g.add(cyl(0.0165, 0.0180, 0.085, 18, M(0x2a2a30, 0.55), 0, 0.0425, 0));  // grip
    for (var r = 0; r < 6; r++) {                                            // grip ribs
      g.add(tor(0.0172, 0.0011, M(0x3e3e46, 0.5), 0, 0.020 + r * 0.011, 0, Math.PI / 2));
    }
    g.add(cyl(0.0195, 0.0175, 0.012, 18, M(0x8a8a92, 0.35, 0.55), 0, 0.091, 0)); // collar
    g.add(cyl(0.0180, 0.0180, 0.078, 20, glow, 0, 0.136, 0));                 // lit tube
    g.add(cyl(0.0205, 0.0185, 0.075, 20, glowSoft, 0, 0.136, 0));             // halo
    g.add(cyl(0.0180, 0.0165, 0.010, 20, M(0xf2d6e8, 0.4), 0, 0.180, 0));     // cap
    g.add(cyl(0.0130, 0.0110, 0.006, 14, M(0x2a2a30, 0.6), 0, 0.006, 0));     // base
    return g;
  };
  B.sharedBike = function () {
    var g = new THREE.Group();
    for (var i = 0; i < 2; i++) {
      g.add(tor(0.045, 0.006, M(0x2a2a2e, 0.6), -0.06 + i * 0.12, 0.05, 0));
      g.add(cyl(0.004, 0.004, 0.10, 6, M(0x8a8a90, 0.4, 0.5), -0.06 + i * 0.12, 0.10, 0));
    }
    g.add(box(0.13, 0.008, 0.008, M(0xffd166, 0.5), 0, 0.10, 0));
    g.add(box(0.008, 0.05, 0.008, M(0xffd166, 0.5), 0.05, 0.075, 0));
    g.add(box(0.008, 0.06, 0.008, M(0xffd166, 0.5), -0.05, 0.08, 0));
    g.add(box(0.04, 0.012, 0.025, M(0x2a2a2e, 0.6), -0.04, 0.115, 0));
    g.add(box(0.03, 0.02, 0.02, M(0x333338, 0.6), 0.02, 0.125, 0));
    return g;
  };
  B.phoneOctopus = function () {
    var g = new THREE.Group();
    g.add(box(0.05, 0.10, 0.008, M(0x1a1a1e, 0.4, 0.4), 0, 0.05, 0));
    g.add(box(0.042, 0.086, 0.002, M(0x2f6b8f, 0.4), 0, 0.05, 0.0045));
    g.add(cyl(0.014, 0.014, 0.001, 12, M(0xd9a441, 0.4, 0.6), 0, 0.05, 0.0055));
    g.add(box(0.02, 0.004, 0.001, M(0xf2f2f2, 0.5), 0, 0.02, 0.0055));
    return g;
  };
  B.returnBox = function () {
    var g = new THREE.Group();
    g.add(box(0.14, 0.09, 0.11, M(0xc9a878, 0.9), 0, 0.045, 0));
    g.add(box(0.142, 0.09, 0.001, plateTex(56, 40, function (c, w, h) {
      c.fillStyle = '#e8dcc4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8f2b24'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(20, 14); c.lineTo(36, 14); c.lineTo(36, 30); c.stroke();
      c.beginPath(); c.moveTo(16, 14); c.lineTo(20, 14); c.lineTo(20, 30); c.lineTo(36, 30); c.stroke();
      c.fillStyle = '#8f2b24'; c.font = 'bold 6px monospace'; c.fillText('RETURN', 14, 38);
    }), 0, 0.045, 0.056));
    g.add(box(0.15, 0.015, 0.12, M(0xd8bc90, 0.9), 0, 0.095, 0));
    return g;
  };

  // ═══ 2020 ═══
  B.loengSungCounter = function () {
    var g = new THREE.Group();
    g.add(box(0.22, 0.09, 0.14, M(0x9aa0a8, 0.4, 0.6), 0, 0.045, 0));
    g.add(box(0.225, 0.05, 0.145, M(0xbfe8ff, 0.15), 0, 0.115, 0));
    var pans = [0xb8442c, 0x6b8f3a, 0xd9a441, 0x8f6b3a, 0xc86b3a, 0x5c7a3a];
    for (var i = 0; i < 6; i++) {
      g.add(box(0.062, 0.014, 0.055, M(0x9aa0a8, 0.35, 0.7), -0.072 + (i % 3) * 0.072, 0.098, -0.03 + Math.floor(i / 3) * 0.062));
      g.add(box(0.055, 0.008, 0.048, M(pans[i], 0.8), -0.072 + (i % 3) * 0.072, 0.103, -0.03 + Math.floor(i / 3) * 0.062));
    }
    g.add(box(0.20, 0.008, 0.012, M(0xffd166, 0.5), 0, 0.145, 0.05));
    g.add(box(0.008, 0.04, 0.008, M(0x8a8a90, 0.4, 0.5), -0.09, 0.17, 0.05));
    g.add(box(0.008, 0.04, 0.008, M(0x8a8a90, 0.4, 0.5), 0.09, 0.17, 0.05));
    return g;
  };
  B.deliveryBox = function () {
    var g = new THREE.Group();
    g.add(box(0.14, 0.14, 0.13, M(0x1a6b3a, 0.7), 0, 0.07, 0));
    g.add(box(0.142, 0.02, 0.132, M(0x2a8a4a, 0.7), 0, 0.145, 0));
    g.add(box(0.10, 0.05, 0.002, plateTex(64, 34, function (c, w, h) {
      c.fillStyle = '#1a6b3a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd166'; c.font = 'bold 12px sans-serif'; c.fillText('速遞', 8, 20);
      c.fillStyle = '#f2e6d0'; c.font = '7px sans-serif'; c.fillText('FOOD', 10, 30);
    }), 0, 0.075, 0.066));
    g.add(box(0.05, 0.008, 0.02, M(0x333333, 0.6), 0, 0.16, 0));
    return g;
  };
  B.voucherPoster = function () {
    var g = new THREE.Group();
    g.add(box(0.15, 0.21, 0.008, M(0xf2e6d0, 0.9), 0, 0.105, 0));
    g.add(box(0.135, 0.195, 0.002, plateTex(64, 88, function (c, w, h) {
      c.fillStyle = '#f2e6d0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8f2b24'; c.fillRect(0, 0, w, 20);
      c.fillStyle = '#f2e6d0'; c.font = 'bold 9px sans-serif'; c.fillText('消費券', 4, 14);
      c.fillStyle = '#2a2a2a'; c.font = 'bold 22px sans-serif'; c.fillText('$5000', 6, 48);
      c.fillStyle = '#6b6b6b'; c.font = '6px sans-serif';
      c.fillText('分兩期發放', 6, 60);
      c.fillStyle = '#d9a441'; c.fillRect(6, 66, w - 12, 3);
      c.fillStyle = '#8f2b24'; c.font = '6px sans-serif';
      c.fillText('登記日期 7 月', 6, 78);
    }), 0, 0.105, 0.005));
    g.add(box(0.03, 0.02, 0.02, M(0x3a3a40, 0.7), 0, 0.008, 0));
    return g;
  };
  B.mask2 = function () {
    var g = new THREE.Group();
    // Same object, a different colourway -- it is the 2020 one where the mask
    // stopped being white. Pleats again, so it is the same object family.
    var cloth = M(0x9fc9e8, 0.88), shade = M(0x8ab8da, 0.88);
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      g.add(box(0.082 - t * 0.010, 0.0125, 0.022 + t * 0.004,
        i % 2 ? shade : cloth, 0, 0.0075 + i * 0.0125, -t * 0.002));
    }
    g.add(box(0.080, 0.0035, 0.024, M(0x86b0d0, 0.9), 0, 0.0500, -0.002));
    g.add(box(0.070, 0.0022, 0.0028, M(0xb0bcc4, 0.5, 0.2), 0, 0.0350, 0.0125));
    // a colour print, which is the only thing that distinguishes this era
    g.add(box(0.030, 0.020, 0.0015, plateTex(48, 32, function (c, w, h) {
      c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
      c.fillStyle = '#f2e6d0';
      for (var p = 0; p < 4; p++) {
        c.beginPath(); c.arc(10 + p * 9, 12, 4.5, 0, 7); c.fill();
      }
      c.strokeStyle = '#c8342b'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(6, 22); c.lineTo(40, 22); c.stroke();
    }), 0, 0.0295, 0.0130));
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var loop = tor(0.019, 0.0016, M(0xe4e9ec, 0.9), s2 * 0.042, 0.029, -0.004, 0);
      loop.rotation.y = s2 * 0.55;
      g.add(loop);
    }
    return g;
  };
  B.ratTest = function () {
    var g = new THREE.Group();
    // A reagent strip in its cassette: white body, the sample well, and the
    // two windows the result appears in. A plain bar reads as a stick.
    g.add(box(0.104, 0.014, 0.028, M(0xf4f4f6, 0.82), 0, 0.007, 0));
    g.add(box(0.104, 0.003, 0.030, M(0xe2e2e6, 0.85), 0, 0.0155, 0));         // lid
    g.add(cyl(0.0055, 0.0055, 0.004, 14, M(0xd0d0d8, 0.7), -0.030, 0.0175, 0)); // sample well
    g.add(box(0.010, 0.002, 0.009, M(0xc8342b, 0.45), 0.020, 0.0176, 0));      // C line
    g.add(box(0.010, 0.002, 0.009, M(0xd0d0d8, 0.6), 0.020, 0.0176, 0.012));   // T window (blank)
    g.add(box(0.100, 0.012, 0.0015, plateTex(96, 14, function (c, w, h) {
      c.fillStyle = '#f4f4f6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8a8a92'; c.font = 'bold 7px sans-serif';
      c.fillText('COVID-19 Ag', 4, 10);
      c.fillStyle = '#c8342b'; c.fillRect(w - 26, 4, 20, 2);
      c.fillRect(w - 26, 8, 13, 2);
    }), 0, 0.007, 0.0145));
    return g;
  };
  B.homeReturnCard = function () {
    var g = new THREE.Group();
    g.add(box(0.10, 0.065, 0.002, M(0x2a5a3a, 0.6), 0, 0.033, 0));
    g.add(box(0.09, 0.055, 0.001, plateTex(64, 40, function (c, w, h) {
      c.fillStyle = '#2a5a3a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d9a441'; c.fillRect(0, 0, w, 6);
      c.fillStyle = '#f2e6d0'; c.font = 'bold 7px sans-serif'; c.fillText('回鄉證', 4, 16);
      c.fillStyle = '#7ee787'; c.fillRect(4, 22, 20, 12);
      c.fillStyle = '#c8d8c8'; c.font = '4px monospace';
      for (var i = 0; i < 4; i++) c.fillRect(28, 24 + i * 3, 26 + (i * 5) % 8, 1);
    }), 0, 0.033, 0.0015));
    return g;
  };
  B.rubbishBag = function () {
    var g = new THREE.Group();
    var bag = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), M(0x5eb9ff, 0.75));
    bag.position.y = 0.055; bag.scale.y = 1.3;
    bag.castShadow = true;
    g.add(bag);
    g.add(tor(0.022, 0.005, M(0x3a8abf, 0.75), 0, 0.135, 0, Math.PI / 2));
    g.add(box(0.03, 0.03, 0.001, M(0xf2f2f2, 0.8), 0, 0.07, 0.058));
    return g;
  };
  B.bubbleCup = function () {
    var g = new THREE.Group();
    g.add(cyl(0.042, 0.032, 0.11, 12, M(0xe8dcc4, 0.3), 0, 0.055, 0));
    g.add(cyl(0.044, 0.044, 0.006, 12, M(0xf2ece0, 0.25), 0, 0.115, 0));
    g.add(cyl(0.008, 0.008, 0.13, 6, M(0xc8342b, 0.5), 0.008, 0.16, 0));
    for (var i = 0; i < 4; i++) {
      g.add(sph(0.008, M(0x3a2a1a, 0.6), -0.012 + (i % 2) * 0.024, 0.02 + i * 0.006, 0.005, 6));
    }
    return g;
  };
  B.onlineLessonHeadset = function () {
    var g = new THREE.Group();
    g.add(tor(0.055, 0.008, M(0x2a2a30, 0.6), 0, 0.09, 0, Math.PI / 2.6));
    g.add(cyl(0.024, 0.024, 0.02, 12, M(0x1a1a20, 0.6), -0.058, 0.075, 0));
    g.add(cyl(0.024, 0.024, 0.02, 12, M(0x1a1a20, 0.6), 0.058, 0.075, 0));
    g.add(cyl(0.005, 0.005, 0.05, 6, M(0x2a2a30, 0.6), -0.058, 0.045, 0.02));
    g.add(box(0.03, 0.005, 0.03, M(0x2a2a30, 0.6), -0.058, 0.022, 0.035));
    return g;
  };

  // ═══ 2026 ═══
  B.northboundCase = function () {
    var g = new THREE.Group();
    g.add(box(0.13, 0.17, 0.08, M(0x2a3a5a, 0.6), 0, 0.085, 0));
    g.add(box(0.132, 0.018, 0.082, M(0x1a2a44, 0.6), 0, 0.15, 0));
    g.add(box(0.006, 0.10, 0.006, M(0x8a8a90, 0.4, 0.6), 0.07, 0.10, 0));
    for (var i = 0; i < 2; i++) g.add(cyl(0.014, 0.014, 0.02, 8, M(0x1a1a1e, 0.7), -0.04 + i * 0.08, 0.008, 0.03));
    // stripe: a nod to red-white-blue
    g.add(box(0.134, 0.03, 0.084, M(0xc8342b, 0.8), 0, 0.108, 0));
    g.add(box(0.134, 0.012, 0.084, M(0xf2f2f2, 0.8), 0, 0.108, 0));
    return g;
  };
  B.concertBoard = function () {
    var g = new THREE.Group();
    g.add(box(0.16, 0.20, 0.008, M(0x14141a, 0.6), 0, 0.10, 0));
    g.add(box(0.15, 0.19, 0.002, plateTex(80, 96, function (c, w, h) {
      var gr = c.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h * 0.4, w * 0.7);
      gr.addColorStop(0, '#ffd166'); gr.addColorStop(0.55, '#ff6bb6'); gr.addColorStop(1, '#2a1a3a');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.95)'; c.font = 'bold 11px sans-serif';
      c.fillText('演唱會', 14, 40);
      c.font = '8px sans-serif'; c.fillText('2026', 26, 56);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '6px monospace';
      c.fillText('ALL SOLD OUT', 12, 74);
    }), 0, 0.10, 0.005));
    g.add(box(0.03, 0.006, 0.006, M(0xd9a441, 0.4, 0.6), 0, 0.21, 0.02));
    return g;
  };
  B.paymentTerminal = function () {
    var g = new THREE.Group();
    g.add(box(0.075, 0.10, 0.06, M(0x1e1e22, 0.5), 0, 0.07, -0.01));
    g.add(box(0.062, 0.045, 0.002, M(0x2a3a4a, 0.2), 0, 0.095, 0.021));
    g.add(box(0.05, 0.012, 0.001, plateTex(64, 16, function (c, w, h) {
      c.fillStyle = '#0a1218'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#5eb9ff'; c.font = 'bold 7px monospace'; c.fillText('$ 35.0', 8, 11);
    }), 0, 0.098, 0.0225));
    g.add(box(0.05, 0.02, 0.001, M(0xe8eef2, 0.3), 0, 0.062, 0.021));
    g.add(box(0.04, 0.006, 0.03, M(0x2a2a2e, 0.6), 0, 0.012, 0.02));
    g.add(box(0.02, 0.02, 0.03, M(0x333338, 0.5), 0, 0.115, -0.03));
    return g;
  };
  B.aiBot = function () {
    var g = new THREE.Group();
    g.add(sph(0.055, M(0xf2f2f4, 0.45), 0, 0.075, 0, 12));
    g.add(box(0.05, 0.022, 0.012, M(0x1a1a1e, 0.3), 0, 0.082, 0.048));
    g.add(box(0.010, 0.010, 0.004, M(0x5eb9ff, 0.3), -0.012, 0.083, 0.055));
    g.add(box(0.010, 0.010, 0.004, M(0x5eb9ff, 0.3), 0.012, 0.083, 0.055));
    g.add(cyl(0.012, 0.012, 0.045, 8, M(0xd8d8dc, 0.4, 0.3), 0, 0.135, 0));
    g.add(cyl(0.008, 0.008, 0.03, 8, M(0x5eb9ff, 0.4), 0, 0.03, 0));
    g.add(cyl(0.03, 0.036, 0.012, 10, M(0xd8d8dc, 0.4, 0.3), 0, 0.012, 0));
    return g;
  };
  B.taobaoBox = function () {
    var g = new THREE.Group();
    g.add(box(0.17, 0.13, 0.13, M(0xc9a878, 0.9), 0, 0.065, 0));
    g.add(box(0.172, 0.02, 0.132, M(0x8f6b3a, 0.9), 0, 0.065, 0));
    g.add(box(0.06, 0.002, 0.07, plateTex(48, 52, function (c, w, h) {
      c.fillStyle = '#f2ece0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff6b1a'; c.fillRect(0, 0, w, 8);
      c.fillStyle = '#ffffff'; c.font = 'bold 5px sans-serif'; c.fillText('淘寶', 3, 6);
      c.fillStyle = '#2a2a2a'; c.font = '4px monospace';
      for (var i = 0; i < 9; i++) c.fillRect(3, 12 + i * 4, 14 + (i * 9) % 24, 1);
    }), 0, 0.131, 0.03));
    return g;
  };
  B.loengSungBag = function () {
    var g = new THREE.Group();
    g.add(box(0.10, 0.14, 0.06, M(0xf2e6d0, 0.85), 0, 0.07, 0));
    g.add(box(0.101, 0.04, 0.061, M(0x8f2b24, 0.8), 0, 0.10, 0));
    g.add(tor(0.022, 0.004, M(0xf2e6d0, 0.85), -0.028, 0.155, 0, 0));
    g.add(tor(0.022, 0.004, M(0xf2e6d0, 0.85), 0.028, 0.155, 0, 0));
    g.add(box(0.07, 0.03, 0.002, M(0xd9a441, 0.8), 0, 0.055, 0.031));
    return g;
  };
  B.concertStub = function () {
    var g = new THREE.Group();
    g.add(box(0.11, 0.055, 0.002, M(0x2a1a3a, 0.7), 0, 0.028, 0));
    g.add(box(0.10, 0.048, 0.001, plateTex(64, 30, function (c, w, h) {
      c.fillStyle = '#2a1a3a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff6bb6'; c.font = 'bold 7px sans-serif'; c.fillText('ADMIT ONE', 4, 12);
      c.fillStyle = '#ffd166'; c.font = '5px monospace'; c.fillText('A12  38', 4, 22);
      c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(46, 4, 12, h - 8);
    }), 0, 0.028, 0.0015));
    return g;
  };
  B.massageVoucher = function () {
    var g = new THREE.Group();
    g.add(box(0.10, 0.06, 0.002, M(0xf2e6d0, 0.9), 0, 0.03, 0));
    g.add(box(0.09, 0.05, 0.001, plateTex(64, 36, function (c, w, h) {
      c.fillStyle = '#f2e6d0'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d9a441'; c.lineWidth = 1; c.strokeRect(2, 2, w - 4, h - 4);
      c.fillStyle = '#8f2b24'; c.font = 'bold 8px sans-serif'; c.fillText('按摩券', 8, 16);
      c.fillStyle = '#6b6b6b'; c.font = '5px sans-serif'; c.fillText('兩小時 · 一百蚊', 8, 26);
    }), 0, 0.03, 0.0015));
    return g;
  };
  B.oldOctopus = function () {
    var g = new THREE.Group();
    g.add(box(0.085, 0.054, 0.002, M(0xd8c9a8, 0.8), 0, 0.027, 0));
    g.add(box(0.024, 0.028, 0.001, M(0xa89878, 0.8), -0.02, 0.03, 0.0015));
    g.add(cyl(0.012, 0.012, 0.001, 10, M(0xd9a441, 0.4, 0.5), 0.022, 0.032, 0.002));
    g.add(box(0.03, 0.006, 0.001, M(0x8a7a5a, 0.8), 0.022, 0.015, 0.002));
    return g;
  };

  R.PROP_BUILD = B;

  // ── scene ──────────────────────────────────────────────────────────────
  var scene, renderer, camera, cabinetGroup, trayGroup;
  var tableMeshes = {}, plateMeshes = {};
  var coinMeshes = [], fallMeshes = [], propMeshes = new Map();
  var coinGeo, propRoot = new THREE.Group();

  function makeCoinMesh() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(coinGeo, COIN_MAT);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(COIN_R * 0.92, COIN_R * 0.10, 5, 14), COIN_EDGE);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = COIN_R * 0.44;
    g.add(rim);
    return g;
  }

  /* The arcade is dark; without a floor and a back wall the portrait view is a
   40% void above and below the cabinet. A dim tiled floor + wall vignette turns
   that void into a room the machine stands in. */
var roomGroup = null;
  var envMap = null;
function buildRoom() {
  roomGroup = new THREE.Group();
  roomGroup.name = 'room';

  var floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.92, metalness: 0.04 });
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.42;
  roomGroup.add(floor);

  // Faint tile seams so the floor reads as tiling, not as a flat void.
  var seamMat = new THREE.MeshStandardMaterial({ color: 0x0e0b09, roughness: 1.0, metalness: 0.0 });
  for (var i = -4; i <= 4; i++) {
    var sx = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 9), seamMat);
    sx.rotation.x = -Math.PI / 2;
    sx.position.set(i * 0.55, -0.418, 0);
    roomGroup.add(sx);
    var sz = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.012), seamMat);
    sz.rotation.x = -Math.PI / 2;
    sz.position.set(0, -0.418, i * 0.55);
    roomGroup.add(sz);
  }

  /* Portrait leaves a tall band above the cabinet. A floor running to a far
   wall reads as an empty warehouse there; what fills it is the rest of the
   arcade -- the shop behind this one. A nearer back wall with a roller shutter,
   a hanging sign and two pendant lamps turn that band into a street. */
  var wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.95, metalness: 0.02 });
  var wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), wallMat);
  wall.position.set(0, 1.6, -1.55);
  roomGroup.add(wall);

  /* Everything below sits in the band between the machine's header and the
   HUD. It has to stay under the HUD's contrast or the top of a portrait screen
   turns into clutter behind the title: dark values, no small text, no bright
   emitters pointed at the eye. */
  var slatMat = new THREE.MeshStandardMaterial({ color: 0x1f1915, roughness: 0.75, metalness: 0.22 });
  for (var sIdx = 0; sIdx < 12; sIdx++) {
    var sl = new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.050, 0.012), slatMat);
    sl.position.set(0, 0.02 + sIdx * 0.058, -1.53);
    roomGroup.add(sl);
  }
  var shutterFrame = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.72, 0.018), M(0x100c08, 0.9));
  shutterFrame.position.set(0, 0.34, -1.545);
  roomGroup.add(shutterFrame);

  // One pendant lamp off to the side, well below the HUD band. Two symmetric
  // lamps read as a designed fixture; one reads as a shop that has been there
  // for years and never quite matched its fittings.
  // The lamp hangs tight under the header, in the gap between the title and the
  // cabinet top. Any higher and a portrait screen crops its cord, which reads
  // as a floating cone rather than a fixture.
  var lampX = -0.60;
  var cordTop = 0.62, cordLen = 0.16;
  var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, cordLen, 6), M(0x0c0906, 1.0));
  cord.position.set(lampX, cordTop - cordLen / 2, -1.02);
  roomGroup.add(cord);
  var shadeY = cordTop - cordLen;
  var shade = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.076, 14, 1, true), M(0x4e3c22, 0.6, 0.4));
  shade.position.set(lampX, shadeY - 0.038, -1.02);
  roomGroup.add(shade);
  var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb057, emissiveIntensity: 1.4 }));
  bulb.position.set(lampX, shadeY - 0.062, -1.02);
  roomGroup.add(bulb);
  var glow = new THREE.PointLight(0xffb057, 0.26, 1.3, 2);
  glow.position.set(lampX, shadeY - 0.08, -1.02);
  roomGroup.add(glow);

  // A hand-painted shop sign on the shutter, small and dim. It is the detail
  // that says "this is a shop", and it is deliberately too small to read at a
  // glance -- a portrait screen should not hand you a second title to parse.
  var signTex = tex(256, 64, function (c, w, h) {
    c.fillStyle = '#0d0a07'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6b5024'; c.font = 'bold 22px "Noto Sans HK",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('通宵營業', w / 2, h / 2 + 1);
  });
  var sign = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.075),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, opacity: 0.55 }));
  // Sat left of the cabinet and low on the shutter: the top-centre band is
  // where the coin counter lives, and a second piece of text there reads as
  // leftover pixels rather than as a shop sign.
  sign.position.set(-1.28, 0.17, -1.52);
  roomGroup.add(sign);

  // A single warm spill from the machine's own lighting, painted on the floor.
  var spillTex = tex(128, 128, function (c, w, h) {
    var g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.30)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  var spillMat = new THREE.MeshBasicMaterial({
    color: 0xffb057, map: spillTex, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  var spill = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, -0.415, 0.30);
  roomGroup.add(spill);

  scene.add(roomGroup);
  return roomGroup;
}

  /* Metals need something to reflect. With no environment map a gold coin at
   metalness 0.85 has nothing to sample and renders as flat mud, which is
   exactly what the first build looked like. This paints a tiny equirect room
   (warm ceiling lamp, dark floor, one cool side bounce) and feeds it through
   PMREM so every metal in the scene picks up a believable gradient. */
  function buildEnvironment() {
    var W = 256, H = 128;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    var sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0.00, '#2a2016');
    sky.addColorStop(0.40, '#5a4630');
    sky.addColorStop(0.52, '#241a12');
    sky.addColorStop(1.00, '#0a0806');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    var lamp = x.createRadialGradient(W * 0.30, H * 0.26, 2, W * 0.30, H * 0.26, W * 0.34);
    lamp.addColorStop(0, 'rgba(255,238,205,1)');
    lamp.addColorStop(0.35, 'rgba(255,190,110,0.55)');
    lamp.addColorStop(1, 'rgba(255,170,80,0)');
    x.fillStyle = lamp; x.fillRect(0, 0, W, H);
    var cool = x.createRadialGradient(W * 0.82, H * 0.55, 2, W * 0.82, H * 0.55, W * 0.26);
    cool.addColorStop(0, 'rgba(150,190,255,0.42)');
    cool.addColorStop(1, 'rgba(120,160,230,0)');
    x.fillStyle = cool; x.fillRect(0, 0, W, H);

    var et = new THREE.CanvasTexture(c);
    et.mapping = THREE.EquirectangularReflectionMapping;
    et.colorSpace = THREE.SRGBColorSpace;
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var env = pmrem.fromEquirectangular(et).texture;
    et.dispose();
    pmrem.dispose();
    return env;
  }

  // A soft warm ellipse painted just behind the deck, so the coin pile is lit
  // from behind and reads as a cluster rather than as scattered dots.
  function deckBacklight() {
    var d = G.Sim.DECK;
    var t = tex(128, 128, function (c, w, h) {
      var gr = c.createRadialGradient(w / 2, h * 0.55, 2, w / 2, h * 0.55, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.22)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    var mat = new THREE.MeshBasicMaterial({
      color: 0xff9a3c, map: t, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.62), mat);
    plane.position.set(0, d.y + 0.02, d.table.z0 - 0.004);
    scene.add(plane);
    return plane;
  }

R.init = function (canvas) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a08);
    scene.fog = new THREE.Fog(0x0b0a08, 2.2, 4.4);
    envMap = buildEnvironment();
    scene.environment = envMap;
    scene.environmentIntensity = 0.55;

    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 12);
    placeCamera(1);

    // lights: one warm key, one cool fill, a low rim from the tray
    var key = new THREE.DirectionalLight(0xfff0d8, 2.0);
    key.position.set(-0.7, 1.6, 1.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.1; key.shadow.camera.right = 1.1;
    key.shadow.camera.top = 1.1; key.shadow.camera.bottom = -1.1;
    key.shadow.camera.near = 0.1; key.shadow.camera.far = 4;
    key.shadow.bias = -0.0012;
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x8fb8ff, 0.55);
    fill.position.set(1.2, 0.8, -0.6);
    scene.add(fill);

    var amb = new THREE.AmbientLight(0x4a4038, 1.05);
    scene.add(amb);

    var trayGlow = new THREE.PointLight(0xd9a441, 0.7, 1.2, 2);
    trayGlow.position.set(0, 0.16, 0.52);
    scene.add(trayGlow);

    coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_R * 0.42, 16);

    // One deck. Tables and plates are keyed by deck name so the sync pass can
    // still find them, but there is exactly one of each now.
    var tm = buildTable('main');
    tableMeshes.main = tm;
    scene.add(tm);
    var pm = buildPlate('main');
    plateMeshes.main = pm;
    scene.add(pm);
    deckBacklight();

    // The plate travel is the only thing that moves in this machine, so the
    // frame under it has to read as the slot it slides in. These two skids sit
    // either side of the plate's stroke and are what the eye uses to tell that
    // the bar is moving forward rather than the whole table sliding.
    var skidMat = M(0x241a12, 0.85);
    var skidZ = (G.Sim.DECK.plate.back + G.Sim.DECK.plate.fwd) / 2;
    [-1, 1].forEach(function (side) {
      scene.add(box(0.022, 0.026, 0.30, skidMat, side * 0.585, -0.006, skidZ));
    });

    // Interior backdrop. The cabinet shell is a mid brown; coins on it are only
    // a shade lighter, so the whole machine flattened into one value. A dark
    // inset panel behind the deck gives the gold something to sit against.
    var insetMat = M(0x0e0906, 0.95);
    scene.add(box(1.22, 0.9, 0.012, insetMat, 0, 0.14, -0.435));

    buildRoom();
    trayGroup = buildTray();
    scene.add(trayGroup);

    cabinetGroup = buildCabinet(0x6b4a2f, 0x2a1d12);
    scene.add(cabinetGroup);

    scene.add(propRoot);
    return R;
  };

  // ── framing ────────────────────────────────────────────────────────────
  // A fixed eye position cannot work across aspects. The machine is ~1.24
  // wide and ~1.0 deep, so on a 390x844 phone the old fixed camera cropped the
  // table to a sliver. Instead the eye sits on a fixed direction from the
  // look-at target and is pulled back just far enough that every interesting
  // point lands inside a safe frame (the HUD eats the top and bottom).
  var CAM_TARGET = new THREE.Vector3(0, 0.06, 0.02);
  // corners of the playing surface, the cabinet shoulders, the mouth of the
  // drop chute, and the patch of room floor a paid coin actually lands on. If
  // these are visible the game is readable.
  //
  // The landing patch is now a real gameplay point (coins fall to the floor
  // instead of a tray) and it is the lowest thing in the picture, so it alone
  // decides how much empty floor the frame carries below the machine. A fourth
  // number scales how much of the safe band that point may use: above 1 pushes
  // it towards the edge of the frame, which crops the floor beyond it. The
  // numbers come from the landing census, not from taste: over 262 dropped
  // coins every one touched down at z 0.481-0.490 inside |x| 0.10, so there is
  // nothing worth framing past z ~0.49 and no reason to reserve room for it.
  // 1.06 is measured, not tuned by feel: it pulls the frame in until a coin
  // resting on the patch still clears the bottom edge by ~30 px (both its face
  // and the torch shadow under it), where 1.14 left it 3 px from being cut. The
  // gain is 2.174 -> 2.087 of camera distance, i.e. the machine reads ~4%
  // larger and the empty band under the cabinet base drops from 19% to 18% of
  // the frame. Pushing further buys single pixels of floor and starts cropping
  // coins, so this is the stop.
  var FIT_POINTS = [
    [-0.60, 0.00, -0.44], [0.60, 0.00, -0.44],
    [-0.60, 0.00, 0.30], [0.60, 0.00, 0.30],
    [-0.62, 0.10, 0.10], [0.62, 0.10, 0.10],
    [0.00, 0.34, -0.36],
    [0.00, -0.42, 0.481, 1.06],
    [-0.12, -0.42, 0.485, 1.06], [0.12, -0.42, 0.485, 1.06]
  ];
  var camDir = new THREE.Vector3(0, 0.5655, 0.8249);
  var framing = { dist: 1.6976, aspect: 1, pitch: 0.6, portrait: false };

  // ── camera shake ───────────────────────────────────────────────────────
  // The slap is a physical hit and the machine should take it too. The offset
  // is applied in R.render and removed again on the next frame, so nothing in
  // the scene ever sees a moved camera; camBase is the resting pose, snapshotted
  // lazily because fitCamera rewrites camera.position on every relayout.
  var camBase = null, shakeT = 0, shakeDur = 0, shakeMag = 0, shakeLast = 0;
  var camOff = new THREE.Vector3();

  R.shake = function (mag, ms) {
    // Motion is decoration here: the hit is already reported by the sound and
    // the meter, so a reduced-motion player loses nothing by skipping it.
    var reduce = false;
    try {
      reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {}
    if (reduce) return;
    mag = Math.max(0, Math.min(0.06, mag || 0));
    if (!mag) return;
    // do not stack: a fresh hit replaces the tail of the old one
    shakeMag = Math.max(shakeMag * (shakeT > 0 ? shakeT / shakeDur : 0), mag);
    shakeDur = Math.max(60, ms || 180) / 1000;
    shakeT = shakeDur;
  };

  R.shakeState = function () {
    return { t: shakeT, dur: shakeDur, mag: shakeMag, base: !!camBase };
  };

  // The eye direction is a pure pitch, so the fit solves in closed form:
  // for each point, depth grows with distance while the off-axis offset does
  // not, which makes the required distance a plain division.
  function fitCamera(aspect) {
    var portrait = aspect < 0.95;
    // Portrait gets a steeper look-down: a horizontal plane only gains screen
    // height as the view gets more top-down, and portrait has height to spend.
    var t = Math.max(0, Math.min(1, (1.35 - aspect) / 0.90));
    var pitch = 0.60 + t * 0.42;
    var safeX = 0.94;
    var safeY = portrait ? 0.70 : 0.82;

    camDir.set(0, Math.sin(pitch), Math.cos(pitch)).normalize();
    var tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    var tanH = tanV * aspect;

    // orthonormal basis of the camera, which depends only on the direction
    var view = camDir.clone().negate();
    var right = new THREE.Vector3().crossVectors(view, new THREE.Vector3(0, 1, 0)).normalize();
    var up = new THREE.Vector3().crossVectors(right, view).normalize();

    var d = 1.0;
    for (var i = 0; i < FIT_POINTS.length; i++) {
      var fp = FIT_POINTS[i];
      // a point may claim more than the base safe band (see FIT_POINTS)
      var band = fp.length > 3 ? fp[3] : 1;
      var a = new THREE.Vector3(fp[0], fp[1], fp[2]).sub(CAM_TARGET);
      var depth0 = a.dot(view);       // depth at zero distance
      var xc = Math.abs(a.dot(right));
      var yc = Math.abs(a.dot(up));
      d = Math.max(d,
        xc / (tanH * safeX * band) - depth0,
        yc / (tanV * safeY * band) - depth0);
    }
    d = Math.max(1.25, Math.min(6.0, d));

    camera.aspect = aspect;
    camera.position.copy(CAM_TARGET).addScaledVector(camDir, d);
    camera.lookAt(CAM_TARGET);
    camera.updateProjectionMatrix();

    // fog has to move with the eye or a pulled-back portrait view goes grey
    if (scene && scene.fog) {
      scene.fog.near = d * 1.30;
      scene.fog.far = d * 2.65;
    }
    framing.dist = d;
    framing.aspect = aspect;
    framing.pitch = pitch;
    framing.portrait = portrait;
    // The shake moves the camera away from this pose and puts it back. Any
    // rewrite of camera.position (resize, orientation change, cabinet swap)
    // makes the remembered pose a lie, so drop it and let R.render re-snap.
    camBase = null;
    return d;
  }

  function placeCamera(aspect) { return fitCamera(aspect); }
  R.framing = framing;
R.room = function () { return roomGroup; };

  function buildTable() {
    var D = G.Sim.DECK;
    var T = D.table, y = D.y;
    var g = new THREE.Group();
    var w = T.x1 - T.x0, d = T.lip - T.z0;
    var zc = (T.z0 + T.lip) / 2;

    // The felt has to be dark enough that a gold coin pops, but not so dark
    // that the deck reads as a hole in the machine.
    var felt = new THREE.MeshStandardMaterial({ color: 0x14201c, roughness: 0.92 });
    var top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), felt);
    top.position.set((T.x0 + T.x1) / 2, y - 0.01, zc);
    top.receiveShadow = true;
    g.add(top);

    // side rails
    var railMat = M(0x3d2717, 0.7);
    var sideGeo = new THREE.BoxGeometry(0.025, 0.055, d);
    var l = new THREE.Mesh(sideGeo, railMat); l.position.set(T.x0 - 0.012, y + 0.017, zc);
    var r = new THREE.Mesh(sideGeo, railMat); r.position.set(T.x1 + 0.012, y + 0.017, zc);
    l.castShadow = r.castShadow = true;
    g.add(l); g.add(r);

    // The lip, with the payout slot cut out of it. This is the single most
    // important piece of geometry on the table: it has to make the slot legible
    // as a hole in an edge, not as a wide-open table that happens to drop coins.
    // So it is built as two solid brass blocks either side of the slot rather
    // than one bar across the whole width.
    var lipMat = M(0xd9a441, 0.35, 0.6);
    var lipThick = 0.018;
    var slotHalf = G.Sim.PAY_W;
    var lipW = (T.x1 - T.x0) / 2 + 0.025;
    var blockW = lipW - slotHalf;
    [-1, 1].forEach(function (side) {
      var block = new THREE.Mesh(new THREE.BoxGeometry(blockW, lipThick, lipThick), lipMat);
      block.position.set(side * (slotHalf + blockW / 2), y + lipThick / 2, T.lip + 0.008);
      block.castShadow = true;
      g.add(block);
    });
    // The slot floor: a dark drop throat under the gap, so the opening reads as
    // depth rather than as a painted stripe.
    g.add(box(slotHalf * 2, 0.004, 0.055, M(0x0a0704, 0.98), 0, y - 0.004, T.lip + 0.030));

    // back wall
    var back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.135, 0.02), railMat);
    back.position.set(0, y + 0.055, T.z0 - 0.012);
    back.castShadow = back.receiveShadow = true;
    g.add(back);
    return g;
  }

  function buildPlate() {
    var D = G.Sim.DECK, T = D.table, y = D.y;
    var g = new THREE.Group();
    var drop = G.Sim.PLATE_DROP;

    // The bar is a slab whose TOP FACE sits at exactly `plateDrop`, which is the
    // height the simulation rests a carried coin at. Anything else and the coins
    // either sink into the bar or float above it -- and the whole point of this
    // bar is that a coin visibly lies on it and rides forward.
    var w = T.x1 - T.x0 - 0.03;
    var slab = M(0x8a6540, 0.55, 0.30);
    g.add(box(w, drop, 0.055, slab, 0, drop / 2, -0.014));

    // A dark seam right along the rib edge, so the boundary between "on the bar"
    // and "on the felt" is visible as the bar moves.
    g.add(box(w, drop * 0.55, 0.006, M(0x2c1d13, 0.9), 0, drop * 0.62, 0.013));

    // brass caps on both ends
    [-1, 1].forEach(function (side) {
      g.add(box(0.026, drop * 1.15, 0.062, M(0xd9a441, 0.40, 0.55),
        side * (w / 2 + 0.004), drop * 0.58, -0.014));
    });

    g.position.y = y;
    return g;
  }


  function buildTray() {
    var g = new THREE.Group();
    var lip = G.Sim.TABLE.lip;
    var slotW = (G.Sim.PAY_W || 0.30) * 2;

    // There is no payout basin any more. A coin that clears the lower deck keeps
    // falling down the front of the machine and lands on the room floor, so the
    // tray floor, its side walls, the front lip and the little basin lamp are all
    // gone. What is left is the payout mouth in the cabinet face -- the dark
    // throat the coins come out of, framed by two brass cheeks and a gold lintel.
    // That has to stay: the player still needs somewhere to aim at.

    var wallMat  = M(0x2e2116, 0.8);
    var gold     = M(0xd9a441, 0.42, 0.55);

    // back wall of the mouth: the visible face of the payout slot
    g.add(box(1.16, 0.075, 0.014, wallMat, 0, -0.052, lip + 0.006));
    // the mouth: cut the centre out of the back wall with the dark throat
    g.add(box(slotW, 0.062, 0.020, M(0x120c06, 0.95), 0, -0.050, lip + 0.004));
    // the throat is a hole, so give it a dark back and sides: without the basin
    // behind it you would see straight through the machine
    g.add(box(slotW, 0.062, 0.055, M(0x0a0704, 0.98), 0, -0.050, lip - 0.030));
    // 30 mm shelf under the mouth, so the slot sits in a face instead of floating
    g.add(box(1.16, 0.030, 0.030, M(0x241a11, 0.85), 0, -0.100, lip + 0.012));

    // brass cheeks framing the mouth
    var cheekW = (1.16 - slotW) / 2;
    for (var i = 0; i < 2; i++) {
      var cx = (slotW / 2 + cheekW / 2) * (i ? 1 : -1);
      g.add(box(cheekW, 0.070, 0.026, gold, cx, -0.048, lip + 0.008));
    }
    g.add(box(slotW + 0.018, 0.007, 0.030, M(0xf0c869, 0.30, 0.85), 0, -0.010, lip + 0.008));

    return g;
  }

  function buildCabinet(shell, trim) {
    var g = new THREE.Group();
    var T = G.Sim.TABLE;
    var w = 1.30;
    // One deck means the cabinet is roughly half as tall as it used to be.
    // Leaving the old two-deck shell here put 200 mm of empty glass above the
    // felt and made the machine read as broken rather than tall.
    var hdrY = 0.30;
    // side panels
    g.add(box(0.035, 0.52, 0.72, M(shell, 0.8), -w / 2, 0.02, -0.06));
    g.add(box(0.035, 0.52, 0.72, M(shell, 0.8), w / 2, 0.02, -0.06));
    // back panel
    g.add(box(w, 0.56, 0.03, M(shell, 0.8), 0, 0.02, -0.44));
    // header
    g.add(box(w, 0.11, 0.04, M(trim, 0.7), 0, hdrY, -0.41));
    var signMat = new THREE.MeshStandardMaterial({
      color: 0xffb347, emissive: 0xff9a2e, emissiveIntensity: 0.85, roughness: 0.5
    });
    g.add(box(0.62, 0.070, 0.01, signMat, 0, hdrY, -0.385));
    g.add(box(0.60, 0.068, 0.004, plateTex(256, 30, function (c, ww, hh) {
      c.fillStyle = '#1a120a'; c.fillRect(0, 0, ww, hh);
      c.fillStyle = '#ffb347'; c.font = 'bold 19px "Noto Sans HK",serif';
      c.textAlign = 'center'; c.fillText('一蚊雞', ww / 2, 22);
    }), 0, hdrY, -0.378));
    // base
    g.add(box(w + 0.06, 0.10, 0.80, M(shell, 0.85), 0, -0.18, 0.03));
    // Coin chute. This used to hang in mid-air under the header, held up by two
    // thin posts that read as scaffolding in front of the sign. With one deck
    // there is no room for that, so the chute is now a short spout bolted flat
    // to the inside of the back panel, angled down at the felt: a coin leaves it
    // and falls a short arc onto the deck, which is what the sim does anyway.
    var chute = new THREE.Group();
    var chuteBody = M(0x9a9aa2, 0.42, 0.55);
    var chuteDark = M(0x5e5e66, 0.55, 0.45);
    // the spout tube, lying almost flat and tipped down toward the deck
    chute.add(box(0.20, 0.020, 0.16, chuteBody, 0, 0, 0));
    // the slot the coin is pushed through
    chute.add(box(0.13, 0.010, 0.10, M(0x120c06, 0.95), 0, 0.012, 0.010));
    // side cheeks, so the mouth reads as an opening rather than a plate
    chute.add(box(0.016, 0.030, 0.16, chuteDark, -0.108, 0.008, 0));
    chute.add(box(0.016, 0.030, 0.16, chuteDark,  0.108, 0.008, 0));
    // flange where it meets the back panel
    chute.add(box(0.24, 0.055, 0.014, M(trim, 0.7), 0, 0.020, -0.082));
    // Sit the chute mouth exactly where Sim.drop() releases the coin, otherwise
    // the drop reads as a coin appearing out of thin air beside the chute. The
    // drop point and the release height are the sim's, not this file's business.
    var dropZ = G.Sim.DROP_Z;
    var dropY = G.Sim.DECK.y + G.Sim.PLATE_DROP + 0.26;
    chute.position.set(0, dropY, dropZ);
    // tip the spout down so its far end points at the felt
    chute.rotation.x = -0.30;
    g.add(chute);
    return g;
  }

  // ── per-frame sync ─────────────────────────────────────────────────────
  // ── landing glow ───────────────────────────────────────────────────────
  // A paid coin used to hit the floor and simply stop existing 0.9 s later:
  // the only witness was a sound, and the sound does not say WHERE. A short
  // pool of warm light where it actually landed makes the drop read as a thing
  // that happened on the floor rather than a coin that vanished. Props get a
  // much larger, brighter pool -- that landing is the whole point of the game.
  var glowMeshes = [], glowState = [], glowTex = null, landSeen = new Set();

  function glowTexture() {
    if (glowTex) return glowTex;
    glowTex = tex(96, 96, function (c, w, h) {
      var gr = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,235,200,1)');
      gr.addColorStop(0.35, 'rgba(255,190,110,0.55)');
      gr.addColorStop(0.75, 'rgba(255,140,60,0.14)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    return glowTex;
  }

  function addGlow(x, z, big) {
    var MAXG = 14;
    var idx = -1;
    for (var i = 0; i < glowState.length; i++) {
      if (glowState[i].t <= 0) { idx = i; break; }
    }
    if (idx < 0) {
      if (glowMeshes.length < MAXG) {
        var mat = new THREE.MeshBasicMaterial({
          color: 0xffc06a, map: glowTexture(), transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
        });
        var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        scene.add(m);
        glowMeshes.push(m);
        glowState.push({ t: 0, dur: 1, size: 1 });
        idx = glowMeshes.length - 1;
      } else {
        // full: recycle whatever is closest to done
        var best = 0, bestT = 1e9;
        for (var j = 0; j < glowState.length; j++) {
          if (glowState[j].t < bestT) { bestT = glowState[j].t; best = j; }
        }
        idx = best;
      }
    }
    var g = glowState[idx], mesh = glowMeshes[idx];
    var floorY = (G.Sim.FLOOR_Y || -0.42);
    g.t = big ? 0.85 : 0.46;      // seconds of life
    g.dur = g.t;
    g.size = big ? 0.46 : 0.17;
    mesh.position.set(x, floorY + 0.003 + (idx % 3) * 0.0004, z);
    mesh.rotation.z = (idx * 1.7) % 6.283;   // no two pools alike
    mesh.material.color.setHex(big ? 0xffd79a : 0xffb867);
    mesh.material.opacity = big ? 0.95 : 0.6;
    mesh.scale.setScalar(g.size);
    mesh.visible = true;
  }

  function stepGlows(dt) {
    for (var i = 0; i < glowState.length; i++) {
      var g = glowState[i];
      if (g.t <= 0) continue;
      g.t -= dt;
      var m = glowMeshes[i];
      if (g.t <= 0) { m.visible = false; g.t = 0; continue; }
      var k = g.t / g.dur;                 // 1 -> 0
      // grow a touch while it fades: light spreading on the tiles
      m.scale.setScalar(g.size * (1 + (1 - k) * 0.5));
      m.material.opacity = (g.size > 0.3 ? 0.95 : 0.6) * k * k;
    }
  }

  // the landing pools are the one cue a still frame cannot show at all, so the
  // probe reports how many are alive and how bright the brightest one is
  R.glowState = function () {
    var live = 0, op = 0, big = 0;
    for (var i = 0; i < glowState.length; i++) {
      if (glowState[i].t > 0) {
        live++;
        if (glowState[i].size > 0.3) big++;
        op = Math.max(op, glowMeshes[i].material.opacity);
      }
    }
    return { live: live, big: big, opacity: +op.toFixed(3) };
  };

  R.sync = function (sim, dt) {
    var coins = sim.coins, i, c, m;

    // table coins
    while (coinMeshes.length < coins.length) {
      var nm = makeCoinMesh();
      scene.add(nm);
      coinMeshes.push(nm);
    }
    for (i = 0; i < coins.length; i++) {
      c = coins[i]; m = coinMeshes[i];
      m.visible = true;
      // Sim.drop() already spawns the coin at the chute mouth (cy = TOP.y + 0.26)
      // and eases it down to the pile, so this must NOT add a fall arc of its
      // own: the old extra (1 - lift) * 0.35 put the coin 350 mm above the chute
      // it was supposed to be coming out of, which read as a coin appearing in
      // mid-air over the cabinet header. The sim's cy is the whole drop.
      var deckY = G.Sim.DECK.y;
      m.position.set(c.x, Math.max(c.cy, deckY) + 0.007, c.z);
      m.rotation.y = c.id * 0.37;
      m.scale.setScalar(c.kind === 'prop' ? 0.001 : 1);
    }
    for (i = coins.length; i < coinMeshes.length; i++) coinMeshes[i].visible = false;

    // props on the table
    var live = new Set();
    for (i = 0; i < coins.length; i++) {
      c = coins[i];
      if (c.kind !== 'prop') continue;
      live.add(c.id);
      var pm = propMeshes.get(c.id);
      if (!pm) {
        pm = R.buildProp(c.prop);
        scene.add(pm);
        propMeshes.set(c.id, pm);
      }
      pm.visible = true;
      // Same story as the coins above: the sim's cy already starts at the chute
      // mouth and eases down onto the pile, so this must not add a second arc.
      // The old code divided by 0.30, but props spawn with fallT 0.38 (main.js),
      // which made h negative and floated every dropped prize half a metre above
      // the chute at a quarter of its size. Read the drop progress off the real
      // height above the deck instead, so no constant from another file matters.
      var propDeckY = G.Sim.DECK.y;
      var lift = Math.min(1, Math.max(0, (c.cy - propDeckY) / 0.26));
      pm.position.set(c.x, c.cy + 0.006, c.z);
      pm.rotation.y = (c.id * 0.61) % 6.283;
      var s = c.r / 0.11;
      pm.scale.setScalar(Math.min(1.5, Math.max(0.7, s)) * (0.86 + 0.14 * (1 - lift)));
    }
    propMeshes.forEach(function (pm, id) {
      if (!live.has(id)) { pm.visible = false; }
    });

    // freefall coins and props
    var fall = sim.fall;
    while (fallMeshes.length < fall.length) {
      var fm = { coin: makeCoinMesh(), prop: null };
      scene.add(fm.coin);
      fallMeshes.push(fm);
    }
    for (i = 0; i < fallMeshes.length; i++) {
      var fm2 = fallMeshes[i];
      if (i < fall.length) {
        var fc = fall[i];
        fm2.coin.visible = fc.kind === 'coin';
        // There is no basin: a coin or prop that leaves the lower deck falls all
        // the way to the room floor and only then stops being worth drawing.
        var floorY = (G.Sim.FLOOR_Y || -0.42);
        // "On the floor" is the sim's own landing test, so the pose and the
        // height switch on exactly the frame the sim says the fall is over.
        var onFloor = fc.fy <= floorY + 0.002;
        // A coin's half thickness is what has to clear the tiles once it lies
        // flat: CylinderGeometry(COIN_R, COIN_R, COIN_R * 0.42) -> COIN_R * 0.21.
        // Read the radius from sim rather than baking the number in here, so a
        // retuned coin cannot silently sink again.
        var coinR = (G.Sim.COIN_R || COIN_R);
        // A hair of stagger keeps two coins that land on the same spot from
        // z-fighting. It is a hair, not a bounce.
        var rest = (fc.id % 5) * 0.0006;
        if (fc.kind === 'prop') {
          if (!fm2.prop) { fm2.prop = R.buildProp(fc.prop); scene.add(fm2.prop); }
          fm2.prop.visible = true;
          // Every prop is modelled standing on its own origin (0 .. +h), so an
          // upright prop needs almost no lift. On the floor it stands up: the
          // old code kept the tumble angles and a 6 mm lift, which pushed a
          // dropped prize through the tiles.
          if (onFloor) {
            fm2.prop.position.set(fc.fx, floorY + 0.001 + rest, fc.fz);
            fm2.prop.rotation.set(0, fc.faz * 0.2, 0);
          } else {
            fm2.prop.position.set(fc.fx, fc.fy + 0.006, fc.fz);
            fm2.prop.rotation.set(fc.fax * 0.35, fc.faz * 0.2, fc.faz * 0.3);
          }
          fm2.prop.scale.setScalar(Math.min(1.5, Math.max(0.7, fc.r / 0.11)));
        }
        if (fm2.prop) fm2.prop.visible = fc.kind === 'prop' && fc.fy > floorY - 0.01 && (fc.age || 0) <= (G.Sim.TRAY_DWELL || 0.9);
        if (onFloor) {
          // A landed coin lies FLAT, and the flat pose must not be derived from
          // the tumble angle. The old `rotation.x *= 0.75` damped a value that
          // was rebuilt from fc.fax from scratch every frame, so it could never
          // converge: it held the coin at 75% of its tumble (about -44 deg,
          // standing on its edge) with half the disc under the tiles. The
          // cylinder's axis is +Y, so x and z at zero IS the face; only the spin
          // about Y survives the landing.
          fm2.coin.rotation.set(0, fc.faz * 0.35, 0);
          fm2.coin.position.set(fc.fx, floorY + coinR * 0.21 + rest, fc.fz);
        } else {
          // Airborne: tumble the whole way down, untouched.
          var jitter = ((fc.id % 7) - 3) * 0.0009;
          fm2.coin.position.set(fc.fx, fc.fy + 0.007 + Math.abs(jitter), fc.fz);
          fm2.coin.rotation.set(fc.fax * 0.4, fc.faz * 0.2, fc.faz * 0.3);
        }
        // fade the tail of a landed coin's dwell so it does not pop out
        var age = fc.age || 0;
        var dwell = G.Sim.TRAY_DWELL || 0.9;
        var fade = G.Sim.TRAY_FADE || 0.5;
        var o = age > dwell - fade ? Math.max(0, 1 - (age - (dwell - fade)) / fade) : 1;
        fm2.coin.visible = fc.kind === 'coin' && o > 0.02;

        // ── the landing ────────────────────────────────────────────────────
        // The sim says when a fall is over; that first onFloor frame is the
        // only moment the player can be told where the coin went, so the pool
        // of light is spawned here and nowhere else. A prop landing is the
        // game's biggest beat and gets the big, slow, bright version.
        if (onFloor && !landSeen.has(fc.id)) {
          landSeen.add(fc.id);
          addGlow(fc.fx, fc.fz, fc.kind === 'prop');
        }
      } else {
        fm2.coin.visible = false;
        if (fm2.prop) fm2.prop.visible = false;
      }
    }

    // the bar, following the simulation's rib position
    plateMeshes.main.position.z = sim.front;

    // The landing pools run on their own clock so a paused world still fades
    // them out; they are light on the floor, not a second physics system.
    stepGlows(dt || 0.016);

    // landSeen only exists to fire once per fall id, and fall ids are recycled
    // forever, so drop the ones that have left the world instead of growing.
    if (landSeen.size > 96) {
      var alive = new Set();
      for (var fi = 0; fi < sim.fall.length; fi++) alive.add(sim.fall[fi].id);
      landSeen.forEach(function (id) { if (!alive.has(id)) landSeen.delete(id); });
    }
  };

  R.buildProp = function (id) {
    var fn = B[id];
    if (!fn) {
      var g = new THREE.Group();
      g.add(box(0.1, 0.1, 0.1, M(0xff00ff, 0.6), 0, 0.05, 0));
      return g;
    }
    return fn();
  };

  R.debugFall = function () {
    return fallMeshes.slice(0, 6).map(function (fm) {
      return {
        v: fm.coin.visible,
        p: fm.coin.position.toArray().map(function (x) { return +x.toFixed(3); }),
        r: fm.coin.rotation.toArray().slice(0, 3).map(function (x) { return +x.toFixed(3); }),
        // a dropped prize settles on the same floor, so it is probed with the
        // same shape rather than by eye
        pv: fm.prop ? fm.prop.visible : false,
        pp: fm.prop ? fm.prop.position.toArray().map(function (x) { return +x.toFixed(3); }) : null,
        pr: fm.prop ? fm.prop.rotation.toArray().slice(0, 3).map(function (x) { return +x.toFixed(3); }) : null
      };
    });
  };

  // A phone with DPR 3 at 430x932 would render 3.5 MP of shadowed 3D every
  // frame for a table that is 1.2 m wide. Cap the backing store by pixel
  // budget instead of by ratio, so a big desktop screen also stops at 2.
  var PIXEL_BUDGET = 2600000;
  function applyPixelRatio(w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var px = w * h * dpr * dpr;
    if (px > PIXEL_BUDGET) dpr = Math.max(1, Math.sqrt(PIXEL_BUDGET / (w * h)));
    // never upscale past what the device actually has
    dpr = Math.min(dpr, Math.min(window.devicePixelRatio || 1, 3));
    renderer.setPixelRatio(dpr);
    return dpr;
  }

  R.resize = function (w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    applyPixelRatio(w, h);
    renderer.setSize(w, h, false);
    placeCamera(w / h);
    framing.dpr = renderer.getPixelRatio();
  };
  R.pixelRatio = function () { return renderer ? renderer.getPixelRatio() : 1; };

  // The camera's resting pose is whatever fitCamera last produced. Snapshot it
  // the first time we render, and again after anything that moves the eye.
  R.render = function () {
    if (shakeT > 0) {
      var now = performance.now();
      // wall clock, not frame dt: a dropped frame must not stretch the hit
      var dts = shakeLast ? Math.min(0.05, (now - shakeLast) / 1000) : 0.016;
      shakeLast = now;
      if (!camBase) camBase = camera.position.clone();
      shakeT = Math.max(0, shakeT - dts);
      var k = shakeDur > 0 ? shakeT / shakeDur : 0;   // 1 -> 0
      var amp = shakeMag * k * k;                     // decays fast, ends at 0
      // a hit is vertical first (the cabinet is being shoved) with a small roll
      var t = now * 0.001;
      var wob = Math.sin(t * 46) * 0.35 + Math.sin(t * 91) * 0.15;
      camOff.set(wob * amp * 0.5, amp * (0.75 + 0.25 * Math.sin(t * 62)), 0);
      camera.position.copy(camBase).add(camOff);
      if (shakeT <= 0) {
        shakeLast = 0;
        camOff.set(0, 0, 0);
        camera.position.copy(camBase);
      }
    } else if (camBase) {
      // nothing running: make sure we are not left parked off the pose
      if (camOff.lengthSq() > 0) { camOff.set(0, 0, 0); camera.position.copy(camBase); }
    }
    renderer.render(scene, camera);
  };

  // main.js raycasts against the camera and parents the aim ribbon to the
  // scene, so both have to be reachable from outside this closure.
  Object.defineProperty(R, 'camera', { get: function () { return camera; } });
  Object.defineProperty(R, 'scene', { get: function () { return scene; } });

  // ── thumbnails for cards and the museum ────────────────────────────────
  // One shared renderer for every thumbnail. Creating a renderer per prop
  // burns a WebGL context each time and Chrome kills the page at ~16.
  var thumbRenderer = null, thumbScene, thumbCam, thumbLight, thumbCache = {};
  var THUMB_DIST = 0.38;      // camera distance; 0.232 of frame height is visible
  var THUMB_MID = 0.060;      // models are centred here vertically
  var THUMB_SPAN = 0.150;     // longest dimension after normalising

  R.thumb = function (id) {
    if (thumbCache[id]) return thumbCache[id];
    if (!thumbRenderer) {
      thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbRenderer.setSize(192, 192, false);
      thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
      thumbScene = new THREE.Scene();
      thumbCam = new THREE.PerspectiveCamera(34, 1, 0.05, 8);
      /* Distance and target are tied to THUMB_MID / THUMB_SPAN below. The old
       * fixed aim at y=0.085 made every flat prop (watch, pager, card) sit
       * below the centre of its own cell, so it read as a small smear.
       */
      var dir = new THREE.Vector3(0.4387, 0.5062, 0.7425);
      thumbCam.position.copy(dir.multiplyScalar(THUMB_DIST));
      thumbCam.lookAt(0, THUMB_MID, 0);
      thumbLight = new THREE.DirectionalLight(0xfff2dd, 2.4);
      thumbLight.position.set(-0.4, 0.9, 0.7);
      thumbScene.add(thumbLight);
      thumbScene.add(new THREE.AmbientLight(0x6a6050, 1.5));
      var rim2 = new THREE.DirectionalLight(0x8fb8ff, 0.8);
      rim2.position.set(0.8, 0.3, -0.6);
      thumbScene.add(rim2);
      if (envMap) { thumbScene.environment = envMap; thumbScene.environmentIntensity = 0.55; }
    }
    var g;
    try {
      g = R.buildProp(id);
    } catch (err) {
      // one broken builder must not take the museum with it: fall back to a
      // marker shape and say so once, so the gap is visible rather than silent
      if (G.__propErrors) G.__propErrors.push(id + ': ' + (err && err.message));
      else G.__propErrors = [id + ': ' + (err && err.message)];
      g = new THREE.Group();
      g.add(box(0.10, 0.10, 0.10, M(0x8f2b24, 0.6), 0, 0.05, 0));
    }
    /* Frame by the model's own bounds. Nominal radius told a flat comic
     * cover and a marble the same thing, so covers overflowed the cell and
     * the small objects sat marooned in it. One box per prop is cheap and it
     * makes the museum grid read as a grid.
     */
    var bb = new THREE.Box3().setFromObject(g);
    if (!bb.isEmpty()) {
      var size = new THREE.Vector3(), ctr = new THREE.Vector3();
      bb.getSize(size); bb.getCenter(ctr);
      var span = Math.max(size.x, size.y, size.z * 1.3, 0.001);
      g.scale.setScalar(THUMB_SPAN / span);
      /* Re-measure after scaling and centre all three axes. Dropping the base
       * on y=0 was only right for objects about as tall as they are wide; a
       * 30 mm watch ended up at the bottom edge of the cell.
       */
      bb.setFromObject(g);
      bb.getCenter(ctr);
      g.position.x -= ctr.x;
      g.position.z -= ctr.z;
      g.position.y += THUMB_MID - ctr.y;
    }
    thumbScene.add(g);
    thumbRenderer.render(thumbScene, thumbCam);
    var url = thumbRenderer.domElement.toDataURL('image/png');
    thumbScene.remove(g);
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    thumbCache[id] = url;
    return url;
  };

  R.setCabinet = function (palette) {
    if (!palette) return;
    scene.remove(cabinetGroup);
    cabinetGroup.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    cabinetGroup = buildCabinet(palette.shell, palette.trim);
    scene.add(cabinetGroup);
    // retint the tray glow
    var accents = [0xd9a441, 0xff6b5e, 0x4ecdc4, 0x9bb8ff, 0x7ee787, 0xffd166, 0x5eb9ff];
    // re-run the fit instead of writing a fixed eye: the old constant here
    // silently undid every aspect-aware framing the moment a stage loaded
    fitCamera(camera.aspect);
  };

  G.R = R;
})(window);
