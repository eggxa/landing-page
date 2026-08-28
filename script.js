(function(){
  var canvas = document.getElementById('scene-canvas');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsGL = (function(){
    try{
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    }catch(e){ return false; }
  })();

  function readVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  if(!supportsGL || typeof THREE === 'undefined'){
    canvas.style.display = 'none';
    document.documentElement.style.setProperty('--rail-major','30,60,58');
  } else {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(0, 2.6, 12.5);
    camera.lookAt(0, 0.6, 0);

    function hexColor(str){
      str = str.trim();
      return new THREE.Color(str);
    }

    // ----- Rail grid (ground plane, converging lines) -----
    var gridSize = 60, gridDiv = 40;
    var grid = new THREE.GridHelper(gridSize, gridDiv, hexColor(readVar('--grid-major')), hexColor(readVar('--grid-minor')));
    grid.position.y = -2.6;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);

    // Two brighter "rail" lines running toward horizon
    function makeRailLine(xOffset, color){
      var pts = [];
      for(var z=-30; z<=14; z+=1){ pts.push(new THREE.Vector3(xOffset, -2.58, z)); }
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      var mat = new THREE.LineBasicMaterial({ color: color, transparent:true, opacity:0.55 });
      return new THREE.Line(geo, mat);
    }
    var railColor = hexColor(readVar('--grid-major'));
    var railL = makeRailLine(-1.4, railColor);
    var railR = makeRailLine(1.4, railColor);
    scene.add(railL, railR);

    // ----- Central 3D body: sun (light mode) / moon (dark mode) -----
    var nodeGroup = new THREE.Group();
    scene.add(nodeGroup);
    nodeGroup.position.y = 0.9;

    function buildSunTexture(){
      var size = 256;
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var ctx = c.getContext('2d');
      var grad = ctx.createRadialGradient(size*0.42, size*0.38, size*0.04, size*0.5, size*0.5, size*0.58);
      grad.addColorStop(0, '#fff8db');
      grad.addColorStop(0.28, '#ffe08a');
      grad.addColorStop(0.58, '#ffab3d');
      grad.addColorStop(0.82, '#e8720f');
      grad.addColorStop(1, '#b8500a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      for(var i=0;i<260;i++){
        var x = Math.random()*size, y = Math.random()*size, r = 1 + Math.random()*2.4;
        ctx.beginPath();
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,220,0.14)' : 'rgba(110,40,0,0.14)';
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    function buildMoonTexture(){
      var w = 512, h = 256;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#cfd5da';
      ctx.fillRect(0, 0, w, h);
      for(var m=0;m<7;m++){
        var mx = Math.random()*w, my = Math.random()*h, mr = 22 + Math.random()*42;
        var g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        g.addColorStop(0, 'rgba(95,102,108,0.38)');
        g.addColorStop(1, 'rgba(95,102,108,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.fill();
      }
      for(var i=0;i<100;i++){
        var x = Math.random()*w, y = Math.random()*h, r = 2 + Math.random()*9;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(55,60,65,0.38)';
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(232,235,238,0.4)';
        ctx.arc(x - r*0.32, y - r*0.32, r*0.5, 0, Math.PI*2);
        ctx.fill();
      }
      var tex = new THREE.CanvasTexture(c);
      return tex;
    }

    var sunTexture = buildSunTexture();
    var moonTexture = buildMoonTexture();

    var bodyGeo = new THREE.SphereGeometry(2.4, 48, 32);
    var sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
    var moonMaterial = new THREE.MeshStandardMaterial({ map: moonTexture, roughness:0.95, metalness:0.0 });
    var celestialBody = new THREE.Mesh(bodyGeo, sunMaterial);
    nodeGroup.add(celestialBody);

    // soft layered glow (visible for the sun, hidden for the moon)
    var glowGroup = new THREE.Group();
    [ [2.66, 0.28], [3.05, 0.16], [3.6, 0.08] ].forEach(function(cfg){
      var glowGeo = new THREE.SphereGeometry(cfg[0], 32, 24);
      var glowMat = new THREE.MeshBasicMaterial({
        color: 0xffab3d, transparent:true, opacity:cfg[1],
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite:false
      });
      glowGroup.add(new THREE.Mesh(glowGeo, glowMat));
    });
    nodeGroup.add(glowGroup);

    // moon needs real directional light to reveal a lit/shadowed terminator
    var moonKeyLight = new THREE.DirectionalLight(0xeaf1ff, 1.6);
    moonKeyLight.position.set(4.5, 2.2, 4);
    var moonFillLight = new THREE.AmbientLight(0x30506a, 0.55);
    scene.add(moonKeyLight, moonFillLight);
    moonKeyLight.visible = false;
    moonFillLight.visible = false;

    function applyCelestialTheme(isDark){
      celestialBody.material = isDark ? moonMaterial : sunMaterial;
      glowGroup.visible = !isDark;
      moonKeyLight.visible = isDark;
      moonFillLight.visible = isDark;
    }
    applyCelestialTheme(document.documentElement.getAttribute('data-theme') === 'dark');

    // ----- Rising particles (seeds / data motes) -----
    var particleCount = 220;
    var pGeo = new THREE.BufferGeometry();
    var pPos = new Float32Array(particleCount*3);
    var pSpeed = new Float32Array(particleCount);
    for(var p=0;p<particleCount;p++){
      var ang = Math.random()*Math.PI*2;
      var rad = 2 + Math.random()*7;
      pPos[p*3] = Math.cos(ang)*rad;
      pPos[p*3+1] = -2.6 + Math.random()*9;
      pPos[p*3+2] = Math.sin(ang)*rad - 4;
      pSpeed[p] = 0.15 + Math.random()*0.35;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({
      color: hexColor(readVar('--particle')),
      size: 0.05,
      transparent:true,
      opacity:0.75,
      sizeAttenuation:true
    });
    var particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    function resize(){
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    var mouseX = 0, mouseY = 0;
    window.addEventListener('pointermove', function(e){
      mouseX = (e.clientX / window.innerWidth - 0.5);
      mouseY = (e.clientY / window.innerHeight - 0.5);
    });

    var clock = new THREE.Clock();
    var speedMul = reduceMotion ? 0.15 : 1;

    function animate(){
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime() * speedMul;

      nodeGroup.rotation.y = t * 0.18;
      nodeGroup.rotation.x = Math.sin(t*0.3) * 0.12;
      nodeGroup.position.y = 0.9 + Math.sin(t*0.5) * 0.18;

      railL.material.opacity = 0.5 + Math.sin(t*0.8)*0.05;
      railR.material.opacity = 0.5 + Math.sin(t*0.8+1)*0.05;

      var posArr = pGeo.attributes.position.array;
      for(var i=0;i<particleCount;i++){
        posArr[i*3+1] += pSpeed[i]*0.01*speedMul;
        if(posArr[i*3+1] > 6.5){ posArr[i*3+1] = -2.6; }
      }
      pGeo.attributes.position.needsUpdate = true;
      particles.rotation.y = t*0.03;

      camera.position.x += ( mouseX*1.6 - camera.position.x ) * 0.03;
      camera.position.y += ( 2.6 - mouseY*0.8 - camera.position.y ) * 0.03;
      camera.lookAt(0, 0.6, 0);

      renderer.render(scene, camera);
    }
    animate();

    // theme-aware color updates
    window.__agrorailsUpdateSceneTheme = function(){
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyCelestialTheme(isDark);

      var newGridMajor = hexColor(readVar('--grid-major'));
      var newParticle = hexColor(readVar('--particle'));

      grid.material.color = newGridMajor;
      railL.material.color.copy(newGridMajor);
      railR.material.color.copy(newGridMajor);
      pMat.color.copy(newParticle);
    };
  }

  // ----- Theme toggle -----
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(prefersDark){ root.setAttribute('data-theme','dark'); }

  toggle.addEventListener('click', function(){
    var isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if(window.__agrorailsUpdateSceneTheme){
      setTimeout(window.__agrorailsUpdateSceneTheme, 50);
    }
  });

  // ----- Subscribe form -----
  var form = document.getElementById('subscribeForm');
  var emailInput = document.getElementById('subscribeEmail');
  var note = document.getElementById('subscribeNote');
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var value = emailInput.value.trim();
    if(!emailPattern.test(value)){
      note.textContent = 'Enter a valid email address.';
      note.className = 'subscribe-note error';
      emailInput.focus();
      return;
    }
    note.textContent = 'Redirecting you to confirm your subscription…';
    note.className = 'subscribe-note success';
    var subscribeUrl = 'https://agrorails.substack.com/subscribe?email=' + encodeURIComponent(value);
    window.open(subscribeUrl, '_blank', 'noopener');
  });
})();