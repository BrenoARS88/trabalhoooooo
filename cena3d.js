// cena3d.js — Casa Inteligente Moderna 2 andares + Automação Residencial
// Câmera orbital completa + RGB + Cenas + Dia/Noite + Presença + Consumo

window.addEventListener('load', function () {

  var container = document.getElementById('canvas-container');
  if (!container) return;
  var msg = document.getElementById('loading-msg');
  if (msg) msg.style.display = 'none';

  var W = container.clientWidth  || 800;
  var H = container.clientHeight || 500;

  // ============================================================
  // CENA
  // ============================================================
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1b2a);
  scene.fog = new THREE.Fog(0x0d1b2a, 30, 55);

  // ============================================================
  // CÂMERAS
  // ============================================================
  var NEAR = 0.1, FAR = 200;
  var camPersp = new THREE.PerspectiveCamera(45, W / H, NEAR, FAR);
  var camOrtho = new THREE.OrthographicCamera(-W/80, W/80, H/80, -H/80, NEAR, FAR);
  var modoOrtho = false;
  var camera = camPersp;

  // ============================================================
  // RENDERER
  // ============================================================
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  container.style.position = 'relative';
  container.appendChild(renderer.domElement);

  // ============================================================
  // CÂMERA ORBITAL
  // ============================================================
  var target  = new THREE.Vector3(-1.5, 2.8, 0); // centro visual da fachada
  var theta   = 0.0;    // olhando de frente
  var phi     = 0.28;   // ligeiramente acima do chão
  var radius  = 18.0;
  var RADIUS_MIN = 2, RADIUS_MAX = 45;

  function aplicarCamera() {
    var x = target.x + radius * Math.cos(phi) * Math.sin(theta);
    var y = target.y + radius * Math.sin(phi);
    var z = target.z + radius * Math.cos(phi) * Math.cos(theta);
    camPersp.position.set(x, y, z);
    camPersp.lookAt(target);

    // Ortho: scale frustum proportionally to radius so zoom works correctly
    var cW = container.clientWidth  || W;
    var cH = container.clientHeight || H;
    var aspect = cW / cH;
    var s = radius * 0.1;          // world-units half-height
    camOrtho.left   = -s * aspect;
    camOrtho.right  =  s * aspect;
    camOrtho.top    =  s;
    camOrtho.bottom = -s;
    camOrtho.position.copy(camPersp.position);
    camOrtho.lookAt(target);
    camOrtho.updateProjectionMatrix();
  }

  function zoomToFit() {
    var box = new THREE.Box3();
    scene.traverse(function(o){ if (o.isMesh) box.expandByObject(o); });
    if (box.isEmpty()) return;
    var center = new THREE.Vector3(); box.getCenter(center);
    var size   = new THREE.Vector3(); box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z);
    target.copy(center);
    radius = (maxDim / 2) / Math.tan((camPersp.fov * Math.PI / 180) / 2) * 1.3;
    radius = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, radius));
    NEAR = maxDim * 0.001; FAR = maxDim * 10;
    camPersp.near = NEAR; camPersp.far = FAR; camPersp.updateProjectionMatrix();
    camOrtho.near = NEAR; camOrtho.far = FAR; camOrtho.updateProjectionMatrix();
    aplicarCamera();
  }

  // ============================================================
  // CONTROLES DE MOUSE / TOQUE
  // ============================================================
  var mouse = { down: false, btn: -1, lastX: 0, lastY: 0 };
  var SENS_ORBITA = 0.007, SENS_PAN = 0.005, SENS_ZOOM = 0.12;

  renderer.domElement.addEventListener('mousedown', function(e){
    e.preventDefault(); mouse.down=true; mouse.btn=e.button; mouse.lastX=e.clientX; mouse.lastY=e.clientY;
  });
  window.addEventListener('mouseup', function(){ mouse.down=false; });
  window.addEventListener('mousemove', function(e){
    if (!mouse.down) return;
    var dx=e.clientX-mouse.lastX, dy=e.clientY-mouse.lastY;
    mouse.lastX=e.clientX; mouse.lastY=e.clientY;
    if (mouse.btn===0) {
      // Left drag: orbit
      theta += dx * SENS_ORBITA;
      // Dragging up (dy < 0) should raise camera (phi increases)
      // Floor at 0.05 — camera never goes below ground
      phi = clamp(phi - dy * SENS_ORBITA, 0.05, Math.PI / 2 - 0.02);
      aplicarCamera();
    } else if (mouse.btn===2||mouse.btn===1) {
      // Pan: move target in camera-space right/up plane
      // Always use camPersp for direction (stable regardless of ortho mode)
      var forward = new THREE.Vector3();
      camPersp.getWorldDirection(forward);               // camera look direction
      var right = new THREE.Vector3();
      right.crossVectors(forward, camPersp.up).normalize(); // true right vector
      var up = new THREE.Vector3();
      up.crossVectors(right, forward).normalize();          // true up vector
      var ps = radius * SENS_PAN;
      target.addScaledVector(right, -dx * ps);  // negative: drag right moves target right
      target.addScaledVector(up,     dy * ps);  // positive: drag up moves target up
      aplicarCamera();
    }
  });
  renderer.domElement.addEventListener('wheel', function(e){
    e.preventDefault();
    radius = clamp(radius * (1 + (e.deltaY>0?1:-1)*SENS_ZOOM), RADIUS_MIN, RADIUS_MAX);
    aplicarCamera();
  }, { passive: false });
  var touch={prev:null};
  renderer.domElement.addEventListener('touchstart', function(e){
    e.preventDefault();
    touch.prev = Array.from(e.touches).map(function(t){return{x:t.clientX,y:t.clientY};});
  },{passive:false});
  renderer.domElement.addEventListener('touchmove', function(e){
    e.preventDefault();
    var curr=Array.from(e.touches).map(function(t){return{x:t.clientX,y:t.clientY};});
    if(!touch.prev){touch.prev=curr;return;}
    if(curr.length===1&&touch.prev.length===1){
      theta+=(curr[0].x-touch.prev[0].x)*SENS_ORBITA*1.5;
      phi=clamp(phi-(curr[0].y-touch.prev[0].y)*SENS_ORBITA*1.5, 0.05, Math.PI/2-0.02);
      aplicarCamera();
    } else if(curr.length===2&&touch.prev.length===2){
      var da=Math.hypot(touch.prev[1].x-touch.prev[0].x,touch.prev[1].y-touch.prev[0].y);
      var db=Math.hypot(curr[1].x-curr[0].x,curr[1].y-curr[0].y);
      if(da>0){radius=clamp(radius*(da/db),RADIUS_MIN,RADIUS_MAX);aplicarCamera();}
    }
    touch.prev=curr;
  },{passive:false});
  renderer.domElement.addEventListener('touchend', function(){touch.prev=null;});
  renderer.domElement.addEventListener('contextmenu', function(e){e.preventDefault();});

  // ============================================================
  // UTILITÁRIOS
  // ============================================================
  function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,v));}
  function mat(color,opts){var o=opts||{};o.color=color;return new THREE.MeshStandardMaterial(o);}
  function add(geo,color,x,y,z,opts){
    var m=new THREE.Mesh(geo,mat(color,opts));
    m.position.set(x||0,y||0,z||0);
    m.castShadow=true; m.receiveShadow=true; scene.add(m); return m;
  }
  function fio(x1,y1,z1,x2,y2,z2,cor){
    var dx=x2-x1,dy=y2-y1,dz=z2-z1,len=Math.sqrt(dx*dx+dy*dy+dz*dz);
    var m=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,len,5),new THREE.MeshStandardMaterial({color:cor}));
    m.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
    m.lookAt(new THREE.Vector3(x2,y2,z2)); m.rotateX(Math.PI/2); scene.add(m);
  }
  var Box=THREE.BoxGeometry, Cyl=THREE.CylinderGeometry, Sph=THREE.SphereGeometry,
      Con=THREE.ConeGeometry, Pln=THREE.PlaneGeometry;

  // ============================================================
  // LUZES
  // ============================================================
  var ambientLight = new THREE.AmbientLight(0x334455, 1.0);
  scene.add(ambientLight);
  var sunLight = new THREE.DirectionalLight(0xfffaee, 1.1);
  sunLight.position.set(8, 14, 6);
  sunLight.castShadow = true;
  sunLight.shadow.camera.left=-18; sunLight.shadow.camera.right=18;
  sunLight.shadow.camera.top=18;   sunLight.shadow.camera.bottom=-18;
  sunLight.shadow.camera.far=70;
  sunLight.shadow.mapSize.width = sunLight.shadow.mapSize.height = 1024;
  scene.add(sunLight);
  scene.add(new THREE.DirectionalLight(0x223366, 0.35)).position.set(-5,7,-6);

  // ============================================================
  // CHÃO E ENTORNO
  // ============================================================
  // Gramado
  var gramado = new THREE.Mesh(new Pln(40,40), mat(0x2d5a27,{roughness:0.95}));
  gramado.rotation.x=-Math.PI/2; gramado.receiveShadow=true; scene.add(gramado);

  // Calçada / piso externo — concreto
  add(new Box(14,0.06,8),   0xb0a898, 0, 0.03, 3.5);    // frente da casa
  add(new Box(5,0.06,14),   0xb0a898, -6.5, 0.03, 0);   // lateral esquerda (garagem)

  // Caminho até a porta principal (pedras)
  for(var pi=0;pi<6;pi++) add(new Box(0.6,0.05,0.55),0x999080, 2.5, 0.05, 3.2+pi*0.65);

  // ============================================================
  // CASA MODERNA — 2 ANDARES, TETO PLANO
  // ============================================================

  // --- Materiais da fachada ---
  var mConcreto  = mat(0xd4cfc8, {roughness:0.85, metalness:0.05}); // concreto claro
  var mConcEscuro= mat(0x8a8278, {roughness:0.9});                  // concreto escuro
  var mVidroFach = new THREE.MeshStandardMaterial({                  // vidro fachada
    color:0x90c8e8, transparent:true, opacity:0.35,
    metalness:0.8, roughness:0.05,
    emissive:new THREE.Color(0x000000), emissiveIntensity:0
  });
  var mAco       = mat(0x445566, {metalness:0.9, roughness:0.15});  // aço escovado
  var mAcoClaro  = mat(0x778899, {metalness:0.95, roughness:0.1});
  var mPedra     = mat(0x7a7060, {roughness:0.95});

  // === BLOCO 1: Corpo principal (2 andares) ===
  // Largura 8, altura 5.2 (2x 2.6), profundidade 5
  add(new Box(8, 5.2, 5), 0xd4cfc8, 0, 2.6, 0); // corpo central

  // === BLOCO 2: Ala da garagem (lado esquerdo) ===
  // Mais larga, 1 andar só, com teto que vira varanda do 2° andar
  add(new Box(5, 2.8, 5.5), 0x8a8278, -6.5, 1.4, -0.25); // corpo garagem

  // === BLOCO 3: Recuo lateral direito (volume menor na frente) ===
  add(new Box(3, 5.2, 1.5), 0xb8b2a8, 5.5, 2.6, -1.75);

  // --- TETO PLANO ---
  // Laje principal com beirada
  add(new Box(8.4, 0.25, 5.4),   0x8a8278, 0,    5.325, 0);      // laje principal
  add(new Box(5.4, 0.25, 5.9),   0x7a7060, -6.5, 2.925, -0.25);  // laje garagem
  add(new Box(3.4, 0.25, 1.9),   0x8a8278, 5.5,  5.325, -1.75);  // laje lateral

  // Platibanda (muro de topo)
  add(new Box(8.4, 0.5, 0.2),    0x8a8278, 0,    5.7, -2.7);     // fundo
  add(new Box(8.4, 0.5, 0.2),    0x8a8278, 0,    5.7,  2.7);     // frente
  add(new Box(0.2, 0.5, 5.4),    0x8a8278, -4.2, 5.7,  0);       // esquerda
  add(new Box(0.2, 0.5, 5.4),    0x8a8278, 4.2,  5.7,  0);       // direita

  // --- DIVISÓRIA ENTRE ANDARES (faixa horizontal concreto escuro) ---
  add(new Box(8.1, 0.25, 5.1),   0x8a8278, 0,    2.625, 0);
  add(new Box(3.1, 0.25, 1.6),   0x8a8278, 5.5,  2.625, -1.75);

  // --- JANELAS 1° ANDAR (frente) ---
  // Painéis de vidro grandes
  var mVidroJan = new THREE.MeshStandardMaterial({
    color:0x88c0d8, transparent:true, opacity:0.45,
    metalness:0.7, roughness:0.05,
    emissive:new THREE.Color(0x000000), emissiveIntensity:0
  });
  // Referência ao vidro principal para animação de luz
  var mVidro = mVidroJan;

  function addVidroModerno(x, y, z, largura, altura, profundidade) {
    var v = new THREE.Mesh(new Box(largura, altura, profundidade), mVidroJan);
    v.position.set(x,y,z); v.castShadow=false; scene.add(v);
    // Caixilho em aço
    add(new Box(largura+0.06, 0.06, profundidade+0.02), 0x445566, x, y+altura/2+0.03, z);
    add(new Box(largura+0.06, 0.06, profundidade+0.02), 0x445566, x, y-altura/2-0.03, z);
    add(new Box(0.06, altura+0.1, profundidade+0.02),   0x445566, x-largura/2-0.03, y, z);
    add(new Box(0.06, altura+0.1, profundidade+0.02),   0x445566, x+largura/2+0.03, y, z);
    return v;
  }

  // Janela grande esquerda - 1° andar
  addVidroModerno(-2.8, 1.35, 2.51,  2.4, 2.0, 0.08);
  // Janela grande direita - 1° andar
  addVidroModerno( 1.5, 1.35, 2.51,  2.4, 2.0, 0.08);

  // --- JANELAS 2° ANDAR (frente) ---
  addVidroModerno(-2.2, 4.0, 2.51,  3.2, 1.8, 0.08);
  addVidroModerno( 2.2, 4.0, 2.51,  2.2, 1.8, 0.08);

  // Janelas laterais direita
  addVidroModerno(4.01, 3.9, 0,    0.08, 1.6, 2.8);
  addVidroModerno(4.01, 1.3, 0.5,  0.08, 1.4, 1.8);

  // Janelas fundos
  addVidroModerno(-1.5, 3.9, -2.51, 2.5, 1.6, 0.08);
  addVidroModerno( 1.5, 1.3, -2.51, 2.0, 1.4, 0.08);

  // --- PORTA PIVOTANTE (entrada principal) ---
  // Recuo / portal de entrada
  add(new Box(1.6, 2.8, 0.5),  0x445566, 2.5, 1.4, 2.51);  // moldura de aço
  add(new Box(1.4, 2.6, 0.45), 0x778899, 2.5, 1.3, 2.51);  // painel da porta
  // Detalhe: faixa de vidro lateral na porta
  var vPorta = new THREE.Mesh(new Box(0.35, 2.5, 0.07), mVidroJan);
  vPorta.position.set(1.65, 1.3, 2.58); scene.add(vPorta);
  // Puxador de aço
  var puxGeo = new Cyl(0.04, 0.04, 0.6, 8);
  var pux = new THREE.Mesh(puxGeo, mat(0xaabbcc,{metalness:0.95,roughness:0.05}));
  pux.rotation.x = Math.PI/2; pux.position.set(2.1, 1.3, 2.62); scene.add(pux);

  // --- PORTÃO DE AÇO (calçada lateral) ---
  add(new Box(0.1, 1.8, 3.0),  0x334455, -4.0, 0.9, 3.8);  // poste esquerdo
  add(new Box(0.1, 1.8, 3.0),  0x334455, -2.5, 0.9, 3.8);  // poste direito
  // Grade do portão (barras verticais)
  for(var bi=0; bi<7; bi++) {
    add(new Box(0.06, 1.6, 0.06), 0x4a5a6a, -3.95+bi*0.23, 0.9, 3.8);
  }
  add(new Box(1.62, 0.1, 0.06), 0x334455, -3.25, 1.7, 3.8); // barra horizontal topo
  add(new Box(1.62, 0.1, 0.06), 0x334455, -3.25, 0.15,3.8); // barra horizontal base

  // Motorzinho do portão
  add(new Box(0.3, 0.2, 0.2), 0x222222, -4.05, 1.85, 3.8);

  // --- GARAGEM ---
  // Parede da garagem com abertura
  add(new Box(1.2, 2.8, 0.15), 0x8a8278, -8.0,  1.4, 2.51); // lateral esq
  add(new Box(1.2, 2.8, 0.15), 0x8a8278, -5.3,  1.4, 2.51); // lateral dir
  add(new Box(4.6, 0.35, 0.15),0x7a7060, -6.65, 2.97,2.51); // verga topo

  // Portão automático (seccional) — em alumínio
  var mPortao = mat(0x99a0a8, {metalness:0.6, roughness:0.3});
  for(var si=0; si<6; si++) {
    add(new Box(4.5, 0.42, 0.08), 0x99a0a8, -6.6, 0.21+si*0.42, 2.53,{metalness:0.6,roughness:0.3});
  }
  // Trilho do portão
  add(new Box(0.06, 0.08, 5.0), 0x555555, -4.35, 2.7, 0, {metalness:0.8});
  add(new Box(0.06, 0.08, 5.0), 0x555555, -8.85, 2.7, 0, {metalness:0.8});

  // Piso da garagem (cor diferente)
  add(new Box(4.6, 0.05, 5.1), 0x909090, -6.6, 0.025, -0.25);

  // Carro na garagem (silhueta simples)
  add(new Box(3.8, 1.0, 2.0), 0x223344, -6.6, 0.55, -1.0); // carroceria baixa
  add(new Box(2.6, 0.8, 1.9), 0x223344, -6.6, 1.35, -1.1); // cabine
  // Vidros do carro
  var vCarFr = new THREE.Mesh(new Box(2.4,0.65,0.05),mVidroJan);
  vCarFr.position.set(-6.6,1.35,-0.2); scene.add(vCarFr);
  // Rodas
  [-7.8,-5.4].forEach(function(x){
    [-0.3,-1.9].forEach(function(z){
      add(new Cyl(0.35,0.35,0.22,12), 0x111111, x, 0.35, z);
      add(new Cyl(0.22,0.22,0.24,12), 0x556677, x, 0.35, z, {metalness:0.8});
    });
  });
  // Faróis
  add(new Box(0.3,0.22,0.06),0xffffaa,-6.6,0.62,-2.03,{emissive:new THREE.Color(0xffff88),emissiveIntensity:0.4});

  // --- VARANDA DO 2° ANDAR (sobre a garagem) ---
  add(new Box(5.4, 0.15, 1.5), 0xd4cfc8, -6.5, 2.925, 1.2);  // laje varanda
  // Guarda-corpo de vidro
  var vVaranda = new THREE.Mesh(new Box(5.2, 0.9, 0.06), mVidroJan);
  vVaranda.position.set(-6.5, 3.37, 1.95); scene.add(vVaranda);
  // Perfis de aço do guarda-corpo
  [-9.0,-8.0,-7.0,-6.0,-5.0,-4.0,-3.8].forEach(function(x){
    add(new Box(0.05, 0.95, 0.05), 0x445566, x, 3.37, 1.95);
  });

  // --- FAIXAS LED NA FACHADA (emissive) ---
  // Faixa horizontal entre andares
  var mLedFaixa = new THREE.MeshStandardMaterial({
    color:0x00aaff, emissive:new THREE.Color(0x0066ff), emissiveIntensity:1.2,
    roughness:0.2
  });
  var ledFaixaH = new THREE.Mesh(new Box(8.0, 0.06, 0.06), mLedFaixa);
  ledFaixaH.position.set(0, 2.62, 2.55); scene.add(ledFaixaH);

  // Faixa LED vertical nos cantos
  var ledV1 = new THREE.Mesh(new Box(0.06, 5.3, 0.06), mLedFaixa);
  ledV1.position.set(-4.05, 2.65, 2.55); scene.add(ledV1);
  var ledV2 = ledV1.clone();
  ledV2.position.set(4.05, 2.65, 2.55); scene.add(ledV2);

  // Faixa LED contorno da garagem
  var ledGar = new THREE.Mesh(new Box(5.2, 0.05, 0.05), mLedFaixa);
  ledGar.position.set(-6.5, 2.85, 2.58); scene.add(ledGar);

  // Luz pontual das faixas LED (ilumina a fachada)
  var luzLedFachada = new THREE.PointLight(0x0066ff, 0.8, 8);
  luzLedFachada.position.set(0, 2.6, 3.5); scene.add(luzLedFachada);

  // --- ILUMINAÇÃO INTERNA ---
  // Luz da sala (1° andar centro)
  var luzCasa = new THREE.PointLight(0xffdd88, 1.4, 8);
  luzCasa.position.set(0, 1.5, 0); scene.add(luzCasa);
  // Luz do quarto (2° andar)
  var luzQuarto = new THREE.PointLight(0xffcc88, 0.0, 6);
  luzQuarto.position.set(1, 4.2, 0); scene.add(luzQuarto);
  // Luz da cozinha
  var luzCozinha = new THREE.PointLight(0xffeedd, 0.0, 5);
  luzCozinha.position.set(-1.5, 4.2, -0.8); scene.add(luzCozinha);

  // --- HOLOFOTE EXTERNO (entrada) ---
  var holofote = new THREE.SpotLight(0xffffff, 1.5, 12, Math.PI/8, 0.3);
  holofote.position.set(2.5, 5.5, 4.0);
  holofote.target.position.set(2.5, 0, 2.5);
  scene.add(holofote); scene.add(holofote.target);

  // ============================================================
  // JARDIM E ENTORNO
  // ============================================================
  // Muro externo
  add(new Box(0.2, 1.5, 16),   0x8a8278, -10.2, 0.75, 0);   // muro lateral
  add(new Box(14,  0.2, 0.2),  0x8a8278,  0,    1.5,  -8.2); // muro fundo
  add(new Box(3.0, 1.5, 0.2),  0x8a8278,  5.5,  0.75, 8.2);  // muro frente direita
  add(new Box(3.0, 1.5, 0.2),  0x8a8278, -8.5,  0.75, 8.2);  // muro frente esq

  function addArvore(x, z, s) {
    s=s||1;
    add(new Cyl(0.07*s,0.1*s,0.6*s,8),  0x5c3317, x, 0.3*s, z);
    add(new Con(0.40*s,0.55*s,8), 0x1d5c1d, x, 0.88*s, z);
    add(new Con(0.32*s,0.50*s,8), 0x246b24, x, 1.18*s, z);
    add(new Con(0.22*s,0.44*s,8), 0x2d7a2d, x, 1.42*s, z);
  }
  addArvore(-9.0, -5.0, 1.6);
  addArvore(-9.0,  3.0, 1.2);
  addArvore( 7.0, -4.0, 1.4);
  addArvore( 7.0,  3.5, 1.0);
  addArvore( 5.5, -6.5, 1.8);

  // Arbustos ornamentais na fachada
  var mArb = mat(0x2d6e2d);
  [[-3.5,0],[3.5,0],[-1,0],[1,0]].forEach(function(p){
    var b=new THREE.Mesh(new Sph(0.28,8,8),mArb);
    b.scale.y=0.65; b.position.set(p[0],0.25,3.1); b.castShadow=true; scene.add(b);
  });

  // Luminária de jardim
  function addLuminaria(x,z){
    add(new Cyl(0.04,0.04,1.2,8), 0x333333, x, 0.6, z);
    add(new Cyl(0.15,0.05,0.12,8),0x444444, x, 1.22,z);
    var lJar = new THREE.PointLight(0xffee88, 0.6, 3);
    lJar.position.set(x, 1.3, z); scene.add(lJar);
  }
  addLuminaria( 1.8, 5.5);
  addLuminaria(-1.0, 5.5);
  addLuminaria( 3.5, 2.0);

  // Piscina (fundo turquesa)
  add(new Box(4.0, 0.15, 3.0), 0x006b8f,  6.5, 0.05, -4.0);
  var aguaGeo = new Box(3.85, 0.08, 2.85);
  var aguaMat = new THREE.MeshStandardMaterial({color:0x00b4d8,transparent:true,opacity:0.7,metalness:0.1,roughness:0.0,
    emissive:new THREE.Color(0x003d5c),emissiveIntensity:0.3});
  var agua = new THREE.Mesh(aguaGeo, aguaMat);
  agua.position.set(6.5, 0.12, -4.0); scene.add(agua);
  // Borda da piscina
  add(new Box(4.3,0.1,0.1), 0xd4cfc8, 6.5,0.14,-2.4);
  add(new Box(4.3,0.1,0.1), 0xd4cfc8, 6.5,0.14,-5.6);
  add(new Box(0.1,0.1,3.1), 0xd4cfc8, 4.55,0.14,-4.0);
  add(new Box(0.1,0.1,3.1), 0xd4cfc8, 8.45,0.14,-4.0);
  // Luz subaquática
  var luzPiscina = new THREE.PointLight(0x00ccff, 1.2, 5);
  luzPiscina.position.set(6.5, 0.3, -4.0); scene.add(luzPiscina);

  // Estrelas
  var nS=400, sPos=new Float32Array(nS*3);
  for(var si=0;si<nS*3;si+=3){sPos[si]=(Math.random()-0.5)*80;sPos[si+1]=12+Math.random()*25;sPos[si+2]=(Math.random()-0.5)*80;}
  var sGeo=new THREE.BufferGeometry();
  sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
  var stars=new THREE.Points(sGeo,new THREE.PointsMaterial({color:0xffffff,size:0.12}));
  scene.add(stars);

  // ============================================================
  // ARDUINO + ELETRÔNICA (lado direito da casa)
  // ============================================================
  add(new Box(3.4,0.09,2.5), 0x111111, 11.5, 0.045, 0);
  add(new Box(1.15,0.07,0.8),0x006633, 11.2, 0.115, 0.2, {metalness:0.2});
  add(new Box(0.30,0.06,0.24),0x111111,11.15,0.18,  0.22);
  for(var pp=0;pp<7;pp++){
    add(new Cyl(0.013,0.013,0.13,6),0xbbbbbb,10.70,0.18,-0.16+pp*0.11,{metalness:0.8});
    add(new Cyl(0.013,0.013,0.13,6),0xbbbbbb,11.70,0.18,-0.16+pp*0.11,{metalness:0.8});
  }
  add(new Box(0.18,0.1,0.3),0xbbbbbb,10.65,0.15,0.22,{metalness:0.8});
  var jack=new THREE.Mesh(new Cyl(0.065,0.065,0.16,8),mat(0x111111));
  jack.rotation.z=Math.PI/2; jack.position.set(10.65,0.14,-0.22); scene.add(jack);

  add(new Box(0.9,0.07,0.62),0xf0eecc,11.6,0.115,-0.72);
  for(var br=0;br<5;br++) for(var bc=0;bc<5;bc++)
    add(new Cyl(0.011,0.011,0.08,6),0x111111,11.25+bc*0.15,0.115,-0.96+br*0.1);

  var mLedR=new THREE.MeshStandardMaterial({color:0xff2222,emissive:new THREE.Color(0xff0000),emissiveIntensity:1.0});
  var mLedG=new THREE.MeshStandardMaterial({color:0x22ff44,emissive:new THREE.Color(0x00ff22),emissiveIntensity:1.0});
  var mLedB=new THREE.MeshStandardMaterial({color:0x4488ff,emissive:new THREE.Color(0x2244ff),emissiveIntensity:1.0});
  var mMet =new THREE.MeshStandardMaterial({color:0xbbbbbb,metalness:0.8,roughness:0.3});

  function addLED(matL,x,z,cor){
    var l=new THREE.Mesh(new Sph(0.065,10,10),matL); l.position.set(x,0.22,z); l.castShadow=true; scene.add(l);
    var a=new THREE.Mesh(new Cyl(0.009,0.009,0.18,6),mMet); a.position.set(x-0.02,0.12,z); scene.add(a);
    var b=new THREE.Mesh(new Cyl(0.009,0.009,0.18,6),mMet); b.position.set(x+0.02,0.12,z); scene.add(b);
    var lz=new THREE.PointLight(cor,1.1,1.4); lz.position.set(x,0.25,z); scene.add(lz); return lz;
  }
  var luzR=addLED(mLedR,11.26,-0.66,0xff2200);
  var luzG=addLED(mLedG,11.44,-0.66,0x00ff22);
  var luzB=addLED(mLedB,11.62,-0.66,0x2244ff);

  add(new Box(0.25,0.09,0.25),0x006633,12.1,0.125,-0.4,{metalness:0.2});
  var mDome=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0.45,emissive:new THREE.Color(0x000000),emissiveIntensity:0});
  var pirDome=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,12,0,Math.PI*2,0,Math.PI/2),mDome);
  pirDome.position.set(12.1,0.17,-0.4); scene.add(pirDome);
  for(var ppi=0;ppi<3;ppi++) add(new Cyl(0.011,0.011,0.14,6),0xbbbbbb,12.02+ppi*0.08,0.09,-0.4,{metalness:0.8});
  var luzPIR=new THREE.PointLight(0xffaa00,0,2.0); luzPIR.position.set(12.1,0.55,-0.4); scene.add(luzPIR);

  fio(11.70,0.15,0.1, 11.82,0.28,-0.1,  0xff2200); fio(11.82,0.28,-0.1, 11.82,0.28,-0.64,0xff2200); fio(11.82,0.28,-0.64,11.70,0.14,-0.66,0xff2200);
  fio(11.70,0.15,0.22,11.92,0.26,0.02,  0x222222); fio(11.92,0.26,0.02, 11.92,0.26,-0.60,0x222222); fio(11.92,0.26,-0.60,11.78,0.14,-0.74,0x222222);
  fio(11.70,0.15,-0.10,11.95,0.30,-0.25,0xffdd00); fio(11.95,0.30,-0.25,12.10,0.20,-0.40,0xffdd00);
  fio(11.70,0.15,-0.22,11.88,0.28,-0.50,0x2244ff); fio(11.88,0.28,-0.50,11.62,0.14,-0.66,0x2244ff);
  fio(11.70,0.15, 0.02,11.86,0.26,-0.36,0x22cc44); fio(11.86,0.26,-0.36,11.44,0.14,-0.66,0x22cc44);

  // ============================================================
  // CÂMERA INICIAL — fachada frontal centralizada
  // A casa vai de X=-9 (garagem) a X=+7 (lateral dir) → centro visual ~X=-1.5
  // Fachada está em Z=+2.5  → ficar em frente: theta≈0 (olhando de Z+)
  // ============================================================
  target.set(-1.5, 2.8, 0);   // centro visual da fachada
  theta  = 0.0;                // olhando de frente (Z positivo)
  phi    = 0.28;               // ângulo ligeiramente acima do chão
  radius = 18;                 // distância que enquadra toda a fachada
  aplicarCamera();

  // ============================================================
  // PAINEL DE CONTROLES FLUTUANTES
  // ============================================================
  var uiBtnStyle =
    'background:rgba(81,43,82,0.88); color:#e4f5b1;' +
    'border:2px solid #7bb0a8; border-radius:14px;' +
    'padding:5px 12px; font-size:0.8rem; cursor:pointer;' +
    'font-family:Segoe UI,Arial,sans-serif;';

  // Barra de focos
  var barFoco = document.createElement('div');
  barFoco.setAttribute('style','position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:20;flex-wrap:wrap;justify-content:center;');
  var focos = [
    // Fachada frontal — olhando de frente, ligeiramente à direita para ver entrada + garagem
    {label:'🏠 Fachada', theta: 0.0,  phi: 0.28, r: 18,  tx: -1.5, ty: 2.8,  tz: 0},
    // Garagem — lateral esquerda, ângulo para ver o portão seccional
    {label:'🚗 Garagem', theta: 1.4,  phi: 0.22, r: 8,   tx: -6.6, ty: 1.4,  tz: 0.5},
    // Piscina — ângulo de cima para ver a água e borda
    {label:'🏊 Piscina', theta:-0.2,  phi: 0.6,  r: 7,   tx:  6.5, ty: 0.8,  tz:-4.0},
    // Arduino — bem próximo da plataforma eletrônica
    {label:'⚡ Arduino', theta:-0.25, phi: 0.45, r: 4.5, tx: 11.5, ty: 0.4,  tz: 0},
    // Geral — visão aérea 3/4 mostrando tudo: casa + garagem + jardim
    {label:'🌍 Geral',   theta: 0.3,  phi: 0.52, r: 28,  tx: -1.0, ty: 2.0,  tz: 0},
  ];
  focos.forEach(function(f){
    var b=document.createElement('button');
    b.textContent=f.label; b.setAttribute('style',uiBtnStyle);
    b.addEventListener('click',function(){theta=f.theta;phi=f.phi;radius=f.r;target.set(f.tx,f.ty,f.tz);aplicarCamera();});
    barFoco.appendChild(b);
  });
  container.appendChild(barFoco);

  // Botão Ortho e Enquadrar
  var btnOrtho=document.createElement('button');
  btnOrtho.textContent='📐 Ortho';
  btnOrtho.setAttribute('style','position:absolute;top:10px;right:10px;z-index:20;'+uiBtnStyle);
  btnOrtho.addEventListener('click',function(){
    modoOrtho=!modoOrtho; camera=modoOrtho?camOrtho:camPersp;
    btnOrtho.textContent=modoOrtho?'🎥 Perspectiva':'📐 Ortho';
    aplicarCamera();
  });
  container.appendChild(btnOrtho);

  var btnFit=document.createElement('button');
  btnFit.textContent='⊡ Enquadrar';
  btnFit.setAttribute('style','position:absolute;top:50px;right:10px;z-index:20;'+uiBtnStyle);
  btnFit.addEventListener('click',zoomToFit);
  container.appendChild(btnFit);

  // Setas de navegação
  var navS='background:rgba(99,82,116,0.82);color:#e4f5b1;border:2px solid #7bb0a8;border-radius:8px;'+
           'width:36px;height:36px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;'+
           'font-family:Segoe UI,Arial,sans-serif;user-select:none;';
  var barNav=document.createElement('div');
  barNav.setAttribute('style','position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:20;'+
    'display:grid;grid-template-columns:36px 36px 36px;grid-template-rows:36px 36px;gap:4px;');
  [{label:'▲',col:2,row:1,key:'ArrowUp'},{label:'◀',col:1,row:2,key:'ArrowLeft'},
   {label:'▼',col:2,row:2,key:'ArrowDown'},{label:'▶',col:3,row:2,key:'ArrowRight'}
  ].forEach(function(d){
    var b=document.createElement('button'); b.textContent=d.label;
    b.setAttribute('style',navS+'grid-column:'+d.col+';grid-row:'+d.row+';');
    var iv=null;
    function start(e){e.preventDefault();if(iv)return;doNav(d.key);iv=setInterval(function(){doNav(d.key);},80);}
    function stop(e){if(e)e.preventDefault();clearInterval(iv);iv=null;}
    b.addEventListener('mousedown',start);b.addEventListener('mouseup',stop);b.addEventListener('mouseleave',stop);
    b.addEventListener('touchstart',start,{passive:false});b.addEventListener('touchend',stop,{passive:false});
    barNav.appendChild(b);
  });
  container.appendChild(barNav);

  var barZoom=document.createElement('div');
  barZoom.setAttribute('style','position:absolute;bottom:10px;right:10px;z-index:20;display:flex;flex-direction:column;gap:4px;');
  [['＋','zoom-in'],['－','zoom-out']].forEach(function(d){
    var b=document.createElement('button');b.textContent=d[0];b.setAttribute('style',navS);
    var iv=null;
    function start(e){e.preventDefault();if(iv)return;doNav(d[1]);iv=setInterval(function(){doNav(d[1]);},80);}
    function stop(e){if(e)e.preventDefault();clearInterval(iv);iv=null;}
    b.addEventListener('mousedown',start);b.addEventListener('mouseup',stop);b.addEventListener('mouseleave',stop);
    b.addEventListener('touchstart',start,{passive:false});b.addEventListener('touchend',stop,{passive:false});
    barZoom.appendChild(b);
  });
  container.appendChild(barZoom);

  var hint=document.createElement('div');
  hint.innerHTML='🖱️ Esq: órbita &nbsp;|&nbsp; Dir: pan &nbsp;|&nbsp; Scroll: zoom &nbsp;|&nbsp; F: enquadrar &nbsp;|&nbsp; O: ortho';
  hint.setAttribute('style','position:absolute;bottom:56px;left:50%;transform:translateX(-50%);'+
    'color:#a7dbab;font-size:0.7rem;font-family:Segoe UI,Arial,sans-serif;'+
    'background:rgba(0,0,0,0.4);padding:3px 10px;border-radius:10px;pointer-events:none;z-index:20;white-space:nowrap;');
  container.appendChild(hint);

  function doNav(key){
    var SR=0.04, SZ=0.08;
    if(key==='ArrowLeft')  theta -= SR;
    if(key==='ArrowRight') theta += SR;
    // ArrowUp = camera goes UP (phi increases = higher angle above ground)
    // ArrowDown = camera comes DOWN (phi decreases toward horizon)
    // Floor at 0.05 rad (~3°) — prevents camera going below the ground plane
    if(key==='ArrowUp')   phi = clamp(phi + SR, 0.05, Math.PI/2 - 0.02);
    if(key==='ArrowDown') phi = clamp(phi - SR, 0.05, Math.PI/2 - 0.02);
    if(key==='zoom-in')  radius = clamp(radius * (1 - SZ), RADIUS_MIN, RADIUS_MAX);
    if(key==='zoom-out') radius = clamp(radius * (1 + SZ), RADIUS_MIN, RADIUS_MAX);
    aplicarCamera();
  }
  document.addEventListener('keydown',function(e){
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)!==-1){e.preventDefault();doNav(e.key);}
    if(e.key==='+'||e.key==='=') doNav('zoom-in');
    if(e.key==='-') doNav('zoom-out');
    if(e.key==='f'||e.key==='F') zoomToFit();
    if(e.key==='o'||e.key==='O') btnOrtho.click();
  });

  // ============================================================
  // ESTADO DOS COMPONENTES
  // ============================================================
  var estado={ledR:true,ledG:true,ledB:true,pir:true,luz:true};
  var btnIds={ledR:'btn-led-vermelho',ledG:'btn-led-verde',ledB:'btn-led-azul',pir:'btn-pir',luz:'btn-luz'};
  window.toggleComp=function(nome){
    estado[nome]=!estado[nome];
    var btn=document.getElementById(btnIds[nome]);
    if(btn) btn.classList.toggle('desligado',!estado[nome]);
    if(!estado[nome]){
      if(nome==='ledR'){mLedR.emissiveIntensity=0;luzR.intensity=0;}
      if(nome==='ledG'){mLedG.emissiveIntensity=0;luzG.intensity=0;}
      if(nome==='ledB'){mLedB.emissiveIntensity=0;luzB.intensity=0;}
      if(nome==='pir') {luzPIR.intensity=0;mDome.emissiveIntensity=0;}
      if(nome==='luz') {luzCasa.intensity=0;mVidro.emissiveIntensity=0;}
    }
  };

  // ============================================================
  // 1. SISTEMA RGB
  // ============================================================
  var corRGBAtual=new THREE.Color(0xffdd88);
  window.setCorRGB=function(hex){
    var cor=new THREE.Color(hex); corRGBAtual.copy(cor);
    luzCasa.color.copy(cor); mVidro.emissive.copy(cor);
    if(estado.luz) mVidro.emissiveIntensity=0.14;
  };

  // ============================================================
  // 2. CENAS PRÉ-DEFINIDAS
  // ============================================================
  var cenaFesta=false;
  window.setCena=function(nome){
    cenaFesta=false;
    if(nome==='cinema'){
      luzCasa.color.setHex(0x1a0a2e); luzCasa.intensity=0.3;
      mLedR.emissiveIntensity=0;luzR.intensity=0; estado.ledR=false;
      mLedG.emissiveIntensity=0;luzG.intensity=0; estado.ledG=false;
      mLedB.emissiveIntensity=0;luzB.intensity=0; estado.ledB=false;
      scene.fog.near=12; scene.fog.far=28;
      mVidro.emissive.setHex(0x1a0a2e); mVidro.emissiveIntensity=0.06;
      mLedFaixa.emissive.setHex(0x220044); mLedFaixa.emissiveIntensity=0.4;
    } else if(nome==='leitura'){
      luzCasa.color.setHex(0xfff5e0); luzCasa.intensity=2.5;
      estado.ledG=true; mLedG.emissiveIntensity=1.8; luzG.intensity=2.2;
      estado.ledR=false; mLedR.emissiveIntensity=0; luzR.intensity=0;
      estado.ledB=false; mLedB.emissiveIntensity=0; luzB.intensity=0;
      scene.fog.near=28; scene.fog.far=50;
      mVidro.emissive.setHex(0xfff5e0); mVidro.emissiveIntensity=0.18;
      mLedFaixa.emissive.setHex(0xffffff); mLedFaixa.emissiveIntensity=0.8;
    } else if(nome==='festa'){
      cenaFesta=true; luzCasa.color.setHex(0xff00ff); luzCasa.intensity=1.8;
      estado.ledR=true; estado.ledG=true; estado.ledB=true;
      scene.fog.near=28; scene.fog.far=50;
    }
  };

  // ============================================================
  // 3. CICLO DIA/NOITE
  // ============================================================
  var cicloDiaNOite=false, horaVirtual=Math.PI;
  var corCeuDia=new THREE.Color(0x87ceeb), corCeuNoite=new THREE.Color(0x0d1b2a);
  window.toggleDiaNOite=function(){
    cicloDiaNOite=!cicloDiaNOite;
    var btn=document.getElementById('btn-dia-noite');
    if(btn) btn.textContent=cicloDiaNOite?'⏸ Parar Ciclo':'☀️ Ciclo Dia/Noite';
  };
  function atualizarDiaNOite(){
    if(!cicloDiaNOite) return;
    horaVirtual=(horaVirtual+0.002)%(Math.PI*2);
    var isDia=horaVirtual<Math.PI, tFase=isDia?(horaVirtual/Math.PI):((horaVirtual-Math.PI)/Math.PI);
    var corAt=new THREE.Color();
    corAt.lerpColors(isDia?corCeuNoite:corCeuDia, isDia?corCeuDia:corCeuNoite, tFase);
    scene.background.copy(corAt); scene.fog.color.copy(corAt);
    ambientLight.intensity = isDia ? (0.4+1.1*tFase) : (1.5-1.1*tFase);
    sunLight.intensity     = isDia ? (0.1+1.7*tFase) : (1.8-1.7*tFase);
    if(!isDia && estado.luz) luzCasa.intensity=1.4+0.6*tFase;
    var btn=document.getElementById('btn-dia-noite');
    if(btn){
      var e2=isDia?(tFase>0.5?'☀️':'🌅'):'🌙';
      if(!cicloDiaNOite) return;
      btn.textContent=e2+' Parar Ciclo';
    }
  }

  // ============================================================
  // 4. SIMULADOR DE PRESENÇA
  // ============================================================
  var presencaAtiva=false, presencaTimer=0;
  window.togglePresenca=function(){
    presencaAtiva=!presencaAtiva;
    var btn=document.getElementById('btn-presenca');
    if(btn){btn.textContent=presencaAtiva?'🏃 Presença ON':'🚶 Simular Presença';btn.classList.toggle('ativo',presencaAtiva);}
    if(!presencaAtiva){luzQuarto.intensity=0;luzCozinha.intensity=0;}
  };
  function atualizarPresenca(dt){
    if(!presencaAtiva) return;
    presencaTimer+=dt;
    if(presencaTimer<3.0) return;
    presencaTimer=0;
    if(estado.luz) luzCasa.intensity   = Math.random()>0.3 ? 0.8+Math.random()*1.4 : 0.2+Math.random()*0.4;
    luzQuarto.intensity  = Math.random()>0.5 ? 0.6+Math.random()*1.2 : 0;
    luzCozinha.intensity = Math.random()>0.55? 0.5+Math.random()*1.0 : 0;
  }

  // ============================================================
  // 5. CONSUMO DE ENERGIA
  // ============================================================
  var consumoTimer=0;
  function atualizarConsumo(dt){
    consumoTimer+=dt;
    if(consumoTimer<1.0) return;
    consumoTimer=0;
    var wSala=Math.round(luzCasa.intensity*15);
    var wQuarto=Math.round(luzQuarto.intensity*12);
    var wCozinha=Math.round(luzCozinha.intensity*10);
    var wTotal=wSala+wQuarto+wCozinha;
    var eS=document.getElementById('w-sala'),eQ=document.getElementById('w-quarto'),
        eC=document.getElementById('w-cozinha'),eT=document.getElementById('w-total');
    if(eS) eS.textContent=wSala;
    if(eQ) eQ.textContent=wQuarto;
    if(eC) eC.textContent=wCozinha;
    if(eT){eT.textContent=wTotal;eT.style.color=wTotal<30?'#a7dbab':wTotal<60?'#ffe066':'#ff4444';}
  }

  // ============================================================
  // LOOP DE ANIMAÇÃO
  // ============================================================
  var t=0,pirTimer=0,pirPulso=false,lastTime=performance.now();
  function loop(){
    requestAnimationFrame(loop);
    var now=performance.now(), dt=(now-lastTime)/1000; lastTime=now;
    t+=0.02;

    // LEDs Arduino
    if(estado.ledR){var vR=cenaFesta?8:3,iR=0.3+0.7*Math.abs(Math.sin(t*vR));mLedR.emissiveIntensity=iR;luzR.intensity=iR*1.1;}
    if(estado.ledG){var vG=cenaFesta?9.5:2,iG=0.3+0.7*Math.abs(Math.sin(t*vG+1));mLedG.emissiveIntensity=iG;luzG.intensity=iG*1.1;}
    if(estado.ledB){var vB=cenaFesta?11:1.5,iB=0.3+0.7*Math.abs(Math.sin(t*vB+2.5));mLedB.emissiveIntensity=iB;luzB.intensity=iB*1.1;}

    // PIR
    if(estado.pir){
      pirTimer+=0.02;
      if(pirTimer>5&&!pirPulso){pirPulso=true;pirTimer=0;}
      if(pirPulso){
        var fade=Math.max(0,1-(pirTimer/1.8));
        luzPIR.intensity=fade*2.2;mDome.emissive.setHex(0xffaa00);mDome.emissiveIntensity=fade*0.9;
        if(pirTimer>1.8){pirPulso=false;mDome.emissiveIntensity=0;}
      }
    }

    // Luz da casa
    if(estado.luz&&!cicloDiaNOite&&!presencaAtiva&&!cenaFesta){
      luzCasa.intensity=1.1+0.25*Math.sin(t*0.6);
      mVidro.emissive.copy(corRGBAtual);
      mVidro.emissiveIntensity=0.12+0.04*Math.sin(t*0.6);
    } else if(!estado.luz){mVidro.emissiveIntensity=0;}

    // Modo festa — LEDs e faixas LED arco-íris
    if(cenaFesta){
      luzCasa.color.setHSL((t*0.08)%1,1,0.5);
      mVidro.emissive.copy(luzCasa.color);
      mVidro.emissiveIntensity=0.3+0.2*Math.abs(Math.sin(t*4));
      mLedFaixa.emissive.setHSL((t*0.06+0.3)%1,1,0.5);
      mLedFaixa.emissiveIntensity=1.0+0.5*Math.sin(t*5);
      luzLedFachada.color.setHSL((t*0.06)%1,1,0.5);
    }

    // LED fachada animado suave (fora da festa)
    if(!cenaFesta){
      mLedFaixa.emissiveIntensity=0.9+0.3*Math.sin(t*0.5);
    }

    // Piscina — brilho suave
    aguaMat.emissiveIntensity=0.2+0.1*Math.sin(t*0.8);
    luzPiscina.intensity=0.8+0.4*Math.sin(t*0.8);

    atualizarDiaNOite();
    atualizarPresenca(dt);
    atualizarConsumo(dt);

    stars.rotation.y=t*0.007;
    renderer.render(scene,camera);
  }
  loop();

  // ============================================================
  // RESPONSIVIDADE
  // ============================================================
  window.addEventListener('resize',function(){
    W=container.clientWidth; H=container.clientHeight;
    camPersp.aspect=W/H; camPersp.updateProjectionMatrix();
    renderer.setSize(W,H); aplicarCamera();
  });

});
