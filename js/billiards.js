/* ============================================================
   ICOC OMNIPO — 당구 (포켓볼/8-ball) vs AI, 3D (Three.js)
   물리(충돌·마찰·쿠션 반사)는 직접 구현 + Node로 검증된 로직.
   Three.js는 화면(공/테이블/조명) 렌더링 전용.
   드래그로 조준+파워 조절, 고스트볼 기법으로 AI 조준 계산.
   (단순화: 스핀/회전(잉글리시)은 생략, 파울 처리도 기본만)
   ============================================================ */

(function () {
  let THREE = null;

  // ── 물리/테이블 상수 ──
  const TABLE_L = 2.0, TABLE_W = 1.0;
  const BALL_R = 0.028;
  const POCKET_R = BALL_R * 1.9;
  const RESTITUTION_CUSHION = 0.86;
  const FRICTION_DECEL = 1.1;
  const STOP_THRESHOLD = 0.004;
  const MAX_SHOT_SPEED = 3.2;

  const POCKETS = [
    { x: -TABLE_L / 2, z: -TABLE_W / 2 }, { x: 0, z: -TABLE_W / 2 }, { x: TABLE_L / 2, z: -TABLE_W / 2 },
    { x: -TABLE_L / 2, z: TABLE_W / 2 }, { x: 0, z: TABLE_W / 2 }, { x: TABLE_L / 2, z: TABLE_W / 2 },
  ];
  const BALL_COLORS = {
    1: 0xd4af37, 2: 0x1e4fa3, 3: 0xc0392b, 4: 0x6c3aa0, 5: 0xe07a1f, 6: 0x1f7a4d, 7: 0x7a2e1f,
    9: 0xd4af37, 10: 0x1e4fa3, 11: 0xc0392b, 12: 0x6c3aa0, 13: 0xe07a1f, 14: 0x1f7a4d, 15: 0x7a2e1f,
  };

  // ── 벡터 헬퍼 ──
  const vlen = v => Math.sqrt(v.x * v.x + v.z * v.z);
  const vsub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
  const vadd = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
  const vscale = (v, s) => ({ x: v.x * s, z: v.z * s });
  const vdot = (a, b) => a.x * b.x + a.z * b.z;
  const vnorm = v => { const l = vlen(v); return l > 1e-9 ? { x: v.x / l, z: v.z / l } : { x: 0, z: 0 }; };

  function applyFriction(ball, dt) {
    const speed = vlen(ball.v);
    if (speed <= STOP_THRESHOLD) { ball.v = { x: 0, z: 0 }; return; }
    const newSpeed = Math.max(0, speed - FRICTION_DECEL * dt);
    const dir = vnorm(ball.v);
    ball.v = vscale(dir, newSpeed);
  }

  function resolveBallBallCollision(a, b) {
    const delta = vsub(b.pos, a.pos);
    const dist = vlen(delta);
    if (dist >= BALL_R * 2 || dist < 1e-9) return false;
    const normal = vnorm(delta);
    const overlap = BALL_R * 2 - dist;
    const correction = vscale(normal, overlap / 2);
    a.pos = vsub(a.pos, correction);
    b.pos = vadd(b.pos, correction);
    // 둘 다 이미 정지 상태면 위치만 보정하고 속도는 건드리지 않는다 (정지한 공들 사이에서
    // 속도가 영원히 핑퐁하며 절대 안 멈추는 현상 방지 — 실제로 멈춰야 할 랙이 영원히 미세진동하는 버그였음)
    if (vlen(a.v) <= STOP_THRESHOLD && vlen(b.v) <= STOP_THRESHOLD) return false;
    const va_n = vdot(a.v, normal), vb_n = vdot(b.v, normal);
    if (va_n - vb_n <= 0) return false;
    const va_t = vsub(a.v, vscale(normal, va_n));
    const vb_t = vsub(b.v, vscale(normal, vb_n));
    a.v = vadd(va_t, vscale(normal, vb_n));
    b.v = vadd(vb_t, vscale(normal, va_n));
    return true;
  }

  function resolveCushionCollision(ball, normal) {
    const vn = vdot(ball.v, normal);
    if (vn >= 0) return;
    const vt = vsub(ball.v, vscale(normal, vn));
    ball.v = vadd(vt, vscale(normal, -vn * RESTITUTION_CUSHION));
  }

  function generateRack(apex) {
    const positions = [];
    const dx = BALL_R * 2 * Math.sqrt(3) / 2;
    const dz = BALL_R * 2;
    for (let row = 0; row < 5; row++) {
      const count = row + 1;
      const startZ = -(count - 1) * dz / 2;
      for (let i = 0; i < count; i++) positions.push({ x: apex.x - row * dx, z: apex.z + startZ + i * dz });
    }
    return positions;
  }

  function shuffleArr(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function ghostBallPosition(targetPos, pocketPos) {
    const dir = vnorm(vsub(targetPos, pocketPos));
    return vadd(targetPos, vscale(dir, BALL_R * 2 + 0.0005));
  }

  function legalTargets(balls, group) {
    const remaining = balls.filter(b => !b.potted && b.type !== 'cue');
    if (group === null) return remaining.filter(b => b.type !== 'eight');
    const own = remaining.filter(b => b.type === group);
    if (own.length === 0) return remaining.filter(b => b.type === 'eight');
    return own;
  }

  // ── 게임/렌더 상태 ──
  let scene, camera, renderer, tableGroup, aimLine, ghostMarker;
  let balls = []; // {id, type, num, pos:{x,z}, v:{x,z}, potted, mesh}
  let turn, playerGroup, aiGroup, gameOver, awarded, shotInProgress, animReq;
  let dragStart = null, dragCurrentWorld = null;
  let cueStartPos = { x: -TABLE_L / 4, z: 0 };

  function setStatus(msg) { const el = document.getElementById('bl-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('bl-points-msg'); if (el) el.textContent = msg || ''; }
  function setTurnLabel(msg) { const el = document.getElementById('bl-turn-info'); if (el) el.textContent = msg || ''; }

  function makeBallTexture(num, color, isStripe) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2efe8'; ctx.fillRect(0, 0, 128, 128);
    const hex = '#' + color.toString(16).padStart(6, '0');
    if (isStripe) {
      ctx.fillStyle = hex;
      ctx.fillRect(0, 38, 128, 52);
    } else {
      ctx.fillStyle = hex;
      ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f2efe8';
    ctx.beginPath(); ctx.arc(64, 64, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 64, 66);
    return new THREE.CanvasTexture(c);
  }

  function buildScene(container) {
    raycaster = new THREE.Raycaster();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14140f);

    const w = container.clientWidth, h = 360;
    camera = new THREE.PerspectiveCamera(50, w / h, 0.05, 10);
    camera.position.set(0, 2.05, 1.25);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const lamp = new THREE.PointLight(0xfff4dd, 1.4, 6);
    lamp.position.set(0, 1.4, 0);
    scene.add(lamp);
    const dl = new THREE.DirectionalLight(0xffffff, 0.4);
    dl.position.set(1, 2, 1);
    scene.add(dl);

    tableGroup = new THREE.Group();
    scene.add(tableGroup);

    const railGeo = new THREE.BoxGeometry(TABLE_L + 0.14, 0.05, TABLE_W + 0.14);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5a3420, roughness: 0.7 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.y = -0.026;
    tableGroup.add(rail);

    const feltGeo = new THREE.PlaneGeometry(TABLE_L, TABLE_W);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x1f6b42, roughness: 0.95 });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.rotation.x = -Math.PI / 2;
    tableGroup.add(felt);

    POCKETS.forEach(p => {
      const pocketGeo = new THREE.CircleGeometry(POCKET_R, 24);
      const pocketMat = new THREE.MeshBasicMaterial({ color: 0x050504 });
      const pm = new THREE.Mesh(pocketGeo, pocketMat);
      pm.rotation.x = -Math.PI / 2;
      pm.position.set(p.x, 0.001, p.z);
      tableGroup.add(pm);
    });

    const lineMat = new THREE.LineBasicMaterial({ color: 0xf5e6a8, transparent: true, opacity: 0.85 });
    aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat);
    aimLine.visible = false;
    scene.add(aimLine);

    const ghostGeo = new THREE.RingGeometry(BALL_R * 0.85, BALL_R, 20);
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    ghostMarker = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMarker.rotation.x = -Math.PI / 2;
    ghostMarker.visible = false;
    scene.add(ghostMarker);
  }

  function createBallMesh(ball) {
    const geo = new THREE.SphereGeometry(BALL_R, 28, 28);
    let mat;
    if (ball.type === 'cue') mat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.35 });
    else if (ball.type === 'eight') mat = new THREE.MeshStandardMaterial({ map: makeBallTexture(8, 0x111111, false), roughness: 0.35 });
    else mat = new THREE.MeshStandardMaterial({ map: makeBallTexture(ball.num, BALL_COLORS[ball.num], ball.type === 'stripe'), roughness: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ball.pos.x, BALL_R, ball.pos.z);
    tableGroup.add(mesh);
    return mesh;
  }

  function setupBalls() {
    balls.forEach(b => { if (b.mesh) tableGroup.remove(b.mesh); });
    balls = [];
    const apex = { x: TABLE_L / 4, z: 0 };
    const positions = generateRack(apex);
    const others = shuffleArr([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
    let oi = 0;
    positions.forEach((pos, idx) => {
      let num, type;
      if (idx === 4) { num = 8; type = 'eight'; }
      else { num = others[oi++]; type = num <= 7 ? 'solid' : 'stripe'; }
      const ball = { id: balls.length, type, num, pos: { ...pos }, v: { x: 0, z: 0 }, potted: false };
      ball.mesh = createBallMesh(ball);
      balls.push(ball);
    });
    const cue = { id: balls.length, type: 'cue', num: 0, pos: { ...cueStartPos }, v: { x: 0, z: 0 }, potted: false };
    cue.mesh = createBallMesh(cue);
    balls.push(cue);
  }

  function cueBall() { return balls.find(b => b.type === 'cue'); }

  function physicsStep(dt) {
    let anyMoving = false;
    balls.forEach(b => {
      if (b.potted) return;
      applyFriction(b, dt);
      if (vlen(b.v) > 0) anyMoving = true;
      b.pos = vadd(b.pos, vscale(b.v, dt));
    });
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[i].potted || balls[j].potted) continue;
        resolveBallBallCollision(balls[i], balls[j]);
      }
    }
    balls.forEach(b => {
      if (b.potted) return;
      if (b.pos.x - BALL_R < -TABLE_L / 2 && b.v.x < 0) resolveCushionCollision(b, { x: 1, z: 0 });
      if (b.pos.x + BALL_R > TABLE_L / 2 && b.v.x > 0) resolveCushionCollision(b, { x: -1, z: 0 });
      if (b.pos.z - BALL_R < -TABLE_W / 2 && b.v.z < 0) resolveCushionCollision(b, { x: 0, z: 1 });
      if (b.pos.z + BALL_R > TABLE_W / 2 && b.v.z > 0) resolveCushionCollision(b, { x: 0, z: -1 });
      b.pos.x = Math.max(-TABLE_L / 2 + BALL_R, Math.min(TABLE_L / 2 - BALL_R, b.pos.x));
      b.pos.z = Math.max(-TABLE_W / 2 + BALL_R, Math.min(TABLE_W / 2 - BALL_R, b.pos.z));
    });
    balls.forEach(b => {
      if (b.potted) return;
      for (const p of POCKETS) {
        if (vlen(vsub(b.pos, p)) < POCKET_R - BALL_R * 0.3) {
          b.potted = true; b.v = { x: 0, z: 0 };
          b.justPotted = true;
          break;
        }
      }
    });
    balls.forEach(b => { if (b.mesh) b.mesh.position.set(b.pos.x, b.potted ? -0.3 : BALL_R, b.pos.z); });
    return anyMoving;
  }

  function animate() {
    animReq = requestAnimationFrame(animate);
    if (shotInProgress) {
      const moving = physicsStep(1 / 60);
      if (!moving) { shotInProgress = false; resolveShotOutcome(); }
    }
    renderer.render(scene, camera);
  }

  // ── 화면 좌표 -> 테이블 평면 월드 좌표 ──
  let raycaster, groundPlane;
  function screenToTable(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, pt);
    return { x: pt.x, z: pt.z };
  }

  function updateAimVisual() {
    const cue = cueBall();
    if (!dragCurrentWorld || !cue) { aimLine.visible = false; ghostMarker.visible = false; return; }
    const pull = vsub(dragStart, dragCurrentWorld); // 뒤로 당긴 방향 = 칠 방향
    const dist = Math.min(vlen(pull), 0.5);
    if (dist < 0.01) { aimLine.visible = false; ghostMarker.visible = false; return; }
    const dir = vnorm(pull);
    const lineEnd = vadd(cue.pos, vscale(dir, 0.5));
    aimLine.geometry.setFromPoints([
      new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.z),
      new THREE.Vector3(lineEnd.x, BALL_R, lineEnd.z),
    ]);
    aimLine.visible = true;
    ghostMarker.visible = false;
  }

  function onPointerDown(e) {
    if (turn !== 'player' || shotInProgress || gameOver) return;
    const world = screenToTable(e.clientX, e.clientY);
    dragStart = world; dragCurrentWorld = world;
    updateAimVisual();
  }
  function onPointerMove(e) {
    if (!dragStart) return;
    dragCurrentWorld = screenToTable(e.clientX, e.clientY);
    updateAimVisual();
  }
  function onPointerUp(e) {
    if (!dragStart) return;
    const cue = cueBall();
    const pull = vsub(dragStart, dragCurrentWorld);
    const dist = Math.min(vlen(pull), 0.5);
    aimLine.visible = false;
    dragStart = null; dragCurrentWorld = null;
    if (dist < 0.015 || !cue) return;
    const dir = vnorm(pull);
    const power = Math.min(MAX_SHOT_SPEED, dist * (MAX_SHOT_SPEED / 0.5) * 1.0);
    cue.v = vscale(dir, power);
    shotInProgress = true;
    setStatus('');
    setTurnLabel('샷 진행 중...');
  }

  function attachPointerEvents() {
    const el = renderer.domElement;
    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    el.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e.touches[0]); }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); onPointerMove(e.touches[0]); }, { passive: false });
    el.addEventListener('touchend', e => { e.preventDefault(); onPointerUp(e.changedTouches[0]); }, { passive: false });
  }

  // ── 턴 결과 처리 ──
  function resolveShotOutcome() {
    const pottedThisShot = balls.filter(b => b.justPotted);
    balls.forEach(b => { b.justPotted = false; });
    const cue = cueBall();
    const scratched = pottedThisShot.some(b => b.type === 'cue');
    const eightPotted = pottedThisShot.some(b => b.type === 'eight');
    const shooterGroup = turn === 'player' ? playerGroup : aiGroup;
    const shooterIsPlayer = turn === 'player';

    if (eightPotted) {
      const ownRemaining = balls.filter(b => !b.potted && b.type === shooterGroup);
      const legallyCleared = shooterGroup !== null && ownRemaining.length === 0;
      if (legallyCleared && !scratched) { endGame(shooterIsPlayer ? 'win' : 'lose'); return; }
      endGame(shooterIsPlayer ? 'lose' : 'win'); return;
    }

    if (scratched) {
      cue.potted = false;
      cue.pos = { ...cueStartPos };
      cue.mesh.position.set(cue.pos.x, BALL_R, cue.pos.z);
      setStatus('💧 큐볼이 포켓에 들어갔습니다 (파울). 큐볼을 다시 놓고 상대 차례로 넘어갑니다.');
      switchTurn();
      return;
    }

    let assigned = false;
    if (shooterGroup === null && pottedThisShot.length > 0) {
      const firstType = pottedThisShot[0].type;
      if (firstType === 'solid' || firstType === 'stripe') {
        if (shooterIsPlayer) { playerGroup = firstType; aiGroup = firstType === 'solid' ? 'stripe' : 'solid'; }
        else { aiGroup = firstType; playerGroup = firstType === 'solid' ? 'stripe' : 'solid'; }
        assigned = true;
      }
    }
    const currentShooterGroup = shooterIsPlayer ? playerGroup : aiGroup;
    const pottedOwn = pottedThisShot.some(b => b.type === currentShooterGroup);

    renderHud();
    if (pottedOwn) {
      setStatus(assigned ? `${shooterIsPlayer ? '당신' : 'AI'}은 ${currentShooterGroup === 'solid' ? '솔리드(원색)' : '스트라이프(줄무늬)'}입니다! 계속 칩니다.` : `${shooterIsPlayer ? '당신' : 'AI'}이 공을 넣어 계속 칩니다.`);
      if (!shooterIsPlayer) setTimeout(aiTurn, 900);
      else setTurnLabel('당신의 차례입니다. 큐볼을 드래그해서 조준하세요.');
    } else {
      setStatus(pottedThisShot.length > 0 ? '상대 공을 넣었습니다. 차례가 넘어갑니다.' : '아무것도 넣지 못했습니다. 차례가 넘어갑니다.');
      switchTurn();
    }
  }

  function switchTurn() {
    turn = turn === 'player' ? 'ai' : 'player';
    renderHud();
    if (turn === 'ai') setTimeout(aiTurn, 900);
    else setTurnLabel('당신의 차례입니다. 큐볼을 드래그해서 조준하세요.');
  }

  function renderHud() {
    document.getElementById('bl-turn-p').classList.toggle('active', turn === 'player' && !gameOver);
    document.getElementById('bl-turn-a').classList.toggle('active', turn === 'ai' && !gameOver);
    document.getElementById('bl-player-group').textContent = playerGroup ? (playerGroup === 'solid' ? '솔리드' : '스트라이프') : '미정';
    document.getElementById('bl-ai-group').textContent = aiGroup ? (aiGroup === 'solid' ? '솔리드' : '스트라이프') : '미정';
  }

  // ── AI ──
  function aiTurn() {
    if (gameOver) return;
    const cue = cueBall();
    const targets = legalTargets(balls, aiGroup);
    let best = null, bestScore = -Infinity;
    targets.forEach(t => {
      POCKETS.forEach(p => {
        const ghost = ghostBallPosition(t.pos, p);
        const toGhost = vsub(ghost, cue.pos);
        const distToGhost = vlen(toGhost);
        const cutDir = vnorm(vsub(t.pos, ghost));
        const approachDir = vnorm(toGhost);
        const cutAngle = Math.acos(Math.max(-1, Math.min(1, vdot(cutDir, approachDir)))) * 180 / Math.PI;
        if (cutAngle > 80) return; // 너무 어려운 각도는 제외
        const score = -distToGhost - cutAngle * 0.01;
        if (score > bestScore) { bestScore = score; best = { target: t, pocket: p, ghost, distToGhost, cutAngle }; }
      });
    });
    if (!best) {
      // 합법 타겟에 도달 불가하면 그냥 가장 가까운 공 쪽으로 적당히 침
      const t = targets[0] || balls.find(b => !b.potted && b.type !== 'cue');
      const dir = vnorm(vsub(t.pos, cue.pos));
      cue.v = vscale(dir, 1.3);
      shotInProgress = true;
      setTurnLabel('AI가 칩니다...');
      return;
    }
    const errorDeg = 1.5 + best.cutAngle * 0.06; // 어려운 샷일수록 오차 커짐
    const errorRad = (Math.random() - 0.5) * 2 * errorDeg * Math.PI / 180;
    let dir = vnorm(vsub(best.ghost, cue.pos));
    const cosA = Math.cos(errorRad), sinA = Math.sin(errorRad);
    dir = { x: dir.x * cosA - dir.z * sinA, z: dir.x * sinA + dir.z * cosA };
    const power = Math.min(MAX_SHOT_SPEED, 1.1 + best.distToGhost * 1.4);
    cue.v = vscale(dir, power);
    shotInProgress = true;
    setTurnLabel('AI가 칩니다...');
  }

  function endGame(result) {
    gameOver = true;
    renderHud();
    let pts;
    if (result === 'win') { setStatus('🎉 8번 공을 합법적으로 넣었습니다! 승리!'); pts = 30; }
    else { setStatus('😵 8번 공 처리에 실패했습니다 (조건 미충족 또는 파울). 패배입니다.'); pts = 15; }
    if (!awarded) {
      awarded = true;
      const r = window.ICOC_POINTS.addPoints(pts, 'billiards_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      window.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function reset() {
    if (animReq) cancelAnimationFrame(animReq);
    turn = 'player'; playerGroup = null; aiGroup = null; gameOver = false; awarded = false; shotInProgress = false;
    dragStart = null; dragCurrentWorld = null;
    setupBalls();
    renderHud();
    setStatus('큐볼을 드래그해서 당기면 조준선이 보입니다. 놓으면 그 방향·세기로 칩니다.');
    setPointsMsg('자기 그룹(솔리드/스트라이프)을 다 넣고 8번 공을 합법적으로 넣으면 승리합니다.');
    setTurnLabel('당신의 차례입니다. 큐볼을 드래그해서 조준하세요.');
    animate();
  }

  async function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="bl-turn-a" class="game-turn-pill">🤖 AI · <span id="bl-ai-group">미정</span></span>
        <span id="bl-turn-p" class="game-turn-pill">😊 당신 · <span id="bl-player-group">미정</span></span>
      </div>
      <div id="bl-turn-info" class="bl-turn-info"></div>
      <div id="bl-canvas-wrap" class="bl-canvas-wrap"><div class="bl-loading">테이블을 준비하는 중...</div></div>
      <div id="bl-result" class="game-result-msg"></div>
      <div id="bl-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="bl-restart-btn">새 게임</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('bl-restart-btn').addEventListener('click', reset);
    if (!THREE) THREE = await import('../vendor/three.module.min.js');
    const container = document.getElementById('bl-canvas-wrap');
    buildScene(container);
    attachPointerEvents();
    reset();
  }

  window.BilliardsGame = { start };
})();
