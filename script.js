const PLANK_LENGTH = 400;          // px
const STORAGE_KEY = 'seesaw_second_state';
const MAX_ANGLE_VISUAL = 30;       // deg clamp for visual rotation
const ANGLE_SCALE = 10;            // divisor for angle calculation
const GRAVITY = 2600;              // px/s^2 - tuned for pleasing speed

/* DOM */
const stage = document.getElementById('stage');
const plank = document.getElementById('plank');
const leftWElement = document.getElementById('leftW');
const rightWElement = document.getElementById('rightW');
const nextWElement = document.getElementById('nextW');
const tiltUIElement = document.getElementById('tiltUI');
const logElement = document.getElementById('log');
const resetButton = document.getElementById('resetButton');


plank.style.width = PLANK_LENGTH + 'px';

let items = []; 
let falling = []; // { el, xAbs, y, vy, w }
let realAngle = 0;
let colorIdx = 0;
const COLORS = ['#60a5fa','#f97316','#10b981','#06b6d4','#ef4444','#8b5cf6','#f59e0b'];


//functions //

function clamp(v,a,b){ /*(num,min,max) */
    return Math.max(a, Math.min(b, v)); //cllamp func deger sikitirma
}
function randInt(a,b){
    return (Math.floor( Math.random() * (b-a+1) ) + a ); 
}
function sizeClass(w){
  /*agirliga gore css class doner */
    if(w<=3) 
        return 'small'; 
    if(w<=7) 
        return 'medium'; 
    return 'big';
}
function elWidth(w){ 
  /* element width px cinsinden agirliga gore */
    if(w<=3) 
        return 34;
    if(w<=7) 
        return 44;
    return 52;
}

/* Storage */
function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items })); 
}
function loadState(){
  /*begining */
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        /* parse */
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed.items)) 
          items = parsed.items;
      }
    }
    catch(e){
       items = []; 
    }
}

/* Rendering attached items */
function renderAttachedItems(){
  /* eski agirliklari temizleme */
  plank.querySelectorAll('.weight.attached').forEach(n => n.remove());
  items.forEach((item) => {
    const w = item.w;
    const divElement = document.createElement('div');
    divElement.className = 'weight attached ' + sizeClass(w);
    divElement.style.background = COLORS[item.colorIdx % COLORS.length];

    // left relative to plank: center + x -> convert to left coordinate (center px minus half element)
    const halfElement = elWidth(w) / 2;
    const leftPx = PLANK_LENGTH / 2 + item.x - halfElement;

    divElement.style.left = leftPx + 'px';
    divElement.style.top = '50%';
    divElement.style.transform = 'translateY(-50%)';
    divElement.textContent = w + 'kg';
    divElement.title = `${w} kg at ${Math.round(item.x)} px from center`;

    /* planka yapistirma */
    plank.appendChild(divElement);
  });
}

/* Tork hesaplama */
function computeTork(){

  let leftTork=0, rightTork=0, leftWeight=0, rightWeight=0;

  items.forEach(item=>{
    const d = Math.abs(item.x);
    if(item.x < 0){ 
      leftTork += item.w * d; 
      leftWeight += item.w;
    }
    else { 
      rightTork += item.w * d; 
      rightWeight += item.w; 
    }
  });

  return { leftTork, rightTork, leftWeight, rightWeight };
  
}

function recomputeRealAngle(){
  const { leftTork, rightTork } = computeTork();
  realAngle = (rightTork - leftTork) / ANGLE_SCALE;
}

/* UI ve  logging */
function log(msg){
  const e = document.createElement('div');
  e.className = 'log-entry';
  e.textContent = msg;
  logElement.prepend(e);
  
  // Çok fazla log birikirse eski kayıtları temizle
  while(logElement.children.length > 250) {
    logElement.lastChild.remove();
  }
}

function updateUI(){
  recomputeRealAngle();
  updateVisualRotation();
  renderAttachedItems();

  const { leftTork, rightTork, leftWeight, rightWeight } = computeTork();

  leftWElement.textContent = `Left: ${leftWeight.toFixed(1)} kg`;
  rightWElement.textContent = `Right: ${rightWeight.toFixed(1)} kg`;
  tiltUIElement.textContent = `Tilt: ${clamp(realAngle, -MAX_ANGLE_VISUAL, MAX_ANGLE_VISUAL).toFixed(1)}°`;
  nextWElement.textContent = `Next: ${nextWeight} kg`;
  
  saveState();
}

function updateVisualRotation() {
  const vis = clamp(realAngle, -MAX_ANGLE_VISUAL, MAX_ANGLE_VISUAL);
  /*plankin donusunu css ile ayarlama */
  plank.style.transform = `translateX(-50%) rotate(${vis}deg)`;
}

function resetAll() {
  
  for (const w of plank.querySelectorAll('.weight')) {
    /* planka yapistirilmis agirliklari Domdan kaldırıyor */
    w.remove();
  }
  /* dusen agirliklari domdan kaldirma */
  for (const obj of falling) {
    obj.el.remove();
  }

  /* state sifirlama */
  falling = [];
  items = [];
  realAngle = 0;

  /* arayuzu guncelleme */
  renderAttachedItems();
  updateVisualRotation();
  updateUI();
  saveState();
  /* log ekranini temizleme */
  logElement.innerHTML = '';
}


/* Spawn on click */
let nextWeight = randInt(1,10);
nextWElement.textContent = `Next: ${nextWeight} kg`;

function onPlankClick(e){
  /* Get click position from user */
  const clickX = e.clientX;
  const stageRect = stage.getBoundingClientRect();
  const spawnY = stageRect.top + 22; // 22px ustunde spawn olacak 

  /* Create falling element */
  const element = document.createElement('div');
  element.className = 'weight ' + sizeClass(nextWeight);
  element.style.background = COLORS[colorIdx % COLORS.length];

  const radius = elWidth(nextWeight) / 2;
  element.style.left = (clickX - stageRect.left - radius) + 'px';
  element.style.top = (spawnY - stageRect.top) + 'px';
  element.textContent = nextWeight + 'kg';
  element.dataset.w = nextWeight;
  stage.appendChild(element);

  falling.push({
    el: element,
    xAbs: clickX,
    y: spawnY - stageRect.top,
    vy: 0,
    w: nextWeight
  });

  // compute x from plank center for log 
  //plankRect=left top width height dan olusuyor
  const plankRect = plank.getBoundingClientRect();
  /* center point hesaplandi plankin */
  const centerX = plankRect.left + (plankRect.width / 2);
  let x = Math.round(clickX - centerX);
  let y = Math.abs(x);

  /* log part */
  
  let side ='left';
  if(x > 0) side ='right';
  log(`${nextWeight}kg dropped on ${side} at ${y}px from center `);

  colorIdx++;
  nextWeight = randInt(1,10);
  nextWElement.textContent = `Next: ${nextWeight} kg`;

  startLoop();
}

let rafId = null;
let lastTime = 0;

function startLoop() {
  if (rafId) return;
  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);
}

function frame(time) {
  const dt = (time - lastTime) / 1000 || 0.001;
  lastTime = time;

  if (falling.length) { /*dusen agirlik var mı? */
    const rect = plank.getBoundingClientRect();
    const midX = rect.left + rect.width * 0.5;
    const midY = rect.top + rect.height * 0.5;

    const a = clamp(realAngle, -MAX_ANGLE_VISUAL, MAX_ANGLE_VISUAL);
    const rad = a * Math.PI / 180;
    /* egim hesaplama */
    const slope = Math.tan(rad);

    
    for (let i = falling.length - 1; i >= 0; i--) {
        const drop = falling[i];
        drop.vy += GRAVITY * dt;/* hizlanma */
        /*v = v + g * dt */
        drop.y += drop.vy * dt;

        const stageBox = stage.getBoundingClientRect();
        const px = drop.xAbs;
        const py = stageBox.top + drop.y;
        const plankY = midY + slope * (px - midX);

        const r = elWidth(drop.w) * 0.5;
        const bottomY = py + r;

      /* carpisma kontrolu  -2 tolerans degeri*/
      if (bottomY >= plankY - 2) {
        /*framede planka carptigi durum */
        /*agirligin x konumu hesabi ve planka sabitleme */
        const xx = clamp(px - midX, -(PLANK_LENGTH / 2 - 6), (PLANK_LENGTH / 2 - 6));
        items.push({ x: xx, w: drop.w, colorIdx: (colorIdx + COLORS.length - 1) % COLORS.length });
        
        /* dusenleri cikarma */
        drop.el.remove();
        falling.splice(i, 1);

        /* fizik islemleri ve ekran guncellemeleri */
        recomputeRealAngle();
        renderAttachedItems();
        updateVisualRotation();
        updateUI();
        saveState();
      } else {
        /* framede planka carpmadi ise konumu guncelle */
        drop.el.style.top = drop.y + 'px';
        drop.el.style.left = (drop.xAbs - stageBox.left - r) + 'px';
      }
    }
  }

  if (falling.length==0) { /* dusen agirlik kalmadi ise animasyonu durdur */
    cancelAnimationFrame(rafId);
    rafId = null;
  } else {
    rafId = requestAnimationFrame(frame);
  }
}



// Events 
plank.addEventListener('click', onPlankClick);
plank.addEventListener('touchstart', function(ev){
  if(ev.touches && ev.touches[0]) onPlankClick(ev.touches[0]);
}, {passive:true});
resetButton.addEventListener('click', resetAll);

/* Resize update */
window.addEventListener('resize', () => {
  const stageRect = stage.getBoundingClientRect();
  falling.forEach(obj => {
    const r = elWidth(obj.w)/2;
    obj.el.style.left = (obj.xAbs - stageRect.left - r) + 'px';
  });
});

/* Functions Init*/
loadState();
renderAttachedItems();
recomputeRealAngle();
updateVisualRotation();
updateUI();
window.addEventListener('beforeunload', () => saveState());