const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const gameCanvasWrap=document.getElementById('gameStage');
ctx.imageSmoothingEnabled=false;
const TILE=64,COLS=70,ROWS=70,MIN_VISIBLE_TILES=5,MAX_VISIBLE_TILES=12;
let visibleTiles=Math.max(MIN_VISIBLE_TILES,Math.min(MAX_VISIBLE_TILES,Number(localStorage.getItem('visibleTiles')||8)||8));
let CANVAS_SIZE=TILE*visibleTiles;
function applyCanvasSize(){CANVAS_SIZE=TILE*visibleTiles;canvas.width=CANVAS_SIZE;canvas.height=CANVAS_SIZE}
applyCanvasSize();
let game=null,busy=false,anim={heroX:0,heroY:0,targetX:0,targetY:0,t:1};
let selectedClass='yunque';
let selectedRace='humano';
// 'hardcode' = the 16 built-in classes/skills; 'advanced' = only classes
// created in the admin editor (config_class), never a hardcoded fallback.
let selectedSkillMode='hardcode';
// Mandatory at character creation, no default: 'classic' (one action/turn)
// or 'ap' (action-point pool). Mirrors/feeds worldParams().apMode via
// apModeOn() once the character exists - see start() and apModeOn().
let selectedCombatMode=null;
let selectedDungeonWorld=null;
let currentCharacter=null;
let multiSessionId=null;
let multiHeartbeatTimer=null;
let mpPendingAction=null;
let mpLobbySessionId=null;
let mpLobbyPollTimer=null;
let mpLobbyResuming=false;
let mpGamePollTimer=null;
let mpTradePollTimer=null;
let mpPollBusy=false;
let rtConfig=undefined,rtClient=null,rtChannel=null,rtChannelSessionId=null,rtReady=false;
const APP_VERSION='0.53.2';
let configItems=[];
let configClasses=[];
let configClassesLoaded=false,configClassesFetchInFlight=null;
let configFloors=[];
let configEnemyFamilies=[];
let configEnemyDetails=[];
const DEFAULT_WORLD_PARAMS={damageReceivedPct:100,damageDealtPct:100,lifePct:100,xpReceivedPct:100,enemyCountPct:100,enemyLootPct:100,floors:10,floorPlan:[],apMode:false};
const ENEMY_DAMAGE_BASE_MULT=.55;
const ENEMY_HP_BASE_MULT=.5;
const tierDefs={common:{label:'Común',color:'#ddd'},uncommon:{label:'Infrecuente',color:'#75e39d'},rare:{label:'Raro',color:'#71b4ff'},epic:{label:'Épico',color:'#d68cff'},legendary:{label:'Legendario',color:'#ffb746'},artifact:{label:'Artefacto',color:'#ff4d4d'}};
const raceDefs={"humano": {"name": "Humano Desafortunado", "origin": "Canalla", "desc": "No destaca en nada salvo en meterse donde no debe.", "trait": "+10% de experiencia.", "bonuses": {"xpMult": 1.1}}, "enano": {"name": "Enano de la Forja Negra", "origin": "Alta fantasía", "desc": "Terco, blindado y convencido de que todo problema admite un martillo.", "trait": "+3 de armadura y +8 de vida.", "bonuses": {"armor": 3, "maxHp": 8}}, "elfoNocturno": {"name": "Elfo de la Luna Rota", "origin": "Alta fantasía", "desc": "Un exiliado de los bosques plateados con demasiados enemigos y muy pocas disculpas.", "trait": "+2 AGI, +1 SAB y +4% de evasión.", "bonuses": {"agility": 2, "wisdom": 1, "dodge": 4}}, "orcoLibre": {"name": "Orco de Compañía Libre", "origin": "Alta fantasía", "desc": "Mercenario, duelista y saqueador profesional. Cobra por adelantado.", "trait": "+2 FUE, +1 VIT y +8% de daño físico.", "bonuses": {"strength": 2, "vitality": 1, "physicalPower": 8}}, "draconido": {"name": "Dracónido de Brasa Azul", "origin": "Alta fantasía", "desc": "Su linaje promete dragones. De momento aporta humo, escamas y mal carácter.", "trait": "+1 FUE, +2 VIT y resistencia convertida en +2 armadura.", "bonuses": {"strength": 1, "vitality": 2, "armor": 2}}, "mediano": {"name": "Mediano Rompebolsas", "origin": "Canalla", "desc": "Pequeño, rápido y absolutamente incapaz de dejar un bolsillo sin revisar.", "trait": "+2 SUE, +1 AGI y +12% de hallazgo de rareza.", "bonuses": {"luck": 2, "agility": 1, "rarityFind": 12}}, "tiefling": {"name": "Tiefling de Taberna", "origin": "Alta fantasía", "desc": "Sangre infernal, sonrisa impecable y una deuda en cada reino conocido.", "trait": "+2 INT, +1 SUE y +8% de poder mágico.", "bonuses": {"intelligence": 2, "luck": 1, "magicPower": 8}}, "silvano": {"name": "Silvano de Corteza Férrea", "origin": "Alta fantasía", "desc": "Un espíritu del bosque que aprendió que la diplomacia funciona mejor con raíces gruesas.", "trait": "+2 VIT, +1 SAB y regeneración de vida al cambiar de piso.", "bonuses": {"vitality": 2, "wisdom": 1, "floorHeal": 10}}, "sintetico": {"name": "Sintético de Callejón", "origin": "Ciberpunk", "desc": "Construido con piezas legales, ilegales y varias que niegan haberlo conocido.", "trait": "+1 INT, +1 AGI, +10 stamina y +8 maná.", "bonuses": {"intelligence": 1, "agility": 1, "maxStamina": 10, "maxMana": 8}}, "neonita": {"name": "Neonita del Subnivel", "origin": "Ciberpunk", "desc": "Mutante urbano criado bajo anuncios luminosos y tuberías que nunca dejaron de gotear.", "trait": "+2 AGI, +1 SUE y +6% de crítico.", "bonuses": {"agility": 2, "luck": 1, "critChance": 6}}, "gnomoCable": {"name": "Gnomo Cableado", "origin": "Ciberpunk", "desc": "Ingeniero diminuto con seis herramientas, tres implantes y cero respeto por las garantías.", "trait": "+2 INT, +1 SAB y regeneración superior de maná.", "bonuses": {"intelligence": 2, "wisdom": 1, "manaRegen": 3}}, "cambiapieles": {"name": "Cambiapieles de los Bajos Fondos", "origin": "Canalla", "desc": "Imita caras, voces y firmas. El problema es recordar cuál era la suya.", "trait": "+1 a AGI, SUE e INT; +5% de evasión.", "bonuses": {"agility": 1, "luck": 1, "intelligence": 1, "dodge": 5}}};

const classDefs={
 yunque:{name:'Yunque de Guerra',desc:'Tanque ofensivo que convierte armadura en daño y aguanta combates prolongados.',stats:{strength:4,vitality:5,agility:1,luck:2,intelligence:1,wisdom:3},skills:['smash','fortify'],resourceBias:'stamina'},
 berserker:{name:'Berserker de Neón Roto',desc:'Furia tribal amplificada por implantes que fallan a mitad de combate.',stats:{strength:5,vitality:4,agility:3,luck:1,intelligence:1,wisdom:2},skills:['smash','charge'],resourceBias:'stamina'},
 necromancer:{name:'Nigromante de Datos',desc:'Levanta cadáveres de servidores caídos; sus muertos vivientes ejecutan órdenes corruptas.',stats:{strength:1,vitality:2,agility:1,luck:2,intelligence:5,wisdom:4},skills:['quake','lootMagnet','manaBolt'],resourceBias:'mana'},
 paladin:{name:'Paladín de Circuito Sagrado',desc:'Jura lealtad a un dios compilado en firmware.',stats:{strength:4,vitality:5,agility:1,luck:2,intelligence:1,wisdom:4},skills:['fortify','smash'],resourceBias:'hybrid'},
 jester:{name:'Bufón del Vacío',desc:'Magia del caos disfrazada de comedia; ni él sabe si cura o mata.',stats:{strength:1,vitality:2,agility:3,luck:5,intelligence:2,wisdom:1},skills:['taunt','lootMagnet'],resourceBias:'mana'},
 sniper:{name:'Francotirador Rúnico',desc:'Rifle grabado con runas y mira táctica de una corporación extinta.',stats:{strength:2,vitality:2,agility:5,luck:3,intelligence:3,wisdom:1},skills:['charge','execute','manaBolt'],resourceBias:'stamina'},
 shaman:{name:'Chamán de la Estática',desc:'Escucha espíritus en el ruido blanco de máquinas rotas.',stats:{strength:1,vitality:2,agility:1,luck:3,intelligence:3,wisdom:5},skills:['quake','taunt','chainSpark'],resourceBias:'mana'},
 thief:{name:'Ladrón Cuántico',desc:'Un glitch en su traje le permite fase parcial entre paredes.',stats:{strength:1,vitality:1,agility:5,luck:4,intelligence:3,wisdom:1},skills:['charge','lootMagnet'],resourceBias:'hybrid'},
 cleric:{name:'Clérigo del Silicio Roto',desc:'Sirve a un dios cuyo templo es un servidor colapsado.',stats:{strength:2,vitality:3,agility:1,luck:2,intelligence:2,wisdom:5},skills:['fortify','taunt','holyCircuit'],resourceBias:'mana'},
 entropyMage:{name:'Mago de Entropía',desc:'Cada hechizo acelera la descomposición de algo cercano.',stats:{strength:1,vitality:1,agility:2,luck:2,intelligence:5,wisdom:3},skills:['quake','ironRain','chainSpark'],resourceBias:'mana'},
 bountyHunter:{name:'Cazarrecompensas Implantado',desc:'Mercenario con prótesis de combate y contrato eterno.',stats:{strength:3,vitality:3,agility:4,luck:2,intelligence:2,wisdom:1},skills:['charge','execute','shockTrap'],resourceBias:'stamina'},
 druid:{name:'Druida del Chatarral',desc:'Habla con la naturaleza crecida entre escombros radiactivos.',stats:{strength:2,vitality:4,agility:2,luck:1,intelligence:2,wisdom:4},skills:['fortify','quake'],resourceBias:'hybrid'},
 monk:{name:'Monje del Bucle Infinito',desc:'Atrapado en un ciclo de tiempo que solo él percibe.',stats:{strength:3,vitality:3,agility:4,luck:1,intelligence:1,wisdom:3},skills:['charge','fortify'],resourceBias:'stamina'},
 engineer:{name:'Ingeniero Alquímico',desc:'Mezcla pólvora, código y reactivos inestables.',stats:{strength:1,vitality:2,agility:2,luck:3,intelligence:5,wisdom:2},skills:['ironRain','lootMagnet','scrapGrenade'],resourceBias:'mana'},
 seer:{name:'Vidente del Abismo Digital',desc:'Ve el futuro por pantallas rotas, a costa de su cordura.',stats:{strength:1,vitality:1,agility:1,luck:4,intelligence:3,wisdom:5},skills:['taunt','quake','spiritWolf'],resourceBias:'mana'},
 beastGuardian:{name:'Guardián Bestial Aumentado',desc:'Vincula su mente a criaturas con implantes cibernéticos.',stats:{strength:3,vitality:4,agility:3,luck:1,intelligence:1,wisdom:3},skills:['smash','charge'],resourceBias:'stamina'}
};

const itemTypes={equipment:'Equipo',potion:'Poción'};
const potionEffectLabels={heal:'Cura',regen:'Regeneración',stamina:'Recuperación stamina',mana:'Recuperación maná',temporaryStats:'Incremento temporal de stats',permanentStats:'Incremento permanente de stats',learnSkill:'Aprender habilidad',teleportSafe:'Teletransporte a sala segura',teleportStairs:'Teletransporte a escalera de piso',invulnerable:'Invulnerabilidad',invisible:'Invisibilidad'};
const potionStatKeys=['strength','vitality','agility','luck','intelligence','wisdom'];
const slots=['weapon','offhand','head','chest','hands','legs','boots','neck','ring1','ring2','trinket1','trinket2'];
const slotNames={weapon:'Arma',offhand:'Mano secundaria',head:'Cabeza',chest:'Pecho',hands:'Manos',legs:'Piernas',boots:'Botas',neck:'Cuello',ring1:'Anillo I',ring2:'Anillo II',trinket1:'Trinket I',trinket2:'Trinket II'};
const itemBases={
 weapon:['Martillo de auditoría','Yunque portátil','Grapadora táctica','Pico de recaudación','Maza de atención ciudadana','Hacha de notificación','Espada de alegaciones','Porra de contratación','Cuchara de asedio','Llave inglesa vorpal'],
 offhand:['Tapa de alcantarilla','Escudo de bandeja','Archivador blindado','Caldera de parada','Libro contable reforzado','Señal de tráfico defensiva'],
 head:['Casco de olla','Yelmo de interventor','Capucha antiburocracia','Corona de tornillos','Máscara del bedel','Cubrecabezas de amianto'],
 chest:['Peto de caldera','Cota de tapas','Chaleco de multas','Coraza de expediente','Armadura de persiana','Pechera de máquina recreativa'],
 hands:['Guantes de obra eterna','Manoplas de sello oficial','Dedales de demolición','Guantes de cobre','Puños del conserje','Manos de goma táctica'],
 legs:['Grebas de tubería','Pantalones de emergencia','Leotardos del catastro','Rodilleras de ventanilla','Falda de placas','Perneras de semáforo'],
 boots:['Botas de expediente','Zuecos de asedio','Chanclas de evasión','Botines del ujier','Calzado de obra mayor','Zapatos con grapas'],
 neck:['Collar de llaves inútiles','Medallón del turno perdido','Cadena de incidencias','Amuleto de fotocopia','Gargantilla de sellos','Diente del archivero'],
 ring1:['Anillo fiscal','Sortija del formulario','Aro de silencio','Sello de guardia','Anillo del plazo','Sortija de incidencias'],
 ring2:['Anillo fiscal','Sortija del formulario','Aro de silencio','Sello de guardia','Anillo del plazo','Sortija de incidencias'],
 trinket1:['Calcetín de poder','Ticket eterno','Piedra con ojos','Grapa bendecida','Mini extintor','Tornillo cantor'],
 trinket2:['Tornillo del destino','Miniatura del jefe','Cupón caducado','Llave sin cerradura','Dado de nómina','Sello de caucho vivo']
};
const prefixes=['Abollado','Furioso','Municipal','Radiactivo','Fiscal','Prohibido','Cuántico','Con olor a jefe','Garantizado','Sospechosamente húmedo'];
const rarities=[
 {name:'common',label:'Común',weight:48,color:'#ddd',affixes:[1,2],passives:0,effects:0,mult:1.00},
 {name:'uncommon',label:'Infrecuente',weight:27,color:'#75e39d',affixes:[2,3],passives:.15,effects:0,mult:1.15},
 {name:'rare',label:'Raro',weight:15,color:'#71b4ff',affixes:[3,4],passives:.45,effects:.12,mult:1.35},
 {name:'epic',label:'Épico',weight:8,color:'#d68cff',affixes:[4,5],passives:.85,effects:.42,mult:1.65},
 {name:'legendary',label:'Legendario',weight:2,color:'#ffb746',affixes:[5,6],passives:1,effects:1,mult:2.10},
 {name:'artifact',label:'Artefacto',weight:.6,color:'#ff4d4d',affixes:[6,7],passives:1,effects:1,mult:2.65,secondPassive:.75}
];
const LOOT_RARITY_ORDER=rarities.map(r=>r.name);
// Item tier (1-5) derived from rarity, used to scale guaranteed offhand
// bonuses (shield block%, wand/dagger regen) - common=1 up to legendary=5,
// artifact capped at 5 since only 5 tiers of bonus are defined.
function rarityTierIndex(rarityName){return Math.max(1,Math.min(5,LOOT_RARITY_ORDER.indexOf(rarityName)+1))}
function shieldBlockForRarity(rarityName){return rarityTierIndex(rarityName)*5}
function offhandRegenForRarity(rarityName){return rarityTierIndex(rarityName)*3}
// Left-hand (offhand) items now come in 3 kinds: shields (guaranteed block%),
// wands (guaranteed mana regen) and daggers (guaranteed stamina regen, dual
// wielded in the offhand alongside a main-hand weapon). Detected from an
// explicit item.offhandKind when set (crafted items), else guessed from name/
// weapon type text - same regex-based convention used elsewhere for wands.
function detectOffhandKind(item){
 if(item.offhandKind)return item.offhandKind;
 const text=`${item.name||''} ${item.weaponType||''} ${item.weaponCategory||''}`;
 if(/varita/i.test(text))return 'wand';
 if(/daga/i.test(text))return 'dagger';
 return 'shield';
}
function applyOffhandGuarantee(item){
 if(!item||item.slot!=='offhand')return item;
 item.offhandKind=detectOffhandKind(item);
 item.affixes=item.affixes||[];
 if(item.offhandKind==='shield'){
  const v=shieldBlockForRarity(item.rarity);
  const existing=item.affixes.find(a=>a.key==='blockChance');
  if(existing)existing.value=Math.max(existing.value,v);else item.affixes.push({key:'blockChance',label:'Prob. de bloqueo',value:v,percent:true});
 }else if(item.offhandKind==='wand'){
  const v=offhandRegenForRarity(item.rarity);
  const existing=item.affixes.find(a=>a.key==='manaRegen');
  if(existing)existing.value=Math.max(existing.value,v);else item.affixes.push({key:'manaRegen',label:'Regeneración de maná',value:v,percent:false});
 }else if(item.offhandKind==='dagger'){
  const v=offhandRegenForRarity(item.rarity);
  const existing=item.affixes.find(a=>a.key==='staminaRegen');
  if(existing)existing.value=Math.max(existing.value,v);else item.affixes.push({key:'staminaRegen',label:'Regeneración de stamina',value:v,percent:false});
 }
 return item;
}
const LOOT_RARITY_MIN_PLAYER_LEVEL={common:1,uncommon:1,rare:1,epic:4,legendary:9,artifact:14};
const LOOT_RARITY_BASE_WEIGHTS={common:72,uncommon:22,rare:6,epic:0,legendary:0,artifact:0};
function lootProgressRatio(floor,totalFloors){return totalFloors<=1?1:(Math.max(1,Number(floor)||1)-1)/(Math.max(1,Number(totalFloors)||1)-1)}
function maxLootRarityIndexForProgress(floor,totalFloors,playerLevel=1){
 const ratio=lootProgressRatio(floor,totalFloors),level=Number(playerLevel)||1;
 let idx=2;
 if(ratio>=.22||level>=LOOT_RARITY_MIN_PLAYER_LEVEL.epic)idx=3;
 if(ratio>=.55&&level>=LOOT_RARITY_MIN_PLAYER_LEVEL.legendary)idx=4;
 if(ratio>=.82&&level>=LOOT_RARITY_MIN_PLAYER_LEVEL.artifact)idx=5;
 return Math.min(idx,LOOT_RARITY_ORDER.length-1);
}
function lootIlvlRangeForProgress(floor,totalFloors,playerLevel=1){
 const f=Math.max(1,Number(floor)||1),lvl=Math.max(1,Number(playerLevel)||1),ratio=lootProgressRatio(f,totalFloors),base=Math.max(1,Math.round(lvl+f*.85));
 return {min:Math.max(1,Math.floor(base+ratio*2)-1),max:Math.max(1,Math.ceil(base+2+ratio*5))};
}
function lootProgressionRow(floor,totalFloors,playerLevel=1){
 const maxIndex=maxLootRarityIndexForProgress(floor,totalFloors,playerLevel),range=lootIlvlRangeForProgress(floor,totalFloors,playerLevel),ratio=lootProgressRatio(floor,totalFloors);
 const weights={...LOOT_RARITY_BASE_WEIGHTS};
 weights.common=Math.max(20,Math.round(72-ratio*54));
 weights.uncommon=Math.max(16,Math.round(22+ratio*14));
 weights.rare=Math.max(6,Math.round(6+ratio*16));
 weights.epic=maxIndex>=3?Math.max(1,Math.round((ratio-.18)*18)):0;
 weights.legendary=maxIndex>=4?Math.max(1,Math.round((ratio-.50)*9)):0;
 weights.artifact=maxIndex>=5?Math.max(1,Math.round((ratio-.78)*5)):0;
 for(let i=maxIndex+1;i<LOOT_RARITY_ORDER.length;i++)weights[LOOT_RARITY_ORDER[i]]=0;
 return {floor,totalFloors,minCharacterLevel:playerLevel,itemLevel:range,allowedRarities:LOOT_RARITY_ORDER.slice(0,maxIndex+1),rarityWeights:weights};
}
function createLootProgressionTable(totalFloors){return Array.from({length:Math.max(1,Number(totalFloors)||1)},(_,i)=>lootProgressionRow(i+1,totalFloors,Math.max(1,Math.ceil((i+1)/2))))}
function currentLootProgressionRow(floor=game?.floor||1,level=game?.player?.level||1){const table=selectedDungeonWorld?.world_json?.lootTable||game?.worldLootTable;if(table?.[floor-1])return lootProgressionRow(floor,table.length,level);return lootProgressionRow(floor,worldParams().floors||DEFAULT_WORLD_PARAMS.floors,level)}
function lootRarityAllowed(name,row){return (row?.allowedRarities||LOOT_RARITY_ORDER).includes(name)}

const skillDefs={
 smash:{rarity:'common',enemyUsable:true,name:'Golpe de Yunque',icon:'⚒',desc:'Daño en las 8 casillas adyacentes.',cd:4,unlock:'Inicial',resource:'stamina',cost:18,type:'physical'},
 fortify:{rarity:'common',enemyUsable:true,name:'Fortificar',icon:'▣',desc:'Escudo temporal basado en Vitalidad.',cd:6,unlock:'Inicial',resource:'stamina',cost:14,type:'physical'},
 charge:{rarity:'uncommon',enemyUsable:true,name:'Embestida',icon:'➤',desc:'Avanza hasta 3 casillas y golpea.',cd:4,unlock:'Nivel 2',resource:'stamina',cost:16,type:'physical'},
 quake:{rarity:'rare',enemyUsable:true,name:'Terremoto',icon:'✹',desc:'Daño a enemigos a 2 casillas.',cd:7,unlock:'Nivel 3',resource:'mana',cost:22,type:'magic'},
 taunt:{rarity:'uncommon',enemyUsable:true,name:'Insulto estructural',icon:'☠',desc:'Atrae enemigos visibles y reduce su daño.',cd:7,unlock:'Logro: 3 enemigos a la vez',resource:'mana',cost:16,type:'magic'},
 execute:{rarity:'rare',enemyUsable:true,name:'Cláusula de demolición',icon:'✂',desc:'Gran daño contra enemigos con poca vida.',cd:5,unlock:'Nivel 5',resource:'stamina',cost:24,type:'physical'},
 lootMagnet:{rarity:'uncommon',enemyUsable:true,name:'Imán de porquería',icon:'✦',desc:'Abre cofres cercanos y recoge llaves.',cd:8,unlock:'Logro: 5 cofres',resource:'mana',cost:18,type:'magic'},
 ironRain:{rarity:'epic',enemyUsable:true,name:'Lluvia de hierro',icon:'☄',desc:'Golpea aleatoriamente enemigos visibles.',cd:9,unlock:'Derrotar al primer jefe',resource:'mana',cost:30,type:'magic'},
 arcSlash:{"name": "Tajo de Arco", "icon": "◒", "desc": "Golpea hasta tres enemigos frente a ti.", "cd": 3, "unlock": "Botín", "resource": "stamina", "cost": 14, "type": "physical", "rarity": "common"},
 ironHook:{"name": "Gancho de Hierro", "icon": "⌁", "desc": "Atrae un enemigo visible hacia ti.", "cd": 4, "unlock": "Botín", "resource": "stamina", "cost": 12, "type": "physical", "rarity": "common"},
 quickStep:{"name": "Paso de Emergencia", "icon": "»", "desc": "Desplazamiento corto sin provocar respuesta inmediata.", "cd": 4, "unlock": "Botín", "resource": "stamina", "cost": 10, "type": "physical", "rarity": "common"},
 manaBolt:{"name": "Perno de Maná", "icon": "✧", "desc": "Proyectil mágico contra el enemigo visible más cercano.", "cd": 2, "unlock": "Botín", "resource": "mana", "cost": 10, "type": "magic", "rarity": "common"},
 healingPulse:{"name": "Pulso Reparador", "icon": "✚", "desc": "Recupera una pequeña cantidad de vida.", "cd": 5, "unlock": "Botín", "resource": "mana", "cost": 16, "type": "magic", "rarity": "common"},
 rustCloud:{"name": "Nube de Óxido", "icon": "☁", "desc": "Reduce temporalmente la armadura de enemigos cercanos.", "cd": 5, "unlock": "Botín", "resource": "mana", "cost": 14, "type": "magic", "rarity": "uncommon"},
 shockTrap:{"name": "Trampa de Descarga", "icon": "⌗", "desc": "Daña y puede aturdir a un enemigo adyacente.", "cd": 5, "unlock": "Botín", "resource": "mana", "cost": 15, "type": "magic", "rarity": "uncommon"},
 bloodRush:{"name": "Acelerón Hemático", "icon": "♥", "desc": "Sacrifica vida para recuperar stamina.", "cd": 6, "unlock": "Botín", "resource": "mana", "cost": 8, "type": "magic", "rarity": "uncommon"},
 mirrorWard:{"name": "Barrera Espejo", "icon": "◇", "desc": "Obtienes escudo y reflejas parte del siguiente golpe.", "cd": 6, "unlock": "Botín", "resource": "mana", "cost": 18, "type": "magic", "rarity": "uncommon"},
 scrapGrenade:{"name": "Granada de Chatarra", "icon": "●", "desc": "Explosión en área alrededor de un enemigo visible.", "cd": 5, "unlock": "Botín", "resource": "stamina", "cost": 18, "type": "physical", "rarity": "uncommon"},
 chainSpark:{"name": "Chispa Encadenada", "icon": "ϟ", "desc": "Salta entre varios enemigos visibles.", "cd": 5, "unlock": "Botín", "resource": "mana", "cost": 19, "type": "magic", "rarity": "rare"},
 voidBlink:{"name": "Parpadeo del Vacío", "icon": "◈", "desc": "Teletransporte corto a una casilla libre.", "cd": 6, "unlock": "Botín", "resource": "mana", "cost": 20, "type": "magic", "rarity": "rare"},
 boneArmor:{"name": "Armadura de Hueso", "icon": "♜", "desc": "Aumenta mucho la armadura durante varios turnos.", "cd": 7, "unlock": "Botín", "resource": "mana", "cost": 21, "type": "magic", "rarity": "rare"},
 toxicEdge:{"name": "Filo Tóxico", "icon": "☣", "desc": "Tu siguiente golpe aplica daño adicional.", "cd": 5, "unlock": "Botín", "resource": "stamina", "cost": 17, "type": "physical", "rarity": "rare"},
 spiritWolf:{"name": "Lobo de Estática", "icon": "◆", "desc": "Invoca un golpe espiritual sobre el enemigo más débil.", "cd": 6, "unlock": "Botín", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare"},
 gravityWell:{"name": "Pozo Gravitatorio", "icon": "◎", "desc": "Agrupa enemigos cercanos y les inflige daño.", "cd": 7, "unlock": "Botín", "resource": "mana", "cost": 24, "type": "magic", "rarity": "rare"},
 bulletTime:{"name": "Tiempo de Bala", "icon": "◷", "desc": "Reduce el tiempo de respuesta enemiga y mejora evasión.", "cd": 8, "unlock": "Botín", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare"},
 holyCircuit:{"name": "Circuito Consagrado", "icon": "✥", "desc": "Cura y daña a no muertos visibles.", "cd": 7, "unlock": "Botín", "resource": "mana", "cost": 25, "type": "magic", "rarity": "epic"},
 entropyWave:{"name": "Onda de Entropía", "icon": "≋", "desc": "Daño mágico masivo que escala con Inteligencia.", "cd": 8, "unlock": "Botín", "resource": "mana", "cost": 28, "type": "magic", "rarity": "epic"},
 quantumThief:{"name": "Hurto Cuántico", "icon": "⌘", "desc": "Roba vida, maná y oro al enemigo objetivo.", "cd": 7, "unlock": "Botín", "resource": "mana", "cost": 24, "type": "magic", "rarity": "epic"},
 neonRage:{"name": "Furia de Neón", "icon": "Ψ", "desc": "Aumenta daño físico y crítico durante varios turnos.", "cd": 9, "unlock": "Botín", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "epic"},
 corpseProtocol:{"name": "Protocolo Cadáver", "icon": "☠", "desc": "Explota un enemigo muerto recientemente contra los vivos.", "cd": 8, "unlock": "Botín", "resource": "mana", "cost": 27, "type": "magic", "rarity": "epic"},
 stormTotem:{"name": "Tótem de Tormenta", "icon": "♆", "desc": "Descargas repetidas sobre enemigos visibles.", "cd": 9, "unlock": "Botín", "resource": "mana", "cost": 30, "type": "magic", "rarity": "epic"},
 alchemicalNova:{"name": "Nova Alquímica", "icon": "✺", "desc": "Explosión elemental alrededor del jugador.", "cd": 8, "unlock": "Botín", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic"},
 chronoLoop:{"name": "Bucle Cronológico", "icon": "∞", "desc": "Restablece parcialmente vida y recursos al estado anterior.", "cd": 12, "unlock": "Botín", "resource": "mana", "cost": 35, "type": "magic", "rarity": "legendary"},
 blackSun:{"name": "Sol Negro", "icon": "✹", "desc": "Daño extremo a todos los enemigos visibles.", "cd": 12, "unlock": "Botín", "resource": "mana", "cost": 40, "type": "magic", "rarity": "legendary"},
 nineLives:{"name": "Nueve Errores", "icon": "⑨", "desc": "Evita una muerte y desencadena una onda de choque.", "cd": 15, "unlock": "Botín", "resource": "mana", "cost": 38, "type": "magic", "rarity": "legendary"},
 worldBreaker:{"name": "Rompepisos", "icon": "▰", "desc": "Golpe físico devastador en gran área.", "cd": 11, "unlock": "Botín", "resource": "stamina", "cost": 38, "type": "physical", "rarity": "legendary"},
 adminOverride:{"name": "Anulación Administrativa", "icon": "§", "desc": "Elimina enfriamientos y debilita a todos los enemigos.", "cd": 14, "unlock": "Botín", "resource": "mana", "cost": 42, "type": "magic", "rarity": "legendary"},
 lootSingularity:{"name": "Singularidad de Botín", "icon": "✦", "desc": "Absorbe cofres y mejora temporalmente la rareza encontrada.", "cd": 13, "unlock": "Botín", "resource": "mana", "cost": 36, "type": "magic", "rarity": "legendary"},
 arcaneLantern:{"name": "Linterna Arcana", "icon": "☀", "desc": "Revela una amplia zona del mapa alrededor del personaje.", "cd": 8, "unlock": "Botín", "resource": "mana", "cost": 14, "type": "utility", "rarity": "common", "range": 0},
 phaseKey:{"name": "Llave de Fase", "icon": "⚿", "desc": "Abre puertas cercanas, incluso si están cerradas con llave.", "cd": 10, "unlock": "Botín", "resource": "mana", "cost": 20, "type": "utility", "rarity": "uncommon", "range": 4},
 mistStep:{"name": "Paso de Bruma", "icon": "≈", "desc": "Te teletransporta a una casilla libre visible cercana.", "cd": 7, "unlock": "Botín", "resource": "mana", "cost": 18, "type": "utility", "rarity": "rare", "range": 6},
 cleanse:{"name": "Purificación", "icon": "✤", "desc": "Elimina penalizaciones y recupera una pequeña cantidad de vida.", "cd": 9, "unlock": "Botín", "resource": "mana", "cost": 22, "type": "utility", "rarity": "uncommon", "range": 0},
 campfire:{"name": "Fuego de Campamento", "icon": "♨", "desc": "Recupera vida, maná y stamina, pero consume un turno.", "cd": 16, "unlock": "Botín", "resource": "mana", "cost": 12, "type": "utility", "rarity": "rare", "range": 0},
 treasureSense:{"name": "Olfato para el Tesoro", "icon": "◆", "desc": "Revela cofres, llaves y recompensas cercanas en el minimapa.", "cd": 12, "unlock": "Botín", "resource": "mana", "cost": 16, "type": "utility", "rarity": "uncommon", "range": 10},
 shadowVeil:{"name": "Velo de Sombras", "icon": "◐", "desc": "Los enemigos ignoran tu siguiente movimiento.", "cd": 11, "unlock": "Botín", "resource": "mana", "cost": 24, "type": "utility", "rarity": "epic", "range": 0},
 transmute:{"name": "Transmutar Chatarra", "icon": "♲", "desc": "Convierte el objeto de menor calidad del inventario en oro.", "cd": 14, "unlock": "Botín", "resource": "mana", "cost": 20, "type": "utility", "rarity": "rare", "range": 0},
 recallRune:{"name": "Runa de Retorno", "icon": "⌂", "desc": "Te devuelve a la sala inicial del nivel.", "cd": 18, "unlock": "Botín", "resource": "mana", "cost": 28, "type": "utility", "rarity": "epic", "range": 0},
 dimensionalPocket:{"name": "Bolsillo Dimensional", "icon": "▧", "desc": "Abre automáticamente varios cofres explorados sin desplazarte.", "cd": 15, "unlock": "Botín", "resource": "mana", "cost": 30, "type": "utility", "rarity": "legendary", "range": 20},
 yunque_t1_1:{"name": "Martillazo Sísmico", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "yunque", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 yunque_t1_2:{"name": "Muralla Viviente", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "yunque", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 yunque_t1_3:{"name": "Ancla de Acero", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "yunque", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 yunque_t1_4:{"name": "Contraataque de Bastión", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "yunque", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'strength',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 yunque_t2_1:{"name": "Carga del Coloso", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "yunque", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 yunque_t2_2:{"name": "Piel de Fortaleza", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "yunque", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 yunque_t2_3:{"name": "Cadena Demoledora", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "yunque", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 yunque_t2_4:{"name": "Golpe de Contención", "icon": "⊙", "desc": "Golpea y aturde brevemente al objetivo.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "rare", "range": 1, "classId": "yunque", "tier": 2, "classEffect": "stun", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatCoef:1,apCost:11},
 yunque_t3_1:{"name": "Ciudadela Ambulante", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "yunque", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 yunque_t3_2:{"name": "Juicio de Hierro", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "yunque", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 yunque_t3_3:{"name": "Corazón Inquebrantable", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "yunque", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'strength',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 yunque_t3_4:{"name": "Cataclismo del Bastión", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "yunque", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 berserker_t1_1:{"name": "Cuchillada de Neón", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "berserker", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 berserker_t1_2:{"name": "Frenesí Callejero", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "berserker", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 berserker_t1_3:{"name": "Salto Rabioso", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "berserker", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 berserker_t1_4:{"name": "Sangre por Combustible", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "berserker", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'strength',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 berserker_t2_1:{"name": "Torbellino Magenta", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "berserker", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 berserker_t2_2:{"name": "Implante Sobrecargado", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "berserker", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 berserker_t2_3:{"name": "Aullido de Guerra", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "berserker", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 berserker_t2_4:{"name": "Tajo Frenético", "icon": "❣", "desc": "Golpe salvaje que abre una herida sangrante.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "rare", "range": 1, "classId": "berserker", "tier": 2, "classEffect": "dot", "targetMode": "enemy", "enemyUsable": true,dmgDice:1,dmgDie:6,dmgStat:'strength',dmgStatCoef:0.6,dotDice:1,dotDie:8,dotStat:'strength',dotStatCoef:0.5,dotTurns:5,apCost:11},
 berserker_t3_1:{"name": "Apocalipsis Rosa", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "berserker", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 berserker_t3_2:{"name": "Última Sobrecarga", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "berserker", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 berserker_t3_3:{"name": "Rabia Inmortal", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "berserker", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'strength',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 berserker_t3_4:{"name": "Carnicería de Neón", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "berserker", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 necromancer_t1_1:{"name": "Perno Funerario", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "necromancer", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 necromancer_t1_2:{"name": "Esqueleto de Datos", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "necromancer", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 necromancer_t1_3:{"name": "Marca Cadavérica", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "necromancer", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 necromancer_t1_4:{"name": "Drenaje de Memoria", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "necromancer", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'intelligence',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 necromancer_t2_1:{"name": "Explosión de Restos", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "necromancer", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 necromancer_t2_2:{"name": "Muro de Huesos", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "necromancer", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 necromancer_t2_3:{"name": "Legión Corrupta", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "necromancer", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 necromancer_t2_4:{"name": "Robo de Esencia", "icon": "⟳", "desc": "Drena vida y energía directamente del objetivo.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "necromancer", "tier": 2, "classEffect": "drain", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatCoef:1,apCost:11},
 necromancer_t3_1:{"name": "Reinicio de Cadáver", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "necromancer", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 necromancer_t3_2:{"name": "Trono del Archiliche", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "necromancer", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 necromancer_t3_3:{"name": "Cosecha de Almas", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "necromancer", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'intelligence',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 necromancer_t3_4:{"name": "Apagón de los Muertos", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "necromancer", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 paladin_t1_1:{"name": "Golpe Radiante", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "paladin", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 paladin_t1_2:{"name": "Escudo de Firmware", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "paladin", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 paladin_t1_3:{"name": "Rezo de Combate", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "paladin", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 paladin_t1_4:{"name": "Sello de Protección", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "paladin", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'strength',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 paladin_t2_1:{"name": "Lanza Solar", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "paladin", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 paladin_t2_2:{"name": "Aura de Valor", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "paladin", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 paladin_t2_3:{"name": "Juicio Compilado", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "paladin", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 paladin_t2_4:{"name": "Golpe de Absolución", "icon": "✝", "desc": "Castiga al enemigo y convierte el daño en curación.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "paladin", "tier": 2, "classEffect": "holyLeech", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatCoef:1,apCost:11},
 paladin_t3_1:{"name": "Cruzada de Circuitos", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "paladin", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 paladin_t3_2:{"name": "Resurrección Parcial", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "paladin", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 paladin_t3_3:{"name": "Bastión Sagrado", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "paladin", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'strength',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 paladin_t3_4:{"name": "Veredicto Celestial", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "paladin", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 jester_t1_1:{"name": "Carta Cortante", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "jester", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 jester_t1_2:{"name": "Broma Cruel", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "jester", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 jester_t1_3:{"name": "Paso de Bufón", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "jester", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 jester_t1_4:{"name": "Dado Trucado", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "jester", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'luck',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 jester_t2_1:{"name": "Confeti Explosivo", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "jester", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 jester_t2_2:{"name": "Risa Contagiosa", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "jester", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 jester_t2_3:{"name": "Sombrero Infinito", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "jester", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 jester_t2_4:{"name": "Truco de Manos", "icon": "⇄", "desc": "Intercambias posición con el objetivo y lo dejas confundido.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "jester", "tier": 2, "classEffect": "swapConfuse", "targetMode": "enemy", "enemyUsable": true,apCost:11},
 jester_t3_1:{"name": "Gran Chiste Final", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "jester", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 jester_t3_2:{"name": "Ruleta del Vacío", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "jester", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 jester_t3_3:{"name": "Ovación Mortal", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "jester", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'luck',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 jester_t3_4:{"name": "Caos de Camerino", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "jester", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'luck',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 sniper_t1_1:{"name": "Disparo Rúnico", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "sniper", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 sniper_t1_2:{"name": "Paso del Tirador", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "sniper", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 sniper_t1_3:{"name": "Marca de Presa", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "sniper", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 sniper_t1_4:{"name": "Ojo de Halcón", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "sniper", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'agility',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 sniper_t2_1:{"name": "Flecha Perforante", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "sniper", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 sniper_t2_2:{"name": "Trampa de Cazador", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "sniper", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 sniper_t2_3:{"name": "Descarga Gemela", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "sniper", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 sniper_t2_4:{"name": "Disparo Perforante", "icon": "➳", "desc": "Bala que atraviesa al objetivo con precisión letal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "rare", "range": 8, "classId": "sniper", "tier": 2, "classEffect": "lineShot", "targetMode": "enemy", "enemyUsable": true,dmgDice:3,dmgDie:8,dmgStat:'agility',dmgStatCoef:1,apCost:11},
 sniper_t3_1:{"name": "Tiro a Través del Mundo", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "sniper", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 sniper_t3_2:{"name": "Lluvia de Flechas", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "sniper", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 sniper_t3_3:{"name": "Ejecución Perfecta", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "sniper", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'agility',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 sniper_t3_4:{"name": "Horizonte Partido", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "sniper", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 shaman_t1_1:{"name": "Chispa Espiritual", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "shaman", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 shaman_t1_2:{"name": "Tótem Menor", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "shaman", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 shaman_t1_3:{"name": "Voz del Trueno", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "shaman", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 shaman_t1_4:{"name": "Piel de Tormenta", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "shaman", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'wisdom',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 shaman_t2_1:{"name": "Cadena de Relámpagos", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "shaman", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 shaman_t2_2:{"name": "Tótem Sanador", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "shaman", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 shaman_t2_3:{"name": "Paso del Viento", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "shaman", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 shaman_t2_4:{"name": "Tótem de Tormenta", "icon": "⚡", "desc": "Invoca un tótem que castiga a los enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "shaman", "tier": 2, "classEffect": "stormTotem", "targetMode": "area", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatCoef:0.8,apCost:12},
 shaman_t3_1:{"name": "Tempestad Ancestral", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "shaman", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 shaman_t3_2:{"name": "Avatar del Rayo", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "shaman", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 shaman_t3_3:{"name": "Consejo de Espíritus", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "shaman", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'wisdom',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 shaman_t3_4:{"name": "Cielo Quebrado", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "shaman", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 thief_t1_1:{"name": "Daga de Fase", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "thief", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 thief_t1_2:{"name": "Humo Cuántico", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "thief", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 thief_t1_3:{"name": "Paso Trasero", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "thief", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 thief_t1_4:{"name": "Dedos Ligeros", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "thief", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'agility',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 thief_t2_1:{"name": "Corte Imposible", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "thief", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 thief_t2_2:{"name": "Bomba de Sombra", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "thief", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 thief_t2_3:{"name": "Robo de Energía", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "thief", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 thief_t2_4:{"name": "Golpe desde las Sombras", "icon": "☾", "desc": "Te desvaneces y golpeas al objetivo dejándolo herido.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "thief", "tier": 2, "classEffect": "shadowStrike", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatCoef:1,dotDice:1,dotDie:6,dotStat:'agility',dotStatCoef:0.5,dotTurns:5,apCost:11},
 thief_t3_1:{"name": "Atraco Temporal", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "thief", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 thief_t3_2:{"name": "Evasión Absoluta", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "thief", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 thief_t3_3:{"name": "Mil Cortes", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "thief", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'agility',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 thief_t3_4:{"name": "Desaparición Cuántica", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "thief", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 cleric_t1_1:{"name": "Luz Reparadora", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "cleric", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 cleric_t1_2:{"name": "Maza Bendita", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "cleric", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 cleric_t1_3:{"name": "Barrera Piadosa", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "cleric", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 cleric_t1_4:{"name": "Cántico Breve", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "cleric", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'wisdom',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 cleric_t2_1:{"name": "Rayo de Silicio", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "cleric", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 cleric_t2_2:{"name": "Purga de Corrupción", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "cleric", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 cleric_t2_3:{"name": "Santuario Portátil", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "cleric", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 cleric_t2_4:{"name": "Silencio Sagrado", "icon": "⊘", "desc": "Golpea y silencia al objetivo, impidiendo su magia.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "cleric", "tier": 2, "classEffect": "silence", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatCoef:0.8,apCost:11},
 cleric_t3_1:{"name": "Resurrección de Emergencia", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "cleric", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 cleric_t3_2:{"name": "Diluvio Sagrado", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "cleric", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 cleric_t3_3:{"name": "Avatar del Templo", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "cleric", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'wisdom',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 cleric_t3_4:{"name": "Juicio del Dios Roto", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "cleric", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 entropyMage_t1_1:{"name": "Dardo Entrópico", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "entropyMage", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 entropyMage_t1_2:{"name": "Escudo Inestable", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "entropyMage", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 entropyMage_t1_3:{"name": "Paso Improbable", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "entropyMage", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 entropyMage_t1_4:{"name": "Desgaste Acelerado", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "entropyMage", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'intelligence',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 entropyMage_t2_1:{"name": "Onda de Ruina", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "entropyMage", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 entropyMage_t2_2:{"name": "Colapso Local", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "entropyMage", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 entropyMage_t2_3:{"name": "Robo de Tiempo", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "entropyMage", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 entropyMage_t2_4:{"name": "Eco de Entropía", "icon": "∿", "desc": "Inflige un daño que se repite en el tiempo.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "entropyMage", "tier": 2, "classEffect": "echoDot", "targetMode": "enemy", "enemyUsable": true,dmgDice:1,dmgDie:6,dmgStat:'intelligence',dmgStatCoef:0.6,dotDice:2,dotDie:6,dotStat:'intelligence',dotStatCoef:0.6,dotTurns:5,apCost:11},
 entropyMage_t3_1:{"name": "Fin Estadístico", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "entropyMage", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 entropyMage_t3_2:{"name": "Agujero de Entropía", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "entropyMage", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 entropyMage_t3_3:{"name": "Deshacer Realidad", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "entropyMage", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'intelligence',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 entropyMage_t3_4:{"name": "Muerte Térmica", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "entropyMage", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 bountyHunter_t1_1:{"name": "Tiro de Contrato", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "bountyHunter", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 bountyHunter_t1_2:{"name": "Red Magnética", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "bountyHunter", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 bountyHunter_t1_3:{"name": "Impulso de Cadera", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "bountyHunter", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 bountyHunter_t1_4:{"name": "Marca de Recompensa", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "bountyHunter", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'agility',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 bountyHunter_t2_1:{"name": "Granada Rastreadora", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "bountyHunter", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 bountyHunter_t2_2:{"name": "Doble Disparo", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "bountyHunter", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 bountyHunter_t2_3:{"name": "Blindaje Mercenario", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "bountyHunter", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 bountyHunter_t2_4:{"name": "Red de Captura", "icon": "⊠", "desc": "Inmoviliza al objetivo con una red de cazarrecompensas.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "rare", "range": 6, "classId": "bountyHunter", "tier": 2, "classEffect": "bountyRoot", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatCoef:1,apCost:11},
 bountyHunter_t3_1:{"name": "Caza Total", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "bountyHunter", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 bountyHunter_t3_2:{"name": "Misil de Bolsillo", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "bountyHunter", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 bountyHunter_t3_3:{"name": "Sentencia del Contrato", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "bountyHunter", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'agility',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 bountyHunter_t3_4:{"name": "Nadie Escapa", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "bountyHunter", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 druid_t1_1:{"name": "Espina de Chatarra", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "druid", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 druid_t1_2:{"name": "Corteza Reforzada", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "druid", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 druid_t1_3:{"name": "Raíz Enredadora", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "druid", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 druid_t1_4:{"name": "Brote Curativo", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "druid", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'wisdom',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 druid_t2_1:{"name": "Enjambre Metálico", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "druid", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 druid_t2_2:{"name": "Forma de Bestia", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "druid", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 druid_t2_3:{"name": "Bosque Improvisado", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "druid", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 druid_t2_4:{"name": "Enredadera Devoradora", "icon": "✤", "desc": "Raíces que inmovilizan y desangran al objetivo.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "druid", "tier": 2, "classEffect": "rootBleed", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatCoef:0.8,dotDice:1,dotDie:6,dotStat:'wisdom',dotStatCoef:0.5,dotTurns:5,apCost:11},
 druid_t3_1:{"name": "Avatar del Chatarral", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "druid", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 druid_t3_2:{"name": "Raíces del Mundo", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "druid", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 druid_t3_3:{"name": "Manada Aumentada", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "druid", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'wisdom',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 druid_t3_4:{"name": "Primavera Radiactiva", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "druid", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 monk_t1_1:{"name": "Puño del Instante", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "monk", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 monk_t1_2:{"name": "Paso Circular", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "monk", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 monk_t1_3:{"name": "Respiración Serena", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "monk", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 monk_t1_4:{"name": "Patada Repetida", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "monk", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'agility',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 monk_t2_1:{"name": "Eco del Golpe", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "monk", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 monk_t2_2:{"name": "Bucle Defensivo", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "monk", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 monk_t2_3:{"name": "Palma del Segundo Perdido", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "monk", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 monk_t2_4:{"name": "Golpe Sellado", "icon": "☯", "desc": "Marca al objetivo para amplificar el siguiente golpe.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "rare", "range": 1, "classId": "monk", "tier": 2, "classEffect": "comboMark", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'agility',dmgStatCoef:1,apCost:11},
 monk_t3_1:{"name": "Mil Puños Simultáneos", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "monk", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 monk_t3_2:{"name": "Detener el Turno", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "monk", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 monk_t3_3:{"name": "Regreso al Instante", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "monk", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'agility',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 monk_t3_4:{"name": "Rueda Infinita", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "monk", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 engineer_t1_1:{"name": "Pistola Alquímica", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "engineer", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 engineer_t1_2:{"name": "Torreta de Bolsillo", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "engineer", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 engineer_t1_3:{"name": "Mina Improvisada", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "engineer", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 engineer_t1_4:{"name": "Dron Reparador", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "engineer", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'intelligence',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 engineer_t2_1:{"name": "Lanzallamas Casero", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "engineer", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 engineer_t2_2:{"name": "Campo Magnético", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "engineer", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 engineer_t2_3:{"name": "Autómata de Guerra", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "engineer", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 engineer_t2_4:{"name": "Mina de Precisión", "icon": "☒", "desc": "Coloca una mina que detona con los enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 5, "classId": "engineer", "tier": 2, "classEffect": "trap", "targetMode": "area", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'intelligence',dmgStatCoef:1,apCost:12},
 engineer_t3_1:{"name": "Fábrica Instantánea", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "engineer", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 engineer_t3_2:{"name": "Cañón de Singularidad", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "engineer", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 engineer_t3_3:{"name": "Ejército Mecánico", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "engineer", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'intelligence',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 engineer_t3_4:{"name": "Reactor Prohibido", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "engineer", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 seer_t1_1:{"name": "Aguja Psíquica", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "seer", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 seer_t1_2:{"name": "Visión Cercana", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "seer", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 seer_t1_3:{"name": "Paso Predicho", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "seer", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 seer_t1_4:{"name": "Mal Augurio", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "seer", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'wisdom',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 seer_t2_1:{"name": "Rayo del Futuro", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "seer", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 seer_t2_2:{"name": "Espejo de Posibilidades", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "seer", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 seer_t2_3:{"name": "Destino Torcido", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "seer", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 seer_t2_4:{"name": "Marca del Destino", "icon": "☥", "desc": "Marca a un enemigo con un augurio fatal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "magic", "rarity": "rare", "range": 6, "classId": "seer", "tier": 2, "classEffect": "doomMark", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatCoef:0.8,apCost:11},
 seer_t3_1:{"name": "Profecía Cumplida", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "seer", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 seer_t3_2:{"name": "Detener la Catástrofe", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "seer", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 seer_t3_3:{"name": "Mil Futuros", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "seer", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'wisdom',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 seer_t3_4:{"name": "Fin Inevitable", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "seer", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14},
 beastGuardian_t1_1:{"name": "Garra Aumentada", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "beastGuardian", "tier": 1, "classEffect": "ranged", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:10},
 beastGuardian_t1_2:{"name": "Rugido Protector", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "beastGuardian", "tier": 1, "classEffect": "shield", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:0.8,buffTurns:5,apCost:9},
 beastGuardian_t1_3:{"name": "Salto de Depredador", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "beastGuardian", "tier": 1, "classEffect": "dash", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,apCost:8},
 beastGuardian_t1_4:{"name": "Olfato de Sangre", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "beastGuardian", "tier": 1, "classEffect": "debuff", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.8,debuffStat:'strength',debuffStatMode:'add',debuffStatCoef:3,debuffTurns:3,apCost:10},
 beastGuardian_t2_1:{"name": "Embate Bestial", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "beastGuardian", "tier": 2, "classEffect": "aoe", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.7,apCost:12},
 beastGuardian_t2_2:{"name": "Piel de Quimera", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "beastGuardian", "tier": 2, "classEffect": "heal", "enemyUsable": true,dmgDice:3,dmgDie:6,dmgStat:'vitality',dmgStatMode:'add',dmgStatCoef:1,apCost:9},
 beastGuardian_t2_3:{"name": "Manada Cibernética", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "beastGuardian", "tier": 2, "classEffect": "multihit", "enemyUsable": true,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:0.6,apCost:12},
 beastGuardian_t2_4:{"name": "Zarpazo Desgarrador", "icon": "⚔", "desc": "Zarpazo brutal que abre heridas profundas.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "physical", "rarity": "rare", "range": 1, "classId": "beastGuardian", "tier": 2, "classEffect": "hookBleed", "targetMode": "enemy", "enemyUsable": true,dmgDice:2,dmgDie:8,dmgStat:'strength',dmgStatCoef:1,dotDice:1,dotDie:8,dotStat:'strength',dotStatCoef:0.5,dotTurns:5,apCost:11},
 beastGuardian_t3_1:{"name": "Avatar de la Bestia", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "beastGuardian", "tier": 3, "classEffect": "ultimate", "enemyUsable": true,dmgDice:5,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.3,apCost:14},
 beastGuardian_t3_2:{"name": "Caza Salvaje", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "beastGuardian", "tier": 3, "classEffect": "execute", "enemyUsable": true,dmgDice:3,dmgDie:10,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.2,apCost:12},
 beastGuardian_t3_3:{"name": "Corazón de Alfa", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "beastGuardian", "tier": 3, "classEffect": "buff", "enemyUsable": true,buffStat:'strength',buffStatMode:'add',buffStatCoef:8,buffTurns:9,apCost:9},
 beastGuardian_t3_4:{"name": "Estampida Aumentada", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "beastGuardian", "tier": 3, "classEffect": "massive", "enemyUsable": true,dmgDice:5,dmgDie:8,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1.4,apCost:14}
};
const classSkillTrees={"yunque": {"I": ["yunque_t1_1", "yunque_t1_2", "yunque_t1_3", "yunque_t1_4"], "II": ["yunque_t2_1", "yunque_t2_2", "yunque_t2_3", "yunque_t2_4"], "III": ["yunque_t3_1", "yunque_t3_2", "yunque_t3_3", "yunque_t3_4"]}, "berserker": {"I": ["berserker_t1_1", "berserker_t1_2", "berserker_t1_3", "berserker_t1_4"], "II": ["berserker_t2_1", "berserker_t2_2", "berserker_t2_3", "berserker_t2_4"], "III": ["berserker_t3_1", "berserker_t3_2", "berserker_t3_3", "berserker_t3_4"]}, "necromancer": {"I": ["necromancer_t1_1", "necromancer_t1_2", "necromancer_t1_3", "necromancer_t1_4"], "II": ["necromancer_t2_1", "necromancer_t2_2", "necromancer_t2_3", "necromancer_t2_4"], "III": ["necromancer_t3_1", "necromancer_t3_2", "necromancer_t3_3", "necromancer_t3_4"]}, "paladin": {"I": ["paladin_t1_1", "paladin_t1_2", "paladin_t1_3", "paladin_t1_4"], "II": ["paladin_t2_1", "paladin_t2_2", "paladin_t2_3", "paladin_t2_4"], "III": ["paladin_t3_1", "paladin_t3_2", "paladin_t3_3", "paladin_t3_4"]}, "jester": {"I": ["jester_t1_1", "jester_t1_2", "jester_t1_3", "jester_t1_4"], "II": ["jester_t2_1", "jester_t2_2", "jester_t2_3", "jester_t2_4"], "III": ["jester_t3_1", "jester_t3_2", "jester_t3_3", "jester_t3_4"]}, "sniper": {"I": ["sniper_t1_1", "sniper_t1_2", "sniper_t1_3", "sniper_t1_4"], "II": ["sniper_t2_1", "sniper_t2_2", "sniper_t2_3", "sniper_t2_4"], "III": ["sniper_t3_1", "sniper_t3_2", "sniper_t3_3", "sniper_t3_4"]}, "shaman": {"I": ["shaman_t1_1", "shaman_t1_2", "shaman_t1_3", "shaman_t1_4"], "II": ["shaman_t2_1", "shaman_t2_2", "shaman_t2_3", "shaman_t2_4"], "III": ["shaman_t3_1", "shaman_t3_2", "shaman_t3_3", "shaman_t3_4"]}, "thief": {"I": ["thief_t1_1", "thief_t1_2", "thief_t1_3", "thief_t1_4"], "II": ["thief_t2_1", "thief_t2_2", "thief_t2_3", "thief_t2_4"], "III": ["thief_t3_1", "thief_t3_2", "thief_t3_3", "thief_t3_4"]}, "cleric": {"I": ["cleric_t1_1", "cleric_t1_2", "cleric_t1_3", "cleric_t1_4"], "II": ["cleric_t2_1", "cleric_t2_2", "cleric_t2_3", "cleric_t2_4"], "III": ["cleric_t3_1", "cleric_t3_2", "cleric_t3_3", "cleric_t3_4"]}, "entropyMage": {"I": ["entropyMage_t1_1", "entropyMage_t1_2", "entropyMage_t1_3", "entropyMage_t1_4"], "II": ["entropyMage_t2_1", "entropyMage_t2_2", "entropyMage_t2_3", "entropyMage_t2_4"], "III": ["entropyMage_t3_1", "entropyMage_t3_2", "entropyMage_t3_3", "entropyMage_t3_4"]}, "bountyHunter": {"I": ["bountyHunter_t1_1", "bountyHunter_t1_2", "bountyHunter_t1_3", "bountyHunter_t1_4"], "II": ["bountyHunter_t2_1", "bountyHunter_t2_2", "bountyHunter_t2_3", "bountyHunter_t2_4"], "III": ["bountyHunter_t3_1", "bountyHunter_t3_2", "bountyHunter_t3_3", "bountyHunter_t3_4"]}, "druid": {"I": ["druid_t1_1", "druid_t1_2", "druid_t1_3", "druid_t1_4"], "II": ["druid_t2_1", "druid_t2_2", "druid_t2_3", "druid_t2_4"], "III": ["druid_t3_1", "druid_t3_2", "druid_t3_3", "druid_t3_4"]}, "monk": {"I": ["monk_t1_1", "monk_t1_2", "monk_t1_3", "monk_t1_4"], "II": ["monk_t2_1", "monk_t2_2", "monk_t2_3", "monk_t2_4"], "III": ["monk_t3_1", "monk_t3_2", "monk_t3_3", "monk_t3_4"]}, "engineer": {"I": ["engineer_t1_1", "engineer_t1_2", "engineer_t1_3", "engineer_t1_4"], "II": ["engineer_t2_1", "engineer_t2_2", "engineer_t2_3", "engineer_t2_4"], "III": ["engineer_t3_1", "engineer_t3_2", "engineer_t3_3", "engineer_t3_4"]}, "seer": {"I": ["seer_t1_1", "seer_t1_2", "seer_t1_3", "seer_t1_4"], "II": ["seer_t2_1", "seer_t2_2", "seer_t2_3", "seer_t2_4"], "III": ["seer_t3_1", "seer_t3_2", "seer_t3_3", "seer_t3_4"]}, "beastGuardian": {"I": ["beastGuardian_t1_1", "beastGuardian_t1_2", "beastGuardian_t1_3", "beastGuardian_t1_4"], "II": ["beastGuardian_t2_1", "beastGuardian_t2_2", "beastGuardian_t2_3", "beastGuardian_t2_4"], "III": ["beastGuardian_t3_1", "beastGuardian_t3_2", "beastGuardian_t3_3", "beastGuardian_t3_4"]}};
const creativeClassSkillOverrides={"yunque_t1_1":{"name":"Golpe de Resonancia","icon":"⚒","desc":"Golpe pesado que aplica Quebradura: el objetivo recibe más daño físico.","resource":"stamina","cost":15,"type":"physical","range":4,"classEffect":"armorBreak","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"yunque_t1_2":{"name":"Pies de Plomo","icon":"▣","desc":"Te anclas al suelo: gran armadura y resistencia al empuje durante 5 turnos.","resource":"stamina","cost":17,"type":"utility","range":0,"classEffect":"buffArmor","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"yunque_t1_3":{"name":"Cadena del Bastión","icon":"⌁","desc":"Atrae al enemigo y lo inmoviliza junto a ti.","resource":"stamina","cost":18,"type":"physical","range":5,"classEffect":"pullRoot","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"yunque_t1_4":{"name":"Interposición","icon":"◆","desc":"Obtienes escudo y contraatacas automáticamente el siguiente golpe recibido.","resource":"stamina","cost":19,"type":"utility","range":0,"classEffect":"counter","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"yunque_t2_1":{"name":"Muro que Camina","icon":"▰","desc":"Avanzas en línea, empujando y dañando a los enemigos atravesados.","resource":"stamina","cost":23,"type":"physical","range":5,"classEffect":"bulldoze","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"yunque_t2_2":{"name":"Temblor de Cimientos","icon":"✹","desc":"Área sísmica que ralentiza y puede derribar.","resource":"stamina","cost":25,"type":"physical","range":4,"classEffect":"slowArea","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"yunque_t2_3":{"name":"Reparación de Campo","icon":"✚","desc":"Recupera vida en función de Vitalidad y restaura escudo.","resource":"stamina","cost":24,"type":"utility","range":0,"classEffect":"healShield","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"yunque_t2_4":{"name":"Zona de Exclusión","icon":"⊞","desc":"Crea una zona que inmoviliza al primer enemigo que entra.","resource":"stamina","cost":27,"type":"physical","range":5,"classEffect":"rootZone","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"yunque_t3_1":{"name":"Ciudadela Ambulante","icon":"♜","desc":"Invoca un guardián de hierro que lucha durante varios turnos.","resource":"stamina","cost":31,"type":"utility","range":0,"classEffect":"summon","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"yunque_t3_2":{"name":"Juicio del Yunque","icon":"☄","desc":"Martillazo de área cuyo daño aumenta con tu armadura.","resource":"stamina","cost":33,"type":"physical","range":5,"classEffect":"armorSlam","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"yunque_t3_3":{"name":"No Pasarán","icon":"⛉","desc":"Durante 7 turnos ganas armadura y curas una parte del daño bloqueado.","resource":"stamina","cost":34,"type":"utility","range":0,"classEffect":"fortress","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"yunque_t3_4":{"name":"Colapso de Fortaleza","icon":"✺","desc":"Gran área: daña, empuja e inmoviliza a todos los alcanzados.","resource":"stamina","cost":38,"type":"physical","range":6,"classEffect":"massRoot","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"berserker_t1_1":{"name":"Herida Abierta","icon":"⚔","desc":"Corte que provoca sangrado durante 4 turnos.","resource":"stamina","cost":14,"type":"physical","range":1,"classEffect":"bleed","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"berserker_t1_2":{"name":"Sangre por Velocidad","icon":"♥","desc":"Pierdes vida para ganar daño y movimiento durante 5 turnos.","resource":"stamina","cost":12,"type":"utility","range":0,"classEffect":"bloodBuff","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"berserker_t1_3":{"name":"Salto del Maniaco","icon":"➤","desc":"Saltas sobre un objetivo y aturdes a los adyacentes.","resource":"stamina","cost":18,"type":"physical","range":5,"classEffect":"leapStun","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"berserker_t1_4":{"name":"Aullido de Matadero","icon":"☠","desc":"Debilita el ataque de los enemigos cercanos y aumenta tu crítico.","resource":"stamina","cost":19,"type":"physical","range":3,"classEffect":"fearBuff","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"berserker_t2_1":{"name":"Torbellino Carmesí","icon":"⟳","desc":"Ataca varias veces a todos los enemigos adyacentes.","resource":"stamina","cost":23,"type":"physical","range":2,"classEffect":"spin","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"berserker_t2_2":{"name":"Sed de Dolor","icon":"Ψ","desc":"Durante 6 turnos te curas al causar daño.","resource":"stamina","cost":24,"type":"utility","range":0,"classEffect":"lifestealBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"berserker_t2_3":{"name":"Cadena de Vísceras","icon":"⌁","desc":"Atrae un enemigo, le aplica sangrado y recuperas stamina.","resource":"stamina","cost":25,"type":"physical","range":6,"classEffect":"hookBleed","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"berserker_t2_4":{"name":"Furia Incontrolable","icon":"⚡","desc":"El daño aumenta cada turno mientras permanezcas herido.","resource":"stamina","cost":27,"type":"utility","range":0,"classEffect":"rampage","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"berserker_t3_1":{"name":"Última Sobrecarga","icon":"☢","desc":"Sacrifica 30% de vida para multiplicar el daño de la siguiente habilidad.","resource":"stamina","cost":30,"type":"utility","range":0,"classEffect":"overcharge","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"berserker_t3_2":{"name":"Carnicería de Neón","icon":"✹","desc":"Cadena de golpes aleatorios que deja sangrando a cada víctima.","resource":"stamina","cost":34,"type":"physical","range":6,"classEffect":"bleedStorm","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"berserker_t3_3":{"name":"Demasiado Furioso para Morir","icon":"⑨","desc":"Durante 5 turnos, el primer golpe mortal te deja con 1 de vida.","resource":"stamina","cost":35,"type":"utility","range":0,"classEffect":"cheatDeath","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"berserker_t3_4":{"name":"Apocalipsis Rosa","icon":"☄","desc":"Explosión física masiva cuyo daño aumenta con la vida que te falta.","resource":"stamina","cost":39,"type":"physical","range":7,"classEffect":"missingHpNova","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"necromancer_t1_1":{"name":"Toque de Putrefacción","icon":"☠","desc":"Daño necrótico que se propaga durante 4 turnos.","resource":"mana","cost":14,"type":"magic","range":6,"classEffect":"dot","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"necromancer_t1_2":{"name":"Siervo Óseo","icon":"♙","desc":"Invoca un esqueleto que te acompaña y ataca.","resource":"mana","cost":18,"type":"utility","range":0,"classEffect":"summon","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"necromancer_t1_3":{"name":"Grilletes de Hueso","icon":"⌗","desc":"Inmoviliza al objetivo durante varios turnos.","resource":"mana","cost":17,"type":"magic","range":6,"classEffect":"root","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"necromancer_t1_4":{"name":"Drenar Recuerdos","icon":"◐","desc":"Roba vida y maná al objetivo.","resource":"mana","cost":18,"type":"magic","range":6,"classEffect":"drain","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"necromancer_t2_1":{"name":"Explosión Cadavérica","icon":"✺","desc":"Detona restos en un área y aplica putrefacción.","resource":"mana","cost":24,"type":"magic","range":6,"classEffect":"corpseExplosion","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"necromancer_t2_2":{"name":"Muro de Costillas","icon":"▥","desc":"Obtienes escudo; los enemigos adyacentes reciben daño al golpearte.","resource":"mana","cost":23,"type":"utility","range":0,"classEffect":"boneShield","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"necromancer_t2_3":{"name":"Peste Binaria","icon":"☣","desc":"Nube que aplica daño en el tiempo y reduce curación.","resource":"mana","cost":26,"type":"magic","range":6,"classEffect":"plague","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"necromancer_t2_4":{"name":"Segunda Muerte","icon":"∞","desc":"Marca un enemigo: si muere, regresa como aliado temporal.","resource":"mana","cost":28,"type":"magic","range":6,"classEffect":"raiseMark","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"necromancer_t3_1":{"name":"Legión Corrupta","icon":"♟","desc":"Invoca dos cadáveres de datos que combaten por ti.","resource":"mana","cost":32,"type":"utility","range":0,"classEffect":"multiSummon","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"necromancer_t3_2":{"name":"Marchitar Alma","icon":"◑","desc":"Reduce daño, defensa y velocidad del objetivo.","resource":"mana","cost":31,"type":"magic","range":7,"classEffect":"wither","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"necromancer_t3_3":{"name":"Protocolo Liche","icon":"♜","desc":"Durante 7 turnos, los hechizos curan y reducen cooldown.","resource":"mana","cost":34,"type":"utility","range":0,"classEffect":"lichBuff","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"necromancer_t3_4":{"name":"Apagón de los Vivos","icon":"✹","desc":"Todos los enemigos visibles sufren daño necrótico y miedo.","resource":"mana","cost":39,"type":"magic","range":9,"classEffect":"massFearDot","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"paladin_t1_1":{"name":"Golpe Juramentado","icon":"✥","desc":"Golpe sagrado que marca al enemigo para recibir daño adicional.","resource":"stamina","cost":15,"type":"physical","range":1,"classEffect":"holyMark","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"paladin_t1_2":{"name":"Luz de Guardia","icon":"☀","desc":"Cura una cantidad moderada y limpia una penalización.","resource":"mana","cost":17,"type":"utility","range":0,"classEffect":"cleanseHeal","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"paladin_t1_3":{"name":"Desafío Radiante","icon":"⚑","desc":"Atrae enemigos y reduce el daño que infligen a otros objetivos.","resource":"mana","cost":16,"type":"magic","range":5,"classEffect":"taunt","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"paladin_t1_4":{"name":"Escudo de Fe","icon":"▣","desc":"Escudo que aumenta con Sabiduría y dura 4 turnos.","resource":"mana","cost":18,"type":"utility","range":0,"classEffect":"holyShield","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"paladin_t2_1":{"name":"Consagración","icon":"✺","desc":"Zona sagrada: daña enemigos y te cura mientras permanezcas dentro.","resource":"mana","cost":24,"type":"magic","range":5,"classEffect":"consecrate","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"paladin_t2_2":{"name":"Carga del Alba","icon":"➤","desc":"Teletransporte corto al objetivo y golpe radiante.","resource":"stamina","cost":24,"type":"physical","range":6,"classEffect":"holyDash","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"paladin_t2_3":{"name":"Manos del Mártir","icon":"✚","desc":"Gran curación a cambio de parte de tu stamina.","resource":"mana","cost":25,"type":"utility","range":0,"classEffect":"bigHeal","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"paladin_t2_4":{"name":"Círculo de Verdad","icon":"⊙","desc":"Inmoviliza y silencia enemigos dentro del área.","resource":"mana","cost":27,"type":"magic","range":5,"classEffect":"silenceRoot","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"paladin_t3_1":{"name":"Ángel de Circuito","icon":"♢","desc":"Invoca un custodio luminoso que cura y ataca.","resource":"mana","cost":32,"type":"utility","range":0,"classEffect":"summonHealer","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"paladin_t3_2":{"name":"Intervención Divina","icon":"⑨","desc":"Evita la siguiente muerte y restaura parte de la vida.","resource":"mana","cost":35,"type":"utility","range":0,"classEffect":"cheatDeathHeal","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"paladin_t3_3":{"name":"Avatar Solar","icon":"☀","desc":"Mejora daño sagrado, armadura y regeneración.","resource":"mana","cost":34,"type":"utility","range":0,"classEffect":"holyAvatar","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"paladin_t3_4":{"name":"Juicio del Dios Roto","icon":"☄","desc":"Gran área sagrada: más daño a enemigos marcados o no muertos.","resource":"mana","cost":40,"type":"magic","range":8,"classEffect":"holyJudgement","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"jester_t1_1":{"name":"Pastel Explosivo","icon":"●","desc":"Lanza un pastel que explota y aplica un efecto aleatorio.","resource":"mana","cost":14,"type":"magic","range":6,"classEffect":"chaosBomb","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"jester_t1_2":{"name":"Cambio de Sombrero","icon":"♧","desc":"Obtienes al azar daño, armadura, evasión o regeneración.","resource":"mana","cost":15,"type":"utility","range":0,"classEffect":"randomBuff","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"jester_t1_3":{"name":"Chiste Paralizante","icon":"☺","desc":"El objetivo queda aturdido si falla una defensa de Sabiduría.","resource":"mana","cost":17,"type":"magic","range":6,"classEffect":"stun","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"jester_t1_4":{"name":"Paso de Comedia","icon":"⇄","desc":"Te teletransportas a una casilla y dejas un señuelo.","resource":"mana","cost":18,"type":"magic","range":6,"classEffect":"teleportDecoy","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"jester_t2_1":{"name":"Ruleta del Vacío","icon":"◎","desc":"Área con daño y estado aleatorios: fuego, hielo, miedo o raíz.","resource":"mana","cost":24,"type":"magic","range":7,"classEffect":"chaosArea","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"jester_t2_2":{"name":"Aplauso Enlatado","icon":"♫","desc":"Buff acumulable de crítico y suerte durante 6 turnos.","resource":"mana","cost":22,"type":"utility","range":0,"classEffect":"luckBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"jester_t2_3":{"name":"Intercambio de Papeles","icon":"⇆","desc":"Intercambia tu posición con la del enemigo y lo confunde.","resource":"mana","cost":25,"type":"magic","range":7,"classEffect":"swapConfuse","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"jester_t2_4":{"name":"Broma Recurrente","icon":"∞","desc":"Marca al objetivo: repite parte del daño recibido cada turno.","resource":"mana","cost":27,"type":"magic","range":7,"classEffect":"echoDot","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"jester_t3_1":{"name":"Gran Final Prematuro","icon":"☄","desc":"Gran explosión que puede curar o dañar dos veces.","resource":"mana","cost":33,"type":"magic","range":8,"classEffect":"doubleChaos","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"jester_t3_2":{"name":"No Era Yo","icon":"◌","desc":"Invoca tres copias ilusorias que absorben ataques.","resource":"mana","cost":31,"type":"utility","range":0,"classEffect":"clones","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"jester_t3_3":{"name":"Reescribir el Chiste","icon":"↶","desc":"Reinicia cooldowns y devuelve parte del recurso gastado.","resource":"mana","cost":35,"type":"utility","range":0,"classEffect":"resetCooldowns","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"jester_t3_4":{"name":"El Público Decide","icon":"★","desc":"Cada enemigo visible recibe un efecto distinto y aleatorio.","resource":"mana","cost":40,"type":"magic","range":9,"classEffect":"massChaos","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"sniper_t1_1":{"name":"Disparo de Aguja","icon":"⌖","desc":"Disparo preciso de largo alcance que ignora parte de la defensa.","resource":"stamina","cost":14,"type":"physical","range":10,"classEffect":"pierce","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"sniper_t1_2":{"name":"Marcar Objetivo","icon":"◎","desc":"Marca un enemigo; tus ataques le infligen daño adicional.","resource":"stamina","cost":13,"type":"physical","range":12,"classEffect":"mark","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"sniper_t1_3":{"name":"Mina de Proximidad","icon":"⌗","desc":"Coloca una mina en una casilla que explota al acercarse un enemigo.","resource":"stamina","cost":17,"type":"physical","range":6,"classEffect":"trap","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"sniper_t1_4":{"name":"Reposicionamiento","icon":"»","desc":"Te desplazas a una casilla visible y ganas evasión.","resource":"stamina","cost":16,"type":"physical","range":5,"classEffect":"teleportBuff","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"sniper_t2_1":{"name":"Disparo Congelante","icon":"❄","desc":"Proyectil que congela al objetivo.","resource":"stamina","cost":22,"type":"physical","range":10,"classEffect":"freeze","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"sniper_t2_2":{"name":"Bala Tóxica","icon":"☣","desc":"Aplica veneno durante 5 turnos.","resource":"stamina","cost":21,"type":"physical","range":10,"classEffect":"poison","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"sniper_t2_3":{"name":"Tiro de Rebote","icon":"↗","desc":"El disparo salta hasta tres enemigos cercanos.","resource":"stamina","cost":24,"type":"physical","range":10,"classEffect":"ricochet","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"sniper_t2_4":{"name":"Zona de Muerte","icon":"⌖","desc":"Durante 6 turnos, atacar objetivos lejanos aumenta el daño.","resource":"stamina","cost":25,"type":"utility","range":0,"classEffect":"sniperBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"sniper_t3_1":{"name":"Disparo Imposible","icon":"✦","desc":"Atraviesa enemigos alineados y causa crítico garantizado al último.","resource":"stamina","cost":32,"type":"physical","range":14,"classEffect":"lineShot","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"sniper_t3_2":{"name":"Lluvia de Munición","icon":"☄","desc":"Bombardea un área durante 3 turnos.","resource":"stamina","cost":34,"type":"physical","range":12,"classEffect":"areaDot","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"sniper_t3_3":{"name":"Fantasma del Tejado","icon":"◐","desc":"Te vuelves invisible y el siguiente disparo causa daño enorme.","resource":"stamina","cost":31,"type":"utility","range":0,"classEffect":"stealthShot","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"sniper_t3_4":{"name":"Un Solo Nombre","icon":"✂","desc":"Ejecución extrema contra el objetivo marcado.","resource":"stamina","cost":38,"type":"physical","range":14,"classEffect":"markedExecute","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"shaman_t1_1":{"name":"Chispa del Ancestro","icon":"ϟ","desc":"Rayo que salta a un segundo enemigo.","resource":"mana","cost":14,"type":"magic","range":7,"classEffect":"chain","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"shaman_t1_2":{"name":"Raíces del Cementerio","icon":"♣","desc":"Inmoviliza enemigos dentro de un área.","resource":"mana","cost":17,"type":"magic","range":5,"classEffect":"rootArea","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"shaman_t1_3":{"name":"Espíritu Curandero","icon":"✚","desc":"Invoca un espíritu que restaura vida cada turno.","resource":"mana","cost":18,"type":"utility","range":0,"classEffect":"summonHealer","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"shaman_t1_4":{"name":"Niebla de Mal Augurio","icon":"☁","desc":"Reduce precisión y daño de los enemigos.","resource":"mana","cost":17,"type":"magic","range":5,"classEffect":"blindArea","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"shaman_t2_1":{"name":"Tótem de Escarcha","icon":"❄","desc":"Invoca un tótem que congela periódicamente.","resource":"mana","cost":24,"type":"magic","range":5,"classEffect":"freezeTotem","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"shaman_t2_2":{"name":"Lobo de Estática","icon":"◆","desc":"Invoca un lobo espiritual que persigue enemigos.","resource":"mana","cost":24,"type":"utility","range":0,"classEffect":"summon","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"shaman_t2_3":{"name":"Tormenta de Ceniza","icon":"☄","desc":"Área de daño persistente y reducción de defensa.","resource":"mana","cost":26,"type":"magic","range":7,"classEffect":"areaDotArmor","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"shaman_t2_4":{"name":"Cambio de Piel","icon":"◒","desc":"Te transformas: más velocidad, daño y regeneración.","resource":"mana","cost":27,"type":"utility","range":0,"classEffect":"shapeShift","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"shaman_t3_1":{"name":"Consejo de Ancestros","icon":"♜","desc":"Invoca varios espíritus con funciones distintas.","resource":"mana","cost":33,"type":"utility","range":0,"classEffect":"multiSummon","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"shaman_t3_2":{"name":"Diluvio de Almas","icon":"≋","desc":"Olas espirituales que dañan, curan y empujan.","resource":"mana","cost":35,"type":"magic","range":8,"classEffect":"spiritWave","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"shaman_t3_3":{"name":"Gran Tótem del Cielo","icon":"♆","desc":"Tótem permanente del piso que lanza rayos.","resource":"mana","cost":36,"type":"magic","range":6,"classEffect":"stormTotem","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"shaman_t3_4":{"name":"Encarnación Primordial","icon":"Ψ","desc":"Gran buff y una descarga elemental cada turno.","resource":"mana","cost":40,"type":"utility","range":0,"classEffect":"elementalAvatar","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"thief_t1_1":{"name":"Puñalada Sombría","icon":"◐","desc":"Teletransporte detrás del objetivo y aplica sangrado.","resource":"stamina","cost":14,"type":"physical","range":6,"classEffect":"shadowStrike","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"thief_t1_2":{"name":"Bomba de Humo","icon":"☁","desc":"Crea humo: invisibilidad breve y ceguera enemiga.","resource":"stamina","cost":16,"type":"physical","range":4,"classEffect":"smoke","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"thief_t1_3":{"name":"Cepo Cuántico","icon":"⌗","desc":"Coloca una trampa que inmoviliza y daña.","resource":"mana","cost":17,"type":"magic","range":5,"classEffect":"trapRoot","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"thief_t1_4":{"name":"Bolsillo Ajeno","icon":"✦","desc":"Roba oro, vida o recurso al objetivo.","resource":"stamina","cost":15,"type":"physical","range":1,"classEffect":"steal","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"thief_t2_1":{"name":"Doble Fantasma","icon":"◌","desc":"Invoca una copia que repite parte de tus ataques.","resource":"mana","cost":23,"type":"utility","range":0,"classEffect":"clone","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"thief_t2_2":{"name":"Cadena de Teleport","icon":"⇄","desc":"Salta entre varios enemigos, golpeándolos.","resource":"stamina","cost":24,"type":"physical","range":7,"classEffect":"blinkChain","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"thief_t2_3":{"name":"Veneno de Relojería","icon":"☣","desc":"Veneno que explota al terminar su duración.","resource":"stamina","cost":22,"type":"physical","range":6,"classEffect":"delayedPoison","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"thief_t2_4":{"name":"Desaparecer","icon":"◐","desc":"Invisibilidad durante 3 movimientos; el primer golpe es crítico.","resource":"mana","cost":25,"type":"utility","range":0,"classEffect":"stealth","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"thief_t3_1":{"name":"Atraco Temporal","icon":"⌛","desc":"Roba un turno a todos los enemigos cercanos.","resource":"mana","cost":31,"type":"magic","range":6,"classEffect":"massStun","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"thief_t3_2":{"name":"Mil Cortes","icon":"✂","desc":"Secuencia de ataques que aumenta con cada impacto.","resource":"stamina","cost":33,"type":"physical","range":7,"classEffect":"combo","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"thief_t3_3":{"name":"Robo de Destino","icon":"★","desc":"Intercambia tu peor atributo temporal con la mejor defensa del enemigo.","resource":"mana","cost":34,"type":"magic","range":6,"classEffect":"stealStat","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"thief_t3_4":{"name":"Nadie Estuvo Aquí","icon":"∞","desc":"Teletransporte libre y deja clones explosivos en la posición inicial.","resource":"mana","cost":39,"type":"magic","range":10,"classEffect":"teleportClones","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"cleric_t1_1":{"name":"Luz Reparadora","icon":"✚","desc":"Cura y concede regeneración durante 3 turnos.","resource":"mana","cost":14,"type":"utility","range":0,"classEffect":"regenHeal","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"cleric_t1_2":{"name":"Sello de Silencio","icon":"⊘","desc":"Silencia las habilidades del enemigo.","resource":"mana","cost":16,"type":"magic","range":6,"classEffect":"silence","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"cleric_t1_3":{"name":"Maza de Penitencia","icon":"✥","desc":"Golpe que cura una parte del daño causado.","resource":"stamina","cost":15,"type":"physical","range":1,"classEffect":"holyLeech","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"cleric_t1_4":{"name":"Oración Breve","icon":"♫","desc":"Aumenta Sabiduría y defensa mágica durante 5 turnos.","resource":"mana","cost":16,"type":"utility","range":0,"classEffect":"wisdomBuff","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"cleric_t2_1":{"name":"Santuario Portátil","icon":"⌂","desc":"Zona que cura cada turno y debilita no muertos.","resource":"mana","cost":24,"type":"magic","range":5,"classEffect":"sanctuary","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"cleric_t2_2":{"name":"Purga de Corrupción","icon":"☀","desc":"Elimina estados negativos y daña enemigos corruptos cercanos.","resource":"mana","cost":23,"type":"magic","range":4,"classEffect":"purge","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"cleric_t2_3":{"name":"Custodio de Silicio","icon":"♙","desc":"Invoca un guardián que protege y contraataca.","resource":"mana","cost":25,"type":"utility","range":0,"classEffect":"summonTank","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"cleric_t2_4":{"name":"Voto de Dolor","icon":"♥","desc":"Convierte parte del daño recibido en maná.","resource":"mana","cost":22,"type":"utility","range":0,"classEffect":"martyrBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"cleric_t3_1":{"name":"Resurrección de Emergencia","icon":"⑨","desc":"La siguiente muerte te devuelve con parte de vida.","resource":"mana","cost":33,"type":"utility","range":0,"classEffect":"cheatDeathHeal","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"cleric_t3_2":{"name":"Diluvio Sagrado","icon":"☄","desc":"Área persistente que daña y cura simultáneamente.","resource":"mana","cost":34,"type":"magic","range":8,"classEffect":"holyRain","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"cleric_t3_3":{"name":"Avatar del Templo","icon":"♜","desc":"Gran buff de curación, armadura y daño sagrado.","resource":"mana","cost":35,"type":"utility","range":0,"classEffect":"holyAvatar","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"cleric_t3_4":{"name":"Absolución Final","icon":"✺","desc":"Elimina todos los estados y ejecuta enemigos debilitados.","resource":"mana","cost":40,"type":"magic","range":8,"classEffect":"absolution","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"entropyMage_t1_1":{"name":"Dardo de Decadencia","icon":"≋","desc":"Daño que reduce su propio dado cada turno mientras corroe al objetivo.","resource":"mana","cost":14,"type":"magic","range":8,"classEffect":"decayDot","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"entropyMage_t1_2":{"name":"Paso Improbable","icon":"◈","desc":"Teleport aleatorio dentro del área elegida; deja una anomalía.","resource":"mana","cost":16,"type":"magic","range":6,"classEffect":"randomTeleport","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"entropyMage_t1_3":{"name":"Escudo Inestable","icon":"◇","desc":"Escudo que explota al agotarse.","resource":"mana","cost":17,"type":"utility","range":0,"classEffect":"explosiveShield","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"entropyMage_t1_4":{"name":"Envejecer","icon":"⌛","desc":"Ralentiza, debilita y aumenta cooldowns del objetivo.","resource":"mana","cost":18,"type":"magic","range":7,"classEffect":"age","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"entropyMage_t2_1":{"name":"Pozo de Entropía","icon":"◎","desc":"Atrae enemigos al centro y aplica daño persistente.","resource":"mana","cost":24,"type":"magic","range":7,"classEffect":"gravityDot","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"entropyMage_t2_2":{"name":"Deshacer Materia","icon":"♲","desc":"Reduce drásticamente armadura y puede destruir buffs.","resource":"mana","cost":24,"type":"magic","range":7,"classEffect":"dispelArmor","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"entropyMage_t2_3":{"name":"Robo de Tiempo","icon":"◷","desc":"Aturde al objetivo y reduce tus cooldowns.","resource":"mana","cost":25,"type":"magic","range":7,"classEffect":"timeSteal","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"entropyMage_t2_4":{"name":"Campo de Decadencia","icon":"☣","desc":"Área donde enemigos pierden vida y daño cada turno.","resource":"mana","cost":27,"type":"magic","range":7,"classEffect":"decayField","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"entropyMage_t3_1":{"name":"Fin Estadístico","icon":"∑","desc":"El daño depende de una tirada caótica entre mínimo y máximo extremos.","resource":"mana","cost":32,"type":"magic","range":9,"classEffect":"wildDamage","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"entropyMage_t3_2":{"name":"Agujero de Entropía","icon":"●","desc":"Área que agrupa, silencia y daña durante 3 turnos.","resource":"mana","cost":35,"type":"magic","range":8,"classEffect":"blackHole","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"entropyMage_t3_3":{"name":"Deshacer Realidad","icon":"↶","desc":"Revierte parte del daño recibido y reinicia tu posición.","resource":"mana","cost":35,"type":"utility","range":0,"classEffect":"rewind","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"entropyMage_t3_4":{"name":"Muerte Térmica","icon":"∞","desc":"Todos los enemigos visibles sufren daño creciente hasta congelarse.","resource":"mana","cost":41,"type":"magic","range":10,"classEffect":"thermalDeath","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"bountyHunter_t1_1":{"name":"Red de Captura","icon":"⌗","desc":"Inmoviliza al objetivo y aumenta el botín si muere atrapado.","resource":"stamina","cost":14,"type":"physical","range":7,"classEffect":"bountyRoot","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"bountyHunter_t1_2":{"name":"Disparo de Plasma","icon":"ϟ","desc":"Ataque a distancia que quema durante 3 turnos.","resource":"stamina","cost":16,"type":"physical","range":8,"classEffect":"burn","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"bountyHunter_t1_3":{"name":"Dron Rastreador","icon":"◉","desc":"Invoca un dron que marca enemigos y revela cofres.","resource":"mana","cost":18,"type":"utility","range":0,"classEffect":"summonScanner","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"bountyHunter_t1_4":{"name":"Granada Aturdidora","icon":"●","desc":"Área que aturde y reduce Agilidad.","resource":"stamina","cost":18,"type":"physical","range":6,"classEffect":"stunArea","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"bountyHunter_t2_1":{"name":"Contrato Prioritario","icon":"◎","desc":"Marca un objetivo: más daño, XP y oro al derrotarlo.","resource":"mana","cost":22,"type":"magic","range":9,"classEffect":"bountyMark","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"bountyHunter_t2_2":{"name":"Cable Monomolecular","icon":"⌁","desc":"Atrae, corta y aplica sangrado.","resource":"stamina","cost":23,"type":"physical","range":7,"classEffect":"hookBleed","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"bountyHunter_t2_3":{"name":"Campo Supresor","icon":"⊘","desc":"Zona que silencia y ralentiza enemigos.","resource":"mana","cost":25,"type":"magic","range":6,"classEffect":"suppressField","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"bountyHunter_t2_4":{"name":"Sobrecarga de Implantes","icon":"⚡","desc":"Más daño y velocidad, pero pierdes vida por turno.","resource":"stamina","cost":24,"type":"utility","range":0,"classEffect":"implantBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"bountyHunter_t3_1":{"name":"Jaula de Cazarrecompensas","icon":"▥","desc":"Encierra enemigos en un área y los daña al intentar salir.","resource":"mana","cost":32,"type":"magic","range":7,"classEffect":"cage","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"bountyHunter_t3_2":{"name":"Cañón de Hombro","icon":"☄","desc":"Bombardeo de área de largo alcance.","resource":"stamina","cost":34,"type":"physical","range":12,"classEffect":"missileArea","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"bountyHunter_t3_3":{"name":"Objetivo Vivo o Muerto","icon":"✂","desc":"Ejecución; si sobrevive, queda marcado y debilitado.","resource":"stamina","cost":35,"type":"physical","range":10,"classEffect":"bountyExecute","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"bountyHunter_t3_4":{"name":"Cobro de Todos los Contratos","icon":"★","desc":"Ataca automáticamente a todos los enemigos marcados.","resource":"mana","cost":40,"type":"magic","range":12,"classEffect":"collectBounties","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"druid_t1_1":{"name":"Zarzas Hambrientas","icon":"♣","desc":"Raíces que inmovilizan y dañan durante varios turnos.","resource":"mana","cost":15,"type":"magic","range":5,"classEffect":"rootDot","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"druid_t1_2":{"name":"Brote Curativo","icon":"✚","desc":"Cura inmediata y regeneración breve.","resource":"mana","cost":14,"type":"utility","range":0,"classEffect":"regenHeal","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"druid_t1_3":{"name":"Forma de Cuervo","icon":"◆","desc":"Teleport corto y aumento de evasión.","resource":"mana","cost":16,"type":"magic","range":6,"classEffect":"teleportBuff","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"druid_t1_4":{"name":"Esporas Somníferas","icon":"☁","desc":"Área que puede dormir a los enemigos.","resource":"mana","cost":17,"type":"magic","range":5,"classEffect":"sleepArea","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"druid_t2_1":{"name":"Compañero Oso","icon":"♜","desc":"Invoca un oso resistente que atrae enemigos.","resource":"mana","cost":24,"type":"utility","range":0,"classEffect":"summonTank","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"druid_t2_2":{"name":"Piel de Roble","icon":"▣","desc":"Gran armadura y regeneración durante 6 turnos.","resource":"mana","cost":23,"type":"utility","range":0,"classEffect":"oakBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"druid_t2_3":{"name":"Enjambre Voraz","icon":"✣","desc":"Daño en el tiempo que salta al morir el objetivo.","resource":"mana","cost":25,"type":"magic","range":7,"classEffect":"swarmDot","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"druid_t2_4":{"name":"Círculo de Estaciones","icon":"⊙","desc":"Alterna efectos de primavera, verano, otoño e invierno.","resource":"mana","cost":27,"type":"magic","range":6,"classEffect":"seasons","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"druid_t3_1":{"name":"Bosque Instantáneo","icon":"♣","desc":"Crea una zona amplia de raíces, curación y cobertura.","resource":"mana","cost":34,"type":"magic","range":8,"classEffect":"forestZone","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"druid_t3_2":{"name":"Bestia Ancestral","icon":"♞","desc":"Invoca una criatura poderosa adaptada al enemigo dominante.","resource":"mana","cost":35,"type":"utility","range":0,"classEffect":"summonElite","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"druid_t3_3":{"name":"Renacer Verde","icon":"∞","desc":"Al morir, renaces y conviertes la casilla en santuario.","resource":"mana","cost":35,"type":"utility","range":0,"classEffect":"cheatDeathHeal","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"druid_t3_4":{"name":"Cólera de la Naturaleza","icon":"☄","desc":"Tormenta de raíces, rayos y veneno sobre toda el área.","resource":"mana","cost":40,"type":"magic","range":9,"classEffect":"natureStorm","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"monk_t1_1":{"name":"Palma Resonante","icon":"✋","desc":"Golpe que deja una marca; el siguiente impacto la detona.","resource":"stamina","cost":13,"type":"physical","range":1,"classEffect":"comboMark","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"monk_t1_2":{"name":"Paso sin Huella","icon":"»","desc":"Teleport corto que no provoca respuesta enemiga.","resource":"stamina","cost":14,"type":"physical","range":5,"classEffect":"freeTeleport","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"monk_t1_3":{"name":"Respiración Circular","icon":"◯","desc":"Recupera stamina y gana regeneración.","resource":"stamina","cost":12,"type":"utility","range":0,"classEffect":"resourceRegen","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"monk_t1_4":{"name":"Barrido de Seda","icon":"⌒","desc":"Derriba enemigos adyacentes.","resource":"stamina","cost":16,"type":"physical","range":2,"classEffect":"knockdown","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"monk_t2_1":{"name":"Cadena de Ocho Golpes","icon":"∞","desc":"Combo creciente sobre un único objetivo.","resource":"stamina","cost":23,"type":"physical","range":1,"classEffect":"combo","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"monk_t2_2":{"name":"Reflejo Perfecto","icon":"◇","desc":"Evasión alta y devolución del siguiente proyectil.","resource":"stamina","cost":22,"type":"utility","range":0,"classEffect":"reflect","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"monk_t2_3":{"name":"Prisión de Meridianos","icon":"⌗","desc":"Inmoviliza y silencia al objetivo.","resource":"stamina","cost":24,"type":"physical","range":2,"classEffect":"silenceRoot","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"monk_t2_4":{"name":"Bucle de Instante","icon":"◷","desc":"Obtienes un turno sin respuesta enemiga y reduces cooldowns.","resource":"stamina","cost":25,"type":"utility","range":0,"classEffect":"extraTurn","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"monk_t3_1":{"name":"Avatar de las Mil Palmas","icon":"Ψ","desc":"Invoca ecos que golpean a enemigos cercanos.","resource":"stamina","cost":32,"type":"utility","range":0,"classEffect":"summon","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"monk_t3_2":{"name":"Vacío entre Latidos","icon":"◐","desc":"Congela el tiempo de todos los enemigos durante 2 turnos.","resource":"stamina","cost":34,"type":"physical","range":7,"classEffect":"massStun","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"monk_t3_3":{"name":"Cuerpo sin Peso","icon":"◆","desc":"Teleport libre, evasión y crítico durante 6 turnos.","resource":"stamina","cost":34,"type":"utility","range":0,"classEffect":"monkAvatar","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"monk_t3_4":{"name":"Ruptura del Bucle","icon":"☄","desc":"Detona todas las marcas de combo en el mapa.","resource":"stamina","cost":39,"type":"physical","range":9,"classEffect":"detonateMarks","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"engineer_t1_1":{"name":"Torreta de Bolsillo","icon":"▧","desc":"Despliega una torreta que dispara durante varios turnos.","resource":"mana","cost":17,"type":"utility","range":0,"classEffect":"summonTurret","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"engineer_t1_2":{"name":"Mina Adhesiva","icon":"⌗","desc":"Trampa que inmoviliza y explota.","resource":"mana","cost":15,"type":"magic","range":5,"classEffect":"trapRoot","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"engineer_t1_3":{"name":"Nanorreparación","icon":"✚","desc":"Cura y repara escudo durante 3 turnos.","resource":"mana","cost":16,"type":"utility","range":0,"classEffect":"regenHeal","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"engineer_t1_4":{"name":"Pulso EMP","icon":"ϟ","desc":"Silencia habilidades tecnológicas y reduce defensa.","resource":"mana","cost":18,"type":"magic","range":5,"classEffect":"emp","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"engineer_t2_1":{"name":"Dron Médico","icon":"♙","desc":"Invoca un dron que cura al aliado más herido.","resource":"mana","cost":24,"type":"utility","range":0,"classEffect":"summonHealer","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"engineer_t2_2":{"name":"Lanzallamas Improvisado","icon":"♨","desc":"Cono de fuego que aplica quemadura.","resource":"mana","cost":24,"type":"magic","range":5,"classEffect":"burnArea","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"engineer_t2_3":{"name":"Campo Magnético","icon":"◎","desc":"Atrae enemigos y proyectiles hacia una casilla.","resource":"mana","cost":25,"type":"magic","range":6,"classEffect":"magneticField","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"engineer_t2_4":{"name":"Sobrecargar Dispositivo","icon":"⚡","desc":"Duplica la velocidad de aliados invocados, con riesgo de explosión.","resource":"mana","cost":26,"type":"utility","range":0,"classEffect":"overclockSummons","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"engineer_t3_1":{"name":"Exotraje de Asedio","icon":"▰","desc":"Gran buff de armadura, daño y alcance.","resource":"mana","cost":33,"type":"utility","range":0,"classEffect":"mechBuff","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"engineer_t3_2":{"name":"Nube de Nanobots","icon":"☁","desc":"Área persistente que cura aliados y corroe enemigos.","resource":"mana","cost":34,"type":"magic","range":7,"classEffect":"nanoCloud","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"engineer_t3_3":{"name":"Fábrica Portátil","icon":"♜","desc":"Invoca torreta, dron y mina simultáneamente.","resource":"mana","cost":36,"type":"utility","range":0,"classEffect":"multiSummon","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"engineer_t3_4":{"name":"Protocolo Autodestrucción","icon":"☢","desc":"Todos tus dispositivos explotan causando daño masivo.","resource":"mana","cost":40,"type":"magic","range":9,"classEffect":"detonateSummons","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"seer_t1_1":{"name":"Mal Presagio","icon":"◐","desc":"Marca al objetivo: su próxima tirada defensiva se realiza con desventaja.","resource":"mana","cost":14,"type":"magic","range":8,"classEffect":"doomMark","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"seer_t1_2":{"name":"Visión del Camino","icon":"☀","desc":"Revela mapa, cofres y amenazas cercanas.","resource":"mana","cost":15,"type":"utility","range":0,"classEffect":"reveal","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"seer_t1_3":{"name":"Paso Predicho","icon":"◇","desc":"Teleport a una casilla y evita el siguiente ataque.","resource":"mana","cost":16,"type":"magic","range":6,"classEffect":"teleportShield","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"seer_t1_4":{"name":"Hilo del Destino","icon":"⌁","desc":"Une dos enemigos: parte del daño se comparte.","resource":"mana","cost":18,"type":"magic","range":8,"classEffect":"link","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"seer_t2_1":{"name":"Profecía de Hielo","icon":"❄","desc":"Área que se congela un turno después de lanzarse.","resource":"mana","cost":23,"type":"magic","range":7,"classEffect":"delayedFreeze","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"seer_t2_2":{"name":"Destino Robado","icon":"★","desc":"Obtienes Suerte y crítico; los enemigos pierden ambos.","resource":"mana","cost":24,"type":"utility","range":0,"classEffect":"luckBuff","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"seer_t2_3":{"name":"Repetición Anunciada","icon":"↶","desc":"La siguiente habilidad se ejecuta dos veces con menor potencia.","resource":"mana","cost":26,"type":"utility","range":0,"classEffect":"repeatSkill","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"seer_t2_4":{"name":"Puerta del Futuro","icon":"◈","desc":"Crea dos portales entre los que puedes desplazarte.","resource":"mana","cost":27,"type":"magic","range":7,"classEffect":"portal","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"seer_t3_1":{"name":"Final Inevitable","icon":"✂","desc":"Marca un enemigo; muere al terminar la cuenta si no rompe la marca.","resource":"mana","cost":33,"type":"magic","range":9,"classEffect":"doomCountdown","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"seer_t3_2":{"name":"Ojos del Abismo","icon":"◎","desc":"Todos los enemigos visibles quedan revelados, debilitados y aterrados.","resource":"mana","cost":34,"type":"magic","range":10,"classEffect":"massFear","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"seer_t3_3":{"name":"Reescribir Destino","icon":"∞","desc":"Evita muerte y reinicia parcialmente vida, recursos y cooldowns.","resource":"mana","cost":36,"type":"utility","range":0,"classEffect":"rewind","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"seer_t3_4":{"name":"La Profecía se Cumple","icon":"☄","desc":"Detona todas las marcas, daños en el tiempo y cuentas pendientes.","resource":"mana","cost":41,"type":"magic","range":10,"classEffect":"detonateStatuses","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true},"beastGuardian_t1_1":{"name":"Zarpazo Vinculado","icon":"◆","desc":"Golpe conjunto con tu bestia; aplica sangrado.","resource":"stamina","cost":14,"type":"physical","range":1,"classEffect":"petStrike","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"beastGuardian_t1_2":{"name":"Llamar Compañero","icon":"♞","desc":"Invoca una bestia que permanece varios turnos.","resource":"stamina","cost":17,"type":"utility","range":0,"classEffect":"summon","targetMode":"self","tier":1,"rarity":"common","enemyUsable":true},"beastGuardian_t1_3":{"name":"Rugido Protector","icon":"☠","desc":"Enemigos cercanos te atacan y tu armadura aumenta.","resource":"stamina","cost":17,"type":"physical","range":4,"classEffect":"tauntBuff","targetMode":"area","tier":1,"rarity":"common","enemyUsable":true},"beastGuardian_t1_4":{"name":"Salto de la Pantera","icon":"➤","desc":"Saltas al objetivo y ganas evasión.","resource":"stamina","cost":16,"type":"physical","range":6,"classEffect":"leapBuff","targetMode":"enemy","tier":1,"rarity":"common","enemyUsable":true},"beastGuardian_t2_1":{"name":"Manada Coordinada","icon":"♞","desc":"Invoca dos bestias menores que flanquean enemigos.","resource":"stamina","cost":24,"type":"utility","range":0,"classEffect":"multiSummon","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"beastGuardian_t2_2":{"name":"Mordida Inmovilizadora","icon":"⌗","desc":"La bestia muerde, inmoviliza y causa sangrado.","resource":"stamina","cost":22,"type":"physical","range":5,"classEffect":"rootBleed","targetMode":"enemy","tier":2,"rarity":"rare","enemyUsable":true},"beastGuardian_t2_3":{"name":"Instinto de Supervivencia","icon":"♥","desc":"Cura y aumenta regeneración cuanto menos vida tengas.","resource":"stamina","cost":23,"type":"utility","range":0,"classEffect":"survivalHeal","targetMode":"self","tier":2,"rarity":"rare","enemyUsable":true},"beastGuardian_t2_4":{"name":"Carga del Rinoceronte","icon":"▰","desc":"Avance en línea que empuja y aturde.","resource":"stamina","cost":25,"type":"physical","range":6,"classEffect":"bulldozeStun","targetMode":"area","tier":2,"rarity":"rare","enemyUsable":true},"beastGuardian_t3_1":{"name":"Alfa Aumentado","icon":"Ψ","desc":"Tu compañero evoluciona a una forma élite.","resource":"stamina","cost":32,"type":"utility","range":0,"classEffect":"summonElite","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"beastGuardian_t3_2":{"name":"Cacería Salvaje","icon":"⌖","desc":"Toda la manada ataca al objetivo marcado.","resource":"stamina","cost":34,"type":"physical","range":8,"classEffect":"packExecute","targetMode":"enemy","tier":3,"rarity":"epic","enemyUsable":true},"beastGuardian_t3_3":{"name":"Fusión Bestial","icon":"◒","desc":"Te fusionas con tu compañero: daño, armadura y velocidad.","resource":"stamina","cost":35,"type":"utility","range":0,"classEffect":"beastAvatar","targetMode":"self","tier":3,"rarity":"epic","enemyUsable":true},"beastGuardian_t3_4":{"name":"Estampida Quimérica","icon":"☄","desc":"Invoca una estampida que atraviesa un área amplia.","resource":"stamina","cost":40,"type":"physical","range":9,"classEffect":"stampede","targetMode":"area","tier":3,"rarity":"epic","enemyUsable":true}};
for(const [id,data] of Object.entries(creativeClassSkillOverrides))Object.assign(skillDefs[id],data);

/* Balance global: todas las habilidades cuestan un 25 % más.
   Se marca para impedir aplicar el incremento dos veces al cargar o migrar. */
for(const skill of Object.values(skillDefs)){
 if(!skill._cost125){
  skill.cost=Math.max(1,Math.ceil((Number(skill.cost)||0)*1.25));
  skill._cost125=true;
 }
}

const CLASS_EFFECT_SPECS={"armorBreak":["Inflige daño y aplica Quebradura durante 4 turnos: el objetivo recibe un 20 % más de daño.","enemy"],"buffArmor":["Aumenta tu armadura un 30 % durante 5 turnos.","self"],"pullRoot":["Inflige daño, atrae al objetivo a una casilla adyacente y lo inmoviliza durante 2 turnos.","enemy"],"counter":["Obtienes un escudo y preparas un contraataque contra el siguiente enemigo que te golpee.","self"],"bulldoze":["Te desplazas hacia el punto elegido, dañando y empujando a los enemigos atravesados.","area"],"slowArea":["Inflige daño en el área y ralentiza a los enemigos durante 3 turnos.","area"],"healShield":["Recupera vida según Vitalidad y obtiene un escudo adicional.","self"],"rootZone":["Crea durante 5 turnos una zona que inmoviliza al primer enemigo que entra.","area"],"summon":["Invoca un compañero durante varios turnos; actúa automáticamente al final de cada turno.","self"],"armorSlam":["Golpea un área; el daño aumenta con tu armadura total.","area"],"fortress":["Durante 7 turnos aumenta tu armadura y recuperas vida al bloquear daño.","self"],"massRoot":["Inflige daño en un área amplia, empuja e inmoviliza durante 2 turnos.","area"],"bleed":["Inflige daño y provoca Sangrado durante 4 turnos.","enemy"],"bloodBuff":["Pierdes un 10 % de vida actual y ganas daño y evasión durante 5 turnos.","self"],"leapStun":["Saltas al punto elegido, infliges daño y aturdes 1 turno a los enemigos cercanos.","area"],"fearBuff":["Debilita el daño de los enemigos cercanos durante 4 turnos y aumenta tu crítico durante 5 turnos.","area"],"spin":["Golpea dos veces a todos los enemigos adyacentes.","area"],"lifestealBuff":["Durante 6 turnos recuperas vida equivalente al 20 % del daño que causas.","self"],"hookBleed":["Atrae al objetivo, le inflige daño, provoca Sangrado durante 4 turnos y recupera stamina.","enemy"],"rampage":["Durante 6 turnos ganas más daño cuanto menor sea tu porcentaje de vida.","self"],"overcharge":["Pierdes el 30 % de tu vida actual y la siguiente habilidad ofensiva causa el doble de daño.","self"],"bleedStorm":["Golpea a todos los enemigos del área y les provoca Sangrado durante 4 turnos.","area"],"cheatDeath":["Durante 5 turnos, el primer daño mortal te deja con 1 punto de vida.","self"],"missingHpNova":["Inflige daño en un área; aumenta hasta un 75 % según la vida que te falte.","area"],"dot":["Inflige daño inicial y daño necrótico durante 4 turnos.","enemy"],"root":["Inmoviliza al objetivo durante 2 turnos.","enemy"],"drain":["Inflige daño y roba vida y maná al objetivo.","enemy"],"corpseExplosion":["Explota un cadáver cercano; daña el área y aplica Putrefacción durante 3 turnos.","area"],"boneShield":["Obtienes escudo durante 5 turnos; quien te golpea cuerpo a cuerpo recibe daño.","self"],"plague":["Crea una nube durante 4 turnos que causa daño y reduce un 50 % la curación enemiga.","area"],"raiseMark":["Marca al objetivo durante 5 turnos; si muere marcado, regresa como aliado temporal.","enemy"],"multiSummon":["Invoca dos compañeros durante varios turnos.","self"],"wither":["Inflige daño y reduce daño, defensa y movimiento del objetivo durante 4 turnos.","enemy"],"lichBuff":["Durante 7 turnos tus hechizos curan un 15 % del daño y reducen sus cooldowns al impactar.","self"],"massFearDot":["Inflige daño necrótico a los enemigos visibles, les aplica Miedo y daño durante 4 turnos.","area"],"holyMark":["Inflige daño y marca al objetivo durante 5 turnos; recibe un 20 % más de daño sagrado.","enemy"],"cleanseHeal":["Elimina un estado negativo y recupera vida.","self"],"taunt":["Atrae a los enemigos cercanos y reduce su daño durante 4 turnos.","area"],"holyShield":["Obtienes un escudo basado en Sabiduría durante 4 turnos.","self"],"consecrate":["Crea durante 5 turnos una zona que daña enemigos y te cura si permaneces dentro.","area"],"holyDash":["Te teletransportas junto al objetivo y realizas un golpe sagrado.","enemy"],"bigHeal":["Consume stamina adicional para recuperar una gran cantidad de vida.","self"],"silenceRoot":["Inmoviliza y silencia a los enemigos del área durante 2 turnos.","area"],"summonHealer":["Invoca un custodio durante varios turnos que cura al final de cada turno.","self"],"cheatDeathHeal":["Durante 6 turnos, el primer daño mortal te devuelve con un 35 % de vida.","self"],"holyAvatar":["Durante 7 turnos aumenta daño, armadura y curación.","self"],"holyJudgement":["Inflige daño sagrado en un área; causa un 50 % más a enemigos marcados o no muertos.","area"],"chaosBomb":["Inflige daño en un área y aplica al azar Quemadura, Congelación, Miedo o Raíz.","area"],"randomBuff":["Obtienes al azar durante 5 turnos un 25 % de daño, armadura, evasión o regeneración.","self"],"stun":["Inflige daño y aturde al objetivo durante 1 turno.","enemy"],"teleportDecoy":["Te teletransportas al punto elegido y dejas un señuelo durante 3 turnos.","area"],"chaosArea":["Inflige daño en un área y aplica un estado aleatorio a cada enemigo.","area"],"luckBuff":["Durante 6 turnos aumenta Suerte y probabilidad de crítico.","self"],"swapConfuse":["Intercambias posición con el objetivo y lo confundes durante 2 turnos.","enemy"],"echoDot":["Marca al objetivo durante 4 turnos; cada turno repite un 25 % del último daño recibido.","enemy"],"doubleChaos":["El área se resuelve dos veces: cada resolución puede dañar o curar.","area"],"clones":["Invoca tres copias ilusorias que absorben un ataque cada una.","self"],"resetCooldowns":["Reinicia los cooldowns de tus habilidades y recupera el 30 % del recurso gastado.","self"],"massChaos":["Aplica a cada enemigo visible un efecto aleatorio diferente.","area"],"pierce":["Disparo de largo alcance que ignora el 35 % de la defensa.","enemy"],"mark":["Marca al objetivo durante 6 turnos; tus ataques le causan un 20 % más de daño.","enemy"],"trap":["Coloca una mina durante 8 turnos; explota cuando un enemigo entra en su casilla.","area"],"teleportBuff":["Te teletransportas al punto elegido y ganas evasión durante 3 turnos.","area"],"freeze":["Inflige daño y congela al objetivo durante 2 turnos.","enemy"],"poison":["Inflige daño y aplica Veneno durante 5 turnos.","enemy"],"ricochet":["Golpea al objetivo y salta hasta a dos enemigos cercanos con daño reducido.","enemy"],"sniperBuff":["Durante 6 turnos, los ataques a 6 o más casillas infligen un 30 % más de daño.","self"],"lineShot":["Dispara en línea atravesando enemigos; el último impacto es crítico.","enemy"],"areaDot":["Bombardea el área durante 3 turnos, causando daño al inicio de cada turno.","area"],"stealthShot":["Te vuelves invisible durante 3 turnos; el siguiente disparo causa el doble de daño.","self"],"markedExecute":["Inflige gran daño; si el objetivo está marcado y tiene menos del 30 % de vida, lo ejecuta.","enemy"],"chain":["Inflige daño al objetivo y salta a un segundo enemigo cercano.","enemy"],"rootArea":["Inmoviliza durante 2 turnos a los enemigos del área.","area"],"blindArea":["Reduce precisión y daño de los enemigos del área durante 4 turnos.","area"],"freezeTotem":["Coloca un tótem durante 6 turnos que congela a un enemigo cercano cada 2 turnos.","area"],"areaDotArmor":["Crea un área durante 4 turnos que causa daño y reduce la defensa un 20 %.","area"],"shapeShift":["Durante 6 turnos aumenta movimiento, daño y regeneración.","self"],"spiritWave":["Lanza ondas que dañan y empujan enemigos y te curan por cada impacto.","area"],"stormTotem":["Coloca un tótem durante el resto del piso que lanza rayos a enemigos cercanos.","area"],"elementalAvatar":["Durante 7 turnos aumenta tus atributos y lanza una descarga elemental cada turno.","self"],"shadowStrike":["Te teletransportas junto al objetivo, infliges daño y aplicas Sangrado durante 4 turnos.","enemy"],"smoke":["Crea humo durante 4 turnos: te oculta y reduce la precisión enemiga.","area"],"trapRoot":["Coloca una trampa durante 8 turnos que daña e inmoviliza al activarse.","area"],"steal":["Inflige daño y roba aleatoriamente oro, vida o recurso.","enemy"],"clone":["Invoca una copia durante 6 turnos que repite un 35 % de tus ataques.","self"],"blinkChain":["Te teletransportas entre hasta tres enemigos y los golpeas.","enemy"],"delayedPoison":["Aplica Veneno durante 4 turnos; al terminar, explota y daña el área.","enemy"],"stealth":["Te vuelves invisible durante 3 movimientos; el primer ataque es crítico.","self"],"massStun":["Aturde durante 1 turno a todos los enemigos del área.","area"],"combo":["Realiza cuatro golpes; cada impacto causa un 20 % más que el anterior.","enemy"],"stealStat":["Durante 5 turnos copias la mejor defensa del enemigo y reduces esa defensa en el objetivo.","enemy"],"teleportClones":["Te teletransportas al punto elegido y dejas dos clones explosivos.","area"],"regenHeal":["Recupera vida y obtiene regeneración durante 3 turnos.","self"],"silence":["Silencia las habilidades del objetivo durante 3 turnos.","enemy"],"holyLeech":["Inflige daño sagrado y recupera vida equivalente al 25 % del daño.","enemy"],"wisdomBuff":["Durante 5 turnos aumenta Sabiduría y defensa contra magia.","self"],"sanctuary":["Crea durante 5 turnos una zona que cura y daña a los no muertos.","area"],"purge":["Elimina tus estados negativos y daña a enemigos corruptos cercanos.","area"],"summonTank":["Invoca un guardián durante varios turnos que atrae ataques y contraataca.","self"],"martyrBuff":["Durante 6 turnos conviertes el 30 % del daño recibido en maná.","self"],"holyRain":["Crea durante 4 turnos un área que daña enemigos y te cura.","area"],"absolution":["Elimina tus estados negativos y ejecuta enemigos del área con menos del 20 % de vida.","area"],"decayDot":["Inflige daño durante 5 turnos; el daño disminuye en 1 cada turno.","enemy"],"randomTeleport":["Te teletransportas a una casilla libre aleatoria del área y deja una anomalía dañina.","area"],"explosiveShield":["Obtienes un escudo durante 5 turnos; al agotarse, explota alrededor de ti.","self"],"age":["Ralentiza, reduce daño y aumenta en 2 los cooldowns del objetivo durante 4 turnos.","enemy"],"gravityDot":["Crea durante 4 turnos un pozo que atrae y daña a los enemigos.","area"],"dispelArmor":["Elimina un buff del objetivo y reduce su defensa un 35 % durante 4 turnos.","enemy"],"timeSteal":["Aturde al objetivo 1 turno y reduce en 1 tus cooldowns.","enemy"],"decayField":["Crea durante 5 turnos un campo que reduce vida y daño enemigo.","area"],"wildDamage":["Inflige una cantidad aleatoria entre el 50 % y el 200 % del daño base.","enemy"],"blackHole":["Crea durante 3 turnos un área que atrae, silencia y daña.","area"],"rewind":["Recupera parte de la vida y recursos perdidos en los últimos 3 turnos y vuelve a tu posición anterior.","self"],"thermalDeath":["Aplica daño creciente durante 4 turnos y congela al finalizar.","area"],"bountyRoot":["Inmoviliza al objetivo durante 3 turnos; si muere atrapado, deja un 50 % más de oro.","enemy"],"burn":["Inflige daño y aplica Quemadura durante 3 turnos.","enemy"],"summonScanner":["Invoca un dron durante 8 turnos que marca enemigos y revela cofres cercanos.","self"],"stunArea":["Inflige daño y aturde 1 turno a los enemigos del área.","area"],"bountyMark":["Marca al objetivo durante 8 turnos; otorga más daño, experiencia y oro al derrotarlo.","enemy"],"suppressField":["Crea durante 5 turnos una zona que silencia y ralentiza.","area"],"implantBuff":["Durante 6 turnos aumenta daño y movimiento, pero pierdes vida cada turno.","self"],"cage":["Crea durante 5 turnos una jaula; los enemigos quedan retenidos y reciben daño al intentar salir.","area"],"missileArea":["Bombardea un área lejana y aplica Quemadura durante 3 turnos.","area"],"bountyExecute":["Inflige gran daño; si el objetivo sobrevive, queda marcado y debilitado.","enemy"],"collectBounties":["Ataca una vez a todos los enemigos marcados que estén visibles.","area"],"rootDot":["Inmoviliza y causa daño durante 4 turnos.","area"],"sleepArea":["Los enemigos del área quedan dormidos hasta 2 turnos o hasta recibir daño.","area"],"oakBuff":["Durante 6 turnos aumenta armadura y regenera vida.","self"],"swarmDot":["Aplica daño durante 5 turnos; si el objetivo muere, salta a otro enemigo cercano.","enemy"],"seasons":["Crea una zona durante 6 turnos que alterna curación, quemadura, ralentización y congelación.","area"],"forestZone":["Crea durante 6 turnos un bosque que inmoviliza enemigos, te cura y da cobertura.","area"],"summonElite":["Invoca o mejora un compañero de élite durante varios turnos.","self"],"natureStorm":["Inflige daño y aplica aleatoriamente Raíz, Quemadura o Veneno en un área amplia.","area"],"comboMark":["Inflige daño y deja una marca; el siguiente golpe la detona para daño adicional.","enemy"],"freeTeleport":["Te teletransportas al punto elegido sin provocar respuesta enemiga.","area"],"resourceRegen":["Recupera stamina inmediatamente y obtiene regeneración durante 4 turnos.","self"],"knockdown":["Daña y derriba durante 1 turno a los enemigos adyacentes.","area"],"reflect":["Durante 4 turnos aumenta evasión y refleja el siguiente proyectil.","self"],"extraTurn":["Tu siguiente acción no provoca turno enemigo y reduce en 1 tus cooldowns.","self"],"monkAvatar":["Durante 6 turnos aumenta movimiento, evasión y crítico.","self"],"detonateMarks":["Detona todas tus marcas de combo para causar daño adicional.","area"],"summonTurret":["Despliega una torreta durante 8 turnos que dispara automáticamente.","self"],"emp":["Inflige daño, silencia y reduce defensa durante 3 turnos.","area"],"burnArea":["Inflige daño en cono y aplica Quemadura durante 3 turnos.","area"],"magneticField":["Crea durante 4 turnos un campo que atrae enemigos hacia el centro.","area"],"overclockSummons":["Durante 6 turnos tus invocaciones actúan dos veces, pero pierden vida cada turno.","self"],"mechBuff":["Durante 7 turnos aumenta armadura, daño y alcance.","self"],"nanoCloud":["Crea durante 5 turnos una nube que cura aliados y daña enemigos.","area"],"detonateSummons":["Destruye tus invocaciones y causa daño de área por cada una.","area"],"doomMark":["Marca al objetivo: su siguiente defensa tira dos dados y conserva el peor.","enemy"],"reveal":["Revela mapa, cofres, enemigos y trampas en un radio amplio.","self"],"teleportShield":["Te teletransportas al punto elegido y evitas el siguiente ataque.","area"],"link":["Une al objetivo con el enemigo más cercano durante 5 turnos; comparten un 30 % del daño.","enemy"],"delayedFreeze":["Marca el área; al siguiente turno daña y congela durante 2 turnos.","area"],"repeatSkill":["La siguiente habilidad se ejecuta una segunda vez con un 60 % de potencia.","self"],"portal":["Crea dos portales durante 8 turnos que permiten viajar entre sus posiciones.","area"],"doomCountdown":["Marca al objetivo durante 4 turnos; al terminar recibe daño masivo.","enemy"],"massFear":["Debilita y aterra durante 3 turnos a todos los enemigos visibles.","area"],"detonateStatuses":["Detona todas tus marcas y daños en el tiempo, aplicando de golpe el daño restante.","area"],"petStrike":["Tu compañero y tú golpeáis al objetivo y aplicáis Sangrado durante 4 turnos.","enemy"],"tauntBuff":["Atrae enemigos cercanos y aumenta tu armadura durante 5 turnos.","area"],"leapBuff":["Saltas junto al objetivo, lo golpeas y ganas evasión durante 3 turnos.","enemy"],"rootBleed":["Inflige daño, inmoviliza durante 2 turnos y aplica Sangrado durante 4 turnos.","enemy"],"survivalHeal":["Recupera más vida cuanto menor sea tu porcentaje de vida y regenera durante 3 turnos.","self"],"bulldozeStun":["Avanzas en línea, empujas, dañas y aturdes 1 turno.","area"],"packExecute":["Tu personaje y todas sus invocaciones atacan al objetivo; causa más daño si está marcado.","enemy"],"beastAvatar":["Durante 7 turnos aumenta daño, armadura y movimiento.","self"],"stampede":["Una estampida atraviesa el área, dañando, empujando y derribando enemigos.","area"]};
for(const skill of Object.values(skillDefs)){
 if(skill.classId&&CLASS_EFFECT_SPECS[skill.classEffect]){
  skill.desc=CLASS_EFFECT_SPECS[skill.classEffect][0];
  skill.targetMode=CLASS_EFFECT_SPECS[skill.classEffect][1];
 }
}

const classSkillMilestones={1:1};
const LEVEL_UP_RANDOM_SKILL_LEVELS=new Set([3,5,10,15,20,25,30,35,40]);



// OBSOLETO v0.34.4: modelo legacy de familias embebidas.
// El juego ya no debe usar estas familias para generar pisos; la fuente activa es la tabla Supabase `enemy_family`.
const enemyFamilies={
 orquidos:{
  name:'Orquidos',
  enemies:['goblin','orco','huargo','orcoJinete','orcoKamikaze','chamanGoblin'],
  bosses:['reyOrco'],
  floorTheme:'Fortaleza Verde'
 },
 undead:{
  name:'No muertos',
  enemies:['skeleton','skeletonArcher','zombie','ghoul','vampiro','momia','royalMummy','liche','licheEnloquecido'],
  bosses:['archiliche','royalMummy','licheEnloquecido'],
  floorTheme:'Criptas Hambrientas'
 },
 beasts:{
  name:'Bestias',
  enemies:['spider','cursedCrow','attackEagle','feralWolf','angryDeer','criminalOwl','lynx','tiger','brutalBear'],
  bosses:['brutalBear','tiger','criminalOwl'],
  floorTheme:'Bosque de las Bestias'
 },
 foundry:{
  name:'Engendros de la Fundición',
  enemies:['cultist','slagBeast','fireImp','chainKnight','magmaPriest','ashGolem'],
  bosses:['FurnaceTyrant'],
  floorTheme:'Fundición Carmesí'
 },
 void:{
  name:'Aberraciones del Vacío',
  enemies:['voidClerk','phaseHound','dataWraith','nullMage','quantumGuard','errorSpawn'],
  bosses:['NullArchivist'],
  floorTheme:'Archivo del Vacío'
 }
};
function floorEnemyFamily(){
 const keys=['orquidos','undead','beasts'];
 if(game.floor>=3)keys.push('foundry');
 if(game.floor>=4)keys.push('void');
 const forced={1:'orquidos',2:'undead'}[game.floor];
 return enemyFamilies[forced||pick(keys)]
}

const themes=[
 {name:'Fortaleza Verde',story:'greenskins',enemies:['goblin','orco','huargo','orcoJinete','orcoKamikaze','chamanGoblin'],boss:'reyOrco'},
 {name:'Criptas Hambrientas',story:'undead',enemies:['ghoul','huargoNocturno','vampiro','momia','liche','licheEnloquecido'],boss:'archiliche'},
 {name:'Foso Mezclado',story:'chaos',enemies:['orco','ghoul','goblin','momia','huargo','vampiro'],boss:'abominacion'},
 {name:'Fundición Carmesí',floorMin:3,tiles:['#5a241c','#7b3528'],enemies:['cultist','slagBeast','fireImp','chainKnight','magmaPriest','ashGolem'],boss:'FurnaceTyrant'},
 {name:'Archivo del Vacío',floorMin:4,tiles:['#19152d','#2d2451'],enemies:['voidClerk','phaseHound','dataWraith','nullMage','quantumGuard','errorSpawn'],boss:'NullArchivist'}
];

const enemyDefs={
 goblin:{name:'Goblin',hp:8,atk:3,color:'#70aa58',accent:'#ffd55a',shape:'goblin'},
 orco:{name:'Orco',hp:15,atk:5,color:'#527d42',accent:'#c79c67',shape:'orc'},
 huargo:{name:'Huargo',hp:11,atk:5,color:'#66515c',accent:'#e7d2bd',shape:'wolf'},
 orcoJinete:{name:'Orco jinete',hp:21,atk:7,color:'#527d42',accent:'#6e5360',shape:'rider'},
 orcoKamikaze:{name:'Orco kamikaze',hp:10,atk:10,color:'#67964d',accent:'#e05f42',shape:'bomber'},
 chamanGoblin:{name:'Chamán goblin',hp:13,atk:4,color:'#78a75d',accent:'#b984db',shape:'shaman'},
 ghoul:{name:'Ghoul',hp:12,atk:5,color:'#7c8c74',accent:'#c2d2b7',shape:'ghoul'},
 huargoNocturno:{name:'Wharg nocturno',hp:14,atk:6,color:'#39333f',accent:'#d96b6b',shape:'wolf'},
 vampiro:{name:'Vampiro',hp:17,atk:7,color:'#7d3041',accent:'#ede5dd',shape:'vampire'},
 momia:{name:'Momia',hp:20,atk:5,color:'#b29b6e',accent:'#e1d3a4',shape:'mummy'},
 liche:{name:'Liche',hp:23,atk:8,color:'#73559a',accent:'#6ef0cf',shape:'lich'},
 licheEnloquecido:{name:'Liche enloquecido',hp:29,atk:10,color:'#9a4f9c',accent:'#ff765f',shape:'madlich'},
 reyOrco:{name:'REY ORCO GRUÑEPUERTAS',hp:75,atk:11,color:'#426e35',accent:'#f0bd4d',shape:'bossOrc',boss:true},
 archiliche:{name:'ARCHILICHE DE LOS RECIBOS',hp:90,atk:13,color:'#5e4192',accent:'#63f0d1',shape:'bossLich',boss:true},
 abominacion:{name:'ABOMINACIÓN DE INVENTARIO',hp:105,atk:14,color:'#8a4d5d',accent:'#ffd25f',shape:'abomination',boss:true},
 cultist:{"name": "Cultista de la Fundición", "hp": 16, "damage": 5, "xp": 8, "sprite": "cultist"},
 slagBeast:{"name": "Bestia de Escoria", "hp": 24, "damage": 6, "xp": 10, "sprite": "slagBeast"},
 fireImp:{"name": "Diablillo Ígneo", "hp": 12, "damage": 5, "xp": 8, "sprite": "fireImp"},
 chainKnight:{"name": "Caballero de Cadenas", "hp": 28, "damage": 7, "xp": 12, "sprite": "chainKnight"},
 magmaPriest:{"name": "Sacerdote de Magma", "hp": 20, "damage": 8, "xp": 13, "sprite": "magmaPriest", "ranged": true},
 ashGolem:{"name": "Gólem de Ceniza", "hp": 36, "damage": 8, "xp": 16, "sprite": "ashGolem"},
 FurnaceTyrant:{"name": "Tirano de la Caldera", "hp": 90, "damage": 12, "xp": 45, "sprite": "FurnaceTyrant", "boss": true},
 voidClerk:{"name": "Funcionario del Vacío", "hp": 22, "damage": 7, "xp": 11, "sprite": "voidClerk"},
 phaseHound:{"name": "Sabueso de Fase", "hp": 24, "damage": 8, "xp": 13, "sprite": "phaseHound"},
 dataWraith:{"name": "Espectro de Datos", "hp": 20, "damage": 9, "xp": 14, "sprite": "dataWraith", "ranged": true},
 nullMage:{"name": "Mago Nulo", "hp": 26, "damage": 10, "xp": 16, "sprite": "nullMage", "ranged": true},
 quantumGuard:{"name": "Guardia Cuántico", "hp": 38, "damage": 10, "xp": 18, "sprite": "quantumGuard"},
 errorSpawn:{"name": "Engendro 404", "hp": 30, "damage": 11, "xp": 19, "sprite": "errorSpawn"},
 NullArchivist:{"name": "Archivero Nulo", "hp": 125, "damage": 15, "xp": 65, "sprite": "NullArchivist", "boss": true}
,
 skeleton:{name:'Esqueleto',hp:14,atk:4,color:'#d7d0b4',accent:'#7f7865',shape:'skeleton'},
 skeletonArcher:{name:'Esqueleto arquero',hp:12,atk:5,color:'#d7d0b4',accent:'#9a774c',shape:'skeletonArcher',ranged:true},
 zombie:{name:'Zombi',hp:24,atk:5,color:'#73856b',accent:'#a1b78e',shape:'zombie'},
 royalMummy:{name:'Momia real',hp:45,atk:10,color:'#c8ad6e',accent:'#d5a339',shape:'royalMummy',boss:true},
 spider:{name:'Araña',hp:10,atk:4,color:'#3b2d43',accent:'#b3547d',shape:'spider'},
 cursedCrow:{name:'Cuervo maldito',hp:11,atk:5,color:'#20212a',accent:'#9b58c7',shape:'crow',ranged:true},
 attackEagle:{name:'Águila de ataque',hp:16,atk:6,color:'#8a775b',accent:'#e6cf99',shape:'eagle'},
 feralWolf:{name:'Lobo feral',hp:18,atk:7,color:'#4b5158',accent:'#c8d3db',shape:'feralWolf'},
 angryDeer:{name:'Ciervo encabronado',hp:24,atk:8,color:'#805f3f',accent:'#d9bd86',shape:'angryDeer'},
 criminalOwl:{name:'Búho criminal',hp:26,atk:9,color:'#5a4b66',accent:'#f0d36c',shape:'criminalOwl',boss:true,ranged:true},
 lynx:{name:'Lince',hp:20,atk:8,color:'#9a704d',accent:'#f0d3a0',shape:'lynx'},
 tiger:{name:'Tigre',hp:36,atk:11,color:'#d8752f',accent:'#1a1716',shape:'tiger',boss:true},
 brutalBear:{name:'Oso brutal',hp:52,atk:13,color:'#604636',accent:'#bb9a75',shape:'brutalBear',boss:true}

};

const levelOneNarratives=[{"title": "LA CORONA DEL REY TUERCECOLMILLOS", "text": "El rey orco ha robado la corona de una reina élfica y la usa como cenicero. Recuperarla te hará héroe. Venderla te hará rico. Nadie ha dicho que debas escoger hoy."}, {"title": "EL MAPA DEL ENANO BORRACHO", "text": "Un cartógrafo enano juró que bajo la fortaleza hay un tesoro antiguo. También juró que podía beber lava. Solo una de las dos cosas era mentira."}, {"title": "LA APUESTA DE LOS DIOSES MENORES", "text": "Tres dioses poco importantes han apostado por cuánto durarás. El que va perdiendo intenta ayudarte; los otros dos lanzan monstruos y comentarios ofensivos."}, {"title": "LA HERENCIA DEL TÍO BRAM", "text": "Has heredado una torre, una espada oxidada y una deuda con el gremio de aventureros. Para cobrar la torre primero debes expulsar a los orcos que la convirtieron en taberna."}, {"title": "EL CABALLERO DEL CASCO ROBADO", "text": "Un caballero sin pantalones asegura que el Rey Orco le robó su casco ceremonial. La recompensa es excelente y las explicaciones, deliberadamente escasas."}, {"title": "LA PUERTA DE LAS CIEN LLAVES", "text": "La salida fue sellada por un mago paranoico. Dejó muchas llaves, varios acertijos y una nota que dice: «La correcta era demasiado obvia»."}];
const levelThreeNarratives=[{"title": "LA FORJA DEL REY SALAMANDRA", "text": "El Tirano de la Caldera funde armas para conquistar los reinos de arriba. Sus herreros goblin aseguran que el plan es perfecto, salvo por la ventilación y por ti."}, {"title": "EL MARTILLO DE LOS SIETE CLANES", "text": "Un martillo real cayó en la fundición durante una guerra antigua. Siete clanes lo reclaman y ninguno ha considerado la posibilidad de compartirlo."}, {"title": "LA PRINCESA DE LAS BRASAS", "text": "Una princesa salamandra está encerrada en el horno mayor. Dice que fue traicionada. Su padre dice que es una pirómana. Ambos ofrecen recompensa."}, {"title": "LA HUELGA DE LOS GÓLEMS", "text": "Los gólems de ceniza exigen descansos, aceite y el derecho a aplastar capataces. El Tirano ha respondido contratando aventureros desechables. Tú eres el último."}];
const levelFourNarratives=[{"title": "LA BIBLIOTECA DEL MAGO NULO", "text": "El Archivero Nulo roba historias y borra a sus protagonistas. En uno de sus libros aparece tu nombre seguido de un espacio en blanco sospechosamente largo."}, {"title": "EL GRIMORIO QUE INSULTA", "text": "Un grimorio perdido conoce el camino de salida, pero solo responde a quien soporte tres acertijos, dos maldiciones y una crítica despiadada a su peinado."}, {"title": "LOS CABALLEROS SIN RECUERDO", "text": "Una orden de caballeros olvidó a quién juró lealtad. Ahora protege todas las puertas por si alguna conduce a la respuesta."}, {"title": "EL ÚLTIMO HECHIZO DEL REY MAGO", "text": "El rey mago encerró su último hechizo en el archivo. Nadie sabe qué hace, aunque el pergamino incluye una cláusula que prohíbe usarlo bajo techo."}];
const levelTwoNarratives=[{"title": "LAS CRIPTAS DEL DUQUE SIN SOMBRA", "text": "El duque vampiro perdió su sombra jugando a los dados y culpa a los vivos. Sus sirvientes registran cada tumba por si alguien la encuentra antes que él."}, {"title": "EL DIEZMO DE LOS MUERTOS", "text": "El Archiliche cobra una moneda a cada alma que cruza sus criptas. Como sigues respirando, pretende aplicarte la tarifa turística."}, {"title": "LA CAMPANA DE HUESO", "text": "Una campana maldita despierta a los muertos cada medianoche. El campanero murió hace dos siglos, pero insiste en que su turno aún no ha terminado."}, {"title": "EL ANILLO DE LA REINA CADÁVER", "text": "La reina de las criptas busca el anillo que perdió durante su propio funeral. Promete una recompensa principesca y amenaza con casarse con quien lo encuentre."}, {"title": "LA BODEGA DEL ARCHILICHE", "text": "Detrás de las tumbas hay una bodega legendaria. El vino es excelente, los esqueletos son hostiles y el sumiller lleva muerto desde la tercera cosecha."}];

function rng(n){return Math.floor(Math.random()*n)}function pick(a){return a[rng(a.length)]}function key(x,y){return`${x},${y}`}
function rarity(){let r=Math.random()*100,s=0;for(const x of rarities){s+=x.w;if(r<=s)return x}return rarities[0]}


const skillRarities={
 common:{label:'Común',weight:45,xpMult:1},
 uncommon:{label:'Infrecuente',weight:27,xpMult:1.15},
 rare:{label:'Raro',weight:16,xpMult:1.35},
 epic:{label:'Épico',weight:9,xpMult:1.65},
 legendary:{label:'Legendario',weight:3,xpMult:2.1}
};
function randomLootableSkill(){
 const known=new Set(game.player.knownSkills||[]);
 const pool=Object.entries(skillDefs).filter(([id,s])=>!known.has(id)&&(!s.classId||s.classId===game.player.cls||s.enemyUsable));
 if(!pool.length)return null;
 const level=game.player.level||1;
 const allowed=pool.filter(([id,s])=>{
  const r=s.rarity||'common';
  if(s.tier&&level<(s.tier===2?10:s.tier===3?30:1))return false;
  return r==='common'||r==='uncommon'||(r==='rare'&&level>=2)||(r==='epic'&&level>=4)||(r==='legendary'&&level>=7)
 });
 const source=allowed.length?allowed:pool;
 let total=source.reduce((sum,[id,s])=>sum+(skillRarities[s.rarity||'common'].weight),0),roll=Math.random()*total;
 for(const pair of source){roll-=skillRarities[pair[1].rarity||'common'].weight;if(roll<=0)return pair[0]}
 return source[0][0];
}

function skillRange(id){
 const d=skillDefs[id]||{};
 if(d.range)return d.range;
 if(['manaBolt','chainSpark','voidBlink','shockTrap','scrapGrenade','spiritWolf','gravityWell','holyCircuit','entropyWave','quantumThief','stormTotem','blackSun','adminOverride','lootSingularity'].includes(id))return 7;
 if(['rifleShot','aimedShot','pistolShot','arcaneBolt','fireball','iceLance','lightning'].includes(id))return 8;
 if(d.type==='magic')return 6;
 return 1;
}
function isRangedSkill(id){return skillDefs[id]?.type!=='utility'&&skillRange(id)>1}
function lineOfSightClear(from,to){
 if(!game?.map)return false;
 let x0=from.x,y0=from.y,x1=to.x,y1=to.y;
 const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;
 let err=dx-dy;
 while(!(x0===x1&&y0===y1)){
  const e2=err*2;
  if(e2>-dy){err-=dy;x0+=sx}
  if(e2<dx){err+=dx;y0+=sy}
  if(x0===x1&&y0===y1)return true;
  if(blocked(x0,y0))return false;
 }
 return true
}
function hasLineOfSight(from,to){return lineOfSightClear(from,to)}
function visibleEnemiesInRange(range,origin=game.player){
 return game.enemies.filter(e=>e.hp>0&&game.seen?.[e.y]?.[e.x]&&(Math.abs(e.x-origin.x)+Math.abs(e.y-origin.y))<=range&&hasLineOfSight(origin,e))
}

function skillXpNeeded(level){return 8+level*6}
function gainSkillUse(id){
 const p=game.player;
 p.skillProgress=p.skillProgress||{};
 const sp=p.skillProgress[id]||(p.skillProgress[id]={level:1,xp:0,uses:0});
 sp.uses++;sp.xp++;
 if(sp.xp>=skillXpNeeded(sp.level)){
  sp.xp-=skillXpNeeded(sp.level);sp.level++;
  banner(`${skillDefs[id].name} SUBE A NIVEL ${sp.level}`);
  log(`${skillDefs[id].name} mejora por uso. Nivel ${sp.level}.`,'story');
 }
}
function skillLevel(id){return game.player.skillProgress?.[id]?.level||1}
function skillPowerMultiplier(id){return 1+(skillLevel(id)-1)*.12}
function unlockSkillLoot(id){
 if(!id)return;
 game.player.knownSkills=game.player.knownSkills||[];
 if(!game.player.knownSkills.includes(id))game.player.knownSkills.push(id);
 game.player.skillProgress=game.player.skillProgress||{};
 game.player.skillProgress[id]=game.player.skillProgress[id]||{level:1,xp:0,uses:0};
 const s=skillDefs[id],r=skillRarities[s.rarity||'common'];
 const fake={name:`Técnica: ${s.name}`,slot:'trinket1',rarity:s.rarity||'common',label:r.label,desc:s.desc,itemLevel:game.player.level,score:0,iconShape:'sigilring'};
 lootToast(fake);banner(`HABILIDAD ${r.label.toUpperCase()}: ${s.name}`);
 log(`Has aprendido ${s.name}.`,'loot');
}


const weaponIconCache={};
const WEAPON_ICON_COLUMNS=10;
const WEAPON_TYPE_ICON_SIZE=50;
const SWORD_ICON_FOLDER='weapons/espadas';
const SWORD_SPRITESHEET=`${SWORD_ICON_FOLDER}/espadas.png`;
const SWORD_SPRITE_MARGIN=15;
const SWORD_SPRITE_GAP=15;
const SWORD_SPRITE_SIZE=50;
const weaponRows=[
 {category:'Armas blancas steampunk básicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:0,legacy:['Espadas cortas'],stat:'strength',names:['Cuchillo de mecánico', 'Daga de caldera', 'Estoque dentado', 'Machete industrial', 'Espada de acero pulido', 'Sable de oficial', 'Garrote remachado', 'Hacha de ingeniero', 'Lanza de latón', 'Maza de pistón']},
 {category:'Armas a distancia mecánicas',legacy:['Katanas y hachas pesadas'],stat:'strength',iconFolder:'weaponsCP',names:['Pistola de chispa', 'Revólver de latón', 'Pistola de presión', 'Cañón de mano', 'Carabina compacta', 'Ballesta mecánica', 'Arco de poleas', 'Sierra arrojadiza', 'Bomba de relojería', 'Dron escarabajo']},
 {category:'Armas pesadas steampunk',legacy:['Hachas de guerra y mazas con pinchos'],stat:'vitality',iconFolder:'weaponsCP',names:['Garrote de clavos', 'Mayal de engranajes', 'Hacha de vapor', 'Martillo industrial', 'Puñal de válvula', 'Alabarda mecánica', 'Mayal de presión', 'Guantelete de impacto', 'Látigo de cobre', 'Escudo de turbina']},
 {category:'Espadas eléctricas iniciales',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:1,legacy:['Dagas, lanzas y alabardas'],stat:'strength',names:['Daga de bobina', 'Kukri electrificado', 'Sable de dientes', 'Espada conductora', 'Espada de plasma azul', 'Estoque de descarga', 'Bastón de bobina Tesla', 'Hacha de inducción', 'Lanza de arco eléctrico', 'Maza acumuladora']},
 {category:'Armas de fuego eléctricas',legacy:['Arcos'],stat:'strength',iconFolder:'weaponsCP',names:['Pistola de condensador', 'Revólver voltaico', 'Pistola de bobina azul', 'Cañón eléctrico corto', 'Fusil de arco', 'Rifle de inducción', 'Ballesta de energía', 'Arco voltaico', 'Mina de pulso', 'Granada de plasma azul']},
 {category:'Armas eléctricas pesadas',legacy:['Ballestas'],stat:'vitality',iconFolder:'weaponsCP',names:['Maza de bobina', 'Mayal voltaico', 'Hacha de inducción pesada', 'Martillo Tesla', 'Daga de plasma concentrado', 'Alabarda de tormenta', 'Cadena de descarga', 'Guantelete eléctrico', 'Látigo voltaico', 'Dron de descarga']},
 {category:'Armas de latón refinadas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:2,legacy:['Varitas mágicas'],stat:'strength',names:['Espada de duelista mecánico', 'Sable del capitán aéreo', 'Machete de engranajes', 'Espada de relojero', 'Hoja ceremonial de latón', 'Estoque de autómata', 'Maza solar mecánica', 'Hacha de aviador', 'Lanza de pistón', 'Bastón giroscópico']},
 {category:'Armamento steampunk avanzado',legacy:['Guadañas'],stat:'strength',iconFolder:'weaponsCP',names:['Pistola neumática', 'Revólver de triple cámara', 'Pistola de turbina', 'Cañón de presión reforzado', 'Fusil de vapor azul', 'Rifle de caldera', 'Ballesta de autómata', 'Arco de precisión mecánico', 'Mina de engranajes', 'Granada de presión']},
 {category:'Reliquias mecánicas',legacy:['Mayales'],stat:'wisdom',iconFolder:'weaponsCP',names:['Bastón del gran engranaje', 'Mayal de relojería', 'Hacha del maquinista', 'Martillo de núcleo azul', 'Daga del inventor', 'Alabarda del reloj eterno', 'Cadena de engranajes gemelos', 'Guantelete del constructor', 'Látigo de transmisión', 'Araña mecánica']},
 {category:'Armas ciberpunk de neón',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:3,legacy:['Garras y guanteletes'],stat:'strength',names:['Daga de neón azul', 'Kukri de neón violeta', 'Hoja monomolecular cian', 'Espada de plasma magenta', 'Mandoble holográfico', 'Estoque de energía violeta', 'Bastón de plasma dual', 'Hacha de neón', 'Lanza fotónica', 'Maza de núcleo violeta']},
 {category:'Armas de fuego ciberpunk',legacy:['Pistolas y armas de fuego mágicas'],stat:'strength',iconFolder:'weaponsCP',names:['Pistola inteligente', 'Subfusil de neón', 'Pistola de plasma compacta', 'Cañón sónico', 'Rifle de pulsos', 'Fusil de partículas', 'Ballesta magnética', 'Arco holográfico', 'Mina de pulso violeta', 'Granada de antimateria']},
 {category:'Armas ciberpunk pesadas',legacy:['Hoces, armas curvas y armas exóticas'],stat:'vitality',iconFolder:'weaponsCP',names:['Maza de núcleo oscuro', 'Mayal de plasma', 'Hacha de combate cibernética', 'Martillo de sobrecarga', 'Daga de datos corruptos', 'Alabarda de fase', 'Cadena de energía', 'Guantelete de fuerza', 'Látigo neuronal', 'Dron depredador']},
 {category:'Armas térmicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:4,legacy:['Látigos'],stat:'strength',names:['Daga incandescente', 'Kukri térmico', 'Sable de fuego', 'Espada láser roja', 'Mandoble de magma', 'Estoque ígneo', 'Bastón de combustión', 'Hacha térmica', 'Lanza de fusión', 'Maza de reactor rojo']},
 {category:'Armas criogénicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:5,legacy:['Bastones mágicos'],stat:'intelligence',names:['Daga criogénica', 'Kukri de hielo tecnológico', 'Sable glacial', 'Espada láser azul', 'Mandoble criónico', 'Estoque de escarcha', 'Bastón de congelación', 'Hacha criogénica', 'Lanza de hielo comprimido', 'Maza de núcleo glacial']},
 {category:'Armas tóxicas y biotecnológicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:6,legacy:['Martillos de guerra'],stat:'luck',names:['Daga biocortante', 'Kukri venenoso', 'Sable de ácido', 'Espada de plasma verde', 'Mandoble biotecnológico', 'Estoque tóxico', 'Pistola de esporas', 'Hacha corrosiva', 'Lanza de bioenergía', 'Granada química']},
 {category:'Armas de pólvora industrial',legacy:['Hachas mágicas'],stat:'strength',iconFolder:'weaponsCP',names:['Pistola de percusión', 'Escopeta recortada', 'Revólver de cañones múltiples', 'Fusil pesado de vapor', 'Ametralladora de engranajes', 'Lanzagranadas industrial', 'Ballesta de asedio compacta', 'Arco neumático', 'Cañón portátil', 'Mortero de hombro']},
 {category:'Artillería steampunk',legacy:['Lanzas cortas y jabalinas'],stat:'vitality',iconFolder:'weaponsCP',names:['Pistola lanzallamas', 'Fusil rotatorio de vapor', 'Cañón de bobina mecánico', 'Lanzacohetes de latón', 'Rifle explosivo', 'Mortero de presión', 'Ballesta pesada plegable', 'Mina magnética', 'Cañón automático', 'Torreta mecánica']},
 {category:'Artefactos de energía',legacy:['Mandobles mágicos'],stat:'intelligence',iconFolder:'weaponsCP',names:['Núcleo de plasma azul', 'Portal de fase', 'Proyector de singularidad', 'Garra gravitatoria', 'Cuchilla del vacío', 'Orbe de agujero negro', 'Cañón dimensional', 'Reactor temporal', 'Reloj de estasis', 'Mina de singularidad']},
 {category:'Armas tecnomágicas legendarias',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:7,legacy:['Espadas legendarias'],stat:'wisdom',names:['Pistola del reloj divino', 'Sable de energía dorada', 'Hoja sierra de plasma', 'Espada del núcleo celeste', 'Mandoble del cronoingeniero', 'Bastón del sol mecánico', 'Hacha de tormenta Tesla', 'Lanza del autómata real', 'Maza del gran reloj', 'Dron serafín mecánico']},
 {category:'Armas míticas ciberpunk',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:8,legacy:['Armas artefacto y armas míticas'],stat:'wisdom',names:['Cañón del corazón azul', 'Guadaña del vacío violeta', 'Espada de plasma imperial', 'Hoja del reactor carmesí', 'Estrella de energía criónica', 'Rifle del arcángel mecánico', 'Hacha del señor de las máquinas', 'Lanza de fotones', 'Bastón de singularidad violeta', 'Núcleo del apocalipsis mecánico']}
];
const weaponCategories=weaponRows.map(r=>r.category);
const configWeaponTypes=['Espadas','Dagas','Sables','Hachas','Mazas','Martillos','Lanzas','Bastones','Varitas','Arcos','Ballestas','Pistolas','Rifles','Escopetas','Armas pesadas','Guanteletes','Látigos','Drones','Granadas','Artefactos'];
const configWeaponTypeCategories={Espadas:'Armas blancas steampunk básicas',Dagas:'Armas blancas steampunk básicas',Sables:'Armas de latón refinadas',Hachas:'Armas pesadas steampunk',Mazas:'Armas pesadas steampunk',Martillos:'Armas pesadas steampunk',Lanzas:'Espadas eléctricas iniciales',Bastones:'Armas criogénicas',Varitas:'Armas criogénicas',Arcos:'Armas a distancia mecánicas',Ballestas:'Armas a distancia mecánicas',Pistolas:'Armas de fuego ciberpunk',Rifles:'Armamento steampunk avanzado',Escopetas:'Armas de pólvora industrial','Armas pesadas':'Artillería steampunk',Guanteletes:'Armas ciberpunk pesadas',Látigos:'Armas térmicas',Drones:'Armas ciberpunk pesadas',Granadas:'Armas tóxicas y biotecnológicas',Artefactos:'Artefactos de energía'};
const weaponTypeRanges={Varitas:{min:1,max:4},Arcos:{min:2,max:5},Ballestas:{min:1,max:4},Pistolas:{min:1,max:3},Rifles:{min:2,max:5},Escopetas:{min:1,max:2}};
const weaponCategoryStats=Object.fromEntries(weaponRows.flatMap(r=>[r.category,...r.legacy].map(c=>[c,r.stat])));
function weaponRowForCategory(category){return Math.max(0,weaponRows.findIndex(r=>r.category===category||r.legacy.includes(category)))}
function weaponPowerColumn(itemLevel,rarity,score=0){
 const rarityIndex=Math.max(0,rarities.findIndex(r=>r.name===rarity.name));
 const levelBoost=Math.min(1,Math.floor(Math.max(1,itemLevel)-1)/35);
 const scoreBoost=Math.min(1,Math.max(0,score-10)/140);
 return Math.max(0,Math.min(WEAPON_ICON_COLUMNS-1,Math.round(rarityIndex*1.8+levelBoost+scoreBoost)));
}
function weaponCategoryForLoot(rarity){
 const rarityIndex=Math.max(0,rarities.findIndex(r=>r.name===rarity.name));
 const level=game?.player?.level||1;
 const levelCap=level>=45?19:level>=35?18:level>=25?17:level>=18?16:level>=12?15:level>=7?12:8;
 const minRow=rarityIndex>=4?17:rarityIndex>=3?12:rarityIndex>=2?6:rarityIndex>=1?3:0;
 const rawMaxRow=rarityIndex>=4?19:rarityIndex>=3?18:rarityIndex>=2?15:rarityIndex>=1?11:8;
 const maxRow=Math.max(minRow,Math.min(rawMaxRow,levelCap));
 return weaponRows[minRow+rng(maxRow-minRow+1)].category;
}
function weaponIconFolder(row){return weaponRows[row]?.iconFolder||'weaponsCP'}
function weaponIconAssetRow(row){return Number.isInteger(weaponRows[row]?.iconAssetRow)?weaponRows[row].iconAssetRow:row}
function weaponIconFileStem(row,col){return `icon_r${String(weaponIconAssetRow(row)+1).padStart(2,'0')}_c${String(col+1).padStart(2,'0')}`}
function weaponIconBase(row,col){return `${weaponIconFolder(row)}/${weaponIconFileStem(row,col)}`}
function weaponUsesSwordSpritesheet(row){return weaponIconFolder(row)===SWORD_ICON_FOLDER}
function swordSpriteRect(row,col){const assetRow=weaponIconAssetRow(row);return{x:SWORD_SPRITE_MARGIN+col*(SWORD_SPRITE_SIZE+SWORD_SPRITE_GAP),y:SWORD_SPRITE_MARGIN+assetRow*(SWORD_SPRITE_SIZE+SWORD_SPRITE_GAP),size:SWORD_SPRITE_SIZE}}
function weaponIconCandidates(row,col){const base=weaponIconBase(row,col),cp=`weaponsCP/icon_r${String(row+1).padStart(2,'0')}_c${String(col+1).padStart(2,'0')}`,classic=`weapons/icon_r${String(row+1).padStart(2,'0')}_c${String(col+1).padStart(2,'0')}`,legacy=`resources/weapons/icon_r${String(row+1).padStart(2,'0')}_c${String(col+1).padStart(2,'0')}`;return weaponUsesSwordSpritesheet(row)?[SWORD_SPRITESHEET]:[`${base}.png`,base,`${base}.webp`,`${base}.PNG`,`${cp}.png`,cp,`${classic}.png`,classic,`${legacy}.png`,legacy]}
function weaponIconPath(row,col){return weaponUsesSwordSpritesheet(row)?`${SWORD_SPRITESHEET}#${weaponIconFileStem(row,col)}`:weaponIconCandidates(row,col)[0]}
function weaponNameForCategory(category,col=0){
 const row=weaponRows[weaponRowForCategory(category)]||weaponRows[0];
 return row.names[Math.max(0,Math.min(WEAPON_ICON_COLUMNS-1,col))];
}
function normalizeWeaponIcon(item){
 if(!item||item.slot!=='weapon')return item;
 const row=Number.isInteger(item.weaponIconRow)?item.weaponIconRow:weaponRowForCategory(item.weaponCategory);
 const col=Number.isInteger(item.weaponIconCol)?item.weaponIconCol:0;
 item.weaponIconRow=Math.max(0,Math.min(weaponRows.length-1,row));
 item.weaponIconCol=Math.max(0,Math.min(WEAPON_ICON_COLUMNS-1,col));
 item.weaponCategory=weaponRows[item.weaponIconRow]?.category||item.weaponCategory||weaponRows[0].category;
 item.weaponIconPath=weaponIconPath(item.weaponIconRow,item.weaponIconCol);
 return item;
}
function weaponIconImage(item){
 normalizeWeaponIcon(item);
 const key=weaponUsesSwordSpritesheet(item.weaponIconRow)?SWORD_SPRITESHEET:weaponIconBase(item.weaponIconRow,item.weaponIconCol);
 if(!weaponIconCache[key]){
  const candidates=weaponIconCandidates(item.weaponIconRow,item.weaponIconCol);
  const img=new Image();img.dataset.tryIndex='0';img.dataset.failed='0';
  img.onerror=()=>{
   const next=Number(img.dataset.tryIndex||0)+1;
   if(next<candidates.length){img.dataset.tryIndex=String(next);img.src=candidates[next]}else img.dataset.failed='1';
  };
  img.src=candidates[0];weaponIconCache[key]=img;
 }
 const img=weaponIconCache[key];item.weaponIconPath=img.currentSrc||img.src||item.weaponIconPath;return img;
}



const armorIconCache={};
const ARMOR_ICON_COLUMNS=10;
const armorRows=[
 {category:'Túnicas y ropajes rudimentarios',names:['Túnica de lino desgarrada','Túnica de viajero remendada','Harapos del bosque','Túnica azul de peregrino','Jubón de cuero gastado','Túnica sombría deteriorada','Túnica blanca de acólito','Harapos carmesíes','Túnica negra de vagabundo','Túnica ocre reforzada']},
 {category:'Gambesones y armaduras acolchadas',names:['Gambesón de lino','Gambesón de cuero oscuro','Gambesón del explorador','Gambesón azul','Gambesón carmesí','Gambesón gris reforzado','Gambesón blanco ceremonial','Gambesón violeta','Gambesón negro','Gambesón dorado']},
 {category:'Túnicas y hábitos',names:['Hábito marrón de monje','Túnica verde con capucha','Túnica azul de erudito','Túnica roja de iniciado','Hábito blanco de sacerdote','Hábito negro de penitente','Túnica púrpura de ocultista','Túnica turquesa de vidente','Túnica de mercader','Hábito negro carmesí']},
 {category:'Túnicas mágicas',names:['Túnica de escarcha','Túnica druídica','Túnica del mago azul','Túnica de piromante','Túnica de luz sagrada','Túnica arcana violeta','Túnica espectral turquesa','Túnica del vacío','Túnica solar dorada','Túnica glacial blanca']},
 {category:'Armaduras de cuero ligeras',names:['Chaleco de cuero básico','Chaleco de cuero negro','Cuero del guardabosques','Cuero reforzado azul','Cuero carmesí','Cuero gris endurecido','Cuero del desierto','Cuero arcano violeta','Cuero de asesino','Cuero dorado']},
 {category:'Cuero tachonado',names:['Cuero tachonado marrón','Cuero tachonado negro','Cuero tachonado verde','Cuero tachonado azul','Cuero tachonado rojo','Cuero tachonado de acero','Cuero tachonado blanco','Cuero tachonado violeta','Cuero tachonado sombrío','Cuero tachonado dorado']},
 {category:'Cuero reforzado',names:['Coraza de cuero cruzado','Cuero reforzado oscuro','Cuero reforzado del bosque','Cuero reforzado azul','Cuero reforzado carmesí','Cuero reforzado gris','Cuero reforzado blanco','Cuero reforzado arcano','Cuero reforzado negro','Cuero reforzado dorado']},
 {category:'Armaduras de explorador y pícaro',names:['Armadura de explorador verde','Armadura de cazador','Armadura espinosa del bosque','Armadura de montaraz azul','Armadura de pícaro carmesí','Armadura de ladrón gris','Armadura de rastreador','Armadura de acechador violeta','Armadura de asesino negro','Armadura de guardabosques ancestral']},
 {category:'Pieles y armaduras de bestia',names:['Piel de oso pardo','Piel de lobo negro','Piel de lobo blanco','Piel de bestia cornuda','Armadura tribal con cuernos','Piel de lobo ártico','Piel de bestia sangrienta','Piel de oso ancestral','Piel de yeti','Piel de león dorado']},
 {category:'Cotas de malla ligeras',names:['Cota de malla común','Cota de malla oscura','Cota de malla verdosa','Cota de malla azul','Cota de malla carmesí','Cota de malla de acero','Cota de malla plateada','Cota de malla arcana','Cota de malla negra','Cota de malla dorada']},
 {category:'Cotas de malla pesadas',names:['Cota de malla reforzada','Malla pesada del bosque','Malla pesada azul','Malla pesada carmesí','Malla pesada plateada','Malla pesada negra y dorada','Malla pesada violeta','Malla de guardia imperial','Malla pesada de obsidiana','Malla pesada real']},
 {category:'Armaduras de escamas',names:['Armadura de escamas de bronce','Escamas del pantano','Escamas azules','Escamas de dragón rojo','Escamas plateadas','Escamas arcanas','Escamas turquesa','Escamas negras','Escamas doradas','Escamas cristalinas blancas']},
 {category:'Brigantinas y lamelares',names:['Brigantina de hierro','Brigantina verde','Brigantina azul','Brigantina carmesí','Brigantina plateada','Brigantina violeta','Brigantina turquesa','Brigantina negra','Brigantina negra y dorada','Brigantina blanca y dorada']},
 {category:'Corazas de bronce',names:['Coraza de bronce','Coraza de bronce envejecido','Coraza de bronce con pátina','Coraza de cobre rojo','Coraza de bronce pesado','Coraza de latón dorado','Coraza de bronce arcano','Coraza de bronce negro','Coraza de oro antiguo','Coraza ceremonial dorada']},
 {category:'Armaduras de placas',names:['Armadura de placas de acero','Placas de acero azulado','Placas de la Guardia Roja','Placas de acero negro','Placas plateadas con oro','Placas blancas de caballero','Placas arcanas violetas','Placas oscuras','Placas negras y doradas','Placas blancas y doradas']},
 {category:'Armaduras pesadas de caballero',names:['Armadura pesada de caballero','Armadura pesada azul','Armadura pesada carmesí','Armadura pesada de obsidiana','Armadura pesada de campeón','Armadura pesada imperial','Armadura pesada arcana','Armadura pesada infernal','Armadura pesada negra y dorada','Armadura pesada del rey oscuro']},
 {category:'Armaduras sagradas y reales',names:['Armadura del paladín solar','Armadura real azul y dorada','Armadura del paladín de fuego','Armadura del guardián celestial','Armadura áurea del campeón','Armadura del cruzado blanco','Armadura del paladín arcano','Armadura del ángel custodio','Armadura real alada','Armadura del serafín blanco']},
 {category:'Armaduras elementales',names:['Armadura de magma','Armadura de hielo cristalino','Armadura del relámpago dorado','Armadura de espinas vivientes','Armadura del glaciar','Armadura de cristal arcano','Armadura de roca rúnica','Armadura de coral abisal','Armadura de piedra ancestral','Armadura de nubes eternas']},
 {category:'Armaduras oscuras, demoníacas y cristalinas',names:['Armadura del demonio carmesí','Armadura de sombra abisal','Armadura de hueso infernal','Armadura del vacío violeta','Armadura de cristal glacial','Armadura del corazón oscuro','Armadura del señor infernal','Armadura de espinas venenosas','Armadura de amatista viviente','Armadura espectral turquesa']},
 {category:'Armaduras míticas y legendarias',names:['Armadura del Sol Eterno','Armadura del Arcángel','Armadura del Dragón Carmesí','Armadura del Guardián Esmeralda','Armadura del Firmamento','Armadura de la Luz Primordial','Armadura del Oráculo Arcano','Armadura del Fénix Dorado','Armadura del Eclipse','Armadura del Invierno Celestial']}
];
function armorPowerColumn(itemLevel,rarity,score=0){return weaponPowerColumn(itemLevel,rarity,score)}
function armorRowForLoot(rarity){
 const rarityIndex=Math.max(0,rarities.findIndex(r=>r.name===rarity.name)),level=game?.player?.level||1;
 const levelCap=level>=45?19:level>=35?18:level>=25?17:level>=18?16:level>=12?15:level>=7?12:8;
 const minRow=rarityIndex>=4?17:rarityIndex>=3?12:rarityIndex>=2?6:rarityIndex>=1?3:0;
 const rawMaxRow=rarityIndex>=4?19:rarityIndex>=3?18:rarityIndex>=2?15:rarityIndex>=1?11:8;
 return minRow+rng(Math.max(1,Math.max(minRow,Math.min(rawMaxRow,levelCap))-minRow+1));
}
function armorIconBase(row,col){return `armors/icon_r${String(row+1).padStart(2,'0')}_c${String(col+1).padStart(2,'0')}`}
function armorIconCandidates(row,col){const base=armorIconBase(row,col),legacy=`resources/armors/icon_r${String(row+1).padStart(2,'0')}_c${String(col+1).padStart(2,'0')}`;return[`${base}.png`,base,`${base}.webp`,`${base}.PNG`,`${legacy}.png`,legacy]}
function armorIconPath(row,col){return armorIconCandidates(row,col)[0]}
function armorName(row,col){return armorRows[row]?.names[Math.max(0,Math.min(ARMOR_ICON_COLUMNS-1,col))]||itemBases.chest[0]}
function normalizeArmorIcon(item){
 if(!item||item.slot!=='chest')return item;
 if(!Number.isInteger(item.armorIconRow))return item;
 item.armorIconRow=Math.max(0,Math.min(armorRows.length-1,item.armorIconRow));
 item.armorIconCol=Math.max(0,Math.min(ARMOR_ICON_COLUMNS-1,Number.isInteger(item.armorIconCol)?item.armorIconCol:0));
 item.armorCategory=armorRows[item.armorIconRow]?.category||item.armorCategory;
 item.armorIconPath=armorIconPath(item.armorIconRow,item.armorIconCol);
 return item;
}
function armorIconImage(item){
 normalizeArmorIcon(item);if(!Number.isInteger(item?.armorIconRow))return null;
 const key=armorIconBase(item.armorIconRow,item.armorIconCol);
 if(!armorIconCache[key]){const candidates=armorIconCandidates(item.armorIconRow,item.armorIconCol),img=new Image();img.dataset.tryIndex='0';img.dataset.failed='0';img.onerror=()=>{const next=Number(img.dataset.tryIndex||0)+1;if(next<candidates.length){img.dataset.tryIndex=String(next);img.src=candidates[next]}else img.dataset.failed='1'};img.src=candidates[0];armorIconCache[key]=img}
 const img=armorIconCache[key];item.armorIconPath=img.currentSrc||img.src||item.armorIconPath;return img;
}

const itemIconShapes={
 weapon:['blade','hammer','axe','mace','spear'],
 offhand:['shield','book','lid','orb','board'],
 head:['helm','hood','crown','mask','pot'],
 chest:['armor','vest','robe','plate','coat'],
 hands:['glove','gauntlet','claw','wrap','mitten'],
 legs:['pants','greaves','skirt','plates','leggings'],
 boots:['boot','shoe','sandal','greaveboot','clog'],
 neck:['amulet','chain','tooth','keyneck','seal'],
 ring1:['ring','gemring','skullring','band','sigilring'],
 ring2:['ring','gemring','skullring','band','sigilring'],
 trinket1:['sock','ticket','eyeStone','staple','miniExt'],
 trinket2:['screw','figurine','coupon','key','dice']
};
function drawItemIcon(canvas,item){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=false;q.clearRect(0,0,48,48);
 q.fillStyle='#21172a';q.fillRect(0,0,48,48);
 if(item?.icon){try{const hex=item.icon.startsWith('#')?item.icon.slice(1):item.icon,data='data:image/png;base64,'+hexToBase64(hex),img=configIconImage(data);if(img.complete&&img.naturalWidth){q.drawImage(img,0,0,48,48);q.strokeStyle=tierColor(item.rarity);q.lineWidth=2;q.strokeRect(2,2,44,44);return}img.onload=()=>drawItemIcon(canvas,item)}catch(e){}}
 if(item?.slot==='weapon'){
  const img=weaponIconImage(item);
  if(img?.complete&&img.naturalWidth){
   const rect=weaponUsesSwordSpritesheet(item.weaponIconRow)?swordSpriteRect(item.weaponIconRow,item.weaponIconCol):null;
   if(rect)q.drawImage(img,rect.x,rect.y,rect.size,rect.size,3,3,42,42);else q.drawImage(img,3,3,42,42);
   q.strokeStyle=item.rarity==='legendary'?'#ffb746':item.rarity==='epic'?'#d68cff':item.rarity==='rare'?'#71b4ff':item.rarity==='uncommon'?'#75e39d':'#ddd';q.lineWidth=2;q.strokeRect(2,2,44,44);
   return;
  }
  if(img)img.onload=()=>drawItemIcon(canvas,item);
 }
 if(item?.slot==='chest'&&Number.isInteger(item.armorIconRow)){
  const img=armorIconImage(item);
  if(img?.complete&&img.naturalWidth){q.drawImage(img,3,3,42,42);q.strokeStyle=item.rarity==='legendary'?'#ffb746':item.rarity==='epic'?'#d68cff':item.rarity==='rare'?'#71b4ff':item.rarity==='uncommon'?'#75e39d':'#ddd';q.lineWidth=2;q.strokeRect(2,2,44,44);return}
  if(img)img.onload=()=>drawItemIcon(canvas,item);
 }
 const shape=item.iconShape||'gemring',c=item.rarity==='legendary'?'#ffb746':item.rarity==='epic'?'#d68cff':item.rarity==='rare'?'#71b4ff':item.rarity==='uncommon'?'#75e39d':'#ddd';
 q.fillStyle=c;q.strokeStyle='#0b0810';q.lineWidth=3;
 const rect=(x,y,w,h)=>{q.fillRect(x,y,w,h);q.strokeRect(x,y,w,h)};
 if(shape==='vial'){rect(18,8,12,8);rect(14,17,20,23);q.fillStyle='#ffffff66';q.fillRect(18,22,5,12)}
 else if(['blade','spear'].includes(shape)){rect(22,5,6,29);rect(14,31,22,5);rect(20,36,10,8)}
 else if(['hammer','mace','axe'].includes(shape)){rect(21,16,6,27);rect(10,7,28,13)}
 else if(['shield','lid','board'].includes(shape)){q.beginPath();q.moveTo(8,8);q.lineTo(40,8);q.lineTo(36,34);q.lineTo(24,43);q.lineTo(12,34);q.closePath();q.fill();q.stroke()}
 else if(['book','orb'].includes(shape)){rect(9,10,30,28);q.fillStyle='#21172a';q.fillRect(23,11,3,26)}
 else if(['helm','hood','crown','mask','pot'].includes(shape)){rect(10,11,28,24);q.fillStyle='#21172a';q.fillRect(16,25,5,5);q.fillRect(28,25,5,5)}
 else if(['armor','vest','robe','plate','coat'].includes(shape)){q.beginPath();q.moveTo(14,8);q.lineTo(34,8);q.lineTo(40,18);q.lineTo(34,41);q.lineTo(14,41);q.lineTo(8,18);q.closePath();q.fill();q.stroke()}
 else if(['glove','gauntlet','claw','wrap','mitten'].includes(shape)){rect(14,19,20,21);for(let i=0;i<4;i++)rect(11+i*7,7,5,14)}
 else if(['pants','greaves','skirt','plates','leggings'].includes(shape)){rect(12,8,24,14);rect(12,20,9,23);rect(27,20,9,23)}
 else if(['boot','shoe','sandal','greaveboot','clog'].includes(shape)){rect(13,9,13,25);rect(13,31,26,10)}
 else if(['amulet','chain','tooth','keyneck','seal'].includes(shape)){q.beginPath();q.arc(24,28,10,0,Math.PI*2);q.fill();q.stroke();rect(22,5,4,14)}
 else if(['ring','gemring','skullring','band','sigilring'].includes(shape)){q.beginPath();q.arc(24,27,11,0,Math.PI*2);q.stroke();rect(19,8,10,10)}
 else {q.beginPath();q.arc(24,24,12,0,Math.PI*2);q.fill();q.stroke()}
}
function lootToast(item){
 const d=document.createElement('div');d.className='lootToast';const c=document.createElement('canvas');c.width=c.height=48;drawItemIcon(c,item);
 const t=document.createElement('div');t.innerHTML=`<b class="${item.rarity}">${item.name}</b><div class="small">${slotNames[item.slot]} · ${item.label} · Nv. ${item.itemLevel}</div><div class="itemScore">Poder ${item.score}</div>`;d.append(c,t);document.body.appendChild(d);setTimeout(()=>d.remove(),1700)
}


const primaryAffixes=[
 {key:'strength',label:'Fuerza',min:1,max:3,slots:['weapon','hands','chest','ring1','ring2','neck']},
 {key:'vitality',label:'Vitalidad',min:1,max:3,slots:['chest','head','legs','boots','ring1','ring2']},
 {key:'agility',label:'Agilidad',min:1,max:3,slots:['weapon','hands','boots','ring1','ring2','trinket1','trinket2']},
 {key:'luck',label:'Suerte',min:1,max:3,slots:['ring1','ring2','neck','trinket1','trinket2']},
 {key:'intelligence',label:'Inteligencia',min:1,max:3,slots:['weapon','offhand','head','neck','ring1','ring2']},
 {key:'wisdom',label:'Sabiduría',min:1,max:3,slots:['offhand','head','chest','neck','ring1','ring2']}
];
const secondaryAffixes=[
 {key:'maxHp',label:'Vida máxima',min:4,max:10,slots:['head','chest','legs','boots','neck']},
 {key:'maxStamina',label:'Stamina máxima',min:3,max:8,slots:['weapon','hands','legs','boots','trinket1','trinket2']},
 {key:'maxMana',label:'Maná máximo',min:3,max:8,slots:['offhand','head','neck','ring1','ring2','trinket1','trinket2']},
 {key:'armor',label:'Armadura',min:1,max:4,slots:['offhand','head','chest','hands','legs','boots']},
 {key:'damage',label:'Daño',min:1,max:4,slots:['weapon','hands','ring1','ring2','trinket1','trinket2']},
 {key:'critChance',label:'Prob. crítico',min:1,max:3,percent:true,slots:['weapon','hands','ring1','ring2','neck']},
 {key:'critDamage',label:'Daño crítico',min:4,max:10,percent:true,slots:['weapon','ring1','ring2','trinket1','trinket2']},
 {key:'dodge',label:'Evasión',min:1,max:3,percent:true,slots:['boots','legs','ring1','ring2','trinket1']},
 {key:'physicalPower',label:'Poder físico',min:2,max:6,percent:true,slots:['weapon','hands','chest','trinket1']},
 {key:'magicPower',label:'Poder mágico',min:2,max:6,percent:true,slots:['weapon','offhand','head','neck','trinket2']},
 {key:'staminaRegen',label:'Regeneración de stamina',min:1,max:3,slots:['boots','legs','trinket1']},
 {key:'manaRegen',label:'Regeneración de maná',min:1,max:3,slots:['head','neck','trinket2']}
];
const passivePool=[
 {id:'vampiric',name:'Circuito Vampírico',desc:'Cura un porcentaje del daño causado.',stat:'lifeSteal',min:2,max:8,percent:true},
 {id:'thorns',name:'Chapa de Represalia',desc:'Devuelve daño al atacante.',stat:'thorns',min:1,max:6},
 {id:'executioner',name:'Protocolo Verdugo',desc:'Más daño contra enemigos por debajo del 30% de vida.',stat:'executeBonus',min:8,max:24,percent:true},
 {id:'treasure',name:'Olfato de Chatarra',desc:'Aumenta la probabilidad de encontrar objetos raros.',stat:'rarityFind',min:4,max:18,percent:true},
 {id:'barrier',name:'Barrera de Inicio',desc:'Obtienes escudo al comenzar cada piso.',stat:'floorShield',min:3,max:14},
 {id:'resourceful',name:'Reciclaje Energético',desc:'Recuperas recursos al derrotar enemigos.',stat:'killResource',min:2,max:8},
 {id:'bossHunter',name:'Cazajefes',desc:'Inflige más daño a jefes.',stat:'bossDamage',min:8,max:25,percent:true},
 {id:'lastStand',name:'Último Expediente',desc:'Ganas armadura con poca vida.',stat:'lowHpArmor',min:2,max:10},
 {id:'cooldown',name:'Compilación Acelerada',desc:'Probabilidad de reducir enfriamientos al usar habilidades.',stat:'cooldownRefund',min:4,max:15,percent:true},
 {id:'stun',name:'Impacto Desincronizado',desc:'Probabilidad de aturdir al golpear.',stat:'stunChance',min:2,max:10,percent:true}
];
const legendaryEffects=[
 {id:'meteor',name:'Lluvia de Ferralla',desc:'Al usar una habilidad, 12% de lanzar un impacto adicional sobre un enemigo visible.'},
 {id:'secondLife',name:'Copia de Seguridad',desc:'Una vez por piso, evita una muerte y recupera 35% de vida.'},
 {id:'phase',name:'Error de Colisión',desc:'Puedes atravesar una pared una vez cada 12 turnos.'},
 {id:'overload',name:'Sobrecarga Dual',desc:'Las habilidades mágicas también consumen stamina y ganan 25% de daño.'},
 {id:'berserk',name:'Núcleo Inestable',desc:'Por debajo del 35% de vida, obtienes +30% de daño.'},
 {id:'midas',name:'Conversión Dorada',desc:'El oro recogido recupera vida, maná y stamina.'},
 {id:'echo',name:'Eco de Firmware',desc:'10% de repetir gratuitamente una habilidad usada.'},
 {id:'collector',name:'Coleccionista Patológico',desc:'Cada objeto equipado de rareza distinta otorga +3% a todas las estadísticas.'}
];
function activeLootLuck(){return (game?.player?.activePotions||[]).reduce((s,p)=>s+(Number(p.effect?.lootLuck)||0),0)}
function weightedRarity(level){
 const luck=game?.player?.derived?.finalStats?.luck??game?.player?.stats?.luck??0,row=currentLootProgressionRow(game?.floor||1,game?.player?.level||level||1);
 const bonus=(level-1)*.18+(luck+activeLootLuck())*.14+(game?.player?.derived?.rarityFind||0)*.18+(game?.rewardRarityBonus||0)*.55;
 const adjusted=rarities.filter(r=>lootRarityAllowed(r.name,row)).map((r,i)=>({...r,w:Math.max(.2,(row.rarityWeights?.[r.name]??r.weight)*(1+(i-1)*bonus/55))}));
 let total=adjusted.reduce((s,r)=>s+r.w,0),roll=Math.random()*total;
 for(const r of adjusted){roll-=r.w;if(roll<=0)return r}
 return adjusted[0]||rarities[0];
}
function affixValue(def,itemLevel,rarity){
 const scale=1+(itemLevel-1)*.16;
 return Math.max(1,Math.round((def.min+Math.random()*(def.max-def.min))*scale*rarity.mult));
}
function chooseUnique(pool,count){
 const a=[...pool],out=[];
 while(a.length&&out.length<count)out.push(a.splice(rng(a.length),1)[0]);
 return out;
}
function itemBudget(itemLevel,rarity){
 return Math.round((8+itemLevel*5)*rarity.mult);
}
function buildItemAffixes(slot,itemLevel,rarity){
 const min=rarity.affixes[0],max=rarity.affixes[1],count=min+rng(max-min+1);
 const available=[...primaryAffixes,...secondaryAffixes].filter(a=>a.slots.includes(slot));
 return chooseUnique(available,count).map(def=>({key:def.key,label:def.label,value:affixValue(def,itemLevel,rarity),percent:!!def.percent}));
}
function buildPassives(itemLevel,rarity){
 let count=0;
 if(Math.random()<rarity.passives)count++;
 if(rarity.name==='legendary'&&Math.random()<.55)count++;
 if(rarity.name==='artifact'&&Math.random()<(rarity.secondPassive||0))count++;
 return chooseUnique(passivePool,count).map(p=>({...p,value:affixValue(p,itemLevel,rarity)}));
}
function buildEffects(rarity){
 const out=[];
 if(Math.random()<rarity.effects)out.push({...pick(legendaryEffects)});
 return out;
}
function potionResourceLabel(resource){return {hp:'HP',mana:'maná',stamina:'stamina'}[resource]||resource}
function describePotionValue(e,resource){const pct=e[`${resource}Pct`],flat=e[`${resource}Flat`];if(pct)return `${Math.round(pct*100)}%`;if(flat)return `${flat}`;return ''}
function describePotionEffect(item){
 const e=item?.potionEffect||item?.effect||{},type=item?.potionEffectType||item?.potionId||item?.kind;if(item?.type!=='potion')return '';
 const parts=[];
 for(const resource of ['hp','mana','stamina']){let value=describePotionValue(e,resource);if(resource==='hp'&&!value&&e.healPct)value=`${Math.round(e.healPct*100)}%`;if(resource==='hp'&&!value&&e.regenPct)value=`${Math.round(e.regenPct*100)}%`;if(value)parts.push(`${type==='regen'?'Regenera':'Recupera'} ${value} ${potionResourceLabel(resource)}${type==='regen'?'/turno':''}`)}
 const stats=e.stats||{};const statText=Object.entries(stats).filter(([,v])=>Number(v)).map(([k,v])=>`${v>0?'+':''}${v} ${DEFENSE_STAT_LABELS[k]||k}`).join(', ');if(statText)parts.push(statText);
 if(e.skillId)parts.push(`Aprende ${skillDefs[e.skillId]?.name||e.skillId}`);if(e.invulnerable)parts.push('Invulnerabilidad');if(e.invisible)parts.push('Invisibilidad');if(type==='teleportSafe')parts.push('Teletransporte a sala segura');if(type==='teleportStairs')parts.push('Teletransporte a escalera');if(item.duration)parts.push(`${item.duration} turnos`);return parts.join(' · ')
}
function describeItem(item){item.defenseStat=item.defenseStat||inferWeaponDefenseStat(item);
 const lines=[];
 if(item.type==='potion')lines.push(`<span class="effectLine">☥ ${describePotionEffect(item)||item.desc||'Poción'}</span>`);
 if(item.flavor)lines.push(`<span class="small">${item.flavor}</span>`);if(item.skillIds?.length)lines.push(`<span class="effectLine">✦ Habilidades: ${item.skillIds.map(id=>skillDefs[id]?.name||id).join(', ')}</span>`);if(item.slot==='weapon'&&item.damageDice)lines.push(`<span class="affixLine">Daño arma: ${item.damageDice}</span>`);for(const a of item.affixes||[])lines.push(`<span class="affixLine">+${a.value}${a.percent?'%':''} ${a.label}</span>`);
 for(const p of item.passives||[])lines.push(`<span class="passiveLine">◆ ${p.name}: ${p.desc} (${p.value}${p.percent?'%':''})</span>`);
 for(const e of item.effects||[])lines.push(`<span class="effectLine">✦ ${e.name}: ${e.desc}</span>`);
 return lines.join('');
}
function vitalityHpBonus(vitality){return Math.max(0,Math.floor(Number(vitality||0)*2))}
function worldParams(){return game?.worldParams||selectedDungeonWorld?.world_json?.params||DEFAULT_WORLD_PARAMS}
function pctMult(value){const n=Number(value);return Number.isFinite(n)?n/100:1}
function damageDealtMultiplier(){return pctMult(worldParams().damageDealtPct)}
function damageReceivedMultiplier(){return pctMult(worldParams().damageReceivedPct)}
function xpReceivedMultiplier(){return pctMult(worldParams().xpReceivedPct)}
function worldLifeMultiplier(){return pctMult(worldParams().lifePct)}
function worldPercentFlatAdjustment(percent,step=3){const p=Number(percent)||100;return Math.round((p-100)/100*step)}
function incomingDamageBudget(){const p=game?.player||{};return Math.max(4,Math.round(5+(game?.floor||1)*.45+(p.level||1)*.18))}
function normalizeIncomingDamage(amount,sourceName='Ataque enemigo'){const base=Math.max(1,Number(amount)||1),budget=incomingDamageBudget(),soft=base<=budget?base:budget+Math.sqrt(base-budget)*.65;const boss=/jefe|boss|campeón|rey/i.test(sourceName)?2:0,adjust=worldPercentFlatAdjustment(worldParams().damageReceivedPct,3);return Math.max(1,Math.round(soft*ENEMY_DAMAGE_BASE_MULT+boss+adjust))}
function normalizeWorldParams(raw={}){const p={...DEFAULT_WORLD_PARAMS,...raw};for(const k of ['damageReceivedPct','damageDealtPct','lifePct','xpReceivedPct','enemyCountPct','enemyLootPct']){p[k]=Math.max(25,Math.min(500,Math.round(Number(p[k])||DEFAULT_WORLD_PARAMS[k])))}p.floors=Math.max(1,Math.min(100,Math.round(Number(p.floors)||DEFAULT_WORLD_PARAMS.floors)));p.apMode=p.apMode===true||p.apMode==='true'||p.apMode===1;p.floorPlan=Array.isArray(p.floorPlan)?p.floorPlan.slice(0,p.floors).map((row,i)=>({floor:i+1,floorId:row?.floorId?String(row.floorId):'',familyName:row?.familyName?String(row.familyName):''})):[];return p}
function readWorldParamsForm(){const floors=Number(document.getElementById('worldFloorsInput')?.value)||DEFAULT_WORLD_PARAMS.floors,rows=[...document.querySelectorAll('[data-world-floor-row]')].map(row=>({floor:Number(row.dataset.worldFloorRow),floorId:row.querySelector('[data-world-floor-select]')?.value||'',familyName:row.querySelector('[data-world-family-select]')?.value||''}));return normalizeWorldParams({damageReceivedPct:document.getElementById('worldDamageReceivedPct')?.value,damageDealtPct:document.getElementById('worldDamageDealtPct')?.value,lifePct:document.getElementById('worldLifePct')?.value,xpReceivedPct:document.getElementById('worldXpReceivedPct')?.value,enemyCountPct:document.getElementById('worldEnemyCountPct')?.value,enemyLootPct:document.getElementById('worldEnemyLootPct')?.value,apMode:!!document.getElementById('worldApMode')?.checked,floors,floorPlan:rows})}
function worldPlanEntry(params,floor){return (params?.floorPlan||[]).find(r=>Number(r.floor)===Number(floor))||null}
function pickConfiguredFamilyForFloorWithParams(floor,params){const wanted=worldPlanEntry(params,floor)?.familyName;if(wanted){const pool=normalizedEnemyFamilies();const found=pool.find(f=>f.name.toLowerCase()===wanted.toLowerCase());if(found)return found}return pickConfiguredFamilyForFloor(floor)}
function floorTilesetForWorldPlan(floor,params){const id=worldPlanEntry(params,floor)?.floorId;if(!id)return null;return normalizedSupabaseFloors().find(f=>String(f.dbId||f.id||f.name)===String(id))||null}
function renderWorldFloorPlan(){const list=document.getElementById('worldFloorPlanList'),input=document.getElementById('worldFloorsInput');if(!list||!input)return;const count=Math.max(1,Math.min(100,Number(input.value)||DEFAULT_WORLD_PARAMS.floors)),floors=normalizedConfigFloors(),families=normalizedEnemyFamilies();const old=new Map([...list.querySelectorAll('[data-world-floor-row]')].map(row=>[Number(row.dataset.worldFloorRow),{floorId:row.querySelector('[data-world-floor-select]')?.value||'',familyName:row.querySelector('[data-world-family-select]')?.value||''}]));const randomFloorOption='<option value="">Aleatorio</option>',randomFamilyOption='<option value="">Aleatoria</option>',floorOptions=randomFloorOption+floors.map(f=>`<option value="${f.dbId||f.id||f.name}">${f.name}</option>`).join(''),familyOptions=randomFamilyOption+families.map(f=>`<option value="${f.name}">${f.name}</option>`).join('');list.innerHTML=Array.from({length:count},(_,i)=>{const n=i+1;return `<div class="worldFloorPlanRow" data-world-floor-row="${n}"><b>Piso ${n}</b><label>Floor<select data-world-floor-select>${floorOptions}</select></label><label>Familia<select data-world-family-select>${familyOptions}</select></label></div>`}).join('');list.querySelectorAll('[data-world-floor-row]').forEach(row=>{const n=Number(row.dataset.worldFloorRow),o=old.get(n)||{};const fs=row.querySelector('[data-world-floor-select]'),fam=row.querySelector('[data-world-family-select]');if(o.floorId&&[...fs.options].some(x=>x.value===o.floorId))fs.value=o.floorId;else fs.value='';if(o.familyName&&[...fam.options].some(x=>x.value===o.familyName))fam.value=o.familyName;else fam.value=''});}
function setupWorldSettings(){const input=document.getElementById('worldFloorsInput');if(input&&!input.dataset.ready){input.dataset.ready='1';input.addEventListener('change',renderWorldFloorPlan);input.addEventListener('input',renderWorldFloorPlan)}for(const [inputId,valueId] of [['worldDamageReceivedPct','worldDamageReceivedValue'],['worldDamageDealtPct','worldDamageDealtValue'],['worldLifePct','worldLifeValue'],['worldXpReceivedPct','worldXpReceivedValue'],['worldEnemyCountPct','worldEnemyCountValue'],['worldEnemyLootPct','worldEnemyLootValue']]){const el=document.getElementById(inputId),out=document.getElementById(valueId);if(el&&out){const sync=()=>out.textContent=`${el.value}%`;sync();if(!el.dataset.ready){el.dataset.ready='1';el.addEventListener('input',sync)}}}renderWorldFloorPlan()}
// Applies one buff/debuff effect entry to a numeric stat. The modern shape
// is {mode:'add'|'mult',value} - a flat number added, or a straight
// multiplier. A bare number is legacy shorthand for a percentage bonus
// (current*(1+eff)), kept for the many hardcoded buffs elsewhere in the
// file that still use it and for skills_json rows saved before this shape
// existed - falling back gracefully instead of producing NaN.
function applyStatDelta(current,eff){
 if(eff==null)return current;
 if(typeof eff==='object')return eff.mode==='mult'?current*eff.value:current+eff.value;
 return current*(1+eff);
}
// 'armor'/'damage' buffs target an aggregate (total('armor')/total('damage'),
// and the per-attack damage roll) rather than a raw player stat, so they're
// read live from activeBuffs at the point of use instead of being folded
// into recomputeDerived - these two split an effects[key] entry into its
// multiplicative and additive contributions across every active buff.
function activeBuffMultFactor(key){
 return (game.player?.activeBuffs||[]).reduce((m,b)=>{
  const eff=b.effects?.[key];if(eff==null)return m;
  if(typeof eff==='object')return eff.mode==='mult'?m*eff.value:m;
  return m*(1+eff); // legacy percentage buffs (bloodBuff, teleportBuff, etc)
 },1)
}
function activeBuffFlatBonus(key){
 return (game.player?.activeBuffs||[]).reduce((s,b)=>{
  const eff=b.effects?.[key];
  return (eff&&typeof eff==='object'&&eff.mode!=='mult')?s+eff.value:s;
 },0)
}
function recomputeDerived(){
 const p=game.player,base={...p.stats};
 const rb=p.raceBonuses||raceDefs[p.race]?.bonuses||{},pp=p.permanentPotionStats||{};
 for(const k of ['strength','vitality','agility','luck','intelligence','wisdom']){if(rb[k])base[k]=(base[k]||0)+rb[k];if(pp[k])base[k]=(base[k]||0)+pp[k]}
 const d={damage:p.baseDamage,armor:p.baseArmor+(rb.armor||0),maxHp:30+base.vitality*3+vitalityHpBonus(base.vitality)+(rb.maxHp||0)+(pp.maxHp||0),maxStamina:45+base.strength*4+base.agility*2+(rb.maxStamina||0),maxMana:30+base.wisdom*5+base.intelligence*3+(rb.maxMana||0),
 critChance:5+base.luck*.6+(rb.critChance||0),critDamage:150,dodge:base.agility*.45+(rb.dodge||0),physicalPower:rb.physicalPower||0,magicPower:rb.magicPower||0,staminaRegen:6+Math.floor(base.strength/4)+(rb.staminaRegen||0),manaRegen:4+Math.floor(base.wisdom/4)+(rb.manaRegen||0),rarityFind:rb.rarityFind||0};
 const allStats={...base};
 for(const item of Object.values(p.equipment||{})){
  if(!item)continue;
  for(const a of item.affixes||[]){
   if(a.key in allStats)allStats[a.key]+=a.value;
   else d[a.key]=(d[a.key]||0)+a.value;
  }
  for(const pa of item.passives||[])d[pa.stat]=(d[pa.stat]||0)+pa.value;
 }
 for(const pot of p.activePotions||[]){for(const [k,v] of Object.entries(pot.effect?.stats||{}))if(k in allStats)allStats[k]+=Number(v)||0}
 // Buff-type skills can target any of the 6 core stats directly (buffStat)
 // instead of always touching damage/armor - applied here, before the
 // damage/armor/hp/stamina/mana deltas below are derived from allStats.
 // effects[k] is normally {mode:'add'|'mult',value}: a flat number added, or
 // a straight multiplier, never a "+X%" coefficient. A bare number is also
 // accepted and treated as a legacy percentage bonus (current*(1+eff)) -
 // both the many hardcoded creative-effect buffs elsewhere in this file
 // (bloodBuff, teleportBuff, fortify, etc) and any skills_json rows saved
 // by the admin editor before this add/mult rework still use that shape.
 for(const b of p.activeBuffs||[])for(const k of ['strength','vitality','agility','luck','intelligence','wisdom']){
  const eff=b.effects?.[k];if(eff==null)continue;
  allStats[k]=Math.round(applyStatDelta(allStats[k],eff));
 }
 d.maxHp+=Math.max(0,(allStats.vitality-base.vitality)*5);
 d.maxStamina+=Math.max(0,(allStats.strength-base.strength)*4+(allStats.agility-base.agility)*2);
 d.maxMana+=Math.max(0,(allStats.wisdom-base.wisdom)*5+(allStats.intelligence-base.intelligence)*3);
 d.damage+=Math.floor((allStats.strength-base.strength)*1.2);
 d.armor+=Math.floor((allStats.vitality-base.vitality)*.6);
 for(const b of p.activeBuffs||[]){
  if(b.effects?.maxHp)d.maxHp+=b.effects.maxHp;
 }
 for(const pot of p.activePotions||[]){const e=pot.effect||{};if(e.armorMult)d.armor=Math.round(d.armor*(1+e.armorMult));if(e.vision)d.vision=(d.vision||p.vision||0)+(Number(e.vision)||0);if(e.staminaRegen)d.staminaRegen+=Number(e.staminaRegen)||0;if(e.manaRegen)d.manaRegen+=Number(e.manaRegen)||0}
 d.finalStats=allStats;
 p.derived=d;
 p.maxHp=d.maxHp;p.maxStamina=d.maxStamina;p.maxMana=d.maxMana;
 p.hp=Math.min(p.hp,p.maxHp);p.stamina=Math.min(p.stamina,p.maxStamina);p.mana=Math.min(p.mana,p.maxMana);
}


const potionDefs=[
 {id:'minorHealing',name:'Poción de curación menor',tier:'common',kind:'instant',desc:'Recupera 25% de vida.',effect:{healPct:.25}},
 {id:'greaterHealing',name:'Poción de curación superior',tier:'rare',kind:'instant',desc:'Recupera 55% de vida.',effect:{healPct:.55}},
 {id:'manaDraught',name:'Breve de maná',tier:'uncommon',kind:'instant',desc:'Recupera 45% de maná.',effect:{manaPct:.45}},
 {id:'staminaTonic',name:'Tónico del corredor',tier:'uncommon',kind:'instant',desc:'Recupera 50% de stamina.',effect:{staminaPct:.50}},
 {id:'berserkerElixir',name:'Elixir del berserker',tier:'rare',kind:'temporary',duration:12,desc:'+20% de daño durante 12 turnos.',effect:{damageMult:.20}},
 {id:'ironSkin',name:'Poción de piel de hierro',tier:'rare',kind:'temporary',duration:12,desc:'+25% de armadura durante 12 turnos.',effect:{armorMult:.25}},
 {id:'nightSight',name:'Licor de visión nocturna',tier:'uncommon',kind:'temporary',duration:18,desc:'+3 al radio de visión durante 18 turnos.',effect:{vision:3}},
 {id:'fortuneShot',name:'Chupito de fortuna',tier:'epic',kind:'temporary',duration:15,desc:'+20 de Suerte efectiva para botín durante 15 turnos.',effect:{lootLuck:20}},
 {id:'giantBlood',name:'Sangre de gigante',tier:'legendary',kind:'permanent',desc:'+2 Fuerza permanente.',effect:{strength:2}},
 {id:'sageTears',name:'Lágrimas del sabio',tier:'legendary',kind:'permanent',desc:'+2 Inteligencia permanente.',effect:{intelligence:2}},
 {id:'dragonHeart',name:'Corazón de dragón licuado',tier:'legendary',kind:'permanent',desc:'+10 de vida máxima permanente.',effect:{maxHp:10}},
 {id:'shadowEssence',name:'Esencia de sombra',tier:'legendary',kind:'permanent',desc:'+2 Agilidad permanente.',effect:{agility:2}}
];
const STARTER_HEALING_POTION_ID='109';
const STARTER_HEALING_POTION_TEMPLATE={id:STARTER_HEALING_POTION_ID,type:'potion',slot:'consumable',rarity:'common',label:skillRarities.common?.label||'Común',name:'Pocion de curacion comun #109',desc:'Recupera 25% de vida.',potionId:'commonHealing109',kind:'instant',duration:0,effect:{healPct:.25},iconShape:'vial',itemLevel:1,score:8,quantity:1};
function cloneStarterHealingPotion(){return {...STARTER_HEALING_POTION_TEMPLATE,id:STARTER_HEALING_POTION_ID,effect:{...STARTER_HEALING_POTION_TEMPLATE.effect},quantity:1}}
function potionStackKey(item){return [item.type,item.potionId||'',item.name||'',item.rarity||'',item.kind||'',item.duration||0,JSON.stringify(item.effect||item.potionEffect||{})].join('|')}
function addInventoryItem(item){
 if(!game?.inventory||!item)return item;
 if(item.type==='potion'){
  const k=potionStackKey(item),existing=game.inventory.find(i=>i.type==='potion'&&potionStackKey(i)===k);
  if(existing){existing.quantity=(existing.quantity||1)+(item.quantity||1);return existing}
  item.quantity=item.quantity||1;
 }
 game.inventory.push(item);return item
}
// An advanced/custom class can pin explicit starter potions in its editor
// (class_json.starterPotionIds, config_item row ids); falls back to the
// classic 2x default healing potion when unset/empty (also the behavior
// for every hardcoded class, which never sets this field).
function addStarterPotions(classId){
 const ids=configClassRowForId(classId)?.class_json?.starterPotionIds;
 if(Array.isArray(ids)&&ids.length){
  for(const id of ids.slice(0,3)){
   const row=configItems.find(r=>String(r.id)===String(id));
   const item=row&&configuredItemFromRow(row,{itemLevel:{min:1,max:2}},1);
   if(item)addInventoryItem(item)
  }
  return
 }
 for(let i=0;i<2;i++)addInventoryItem(cloneStarterHealingPotion())
}
function compactPotionStacks(){const original=[...(game?.inventory||[])];game.inventory=[];for(const item of original)addInventoryItem(item)}

function potionRarityWeight(tier,quality){
 const base={common:50,uncommon:28,rare:14,epic:6,legendary:2}[tier]||1;
 return base*Math.max(.25,1+(quality-1)*({common:-.16,uncommon:-.06,rare:.10,epic:.22,legendary:.32}[tier]||0))
}
function makePotion(quality=1){
 let total=potionDefs.reduce((s,p)=>s+potionRarityWeight(p.tier,quality),0),roll=Math.random()*total;
 let def=potionDefs[0];
 for(const p of potionDefs){roll-=potionRarityWeight(p.tier,quality);if(roll<=0){def=p;break}}
 return{id:crypto.randomUUID(),type:'potion',slot:'consumable',rarity:def.tier,label:skillRarities[def.tier]?.label||def.tier,name:def.name,desc:def.desc,potionId:def.id,kind:def.kind,duration:def.duration||0,effect:{...def.effect},iconShape:'vial',itemLevel:Math.max(1,Math.round(quality)),quantity:1}
}
function nearestSafeRoom(){return [...(game.safeRooms||[])].sort((a,b)=>gridDistance(game.player,{x:a.cx,y:a.cy})-gridDistance(game.player,{x:b.cx,y:b.cy}))[0]}
function usePotion(id){
 const item=typeof id==='string'?game.inventory.find(i=>i.id===id):id;if(!item)return;
 if(typeof id==='string'&&isItemInMyTradeOffer(id)){log('Este objeto está en oferta de intercambio: retíralo antes de usarlo.','sys');return}
 const p=game.player,eff=item.effect||item.potionEffect||{};let message='';
 if(item.kind==='instant'){
  const bh=p.hp,bm=p.mana,bs=p.stamina,parts=[];
  if(eff.healPct||eff.hpPct)healEntity(p,Math.round(p.maxHp*(eff.healPct||eff.hpPct)));if(eff.hpFlat)healEntity(p,eff.hpFlat);
  if(eff.manaPct)p.mana=Math.min(p.maxMana,p.mana+Math.round(p.maxMana*eff.manaPct));if(eff.manaFlat)p.mana=Math.min(p.maxMana,p.mana+Number(eff.manaFlat));
  if(eff.staminaPct)p.stamina=Math.min(p.maxStamina,p.stamina+Math.round(p.maxStamina*eff.staminaPct));if(eff.staminaFlat)p.stamina=Math.min(p.maxStamina,p.stamina+Number(eff.staminaFlat));
  if(item.potionEffectType==='teleportSafe'){const r=nearestSafeRoom();if(r&&teleportPlayerTo(r.cx,r.cy))parts.push('teletransporte a sala segura')}
  if(item.potionEffectType==='teleportStairs'&&game.stairs&&teleportPlayerTo(game.stairs.x,game.stairs.y))parts.push('teletransporte a escalera');
  if(p.hp>bh)parts.push(`+${p.hp-bh} vida`);if(p.mana>bm)parts.push(`+${p.mana-bm} maná`);if(p.stamina>bs)parts.push(`+${p.stamina-bs} stamina`);
  message=parts.join(', ')||'Sin efecto: recursos completos.'
 }else if(item.kind==='temporary'){
  p.activePotions=p.activePotions||[];p.activePotions.push({name:item.name,turns:item.duration,effect:{...eff}});message=`Efecto temporal durante ${item.duration} turnos: ${item.desc||describePotionEffect(item)}`
 }else{
  p.permanentPotionStats=p.permanentPotionStats||{};if(eff.skillId)learnSkill(eff.skillId);for(const [k,v] of Object.entries(eff.stats||eff))if(potionStatKeys.includes(k)||k==='maxHp')p.permanentPotionStats[k]=(p.permanentPotionStats[k]||0)+Number(v||0);message=`Mejora permanente: ${item.desc||describePotionEffect(item)}`
 }
 if((item.quantity||1)>1)item.quantity--;else game.inventory=game.inventory.filter(i=>i.id!==item.id);recomputeDerived();updateUI();draw();banner(item.name.toUpperCase());log(`${item.name}: ${message}`,'loot');storyTitle.textContent='POCIÓN UTILIZADA';storyBody.innerHTML=`<div class="narrative"><p><b>${item.name}</b></p><p>${message}</p><div class="startActions"><button id="closePotionMessage">Continuar</button></div></div>`;storyOverlay.classList.remove('hidden');setTimeout(()=>document.getElementById('closePotionMessage')?.addEventListener('click',()=>storyOverlay.classList.add('hidden')),0)
}
function tickPotionEffects(){
 const p=game.player;if(!p?.activePotions)return;
 for(const e of p.activePotions){const eff=e.effect||{};if(eff.regenPct||eff.hpPct)healEntity(p,Math.round(p.maxHp*(eff.regenPct||eff.hpPct)));if(eff.hpFlat)healEntity(p,eff.hpFlat);if(eff.manaPct)p.mana=Math.min(p.maxMana,p.mana+Math.round(p.maxMana*eff.manaPct));if(eff.manaFlat)p.mana=Math.min(p.maxMana,p.mana+Number(eff.manaFlat));if(eff.staminaPct)p.stamina=Math.min(p.maxStamina,p.stamina+Math.round(p.maxStamina*eff.staminaPct));if(eff.staminaFlat)p.stamina=Math.min(p.maxStamina,p.stamina+Number(eff.staminaFlat));e.turns--}p.activePotions=p.activePotions.filter(e=>e.turns>0);recomputeDerived()
}

const themedItemCatalog={"fantasy": [{"id": "fantasy_00_00", "theme": "fantasy", "slot": "weapon", "name": "Espada del Zorro Tuerto", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_00_01", "theme": "fantasy", "slot": "weapon", "name": "Espada de la Taberna Hundida", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_00_02", "theme": "fantasy", "slot": "weapon", "name": "Espada del Rey Mendigo", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_00_03", "theme": "fantasy", "slot": "weapon", "name": "Espada de la Luna Vieja", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_00_04", "theme": "fantasy", "slot": "weapon", "name": "Espada del Bosque Burlón", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_01_00", "theme": "fantasy", "slot": "weapon", "name": "Hacha de la Luna Vieja", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_01_01", "theme": "fantasy", "slot": "weapon", "name": "Hacha del Bosque Burlón", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_01_02", "theme": "fantasy", "slot": "weapon", "name": "Hacha de las Siete Deudas", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_01_03", "theme": "fantasy", "slot": "weapon", "name": "Hacha del Gremio Roto", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_01_04", "theme": "fantasy", "slot": "weapon", "name": "Hacha del Dragón Dormido", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_02_00", "theme": "fantasy", "slot": "weapon", "name": "Maza del Gremio Roto", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_02_01", "theme": "fantasy", "slot": "weapon", "name": "Maza del Dragón Dormido", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_02_02", "theme": "fantasy", "slot": "weapon", "name": "Maza del Bardo Embustero", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_02_03", "theme": "fantasy", "slot": "weapon", "name": "Maza de la Reina Ladrona", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_02_04", "theme": "fantasy", "slot": "weapon", "name": "Maza del Puente Negro", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_03_00", "theme": "fantasy", "slot": "weapon", "name": "Lanza de la Reina Ladrona", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_03_01", "theme": "fantasy", "slot": "weapon", "name": "Lanza del Puente Negro", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_03_02", "theme": "fantasy", "slot": "weapon", "name": "Lanza de la Posada Roja", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_03_03", "theme": "fantasy", "slot": "weapon", "name": "Lanza del Cuervo Risueño", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_03_04", "theme": "fantasy", "slot": "weapon", "name": "Lanza del Último Brindis", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_04_00", "theme": "fantasy", "slot": "weapon", "name": "Daga del Cuervo Risueño", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_04_01", "theme": "fantasy", "slot": "weapon", "name": "Daga del Último Brindis", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_04_02", "theme": "fantasy", "slot": "weapon", "name": "Daga del Caballero Descalzo", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_04_03", "theme": "fantasy", "slot": "weapon", "name": "Daga de la Bruja del Camino", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_04_04", "theme": "fantasy", "slot": "weapon", "name": "Daga del Mercado Nocturno", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_05_00", "theme": "fantasy", "slot": "offhand", "name": "Escudo de la Bruja del Camino", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_05_01", "theme": "fantasy", "slot": "offhand", "name": "Escudo del Mercado Nocturno", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_05_02", "theme": "fantasy", "slot": "offhand", "name": "Escudo del Ogro Cortés", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_05_03", "theme": "fantasy", "slot": "offhand", "name": "Escudo del Enano Sin Mapa", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_05_04", "theme": "fantasy", "slot": "offhand", "name": "Escudo de la Espada Prestada", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_06_00", "theme": "fantasy", "slot": "offhand", "name": "Grimorio del Enano Sin Mapa", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_06_01", "theme": "fantasy", "slot": "offhand", "name": "Grimorio de la Espada Prestada", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_06_02", "theme": "fantasy", "slot": "offhand", "name": "Grimorio del Zorro Tuerto", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_06_03", "theme": "fantasy", "slot": "offhand", "name": "Grimorio de la Taberna Hundida", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_06_04", "theme": "fantasy", "slot": "offhand", "name": "Grimorio del Rey Mendigo", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_07_00", "theme": "fantasy", "slot": "head", "name": "Yelmo de la Taberna Hundida", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_07_01", "theme": "fantasy", "slot": "head", "name": "Yelmo del Rey Mendigo", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_07_02", "theme": "fantasy", "slot": "head", "name": "Yelmo de la Luna Vieja", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_07_03", "theme": "fantasy", "slot": "head", "name": "Yelmo del Bosque Burlón", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_07_04", "theme": "fantasy", "slot": "head", "name": "Yelmo de las Siete Deudas", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_08_00", "theme": "fantasy", "slot": "head", "name": "Capucha del Bosque Burlón", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_08_01", "theme": "fantasy", "slot": "head", "name": "Capucha de las Siete Deudas", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_08_02", "theme": "fantasy", "slot": "head", "name": "Capucha del Gremio Roto", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_08_03", "theme": "fantasy", "slot": "head", "name": "Capucha del Dragón Dormido", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_08_04", "theme": "fantasy", "slot": "head", "name": "Capucha del Bardo Embustero", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_09_00", "theme": "fantasy", "slot": "chest", "name": "Coraza del Dragón Dormido", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_09_01", "theme": "fantasy", "slot": "chest", "name": "Coraza del Bardo Embustero", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_09_02", "theme": "fantasy", "slot": "chest", "name": "Coraza de la Reina Ladrona", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_09_03", "theme": "fantasy", "slot": "chest", "name": "Coraza del Puente Negro", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_09_04", "theme": "fantasy", "slot": "chest", "name": "Coraza de la Posada Roja", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_10_00", "theme": "fantasy", "slot": "chest", "name": "Jubón del Puente Negro", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_10_01", "theme": "fantasy", "slot": "chest", "name": "Jubón de la Posada Roja", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_10_02", "theme": "fantasy", "slot": "chest", "name": "Jubón del Cuervo Risueño", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_10_03", "theme": "fantasy", "slot": "chest", "name": "Jubón del Último Brindis", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_10_04", "theme": "fantasy", "slot": "chest", "name": "Jubón del Caballero Descalzo", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_11_00", "theme": "fantasy", "slot": "hands", "name": "Guanteletes del Último Brindis", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_11_01", "theme": "fantasy", "slot": "hands", "name": "Guanteletes del Caballero Descalzo", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_11_02", "theme": "fantasy", "slot": "hands", "name": "Guanteletes de la Bruja del Camino", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_11_03", "theme": "fantasy", "slot": "hands", "name": "Guanteletes del Mercado Nocturno", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_11_04", "theme": "fantasy", "slot": "hands", "name": "Guanteletes del Ogro Cortés", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_12_00", "theme": "fantasy", "slot": "hands", "name": "Guantes del Mercado Nocturno", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_12_01", "theme": "fantasy", "slot": "hands", "name": "Guantes del Ogro Cortés", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_12_02", "theme": "fantasy", "slot": "hands", "name": "Guantes del Enano Sin Mapa", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_12_03", "theme": "fantasy", "slot": "hands", "name": "Guantes de la Espada Prestada", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_12_04", "theme": "fantasy", "slot": "hands", "name": "Guantes del Zorro Tuerto", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_13_00", "theme": "fantasy", "slot": "legs", "name": "Grebas de la Espada Prestada", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_13_01", "theme": "fantasy", "slot": "legs", "name": "Grebas del Zorro Tuerto", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_13_02", "theme": "fantasy", "slot": "legs", "name": "Grebas de la Taberna Hundida", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_13_03", "theme": "fantasy", "slot": "legs", "name": "Grebas del Rey Mendigo", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_13_04", "theme": "fantasy", "slot": "legs", "name": "Grebas de la Luna Vieja", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_14_00", "theme": "fantasy", "slot": "boots", "name": "Botas del Rey Mendigo", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_14_01", "theme": "fantasy", "slot": "boots", "name": "Botas de la Luna Vieja", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_14_02", "theme": "fantasy", "slot": "boots", "name": "Botas del Bosque Burlón", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_14_03", "theme": "fantasy", "slot": "boots", "name": "Botas de las Siete Deudas", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_14_04", "theme": "fantasy", "slot": "boots", "name": "Botas del Gremio Roto", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_15_00", "theme": "fantasy", "slot": "ring1", "name": "Anillo de las Siete Deudas", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_15_01", "theme": "fantasy", "slot": "ring1", "name": "Anillo del Gremio Roto", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_15_02", "theme": "fantasy", "slot": "ring1", "name": "Anillo del Dragón Dormido", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_15_03", "theme": "fantasy", "slot": "ring1", "name": "Anillo del Bardo Embustero", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_15_04", "theme": "fantasy", "slot": "ring1", "name": "Anillo de la Reina Ladrona", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_16_00", "theme": "fantasy", "slot": "ring2", "name": "Sello del Bardo Embustero", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_16_01", "theme": "fantasy", "slot": "ring2", "name": "Sello de la Reina Ladrona", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_16_02", "theme": "fantasy", "slot": "ring2", "name": "Sello del Puente Negro", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_16_03", "theme": "fantasy", "slot": "ring2", "name": "Sello de la Posada Roja", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_16_04", "theme": "fantasy", "slot": "ring2", "name": "Sello del Cuervo Risueño", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_17_00", "theme": "fantasy", "slot": "neck", "name": "Amuleto de la Posada Roja", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_17_01", "theme": "fantasy", "slot": "neck", "name": "Amuleto del Cuervo Risueño", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_17_02", "theme": "fantasy", "slot": "neck", "name": "Amuleto del Último Brindis", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_17_03", "theme": "fantasy", "slot": "neck", "name": "Amuleto del Caballero Descalzo", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_17_04", "theme": "fantasy", "slot": "neck", "name": "Amuleto de la Bruja del Camino", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_18_00", "theme": "fantasy", "slot": "trinket1", "name": "Talismán del Caballero Descalzo", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}, {"id": "fantasy_18_01", "theme": "fantasy", "slot": "trinket1", "name": "Talismán de la Bruja del Camino", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_18_02", "theme": "fantasy", "slot": "trinket1", "name": "Talismán del Mercado Nocturno", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_18_03", "theme": "fantasy", "slot": "trinket1", "name": "Talismán del Ogro Cortés", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_18_04", "theme": "fantasy", "slot": "trinket1", "name": "Talismán del Enano Sin Mapa", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_19_00", "theme": "fantasy", "slot": "trinket2", "name": "Moneda del Ogro Cortés", "flavor": "Perfecto para héroes, villanos y gente que aún no ha decidido."}, {"id": "fantasy_19_01", "theme": "fantasy", "slot": "trinket2", "name": "Moneda del Enano Sin Mapa", "flavor": "Parece valioso. Eso suele significar que alguien vendrá a reclamarlo."}, {"id": "fantasy_19_02", "theme": "fantasy", "slot": "trinket2", "name": "Moneda de la Espada Prestada", "flavor": "Huele a cuero, humo y decisiones cuestionables."}, {"id": "fantasy_19_03", "theme": "fantasy", "slot": "trinket2", "name": "Moneda del Zorro Tuerto", "flavor": "Tiene una muesca por cada dueño anterior. Son demasiadas."}, {"id": "fantasy_19_04", "theme": "fantasy", "slot": "trinket2", "name": "Moneda de la Taberna Hundida", "flavor": "Un mercader juraría que es auténtico. Un mercader mentiría."}], "cyberpunk": [{"id": "cyberpunk_00_00", "theme": "cyberpunk", "slot": "weapon", "name": "Katana Monoátomo Neón", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_00_01", "theme": "cyberpunk", "slot": "weapon", "name": "Katana Monoátomo de Cromo", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_00_02", "theme": "cyberpunk", "slot": "weapon", "name": "Katana Monoátomo de Medianoche", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_00_03", "theme": "cyberpunk", "slot": "weapon", "name": "Katana Monoátomo de la Zona Muerta", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_00_04", "theme": "cyberpunk", "slot": "weapon", "name": "Katana Monoátomo de Circuito Rojo", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_01_00", "theme": "cyberpunk", "slot": "weapon", "name": "Pistola de Riel de la Zona Muerta", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_01_01", "theme": "cyberpunk", "slot": "weapon", "name": "Pistola de Riel de Circuito Rojo", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_01_02", "theme": "cyberpunk", "slot": "weapon", "name": "Pistola de Riel de Pulso Azul", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_01_03", "theme": "cyberpunk", "slot": "weapon", "name": "Pistola de Riel del Subnivel", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_01_04", "theme": "cyberpunk", "slot": "weapon", "name": "Pistola de Riel de Callejón 9", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_02_00", "theme": "cyberpunk", "slot": "weapon", "name": "Rifle Smart del Subnivel", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_02_01", "theme": "cyberpunk", "slot": "weapon", "name": "Rifle Smart de Callejón 9", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_02_02", "theme": "cyberpunk", "slot": "weapon", "name": "Rifle Smart de Firewall Negro", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_02_03", "theme": "cyberpunk", "slot": "weapon", "name": "Rifle Smart de Memoria Fantasma", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_02_04", "theme": "cyberpunk", "slot": "weapon", "name": "Rifle Smart de Protocolo Roto", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_03_00", "theme": "cyberpunk", "slot": "weapon", "name": "Cuchilla Térmica de Memoria Fantasma", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_03_01", "theme": "cyberpunk", "slot": "weapon", "name": "Cuchilla Térmica de Protocolo Roto", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_03_02", "theme": "cyberpunk", "slot": "weapon", "name": "Cuchilla Térmica de la Megatorre", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_03_03", "theme": "cyberpunk", "slot": "weapon", "name": "Cuchilla Térmica de Datos Sangrientos", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_03_04", "theme": "cyberpunk", "slot": "weapon", "name": "Cuchilla Térmica de Núcleo Frío", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_04_00", "theme": "cyberpunk", "slot": "weapon", "name": "Martillo Servo de Datos Sangrientos", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_04_01", "theme": "cyberpunk", "slot": "weapon", "name": "Martillo Servo de Núcleo Frío", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_04_02", "theme": "cyberpunk", "slot": "weapon", "name": "Martillo Servo de la Red Profunda", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_04_03", "theme": "cyberpunk", "slot": "weapon", "name": "Martillo Servo de Contrabando", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_04_04", "theme": "cyberpunk", "slot": "weapon", "name": "Martillo Servo de Grafeno", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_05_00", "theme": "cyberpunk", "slot": "offhand", "name": "Escudo Cinético de Contrabando", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_05_01", "theme": "cyberpunk", "slot": "offhand", "name": "Escudo Cinético de Grafeno", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_05_02", "theme": "cyberpunk", "slot": "offhand", "name": "Escudo Cinético de Sobrecarga", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_05_03", "theme": "cyberpunk", "slot": "offhand", "name": "Escudo Cinético de la Banda Cero", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_05_04", "theme": "cyberpunk", "slot": "offhand", "name": "Escudo Cinético de Horizonte Sintético", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_06_00", "theme": "cyberpunk", "slot": "offhand", "name": "Dron de Apoyo de la Banda Cero", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_06_01", "theme": "cyberpunk", "slot": "offhand", "name": "Dron de Apoyo de Horizonte Sintético", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_06_02", "theme": "cyberpunk", "slot": "offhand", "name": "Dron de Apoyo Neón", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_06_03", "theme": "cyberpunk", "slot": "offhand", "name": "Dron de Apoyo de Cromo", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_06_04", "theme": "cyberpunk", "slot": "offhand", "name": "Dron de Apoyo de Medianoche", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_07_00", "theme": "cyberpunk", "slot": "head", "name": "Visor Táctico de Cromo", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_07_01", "theme": "cyberpunk", "slot": "head", "name": "Visor Táctico de Medianoche", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_07_02", "theme": "cyberpunk", "slot": "head", "name": "Visor Táctico de la Zona Muerta", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_07_03", "theme": "cyberpunk", "slot": "head", "name": "Visor Táctico de Circuito Rojo", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_07_04", "theme": "cyberpunk", "slot": "head", "name": "Visor Táctico de Pulso Azul", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_08_00", "theme": "cyberpunk", "slot": "head", "name": "Máscara Neural de Circuito Rojo", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_08_01", "theme": "cyberpunk", "slot": "head", "name": "Máscara Neural de Pulso Azul", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_08_02", "theme": "cyberpunk", "slot": "head", "name": "Máscara Neural del Subnivel", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_08_03", "theme": "cyberpunk", "slot": "head", "name": "Máscara Neural de Callejón 9", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_08_04", "theme": "cyberpunk", "slot": "head", "name": "Máscara Neural de Firewall Negro", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_09_00", "theme": "cyberpunk", "slot": "chest", "name": "Chaqueta Blindada de Callejón 9", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_09_01", "theme": "cyberpunk", "slot": "chest", "name": "Chaqueta Blindada de Firewall Negro", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_09_02", "theme": "cyberpunk", "slot": "chest", "name": "Chaqueta Blindada de Memoria Fantasma", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_09_03", "theme": "cyberpunk", "slot": "chest", "name": "Chaqueta Blindada de Protocolo Roto", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_09_04", "theme": "cyberpunk", "slot": "chest", "name": "Chaqueta Blindada de la Megatorre", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_10_00", "theme": "cyberpunk", "slot": "chest", "name": "Exotraje de Protocolo Roto", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_10_01", "theme": "cyberpunk", "slot": "chest", "name": "Exotraje de la Megatorre", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_10_02", "theme": "cyberpunk", "slot": "chest", "name": "Exotraje de Datos Sangrientos", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_10_03", "theme": "cyberpunk", "slot": "chest", "name": "Exotraje de Núcleo Frío", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_10_04", "theme": "cyberpunk", "slot": "chest", "name": "Exotraje de la Red Profunda", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_11_00", "theme": "cyberpunk", "slot": "hands", "name": "Guantes Hápticos de Núcleo Frío", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_11_01", "theme": "cyberpunk", "slot": "hands", "name": "Guantes Hápticos de la Red Profunda", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_11_02", "theme": "cyberpunk", "slot": "hands", "name": "Guantes Hápticos de Contrabando", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_11_03", "theme": "cyberpunk", "slot": "hands", "name": "Guantes Hápticos de Grafeno", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_11_04", "theme": "cyberpunk", "slot": "hands", "name": "Guantes Hápticos de Sobrecarga", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_12_00", "theme": "cyberpunk", "slot": "hands", "name": "Garras de Cromo de Grafeno", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_12_01", "theme": "cyberpunk", "slot": "hands", "name": "Garras de Cromo de Sobrecarga", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_12_02", "theme": "cyberpunk", "slot": "hands", "name": "Garras de Cromo de la Banda Cero", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_12_03", "theme": "cyberpunk", "slot": "hands", "name": "Garras de Cromo de Horizonte Sintético", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_12_04", "theme": "cyberpunk", "slot": "hands", "name": "Garras de Cromo Neón", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_13_00", "theme": "cyberpunk", "slot": "legs", "name": "Módulos Tendinosos de Horizonte Sintético", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_13_01", "theme": "cyberpunk", "slot": "legs", "name": "Módulos Tendinosos Neón", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_13_02", "theme": "cyberpunk", "slot": "legs", "name": "Módulos Tendinosos de Cromo", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_13_03", "theme": "cyberpunk", "slot": "legs", "name": "Módulos Tendinosos de Medianoche", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_13_04", "theme": "cyberpunk", "slot": "legs", "name": "Módulos Tendinosos de la Zona Muerta", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_14_00", "theme": "cyberpunk", "slot": "boots", "name": "Botas Magnéticas de Medianoche", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_14_01", "theme": "cyberpunk", "slot": "boots", "name": "Botas Magnéticas de la Zona Muerta", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_14_02", "theme": "cyberpunk", "slot": "boots", "name": "Botas Magnéticas de Circuito Rojo", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_14_03", "theme": "cyberpunk", "slot": "boots", "name": "Botas Magnéticas de Pulso Azul", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_14_04", "theme": "cyberpunk", "slot": "boots", "name": "Botas Magnéticas del Subnivel", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_15_00", "theme": "cyberpunk", "slot": "ring1", "name": "Anillo de Datos de Pulso Azul", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_15_01", "theme": "cyberpunk", "slot": "ring1", "name": "Anillo de Datos del Subnivel", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_15_02", "theme": "cyberpunk", "slot": "ring1", "name": "Anillo de Datos de Callejón 9", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_15_03", "theme": "cyberpunk", "slot": "ring1", "name": "Anillo de Datos de Firewall Negro", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_15_04", "theme": "cyberpunk", "slot": "ring1", "name": "Anillo de Datos de Memoria Fantasma", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_16_00", "theme": "cyberpunk", "slot": "ring2", "name": "Sello Biométrico de Firewall Negro", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_16_01", "theme": "cyberpunk", "slot": "ring2", "name": "Sello Biométrico de Memoria Fantasma", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_16_02", "theme": "cyberpunk", "slot": "ring2", "name": "Sello Biométrico de Protocolo Roto", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_16_03", "theme": "cyberpunk", "slot": "ring2", "name": "Sello Biométrico de la Megatorre", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_16_04", "theme": "cyberpunk", "slot": "ring2", "name": "Sello Biométrico de Datos Sangrientos", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_17_00", "theme": "cyberpunk", "slot": "neck", "name": "Nodo Neural de la Megatorre", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_17_01", "theme": "cyberpunk", "slot": "neck", "name": "Nodo Neural de Datos Sangrientos", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_17_02", "theme": "cyberpunk", "slot": "neck", "name": "Nodo Neural de Núcleo Frío", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_17_03", "theme": "cyberpunk", "slot": "neck", "name": "Nodo Neural de la Red Profunda", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_17_04", "theme": "cyberpunk", "slot": "neck", "name": "Nodo Neural de Contrabando", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_18_00", "theme": "cyberpunk", "slot": "trinket1", "name": "Chip Ilegal de la Red Profunda", "flavor": "Tiene tres modos: seguro, letal y corporativo."}, {"id": "cyberpunk_18_01", "theme": "cyberpunk", "slot": "trinket1", "name": "Chip Ilegal de Contrabando", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_18_02", "theme": "cyberpunk", "slot": "trinket1", "name": "Chip Ilegal de Grafeno", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_18_03", "theme": "cyberpunk", "slot": "trinket1", "name": "Chip Ilegal de Sobrecarga", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_18_04", "theme": "cyberpunk", "slot": "trinket1", "name": "Chip Ilegal de la Banda Cero", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_19_00", "theme": "cyberpunk", "slot": "trinket2", "name": "Llave Cuántica de Sobrecarga", "flavor": "La luz roja no es decorativa."}, {"id": "cyberpunk_19_01", "theme": "cyberpunk", "slot": "trinket2", "name": "Llave Cuántica de la Banda Cero", "flavor": "La garantía fue anulada antes de que saliera de fábrica."}, {"id": "cyberpunk_19_02", "theme": "cyberpunk", "slot": "trinket2", "name": "Llave Cuántica de Horizonte Sintético", "flavor": "Emite un zumbido caro y probablemente ilegal."}, {"id": "cyberpunk_19_03", "theme": "cyberpunk", "slot": "trinket2", "name": "Llave Cuántica Neón", "flavor": "El número de serie ha sido borrado con mucho entusiasmo."}, {"id": "cyberpunk_19_04", "theme": "cyberpunk", "slot": "trinket2", "name": "Llave Cuántica de Cromo", "flavor": "Tiene tres modos: seguro, letal y corporativo."}], "middleearth": [{"id": "middleearth_00_00", "theme": "middleearth", "slot": "weapon", "name": "Espada Élfica de los Reinos del Oeste", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_00_01", "theme": "middleearth", "slot": "weapon", "name": "Espada Élfica de la Montaña Solitaria", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_00_02", "theme": "middleearth", "slot": "weapon", "name": "Espada Élfica del Bosque Dorado", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_00_03", "theme": "middleearth", "slot": "weapon", "name": "Espada Élfica de las Tierras Pardas", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_00_04", "theme": "middleearth", "slot": "weapon", "name": "Espada Élfica de los Puertos Grises", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_01_00", "theme": "middleearth", "slot": "weapon", "name": "Hacha Enana de las Tierras Pardas", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_01_01", "theme": "middleearth", "slot": "weapon", "name": "Hacha Enana de los Puertos Grises", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_01_02", "theme": "middleearth", "slot": "weapon", "name": "Hacha Enana de la Marca de los Jinetes", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_01_03", "theme": "middleearth", "slot": "weapon", "name": "Hacha Enana del Valle Secreto", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_01_04", "theme": "middleearth", "slot": "weapon", "name": "Hacha Enana de las Minas Profundas", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_02_00", "theme": "middleearth", "slot": "weapon", "name": "Arco Largo del Valle Secreto", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_02_01", "theme": "middleearth", "slot": "weapon", "name": "Arco Largo de las Minas Profundas", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_02_02", "theme": "middleearth", "slot": "weapon", "name": "Arco Largo del Reino Bajo la Montaña", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_02_03", "theme": "middleearth", "slot": "weapon", "name": "Arco Largo de la Torre Blanca", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_02_04", "theme": "middleearth", "slot": "weapon", "name": "Arco Largo del Bosque Negro", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_03_00", "theme": "middleearth", "slot": "weapon", "name": "Lanza de Jinete de la Torre Blanca", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_03_01", "theme": "middleearth", "slot": "weapon", "name": "Lanza de Jinete del Bosque Negro", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_03_02", "theme": "middleearth", "slot": "weapon", "name": "Lanza de Jinete de los Senderos Muertos", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_03_03", "theme": "middleearth", "slot": "weapon", "name": "Lanza de Jinete de la Colina Verde", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_03_04", "theme": "middleearth", "slot": "weapon", "name": "Lanza de Jinete de la Estrella de la Tarde", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_04_00", "theme": "middleearth", "slot": "weapon", "name": "Daga de Montaraz de la Colina Verde", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_04_01", "theme": "middleearth", "slot": "weapon", "name": "Daga de Montaraz de la Estrella de la Tarde", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_04_02", "theme": "middleearth", "slot": "weapon", "name": "Daga de Montaraz del Norte Perdido", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_04_03", "theme": "middleearth", "slot": "weapon", "name": "Daga de Montaraz de los Guardianes del Árbol", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_04_04", "theme": "middleearth", "slot": "weapon", "name": "Daga de Montaraz del Río Grande", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_05_00", "theme": "middleearth", "slot": "offhand", "name": "Escudo del Árbol Blanco de los Guardianes del Árbol", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_05_01", "theme": "middleearth", "slot": "offhand", "name": "Escudo del Árbol Blanco del Río Grande", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_05_02", "theme": "middleearth", "slot": "offhand", "name": "Escudo del Árbol Blanco de la Sombra Antigua", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_05_03", "theme": "middleearth", "slot": "offhand", "name": "Escudo del Árbol Blanco de la Última Alianza", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_05_04", "theme": "middleearth", "slot": "offhand", "name": "Escudo del Árbol Blanco de las Águilas", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_06_00", "theme": "middleearth", "slot": "offhand", "name": "Libro de Runas de la Última Alianza", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_06_01", "theme": "middleearth", "slot": "offhand", "name": "Libro de Runas de las Águilas", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_06_02", "theme": "middleearth", "slot": "offhand", "name": "Libro de Runas de los Reinos del Oeste", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_06_03", "theme": "middleearth", "slot": "offhand", "name": "Libro de Runas de la Montaña Solitaria", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_06_04", "theme": "middleearth", "slot": "offhand", "name": "Libro de Runas del Bosque Dorado", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_07_00", "theme": "middleearth", "slot": "head", "name": "Yelmo Alado de la Montaña Solitaria", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_07_01", "theme": "middleearth", "slot": "head", "name": "Yelmo Alado del Bosque Dorado", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_07_02", "theme": "middleearth", "slot": "head", "name": "Yelmo Alado de las Tierras Pardas", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_07_03", "theme": "middleearth", "slot": "head", "name": "Yelmo Alado de los Puertos Grises", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_07_04", "theme": "middleearth", "slot": "head", "name": "Yelmo Alado de la Marca de los Jinetes", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_08_00", "theme": "middleearth", "slot": "head", "name": "Capucha de Montaraz de los Puertos Grises", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_08_01", "theme": "middleearth", "slot": "head", "name": "Capucha de Montaraz de la Marca de los Jinetes", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_08_02", "theme": "middleearth", "slot": "head", "name": "Capucha de Montaraz del Valle Secreto", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_08_03", "theme": "middleearth", "slot": "head", "name": "Capucha de Montaraz de las Minas Profundas", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_08_04", "theme": "middleearth", "slot": "head", "name": "Capucha de Montaraz del Reino Bajo la Montaña", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_09_00", "theme": "middleearth", "slot": "chest", "name": "Cota de Mithril de las Minas Profundas", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_09_01", "theme": "middleearth", "slot": "chest", "name": "Cota de Mithril del Reino Bajo la Montaña", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_09_02", "theme": "middleearth", "slot": "chest", "name": "Cota de Mithril de la Torre Blanca", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_09_03", "theme": "middleearth", "slot": "chest", "name": "Cota de Mithril del Bosque Negro", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_09_04", "theme": "middleearth", "slot": "chest", "name": "Cota de Mithril de los Senderos Muertos", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_10_00", "theme": "middleearth", "slot": "chest", "name": "Manto Élfico del Bosque Negro", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_10_01", "theme": "middleearth", "slot": "chest", "name": "Manto Élfico de los Senderos Muertos", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_10_02", "theme": "middleearth", "slot": "chest", "name": "Manto Élfico de la Colina Verde", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_10_03", "theme": "middleearth", "slot": "chest", "name": "Manto Élfico de la Estrella de la Tarde", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_10_04", "theme": "middleearth", "slot": "chest", "name": "Manto Élfico del Norte Perdido", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_11_00", "theme": "middleearth", "slot": "hands", "name": "Guanteletes de Númenor de la Estrella de la Tarde", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_11_01", "theme": "middleearth", "slot": "hands", "name": "Guanteletes de Númenor del Norte Perdido", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_11_02", "theme": "middleearth", "slot": "hands", "name": "Guanteletes de Númenor de los Guardianes del Árbol", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_11_03", "theme": "middleearth", "slot": "hands", "name": "Guanteletes de Númenor del Río Grande", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_11_04", "theme": "middleearth", "slot": "hands", "name": "Guanteletes de Númenor de la Sombra Antigua", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_12_00", "theme": "middleearth", "slot": "hands", "name": "Guantes del Bosque del Río Grande", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_12_01", "theme": "middleearth", "slot": "hands", "name": "Guantes del Bosque de la Sombra Antigua", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_12_02", "theme": "middleearth", "slot": "hands", "name": "Guantes del Bosque de la Última Alianza", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_12_03", "theme": "middleearth", "slot": "hands", "name": "Guantes del Bosque de las Águilas", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_12_04", "theme": "middleearth", "slot": "hands", "name": "Guantes del Bosque de los Reinos del Oeste", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_13_00", "theme": "middleearth", "slot": "legs", "name": "Grebas de Gondor de las Águilas", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_13_01", "theme": "middleearth", "slot": "legs", "name": "Grebas de Gondor de los Reinos del Oeste", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_13_02", "theme": "middleearth", "slot": "legs", "name": "Grebas de Gondor de la Montaña Solitaria", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_13_03", "theme": "middleearth", "slot": "legs", "name": "Grebas de Gondor del Bosque Dorado", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_13_04", "theme": "middleearth", "slot": "legs", "name": "Grebas de Gondor de las Tierras Pardas", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_14_00", "theme": "middleearth", "slot": "boots", "name": "Botas de Caminante del Bosque Dorado", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_14_01", "theme": "middleearth", "slot": "boots", "name": "Botas de Caminante de las Tierras Pardas", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_14_02", "theme": "middleearth", "slot": "boots", "name": "Botas de Caminante de los Puertos Grises", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_14_03", "theme": "middleearth", "slot": "boots", "name": "Botas de Caminante de la Marca de los Jinetes", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_14_04", "theme": "middleearth", "slot": "boots", "name": "Botas de Caminante del Valle Secreto", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_15_00", "theme": "middleearth", "slot": "ring1", "name": "Anillo Menor de la Marca de los Jinetes", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_15_01", "theme": "middleearth", "slot": "ring1", "name": "Anillo Menor del Valle Secreto", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_15_02", "theme": "middleearth", "slot": "ring1", "name": "Anillo Menor de las Minas Profundas", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_15_03", "theme": "middleearth", "slot": "ring1", "name": "Anillo Menor del Reino Bajo la Montaña", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_15_04", "theme": "middleearth", "slot": "ring1", "name": "Anillo Menor de la Torre Blanca", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_16_00", "theme": "middleearth", "slot": "ring2", "name": "Sello de la Casa Real del Reino Bajo la Montaña", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_16_01", "theme": "middleearth", "slot": "ring2", "name": "Sello de la Casa Real de la Torre Blanca", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_16_02", "theme": "middleearth", "slot": "ring2", "name": "Sello de la Casa Real del Bosque Negro", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_16_03", "theme": "middleearth", "slot": "ring2", "name": "Sello de la Casa Real de los Senderos Muertos", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_16_04", "theme": "middleearth", "slot": "ring2", "name": "Sello de la Casa Real de la Colina Verde", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_17_00", "theme": "middleearth", "slot": "neck", "name": "Broche de Hoja de los Senderos Muertos", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_17_01", "theme": "middleearth", "slot": "neck", "name": "Broche de Hoja de la Colina Verde", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_17_02", "theme": "middleearth", "slot": "neck", "name": "Broche de Hoja de la Estrella de la Tarde", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_17_03", "theme": "middleearth", "slot": "neck", "name": "Broche de Hoja del Norte Perdido", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_17_04", "theme": "middleearth", "slot": "neck", "name": "Broche de Hoja de los Guardianes del Árbol", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_18_00", "theme": "middleearth", "slot": "trinket1", "name": "Fragmento de Palantír del Norte Perdido", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}, {"id": "middleearth_18_01", "theme": "middleearth", "slot": "trinket1", "name": "Fragmento de Palantír de los Guardianes del Árbol", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_18_02", "theme": "middleearth", "slot": "trinket1", "name": "Fragmento de Palantír del Río Grande", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_18_03", "theme": "middleearth", "slot": "trinket1", "name": "Fragmento de Palantír de la Sombra Antigua", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_18_04", "theme": "middleearth", "slot": "trinket1", "name": "Fragmento de Palantír de la Última Alianza", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_19_00", "theme": "middleearth", "slot": "trinket2", "name": "Cuerno de Guerra de la Sombra Antigua", "flavor": "Conserva el eco de caminos largos bajo estrellas frías."}, {"id": "middleearth_19_01", "theme": "middleearth", "slot": "trinket2", "name": "Cuerno de Guerra de la Última Alianza", "flavor": "Forjado en una era antigua, cuando las canciones duraban más que las guerras."}, {"id": "middleearth_19_02", "theme": "middleearth", "slot": "trinket2", "name": "Cuerno de Guerra de las Águilas", "flavor": "Lleva runas que hablan de valor, viaje y una cena que nunca llegó."}, {"id": "middleearth_19_03", "theme": "middleearth", "slot": "trinket2", "name": "Cuerno de Guerra de los Reinos del Oeste", "flavor": "Los sabios lo reconocerían. Los orcos también."}, {"id": "middleearth_19_04", "theme": "middleearth", "slot": "trinket2", "name": "Cuerno de Guerra de la Montaña Solitaria", "flavor": "Parece hecho para un rey, pero cabe perfectamente en tu mochila."}]};

function themedCatalogForFloor(){
 if(game.floor===1)return themedItemCatalog.fantasy;
 if(game.floor===2)return Math.random()<.75?themedItemCatalog.middleearth:themedItemCatalog.fantasy;
 if(game.floor===3)return Math.random()<.55?themedItemCatalog.fantasy:themedItemCatalog.cyberpunk;
 return Math.random()<.65?themedItemCatalog.cyberpunk:themedItemCatalog.middleearth;
}
function pickThemedItem(slot){
 const pool=themedCatalogForFloor().filter(i=>i.slot===slot);
 return pool.length?pick(pool):null;
}

function encounterLootQuality(source='normal'){
 const d=difficultyScale(),event=game.activeEvent;
 let q=1+(game.floor-1)*.75+(game.player.level-1)*.22+(d.hp-1)*1.6;
 if(source==='elite')q+=1.2;
 if(source==='boss')q+=2.5;
 if(source==='eventBoss')q+=3.5;
 if(source==='specialReward')q+=3;
 if(event?.type==='horde')q+=.5;
 if(event?.type==='boss')q+=1.25;
 return Math.max(1,q)
}


const classStarterWeaponCategories={
 yunque:'Armas pesadas steampunk',
 berserker:'Armas ciberpunk pesadas',
 necromancer:'Artefactos de energía',
 paladin:'Armas de latón refinadas',
 jester:'Armas tóxicas y biotecnológicas',
 sniper:'Armas de fuego ciberpunk',
 shaman:'Espadas eléctricas iniciales',
 thief:'Armas blancas steampunk básicas',
 cleric:'Reliquias mecánicas',
 entropyMage:'Armas criogénicas',
 bountyHunter:'Armas de fuego eléctricas',
 druid:'Armas térmicas',
 monk:'Armas blancas steampunk básicas',
 engineer:'Armas a distancia mecánicas',
 seer:'Artefactos de energía',
 beastGuardian:'Armas eléctricas pesadas'
};
function makeStarterWeapon(classId){
 // config_items first: lowest-ilvl COMMON/tier-1 weapon of the class's own
 // weapon category - the starter weapon must always be tier 1 of the
 // class's weapon type, never a higher-tier item even if that's all that's
 // configured for the category (falls through to the guaranteed tier-1
 // manually-built weapon below instead).
 const weapons=configItems.filter(r=>((r.item_json||r).slot||r.slot)==='weapon');
 // an advanced/custom class can pin an explicit starter weapon TYPE in its
 // editor (class_json.starterWeaponType) - translate that to the same
 // "category" bucket the generic classStarterWeaponCategories table uses,
 // so both paths share the rest of this lookup unchanged.
 const starterType=configClassRowForId(classId)?.class_json?.starterWeaponType;
 const explicitCat=starterType?configWeaponTypeCategories[starterType]:'';
 if(weapons.length){
  const cat=explicitCat||classStarterWeaponCategories[classId]||'';
  let cands=weapons.filter(r=>{const it=r.item_json||r;return (it.weaponCategory||'')===cat&&(it.rarity||r.tier||'common')==='common'});
  if(cands.length){
   cands=[...cands].sort((a,b)=>(Number((a.item_json||a).itemLevel||a.ilvl)||1)-(Number((b.item_json||b).itemLevel||b.ilvl)||1));
   const item=configuredItemFromRow(cands[0],{itemLevel:{min:1,max:2}},1);
   if(item){item.name=`${item.name} de aprendiz`;return item}
  }
 }
 const category=explicitCat||classStarterWeaponCategories[classId]||'Espadas básicas y elementales';
 const row=weaponRowForCategory(category),col=0,canonicalCategory=weaponRows[row].category;
 const stat=weaponCategoryStats[canonicalCategory]||'strength';
 const statLabel=DEFENSE_STAT_LABELS[stat]||'Fuerza';
 return{
  id:crypto.randomUUID(),slot:'weapon',iconShape:'blade',rarity:'common',label:'Común',itemLevel:1,score:8,
  name:`${weaponNameForCategory(canonicalCategory,col)} de aprendiz`,
  theme:'starter',weaponCategory:canonicalCategory,weaponIconRow:row,weaponIconCol:col,weaponIconPath:weaponIconPath(row,col),
  flavor:`Arma inicial de clase: ${canonicalCategory}. Icono básico individual por tipo de arma.`,
  defenseStat:stat,
  affixes:[{key:stat,label:statLabel,value:1,percent:false}],passives:[],effects:[],
  desc:'Nivel 1 · Poder 8'
 };
}

function normalizeConfiguredPotion(item,row={}){if((item.type||row.type)!=='potion')return item;item.type='potion';item.slot='consumable';item.iconShape=item.iconShape||'vial';item.kind=item.kind||(['permanentStats','learnSkill'].includes(item.potionEffectType)?'permanent':['heal','stamina','mana','teleportSafe','teleportStairs'].includes(item.potionEffectType)?'instant':'temporary');item.duration=Number(item.duration)||Number(item.turns)||0;item.effect=item.effect||item.potionEffect||{};item.desc=item.desc||describePotionEffect(item);return item}
function configWeaponKind(item){
 const text=`${item.weaponType||''} ${item.weaponCategory||''} ${item.name||item.nombre||''}`.toLowerCase();
 if(/varita/.test(text))return 'magic';
 if(/arco|ballesta|pistola|rifle|fusil|carabina|escopeta/.test(text)||(Number(item.rangeMax)||1)>1)return 'ranged';
 return 'melee';
}
function makeConfiguredLoot(level){if(!configItems.length)return null;const lootRow=currentLootProgressionRow(game?.floor||1,game?.player?.level||level||1),eligible=configItems.filter(row=>lootRarityAllowed((row.item_json||row).rarity||row.tier||'common',lootRow));if(!eligible.length)return null;
 // prefer items whose base ilvl fits the floor's loot band
 const inBand=eligible.filter(r=>{const il=Number((r.item_json||r).itemLevel||r.ilvl)||1;return il>=lootRow.itemLevel.min-3&&il<=lootRow.itemLevel.max+3});
 const row=pick(inBand.length?inBand:eligible);
 return configuredItemFromRow(row,lootRow,level)}
function configuredItemFromRow(row,lootRow,level){const raw=row.item_json||row,item={...raw};item.id=crypto.randomUUID();item.name=item.name||row.nombre||'Objeto configurado';item.slot=item.slot||row.slot||'trinket1';item.rarity=item.rarity||row.tier||'common';item.label=item.label||tierDefs[item.rarity]?.label||item.rarity;item.itemLevel=Math.max(lootRow.itemLevel.min,Math.min(lootRow.itemLevel.max,Number(item.itemLevel||row.ilvl||level||1)));item.score=Number(item.score||item.itemLevel*8);item.icon=item.icon||row.icon||'';item.damageDice=item.slot==='weapon'?(item.damageDice||row.damageDice||'1d6'):null;if(item.slot==='weapon'){item.weaponType=item.weaponType||row.weaponType||row.weaponCategory||'Sin tipo de arma';item.weaponCategory=item.weaponCategory||configWeaponTypeCategories[item.weaponType]||row.weaponCategory||weaponCategories[0];item.weaponIconRow=Number.isInteger(item.weaponIconRow)?item.weaponIconRow:weaponRowForCategory(item.weaponCategory);item.weaponIconCol=Number.isInteger(item.weaponIconCol)?item.weaponIconCol:weaponPowerColumn(item.itemLevel,item.rarity,item.score);item.weaponIconPath=item.weaponIconPath||weaponIconPath(item.weaponIconRow,item.weaponIconCol);item.defenseStat=item.defenseStat||WEAPON_TYPE_STAT[item.weaponType]||weaponCategoryStats[item.weaponCategory]||'strength';const bounds=weaponRangeBounds(item);item.rangeMin=bounds.min;item.rangeMax=bounds.max}normalizeConfiguredPotion(item,row);item.skillIds=Array.isArray(item.skillIds)?item.skillIds:[];item.affixes=Array.isArray(item.affixes)?item.affixes:parseConfigStats(row.stats||item.stats);item.passives=item.passives||[];item.effects=item.effects||[];item.desc=item.desc||`Configurado · Nivel ${item.itemLevel} · Poder ${item.score}`;item.flavor=item.flavor||'Objeto creado en modo configuración.';return applyOffhandGuarantee(item)}
function parseConfigStats(text){return String(text||'').split(/[\n,;]/).map(x=>x.trim()).filter(Boolean).map(part=>{const m=part.match(/^([^:+-]+)\s*:?\s*([+-]?\d+)/);return m?{key:m[1].trim(),label:m[1].trim(),value:Number(m[2]),percent:false}:null}).filter(Boolean)}
function tierColor(tier){return tierDefs[tier]?.color||'#ddd'}
const configImageCache={};function configIconImage(src){if(!configImageCache[src]){const img=new Image();img.src=src;configImageCache[src]=img}return configImageCache[src]}
function hexToBase64(hex){const bytes=hex.match(/.{1,2}/g)||[];let bin='';bytes.forEach(b=>bin+=String.fromCharCode(parseInt(b,16)));return btoa(bin)}
// Itemization uses config_items exclusively; the random generator below only
// remains as a fallback for when the table is empty or has no eligible rows.
function makeLoot(level,source='normal',forceRarityName=null){const lootRow=currentLootProgressionRow(game?.floor||1,game?.player?.level||level||1);if(!forceRarityName&&Math.random()<Math.min(.22,.07+game.floor*.025+(source==='boss'? .08:0)))return makePotion(encounterLootQuality(source));
 if(forceRarityName){
  if(configItems.length){
   const matches=configItems.filter(row=>((row.item_json||row).rarity||row.tier||'common')===forceRarityName);
   if(matches.length)return configuredItemFromRow(pick(matches),lootRow,level);
  }
 } else {
  const configured=makeConfiguredLoot(level);if(configured)return configured;
 }
 const slot=pick(slots),rar=forceRarityName?(rarities.find(r=>r.name===forceRarityName)||weightedRarity(level)):weightedRarity(level);
 const itemLevel=Math.max(lootRow.itemLevel.min,Math.min(lootRow.itemLevel.max,level+rng(3)-1));
 const affixes=buildItemAffixes(slot,itemLevel,rar),passives=buildPassives(itemLevel,rar),effects=buildEffects(rar);
 const score=itemBudget(itemLevel,rar)+affixes.reduce((s,a)=>s+a.value,0)+passives.length*12+effects.length*25;
 const iconShape=pick(itemIconShapes[slot]),themed=pickThemedItem(slot);
 const weaponCategory=slot==='weapon'?weaponCategoryForLoot(rar):null;
 const weaponIconRow=weaponCategory?weaponRowForCategory(weaponCategory):null;
 const weaponIconCol=weaponCategory?weaponPowerColumn(itemLevel,rar,score):null;
 const weaponIconPathValue=weaponCategory?weaponIconPath(weaponIconRow,weaponIconCol):null;
 const armorIconRow=slot==='chest'?armorRowForLoot(rar):null;
 const armorIconCol=slot==='chest'?armorPowerColumn(itemLevel,rar,score):null;
 const armorIconPathValue=slot==='chest'?armorIconPath(armorIconRow,armorIconCol):null;
 // Offhand loot rolls one of 3 kinds - mostly shields, sometimes a wand or a
 // dagger held in the left hand alongside the main-hand weapon.
 const offhandKind=slot==='offhand'?pick(['shield','shield','shield','wand','dagger']):null;
 const offhandNameCategory=offhandKind==='wand'?configWeaponTypeCategories.Varitas:offhandKind==='dagger'?configWeaponTypeCategories.Dagas:null;
 const offhandName=offhandNameCategory?weaponNameForCategory(offhandNameCategory,weaponPowerColumn(itemLevel,rar,score)):null;
 return applyOffhandGuarantee({
  id:crypto.randomUUID(),slot,iconShape,rarity:rar.name,label:rar.label,itemLevel,score,
  name:slot==='weapon'?weaponNameForCategory(weaponCategory,weaponIconCol):slot==='chest'?armorName(armorIconRow,armorIconCol):(offhandName||themed?.name||`${pick(itemBases[slot])} ${pick(prefixes)}`),
  theme:themed?.theme||'fantasy',offhandKind,
  weaponCategory,weaponIconRow,weaponIconCol,weaponIconPath:weaponIconPathValue,
  armorCategory:slot==='chest'?armorRows[armorIconRow]?.category:null,armorIconRow,armorIconCol,armorIconPath:armorIconPathValue,
  flavor:slot==='weapon'?`${weaponCategory}. Imagen individual: ${weaponIconPathValue}. La progresión por fila respeta rareza y nivel.`:slot==='chest'?`${armorRows[armorIconRow]?.category}. Imagen individual: ${armorIconPathValue}. La progresión por fila va de menos a más poder.`:(themed?.flavor||'Un objeto con más historia de la que conviene preguntar.'),
  defenseStat:slot==='weapon'?(weaponCategoryStats[weaponCategory]||'strength'):inferWeaponDefenseStat({name:themed?.name||'',iconShape,theme:themed?.theme||'fantasy'}),
  rangeMin:slot==='weapon'?weaponRangeBounds({weaponCategory,name:weaponNameForCategory(weaponCategory,weaponIconCol)}).min:null,
  rangeMax:slot==='weapon'?weaponRangeBounds({weaponCategory,name:weaponNameForCategory(weaponCategory,weaponIconCol)}).max:null,
  affixes,passives,effects,
  desc:`Nivel ${itemLevel} · Poder ${score}`
 });
}
function log(msg,cls=''){const d=document.createElement('div');d.className=cls;d.textContent=msg;document.getElementById('log').prepend(d);if(game?.multiplayer&&game.mpCapture&&cls&&cls!=='sys')game.mpPendingEvents=(game.mpPendingEvents||[]).concat({m:msg,c:cls}).slice(-8)}
function banner(text){const d=document.createElement('div');d.className='banner';d.textContent=text;document.body.appendChild(d);setTimeout(()=>d.remove(),2100)}
function camera(){return{x:Math.max(0,Math.min(COLS-visibleTiles,game.player.x-Math.floor(visibleTiles/2))),y:Math.max(0,Math.min(ROWS-visibleTiles,game.player.y-Math.floor(visibleTiles/2)))}}
function floating(text,x,y,color='#fff'){const r=canvas.getBoundingClientRect(),c=camera(),d=document.createElement('div');d.className='floatText';d.textContent=text;d.style.color=color;d.style.left=`${r.left+(x-c.x+.45)*r.width/visibleTiles}px`;d.style.top=`${r.top+(y-c.y+.25)*r.height/visibleTiles}px`;document.body.appendChild(d);setTimeout(()=>d.remove(),850)}
// Brief tracer line for any hit landed from more than 1 tile away (ranged
// weapons, ranged skills, enemy ranged attacks) - a plain DOM overlay like
// floating(), not a canvas draw, so it doesn't need to hook into the
// animate()/draw() loop to fade out on its own.
function rangedTracer(x1,y1,x2,y2,color='#9be8ff'){
 const r=canvas.getBoundingClientRect(),c=camera(),scale=r.width/visibleTiles;
 const sx1=r.left+(x1-c.x+.5)*scale,sy1=r.top+(y1-c.y+.5)*scale;
 const sx2=r.left+(x2-c.x+.5)*scale,sy2=r.top+(y2-c.y+.5)*scale;
 const dx=sx2-sx1,dy=sy2-sy1,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
 const d=document.createElement('div');
 d.className='rangedTracer';
 d.style.left=`${sx1}px`;d.style.top=`${sy1}px`;d.style.width=`${len}px`;
 d.style.setProperty('--tracer-color',color);
 d.style.transform=`rotate(${angle}deg)`;
 document.body.appendChild(d);
 setTimeout(()=>d.remove(),260);
}

function setVisibleTiles(value){
 visibleTiles=Math.max(MIN_VISIBLE_TILES,Math.min(MAX_VISIBLE_TILES,Number(value)||8));
 localStorage.setItem('visibleTiles',String(visibleTiles));
 applyCanvasSize();
 const input=document.getElementById('zoomVisibleTiles'),label=document.getElementById('zoomVisibleTilesLabel');
 if(input)input.value=String(visibleTiles);
 if(label)label.textContent=`${visibleTiles}x${visibleTiles}`;
 if(game)draw();
}

function healEntity(entity,amount,x=entity.x??game.player.x,y=entity.y??game.player.y){
 const max=Number(entity.maxHp)||0,before=Number(entity.hp)||0;
 if(max<=0||amount<=0)return 0;
 entity.hp=Math.min(max,before+Math.max(0,Math.round(amount)));
 const healed=Math.max(0,Math.round(entity.hp-before));
 if(healed>0)floating(`+${healed}`,x,y,'#70dc9b');
 return healed
}

function effect(cls){canvas.classList.remove(cls);void canvas.offsetWidth;canvas.classList.add(cls)}
// A NaN/undefined/zero vision radius (e.g. a custom Advanced-mode class
// whose stats object was missing agility, or any other corrupt player.vision
// value) must never silently turn this into a no-op: NaN bounds make every
// loop comparison false, so nothing gets revealed and the whole floor stays
// pitch black regardless of how far the player walks. Falls back to the
// base radius (4, matching the default character's own formula) instead.
function reveal(cx,cy,r=game.player.vision){
 if(!Number.isFinite(r)||r<=0)r=4;
 for(let y=Math.max(0,cy-r);y<=Math.min(ROWS-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(COLS-1,cx+r);x++)if(Math.hypot(x-cx,y-cy)<=r+.4)game.seen[y][x]=true
}


let pendingClassSkillRequests=[];
function classTierForLevel(level){return classSkillMilestones[level]||0}
const CLASS_SKILL_LEVELS=[1];
function ensureSkillChoiceState(){
 const p=game.player;
 p.skillChoicesAwarded=p.skillChoicesAwarded||{};
 pendingClassSkillRequests=pendingClassSkillRequests||[];
}
function classSkillIdsForTier(tier){
 const roman=['','I','II','III'][tier];
 return (classSkillTrees[game.player.cls]?.[roman]||[]).filter(id=>skillDefs[id]);
}
function classSkillIdsForLevelReward(level){
 const maxTier=level>=10?3:2,tree=classSkillTrees[game.player.cls]||{};
 return Object.entries(tree).flatMap(([roman,ids])=>{
  const tier={I:1,II:2,III:3}[roman]||0;
  return tier&&tier<=maxTier?ids:[];
 }).filter(id=>skillDefs[id]&&!game.player.knownSkills.includes(id));
}
function randomClassSkillForLevelReward(level){return pick(classSkillIdsForLevelReward(level))}
function knownClassSkillIds(){
 if(!game?.player)return [];
 const all=new Set(Object.values(classSkillTrees[game.player.cls]||{}).flat());
 return (game.player.knownSkills||[]).filter(id=>all.has(id));
}
function expectedClassSkillLevels(level=game.player.level){return CLASS_SKILL_LEVELS.filter(l=>l<=level&&classTierForLevel(l))}
function expectedClassSkillCount(level=game.player.level){
 const byTier={};
 let total=0;
 for(const l of expectedClassSkillLevels(level)){
  const tier=classTierForLevel(l);
  byTier[tier]=(byTier[tier]||0)+1;
 }
 for(const [tier,count] of Object.entries(byTier))total+=Math.min(count,classSkillIdsForTier(Number(tier)).length);
 return total;
}
function firstMissingClassSkillRequest(){
 if(!game?.player)return null;
 const known=new Set(knownClassSkillIds());
 const takenByTier={};
 for(const id of known){
  const d=skillDefs[id];
  if(d?.tier)takenByTier[d.tier]=(takenByTier[d.tier]||0)+1;
 }
 for(const level of expectedClassSkillLevels()){
  const tier=classTierForLevel(level),available=classSkillIdsForTier(tier);
  const neededUntilThisLevel=expectedClassSkillLevels(level).filter(l=>classTierForLevel(l)===tier).length;
  if(Math.min(neededUntilThisLevel,available.length)>(takenByTier[tier]||0))return{level,tier,initial:level===1&&!known.size};
 }
 return null;
}
function queueClassSkillChoice(level,initial=false){
 if(!game?.player)return;
 ensureSkillChoiceState();
 const tier=classTierForLevel(level);
 if(!tier)return;
 const alreadyQueued=pendingClassSkillRequests.some(q=>q.level===level&&q.tier===tier);
 if(!alreadyQueued)pendingClassSkillRequests.push({level,tier,initial});
 processClassSkillChoices();
}
function queueMissingClassSkillChoices(){
 if(!game?.player)return;
 ensureSkillChoiceState();
 const expected=expectedClassSkillCount(),known=knownClassSkillIds().length;
 if(known>=expected)return;
 const missing=firstMissingClassSkillRequest();
 if(missing)queueClassSkillChoice(missing.level,missing.initial);
}
function classSkillChoicesForTier(tier){return classSkillIdsForTier(tier).filter(id=>!game.player.knownSkills.includes(id))}
function levelRewardLabel(level,skillId){
 const s=skillDefs[skillId];
 if(!s)return '';
 const tier=['','I','II','III'][s.tier]||s.tier||'?';
 return `<div class="levelRewardSkill"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${tier}</span><p>${s.desc}</p><span class="small">Skill aleatoria de ${game.player.className} desbloqueada al nivel ${level}.</span></div>`
}
function processClassSkillChoices(){
 if(!game?.player)return;
 if(game.player.unspentStatPoints>0||document.getElementById('statPointModal')?.classList.contains('open'))return;
 const modal=document.getElementById('skillChoiceModal');
 if(!modal||modal.classList.contains('open'))return;
 if(!pendingClassSkillRequests.length){
  const missing=firstMissingClassSkillRequest();
  if(missing)pendingClassSkillRequests.push(missing);
 }
 if(!pendingClassSkillRequests.length)return;
 const request=pendingClassSkillRequests.shift(),roman=['','I','II','III'][request.tier],choices=classSkillChoicesForTier(request.tier);
 if(!choices.length){game.player.skillChoicesAwarded[request.level]='complete';processClassSkillChoices();return}
 document.getElementById('skillChoiceTitle').textContent=request.initial?'ELIGE TU PRIMERA HABILIDAD':`NUEVA HABILIDAD · NIVEL ${request.level} · TIER ${roman}`;
 document.getElementById('skillChoiceText').textContent=`${game.player.className} · nivel ${request.level}. Elige una habilidad del pool real de tu clase para tier ${roman}.`;
 document.getElementById('skillChoiceGrid').innerHTML=choices.map(id=>{const s=skillDefs[id];return `<button type="button" class="skillChoiceCard" data-pick-skill="${id}"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${roman}</span><p>${s.desc}</p><span class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</span></button>`}).join('');
 modal.classList.add('open');
 modal.querySelectorAll('[data-pick-skill]').forEach(b=>b.addEventListener('click',()=>{
  learnSkill(b.dataset.pickSkill);
  game.player.skillChoicesAwarded[request.level]='chosen';
  modal.classList.remove('open');updateUI();
  if(request.initial)finishCharacterCreation();
  queueMissingClassSkillChoices();
  processClassSkillChoices();
 }))
}
function classSkillConsistencyGuard(){if(game?.turn%2===0)queueMissingClassSkillChoices()}

function start(){
 if(!selectedCombatMode){alert('Elige un modo de combate (Clásico o Puntos de Acción) antes de crear el personaje.');return}
 const race=selectedRace,cls=resolveClassDef(selectedClass),stats={...cls.stats},maxHp=30+stats.vitality*3+vitalityHpBonus(stats.vitality);
 const maxStamina=45+stats.strength*4+stats.agility*2,maxMana=30+stats.wisdom*5+stats.intelligence*3;
 const equipment=Object.fromEntries(slots.map(s=>[s,null]));equipment.weapon=makeStarterWeapon(selectedClass);
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,worldParams:normalizeWorldParams(selectedDungeonWorld?.world_json?.params),inventory:[],achievements:{},bossesKilled:0,chestsOpened:0,player:{name:nameInput.value||'Sin nombre',race,cls:selectedClass,className:cls.name,classIcon:classIconForId(selectedClass),skillMode:selectedSkillMode,combatMode:selectedCombatMode,level:1,xp:0,nextXp:xpNeededForLevel(1),hp:maxHp,maxHp,stamina:maxStamina,maxStamina,mana:maxMana,maxMana,baseDamage:2+stats.strength,baseArmor:4+Math.floor(stats.vitality/2),gold:0,keys:0,vision:4+Math.floor((stats.agility||0)/4),shield:0,stats,equipment,knownSkills:[],skillProgress:{},skillChoicesAwarded:{},equippedSkills:[null,null,null,null],cooldowns:{},debuff:0,shards:{}}};
 const rb=raceDefs[race]?.bonuses||{};
 game.player.raceName=raceDefs[race]?.name||race;
 game.player.raceBonuses={...rb};
 if(rb.armor)game.player.baseArmor+=rb.armor;
 addStarterPotions(selectedClass);
 recomputeDerived();startOverlay.classList.add('hidden');queueClassSkillChoice(1,true);
}
storyContinue.onclick=()=>{storyOverlay.classList.add('hidden');if(!game.map)generateFloor();updateUI()};

// ============================================================================
// FLOOR ARCHETYPES + ROOM TYPOLOGIES
// A floor picks an archetype by weighted probability (gated by depth, expected
// enemy tier and how recently each special archetype appeared). The archetype
// then drives the layout, the room-typology weights, enemy budget, rewards,
// special conditions and how the floor is completed. Room typologies do the
// local work: size, shape, exits, encounter composition, cover, traps and loot.
// ============================================================================

// Expected enemy tier at a given depth (drives boss strength and elite mix).
function expectedTierForFloor(floor,total=20){
 const r=total<=1?1:(floor-1)/(total-1);
 return r<.25?1:r<.55?2:r<.8?3:4;
}

const ROOM_TYPES={
 filler:      {label:'Sala vacía',      size:[4,7],  enemies:[0,1], tier:0,  cover:.15, traps:0,   chest:.10, exits:2, event:.02},
 combat:      {label:'Sala de combate', size:[6,10], enemies:[2,4], tier:0,  cover:.30, traps:.10, chest:.20, exits:2, event:.05},
 ambush:      {label:'Emboscada',       size:[5,9],  enemies:[3,6], tier:0,  cover:.20, traps:.25, chest:.15, exits:2, event:.08, place:'edges'},
 guardpost:   {label:'Puesto de guardia',size:[5,8], enemies:[2,3], tier:1,  cover:.35, traps:.10, chest:.45, exits:2, event:.04, place:'chokepoint'},
 eliteden:    {label:'Guarida de élite',size:[7,11], enemies:[1,3], tier:1,  cover:.30, traps:.05, chest:.65, exits:2, event:.06, elite:true},
 vault:       {label:'Cámara acorazada',size:[4,7],  enemies:[0,2], tier:0,  cover:.10, traps:.45, chest:1,   exits:1, event:.05, chests:[2,4], locked:true},
 arena:       {label:'Arena',           size:[10,15],enemies:[4,8], tier:0,  cover:.20, traps:.05, chest:.25, exits:2, event:.05, wave:true},
 hub:         {label:'Encrucijada',     size:[5,8],  enemies:[0,2], tier:0,  cover:.25, traps:.10, chest:.15, exits:4, event:.04},
 traproom:    {label:'Sala trampa',     size:[5,9],  enemies:[0,2], tier:0,  cover:.20, traps:.90, chest:.55, exits:2, event:.10, trapCount:[3,6]},
 shrine:      {label:'Altar',           size:[4,6],  enemies:[0,0], tier:0,  cover:.10, traps:0,   chest:.10, exits:2, event:.05, altar:true},
 creator:     {label:'Sala del Creador',size:[4,6],  enemies:[0,0], tier:0,  cover:.10, traps:0,   chest:.10, exits:2, event:.05, altar:true, creatorRoom:true},
 deadend:     {label:'Callejón',        size:[3,5],  enemies:[0,1], tier:0,  cover:.10, traps:.20, chest:.30, exits:1, event:.03},
 knot:        {label:'Nudo de pasillos',size:[3,5],  enemies:[0,2], tier:0,  cover:.15, traps:.15, chest:.05, exits:3, event:.02},
 bossarena:   {label:'Arena del jefe',  size:[11,15],enemies:[0,2], tier:1,  cover:.25, traps:0,   chest:.35, exits:1, event:0,  boss:true},
 prep:        {label:'Sala de preparación',size:[6,9],enemies:[0,1],tier:0,  cover:.15, traps:0,   chest:.55, exits:2, event:.03, altar:true}
};

// weight(floor,total,tier) -> relative probability. 0 disables the archetype.
const FLOOR_ARCHETYPES={
 standard:{
  label:'Piso estándar', minFloor:1, cooldown:0, objective:'stairs',
  desc:'Mezcla equilibrada de salas. Referencia de dificultad.',
  weight:()=>100,
  layout:{rooms:[26,40], size:[4,11], corridors:'normal', loops:.15, pillars:1},
  enemies:{density:1, elite:1, tierBias:0, bossOnEven:true},
  rewards:{chests:1, rarity:0},
  roomWeights:{filler:26,combat:30,ambush:10,guardpost:8,eliteden:5,vault:4,hub:6,traproom:4,shrine:3,creator:2,deadend:4,knot:4}
 },
 superboss:{
  label:'Piso de superjefe', minFloor:8, cooldown:7, objective:'bossKill', announce:true,
  desc:'Algo muy superior habita este piso. Prepárate antes de entrar en su sala.',
  weight:(f,t)=>f<8?0:6+Math.min(8,f/3),
  layout:{rooms:[18,26], size:[5,12], corridors:'normal', loops:.1, pillars:1.2},
  enemies:{density:.5, elite:.8, tierBias:0, bossOnEven:false, superBoss:true},
  rewards:{chests:1.3, rarity:2},
  roomWeights:{prep:16,shrine:10,creator:2,filler:20,combat:16,guardpost:10,eliteden:8,vault:6,hub:6,deadend:4}
 },
 laberinto:{
  label:'Piso laberinto', minFloor:3, cooldown:3, objective:'stairs',
  desc:'Pasillos, bifurcaciones y caminos falsos. La salida no está a la vista.',
  weight:(f)=>f<3?0:26,
  layout:{rooms:[40,56], size:[3,6], corridors:'maze', loops:.55, pillars:.6, deadEnds:.35},
  enemies:{density:.55, elite:.8, tierBias:0, bossOnEven:false},
  rewards:{chests:1.15, rarity:1},
  roomWeights:{knot:24,deadend:20,filler:18,hub:12,traproom:10,combat:8,vault:5,shrine:3,creator:2}
 },
 horda:{
  label:'Piso horda', minFloor:4, cooldown:3, objective:'waves',
  desc:'Oleadas continuas en salas amplias. Sobrevive a todas para abrir la salida.',
  weight:(f)=>f<4?0:22,
  layout:{rooms:[14,22], size:[8,15], corridors:'arena', loops:.3, pillars:1.4},
  enemies:{density:1.35, elite:.7, tierBias:-1, bossOnEven:false, waves:true},
  rewards:{chests:1.2, rarity:1},
  roomWeights:{arena:34,combat:24,filler:14,hub:10,ambush:8,eliteden:5,vault:5}
 },
 elites:{
  label:'Piso de élites', minFloor:5, cooldown:4, objective:'stairs',
  desc:'Pocos enemigos, casi todos de gran poder. Combates tácticos.',
  weight:(f)=>f<5?0:16,
  layout:{rooms:[16,24], size:[6,12], corridors:'normal', loops:.2, pillars:1.3},
  enemies:{density:.32, elite:6, tierBias:1, bossOnEven:false, miniboss:true},
  rewards:{chests:1.35, rarity:2},
  roomWeights:{eliteden:30,combat:20,guardpost:14,filler:12,vault:8,hub:6,shrine:5,creator:2,arena:5}
 },
 bossrush:{
  label:'Piso de asalto de jefes', minFloor:12, cooldown:9, objective:'bossKill', announce:true,
  desc:'Arenas encadenadas. Cada una guarda un jefe; el último es el más fuerte.',
  weight:(f,t)=>f<12?0:5+Math.min(7,f/4),
  layout:{rooms:[12,18], size:[9,14], corridors:'arena', loops:.15, pillars:1.1},
  enemies:{density:.3, elite:1.5, tierBias:1, bossOnEven:false, bossRush:true},
  rewards:{chests:1.5, rarity:3},
  roomWeights:{bossarena:30,prep:16,arena:16,shrine:12,creator:2,filler:12,vault:8,hub:6}
 },
 tesoro:{
  label:'Piso del tesoro', minFloor:2, cooldown:5, objective:'stairs',
  desc:'Riqueza a la vista y poca resistencia... al principio.',
  weight:(f)=>f<2?0:12,
  layout:{rooms:[20,30], size:[4,9], corridors:'normal', loops:.25, pillars:.8},
  enemies:{density:.45, elite:1.2, tierBias:0, bossOnEven:false, greedAmbush:true},
  rewards:{chests:2.8, rarity:3},
  roomWeights:{vault:30,filler:18,traproom:14,combat:12,guardpost:10,deadend:8,hub:5,shrine:3,creator:2}
 },
 supervivencia:{
  label:'Piso de supervivencia', minFloor:6, cooldown:5, objective:'survive', announce:true,
  desc:'No hay salida todavía. Aguanta: la escalera aparecerá al resistir lo suficiente.',
  weight:(f)=>f<6?0:14,
  layout:{rooms:[16,24], size:[7,13], corridors:'arena', loops:.35, pillars:1.5},
  enemies:{density:.9, elite:1.2, tierBias:0, bossOnEven:false, escalate:true},
  rewards:{chests:1.4, rarity:2},
  roomWeights:{arena:26,combat:22,filler:16,hub:12,ambush:10,eliteden:8,shrine:6,creator:2}
 },
 contrarreloj:{
  label:'Piso contrarreloj', minFloor:7, cooldown:5, objective:'timed', announce:true,
  desc:'El piso colapsa. Encuentra la salida antes de que se agote el tiempo.',
  weight:(f)=>f<7?0:13,
  layout:{rooms:[22,32], size:[5,10], corridors:'normal', loops:.4, pillars:.9},
  enemies:{density:.7, elite:1, tierBias:0, bossOnEven:false},
  rewards:{chests:1.3, rarity:2},
  roomWeights:{combat:24,filler:20,hub:16,knot:12,traproom:10,vault:8,guardpost:6,shrine:4,creator:2}
 }
};

// Weighted pick honouring depth gates, recency cooldowns and a hard rule that
// two heavy archetypes never chain back to back.
const HEAVY_ARCHETYPES=new Set(['superboss','bossrush']);
function pickFloorArchetype(floor,total,recent=[]){
 const tier=expectedTierForFloor(floor,total);
 const last=recent[recent.length-1];
 const entries=[];
 for(const [id,a] of Object.entries(FLOOR_ARCHETYPES)){
  if(floor<(a.minFloor||1))continue;
  if(HEAVY_ARCHETYPES.has(id)&&HEAVY_ARCHETYPES.has(last))continue;
  const since=recent.length-1-recent.lastIndexOf(id);
  if(recent.includes(id)&&since<=(a.cooldown||0))continue;
  let w=a.weight(floor,total,tier)||0;
  if(w<=0)continue;
  entries.push({id,w});
 }
 if(!entries.length)return 'standard';
 const totalW=entries.reduce((s,e)=>s+e.w,0);
 let r=Math.random()*totalW;
 for(const e of entries){r-=e.w;if(r<=0)return e.id}
 return entries[entries.length-1].id;
}

function weightedRoomType(weights){
 const entries=Object.entries(weights).filter(([id,w])=>w>0&&ROOM_TYPES[id]);
 const total=entries.reduce((s,[,w])=>s+w,0);
 let r=Math.random()*total;
 for(const [id,w] of entries){r-=w;if(r<=0)return id}
 return entries.length?entries[0][0]:'filler';
}
function randBetween(a,b){return a+rng(Math.max(1,b-a+1))}

// Objective descriptor stored on the floor and shared through the snapshot.
function buildFloorObjective(archId,floor,total){
 const a=FLOOR_ARCHETYPES[archId]||FLOOR_ARCHETYPES.standard;
 switch(a.objective){
  case 'survive':return {type:'survive',turns:12+Math.min(14,Math.floor(floor*.7)),elapsed:0,done:false,label:'Sobrevive'};
  case 'timed':return {type:'timed',limit:42+Math.min(40,floor*2),elapsed:0,expired:false,done:false,label:'Contrarreloj'};
  case 'waves':return {type:'waves',total:3+Math.min(3,Math.floor(floor/6)),done:0,pending:false,label:'Oleadas'};
  case 'bossKill':return {type:'bossKill',done:false,label:'Derrota al jefe'};
  default:return {type:'stairs',label:'Encuentra la salida'};
 }
}

// Shared floor builder used by both the pre-generated world JSON and the live
// generator, so archetypes/rooms behave identically in single and multiplayer.
// Assumes `game` is set with at least {floor,player,worldParams}.
function buildFloorPlan(floor,params,{recent=[],populationScale=1}={}){
 const total=params?.floors||DEFAULT_WORLD_PARAMS.floors;
 const archId=pickFloorArchetype(floor,total,recent);
 const arch=FLOOR_ARCHETYPES[archId]||FLOOR_ARCHETYPES.standard;
 const tier=expectedTierForFloor(floor,total);
 const L=arch.layout,E=arch.enemies,R=arch.rewards;
 const map=Array.from({length:ROWS},()=>Array(COLS).fill(1)),rooms=[];

 // --- rooms: count/size come from the archetype, shape from the room type ---
 const targetRooms=randBetween(L.rooms[0],L.rooms[1]);
 for(let tries=0;tries<2600&&rooms.length<targetRooms;tries++){
  const typeId=weightedRoomType(arch.roomWeights),T=ROOM_TYPES[typeId];
  const lo=Math.max(3,Math.min(T.size[0],L.size[1])),hi=Math.max(lo,Math.min(T.size[1],L.size[1]));
  let w=randBetween(lo,hi),h=randBetween(lo,hi);
  // shape variety: some rooms are markedly rectangular
  if(Math.random()<.35){if(Math.random()<.5)w=Math.max(3,Math.round(w*1.6));else h=Math.max(3,Math.round(h*1.6))}
  w=Math.min(w,COLS-4);h=Math.min(h,ROWS-4);
  const x=1+rng(Math.max(1,COLS-w-2)),y=1+rng(Math.max(1,ROWS-h-2));
  if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
  rooms.push({x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),type:typeId});
  carve(map,rooms[rooms.length-1]);
 }
 if(!rooms.length)return null;

 // Every floor needs at least 2 Creator's Room (craft) rooms so players can
 // always reach the shard/craft system - except archetypes that deliberately
 // omit 'creator' from their roomWeights (very special floors, e.g. 'horda').
 // One of the two is always forced onto the room closest to the entrance
 // (spawn), floor 1 included, so a craft room is never far from the start.
 if('creator' in (arch.roomWeights||{})){
  const spawnRoom=rooms[0];
  const distFromSpawn=r=>Math.abs(r.cx-spawnRoom.cx)+Math.abs(r.cy-spawnRoom.cy);
  const nonSpawn=rooms.filter(r=>r!==spawnRoom&&r.type!=='bossarena');
  if(nonSpawn.length){
   const nearest=[...nonSpawn].sort((a,b)=>distFromSpawn(a)-distFromSpawn(b))[0];
   nearest.type='creator';
  }
  const creatorRooms=rooms.filter(r=>r.type==='creator');
  while(creatorRooms.length<2){
   const candidates=rooms.filter(r=>r!==spawnRoom&&r.type!=='creator'&&r.type!=='bossarena');
   if(!candidates.length)break;
   const r=pick(candidates);
   r.type='creator';
   creatorRooms.push(r);
  }
 }

 const carveCorridor=(a,b)=>{let x=a.cx,y=a.cy;if(Math.random()<.5){while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}}else{while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}}};
 // spine: guarantees a valid route between every room (and thus entry->exit)
 for(let i=1;i<rooms.length;i++)carveCorridor(rooms[i-1],rooms[i]);
 // loops and shortcuts: extra connections make mazes navigable and add routes
 const loopCount=Math.round(rooms.length*(L.loops||0));
 for(let i=0;i<loopCount;i++){const a=pick(rooms),b=pick(rooms);if(a!==b)carveCorridor(a,b)}
 // extra exits for hubs/knots so their typology is real, not cosmetic
 for(const r of rooms){
  const want=ROOM_TYPES[r.type]?.exits||2;
  for(let i=2;i<want;i++){const other=pick(rooms);if(other!==r)carveCorridor(r,other)}
 }
 // false paths: dead-end stubs, only for maze-like layouts (never isolated areas)
 if(L.deadEnds)for(let i=0;i<Math.round(rooms.length*L.deadEnds);i++){
  const r=pick(rooms),dir=pick([[1,0],[-1,0],[0,1],[0,-1]]),len=3+rng(7);
  let x=r.cx,y=r.cy;
  for(let n=0;n<len;n++){const nx=x+dir[0],ny=y+dir[1];if(nx<1||ny<1||nx>=COLS-1||ny>=ROWS-1)break;x=nx;y=ny;map[y][x]=0}
 }

 // --- key positions ---
 const spawn=rooms[0];
 const distanceFromSpawn=r=>Math.abs(r.cx-spawn.cx)+Math.abs(r.cy-spawn.cy);
 const distantRooms=[...rooms].slice(1).sort((a,b)=>distanceFromSpawn(b)-distanceFromSpawn(a));
 const stairRoom=distantRooms[0]||rooms.at(-1);
 const bossRoom=rooms.find(r=>r.type==='bossarena'&&r!==spawn)||distantRooms[1]||distantRooms[0]||rooms.at(-1);
 const stairs={x:stairRoom.cx,y:stairRoom.cy};
 spawn.type='filler';

 // --- cover / pillars inside rooms (real line-of-sight blockers) ---
 const pillarMult=L.pillars??1;
 for(const r of rooms){
  if(r.w<5||r.h<5)continue;
  const density=(ROOM_TYPES[r.type]?.cover||0)*pillarMult;
  if(density<=0)continue;
  const inner=(r.w-2)*(r.h-2),n=Math.floor(inner*density*.18);
  for(let i=0;i<n;i++){
   const px=r.x+1+rng(Math.max(1,r.w-2)),py=r.y+1+rng(Math.max(1,r.h-2));
   if(px===r.cx&&py===r.cy)continue;          // never block the room centre
   if(px===spawn.cx&&py===spawn.cy)continue;
   if(px===stairs.x&&py===stairs.y)continue;
   map[py][px]=1;                              // border ring stays open: no room can be sealed
  }
 }

 const safeRoomCount=arch.objective==='survive'?1:2+rng(3);
 const excludedRooms=new Set([spawn,stairRoom,bossRoom]);
 const safeRooms=[...rooms].filter(r=>!excludedRooms.has(r)&&r.type!=='bossarena'&&distanceFromSpawn(r)>8).sort(()=>Math.random()-.5).slice(0,safeRoomCount).map((r,i)=>({...r,id:`safe-${floor}-${i}`,rested:false}));
 const safeCellKeys=new Set(safeRooms.flatMap(r=>[...roomCellSet(r)]));
 const occ=new Set([key(spawn.cx,spawn.cy),key(stairs.x,stairs.y)]);safeRooms.forEach(r=>occ.add(key(r.cx,r.cy)));
 const cells=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y)))cells.push({x,y});
 if(!cells.length)return null;
 const free=()=>{let p,guard=0;do{p=pick(cells);guard++}while(occ.has(key(p.x,p.y))&&guard<400);occ.add(key(p.x,p.y));return{...p}};
 const freeIn=r=>{
  for(let i=0;i<40;i++){
   const x=r.x+rng(Math.max(1,r.w)),y=r.y+rng(Math.max(1,r.h));
   if(map[y]?.[x]===0&&!occ.has(key(x,y))&&!safeCellKeys.has(key(x,y))){occ.add(key(x,y));return{x,y}}
  }
  return free();
 };
 const edgeIn=r=>{
  for(let i=0;i<40;i++){
   const onX=Math.random()<.5;
   const x=onX?(Math.random()<.5?r.x:r.x+r.w-1):r.x+rng(Math.max(1,r.w));
   const y=onX?r.y+rng(Math.max(1,r.h)):(Math.random()<.5?r.y:r.y+r.h-1);
   if(map[y]?.[x]===0&&!occ.has(key(x,y))&&!safeCellKeys.has(key(x,y))){occ.add(key(x,y));return{x,y}}
  }
  return freeIn(r);
 };

 // --- doors (locked ones gate vaults), keys, traps, altars, chests ---
 const doors=[];
 for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y))){
  const h=map[y][x-1]===0&&map[y][x+1]===0&&map[y-1][x]===1&&map[y+1][x]===1;
  const v=map[y-1][x]===0&&map[y+1][x]===0&&map[y][x-1]===1&&map[y][x+1]===1;
  if((h||v)&&Math.random()<.065&&!occ.has(key(x,y))){doors.push({x,y,open:false,locked:Math.random()<.25});occ.add(key(x,y))}
 }
 const keys=[];for(let i=0;i<Math.max(1,doors.filter(d=>d.locked).length);i++)keys.push(free());

 const traps=[],altars=[],chests=[];
 for(const r of rooms){
  const T=ROOM_TYPES[r.type]||ROOM_TYPES.filler;
  if(safeRooms.some(s=>s.x===r.x&&s.y===r.y))continue;
  if(T.traps&&Math.random()<T.traps){
   const n=T.trapCount?randBetween(T.trapCount[0],T.trapCount[1]):1+rng(2);
   for(let i=0;i<n;i++){const pos=freeIn(r);traps.push({...pos,dmg:Math.max(3,Math.round(4+floor*1.6)),revealed:false,sprung:false})}
  }
  if(T.altar&&(T.creatorRoom||Math.random()<.85)){const pos=freeIn(r);altars.push({...pos,kind:T.creatorRoom?'disenchant':pick(['heal','shield','power']),used:false})}
  const chestCount=T.chests?randBetween(T.chests[0],T.chests[1]):(Math.random()<(T.chest||0)?1:0);
  for(let i=0;i<Math.round(chestCount*(R.chests||1));i++){
   const chestDef=pickChestDefForFloor(floor,game?.player?.level,params.floors);
   if(chestDef)chests.push({...freeIn(r),opened:false,locked:!!T.locked&&Math.random()<.5,chestDef});
  }
 }
 // baseline chest floor so no archetype is completely dry (only when config_chest has anything to place)
 const minChests=Math.round((8+Math.floor(floor*.6))*(R.chests||1));
 while(chests.length<minChests){
  const chestDef=pickChestDefForFloor(floor,game?.player?.level,params.floors);
  if(!chestDef)break; // config_chest is completely empty: no chests get placed on this floor
  chests.push({...free(),opened:false,chestDef});
 }

 // --- enemies: budget from the archetype, composition from the room type ---
 const family=pickConfiguredFamilyForFloorWithParams(floor,params),enemies=[];
 const baseCount=Math.round((30+floor*4.5+rng(11))*(E.density||1)*populationScale*pctMult(params.enemyCountPct));
 const combatRooms=rooms.filter(r=>r!==spawn&&(ROOM_TYPES[r.type]?.enemies?.[1]||0)>0);
 let placed=0;
 for(const r of combatRooms){
  if(placed>=baseCount)break;
  const T=ROOM_TYPES[r.type];
  let n=randBetween(T.enemies[0],T.enemies[1]);
  if(arch.objective==='waves'&&T.wave)n=Math.round(n*.6); // the rest arrive as waves
  for(let i=0;i<n&&placed<baseCount;i++){
   const pos=T.place==='edges'?edgeIn(r):freeIn(r);
   const wantElite=Math.random()<Math.min(.85,.05*(E.elite||1)*(T.elite?6:1));
   const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,floor,params.floors),pos,floor,false);
   e.enemyFamily=family.name;e.roomType=r.type;
   if(T.tier||E.tierBias){
    const bump=(T.tier||0)+(E.tierBias||0);
    if(bump>0){e.maxHp=e.hp=Math.round(e.hp*(1+.22*bump));e.atk=e.damage=Math.round((e.atk||e.damage||4)*(1+.15*bump));e.xp=Math.round((e.xp||8)*(1+.2*bump))}
    else if(bump<0){e.maxHp=e.hp=Math.max(4,Math.round(e.hp*.75));e.atk=e.damage=Math.max(1,Math.round((e.atk||e.damage||4)*.8))}
   }
   if(wantElite&&!e.boss){e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.5);e.atk=e.damage=Math.round((e.atk||e.damage||4)*1.28);e.xp=Math.round((e.xp||8)*1.8);assignEnemySkills(e)}
   enemies.push(e);placed++;
  }
 }
 while(placed<baseCount){const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,floor,params.floors),free(),floor,false);e.enemyFamily=family.name;enemies.push(e);placed++}

 // --- bosses ---
 let boss=null;const bosses=[];
 const mkBoss=(pos,label,tierBonus)=>{
  const b=buildConfiguredEnemy(weightedFamilyEnemy(family,true,floor,params.floors),pos,floor,true);
  b.enemyFamily=family.name;
  if(tierBonus>0){
   b.maxHp=b.hp=Math.round(b.hp*(1+.45*tierBonus));
   b.atk=b.damage=Math.round((b.atk||b.damage||4)*(1+.22*tierBonus));
   b.armor=Math.round((b.armor||0)+2*tierBonus);
   b.xp=Math.round((b.xp||8)*(1+.6*tierBonus));
   b.phases=1+tierBonus;b.superBoss=true;
   assignEnemySkills(b);
  }
  if(label)b.name=`${b.name} · ${label}`;
  enemies.push(b);bosses.push(b);if(!boss)boss=b;
  return b;
 };
 if(E.superBoss){
  const bonus=1+rng(3);                               // 1..3 tiers above the usual
  mkBoss({x:bossRoom.cx,y:bossRoom.cy},`Superjefe (+${bonus})`,bonus);
 }else if(E.bossRush){
  const arenas=rooms.filter(r=>r.type==='bossarena');
  const list=(arenas.length?arenas:distantRooms.slice(0,4)).slice(0,4);
  list.forEach((r,i)=>mkBoss({x:r.cx,y:r.cy},i===list.length-1?'Jefe final':`Minijefe ${i+1}`,i===list.length-1?2:0));
 }else if(E.miniboss){
  mkBoss({x:bossRoom.cx,y:bossRoom.cy},'Minijefe',0);
 }else if(E.bossOnEven){
  const bossCount=floor%2===0?Math.min(4,1+Math.floor(floor/10)):(Math.random()<.08?1:0);
  for(let bi=0;bi<bossCount;bi++){
   const r=bi===0?bossRoom:distantRooms[Math.min(distantRooms.length-1,2+bi)]||bossRoom;
   mkBoss({x:r.cx,y:r.cy},bi?`Campeón ${bi+1}`:'',0);
  }
 }

 const objective=buildFloorObjective(archId,floor,total);
 if(objective.type==='bossKill'&&!boss)objective.type='stairs';
 const event=Math.random()<=(arch.objective==='stairs'?.12:.06)?{id:pick(eventDefs).id}:null;
 const floorTileset=floorTilesetForWorldPlan(floor,params)||pickFloorTilesetForLevel(floor);

 return {
  floor,map,rooms,safeRooms,spawn:{x:spawn.cx,y:spawn.cy},stairs,doors,keys,chests,traps,altars,event,
  enemies,boss,family,archetype:archId,archetypeLabel:arch.label,archetypeDesc:arch.desc,
  objective,tierExpected:tier,rewardRarityBonus:R.rarity||0,
  enemyFamily:family.name,enemyFamilyId:family.dbId||family.id||null,
  themeName:floorTileset.name,floorTileset,announce:!!arch.announce
 };
}

function createDungeonWorldJson(name,params=DEFAULT_WORLD_PARAMS){
 params=normalizeWorldParams(params);
 if(!normalizedEnemyFamilies().length)throw new Error('No hay familias en enemy_family para generar enemigos por piso.');
 if(!normalizedSupabaseFloors().length)throw new Error('No hay floors en config_floor para generar floors aleatorios.');
 const floors=[],lootTable=createLootProgressionTable(params.floors);
 const oldGame=game;
 const tempPlayer={level:1,stats:{strength:4,vitality:4,agility:3,luck:2,intelligence:2,wisdom:2},raceBonuses:{},derived:{floorShield:0},shield:0,hp:1,maxHp:1};
 const recent=[];
 for(let floor=1;floor<=params.floors;floor++){
  game={floor,player:tempPlayer,worldParams:params,worldLootTable:lootTable};
  let plan=null;
  for(let attempt=0;attempt<3&&!plan;attempt++)plan=buildFloorPlan(floor,params,{recent});
  if(!plan)throw new Error(`No se pudo generar el piso ${floor}.`);
  recent.push(plan.archetype);
  floors.push({
   floor,map:plan.map,rooms:plan.rooms,safeRooms:plan.safeRooms,spawn:plan.spawn,stairs:plan.stairs,
   doors:plan.doors,keys:plan.keys,chests:plan.chests,traps:plan.traps,altars:plan.altars,event:plan.event,
   archetype:plan.archetype,archetypeLabel:plan.archetypeLabel,archetypeDesc:plan.archetypeDesc,
   objective:plan.objective,tierExpected:plan.tierExpected,rewardRarityBonus:plan.rewardRarityBonus,announce:plan.announce,
   enemies:plan.enemies.map(e=>compactEnemyForWorld(assignEnemySkills(e))),
   enemyFamily:plan.enemyFamily,enemyFamilyId:plan.enemyFamilyId,
   themeName:plan.themeName,floorTileset:compactFloorTilesetForWorld(plan.floorTileset),
   boss:plan.boss?compactEnemyForWorld(plan.boss):null
  });
 }
 game=oldGame;
 return {schemaVersion:4,appVersion:APP_VERSION,worldName:name,generatedAt:new Date().toISOString(),params,lootTable,floors};
}
function loadPrecomputedFloor(){
 const data=selectedDungeonWorld?.world_json?.floors?.[game.floor-1];if(!data)return false;
 if(game?.player){recomputeDerived();if(game.player.raceBonuses?.floorHeal)healEntity(game.player,game.player.raceBonuses.floorHeal);game.player.secondLifeReady=true;game.player.shield=(game.player.shield||0)+(game.player.derived?.floorShield||0)}
 const floorTileset=hydrateFloorTilesetForWorld(data.floorTileset)||pickFloorTilesetForLevel(game.floor);
 Object.assign(game,{map:data.map,rooms:data.rooms,safeRooms:data.safeRooms||[],stairs:data.stairs,doors:data.doors,keys:data.keys,chests:data.chests,traps:(data.traps||[]).map(t=>({...t})),altars:(data.altars||[]).map(a=>({...a})),precomputedEvent:data.event||null,enemies:(data.enemies||[]).map(e=>hydratePrecomputedEnemy(assignEnemySkills({...e}))),enemyFamily:data.enemyFamily,floorTileset,seen:Array.from({length:ROWS},()=>Array(COLS).fill(false)),boss:data.boss?hydratePrecomputedEnemy({...data.boss}):null,
  floorArchetype:data.archetype||'standard',floorArchetypeLabel:data.archetypeLabel||'Piso estándar',floorArchetypeDesc:data.archetypeDesc||'',
  objective:data.objective?{...data.objective}:{type:'stairs',label:'Encuentra la salida'},rewardRarityBonus:data.rewardRarityBonus||0,partyScaled:0});
 game.player.x=data.spawn.x;game.player.y=data.spawn.y;anim.heroX=anim.targetX=data.spawn.x;anim.heroY=anim.targetY=data.spawn.y;anim.t=1;reveal(data.spawn.x,data.spawn.y);
 scaleFloorForPlayerLevel();
 scaleFloorForParty();
 announceFloorArchetype();
 grantFloorRewardPopup();
 log(`Mundo: ${selectedDungeonWorld.world_name} (#${selectedDungeonWorld.id}).`,'story');
 updateUI();draw();rollFloorEvent();return true;
}

function floorTheme(){return themes[Math.min(themes.length-1,Math.floor((game.floor-1)/2))]}
function carve(map,r){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)map[y][x]=0}


const eventStats=['strength','vitality','agility','luck','intelligence','wisdom'];
const eventDefs=[
 {id:'goblinHorde',type:'horde',name:'Horda de saqueadores',stat:'strength',threshold:10,
  detected:'Escuchas botas, risas y metal barato antes de que doblen la esquina.',
  hidden:'Una horda cae sobre ti desde pasadizos laterales.',
  desc:'Una banda numerosa de enemigos invade el piso.'},
 {id:'orcWarband',type:'horde',name:'Partida de guerra orca',stat:'strength',threshold:11,
  detected:'Las vibraciones del suelo delatan una marcha pesada.',
  hidden:'Una partida de guerra te rodea con entusiasmo profesional.',
  desc:'Enemigos resistentes aparecen en varias salas.'},
 {id:'shadowSwarm',type:'horde',name:'Enjambre de sombras',stat:'wisdom',threshold:12,
  detected:'Notas que las sombras se mueven un instante antes que sus dueños.',
  hidden:'Las sombras se separan de las paredes y atacan.',
  desc:'Criaturas rápidas y numerosas surgen de la oscuridad.'},
 {id:'dartHall',type:'trap',name:'Galería de dardos',stat:'strength',threshold:9,
  detected:'Ves pequeños agujeros alineados en las paredes.',
  hidden:'Un clic. Luego demasiados dardos.',
  desc:'Una trampa inflige daño y aplica ralentización.'},
 {id:'runeMine',type:'trap',name:'Mina rúnica',stat:'intelligence',threshold:11,
  detected:'Las runas del suelo forman un circuito explosivo bastante evidente.',
  hidden:'Pisas una runa. La runa parece encantada de conocerte.',
  desc:'Explosión mágica con pérdida de maná.'},
 {id:'poisonFeast',type:'trap',name:'Banquete envenenado',stat:'vitality',threshold:10,
  detected:'El asado huele demasiado bien para estar abandonado.',
  hidden:'La comida era gratis. El veneno también.',
  desc:'Pierdes vida, aunque puedes obtener una pequeña recompensa.'},
 {id:'falseTreasure',type:'trap',name:'Tesoro falso',stat:'luck',threshold:12,
  detected:'El brillo del cofre parece demasiado teatral.',
  hidden:'El cofre era una trampa con dientes.',
  desc:'Un mímico o una explosión protegen un botín menor.'},
 {id:'championGate',type:'boss',name:'Campeón de la Puerta',stat:'strength',threshold:12,
  detected:'Reconoces marcas de duelo y sangre reciente.',
  hidden:'Un campeón bloquea la salida y exige combate.',
  desc:'Aparece un jefe opcional mucho más fuerte.'},
 {id:'witchQueen',type:'boss',name:'Reina Bruja Errante',stat:'wisdom',threshold:13,
  detected:'El aire se enfría y una voz pronuncia tu nombre desde otra sala.',
  hidden:'La Reina Bruja ya te estaba esperando.',
  desc:'Jefe mágico con gran vida y daño.'},
 {id:'chromeBeast',type:'boss',name:'Bestia de Cromo',stat:'intelligence',threshold:13,
  detected:'Interferencias en el visor revelan una firma mecánica enorme.',
  hidden:'Una criatura de metal rompe la pared.',
  desc:'Jefe ciberpunk con armadura alta.'},
 {id:'dragonWhelp',type:'boss',name:'Cría de dragón hambrienta',stat:'vitality',threshold:12,
  detected:'El olor a azufre y carne chamuscada no deja lugar a dudas.',
  hidden:'Una cría de dragón decide que pareces comestible.',
  desc:'Jefe de fuego con golpes muy fuertes.'},
 {id:'fairyCache',type:'reward',name:'Alijo feérico',stat:'luck',threshold:10,
  detected:'Una hilera de luciérnagas marca una grieta en el muro.',
  hidden:'Pasas junto a un alijo oculto sin verlo.',
  desc:'Botín raro o una habilidad looteable.'},
 {id:'forgottenShrine',type:'reward',name:'Santuario olvidado',stat:'wisdom',threshold:11,
  detected:'Reconoces una oración grabada bajo el musgo.',
  hidden:'El santuario permanece silencioso mientras pasas.',
  desc:'Curación, recursos y bendición temporal.'},
 {id:'smugglerLocker',type:'reward',name:'Taquilla de contrabandista',stat:'intelligence',threshold:10,
  detected:'Un cierre electrónico barato intenta fingir que no existe.',
  hidden:'La taquilla permanece cerrada y discreta.',
  desc:'Objeto ciberpunk de alta rareza y oro.'},
 {id:'buriedArmory',type:'reward',name:'Armería enterrada',stat:'strength',threshold:11,
  detected:'Una losa demasiado pesada oculta un compartimento.',
  hidden:'No reparas en la losa sellada.',
  desc:'Armas y armaduras de buena calidad.'},
 {id:'thievesDeal',type:'reward',name:'Trato de ladrones',stat:'strength',threshold:11,
  detected:'Una marca de tiza señala una reunión clandestina.',
  hidden:'Los ladrones se marchan antes de que llegues.',
  desc:'Oro, consumibles y posibilidad de objeto épico.'}
];
function currentEventStatValue(stat){
 const fs=game.player.derived?.finalStats||game.player.stats;
 return fs[stat]||0;
}
function rollFloorEvent(){
 if(!game?.player||game.floorEventRolled)return;
 game.floorEventRolled=true;
 if(game.multiplayer)return;
 let def=null;
 if(game.precomputedEvent){def={...eventDefs.find(e=>e.id===game.precomputedEvent.id)};delete game.precomputedEvent;}
 else{if(Math.random()>.09)return;def={...pick(eventDefs)}}
 if(!def)return;
 def.threshold=Math.max(9,Math.round(def.threshold+(game.floor-1)*.65+(game.player.level-1)*.18));
 const value=currentEventStatValue(def.stat),roll=1+rng(20),total=roll+Math.floor(value/2);
 const detected=total>=def.threshold;
 game.activeEvent={...def,detected,resolved:false,detectionRoll:roll,detectionTotal:total};
 setTimeout(()=>presentFloorEvent(game.activeEvent),450);
}
function statLabel(s){return({strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'})[s]||s}
function presentFloorEvent(ev){
 if(!ev||ev.resolved)return;
 const check=`${statLabel(ev.stat)} · tirada ${ev.detectionRoll} + bonificador ${Math.floor(currentEventStatValue(ev.stat)/2)} = ${ev.detectionTotal} / dificultad ${ev.threshold}`;
 if(ev.detected){
  storyTitle.textContent=`EVENTO DETECTADO — ${ev.name}`;
  storyBody.innerHTML=`<div class="narrative"><p>${ev.detected}</p><p>${ev.desc}</p><p><b>Detección:</b> ${check}</p><div class="startActions"><button id="eventPrepare">Prepararse</button><button id="eventAvoid">Evitar</button></div></div>`;
  storyOverlay.classList.remove('hidden');
  setTimeout(()=>{
   document.getElementById('eventPrepare')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');resolveFloorEvent(ev,true)});
   document.getElementById('eventAvoid')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');if(ev.type==='reward')resolveFloorEvent(ev,true);else{ev.resolved=true;log(`Evitas ${ev.name}.`,'story')}});
  },0)
 }else{
  storyTitle.textContent=`EVENTO — ${ev.name}`;
  storyBody.innerHTML=`<div class="narrative"><p>${ev.hidden}</p><p>${ev.desc}</p><p class="small">No superaste la tirada de ${statLabel(ev.stat)} (${ev.detectionTotal}/${ev.threshold}).</p><div class="startActions"><button id="eventContinue">Continuar</button></div></div>`;
  storyOverlay.classList.remove('hidden');
  setTimeout(()=>document.getElementById('eventContinue')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');resolveFloorEvent(ev,false)}),0)
 }
}
function randomOpenTile(){
 for(let tries=0;tries<300;tries++){
  const room=pick(game.rooms||[]);if(!room)break;
  const x=room.x+rng(Math.max(1,room.w)),y=room.y+rng(Math.max(1,room.h));
  if(game.map[y]?.[x]===0&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&Math.abs(x-game.player.x)+Math.abs(y-game.player.y)>4)return{x,y}
 }
 return{x:game.player.x+2,y:game.player.y}
}
function spawnEventEnemy(mult=1,boss=false,name='Enemigo del evento'){
 const pos=randomOpenTile(),theme=themes[Math.min(themes.length-1,Math.max(0,game.floor-1))]||themes[0],type=boss?theme.boss:pick(theme.enemies),base=enemyDefs[type]||{name,hp:18,damage:5,xp:8};
 const e=scaleEnemy({...base,type,x:pos.x,y:pos.y,maxHp:base.hp||18,hp:base.hp||18,boss:boss||base.boss});
 e.name=boss?name:e.name;e.maxHp=e.hp=Math.round(e.hp*mult);e.damage=Math.round(e.damage*(boss?1.35:1));game.enemies.push(e);return e
}
function resolveFloorEvent(ev,prepared){
 if(ev.resolved)return;ev.resolved=true;
 if(ev.type==='horde'){
  const n=4+game.floor+difficultyScale().count+(prepared?0:2);
  for(let i=0;i<n;i++)spawnEventEnemy(prepared?.9:1.05,false);
  banner('¡HORDA!');log(`${ev.name}: aparecen ${n} enemigos.`,'story')
 }else if(ev.type==='trap'){
  if(ev.id==='falseTreasure'){spawnEventEnemy(prepared?1.2:1.6,true,'Mímico Rechoncho')}
  else{
   const dmg=Math.max(4,Math.round(game.player.maxHp*(prepared?.10:.22)));
   game.player.hp=Math.max(1,game.player.hp-dmg);
   if(ev.id==='runeMine')game.player.mana=Math.max(0,game.player.mana-15);
   if(ev.id==='dartHall')game.player.stamina=Math.max(0,game.player.stamina-18);
   if(ev.id==='poisonFeast'&&Math.random()<.45){game.player.gold+=20+game.floor*10}
   floating(`-${dmg}`,game.player.x,game.player.y,'#ff6666');log(`${ev.name}: sufres ${dmg} de daño.`,'story')
  }
 }else if(ev.type==='boss'){
  const names={championGate:'Campeón de Hierro',witchQueen:'Reina Bruja Errante',chromeBeast:'Bestia de Cromo',dragonWhelp:'Cría de Dragón Carmesí'};
  const b=spawnEventEnemy(prepared?1.7:2.2,true,names[ev.id]||ev.name);b.eventBoss=true;b.xp=Math.round(b.xp*2.5);
  banner('JEFE OPCIONAL');log(`${b.name} entra en combate.`,'story')
 }else if(ev.type==='reward'){
  const count=ev.id==='buriedArmory'?3:2;
  for(let i=0;i<count;i++){const item=makeLoot(game.player.level+game.floor+2,'specialReward');if(i===0&&Math.random()<.6){const row=currentLootProgressionRow(game.floor,game.player.level),pool=['rare','epic','legendary'].filter(r=>lootRarityAllowed(r,row));if(pool.length){item.rarity=pick(pool);item.label=tierDefs[item.rarity]?.label||item.rarity}}addInventoryItem(item);lootToast(item)}
  if(ev.id==='fairyCache'&&Math.random()<.65)unlockSkillLoot(randomLootableSkill());
  if(ev.id==='forgottenShrine'){game.player.hp=game.player.maxHp;game.player.mana=game.player.maxMana;game.player.stamina=game.player.maxStamina}
  if(ev.id==='smugglerLocker')game.player.gold+=40+game.floor*15;
  banner('RECOMPENSA ESPECIAL');log(`${ev.name}: encuentras una recompensa poco común.`,'loot')
 }
 updateUI();draw()
}


const LEVEL_CAP=100;
function xpNeededForLevel(level){
 level=Math.max(1,Math.min(LEVEL_CAP,level));
 return Math.round(28+level*18+Math.pow(level,1.72)*5.4);
}
function levelGrowth(level){
 return{
  hp:5+Math.floor(level/5),
  stamina:3+Math.floor(level/12),
  mana:3+Math.floor(level/12),
  damage:(level%3===0?1:0)+(level%10===0?1:0),
  armor:(level%4===0?1:0)+(level%15===0?1:0)
 };
}
function levelScalePreview(level){
 const cumulativeXp=Array.from({length:Math.max(0,level-1)},(_,i)=>xpNeededForLevel(i+1)).reduce((a,b)=>a+b,0);
 return{
  level,
  xpForNext:level<LEVEL_CAP?xpNeededForLevel(level):0,
  cumulativeXp,
  enemyHpMultiplier:+Math.pow(1.055,level-1).toFixed(2),
  enemyDamageMultiplier:+Math.pow(1.035,level-1).toFixed(2),
  lootQuality:+(1+Math.pow(level-1,0.72)*.18).toFixed(2)
 }
}
const LEVEL_100_FORECAST=[1,5,10,20,30,40,50,60,70,80,90,100].map(levelScalePreview);

function difficultyScale(){
 const p=game.player,f=game.floor||1,l=Math.min(LEVEL_CAP,p.level||1);
 return{
  hp:Math.pow(1.055,l-1)*(1+(f-1)*.19),
  damage:Math.pow(1.035,l-1)*(1+(f-1)*.13),
  xp:1+(f-1)*.09+Math.pow(l-1,.72)*.045,
  count:Math.min(35,Math.floor((f-1)/2)+Math.floor((l-1)/7)),
  eliteChance:Math.min(.42,.025*f+.0032*l)
 };
}

function enemySkillPool(e){
 const level=game.player.level||1,maxTier=level>=30?3:level>=10?2:1;
 const all=Object.entries(skillDefs).filter(([id,s])=>s.enemyUsable&&(!s.tier||s.tier<=maxTier));
 const pref=ENEMY_CLASS_SKILL_PREF[enemyClassOf(e)];
 const filtered=pref?all.filter(([id,s])=>pref(s)):all;
 return (filtered.length?filtered:all).map(([id])=>id)
}
// ---- Enemy classes & equipment ----------------------------------------------
// Every enemy resolves to a class; on dungeon build it gets a weapon whose
// quality scales with level/floor rarity. Ranged classes shoot from distance,
// magic classes cast, support classes heal allies. Weapon data is plain JSON
// so it persists through world JSON, session snapshots and broadcasts.
const ENEMY_CLASS_GEAR={
 rogue:{kind:'melee',cats:['Armas blancas steampunk básicas','Espadas eléctricas iniciales'],label:'Pícaro'},
 warrior:{kind:'melee',cats:['Armas pesadas steampunk','Armas de latón refinadas'],label:'Guerrero'},
 tanque:{kind:'melee',cats:['Armas eléctricas pesadas','Artillería steampunk'],label:'Tanque'},
 arquero:{kind:'ranged',types:['Arcos','Ballestas','Pistolas','Escopetas'],label:'Arquero'},
 francotirador:{kind:'ranged',types:['Rifles','Ballestas'],label:'Francotirador'},
 caster:{kind:'magic',types:['Varitas'],label:'Mago'},
 invocador:{kind:'magic',types:['Varitas'],label:'Invocador'},
 clerigo:{kind:'magic',types:['Varitas'],label:'Clérigo'},
 chaman:{kind:'magic',types:['Varitas'],label:'Chamán'}
};
const ENEMY_WEAPON_BASENAMES={Arcos:'Arco',Ballestas:'Ballesta',Pistolas:'Pistola',Rifles:'Rifle',Escopetas:'Escopeta',Varitas:'Varita'};
const ENEMY_WEAPON_QUALITY=['de chatarra','de caza','de guerra','de élite','de leyenda','de mito'];
const ENEMY_CLASS_SKILL_PREF={
 caster:s=>s.type==='magic'&&!['heal','shield'].includes(s.classEffect),
 invocador:s=>s.type==='magic',
 chaman:s=>s.type==='magic'||['buff','debuff','aoe'].includes(s.classEffect),
 clerigo:s=>['heal','shield','buff','utility'].includes(s.classEffect),
 arquero:s=>['ranged','multihit'].includes(s.classEffect),
 francotirador:s=>['ranged','execute','ultimate'].includes(s.classEffect),
 rogue:s=>s.type==='physical'&&['dash','execute','debuff','multihit','ranged'].includes(s.classEffect),
 tanque:s=>['shield','buff','debuff'].includes(s.classEffect),
 warrior:s=>s.type==='physical'
};
function enemyClassOf(e){
 if(e.enemyClass)return e.enemyClass;
 if(ENEMY_CLASS_GEAR[e.type])return e.type;
 const t=String(e.type||'').toLowerCase();
 if(/arquero|archer|cazador|ballest/.test(t))return 'arquero';
 if(/francotirador|sniper/.test(t))return 'francotirador';
 if(/liche|mago|mage|caster|brujo|hechicer|arcan/.test(t))return 'caster';
 if(/chaman/.test(t))return 'chaman';
 if(/clerigo|priest|sacerdote|monje/.test(t))return 'clerigo';
 if(/invocador|necro|summon/.test(t))return 'invocador';
 if(/lobo|wolf|rata|goblin|ladron|rogue|vamp|asesin|arana|spider/.test(t))return 'rogue';
 if(/golem|tanque|guardian|coloso|troll|ogro/.test(t))return 'tanque';
 return 'warrior';
}
function equipEnemy(e,floor=game?.floor||1){
 if(e.weapon)return e;
 const cls=enemyClassOf(e),gear=ENEMY_CLASS_GEAR[cls];
 e.enemyClass=cls;
 if(!gear)return e;
 e.enemyClassLabel=gear.label;
 const lvl=e.level||enemyLevelForFloor(floor);
 const baseAtk=e.atk||e.damage||4;
 // preferred source: config_items weapons matching the class kind
 const pool=configItems.map(r=>({row:r,item:r.item_json||r})).filter(w=>(w.item.slot||w.row.slot)==='weapon'&&configWeaponKind(w.item)===gear.kind);
 if(pool.length){
  const lr=currentLootProgressionRow(floor,lvl);
  let cands=pool.filter(w=>lootRarityAllowed(w.item.rarity||w.row.tier||'common',lr));
  if(!cands.length)cands=pool;
  cands=cands.map(w=>({...w,il:Number(w.item.itemLevel||w.row.ilvl)||1})).sort((a,b)=>Math.abs(a.il-lvl)-Math.abs(b.il-lvl));
  const w=pick(cands.slice(0,Math.max(3,Math.ceil(cands.length*.4))));
  const rarity=w.item.rarity||w.row.tier||'common',rIdx=Math.max(0,LOOT_RARITY_ORDER.indexOf(rarity));
  const preset=weaponTypeRanges[w.item.weaponType]||null;
  const rangeMin=gear.kind==='melee'?1:(Number(w.item.rangeMin)||preset?.min||1);
  const rangeMax=gear.kind==='melee'?1:(Number(w.item.rangeMax)||preset?.max||4);
  const dmgBonus=Math.max(1,Math.round(baseAtk*(.12+rIdx*.05)));
  e.weapon={name:w.item.name||w.row.nombre||'Arma',kind:gear.kind,rangeMin,rangeMax,dmg:dmgBonus,rarity,label:w.item.label||tierDefs[rarity]?.label||rarity,itemId:w.row.id};
  e.atk=baseAtk+dmgBonus;e.damage=e.atk;
  if(cls==='tanque')e.armor=(e.armor||0)+1+Math.floor(lvl/6);
  return e;
 }
 // fallback (config_items empty or without weapons of this kind): synthetic weapon
 const rar=weightedRarity(lvl),rarIdx=Math.max(0,LOOT_RARITY_ORDER.indexOf(rar.name));
 let name,rangeMin=1,rangeMax=1;
 if(gear.kind==='melee'){
  const cat=gear.cats[rng(gear.cats.length)];
  name=weaponNameForCategory(cat,Math.max(0,Math.min(9,Math.floor(lvl/2)+rarIdx-1)));
 }else{
  const t=gear.types[rng(gear.types.length)],r=weaponTypeRanges[t]||{min:1,max:4};
  rangeMin=r.min;rangeMax=r.max;
  name=`${ENEMY_WEAPON_BASENAMES[t]||t} ${ENEMY_WEAPON_QUALITY[rarIdx]||ENEMY_WEAPON_QUALITY[0]}`;
 }
 const dmgBonus=Math.max(1,Math.round(baseAtk*(.12+rarIdx*.05)));
 e.weapon={name,kind:gear.kind,rangeMin,rangeMax,dmg:dmgBonus,rarity:rar.name,label:rar.label};
 e.atk=baseAtk+dmgBonus;e.damage=e.atk;
 if(cls==='tanque')e.armor=(e.armor||0)+1+Math.floor(lvl/6);
 return e;
}
function assignEnemySkills(e){
 const cls=enemyClassOf(e);
 const casterClass=['caster','clerigo','chaman','invocador'].includes(cls);
 const chance=e.boss?.95:casterClass?1:e.elite?.6:(cls==='arquero'||cls==='francotirador')?.45:.18+Math.min(.22,(game?.floor||1)*.012);
 e.skills=Array.isArray(e.configuredSkillIds)?[...e.configuredSkillIds]:[];e.skillCooldowns={};
 if(!e.skills.length&&Math.random()<chance){const pool=enemySkillPool(e),count=e.boss?2+(Math.random()<.45?1:0):casterClass?1+(Math.random()<.35?1:0):1;while(e.skills.length<count&&pool.length){const id=pool.splice(rng(pool.length),1)[0];e.skills.push(id)}}
 return e
}
function enemyUseSkill(e,dist,target=game.player){
 if(!e.skills?.length)return false;
 for(const id of e.skills){
  e.skillCooldowns[id]=Math.max(0,(e.skillCooldowns[id]||0)-1);
  const s=skillDefs[id];if(e.skillCooldowns[id]>0)continue;
  const ranged=isRangedSkill(id)||s.classEffect==='ranged'||s.classEffect==='multihit'||s.classEffect==='ultimate'||s.classEffect==='massive';
  if((ranged&&dist<=Math.max(4,s.range||6)&&hasLineOfSight(e,target))||(!ranged&&dist<=1)){
   const mult=e.boss?1.35:e.elite?1.15:1,statMod=skillStatModifier(id,e),amount=Math.max(2,Math.round(((e.atk||e.damage||4)+statMod)*mult*(s.tier?1+s.tier*.12:1)));
   if(s.classEffect==='heal'&&['clerigo','chaman'].includes(enemyClassOf(e))){
    const ally=game.enemies.filter(o=>o!==e&&o.hp>0&&o.hp<o.maxHp&&Math.abs(o.x-e.x)+Math.abs(o.y-e.y)<=4).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    const beneficiary=ally||e;
    if(game.multiplayer)sendMpAction('enemy_heal',{enemyId:e.eid,targetType:'enemy',targetId:beneficiary.eid,visualAmount:Math.round(amount*.9)});
    healEntity(beneficiary,Math.round(amount*.9),beneficiary.x,beneficiary.y);floating('✚',beneficiary.x,beneficiary.y,'#8dffa8');
    log(`${e.name} usa ${s.name} y cura a ${beneficiary===e?'sí mismo':beneficiary.name}.`,'combat');
   }
   else if(s.classEffect==='shield'||s.classEffect==='buff'||s.type==='utility'){if(game.multiplayer)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},icon:'✦'});healEntity(e,Math.round(amount*.9),e.x,e.y);floating('✦',e.x,e.y,'#76e0ff');log(`${e.name} usa ${s.name} y se refuerza.`,'combat')}
   else if(target===game.player){if(game.multiplayer)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},target:{x:game.player.x,y:game.player.y},icon:s.icon||'✦'});damagePlayer(amount,inferSkillDefenseStat(id),`${e.name} usa ${s.name}`);floating(s.icon||'✦',e.x,e.y,'#e68cff')}
   else{const ref=mpEntityRef(target);if(game.multiplayer&&ref)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},target:{x:target.x,y:target.y},targetType:ref.type,targetId:ref.id,visualAmount:amount,icon:s.icon||'✦'});target.hp-=amount;floating(`-${amount}`,target.x,target.y,'#ff8888');log(`${e.name} usa ${s.name} contra ${target.name} por ${amount}.`,'combat')}
   e.skillCooldowns[id]=Math.max(2,s.cd||5);return true
  }
 }
 return false
}

function scaleEnemy(e){
 const d=difficultyScale();
 e.maxHp=e.hp=Math.round((e.maxHp||e.hp)*d.hp*worldLifeMultiplier()*ENEMY_HP_BASE_MULT);
 e.damage=Math.max(1,Math.round(e.damage*d.damage));
 e.xp=Math.round((e.xp||5)*d.xp);
 if(!e.boss&&Math.random()<d.eliteChance){
  e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.55);e.damage=Math.round(e.damage*1.3);e.xp=Math.round(e.xp*1.8);
 }
 return assignEnemySkills(equipEnemy(e));
}


function floorNarratives(){
 if(game.floor===1)return levelOneNarratives;
 if(game.floor===2)return levelTwoNarratives;
 if(game.floor===3)return levelThreeNarratives;
 return levelFourNarratives;
}
function showFloorNarrative(){
 const t=currentFloorTheme(),n=pick(floorNarratives());
 storyTitle.textContent=`NIVEL ${game.floor} — ${n.title}`;
 storyBody.innerHTML=`<div class="narrative"><p>${n.text}</p><p><b>${t.name}</b>: ${t.story}</p><p><b>Objetivo:</b> explora, sobrevive y encuentra la salida.</p><div class="startActions"><button id="continueFloorStory">Entrar</button></div></div>`;
 storyOverlay.classList.remove('hidden');
 setTimeout(()=>document.getElementById('continueFloorStory')?.addEventListener('click',()=>storyOverlay.classList.add('hidden')),0)
}


function roomCellSet(room){
 const set=new Set();for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)set.add(key(x,y));return set
}
function isSafeCell(x,y){return(game.safeRooms||[]).some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)}
function roomTypeAt(x,y){return (game.rooms||[]).find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)?.type||null}
function safeRoomAt(x,y){return(game.safeRooms||[]).find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)}
function campAtPlayer(){return(game.safeRooms||[]).find(r=>r.cx===game.player.x&&r.cy===game.player.y)}
function restInSafeRoom(){
 const room=campAtPlayer();
 if(!room){log('Debes situarte junto al fuego de una sala segura.','sys');return}
 if(room.rested){log('Ya has descansado en esta sala segura.','sys');return}
 const p=game.player,before={hp:p.hp,stamina:p.stamina,mana:p.mana};
 p.hp=p.maxHp;p.stamina=p.maxStamina;p.mana=p.maxMana;
 room.rested=true;
 updateUI();draw();banner('DESCANSO COMPLETO');
 log(`Descansas junto al fuego: +${p.hp-before.hp} vida, +${p.stamina-before.stamina} stamina y +${p.mana-before.mana} maná.`,'good')
}
function updateRestButton(){
 const btn=document.getElementById('waitBtn');if(!btn)return;
 const room=campAtPlayer();
 if(room){btn.textContent=room.rested?'DESCANSADO':'DESCANSAR';btn.disabled=!!room.rested;btn.dataset.rest='1'}
 else if(apModeOn()){if(game.player.ap==null)startPlayerAP();btn.textContent=`PASAR TURNO (${game.player.ap} PA)`;btn.disabled=!!(game.multiplayer&&!game.myTurn);delete btn.dataset.rest}
 else{btn.textContent='ESPERAR';btn.disabled=false;delete btn.dataset.rest}
}

function generateFloor(){if(loadPrecomputedFloor())return;game.floorEventRolled=false;game.activeEvent=null;if(game?.player){recomputeDerived();if(game.player.raceBonuses?.floorHeal)healEntity(game.player,game.player.raceBonuses.floorHeal);game.player.secondLifeReady=true;game.player.shield=(game.player.shield||0)+(game.player.derived?.floorShield||0)}
 busy=false;
 const params=worldParams();
 const populationScale=1+Math.min(1.2,((game.player?.level||1)-1)*.012);
 game.recentArchetypes=(game.recentArchetypes||[]).slice(-8);
 let plan=null;
 for(let attempt=0;attempt<3&&!plan;attempt++)plan=buildFloorPlan(game.floor,params,{recent:game.recentArchetypes,populationScale});
 if(!plan){log('No se pudo generar el piso; reintentando con el diseño estándar.','sys');plan=buildFloorPlan(game.floor,params,{recent:['superboss','bossrush'],populationScale})}
 if(!plan)return;
 game.recentArchetypes.push(plan.archetype);
 Object.assign(game,{
  map:plan.map,rooms:plan.rooms,safeRooms:plan.safeRooms,stairs:plan.stairs,doors:plan.doors,keys:plan.keys,
  chests:plan.chests,traps:plan.traps,altars:plan.altars,enemies:plan.enemies,enemyFamily:plan.enemyFamily,
  floorTileset:plan.floorTileset,seen:Array.from({length:ROWS},()=>Array(COLS).fill(false)),boss:plan.boss,
  floorArchetype:plan.archetype,floorArchetypeLabel:plan.archetypeLabel,floorArchetypeDesc:plan.archetypeDesc,
  objective:plan.objective,rewardRarityBonus:plan.rewardRarityBonus,precomputedEvent:plan.event||null,partyScaled:0
 });
 game.player.x=plan.spawn.x;game.player.y=plan.spawn.y;anim.heroX=anim.targetX=plan.spawn.x;anim.heroY=anim.targetY=plan.spawn.y;anim.t=1;reveal(plan.spawn.x,plan.spawn.y);
 const extra=difficultyScale().count;
 for(let i=0;i<extra;i++){const room=pick(game.rooms||[]);if(room){const exPos={x:room.x+rng(Math.max(1,room.w)),y:room.y+rng(Math.max(1,room.h))};if(game.map[exPos.y]?.[exPos.x]===0&&!isSafeCell(exPos.x,exPos.y)){const ex=buildConfiguredEnemy(weightedFamilyEnemy(plan.family,false,game.floor,worldParams().floors||10),exPos,game.floor,false);ex.enemyFamily=plan.family.name;game.enemies.push(ex)}}}
 scaleFloorForParty();
 announceFloorArchetype();
 grantFloorRewardPopup();
 updateUI();draw();rollFloorEvent();
}

// Banner + log describing the archetype and how this floor is completed.
function announceFloorArchetype(){
 const label=game.floorArchetypeLabel||'Piso estándar';
 const obj=game.objective||{type:'stairs'};
 banner(`PISO ${game.floor} · ${label.toUpperCase()}`);
 log(`${label}: ${game.floorArchetypeDesc||''} Familia dominante: ${game.enemyFamily}. ${(game.enemies||[]).length} enemigos.`,'story');
 log(`Objetivo: ${objectiveText(obj)}`,'story');
 if(game.floorArchetype==='superboss')log('Un poder muy superior aguarda. Busca altares y prepárate antes de entrar en su sala.','combat');
}
// Highest rarity name unlocked for this floor - used to grant a guaranteed
// top-tier item when the player reaches a new floor (from floor 2 onward).
function topRarityNameForFloor(floor){
 const totalFloors=selectedDungeonWorld?.world_json?.lootTable?.length||worldParams().floors||DEFAULT_WORLD_PARAMS.floors;
 return LOOT_RARITY_ORDER[maxLootRarityIndexForProgress(floor,totalFloors,game?.player?.level||1)];
}
// Grants one guaranteed item at the floor's best available rarity and shows
// a dedicated floor-reward popup. Runs once per floor arrival, floor 2+.
function grantFloorRewardPopup(){
 if((game.floor||1)<2||!game?.player)return;
 const item=makeLoot(game.player.level,'floorReward',topRarityNameForFloor(game.floor));
 if(!item)return;
 addInventoryItem(item);
 const c=document.createElement('canvas');c.width=c.height=64;drawItemIcon(c,item);
 storyTitle.textContent=`RECOMPENSA DE PISO ${game.floor}`;
 storyBody.innerHTML=`<div class="narrative"><p>Al llegar al piso ${game.floor} recibes un objeto garantizado de la mejor calidad disponible en este piso.</p><div class="floorRewardItem" style="display:flex;align-items:center;gap:12px;margin:10px 0"><div class="floorRewardIcon"></div><div><b class="${item.rarity}">${item.name}</b><div class="small">${slotNames[item.slot]} · ${item.label} · Nv. ${item.itemLevel}</div><div class="itemScore">Poder ${item.score}</div></div></div><div class="startActions"><button id="continueFloorReward">Continuar</button></div></div>`;
 storyBody.querySelector('.floorRewardIcon')?.appendChild(c);
 storyOverlay.classList.remove('hidden');
 setTimeout(()=>document.getElementById('continueFloorReward')?.addEventListener('click',()=>storyOverlay.classList.add('hidden')),0);
}
function objectiveText(obj=game?.objective){
 if(!obj)return 'Encuentra la salida.';
 switch(obj.type){
  case 'survive':return `Sobrevive ${Math.max(0,(obj.turns||0)-(obj.elapsed||0))} turnos; después aparecerá la escalera.`;
  case 'timed':return `Encuentra la salida en ${Math.max(0,(obj.limit||0)-(obj.elapsed||0))} turnos.`;
  case 'waves':return `Supera ${obj.total||0} oleadas (${obj.done||0}/${obj.total||0}) para abrir la salida.`;
  case 'bossKill':return 'Derrota al jefe del piso para abrir la salida.';
  default:return 'Encuentra la salida.';
 }
}


const DEFENSE_STAT_LABELS={
 strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',
 luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'
};
// Explicit override by the weapon's own generic type (configWeaponTypes),
// set on every config-created weapon (item.weaponType) - checked before the
// flavor-name regex below so "basic attack" stat is deterministic by weapon
// type rather than dependent on whatever flavor name it happened to roll:
// daggers/claws/rifles/pistols use agility, shotguns use strength.
const WEAPON_TYPE_STAT={Dagas:'agility',Guanteletes:'agility',Rifles:'agility',Pistolas:'agility',Escopetas:'strength'};
function inferWeaponDefenseStat(item){
 if(item?.weaponType&&WEAPON_TYPE_STAT[item.weaponType])return WEAPON_TYPE_STAT[item.weaponType];
 const text=`${item?.name||''} ${item?.iconShape||''} ${item?.theme||''}`.toLowerCase();
 if(/(arco|ballesta|rifle|pistola|fusil|rail|bláster|blaster|cañón|canon|daga|dagger|spear|lanza|garra|claw)/.test(text))return'agility';
 if(/(bastón|baston|staff|orbe|orb|grimorio|book|rúnic|runic|mágic|magic)/.test(text))return'intelligence';
 if(/(sagrado|holy|tótem|totem|reliquia|relic|espíritu|spirit)/.test(text))return'wisdom';
 if(/(martillo|hammer|maza|mace|hacha|axe|yunque|escudo)/.test(text))return'vitality';
 return'strength'
}
function inferSkillDefenseStat(id){
 const s=skillDefs[id]||{},text=`${id} ${s.name||''} ${s.desc||''}`.toLowerCase();
 if(s.defenseStat)return s.defenseStat;
 if(/(caos|azar|fortuna|bufón|jester|quantum|cuántic|entrop)/.test(text))return'luck';
 if(/(miedo|mente|alma|espíritu|spirit|sagrado|holy|necrom|cadáver|corpus|sombra|shadow|vacío|void|taunt|insulto)/.test(text))return'wisdom';
 if(/(arcano|mana|runa|rúnic|fuego|hielo|rayo|chispa|tormenta|gravedad|alquim|tecn|circuit|data|nulo|null)/.test(text)||s.resource==='mana')return'intelligence';
 if(/(veneno|tóxic|ácido|sangre|óxido|nube|onda|terremoto|quake|explos|granada|nova)/.test(text))return'vitality';
 if(/(disparo|tiro|flecha|proyectil|rifle|pistola|gancho|trampa|paso|blink|embestida|charge|tajo|execute)/.test(text)||isRangedSkill(id))return'agility';
 return'strength'
}
function ensureAttackDefenseMetadata(){
 for(const [id,s] of Object.entries(skillDefs))s.defenseStat=s.defenseStat||inferSkillDefenseStat(id);
 for(const item of game?.inventory||[])item.defenseStat=item.defenseStat||inferWeaponDefenseStat(item);
 for(const item of Object.values(game?.player?.equipment||{}))if(item)item.defenseStat=item.defenseStat||inferWeaponDefenseStat(item)
}
function attackDefenseLabel(stat){return DEFENSE_STAT_LABELS[stat]||'Agilidad'}
function enemyDefenseScore(e,stat){
 const floor=game.floor||1,elite=e.elite?2:0,boss=e.boss?4:0;
 const archetype={
  strength:/orc|golem|knight|abomin|tyrant/i.test(e.type||'')?3:0,
  vitality:/golem|mummy|beast|orc|abomin|tyrant/i.test(e.type||'')?3:0,
  agility:/goblin|wolf|hound|thief|imp|vamp/i.test(e.type||'')?3:0,
  luck:/jester|error|quantum|goblin/i.test(e.type||'')?2:0,
  intelligence:/mage|lich|clerk|wraith|priest|shaman|archiv/i.test(e.type||'')?3:0,
  wisdom:/lich|undead|mummy|wraith|priest|shaman|vamp/i.test(e.type||'')?3:0
 }[stat]||0;
 let score=Math.floor(floor*.65)+elite+boss+archetype;
 if(enemyHasStatus(e,'armorBreak'))score-=4;
 if(enemyHasStatus(e,'wither'))score-=3;
 return score
}
function playerDefenseBonus(stat){
 const p=game.player,s=p.derived?.finalStats||p.stats,armorValue=Math.max(0,total('armor'));
 const base=Math.floor((s[stat]||0)*.85);
 // Fuerza y Vitalidad conservan doble conversión de armadura: es intencional para que las builds tanque tengan una identidad defensiva clara.
 const armorPart=['strength','vitality'].includes(stat)?Math.floor(armorValue/3):Math.floor(armorValue/6);
 return base+armorPart
}
function resolveEnemyDefense(e,stat,attackPower){
 const die=rollDie(20),bonus=enemyDefenseScore(e,stat),dc=10+Math.max(1,Math.floor(attackPower*.75));
 let mult=1,result=`no supera la defensa de ${attackDefenseLabel(stat)}`;
 if(die===20){mult=0;result=`evita el ataque con ${attackDefenseLabel(stat)}`}
 else if(die+bonus>=dc){mult=.5;result=`resiste parcialmente con ${attackDefenseLabel(stat)}`}
 else if(die===1){mult=1.25;result=`falla críticamente su defensa de ${attackDefenseLabel(stat)}`}
 return{die,bonus,dc,mult,result}
}

function rollDie(sides){return 1+rng(Math.max(1,sides))}
function parseDice(expr){
 const m=String(expr||'1d4').replace(/\s+/g,'').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
 return m?{count:Number(m[1]),sides:Number(m[2]),bonus:Number(m[3]||0)}:{count:1,sides:4,bonus:0}
}
function rollDice(expr){
 const d=parseDice(expr),rolls=[];for(let i=0;i<d.count;i++)rolls.push(rollDie(d.sides));
 return{expr,total:rolls.reduce((a,b)=>a+b,0)+d.bonus,rolls,bonus:d.bonus}
}
function baseAttackDice(){
 const w=equippedWeapon(),r=weaponRange(w);
 if(!w)return'1d4';
 if(w.damageDice)return w.damageDice;
 if(r>=9)return'1d10';
 if(r>=7)return'1d8+1';
 if(r>=3)return'1d8';
 const text=`${w.name||''} ${w.iconShape||''}`.toLowerCase();
 if(/(martillo|hammer|hacha|axe|maza|mace)/.test(text))return'1d10';
 if(/(espada|sword|blade)/.test(text))return'1d8';
 if(/(daga|dagger)/.test(text))return'1d6+1';
 return'1d6'
}
function statValueFor(actor,statKey){const st=actor?.derived?.finalStats||actor?.stats||{};return st[statKey]||0}
function skillDiceExpr(id){
 const d=skillDefs[id]||{},tier=d.tier||({common:1,uncommon:1,rare:2,epic:3,legendary:3}[d.rarity]||1);
 if(d.dmgDice>0)return `${d.dmgDice}d${d.dmgDie||6}`;
 if(d.type==='utility'||['buff','shield','heal','utility'].includes(d.classEffect))return null;
 if(d.classEffect==='massive'||id==='blackSun'||id==='worldBreaker')return tier>=3?'5d8+6':tier===2?'4d8+4':'3d8+4';
 if(d.classEffect==='ultimate')return tier>=3?'5d6+3':tier===2?'4d6':'3d6+3';
 if(['aoe','multihit'].includes(d.classEffect)||AREA_SKILLS.has(id))return tier>=3?'4d6+4':tier===2?'3d6+3':'2d6+3';
 if(d.classEffect==='execute'||id==='execute')return tier>=3?'3d10+5':tier===2?'3d8+1':'2d8+3';
 if(d.resource==='mana')return tier>=3?'4d8':tier===2?'3d8':'2d8+1';
 return tier>=3?'4d8':tier===2?'3d8':'2d8+1'
}
function damageStatForType(type,resource){if(type==='magic'||resource==='mana')return'intelligence';if(type==='physical'||resource==='stamina')return'strength';return'luck'}
function actorStatDamageBonus(actor,type='physical',resource='stamina'){const st=actor?.derived?.finalStats||actor?.stats||{};const primary=damageStatForType(type,resource),secondary=primary==='intelligence'?'wisdom':primary==='strength'?'agility':'wisdom';return Math.floor(((st[primary]||0)*2+(st[secondary]||0))/3)}
function skillStatModifier(id,actor=game.player){
 const d=skillDefs[id]||{};
 if(d.dmgStat&&d.dmgStatMode!=='mult')return Math.round(statValueFor(actor,d.dmgStat)*(d.dmgStatCoef??1));
 return actorStatDamageBonus(actor,d.type,d.resource)
}
function skillStatMultiplier(id,actor=game.player){
 const d=skillDefs[id]||{};
 if(d.dmgStat&&d.dmgStatMode==='mult')return 1+statValueFor(actor,d.dmgStat)*(d.dmgStatCoef??.02);
 return 1
}
// Per-tick DOT power, generalized over any object carrying dotDice/dotDie/
// dotStat/dotStatMode/dotStatCoef - a full skillDefs entry (legacy single-
// effect skills) or a single effect component (composable skills). Rolls
// once at application time (the roll then holds for the status' whole
// duration); objects without dot fields keep the caller's hand-tuned
// level-scaled fallback.
function dotPowerFor(defLike,fallback,actor=game.player){
 const d=defLike||{};
 if(!(d.dotDice>0))return fallback;
 const roll=rollDice(`${d.dotDice}d${d.dotDie||6}`).total;
 const statVal=d.dotStat?statValueFor(actor,d.dotStat):0;
 const contribution=d.dotStatMode==='mult'?roll*(statVal*(d.dotStatCoef??.02)):statVal*(d.dotStatCoef??1);
 return Math.max(1,Math.round(roll+contribution))
}
function skillDotPower(id,fallback,actor=game.player){return dotPowerFor(skillDefs[id],fallback,actor)}
// Unified dice+stat scalar, generalized over any object carrying dmgDice/
// dmgDie/dmgStat/dmgStatMode/dmgStatCoef - a full skillDefs entry or a
// single effect component. `fallback` is the level-scaled formula used when
// no dice are configured.
function dicePowerFor(defLike,fallback,actor=game.player){
 const d=defLike||{};
 if(d.dmgDice>0){
  const roll=rollDice(`${d.dmgDice}d${d.dmgDie||6}`).total;
  const statVal=d.dmgStat?statValueFor(actor,d.dmgStat):0;
  const contribution=d.dmgStatMode==='mult'?roll*(statVal*(d.dmgStatCoef??.02)):statVal*(d.dmgStatCoef??1);
  return Math.max(1,Math.round(roll+contribution))
 }
 return fallback
}
// Unified "scalar power" used by self-cast classEffect skills (ranged/dash/
// aoe/multihit/ultimate/execute/massive pass it as attack()'s flat bonus;
// heal/shield use it directly as their magnitude) so every one of those
// effects is configurable through the same dice+stat fields as direct hits.
function resolveSkillPower(id,actor=game.player){
 const d=skillDefs[id]||{},lvl=skillLevel(id),power=skillPowerMultiplier(id);
 const fallback=Math.round((8+lvl*3+(d.resource==='mana'?statValueFor(actor,'intelligence')+statValueFor(actor,'wisdom')/2:statValueFor(actor,'strength')+statValueFor(actor,'agility')/3)));
 return Math.round(dicePowerFor(d,fallback,actor)*power)
}
function activeBuffDamageMultiplier(){
 return activeBuffMultFactor('damage')*(game.player.activePotions||[]).reduce((m,b)=>m*(1+((b.effect?.damageMult||0))),1)
}
function diceDamageLabel(id){
 const expr=skillDiceExpr(id),d=skillDefs[id]||{};
 if(!expr)return'Sin daño';
 if(d.dmgStat)return`${expr} ${d.dmgStatMode==='mult'?'× (stat) ':'+ '}${{strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'}[d.dmgStat]||d.dmgStat}`;
 return `${expr} + atributo`
}

function total(stat){let v=stat==='damage'?game.player.baseDamage:stat==='armor'?game.player.baseArmor:0;for(const item of Object.values(game.player.equipment))if(item?.stat===stat)v+=item.power;if(stat==='armor')v+=game.player.shield;if(stat==='maxHp')v=game.player.maxHp;if(stat==='armor'||stat==='damage')v=Math.round(v*activeBuffMultFactor(stat)+activeBuffFlatBonus(stat));return v}
function critChance(){return Math.min(.38,.04+game.player.stats.luck*.015)}
function attack(e,bonus=0,options={}){
 const skillId=options.skillId||null,expr=options.dice||skillDiceExpr(skillId)||baseAttackDice();
 const roll=rollDice(expr);
 const statMod=skillId?skillStatModifier(skillId):Math.max(0,Math.floor(total('damage')*.45));
 const statMultFactor=skillId?skillStatMultiplier(skillId):1;
 const defenseStat=options.defenseStat||(skillId?inferSkillDefenseStat(skillId):inferWeaponDefenseStat(equippedWeapon()));
 const markMult=1+((e.statuses||[]).find(s=>s.type==='mark'&&s.turns>0)?.power||0);
 let raw=Math.max(1,Math.round((roll.total+statMod+Math.max(0,bonus)*.35+activeBuffFlatBonus('damage'))*statMultFactor*(options.multiplier||1)*(game.player.nextSkillMultiplier||1)*activeBuffDamageMultiplier()*damageDealtMultiplier()*markMult));
 if(skillId&&game.player.nextSkillMultiplier)game.player.nextSkillMultiplier=1;
 const defense=resolveEnemyDefense(e,defenseStat,raw);
 let d=Math.max(defense.mult===0?0:1,Math.round(raw*defense.mult));
 const crit=Math.random()<critChance();if(crit&&d>0)d=Math.round(d*1.75);
 if(game?.multiplayer){mpEnsureEnemyIds();sendMpAction(isRangedSkill(skillId)||weaponIsRanged(equippedWeapon())?'ranged_attack':'attack',{attackerType:'player',attackerId:game.pjId,targetType:'enemy',targetId:e.eid,visualAmount:d,result:crit?'critical':d?'hit':'evaded'})}
 const origin=options.origin||game.player;
 if(Math.max(Math.abs(origin.x-e.x),Math.abs(origin.y-e.y))>1)rangedTracer(origin.x,origin.y,e.x,e.y,crit?'#ffd75c':'#9be8ff');
 e.hp-=d;floating(d?`${crit?'CRIT ':''}-${d}`:'EVITA',e.x,e.y,d?(crit?'#ffd75c':'#fff'):'#70dc9b');effect('flash');
 log(`${e.name}: ${defense.result}. Tirada 1d20 (${defense.die}) + ${defense.bonus} contra CD ${defense.dc}. ${d?`Recibe ${d}${crit?' crítico':''}`:'No recibe daño'} [${expr}: ${roll.rolls.join('+')}${roll.bonus?`${roll.bonus>0?'+':''}${roll.bonus}`:''}; ataque +${statMod}].`,'combat');
 if(e.hp<=0)kill(e)
}
function kill(e){
 if(game?.multiplayer)sendMpAction('death_animation',{entityType:'enemy',entityId:e.eid,at:{x:e.x,y:e.y}});
 game.enemies=game.enemies.filter(x=>x!==e);gainXp(e.boss?60:8+Math.floor(game.floor/2),`xp_${game.floor}_${e.eid}`);game.player.gold+=e.boss?75:3+rng(6);
 const killLootChance=Math.min(.9,(.13+(game.player.derived?.finalStats?.luck??game.player.stats.luck)*.008)*pctMult(worldParams().enemyLootPct));
 if(Math.random()<killLootChance||e.boss||e.eventBoss){const item=makeLoot(game.player.level+(e.boss?3:0),e.eventBoss?'eventBoss':e.boss?'boss':e.elite?'elite':'normal');addInventoryItem(item);lootToast(item)}if(e.skills?.length&&Math.random()<(e.boss?.38:e.elite?.18:.055)){const drop=pick(e.skills.filter(id=>!game.player.knownSkills.includes(id)));if(drop)unlockSkillLoot(drop)}else if(e.boss||e.eventBoss||Math.random()<.018)unlockSkillLoot(randomLootableSkill())
 log(`${e.name} ha sido eliminado.`,'good');
 if(e.boss){game.bossesKilled++;unlock('firstBoss','Rey de nada','Derrota al primer jefe.');learnSkill('ironRain');banner('JEFE DERROTADO · HABILIDAD DESBLOQUEADA')}
}
function damagePlayer(amount,defenseStat='vitality',sourceName='Ataque enemigo',options={}){
 const originalAmount=amount;
 amount=normalizeIncomingDamage(amount,sourceName);
 const p=game.player;
 const defenseDie=rollDie(20),defenseBonus=playerDefenseBonus(defenseStat);
 const attackDC=10+Math.max(1,Math.round(amount*.75));
 let mult=1,result=`fallo defensivo de ${attackDefenseLabel(defenseStat)}`;
 if(defenseDie===20){mult=0;result=`evasión perfecta con ${attackDefenseLabel(defenseStat)}`}
 else if(defenseDie+defenseBonus>=attackDC){mult=.5;result=`defensa de ${attackDefenseLabel(defenseStat)} superada`}
 else if(defenseDie===1){mult=1.25;result=`pifia en ${attackDefenseLabel(defenseStat)}`}
 if((p.activePotions||[]).some(b=>b.effect?.invulnerable)){mult=0;result='invulnerabilidad activa'}
 let d=Math.max(mult===0?0:1,Math.round(amount*mult));
 const blockChance=Math.min(.75,(p.derived?.blockChance||0)/100);
 const blocked=mult>0&&d>0&&Math.random()<blockChance;
 if(blocked){d=0;result=`${result} · bloqueado con el escudo`}
 let finalDamage=d;
 const lifeBuff=(p.activeBuffs||[]).find(b=>b.effects?.lifesteal);
 if(lifeBuff&&options?.skillId)healEntity(p,Math.max(1,Math.round(finalDamage*lifeBuff.effects.lifesteal)));
 if(p.counterReady&&d>0){p.counterReady.turns--;const attacker=(game.enemies||[]).filter(e=>e.hp>0).sort((a,b)=>gridDistance(p,a)-gridDistance(p,b))[0];if(attacker)attack(attacker,0,{dice:p.counterReady.damage,multiplier:.8});p.counterReady=null}
 p.hp-=d;
 if(p.hp<=0&&p.cheatDeathTurns>0){p.hp=1;p.cheatDeathTurns=0;banner('TE NIEGAS A MORIR');log('La habilidad evita la muerte y te deja con 1 de vida.','good')}
 floating(d?`-${d}`:'EVITA',p.x,p.y,d?'#ff6666':'#70dc9b');effect(d?'shake':'flash');
 log(`${sourceName}: ${result}. 1d20 (${defenseDie}) + ${defenseBonus} contra CD ${attackDC}. ${d?`Recibes ${d} de daño.`:'No recibes daño.'} [base ${Math.round(originalAmount)} → ${amount}]`,'combat');
 if(p.hp<=0){p.hp=0;game.over=true;updateUI();draw();permanentDeath()}
}

const statDescriptions={strength:'Aumenta daño físico y la stamina máxima.',vitality:'Aumenta vida y resistencia.',agility:'Aumenta evasión, movilidad y los Puntos de Acción (PA).',luck:'Mejora el % de crítico, botín y eventos.',intelligence:'Aumenta poder mágico y aporta algo de maná extra.',wisdom:'Aumenta el maná máximo y mejora regeneración y percepción.'};
function queueStatPoint(level){
 const p=game.player;p.unspentStatPoints=(p.unspentStatPoints||0)+1;p.pendingLevelUpRewards=p.pendingLevelUpRewards||[];
 const skillId=LEVEL_UP_RANDOM_SKILL_LEVELS.has(level)?randomClassSkillForLevelReward(level):null;
 p.pendingLevelUpRewards.push({level,skillId});
 showStatPointModal()
}
function showStatPointModal(){
 const p=game.player;if(!p?.unspentStatPoints)return;
 const modal=document.getElementById('statPointModal'),grid=document.getElementById('statChoiceGrid'),title=document.getElementById('statPointTitle'),text=document.getElementById('statPointText'),skill=document.getElementById('statPointSkillReward'),labels={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'};
 if(!modal||!grid)return;
 p.pendingLevelUpRewards=p.pendingLevelUpRewards||[];const reward=p.pendingLevelUpRewards[0]||{};
 if(title)title.textContent=`SUBIDA DE NIVEL${reward.level?` · NIVEL ${reward.level}`:''}`;
 if(text)text.textContent='Distribuye 1 punto en una stat principal para consolidar la subida.';
 if(skill)skill.innerHTML=reward.skillId?levelRewardLabel(reward.level,reward.skillId):'';
 grid.innerHTML=Object.keys(labels).map(k=>`<button type="button" class="statChoice" data-stat-choice="${k}"><b>${labels[k]}: ${p.stats[k]}</b><span>${statDescriptions[k]}</span></button>`).join('');modal.classList.add('open');
 grid.querySelectorAll('[data-stat-choice]').forEach(btn=>btn.addEventListener('click',()=>{const stat=btn.dataset.statChoice,reward=(p.pendingLevelUpRewards||[]).shift()||{};p.stats[stat]=(p.stats[stat]||0)+1;p.unspentStatPoints--;if(reward.skillId)learnSkill(reward.skillId);recomputeDerived();updateUI();draw();banner(`+1 ${labels[stat].toUpperCase()}`);log(`Asignas 1 punto a ${labels[stat]}.`,'good');if(reward.skillId)log(`Recompensa aleatoria de nivel ${reward.level}: ${skillDefs[reward.skillId].name}.`,'loot');if(p.unspentStatPoints>0)showStatPointModal();else{modal.classList.remove('open');queueMissingClassSkillChoices();processClassSkillChoices();if(game.pendingPlayerFinished&&!document.getElementById('skillChoiceModal')?.classList.contains('open')){game.pendingPlayerFinished=false;playerFinished()}}}))
}
// Living participants in the run (1 in single player).
function partySize(){
 if(!game?.multiplayer)return 1;
 const ids=(game.turnOrder&&game.turnOrder.length)?game.turnOrder:[game.pjId];
 return Math.max(1,ids.length);
}
// Enemy hp scales +25% per additional player, applied once per floor build so
// the shared snapshot carries the already-scaled values to every client.
function partyHpMultiplier(n=partySize()){return 1+.25*Math.max(0,n-1)}
function scaleFloorForParty(){
 if(!game?.multiplayer)return;
 const mult=partyHpMultiplier();
 if(mult<=1||game.partyScaled===mult)return;
 for(const e of game.enemies||[]){
  if(e.partyScaled)continue;
  e.maxHp=Math.max(1,Math.round((e.maxHp||e.hp||1)*mult));
  e.hp=Math.max(1,Math.round((e.hp||e.maxHp)*mult));
  e.partyScaled=true;
 }
 game.partyScaled=mult;
}
// Enemy level/stats baked into a precomputed floor come from a synthetic
// level-1 preview character (see createDungeonWorldJson) and may also just
// be stale if the player's level has changed since this floor was last
// generated. Rescale every enemy (including superboss tier-bonus variants,
// whose extra bump is preserved since this scales whatever they already
// have rather than rebuilding from scratch) proportionally to a fresh
// target level anchored on the player's CURRENT level, every time the
// floor is (re)loaded - for brand new runs and existing/continued sessions alike.
function scaleFloorForPlayerLevel(){
 // multiplayer keeps enemies as a single shared/authoritative snapshot across
 // party members (see partyHpMultiplier) - rescaling per-viewer here would
 // desync combat between players at different levels, so this only applies
 // to single player, where "the player" is unambiguous.
 if(game?.multiplayer||!game?.player||!(game.enemies?.length||game.boss))return;
 const rescale=e=>{
  if(!e||e.level==null)return;
  const targetLevel=enemyLevelForFloor(game.floor),oldLevel=e.level;
  if(targetLevel===oldLevel)return;
  const hpRatio=(1+targetLevel*.13)/(1+oldLevel*.13),atkRatio=(1+targetLevel*.08)/(1+oldLevel*.08);
  e.maxHp=Math.max(1,Math.round((e.maxHp||e.hp||1)*hpRatio));
  e.hp=Math.max(1,Math.round((e.hp||e.maxHp)*hpRatio));
  e.atk=Math.max(1,Math.round((e.atk||e.damage||4)*atkRatio));
  e.damage=e.atk;
  e.armor=Math.max(0,Math.round((e.armor||0)*hpRatio));
  e.xp=Math.max(1,Math.round((e.xp||8)*hpRatio));
  e.level=targetLevel;
 };
 for(const e of game.enemies||[])rescale(e);
 rescale(game.boss);
}
function grantXp(v){
 const p=game.player;if(p.level>=LEVEL_CAP)return;
 v=Math.ceil(v*(p.raceBonuses?.xpMult||1)*xpReceivedMultiplier());p.xp+=v;
 while(p.level<LEVEL_CAP&&p.xp>=p.nextXp){
  p.xp-=p.nextXp;p.level++;
  const g=levelGrowth(p.level);
  p.nextXp=p.level<LEVEL_CAP?xpNeededForLevel(p.level):0;
  p.maxHp+=g.hp+p.stats.vitality;p.hp=p.maxHp;
  p.maxStamina+=g.stamina+Math.floor(p.stats.strength/3);p.stamina=p.maxStamina;
  p.maxMana+=g.mana+Math.floor((p.stats.wisdom*2+p.stats.intelligence)/3);p.mana=p.maxMana;
  p.baseDamage+=g.damage;p.baseArmor+=g.armor;
  if(p.level%10===0){p.stats.strength++;p.stats.vitality++;p.stats.agility++;p.stats.luck++;p.stats.intelligence++;p.stats.wisdom++}
  banner(`NIVEL ${p.level}`);queueStatPoint(p.level);
 }
 if(p.level>=LEVEL_CAP){p.level=LEVEL_CAP;p.xp=0;p.nextXp=0;banner('NIVEL MÁXIMO 100')}
}
function gainXp(v,id){
 // multiplayer: experience from a kill is split and shared with every party member
 const share=v/partySize();
 grantXp(share);
 if(game?.multiplayer&&id)sendMpAction('xp_share',{id,amount:share});
}
function learnSkill(id){if(!skillDefs[id]||game.player.knownSkills.includes(id))return;game.player.knownSkills.push(id);game.player.skillProgress=game.player.skillProgress||{};game.player.skillProgress[id]={level:1,xp:0,uses:0};const free=game.player.equippedSkills.findIndex(x=>!x);if(free>=0)game.player.equippedSkills[free]=id;log(`Nueva habilidad: ${skillDefs[id].name}.`,'loot')}
function unlock(id,title,desc){if(game.achievements[id])return;game.achievements[id]={title,desc};log(`LOGRO: ${title}`,'loot');if(id==='crowd')learnSkill('taunt');if(id==='chest5')learnSkill('lootMagnet')}

function blocked(x,y){const d=game.doors.find(d=>d.x===x&&d.y===y);return game.map[y]?.[x]!==0||(d&&!d.open)}
function move(dx,dy){
 if(!game||busy||game.over)return;const p=game.player,nx=p.x+dx,ny=p.y+dy,d=game.doors.find(d=>d.x===nx&&d.y===ny);
 if(dx)p.facing=dx>0?1:-1;
 if(d&&!d.open){if(d.locked&&p.keys<=0){log('Puerta cerrada: necesitas llave.','sys');return}if(!apCan('move'))return;if(d.locked)p.keys--;d.open=true;sendMpAction('open_door',{at:{x:nx,y:ny}});log('Abres una puerta.','sys');actionDone('move');return}
 if(blocked(nx,ny))return;
 const e=game.enemies.find(e=>e.x===nx&&e.y===ny);
 if(e){if(!apCan('attack'))return;attack(e);actionDone('attack');return}
 if(!apCan('move'))return;
 const from={x:p.x,y:p.y};sendMpAction('move',{entityType:'player',entityId:game.pjId,from,to:{x:nx,y:ny},direction:dx||dy});anim.heroX=p.x;anim.heroY=p.y;p.x=nx;p.y=ny;anim.targetX=nx;anim.targetY=ny;anim.t=0;reveal(nx,ny);checkTile();
 actionDone('move');
}
function checkTile(){
 const p=game.player,k=game.keys.find(k=>k.x===p.x&&k.y===p.y);if(k){game.keys=game.keys.filter(x=>x!==k);p.keys++;if(game.multiplayer)sendMpAction('pickup',{at:{x:p.x,y:p.y},icon:'🔑'});log('Recoges una llave.','loot')}
 detectNearbyTraps();
 const trap=(game.traps||[]).find(t=>!t.sprung&&t.x===p.x&&t.y===p.y);if(trap)springTrap(trap);
 const altar=(game.altars||[]).find(a=>!a.used&&a.x===p.x&&a.y===p.y);if(altar)useAltar(altar);
 const c=game.chests.find(c=>!c.opened&&c.x===p.x&&c.y===p.y);if(c)openChest(c);
 if(p.x===game.stairs.x&&p.y===game.stairs.y){
  const block=stairsBlockedReason();
  if(block){log(block,'combat');return}
  if(game.multiplayer)sendMpAction('floor_transition_start',{});
  game.floor++;generateFloor();
 }
}
// Why the exit is sealed, or null when the player may descend.
function stairsBlockedReason(){
 const obj=game.objective||{type:'stairs'};
 if(game.boss&&game.enemies.includes(game.boss)&&(obj.type==='bossKill'||obj.type==='stairs'))return 'La salida está sellada mientras el jefe siga vivo.';
 if(obj.type==='survive'&&!obj.done)return `Todavía no hay salida. Aguanta ${Math.max(0,(obj.turns||0)-(obj.elapsed||0))} turnos más.`;
 if(obj.type==='waves'&&(obj.done||0)<(obj.total||0))return `La salida sigue sellada: quedan ${(obj.total||0)-(obj.done||0)} oleada(s).`;
 return null;
}
// Runs once per completed round (single player and the multiplayer enemy phase).
function tickFloorObjective(){
 const obj=game?.objective;if(!obj||game.over)return;
 if(obj.type==='survive'&&!obj.done){
  obj.elapsed=(obj.elapsed||0)+1;
  // escalating threat while the exit is sealed
  if(obj.elapsed%3===0)spawnReinforcements(1+Math.floor(obj.elapsed/6));
  const left=(obj.turns||0)-obj.elapsed;
  if(left<=0){obj.done=true;banner('LA ESCALERA HA APARECIDO');log('Has resistido. La escalera de bajada se abre.','good')}
  else if(left<=3||left%5===0)log(`Aguanta: ${left} turno(s) restantes.`,'sys');
 }else if(obj.type==='timed'&&!obj.expired){
  obj.elapsed=(obj.elapsed||0)+1;
  const left=(obj.limit||0)-obj.elapsed;
  if(left<=0){
   obj.expired=true;
   banner('¡EL PISO SE DERRUMBA!');log('Se acabó el tiempo: el piso se vuelve hostil.','combat');
   spawnReinforcements(4,true);
  }else if(left<=5||left%10===0)log(`Tiempo restante: ${left} turno(s).`,'sys');
 }else if(obj.type==='timed'&&obj.expired){
  // past the limit the floor keeps punishing, but never insta-kills
  damagePlayer(Math.max(2,Math.round(game.floor*.8)),'vitality','El piso se derrumba');
  if((game.turn||0)%4===0)spawnReinforcements(1,true);
 }else if(obj.type==='waves'){
  const alive=(game.enemies||[]).filter(e=>e.hp>0&&e.waveTag).length;
  if(!obj.pending&&(obj.done||0)<(obj.total||0)&&alive===0){
   obj.done=(obj.done||0)+1;
   if(obj.done>=obj.total){banner('OLEADAS SUPERADAS');log('Has superado todas las oleadas. La salida se abre.','good')}
   else{spawnWave(obj.done);log(`Oleada ${obj.done+1} de ${obj.total}.`,'combat');banner(`OLEADA ${obj.done+1}/${obj.total}`)}
  }
 }
}
// Spawns near the player but never on top of anyone; capped to protect perf.
function spawnReinforcements(n,elite=false){
 if(!game?.enemies||game.enemies.length>110)return;
 const family=pickConfiguredFamilyForFloorWithParams(game.floor,worldParams());
 let added=0;
 for(let i=0;i<n*8&&added<n;i++){
  const dist=4+rng(6),ang=Math.random()*Math.PI*2;
  const x=Math.round(game.player.x+Math.cos(ang)*dist),y=Math.round(game.player.y+Math.sin(ang)*dist);
  if(game.map[y]?.[x]!==0||isSafeCell(x,y))continue;
  if((game.enemies||[]).some(e=>e.x===x&&e.y===y))continue;
  if(x===game.player.x&&y===game.player.y)continue;
  const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,game.floor,worldParams().floors||10),{x,y},game.floor,false);
  e.enemyFamily=family.name;e.waveTag=true;
  if(elite){e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.5);e.atk=e.damage=Math.round((e.atk||e.damage||4)*1.28);assignEnemySkills(e)}
  if(game.multiplayer){const m=partyHpMultiplier();if(m>1){e.maxHp=e.hp=Math.round(e.hp*m);e.partyScaled=true}}
  game.enemies.push(e);added++;
 }
 if(added)floating('¡REFUERZOS!',game.player.x,game.player.y,'#ff8b4f');
}
function spawnWave(index){
 const size=Math.min(14,5+index*2+Math.floor(game.floor/5));
 spawnReinforcements(size,index>0&&index%2===0);
}
// Agility/luck let you spot adjacent traps before stepping on them.
function detectNearbyTraps(){
 const p=game.player,st=p.derived?.finalStats||p.stats||{};
 const chance=Math.min(.85,.25+((st.agility||0)+(st.luck||0))*.03);
 for(const t of game.traps||[]){
  if(t.revealed||t.sprung)continue;
  if(Math.abs(t.x-p.x)<=1&&Math.abs(t.y-p.y)<=1&&Math.random()<chance){t.revealed=true;log('Detectas una trampa junto a ti.','sys')}
 }
}
function springTrap(t){
 t.sprung=true;t.revealed=true;
 if(game.multiplayer)sendMpAction('trigger_trap',{at:{x:t.x,y:t.y}});
 floating('¡TRAMPA!',t.x,t.y,'#ff9d4f');
 damagePlayer(t.dmg||6,'agility','Trampa oculta');
 log('Pisas una trampa oculta.','combat');
}
function useAltar(a){
 // the Creator's Room altar is a reusable utility (dismantle items into
 // shards), not a one-shot buff, so it never sets a.used and instead opens
 // the disenchant picker
 if(a.kind==='disenchant'){openCraftModal();return}
 a.used=true;
 if(game.multiplayer)sendMpAction('activate_altar',{at:{x:a.x,y:a.y}});
 const p=game.player;
 if(a.kind==='heal'){healEntity(p,Math.round(p.maxHp*.45));log('El altar restaura buena parte de tu vida.','good')}
 else if(a.kind==='shield'){p.shield=(p.shield||0)+Math.round(12+game.floor*1.5);log('El altar te envuelve en un escudo.','good')}
 else{applyBuff('altarPower','Bendición del altar',8,{damage:.22,armor:.12});log('El altar potencia tu daño y tu armadura.','good')}
 floating('✦',a.x,a.y,'#9be8ff');
}
// ---- Creator's Room: dismantle items into tier shards ----------------------
// Shards are keyed by item rarity (common/uncommon/rare/epic/legendary/
// artifact) and stored on game.player.shards, persisted to user_pj's own
// `shards` column (not inside pj_json) so they survive independently of the
// rest of the character bundle - see persistShards()/api/user-pj.js.
// Every item, regardless of tier/iLvl, breaks down into 10-20 shards of its
// own tier - a flat random range, not scaled by item power.
function shardsForItem(item){return 10+Math.floor(Math.random()*11)}
// Craft actions can fire several shard/item saves in quick succession
// (disenchant, create, upgrade tier, add/upgrade stat); plain fire-and-forget
// fetches can land out of order and let an earlier, stale write clobber a
// later one on the server, silently losing shards the player just earned.
// Chaining every save onto the previous one's promise keeps them in order.
// The shards column is stored as text server-side; api/user-pj.js parses it
// back into an object before responding, but this stays as a cheap defensive
// normalizer in case a stale/raw value ever slips through as a string.
function normalizeShards(v){
 if(v&&typeof v==='object')return v;
 if(typeof v==='string'){try{const p=JSON.parse(v||'{}');return p&&typeof p==='object'?p:{}}catch{return {}}}
 return {};
}
let shardsPersistChain=Promise.resolve();
function persistShards(){
 if(!game?.pjId){log('No se pueden guardar los shards: no hay personaje activo.','sys');return}
 const id=game.pjId,payload=JSON.stringify({shards:game.player.shards||{}});
 shardsPersistChain=shardsPersistChain.then(()=>fetch(`/api/user-pj?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:payload}))
  .then(async r=>{if(!r.ok){const d=await r.json().catch(()=>({}));log(`No se pudieron guardar los shards en el servidor: ${d.error||d.message||r.status}`,'sys');console.error('persistShards falló',d)}})
  .catch(e=>{log('No se pudieron guardar los shards (sin conexión con el servidor).','sys');console.error('No se pudieron guardar los shards',e)});
}
// Disenchanting is not gated to the Creator's Room anymore - any equipment
// item in the backpack can be broken down into shards from the Mochila tab
// itself, from anywhere in the dungeon (see the inventory render in
// updateUI() and its "Deshacer" button wired to confirmDisenchantItem()).
function disenchantItem(item){
 const idx=(game.inventory||[]).indexOf(item);if(idx<0)return;
 const n=shardsForItem(item);
 game.player.shards=game.player.shards||{};
 game.player.shards[item.rarity]=(game.player.shards[item.rarity]||0)+n;
 game.inventory.splice(idx,1);
 log(`Deshecho ${item.name}: +${n} shard(s) de ${tierDefs[item.rarity]?.label||item.rarity}.`,'good');
 persistShards();
 renderCraftShardsSummary();
 updateUI();
}
function confirmDisenchantItem(id){
 const item=(game.inventory||[]).find(i=>i.id===id);if(!item)return;
 if(!confirm(`¿Deshacer "${item.name}" a cambio de 10-20 shards de ${tierDefs[item.rarity]?.label||item.rarity}? No se puede deshacer.`))return;
 disenchantItem(item);
}
// Opens the Creator's Room altar for the 4 actual crafting actions (create,
// upgrade tier, add stat, upgrade stat). Disenchanting lives outside it now.
function openCraftModal(){switchCraftTab('create');document.getElementById('disenchantOverlay')?.classList.remove('hidden')}

// ---- Creator's Room: full craft system (create/upgrade tier/add stat/upgrade stat) ----
// Bonus values by tier: common+1, uncommon+2, rare+4, epic+6, legendary+8, artifact+10.
const CRAFT_TIER_BONUS={common:1,uncommon:2,rare:4,epic:6,legendary:8,artifact:10};
// Extra (non-primary) stat slots an item can hold, on top of its main bonus, by tier.
const CRAFT_EXTRA_STAT_SLOTS={common:0,uncommon:0,rare:1,epic:1,legendary:2,artifact:3};
const CRAFT_CREATE_COST=40;
const CRAFT_TIER_UPGRADE_COST=20;
const CRAFT_ADD_STAT_COST=20;
const CRAFT_STAT_UPGRADE_COST=20;
// Which shard tier a stat-bonus value costs to reach: +1 common, +2/+3 uncommon,
// +4/+5 rare, +6/+7 epic, +8/+9 legendary, +10 artifact.
function craftShardTierForValue(v){
 if(v<=1)return'common';
 if(v<=3)return'uncommon';
 if(v<=5)return'rare';
 if(v<=7)return'epic';
 if(v<=9)return'legendary';
 return'artifact';
}
function hasShards(tier,n){return (game.player.shards?.[tier]||0)>=n}
function spendShards(tier,n){game.player.shards=game.player.shards||{};game.player.shards[tier]=Math.max(0,(game.player.shards[tier]||0)-n);persistShards()}
function craftEligibleItems(){return (game.inventory||[]).filter(i=>i&&i.type!=='potion'&&i.slot!=='consumable')}
function craftPrimaryStatForSlot(slot){const cands=primaryAffixes.filter(a=>a.slots.includes(slot));return cands.length?pick(cands):primaryAffixes[0]}
// Stats a player may pick as a crafted item's primary bonus for a given slot:
// the 6 core stats valid for that slot, plus armor when the slot allows it
// (armor's bonus is doubled vs a normal stat at the same tier, see
// craftSetPrimaryAffix).
function craftStatOptionsForSlot(slot){
 const primary=primaryAffixes.filter(a=>a.slots.includes(slot));
 const armor=secondaryAffixes.find(a=>a.key==='armor'&&a.slots.includes(slot));
 return armor?[...primary,armor]:primary;
}
// The item's "main bonus" is its first affix matching one of the 6 core
// stats; crafted items always have exactly one, created up front.
function craftMainAffix(item){
 item.affixes=item.affixes||[];
 const primKeys=new Set(primaryAffixes.map(a=>a.key));
 let a=item.affixes.find(x=>primKeys.has(x.key));
 if(!a){const def=craftPrimaryStatForSlot(item.slot);a={key:def.key,label:def.label,value:0,percent:false};item.affixes.unshift(a)}
 return a;
}
function craftExtraStatCount(item){const main=craftMainAffix(item);return (item.affixes||[]).filter(a=>a!==main).length}
function craftItemShell(slot,tier,offhandKind='shield'){
 const rar=rarities.find(r=>r.name===tier)||rarities[0];
 const itemLevel=Math.max(1,game.player.level||1);
 const resolvedOffhandKind=slot==='offhand'?(offhandKind||'shield'):null;
 const offhandCategory=resolvedOffhandKind==='wand'?configWeaponTypeCategories.Varitas:resolvedOffhandKind==='dagger'?configWeaponTypeCategories.Dagas:null;
 const iconShape=resolvedOffhandKind==='dagger'?'blade':pick(itemIconShapes[slot]||['gem']);
 const weaponCategory=slot==='weapon'?weaponCategoryForLoot(rar):null;
 const weaponIconRow=weaponCategory?weaponRowForCategory(weaponCategory):null;
 const weaponIconCol=weaponCategory?weaponPowerColumn(itemLevel,rar,40):null;
 const weaponIconPathValue=weaponCategory?weaponIconPath(weaponIconRow,weaponIconCol):null;
 const armorIconRow=slot==='chest'?armorRowForLoot(rar):null;
 const armorIconCol=slot==='chest'?armorPowerColumn(itemLevel,rar,40):null;
 const armorIconPathValue=slot==='chest'?armorIconPath(armorIconRow,armorIconCol):null;
 const offhandName=offhandCategory?weaponNameForCategory(offhandCategory,weaponPowerColumn(itemLevel,rar,40)):null;
 const name=slot==='weapon'?weaponNameForCategory(weaponCategory,weaponIconCol):slot==='chest'?armorName(armorIconRow,armorIconCol):(offhandName||`${pick(itemBases[slot]||['Objeto'])} del Creador`);
 const rangeBounds=slot==='weapon'?weaponRangeBounds({weaponCategory,name}):null;
 return {
  id:crypto.randomUUID(),slot,iconShape,rarity:rar.name,label:rar.label,itemLevel,score:0,
  name,theme:'crafted',offhandKind:resolvedOffhandKind,
  weaponCategory,weaponIconRow,weaponIconCol,weaponIconPath:weaponIconPathValue,
  armorCategory:slot==='chest'?armorRows[armorIconRow]?.category:null,armorIconRow,armorIconCol,armorIconPath:armorIconPathValue,
  flavor:'Objeto crafteado en el Altar del Creador.',
  defenseStat:slot==='weapon'?(weaponCategoryStats[weaponCategory]||'strength'):null,
  rangeMin:rangeBounds?rangeBounds.min:null,rangeMax:rangeBounds?rangeBounds.max:null,
  damageDice:slot==='weapon'?'1d6':null,
  affixes:[],passives:[],effects:[],
  custom:true,
  desc:`Objeto crafteado · ${rar.label}`
 };
}
// Armor's crafted bonus is double a normal stat's at the same tier (tier N ->
// +N for a core stat, +2N for armor), per the tier-bonus table above.
function craftSetPrimaryAffix(item,tier,statKey){
 const options=craftStatOptionsForSlot(item.slot);
 const def=(statKey&&options.find(o=>o.key===statKey))||craftPrimaryStatForSlot(item.slot);
 const value=def.key==='armor'?CRAFT_TIER_BONUS[tier]*2:CRAFT_TIER_BONUS[tier];
 item.affixes=[{key:def.key,label:def.label,value,percent:!!def.percent}];
}
// custom_items on user_pj mirrors every player-crafted item still in the
// inventory/equipment, kept separate from the shared config_items catalog.
function syncCustomItemsRecord(){game.player.customItems=[...(game.inventory||[]),...Object.values(game.player.equipment||{})].filter(i=>i&&i.custom)}
let customItemsPersistChain=Promise.resolve();
function persistCustomItems(){
 syncCustomItemsRecord();
 if(!game?.pjId)return;
 const id=game.pjId,payload=JSON.stringify({custom_items:game.player.customItems||[]});
 customItemsPersistChain=customItemsPersistChain.then(()=>fetch(`/api/user-pj?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:payload}))
  .then(async r=>{if(!r.ok){const d=await r.json().catch(()=>({}));log(`No se pudieron guardar los objetos personalizados: ${d.error||d.message||r.status}`,'sys');console.error('persistCustomItems falló',d)}})
  .catch(e=>{log('No se pudieron guardar los objetos personalizados (sin conexión).','sys');console.error('No se pudieron guardar los objetos personalizados',e)});
}
function setCraftStatus(id,msg){const el=document.getElementById(id);if(el)el.textContent=msg}
// Shards tab: one row per tier with its (optionally admin-configured, via
// config_world_object shard_<tier> keys) icon and current count.
function renderShardsTab(){
 const root=document.getElementById('shards');if(!root)return;
 const shards=game.player.shards||{};
 root.innerHTML=`<div class="configItemsList">${LOOT_RARITY_ORDER.map(t=>`<div class="configItem shardRow"><canvas class="shardTierIcon" width="28" height="28" data-shard-tier="${t}"></canvas><div><b style="color:${tierColor(t)}">${tierDefs[t]?.label||t}</b><span class="small">${shards[t]||0} shard(s)</span></div></div>`).join('')}</div><p class="small">Consigue shards deshaciendo objetos desde la Mochila. Se gastan en el Altar del Creador para crear y mejorar equipo.</p>`;
 setTimeout(()=>document.querySelectorAll('#shards .shardTierIcon').forEach(c=>drawShardTierIconToCanvas(c,c.dataset.shardTier)),0);
}
function renderCraftShardsSummary(){
 const el=document.getElementById('craftShardsSummary');if(!el)return;
 const shards=game.player.shards||{};
 el.textContent='Shards actuales: '+(LOOT_RARITY_ORDER.map(t=>`${tierDefs[t]?.label||t} ${shards[t]||0}`).join(' · '));
}
function switchCraftTab(tab){
 document.querySelectorAll('.craftTabBtn').forEach(b=>b.classList.toggle('active',b.dataset.craftTab===tab));
 document.querySelectorAll('.craftPane').forEach(p=>p.classList.add('hidden'));
 const map={create:'craftPaneCreate',tier:'craftPaneTier',addstat:'craftPaneAddStat',upgradestat:'craftPaneUpgradeStat'};
 document.getElementById(map[tab])?.classList.remove('hidden');
 if(tab==='create')renderCraftCreatePane();
 else if(tab==='tier')renderCraftTierPane();
 else if(tab==='addstat')renderCraftAddStatPane();
 else if(tab==='upgradestat')renderCraftUpgradeStatPane();
 renderCraftShardsSummary();
}
function populateCraftCreateSelectsOnce(){
 const slotSel=document.getElementById('craftCreateSlot');
 if(slotSel&&!slotSel.dataset.filled){slotSel.innerHTML=slots.map(s=>`<option value="${s}">${s}</option>`).join('');slotSel.dataset.filled='1';slotSel.addEventListener('change',()=>{renderCraftCreateStatOptions();renderCraftCreateOffhandKind()})}
 const tierSel=document.getElementById('craftCreateTier');
 if(tierSel&&!tierSel.dataset.filled){tierSel.innerHTML=LOOT_RARITY_ORDER.map(t=>`<option value="${t}">${tierDefs[t]?.label||t} (+${CRAFT_TIER_BONUS[t]}, coste ${CRAFT_CREATE_COST})</option>`).join('');tierSel.dataset.filled='1'}
 renderCraftCreateStatOptions();renderCraftCreateOffhandKind();
}
// Stat picker options depend on the currently selected slot (armor only
// offered where it applies); armor's bonus is flagged as double in its label.
function renderCraftCreateStatOptions(){
 const slotSel=document.getElementById('craftCreateSlot'),statSel=document.getElementById('craftCreateStat');
 if(!slotSel||!statSel)return;
 const options=craftStatOptionsForSlot(slotSel.value);
 const prev=statSel.value;
 statSel.innerHTML=options.map(o=>`<option value="${o.key}">${o.label}${o.key==='armor'?' (bonus x2)':''}</option>`).join('');
 if(options.some(o=>o.key===prev))statSel.value=prev;
}
function renderCraftCreateOffhandKind(){
 const slotSel=document.getElementById('craftCreateSlot'),label=document.getElementById('craftCreateOffhandKindLabel');
 if(!slotSel||!label)return;
 label.classList.toggle('hidden',slotSel.value!=='offhand');
}
function renderCraftCreatePane(){
 populateCraftCreateSelectsOnce();
 const btn=document.getElementById('craftCreateBtn');
 if(btn&&!btn.dataset.wired){btn.dataset.wired='1';btn.onclick=()=>{
  const slot=document.getElementById('craftCreateSlot').value,tier=document.getElementById('craftCreateTier').value;
  const statKey=document.getElementById('craftCreateStat')?.value;
  const offhandKind=document.getElementById('craftCreateOffhandKind')?.value;
  craftCreateItem(slot,tier,statKey,offhandKind);
 }}
}
function craftCreateItem(slot,tier,statKey,offhandKind){
 if(!hasShards(tier,CRAFT_CREATE_COST)){setCraftStatus('craftCreateStatus',`No tienes suficientes shards de ${tierDefs[tier]?.label||tier} (necesitas ${CRAFT_CREATE_COST}).`);return}
 spendShards(tier,CRAFT_CREATE_COST);
 const item=craftItemShell(slot,tier,offhandKind);
 craftSetPrimaryAffix(item,tier,statKey);
 applyOffhandGuarantee(item);
 game.inventory=game.inventory||[];game.inventory.push(item);
 log(`Creaste ${item.name} (${tierDefs[tier]?.label||tier}).`,'good');
 persistCustomItems();
 setCraftStatus('craftCreateStatus',`¡Creado! ${item.name}`);
 renderCraftTierPane();renderCraftAddStatPane();renderCraftUpgradeStatPane();renderCraftShardsSummary();
 updateUI();
}
function renderCraftTierPane(){
 const root=document.getElementById('craftTierList');if(!root)return;
 const items=craftEligibleItems();
 root.innerHTML=items.length?items.map((it,i)=>{
  const curIdx=LOOT_RARITY_ORDER.indexOf(it.rarity),next=LOOT_RARITY_ORDER[curIdx+1];
  const canUpgrade=next&&hasShards(next,CRAFT_TIER_UPGRADE_COST);
  return `<div class="configItem"><span class="tierDot" style="background:${tierColor(it.rarity)}"></span><div><b>${it.name}</b><span class="small">${tierDefs[it.rarity]?.label||it.rarity}${next?` → ${tierDefs[next]?.label}`:' (tier máximo)'}</span><div class="configItemActions">${next?`<button type="button" data-tier-idx="${i}" ${canUpgrade?'':'disabled'}>Mejorar (${CRAFT_TIER_UPGRADE_COST} ${tierDefs[next]?.label})</button>`:''}</div></div></div>`;
 }).join(''):'<p class="small">No tienes objetos de equipo.</p>';
 root.querySelectorAll('[data-tier-idx]').forEach(b=>b.onclick=()=>{
  const it=items[Number(b.dataset.tierIdx)],curIdx=LOOT_RARITY_ORDER.indexOf(it.rarity),next=LOOT_RARITY_ORDER[curIdx+1];
  craftUpgradeItemTier(it,next);
 });
}
function craftUpgradeItemTier(item,targetTier){
 if(!targetTier)return;
 if(!hasShards(targetTier,CRAFT_TIER_UPGRADE_COST)){log(`No tienes suficientes shards de ${tierDefs[targetTier]?.label||targetTier}.`,'sys');return}
 spendShards(targetTier,CRAFT_TIER_UPGRADE_COST);
 item.rarity=targetTier;item.label=tierDefs[targetTier]?.label||targetTier;item.custom=true;
 const main=craftMainAffix(item);
 main.value=main.key==='armor'?CRAFT_TIER_BONUS[targetTier]*2:CRAFT_TIER_BONUS[targetTier];
 applyOffhandGuarantee(item);
 log(`${item.name} mejorado a ${item.label}.`,'good');
 persistCustomItems();renderCraftTierPane();renderCraftAddStatPane();renderCraftUpgradeStatPane();renderCraftShardsSummary();recomputeDerived();updateUI();
}
function renderCraftAddStatPane(){
 const root=document.getElementById('craftAddStatList');if(!root)return;
 const items=craftEligibleItems().filter(it=>(CRAFT_EXTRA_STAT_SLOTS[it.rarity]||0)>0);
 root.innerHTML=items.length?items.map((it,i)=>{
  const allowed=CRAFT_EXTRA_STAT_SLOTS[it.rarity]||0,used=craftExtraStatCount(it);
  return `<div class="configItem"><span class="tierDot" style="background:${tierColor(it.rarity)}"></span><div><b>${it.name}</b><span class="small">${tierDefs[it.rarity]?.label} · stats extra ${used}/${allowed}</span><div class="configItemActions"><button type="button" data-addstat-idx="${i}" ${used<allowed?'':'disabled'}>Añadir stat (+1, ${CRAFT_ADD_STAT_COST} shards comunes)</button></div></div></div>`;
 }).join(''):'<p class="small">Ningún objeto admite stats adicionales (solo raros, épicos, legendarios y artefactos).</p>';
 root.querySelectorAll('[data-addstat-idx]').forEach(b=>b.onclick=()=>craftAddStat(items[Number(b.dataset.addstatIdx)]));
}
function craftAddStat(item){
 const allowed=CRAFT_EXTRA_STAT_SLOTS[item.rarity]||0,used=craftExtraStatCount(item);
 if(used>=allowed){log('Este objeto ya tiene el máximo de stats adicionales para su tier.','sys');return}
 if(!hasShards('common',CRAFT_ADD_STAT_COST)){log('No tienes suficientes shards comunes.','sys');return}
 const existingKeys=new Set((item.affixes||[]).map(a=>a.key));
 const pool=[...primaryAffixes,...secondaryAffixes].filter(a=>a.slots.includes(item.slot)&&!existingKeys.has(a.key));
 if(!pool.length){log('No quedan stats disponibles para este slot.','sys');return}
 spendShards('common',CRAFT_ADD_STAT_COST);
 const def=pick(pool);
 item.affixes=item.affixes||[];item.affixes.push({key:def.key,label:def.label,value:1,percent:!!def.percent});
 item.custom=true;
 log(`Añadida stat ${def.label} (+1) a ${item.name}.`,'good');
 persistCustomItems();renderCraftAddStatPane();renderCraftUpgradeStatPane();renderCraftShardsSummary();recomputeDerived();updateUI();
}
function renderCraftUpgradeStatPane(){
 const root=document.getElementById('craftUpgradeStatList');if(!root)return;
 const items=craftEligibleItems().filter(it=>(it.affixes||[]).length);
 root.innerHTML=items.length?items.map((it,i)=>{
  const cap=CRAFT_TIER_BONUS[it.rarity]||1;
  const rows=(it.affixes||[]).map((a,ai)=>{
   const maxed=a.value>=cap,shardTier=craftShardTierForValue(a.value+1),canUp=!maxed&&hasShards(shardTier,CRAFT_STAT_UPGRADE_COST);
   return `<div class="configItemActions"><span class="small">${a.label} +${a.value}${a.percent?'%':''}</span> <button type="button" data-up-item="${i}" data-up-affix="${ai}" ${maxed||!canUp?'disabled':''}>${maxed?'Máximo del tier':`Subir a +${a.value+1} (${CRAFT_STAT_UPGRADE_COST} ${tierDefs[shardTier]?.label})`}</button></div>`;
  }).join('');
  return `<div class="configItem"><span class="tierDot" style="background:${tierColor(it.rarity)}"></span><div><b>${it.name}</b><span class="small">${tierDefs[it.rarity]?.label} · máx stat +${cap}</span>${rows}</div></div>`;
 }).join(''):'<p class="small">No tienes objetos con stats para mejorar.</p>';
 root.querySelectorAll('[data-up-item]').forEach(b=>b.onclick=()=>{
  const it=items[Number(b.dataset.upItem)],affix=it.affixes[Number(b.dataset.upAffix)];
  craftUpgradeStat(it,affix);
 });
}
function craftUpgradeStat(item,affix){
 if(!affix)return;
 const cap=CRAFT_TIER_BONUS[item.rarity]||1;
 if(affix.value>=cap){log('Esta stat ya está en el máximo de su tier.','sys');return}
 const newValue=affix.value+1,shardTier=craftShardTierForValue(newValue);
 if(!hasShards(shardTier,CRAFT_STAT_UPGRADE_COST)){log(`No tienes suficientes shards de ${tierDefs[shardTier]?.label||shardTier}.`,'sys');return}
 spendShards(shardTier,CRAFT_STAT_UPGRADE_COST);
 affix.value=newValue;item.custom=true;
 log(`${item.name}: ${affix.label} sube a +${newValue}.`,'good');
 persistCustomItems();renderCraftUpgradeStatPane();renderCraftShardsSummary();recomputeDerived();updateUI();
}
// Chest tier (1-5) climbs from 1 at floor 1 to 5 at the dungeon's last floor
// - the same progression shape as enemy tiers (enemyTierWeightsForDepth) -
// scaling proportionally regardless of how many floors the world has, with
// character level as a secondary nudge on top so a stronger character finds
// slightly better chests early rather than the floor being the only factor.
function chestTierForFloor(floor,level,totalFloors=20){
 const depth=((floor||1)-1)/Math.max(1,(totalFloors||20)-1);
 return Math.max(1,Math.min(5,Math.round(1+depth*4+((level||1)-1)/40)));
}
// A whole floor giving out the exact same chest tier every time reads as
// flat, so each chest jitters a little around the floor's ideal tier
// instead of all matching it exactly - mostly the ideal tier, sometimes one
// off, rarely two off.
const CHEST_TIER_JITTER=[[-2,.05],[-1,.2],[0,.5],[1,.2],[2,.05]];
function jitterChestTier(desired){
 const r=Math.random();let acc=0;
 for(const [off,w] of CHEST_TIER_JITTER){acc+=w;if(r<=acc)return Math.max(1,Math.min(5,desired+off))}
 return desired;
}
// Dungeons only ever place chests backed by a real config_chest row - never a
// generic/procedural one. Picks the nearest configured tier to the (jittered)
// ideal one for this floor+level (closest at-or-below first, then closest
// above) so a world with only some tiers configured still uses what exists
// instead of falling back to anything synthetic. Returns null only when
// config_chest is completely empty, in which case no chest gets placed at all.
function pickChestDefForFloor(floor,level,totalFloors=20){
 if(!configChests.length)return null;
 const desired=jitterChestTier(chestTierForFloor(floor,level,totalFloors));
 for(let t=desired;t>=1;t--){const matches=configChests.filter(r=>Number(r.chest_json?.tier)===t);if(matches.length)return pick(matches).chest_json}
 for(let t=desired+1;t<=5;t++){const matches=configChests.filter(r=>Number(r.chest_json?.tier)===t);if(matches.length)return pick(matches).chest_json}
 return null;
}
// Resolves one loot slot against the chest's own resolved config_chest
// definition (specific items/skills if picked, else random within its
// configured item tiers/slot/weapon-type); returns null when the slot only
// unlocked a skill, or when nothing in config_items matches - never a
// generic/procedural item.
function chestLootItem(c){
 const def=c.chestDef;if(!def)return null;
 const type=def.type;
 if(type==='skill'){
  const ids=(def.itemIds||[]).filter(id=>id!==CHEST_RANDOM_PICK_ID);
  const specific=ids.filter(id=>skillDefs[id]&&!(game.player.knownSkills||[]).includes(id));
  const id=specific.length?pick(specific):randomLootableSkill();
  if(id)unlockSkillLoot(id);
  return null;
 }
 const lootRow=currentLootProgressionRow(game.floor,game.player.level);
 // itemIds may mix specific config_items ids with the CHEST_RANDOM_PICK_ID
 // sentinel ("Aleatorio" checkbox); an empty list also means random
 const pickedId=def.itemIds?.length?pick(def.itemIds):CHEST_RANDOM_PICK_ID;
 if(pickedId!==CHEST_RANDOM_PICK_ID){
  const row=configItems.find(r=>String(r.id)===String(pickedId));
  if(row)return configuredItemFromRow(row,lootRow,game.player.level);
 }
 const pool=configItems.filter(r=>{
  const j=r.item_json||r,rarity=j.rarity||r.tier||'common';
  if(!(def.itemTiers||['common']).includes(rarity))return false;
  return chestItemMatchesType(j,type,def.slotFilter||'all',def.weaponTypeFilter||'all');
 });
 if(pool.length)return configuredItemFromRow(pick(pool),lootRow,game.player.level);
 return null;
}
function openChest(c){
 c.opened=true;game.chestsOpened++;
 if(game.multiplayer)sendMpAction('open_chest',{at:{x:c.x,y:c.y}});
 const n=1+(Math.random()<.20?1:0);
 for(let i=0;i<n;i++){const item=chestLootItem(c);if(item){addInventoryItem(item);setTimeout(()=>lootToast(item),i*220)}}
 game.player.gold+=5+rng(14);floating('¡BOTÍN!',c.x,c.y,'#ffd45f');log(`Cofre: ${n} objeto(s).`,'loot');if(game.chestsOpened>=5)unlock('chest5','Coleccionista de basura','Abre 5 cofres.')
}

function applyBuff(id,name,turns,effects={}){
 const p=game.player;p.activeBuffs=p.activeBuffs||[];
 p.activeBuffs=p.activeBuffs.filter(b=>b.id!==id);
 p.activeBuffs.push({id,name,turns,effects});
 recomputeDerived();log(`${name} activo durante ${turns} turnos.`,'good')
}
function tickBuffs(){
 const p=game.player;if(!p?.activeBuffs)return;
 p.activeBuffs.forEach(b=>b.turns--);
 const ended=p.activeBuffs.filter(b=>b.turns<=0);
 p.activeBuffs=p.activeBuffs.filter(b=>b.turns>0);
 ended.forEach(b=>log(`${b.name} termina.`,'sys'));
 if(ended.length)recomputeDerived()
}
// Player-side heal-over-time stacks from a stackable 'hot' effect component -
// the enemy-side equivalent (DOT) already lives in tickEnemyStatuses(); the
// player has no statuses array of its own, so this is a small parallel list.
function tickPlayerHots(){
 const p=game.player;if(!p?.hots?.length)return;
 for(const h of p.hots){healEntity(p,Math.max(1,Math.round(h.power)));h.turns--}
 p.hots=p.hots.filter(h=>h.turns>0);
}
// Applies derived.staminaRegen/manaRegen (base regen + item/race bonuses,
// including the guaranteed wand/dagger offhand regen) once per turn.
function tickPlayerRegen(){
 const p=game.player;if(!p)return;
 p.stamina=Math.min(p.maxStamina,p.stamina+Math.max(0,p.derived?.staminaRegen||0));
 p.mana=Math.min(p.maxMana,p.mana+Math.max(0,p.derived?.manaRegen||0));
}
function activeEffectsHtml(){
 const buffs=(game.player.activeBuffs||[]).map(b=>`<span class="effectBadge buff">${b.name}: ${b.turns}T</span>`);
 const potions=(game.player.activePotions||[]).map(b=>`<span class="effectBadge potion">${b.name}: ${b.turns}T</span>`);
 return[...buffs,...potions].join('')
}


function addEnemyStatus(e,type,turns,power=1,label=type){
 e.statuses=e.statuses||[];
 const old=e.statuses.find(s=>s.type===type);
 if(old){old.turns=Math.max(old.turns,turns);old.power=Math.max(old.power,power)}
 else e.statuses.push({type,turns,power,label});
 log(`${e.name}: ${label} durante ${turns} turnos.`,'combat')
}
function enemyHasStatus(e,type){return(e.statuses||[]).some(s=>s.type===type&&s.turns>0)}
// Debuff skills with a configured debuffStat lower that specific enemy stat
// for the status' duration (instead of the generic weakened/stunned pair),
// so "which stat" is a real, reversible mechanical choice rather than cosmetic.
function applyEnemyStatDebuff(e,stat,mode,value,turns,label){
 e.statuses=e.statuses||[];
 const existing=e.statuses.find(s=>s.type==='statDebuff'&&s.stat===stat);
 if(existing){existing.turns=Math.max(existing.turns,turns);return}
 e.stats=e.stats||{};
 const before=e.stats[stat]||0;
 e.stats[stat]=mode==='mult'?before*value:before-value;
 e.statuses.push({type:'statDebuff',stat,before,turns,label});
 log(`${e.name}: ${label} (${DEFENSE_STAT_LABELS[stat]||stat} ${mode==='mult'?`×${value}`:`-${value}`}) durante ${turns} turnos.`,'combat')
}
function tickEnemyStatuses(){
 for(const e of [...game.enemies]){
  if(e.hp<=0)continue;
  for(const s of e.statuses||[]){
   if(['bleed','burn','poison','dot','plague','decay','decayDot','areaDot'].includes(s.type)){
    const dmg=Math.max(1,Math.round(s.power));e.hp-=dmg;floating(`-${dmg}`,e.x,e.y,'#d98a75');
    if(s.type==='decayDot')s.power=Math.max(1,s.power-1);
    if(e.hp<=0){kill(e);break}
   }
   s.turns--;
   if(s.turns<=0&&s.type==='doomCountdown'&&e.hp>0){const dmg=Math.max(1,Math.round(s.power));e.hp-=dmg;floating(`-${dmg}`,e.x,e.y,'#d68cff');if(e.hp<=0){kill(e);break}}
   if(s.turns<=0&&s.type==='statDebuff')e.stats[s.stat]=s.before;
  }
  e.statuses=(e.statuses||[]).filter(s=>s.turns>0)
 }
}
function findFreeAdjacentToPlayer(){
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 for(const [dx,dy] of dirs){
  const x=game.player.x+dx,y=game.player.y+dy;
  if(!blocked(x,y)&&!isSafeCell(x,y)&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&!(game.companions||[]).some(c=>c.x===x&&c.y===y))return{x,y}
 }
 return{x:game.player.x,y:game.player.y}
}
// `custom` (from a stackable 'summon' effect component) overrides the
// hardcoded per-kind stat table with author-configured hp/atk/range/effect,
// so admin-authored summons don't need a dedicated `kind` entry here.
function summonCompanion(kind='companion',turns=8,power=1,custom=null){
 game.companions=game.companions||[];
 const pos=findFreeAdjacentToPlayer();
 let stats,name;
 if(custom){
  stats={hp:Math.max(1,Math.round(custom.hp||20)),atk:custom.atk||'1d4',range:Math.max(1,custom.range||1),shape:'allyCompanion'};
  name=custom.name||'Invocación';
 }else{
  const names={companion:'Compañero',skeleton:'Siervo óseo',turret:'Torreta',healer:'Custodio',tank:'Guardián',wolf:'Lobo espiritual',clone:'Clon'};
  stats={
   skeleton:{hp:18+Math.round(power*5),atk:'1d6+2',range:1,shape:'allySkeleton'},
   turret:{hp:14+Math.round(power*3),atk:'1d6+2',range:7,shape:'allyTurret'},
   healer:{hp:16+Math.round(power*4),atk:'1d4',range:4,shape:'allyHealer'},
   tank:{hp:28+Math.round(power*7),atk:'1d6+1',range:1,shape:'allyTank'},
   wolf:{hp:20+Math.round(power*5),atk:'1d8',range:1,shape:'allyWolf'},
   clone:{hp:10+Math.round(power*2),atk:'1d4+1',range:1,shape:'allyClone'},
   companion:{hp:18+Math.round(power*4),atk:'1d6',range:1,shape:'allyCompanion'}
  }[kind]||{hp:18,atk:'1d6',range:1,shape:'allyCompanion'};
  name=names[kind]||'Aliado';
 }
 game.companions.push({
  id:`comp-${Date.now()}-${Math.random()}`,kind:custom?'custom':kind,name,
  turns,power,x:pos.x,y:pos.y,hp:stats.hp,maxHp:stats.hp,atk:stats.atk,range:stats.range,shape:stats.shape,
  friendly:true,
  ...(custom?{effectType:custom.effectType||'damage',actionsPerTurn:Math.max(1,custom.actionsPerTurn||1),effectTurns:custom.effectTurns||2,stationary:!!custom.stationary,iconImage:custom.iconImage||''}:{})
 });
 reveal(pos.x,pos.y,2);draw();log(`${name} aparece en (${pos.x}, ${pos.y}) y luchará a tu lado durante ${turns} turnos.`,'good')
}
function moveCompanionToward(c,target){
 const dx=Math.sign(target.x-c.x),dy=Math.sign(target.y-c.y);
 const options=[[dx,dy],[dx,0],[0,dy]].filter(([x,y])=>x||y);
 for(const [sx,sy] of options){
  const nx=c.x+sx,ny=c.y+sy;
  if(!blocked(nx,ny)&&!isSafeCell(nx,ny)&&!game.enemies.some(e=>e.hp>0&&e.x===nx&&e.y===ny)&&!(game.companions||[]).some(o=>o!==c&&o.x===nx&&o.y===ny)&&!(game.player.x===nx&&game.player.y===ny)){
   c.x=nx;c.y=ny;return true
  }
 }
 return false
}
function companionTurn(){
 game.companions=game.companions||[];
 for(const c of [...game.companions]){
  c.turns--;
  if(c.hp<=0||c.turns<=0)continue;
  const enemies=game.enemies.filter(e=>e.hp>0);
  if(c.effectType){
   // custom summon from a stackable 'summon' effect component: runs
   // actionsPerTurn independent actions instead of the fixed one-action
   // kind-based branches below (actionsPerTurn = author's "PA" / 10)
   for(let n=0;n<(c.actionsPerTurn||1);n++){
    if(c.effectType==='heal'){healEntity(game.player,Math.max(1,rollDice(c.atk).total));floating('✚',c.x,c.y,'#8dffa8');continue}
    const target=enemies.sort((a,b)=>gridDistance(c,a)-gridDistance(c,b))[0];
    if(!target)break;
    if(gridDistance(c,target)>c.range){if(!c.stationary)moveCompanionToward(c,target);break}
    if(c.effectType==='root'){addEnemyStatus(target,'root',c.effectTurns||2,0,c.name);floating('◆',c.x,c.y,'#b26bff')}
    else{attack(target,0,{dice:c.atk,multiplier:.65});floating('◆',c.x,c.y,'#9ee6c0')}
   }
   continue
  }
  if(c.kind==='healer'){
   healEntity(game.player,Math.max(3,Math.round(c.power*2)));
   const nearby=enemies.sort((a,b)=>gridDistance(c,a)-gridDistance(c,b))[0];
   if(nearby&&gridDistance(c,nearby)<=c.range)attack(nearby,0,{dice:c.atk,multiplier:.45});
   continue
  }
  const target=enemies.sort((a,b)=>gridDistance(c,a)-gridDistance(c,b))[0];
  if(!target)continue;
  const dist=gridDistance(c,target);
  if(dist<=c.range){
   attack(target,0,{dice:c.atk,multiplier:.65+c.power*.07});
   floating(c.kind==='skeleton'?'☠':'◆',c.x,c.y,'#9ee6c0')
  }else moveCompanionToward(c,target)
 }
 game.companions=game.companions.filter(c=>c.hp>0&&c.turns>0);draw()
}
function addSkillObject(kind,id,x,y,turns=6,power=1,radius=1){
 game.skillObjects=game.skillObjects||[];
 const d=skillDefs[id]||{};
 game.skillObjects.push({id:`obj-${Date.now()}-${Math.random()}`,kind,skillId:id,name:d.name||kind,icon:d.icon||'◆',x,y,turns,power,radius});
 reveal(x,y,Math.max(1,radius));
 log(`${d.name||'Efecto'} deja una referencia visual en el tablero.`,'good')
}
function tickSkillObjects(){
 game.skillObjects=game.skillObjects||[];
 for(const o of [...game.skillObjects]){
  if(o.kind==='trap'){
   const targets=game.enemies.filter(e=>e.hp>0&&gridDistance(e,o)<=Math.max(1,o.radius));
   if(targets.length){targets.forEach(e=>attack(e,0,{skillId:o.skillId,multiplier:1.15}));floating('¡MINA!',o.x,o.y,'#ffcc55');o.turns=0;continue}
  }else if(o.kind==='decoy'){
   o.turns--;continue
  }else if(['totem','zone'].includes(o.kind)){
   for(const e of game.enemies.filter(e=>e.hp>0&&gridDistance(e,o)<=Math.max(1,o.radius)))attack(e,0,{skillId:o.skillId,multiplier:.35});
  }
  o.turns--
 }
 game.skillObjects=game.skillObjects.filter(o=>o.turns>0)
}
function teleportPlayerTo(x,y){
 if(blocked(x,y)||game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))return false;
 game.player.x=x;game.player.y=y;anim.heroX=anim.targetX=x;anim.heroY=anim.targetY=y;reveal(x,y);return true
}

// Applies a stat buff to the caster using the shared buffStat/buffStatMode/
// buffStatCoef/buffTurns fields when the skill defines them, otherwise a
// hand-tuned default (legacy percentage armor+damage, or a single flat stat)
// - shared by every hardcoded "signature" buff below so an admin can make
// ANY of them fully configurable, not just the 12 generic tags.
function applyCreativeBuff(id,d,lvl,fallbackEffects,fallbackTurns){
 const turns=d.buffTurns??fallbackTurns;
 if(d.buffStat){
  const mode=d.buffStatMode||'add',value=d.buffStatCoef??(mode==='mult'?1.2:5);
  applyBuff(id,d.name,turns,{[d.buffStat]:{mode,value}});
 }else applyBuff(id,d.name,turns,fallbackEffects);
}
function applyClassEffectState(effect,id,target,x,y,lvl){
 const p=game.player,d=skillDefs[id];
 const area=(r=2)=>game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=r);
 const status=(e,type,t,power,label)=>addEnemyStatus(e,type,t,power,label);
 const hit=(e,m=1)=>attack(e,0,{skillId:id,multiplier:m});

 if(effect==='armorBreak'){hit(target,.9);status(target,'armorBreak',d.debuffTurns??4,.20,'Quebradura');return true}
 if(effect==='pullRoot'){hit(target,.8);const dx=Math.sign(p.x-target.x),dy=Math.sign(p.y-target.y);const nx=target.x+dx,ny=target.y+dy;if(!blocked(nx,ny)&&!game.enemies.some(e=>e!==target&&e.x===nx&&e.y===ny)){target.x=nx;target.y=ny}status(target,'root',d.debuffTurns??2,0,'Inmovilizado');return true}
 if(effect==='counter'){p.shield+=8+lvl*2;p.counterReady={turns:5,damage:'1d8+'+lvl};applyCreativeBuff(id,d,lvl,{armor:.12},5);return true}
 // Self-damage then a stat buff - the exact "dmg(self)+buff(self)" combo the
 // new composable effects list expresses directly; this hardcoded version
 // stays for skills still on the legacy single-effect system.
 if(effect==='bloodBuff'){const loss=Math.max(1,Math.floor(p.hp*.10));p.hp=Math.max(1,p.hp-loss);applyCreativeBuff(id,d,lvl,{damage:{mode:'mult',value:1.25}},5);return true}
 if(effect==='lifestealBuff'){applyBuff(id,d.name,d.buffTurns??6,{lifesteal:.20});return true}
 if(effect==='overcharge'){p.hp=Math.max(1,p.hp-Math.floor(p.hp*.30));p.nextSkillMultiplier=2;return true}
 if(effect==='cheatDeath'){p.cheatDeathTurns=5;return true}
 if(effect==='missingHpNova'){const bonus=1+Math.min(.75,1-p.hp/p.maxHp);for(const e of area(3))hit(e,bonus);return true}
 if(effect==='raiseMark'){status(target,'raiseMark',d.debuffTurns??5,1,'Segunda Muerte');return true}
 if(effect==='holyMark'||effect==='mark'||effect==='bountyMark'){hit(target,.65);status(target,effect,d.debuffTurns??6,effect==='bountyMark'?.5:.2,d.name);return true}
 if(effect==='doomMark'){status(target,'doomMark',d.debuffTurns??5,1,'Mal Presagio');return true}
 if(effect==='doomCountdown'){status(target,'doomCountdown',d.dotTurns??4,dotPowerFor(d,8+lvl*3),'Cuenta final');return true}
 if(effect==='repeatSkill'){p.repeatNextSkill=.60;return true}
 if(effect==='resetCooldowns'){for(const k of Object.keys(p.cooldowns))p.cooldowns[k]=0;p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+Math.ceil(d.cost*.30));return true}
 if(effect==='reveal'){const r=12+lvl;for(let yy=Math.max(0,p.y-r);yy<=Math.min(ROWS-1,p.y+r);yy++)for(let xx=Math.max(0,p.x-r);xx<=Math.min(COLS-1,p.x+r);xx++)if(Math.hypot(xx-p.x,yy-p.y)<=r)game.seen[yy][xx]=true;return true}
 if(effect==='resourceRegen'){p.stamina=Math.min(p.maxStamina,p.stamina+12+lvl*3);applyBuff(id,d.name,d.buffTurns??4,{staminaRegen:4+lvl});return true}
 if(effect==='cleanseHeal'||effect==='purge'||effect==='absolution'){p.debuff=0;healEntity(p,dicePowerFor(d,10+lvl*4,p));if(effect!=='cleanseHeal')for(const e of area(3))hit(e,.75);return true}
 if(effect==='steal'){hit(target,.65);const roll=rng(3);if(roll===0){const v=dicePowerFor(d,5+lvl,p);healEntity(p,v)}else if(roll===1){p.gold+=5+lvl*2}else{const res=d.resource;p[res]=Math.min(p[res==='mana'?'maxMana':'maxStamina'],p[res]+6+lvl)}return true}
 if(effect==='freeze'){hit(target,.8);status(target,'freeze',d.debuffTurns??2,0,'Congelado');return true}
 if(effect==='stun'||effect==='silence'){hit(target,.75);status(target,effect,d.debuffTurns??(effect==='stun'?1:3),0,d.name);return true}
 if(effect==='poison'||effect==='burn'||effect==='bleed'||effect==='dot'||effect==='decayDot'){hit(target,.7);status(target,effect,d.dotTurns??4,dotPowerFor(d,2+lvl*.7),d.name);return true}
 if(effect==='root'||effect==='rootBleed'||effect==='bountyRoot'){hit(target,.7);status(target,'root',d.debuffTurns??2,0,'Inmovilizado');if(effect==='rootBleed')status(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.6),'Sangrado');return true}
 return false
}

// The 12 shared classEffect tags (one per class per tier-slot: ranged, shield,
// dash, debuff, aoe, heal, multihit, utility, ultimate, execute, buff, massive)
// already have their own dedicated handling elsewhere (useSkill's self-cast
// chain, or the differentiated logic right after this function's call sites in
// resolveTargetedSkill). applyCreativeClassEffect is for the distinctive
// per-class "signature" effects (root, freeze, drain, summon, teleport...);
// it must never intercept the shared tags, or the differentiated logic below
// each call site (execute multiplier, debuff status, etc.) never runs.
const GENERIC_CLASS_EFFECTS=new Set(['ranged','shield','dash','debuff','aoe','heal','multihit','utility','ultimate','execute','buff','massive']);
function applyCreativeClassEffect(id,target,x,y){
 const d=skillDefs[id],lvl=skillLevel(id),effect=d.classEffect,p=game.player;
 if(applyClassEffectState(effect,id,target,x,y,lvl))return true;
 const enemiesIn=(radius)=>game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=radius);
 const hit=(e,m=.9)=>attack(e,0,{skillId:id,multiplier:m});
 if(['root','pullRoot','rootBleed','bountyRoot'].includes(effect)){hit(target);addEnemyStatus(target,'root',d.debuffTurns??(2+Math.floor(lvl/4)),0,'Inmovilizado');if(effect.includes('Bleed'))addEnemyStatus(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.5),'Sangrado');return true}
 if(['freeze','delayedFreeze'].includes(effect)){hit(target,.8);addEnemyStatus(target,'freeze',d.debuffTurns??2,0,'Congelado');return true}
 if(['bleed','burn','poison','dot','decayDot','echoDot','delayedPoison'].includes(effect)){hit(target,.75);addEnemyStatus(target,effect==='poison'?'poison':effect==='decayDot'?'decayDot':'dot',d.dotTurns??(4+Math.floor(lvl/4)),dotPowerFor(d,2+lvl*.8),d.name);return true}
 if(['drain','holyLeech','steal'].includes(effect)){hit(target,.8);const power=dicePowerFor(d,5+lvl*2,p);healEntity(p,power);p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+power);return true}
 if(['stun','silence','age','wither','doomMark','mark','bountyMark','holyMark'].includes(effect)){hit(target,.75);addEnemyStatus(target,effect,d.debuffTurns??(2+Math.floor(lvl/5)),1,d.name);return true}
 if(['shadowStrike','holyDash','leapBuff'].includes(effect)){teleportPlayerTo(Math.max(1,target.x-Math.sign(target.x-p.x)),Math.max(1,target.y-Math.sign(target.y-p.y)));hit(target,1.15);if(effect==='shadowStrike')addEnemyStatus(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.5),'Sangrado');return true}
 if(['hookBleed'].includes(effect)){hit(target,.9);addEnemyStatus(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.5),'Sangrado');return true}
 if(['combo','comboMark','markedExecute','bountyExecute','packExecute','pierce','lineShot','ricochet','chain','blinkChain'].includes(effect)){hit(target,effect.includes('Execute')||effect==='markedExecute'?1.7:1.15);return true}
 if(['swapConfuse'].includes(effect)){const ox=p.x,oy=p.y;p.x=target.x;p.y=target.y;target.x=ox;target.y=oy;addEnemyStatus(target,'confuse',d.debuffTurns??2,0,'Confuso');return true}
 if(['teleportDecoy','teleportBuff','randomTeleport','freeTeleport','teleportShield','teleportClones'].includes(effect)){const ox=p.x,oy=p.y;if(!teleportPlayerTo(x,y))return false;applyCreativeBuff(id,d,lvl,{armor:.12,damage:.08},3+Math.floor(lvl/3));if(effect==='teleportDecoy')addSkillObject('decoy',id,ox,oy,4+Math.floor(lvl/3),1,1);if(effect==='teleportClones')summonCompanion('clone',5,1+lvl*.15);return true}
 if(['trap','rootZone'].includes(effect)){addSkillObject('trap',id,x,y,d.dotTurns??(6+lvl),dotPowerFor(d,1+lvl*.2),1);return true}
 if(['consecrate','stormTotem','areaDot'].includes(effect)){addSkillObject(effect==='stormTotem'?'totem':'zone',id,x,y,d.dotTurns??(4+Math.floor(lvl/2)),dotPowerFor(d,1+lvl*.15),2);return true}
 if(['summon','summonTurret','summonHealer','summonTank','summonScanner','summonElite','multiSummon','clones','clone'].includes(effect)){
  const kind=effect.includes('Turret')?'turret':effect.includes('Healer')?'healer':effect.includes('Tank')?'tank':effect.includes('clone')?'clone':(id==='necromancer_t1_2'||d.classId==='necromancer')?'skeleton':d.classId==='shaman'?'wolf':'companion';
  const n=effect==='multiSummon'||effect==='clones'?2:1;for(let i=0;i<n;i++)summonCompanion(kind,d.buffTurns??(7+lvl),1+lvl*.18);return true
 }
 if(['cleanseHeal','bigHeal','regenHeal','survivalHeal','healShield'].includes(effect)){healEntity(p,dicePowerFor(d,10+lvl*4+Math.floor(p.stats.wisdom||p.stats.vitality),p));if(effect==='healShield')p.shield+=8+lvl*2;applyBuff(id,d.name,d.buffTurns??3,{maxHp:0});return true}
 if(['buffArmor','counter','bloodBuff','lifestealBuff','rampage','overcharge','fortress','holyShield','holyAvatar','randomBuff','luckBuff','sniperBuff','stealthShot','shapeShift','lichBuff','implantBuff','mechBuff','wisdomBuff','martyrBuff','oakBuff','resourceRegen','reflect','monkAvatar','tauntBuff','beastAvatar','cheatDeath','cheatDeathHeal','rewind'].includes(effect)){
  const armor=effect.includes('Armor')||effect.includes('Shield')||effect.includes('fortress')||effect.includes('Avatar')?.28:.12;
  const damage=effect.includes('blood')||effect.includes('rampage')||effect.includes('overcharge')||effect.includes('Avatar')?.24:.10;
  applyCreativeBuff(id,d,lvl,{armor,damage},5+Math.floor(lvl/2));
  if(effect.includes('Shield'))p.shield+=8+lvl*3;if(effect.includes('cheatDeath'))p.cheatDeath=1;return true
 }
 const radius=d.tier===3?3:2,targets=enemiesIn(radius);
 if(!targets.length)return false;
 for(const e of targets){hit(e,d.tier===3?1.25:.85);
  if(/root|cage|forest|blackHole/.test(effect))addEnemyStatus(e,'root',d.debuffTurns??2,0,'Inmovilizado');
  if(/freeze|thermal/.test(effect))addEnemyStatus(e,'freeze',d.debuffTurns??2,0,'Congelado');
  if(/burn|plague|dot|storm|rain|decay|nova/.test(effect))addEnemyStatus(e,'dot',d.dotTurns??3,dotPowerFor(d,2+lvl*.6),d.name);
  if(/stun|knockdown|massStun/.test(effect))addEnemyStatus(e,'stun',d.debuffTurns??(1+Math.floor(lvl/5)),0,'Aturdido');
 }
 return true
}

// ---- Composable skill effects (Advanced/custom skills) ---------------------
// A skill can carry def.effects = [{kind,target,...}, ...] instead of a
// single classEffect tag: an ordered, stackable list of independent effect
// components (deal damage, apply a DOT, buff a stat, debuff a stat, heal,
// move/teleport, apply crowd control, drain), each with its own target
// (self/enemy/area) and its own dice/stat/turns configuration - reusing the
// exact same dmgDice/dmgStat/buffStat/debuffStat/etc fields the single-
// effect system already uses, just scoped per component instead of per
// skill. When def.effects is a non-empty array it is authoritative: the
// legacy classEffect dispatch in useSkill/resolveTargetedSkill is skipped
// entirely for that skill. This is how "dmg + bloodBuff-style self-buff +
// debuff all at once" gets expressed going forward, and how a caster
// targeting itself with a 'dmg' component becomes self-damage directly,
// with no need for a dedicated bloodBuff-style hack.
function effectKindLabel(kind){return {dmg:'Daño',dot:'Daño periódico (DOT)',buff:'Buff (mejora propia)',debuff:'Debuff (empeora al enemigo)',heal:'Curación',move:'Movimiento (dash/teleport)',cc:'Control (aturdir/congelar/silenciar)',drain:'Drenaje (daña y te cura)',aoe:'AOE (daño en área)',multihit:'Multihit (varios impactos)',mark:'Marca (aumenta el daño recibido)',summon:'Invocación (aliado temporal)',summonturret:'Invocación-torreta (aliado estático a distancia)',utility:'Utilidad',hot:'Curación periódica (HOT)',execute:'Ejecutar (umbral de % de vida)',pullroot:'Atraer + enraizar',counter:'Contraataque',cheatdeath:'Desafiar a la muerte'}[kind]||kind}
function hasEffectsList(id){const d=skillDefs[id];return Array.isArray(d?.effects)&&d.effects.length>0}
// What clicking/targeting the WHOLE skill needs, derived from its
// components: any component that must hit an enemy or an area drives the
// overall target mode (enemy beats area beats none); an all-self skill
// (pure buff/heal/move-self) needs no click at all, matching how the
// existing self-cast classEffect skills behave.
function effectsListTargetMode(id){
 const d=skillDefs[id];const list=d?.effects||[];
 if(list.some(c=>c.target==='enemy'))return'enemy';
 if(list.some(c=>c.target==='area'||(c.kind==='move'&&c.mode==='teleport')))return'area';
 if(list.some(c=>c.target==='ally'))return'ally';
 return null
}
function resolveComponentEnemyTargets(comp,ctx){
 if(comp.target==='area'){
  const radius=comp.range||2;
  return game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-ctx.x),Math.abs(e.y-ctx.y))<=radius&&hasLineOfSight(game.player,e));
 }
 return ctx.clickedEnemy?[ctx.clickedEnemy]:(ctx.nearest?[ctx.nearest]:[]);
}
function applyEffectComponent(id,comp,ctx){
 const d=skillDefs[id],p=game.player,lvl=skillLevel(id);
 if(comp.kind==='dmg'){
  if(comp.target==='self'){
   const power=dicePowerFor(comp,8+lvl*2,p);
   p.hp=Math.max(1,p.hp-power);floating(`-${power}`,p.x,p.y,'#ff8888');effect('flash');
   return true
  }
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:comp.multiplier||(comp.target==='area'?.85:1)});
  return true
 }
 if(comp.kind==='dot'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  for(const e of targets){attack(e,0,{skillId:id,multiplier:.7});addEnemyStatus(e,comp.flavor||'dot',comp.turns??4,dotPowerFor(comp,2+lvl*.7),d.name)}
  return true
 }
 if(comp.kind==='buff'){
  const stat=comp.stat||'strength',mode=comp.mode||'add',value=comp.value??(mode==='mult'?1.2:5),turns=comp.turns??(6+Math.floor(lvl/2));
  applyBuff(`${id}:${stat}`,d.name,turns,{[stat]:{mode,value}});
  return true
 }
 if(comp.kind==='debuff'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const mode=comp.mode||'add',value=comp.value??(mode==='mult'?.8:2),turns=comp.turns??(2+Math.floor(lvl/3));
  for(const e of targets){attack(e,0,{skillId:id,multiplier:.7});if(comp.stat)applyEnemyStatDebuff(e,comp.stat,mode,value,turns,d.name);else e.weakened=turns}
  return true
 }
 if(comp.kind==='heal'){
  const power=dicePowerFor(comp,8+lvl*3,p);
  if(comp.target==='ally'&&ctx.clickedAlly){
   healEntity(ctx.clickedAlly,power*2,ctx.clickedAlly.x,ctx.clickedAlly.y);
   sendMpAction('ally_heal',{targetId:ctx.clickedAlly.pjId,hpAmount:power*2,resAmount:power,resType:d.resource,id:crypto.randomUUID()});
  }else{
   healEntity(p,power*2);p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+power);
  }
  return true
 }
 if(comp.kind==='move'){
  const range=Math.max(1,comp.range||3);
  if(comp.mode==='teleport'){if(blocked(ctx.x,ctx.y)||game.enemies.some(e=>e.hp>0&&e.x===ctx.x&&e.y===ctx.y))return false;return teleportPlayerTo(ctx.x,ctx.y)}
  const dashTarget=ctx.clickedEnemy||ctx.nearest;if(!dashTarget)return false;
  const dx=Math.sign(dashTarget.x-p.x),dy=Math.sign(dashTarget.y-p.y);
  for(let i=0;i<range;i++){const nx=p.x+dx,ny=p.y+dy;if(blocked(nx,ny)||game.enemies.some(e=>e!==dashTarget&&e.x===nx&&e.y===ny)||(dashTarget.x===nx&&dashTarget.y===ny))break;p.x=nx;p.y=ny}
  reveal(p.x,p.y);attack(dashTarget,0,{skillId:id,multiplier:comp.multiplier||1});
  return true
 }
 if(comp.kind==='cc'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  for(const e of targets){attack(e,0,{skillId:id,multiplier:.75});addEnemyStatus(e,comp.type||'stun',comp.turns??2,0,d.name)}
  return true
 }
 if(comp.kind==='drain'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const power=dicePowerFor(comp,5+lvl*2,p);
  for(const e of targets)attack(e,0,{skillId:id,multiplier:.8});
  healEntity(p,power);p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+power);
  return true
 }
 if(comp.kind==='aoe'){
  const radius=Math.max(1,comp.range||2);
  const targets=game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-ctx.x),Math.abs(e.y-ctx.y))<=radius&&hasLineOfSight(p,e));
  if(!targets.length)return false;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:comp.multiplier||.85});
  return true
 }
 if(comp.kind==='multihit'){
  const target=ctx.clickedEnemy||ctx.nearest;if(!target)return false;
  const hits=Math.max(1,comp.hits||3);
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(let i=0;i<hits;i++)attack(target,0,{skillId:id,dice:expr,multiplier:comp.multiplier||.6});
  return true
 }
 if(comp.kind==='mark'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const turns=comp.turns??4,power=(comp.value??25)/100;
  for(const e of targets)addEnemyStatus(e,'mark',turns,power,d.name);
  return true
 }
 if(comp.kind==='summon'){
  const atk=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d4';
  summonCompanion('custom',comp.turns??8,1,{hp:comp.hp??20,atk,range:1,name:d.name,effectType:comp.effectType||'damage',actionsPerTurn:Math.max(1,Math.round((comp.ap??10)/10)),effectTurns:comp.effectTurns??2,iconImage:comp.iconImage||''});
  return true
 }
 if(comp.kind==='summonturret'){
  const atk=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d6+2';
  summonCompanion('custom',comp.turns??8,1,{hp:comp.hp??16,atk,range:Math.max(1,comp.range||7),name:d.name,effectType:'damage',actionsPerTurn:Math.max(1,Math.round((comp.ap??10)/10)),stationary:true,iconImage:comp.iconImage||''});
  return true
 }
 if(comp.kind==='utility'){
  const mode=comp.mode||'reveal';
  if(mode==='reveal'){
   const radius=Math.max(1,comp.value||10);
   for(let y=Math.max(0,p.y-radius);y<Math.min(ROWS,p.y+radius+1);y++)for(let x=Math.max(0,p.x-radius);x<Math.min(COLS,p.x+radius+1);x++)if(Math.hypot(x-p.x,y-p.y)<=radius)game.seen[y][x]=true;
   return true
  }
  if(mode==='stealth'){game.player.shadowVeil=1;return true}
  if(mode==='shield'){game.player.shield+=Math.max(1,comp.value||10);return true}
  if(mode==='resource'){const res=d.resource||'stamina',max=res==='mana'?'maxMana':'maxStamina';p[res]=Math.min(p[max],p[res]+Math.max(1,comp.value||10));return true}
  return false
 }
 if(comp.kind==='hot'){
  p.hots=p.hots||[];
  const power=dicePowerFor(comp,3+lvl,p);
  p.hots.push({turns:comp.turns??4,power});
  return true
 }
 if(comp.kind==='execute'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const threshold=(comp.threshold??35)/100,execMult=comp.execMultiplier??2.5;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:(e.hp/e.maxHp)<threshold?execMult:(comp.multiplier||1)});
  return true
 }
 if(comp.kind==='pullroot'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  for(const e of targets){
   attack(e,0,{skillId:id,multiplier:comp.multiplier||.8});
   const dx=Math.sign(p.x-e.x),dy=Math.sign(p.y-e.y),nx=e.x+dx,ny=e.y+dy;
   if(!blocked(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)){e.x=nx;e.y=ny}
   addEnemyStatus(e,'root',comp.turns??2,0,d.name);
  }
  return true
 }
 if(comp.kind==='counter'){
  p.shield+=Math.max(0,comp.shield??10);
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d8';
  p.counterReady={turns:comp.turns??5,damage:expr};
  return true
 }
 if(comp.kind==='cheatdeath'){
  p.cheatDeathTurns=Math.max(1,comp.turns??5);
  return true
 }
 return false
}
// Runs every component in def.effects against a shared cast context; a
// skill "succeeds" (consumes cost/cooldown) if ANY component actually did
// something, matching the existing used-flag convention.
function applySkillEffectsList(id,ctx){
 const list=skillDefs[id]?.effects||[];
 let used=false;
 for(const comp of list)if(applyEffectComponent(id,comp,ctx))used=true;
 return used
}

// ---- Action-point turn system ------------------------------------------------
// Always on in multiplayer; opt-in per dungeon in single player (world param
// apMode). A turn is a pool of points: attack/skill 10, move 5. The turn only
// passes via the PASAR TURNO button; enemies get their own pool (20 + AGI).
const AP_COSTS={move:5,attack:10,skill:10};
// Per-skill AP variance on top of the flat 10 baseline: quick utility/mobility
// costs a bit less, wide-hitting or execute/ultimate payoffs cost a bit more.
// Keyed by classEffect so it covers both the 12 shared class-skill tags and
// the newer per-class signature effects without needing a field on every one
// of the ~240 skill entries; anything not listed (the original generic-item
// skills, the Botín pool) stays at the AP_COSTS.skill baseline.
const AP_COST_BY_EFFECT={
 dash:8,utility:8,shield:9,heal:9,buff:9,
 debuff:10,ranged:10,
 aoe:12,multihit:12,execute:12,
 ultimate:14,massive:14,
 stun:11,silence:11,doomMark:11,swapConfuse:11,
 dot:11,drain:11,holyLeech:11,echoDot:11,hookBleed:11,
 bountyRoot:11,rootBleed:11,comboMark:11,lineShot:11,
 stormTotem:12,trap:12,shadowStrike:11
};
function skillApCost(id){const d=skillDefs[id];return d?.apCost??AP_COST_BY_EFFECT[d?.classEffect]??AP_COSTS.skill}
function apModeOn(){return !!(game&&(game.multiplayer||worldParams().apMode||game.player?.combatMode==='ap'))}
function playerMaxAP(){const st=game.player.derived?.finalStats||game.player.stats||{};const base=30+Math.ceil((st.agility||0)/2);return Math.max(1,Math.round(base*activeBuffMultFactor('ap')+activeBuffFlatBonus('ap')))}
function startPlayerAP(){if(game?.player)game.player.ap=playerMaxAP()}
function apCan(kind,cost=AP_COSTS[kind]){
 if(!apModeOn())return true;
 if(game.player.ap==null)startPlayerAP();
 if(game.player.ap>=cost)return true;
 log(`Sin puntos de acción para ${kind==='move'?'moverte':'esa acción'} (${game.player.ap} PA). Pasa turno.`,'sys');
 return false;
}
// Replaces the old per-action playerFinished(): spends points and keeps the turn.
function actionDone(kind,cost=AP_COSTS[kind]){
 if(!apModeOn())return playerFinished();
 if(game.player.ap==null)startPlayerAP();
 game.player.ap=Math.max(0,game.player.ap-cost);
 busy=false;updateUI();requestAnimationFrame(animate);
 // not enough AP left for even a move (5) - force the turn to end instead of
 // leaving the player stuck staring at a "PASAR TURNO" button they still
 // have to click themselves
 if(game.player.ap<5){log('Sin puntos de acción suficientes: turno pasado automáticamente.','sys');playerFinished()}
}
function playerFinished(){
 if(document.getElementById('statPointModal')?.classList.contains('open')||document.getElementById('skillChoiceModal')?.classList.contains('open')){game.pendingPlayerFinished=true;busy=false;updateUI();draw();return}
 if(game.multiplayer){
  if(!game.myTurn){busy=true;return}
  playerFinishedMultiplayer();return;
 }
 busy=true;persistTurnState();game.turn++;tickFloorObjective();classSkillConsistencyGuard();tickPotionEffects();tickBuffs();tickPlayerHots();tickPlayerRegen();tickEnemyStatuses();tickSkillObjects();companionTurn();for(const id in game.player.cooldowns)if(game.player.cooldowns[id]>0)game.player.cooldowns[id]--;if(game.player.shield>0)game.player.shield--;
 updateUI();requestAnimationFrame(animate);
 setTimeout(()=>{enemyTurn(()=>{startPlayerAP();busy=false;updateUI();draw()})},500);
}
async function playerFinishedMultiplayer(){
 busy=true;
 if(game.over)return; // death flow persists its own state
 for(const id in game.player.cooldowns)if(game.player.cooldowns[id]>0)game.player.cooldowns[id]--;
 if(game.player.shield>0)game.player.shield--;
 updateUI();requestAnimationFrame(animate);
 const order=(game.turnOrder&&game.turnOrder.length)?game.turnOrder:[game.pjId];
 const myIndex=order.findIndex(id=>String(id)===String(game.pjId));
 const isLast=myIndex===-1||myIndex===order.length-1;
 if(isLast){
  // last player in the order resolves the enemy phase, then hands the turn back to player 1
  mpSetMyTurn(false,'enemies');
  game.mpCapture=true;
  game.mpEnemyPhase=true;
  setTimeout(async()=>{
   try{
    if(!game.over){
     sendMpAction('enemy_phase_start',{});
     classSkillConsistencyGuard();tickPotionEffects();tickBuffs();tickPlayerHots();tickPlayerRegen();tickEnemyStatuses();tickSkillObjects();companionTurn();
     const t0=MP_DEBUG_LATENCY?performance.now():0;
     // enemyTurn() itself now paces each action with a real delay (PA mode,
     // always on in multiplayer) - each sendMpAction call it makes goes out
     // as it happens, so enemies act consecutively for every client instead
     // of a synchronous burst followed by a separate fake local replay.
     await new Promise(resolve=>enemyTurn(resolve));
     if(MP_DEBUG_LATENCY)mpDebugEvent('enemy_phase_duration',{ms:performance.now()-t0,enemyCount:(game.enemies||[]).length});
     sendMpAction('enemy_phase_end',{});
    }
    game.mpCapture=false;
    game.turn=(game.turn||0)+1;
    tickFloorObjective();
    await mpAdvanceTurn(0);
   }finally{game.mpEnemyPhase=false}
   draw();
   if(!game.over)mpSetMyTurn(String((game.turnOrder||[])[game.activePlayerIndex||0])===String(game.pjId));
  },60);
 }else{
  mpSetMyTurn(false);
  await mpAdvanceTurn(myIndex+1);
  draw();
 }
}

// Single exit point for "my turn is over". Live mode publishes the transition
// over the channel (instant, no DB) and only checkpoints the DB every
// MP_CHECKPOINT_EVERY rounds or on events that must survive a reload. Without
// realtime it degrades to the previous behaviour: one DB write per turn.
async function mpAdvanceTurn(nextIdx){
 if(!game?.multiplayer)return;
 const live=mpLive();
 if(live){
  game.activePlayerIndex=nextIdx;
  mpPublishTurn(nextIdx);
  game.mpPendingEvents=[];
  game.mpDirty=true;
  const roundsDone=game.turn||0;
  const roundClosed=nextIdx===0; // I just resolved the enemy phase
  const mustCheckpoint=game.floor!==game.mpCheckpointFloor||(roundClosed&&roundsDone-(game.mpCheckpointTurn||0)>=MP_CHECKPOINT_EVERY);
  if(mustCheckpoint)await mpCheckpoint({advance:false});
  }else{
  await mpPersistTurnState({advance:true,includeOtherPlayers:true});
 }
}

// DB checkpoint: persists the authoritative state so a reload/reconnect can
// resume. Carries the live `seq` so peers and checkpoints stay comparable.
async function mpCheckpoint(opts={}){
 if(!game?.multiplayer||!game.dungeonStatusId)return;
 game.mpCheckpointTurn=game.turn||0;
 game.mpCheckpointFloor=game.floor;
 game.mpDirty=false;
 await mpPersistTurnState({advance:false,includeOtherPlayers:true,checkpoint:true,...opts});
}

function permanentDeath(){const p=game.player;game.over=true;finalizeCharacterDeath();try{localStorage.clear()}catch(e){}storyTitle.textContent='GAME OVER';storyBody.innerHTML=`<div class="narrative gameOverBox"><p class="gameOverName"><b>${p.name||'Tu personaje'} ha muerto.</b></p><div class="gameOverStats"><div><span class="small">Nivel de héroe</span><b>${p.level}</b></div><div><span class="small">Nivel de mazmorra</span><b>${game.floor}</b></div></div><p class="small">Muerte permanente: la partida se ha eliminado y no puede continuar.</p><div class="startActions"><button id="restartAfterDeath">Crear nuevo personaje</button></div></div>`;storyOverlay.classList.remove('hidden');setTimeout(()=>document.getElementById('restartAfterDeath')?.addEventListener('click',()=>location.reload()),0)}
// onDone is called once every enemy has finished acting. In AP mode (always
// on in multiplayer, optional in single player) each individual action is
// paced with a real setTimeout gap instead of resolving the whole phase in
// one synchronous burst, so enemies visibly act one after another - single
// player sees it live, and multiplayer's actual sendMpAction calls go out
// spaced the same way, instead of all at once with a separate fake replay
// tacked on afterward.
function enemyTurn(onDone){if(game.over){onDone?.();return}if((game.player.activePotions||[]).some(b=>b.effect?.invisible)){log('La invisibilidad evita la respuesta enemiga.','good');onDone?.();return}if(game.player.shadowVeil){game.player.shadowVeil=0;log('El velo de sombras evita la respuesta enemiga.','good');onDone?.();return}
 if(game.multiplayer)mpEnsureEnemyIds(); // per-action pings below need e.eid to already exist
 const visible=game.enemies.filter(e=>game.seen[e.y][e.x]);if(visible.filter(e=>Math.abs(e.x-game.player.x)<=1&&Math.abs(e.y-game.player.y)<=1).length>=3)unlock('crowd','Reunión multitudinaria','Ten 3 enemigos adyacentes.');
 // One decision per call; returns the AP cost (0 = nothing left to do this turn).
 const enemySingleAction=e=>{
  if(game.over)return 0;
  if(!game.seen[e.y][e.x])return 0;
  if(enemyHasStatus(e,'freeze')||enemyHasStatus(e,'stun')||enemyHasStatus(e,'root')&&Math.abs(e.x-game.player.x)+Math.abs(e.y-game.player.y)>1)return 0;
  const possibleTargets=[game.player,...(game.companions||[]).filter(c=>c.hp>0),...(game.otherPlayers||[]).filter(pl=>pl.hp>0)];
  const chosen=possibleTargets.sort((a,b)=>(Math.abs(e.x-a.x)+Math.abs(e.y-a.y))-(Math.abs(e.x-b.x)+Math.abs(e.y-b.y)))[0];
  const dist=Math.abs(e.x-chosen.x)+Math.abs(e.y-chosen.y);
  const chosenRef=game.multiplayer?mpEntityRef(chosen):null;
  if(enemyUseSkill(e,dist,chosen))return AP_COSTS.skill;
  const w=e.weapon,wRanged=w&&w.kind!=='melee'&&(w.rangeMax||1)>1;
  // shoot/cast with the equipped ranged weapon
  if(wRanged&&dist>1&&dist<=w.rangeMax&&hasLineOfSight(e,chosen)&&Math.random()<.85){
   const dmg=Math.max(1,Math.round(e.atk||e.damage||4));
   if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:chosen===game.player?dmg:Math.round(dmg*.9),result:w.kind==='magic'?'spell':'ranged'});
   rangedTracer(e.x,e.y,chosen.x,chosen.y,w.kind==='magic'?'#be82ff':'#ffd27a');
   floating(w.kind==='magic'?'✦':'➶',e.x,e.y,w.kind==='magic'?'#be82ff':'#ffd27a');
   if(chosen===game.player)damagePlayer(dmg,w.kind==='magic'?'wisdom':'agility',`${e.name} dispara su ${w.name}`);
   else{const d2=Math.max(1,Math.round(dmg*.9));chosen.hp-=d2;floating(`-${d2}`,chosen.x,chosen.y,'#ff8888');log(`${e.name} dispara a ${chosen.name} con su ${w.name}.`,'combat')}
   return AP_COSTS.attack;
  }
  // ranged classes try to back away from melee contact
  if(wRanged&&dist===1&&Math.random()<.5){
   const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-.5);
   let stepped=false;
   for(const[mx,my]of dirs){const nx=e.x+mx,ny=e.y+my;if(Math.abs(nx-chosen.x)+Math.abs(ny-chosen.y)>1&&!blocked(nx,ny)&&!isSafeCell(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)&&!(game.player.x===nx&&game.player.y===ny)){const from={x:e.x,y:e.y};e.x=nx;e.y=ny;if(game.multiplayer)sendMpAction('enemy_move',{entityType:'enemy',entityId:e.eid,from,to:{x:nx,y:ny}});stepped=true;break}}
   if(stepped)return AP_COSTS.move;
  }
  if(dist===1&&chosen!==game.player){
   if(game.multiplayer&&chosenRef){const dmgv=Math.max(1,Math.round(e.atk||e.damage||4));sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:dmgv})}
   const dmg=Math.max(1,Math.round(e.atk||e.damage||4));chosen.hp-=dmg;floating(`-${dmg}`,chosen.x,chosen.y,'#ff8888');log(`${e.name} golpea a ${chosen.name} por ${dmg}.`,'combat');return AP_COSTS.attack
  }
  if(dist===1){if(e.type==='orcoKamikaze'){if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:e.atk+5,result:'explode'});floating('¡BOOM!',e.x,e.y,'#ff8b4f');damagePlayer(e.atk+5,'vitality',`${e.name} explota`);e.hp=0;kill(e);return AP_COSTS.attack}if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:Math.max(1,e.atk-(game.player.debuff||0)-(e.weakened||0))});damagePlayer(Math.max(1,e.atk-(game.player.debuff||0)-(e.weakened||0)),/wolf|hound|goblin|vamp/i.test(e.type)?'agility':'vitality',`${e.name} ataca`);if(e.type==='vampiro')healEntity(e,3,e.x,e.y);return AP_COSTS.attack}
  if(!w&&chosen===game.player&&['chamanGoblin','liche','licheEnloquecido','archiliche'].includes(e.type)&&dist<=5&&hasLineOfSight(e,game.player)&&Math.random()<.45){if(game.multiplayer)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},target:{x:game.player.x,y:game.player.y},targetType:'player',targetId:String(game.pjId),visualAmount:e.atk,icon:'✦'});damagePlayer(e.atk,/liche|chaman|mage|priest/i.test(e.type)?'wisdom':'intelligence',`${e.name} lanza un ataque mágico`);floating('✦',e.x,e.y,'#be82ff');return AP_COSTS.attack}
  // shooters hold position while target is in range and sight
  if(wRanged&&dist<=w.rangeMax&&hasLineOfSight(e,chosen))return 0;
  if(dist<8){const opts=Math.random()<.5?[[Math.sign(chosen.x-e.x),0],[0,Math.sign(chosen.y-e.y)]]:[[0,Math.sign(chosen.y-e.y)],[Math.sign(chosen.x-e.x),0]];for(const[mx,my]of opts){const nx=e.x+mx,ny=e.y+my;if(!blocked(nx,ny)&&!isSafeCell(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)&&!(game.player.x===nx&&game.player.y===ny)){const from={x:e.x,y:e.y};e.x=nx;e.y=ny;if(game.multiplayer)sendMpAction('enemy_move',{entityType:'enemy',entityId:e.eid,from,to:{x:nx,y:ny}});return AP_COSTS.move}}}
 
  return 0;
 };
 const finishEnemyTurn=()=>{
  if(game.player.hp<=0&&!game.over){game.player.hp=0;game.over=true;updateUI();draw();permanentDeath();onDone?.();return}
  onDone?.();
 };
 if(!apModeOn()){
  // classic mode: exactly one action per enemy, resolved synchronously
  // (unchanged from before - no pacing requested for this mode)
  for(const e of [...game.enemies]){
   if(game.over)break;
   if(e.hp<=0)continue;
   enemySingleAction(e);
  }
  finishEnemyTurn();
  return;
 }
 // AP mode: each enemy keeps acting (in order) until its pool runs out, one
 // action at a time, with a real delay between actions so the whole phase
 // doesn't resolve in a single synchronous burst.
 const queue=[...game.enemies];
 const stepEnemy=(idx)=>{
  if(game.over){finishEnemyTurn();return}
  if(idx>=queue.length){finishEnemyTurn();return}
  const e=queue[idx];
  if(e.hp<=0){stepEnemy(idx+1);return}
  let ap=20+Math.ceil(e.stats?.agility||0);
  const stepAction=()=>{
   if(game.over){finishEnemyTurn();return}
   if(ap<=0||e.hp<=0||!game.enemies.includes(e)){stepEnemy(idx+1);return}
   const cost=enemySingleAction(e);
   draw();updateUI();
   if(!cost){stepEnemy(idx+1);return}
   ap-=cost;
   setTimeout(stepAction,160);
  };
  stepAction();
 };
 stepEnemy(0);
}

let pendingTargetAction=null;
const AREA_SKILLS=new Set(['smash','quake','ironRain','scrapGrenade','chainSpark','gravityWell','holyCircuit','entropyWave','stormTotem','alchemicalNova','blackSun','worldBreaker','adminOverride','lootSingularity']);
const ENEMY_TARGET_SKILLS=new Set(['arcSlash','ironHook','manaBolt','shockTrap','toxicEdge','spiritWolf','quantumThief','charge','execute']);
function equippedWeapon(){return game?.player?.equipment?.weapon||null}
function weaponRangePresetForItem(item=equippedWeapon()){
 if(!item)return null;
 const declared=item.weaponType&&weaponTypeRanges[item.weaponType]?item.weaponType:null;
 if(declared)return weaponTypeRanges[declared];
 const text=`${item.weaponType||''} ${item.weaponCategory||''} ${item.name||''} ${item.iconShape||''}`.toLowerCase();
 if(/varita/.test(text))return weaponTypeRanges.Varitas;
 if(/arco/.test(text))return weaponTypeRanges.Arcos;
 if(/ballesta/.test(text))return weaponTypeRanges.Ballestas;
 if(/pistola|revólver|revolver/.test(text))return weaponTypeRanges.Pistolas;
 if(/rifle|fusil|carabina/.test(text))return weaponTypeRanges.Rifles;
 if(/escopeta/.test(text))return weaponTypeRanges.Escopetas;
 return null
}
function normalizeWeaponRangeValue(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.round(n)):fallback}
function weaponIsRanged(item=equippedWeapon()){return !!weaponRangePresetForItem(item)}
function weaponRangeBounds(item=equippedWeapon()){
 const preset=weaponRangePresetForItem(item);
 const min=normalizeWeaponRangeValue(item?.rangeMin??item?.minRange??item?.alcanceMinimo,preset?.min||1);
 const max=normalizeWeaponRangeValue(item?.rangeMax??item?.maxRange??item?.alcanceMaximo,preset?.max||1);
 return {min:Math.min(min,max),max:Math.max(min,max)}
}
function weaponRange(item=equippedWeapon()){return weaponRangeBounds(item).max}

function rangeDamageMultiplier(range,area=false){
 range=Math.max(1,Number(range)||1);
 // Cada casilla adicional sacrifica una pequeña parte del daño. Las áreas pagan además por cobertura.
 const distancePenalty=Math.min(.32,(range-1)*.035);
 const areaPenalty=area?.10:0;
 return Math.max(.58,1-distancePenalty-areaPenalty)
}
function attackRangeLabel(){
 const weapon=equippedWeapon(),bounds=weaponRangeBounds(weapon),def=inferWeaponDefenseStat(weapon);
 const rangeText=bounds.min===bounds.max?`Alcance ${bounds.max} casilla${bounds.max===1?'':'s'}`:`Alcance ${bounds.min}-${bounds.max}`;
 return `${rangeText} · defensa: ${attackDefenseLabel(def)} · ${bounds.max>1?Math.round(rangeDamageMultiplier(bounds.max)*100)+'% daño':'daño completo'}`
}
function skillRangeLabel(id){
 const r=skillRange(id),area=skillTargetMode(id)==='area',pct=Math.round(rangeDamageMultiplier(r,area)*100);
 return `Alcance ${r} · ${area?'Área · ':''}defensa: ${attackDefenseLabel(inferSkillDefenseStat(id))} · ${pct}% daño base`
}

// Heal-flavored class skills self-target by default (unchanged for single
// player); in multiplayer, with a living ally around, they open ally-or-self
// targeting instead, since there was previously no way to ever heal a party
// member. Scoped to the classEffect:'heal' skills specifically (not the
// handful of bespoke self-only utility skills like campfire/cleanse, which
// keep their own distinct behavior untouched).
function isSelfHealSkill(id){return skillDefs[id]?.classEffect==='heal'}
function skillTargetMode(id){
 const d=skillDefs[id];if(!d)return null;
 if(hasEffectsList(id))return effectsListTargetMode(id);
 if(d.targetMode==='self')return null;
 if(d.targetMode==='area')return 'area';
 if(d.targetMode==='enemy')return 'enemy';
 if(isSelfHealSkill(id)&&game?.multiplayer&&(game.otherPlayers||[]).some(p=>p.hp>0))return 'ally';
 if(d.type==='utility')return null;
 if(AREA_SKILLS.has(id)||['aoe','ultimate','massive','multihit'].includes(d.classEffect))return 'area';
 if(ENEMY_TARGET_SKILLS.has(id)||d.classEffect==='ranged'||d.classEffect==='debuff'||d.classEffect==='execute'||isRangedSkill(id))return 'enemy';
 return null
}
function beginTargeting(action){
 pendingTargetAction=action;updateUI();document.getElementById('waitBtn')?.classList.add('hidden');document.getElementById('cancelTargetBtn')?.classList.remove('hidden');
 document.getElementById('gameStage')?.classList.add('targeting');
 const hint=document.getElementById('targetHint');
 if(hint){const rangeText=action.minRange&&action.minRange!==action.range?`${action.minRange}-${action.range}`:action.range;hint.textContent=action.mode==='area'?`Selecciona el centro del área · alcance ${rangeText} · ESC para cancelar`:action.mode==='ally'?`Selecciona un aliado o a ti mismo · alcance ${rangeText} · ESC para cancelar`:`Selecciona un enemigo · alcance ${rangeText} · ESC para cancelar`;hint.classList.remove('hidden')}
 closeInspect()
}
function cancelTargeting(message='Apuntado cancelado.'){
 pendingTargetAction=null;document.getElementById('waitBtn')?.classList.remove('hidden');document.getElementById('cancelTargetBtn')?.classList.add('hidden');document.getElementById('gameStage')?.classList.remove('targeting');document.getElementById('targetHint')?.classList.add('hidden');if(message)log(message,'sys')
}
function gridDistance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))}
function validateTargetCell(x,y,range,minRange=1){const dist=gridDistance(game.player,{x,y});return game.seen?.[y]?.[x]&&dist>=minRange&&dist<=range&&hasLineOfSight(game.player,{x,y})}
function targetedSkillDamage(id){const d=skillDefs[id],lvl=skillLevel(id),stat=d.resource==='mana'?game.player.stats.intelligence+game.player.stats.wisdom/2:game.player.stats.strength+game.player.stats.agility/3;return Math.round((5+lvl*2+stat)*skillPowerMultiplier(id))}
function resolveTargetedSkill(slot,x,y){
 const id=game.player.equippedSkills[slot],d=skillDefs[id];if(!id||!d)return false;
 const range=skillRange(id)||1,mode0=skillTargetMode(id);
 if(!validateTargetCell(x,y,range,mode0==='ally'?0:1)){log(`Objetivo fuera de alcance o sin línea de visión (${range}).`,'sys');return false}
 const cd=game.player.cooldowns[id]||0;
 if(cd>0){log('La habilidad está en enfriamiento.','sys');return false}
 if(game.player[d.resource]<d.cost){log(`Necesitas ${d.cost} ${d.resource==='mana'?'de maná':'de stamina'}; tienes ${game.player[d.resource]}.`,'sys');cancelTargeting('');return false}
 const mode=mode0,rangeMult=rangeDamageMultiplier(range,mode==='area'),base=Math.max(1,Math.round(targetedSkillDamage(id)*rangeMult));let used=false;
 if(game.multiplayer)sendMpAction('spell',{casterId:game.pjId,origin:{x:game.player.x,y:game.player.y},target:{x,y},spellId:id,icon:d.icon});
 if(hasEffectsList(id)){
  const clickedEnemy=game.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
  const clickedAlly=!clickedEnemy&&game.multiplayer?(game.otherPlayers||[]).find(p=>p.hp>0&&p.x===x&&p.y===y):null;
  if(mode==='enemy'&&!clickedEnemy){log('Debes seleccionar un enemigo.','sys');return false}
  used=applySkillEffectsList(id,{x,y,clickedEnemy,nearest:clickedEnemy,clickedAlly});
  if(!used&&mode==='area')log('No hay enemigos dentro del área seleccionada.','sys');
 }else if(mode==='enemy'){
  const enemy=game.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);if(!enemy){log('Debes seleccionar un enemigo.','sys');return false}
  if(d.classId&&!GENERIC_CLASS_EFFECTS.has(d.classEffect)&&applyCreativeClassEffect(id,enemy,x,y)){used=true}
  if(used){}else{
  let mult=d.rarity==='legendary'?2.2:d.rarity==='epic'?1.75:d.rarity==='rare'?1.4:1.1;
  if(d.classEffect==='execute'||id==='execute')mult*=enemy.hp/enemy.maxHp<.4?2.35:1;
  attack(enemy,0,{skillId:id,multiplier:mult*rangeMult});
  if(d.classEffect==='debuff'||['shockTrap','ironHook'].includes(id)){const turns=d.debuffTurns??(2+Math.floor(skillLevel(id)/3));if(d.classEffect==='debuff'&&d.debuffStat){const mode=d.debuffStatMode||'add';applyEnemyStatDebuff(enemy,d.debuffStat,mode,d.debuffStatCoef??(mode==='mult'?.8:2),turns,d.name)}else enemy.weakened=turns;enemy.stunned=1}
  if(id==='quantumThief'){healEntity(game.player,6+skillLevel(id));game.player.mana=Math.min(game.player.maxMana,game.player.mana+5+skillLevel(id));game.player.gold+=3+skillLevel(id)}
  used=true}
 }else if(mode==='area'){
  const radius=Math.min(4,1+Math.floor(skillLevel(id)/4)+(d.tier===3?1:0));
  const targets=game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=radius&&game.seen?.[e.y]?.[e.x]&&hasLineOfSight(game.player,e));
  if(d.classId&&!GENERIC_CLASS_EFFECTS.has(d.classEffect)&&applyCreativeClassEffect(id,targets[0]||null,x,y)){used=true}
  if(!used&&!targets.length){log('No hay enemigos dentro del área seleccionada.','sys');return false}
  const mult=['blackSun','worldBreaker'].includes(id)||d.classEffect==='massive'?1.65:d.classEffect==='ultimate'?1.35:1;
  if(!used){targets.forEach(e=>attack(e,0,{skillId:id,multiplier:mult*rangeMult*.85}));floating('ÁREA',x,y,'#d989ff');used=true}
 }else if(mode==='ally'){
  const isSelf=x===game.player.x&&y===game.player.y;
  const ally=!isSelf?(game.otherPlayers||[]).find(p=>p.hp>0&&p.x===x&&p.y===y):null;
  if(!isSelf&&!ally){log('Selecciona un aliado o a ti mismo.','sys');return false}
  const hpAmount=base*2,resAmount=base;
  if(isSelf){
   healEntity(game.player,hpAmount);
   game.player[d.resource]=Math.min(game.player[d.resource==='mana'?'maxMana':'maxStamina'],game.player[d.resource]+resAmount);
  }else{
   healEntity(ally,hpAmount,ally.x,ally.y); // visual only here - the real hp change happens on the ally's own client
   sendMpAction('ally_heal',{targetId:ally.pjId,hpAmount,resAmount,resType:d.resource,id:crypto.randomUUID()});
   log('Curas a tu aliado.','good');
  }
  used=true;
 }
 if(!used)return false;
 if(!apCan('skill',skillApCost(id)))return false;
 game.player[d.resource]-=d.cost;game.player.cooldowns[id]=Math.max(1,d.cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');cancelTargeting('');actionDone('skill',skillApCost(id));return true
}
function beginBasicAttack(){
 if(!game||busy||game.over)return;
 const weapon=equippedWeapon();
 if(weaponIsRanged(weapon)){const bounds=weaponRangeBounds(weapon);beginTargeting({kind:'attack',mode:'enemy',range:bounds.max,minRange:bounds.min});return}
 const adjacent=game.enemies.filter(e=>gridDistance(game.player,e)<=1);
 if(adjacent.length===1){if(!apCan('attack'))return;attack(adjacent[0]);actionDone('attack')}else if(adjacent.length>1){beginTargeting({kind:'attack',mode:'enemy',range:1})}else log('No hay ningún enemigo al alcance del arma.','sys')
}
function resolveBasicAttack(x,y){
 const bounds=weaponRangeBounds(),range=pendingTargetAction?.range||bounds.max,minRange=pendingTargetAction?.minRange||bounds.min,enemy=game.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
 if(!enemy){log('Selecciona un enemigo.','sys');return false}
 if(!validateTargetCell(x,y,range,minRange)){log(`Enemigo fuera de alcance (${minRange}-${range}) o sin línea de visión.`,'sys');return false}
 if(!apCan('attack'))return false;
 attack(enemy,0,{dice:baseAttackDice(),multiplier:rangeDamageMultiplier(range,false)});cancelTargeting('');actionDone('attack');return true
}

function useSkill(slot){
 if(!game||busy||game.over)return;const id=game.player.equippedSkills[slot];if(!id)return;const def=skillDefs[id],cd=game.player.cooldowns[id]||0;if(cd>0){log('La habilidad está en enfriamiento.','sys');return}if(game.player[def.resource]<def.cost){log(`No tienes suficiente ${def.resource==='mana'?'maná':'stamina'}.`,'sys');return}
 const targetMode=skillTargetMode(id);if(targetMode){beginTargeting({kind:'skill',slot,mode:targetMode,range:skillRange(id),minRange:targetMode==='ally'?0:1});return}
 if(game.multiplayer)sendMpAction(def.classEffect==='heal'?'heal':'spell',{casterId:game.pjId,origin:{x:game.player.x,y:game.player.y},spellId:id,icon:def.icon});
 if(hasEffectsList(id)){
  // All-self composable skill (skillTargetMode already returned null, so
  // every component targets 'self') - self-contained, returns directly
  // instead of falling into the legacy id-specific/classEffect chain below.
  const visible=visibleEnemiesInRange(def.range||8),nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const used=applySkillEffectsList(id,{x:game.player.x,y:game.player.y,clickedEnemy:nearest,nearest});
  if(!used){log('No hay un objetivo válido.','sys');return}
  if(!apCan('skill',skillApCost(id)))return;
  game.player[def.resource]-=def.cost;game.player.cooldowns[id]=Math.max(1,def.cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');actionDone('skill',skillApCost(id));
  return
 }
 const near=(r)=>game.enemies.filter(e=>Math.max(Math.abs(e.x-game.player.x),Math.abs(e.y-game.player.y))<=r);
 let used=!def.classEffect&&skillDefs[id]?.unlock!=='Botín';
 const skillMult=skillPowerMultiplier(id);if(id==='smash'){const a=near(1);if(!a.length)used=false;else a.forEach(e=>attack(e,Math.round(Math.floor(total('armor')/2)*skillMult),{skillId:id}))}
 if(id==='fortify'){const turns=4+Math.floor(skillLevel(id)/2);applyBuff(id,'Fortificar',turns,{armor:.30});game.player.shield+=5+Math.floor(game.player.stats.vitality/2);used=true}
 if(id==='charge'){let target=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let n=1;n<=3;n++){const x=game.player.x+dx*n,y=game.player.y+dy*n,e=game.enemies.find(e=>e.x===x&&e.y===y);if(e){target={e,dx,dy,n};break}if(blocked(x,y))break;if(target)break}if(!target)used=false;else{for(let n=1;n<target.n;n++){game.player.x+=target.dx;game.player.y+=target.dy}attack(target.e,Math.round((game.player.stats.strength)*skillMult),{skillId:id});reveal(game.player.x,game.player.y)}}
 if(id==='quake'){const a=near(2);if(!a.length)used=false;else a.forEach(e=>attack(e,Math.round((2+game.player.stats.intelligence+Math.floor(game.player.stats.wisdom/2))*skillMult),{skillId:id}))}
 if(id==='taunt'){const a=game.enemies.filter(e=>game.seen[e.y][e.x]);if(!a.length)used=false;else{game.player.debuff=2;a.forEach(e=>{if(Math.abs(e.x-game.player.x)>1)e.x+=Math.sign(game.player.x-e.x);if(Math.abs(e.y-game.player.y)>1)e.y+=Math.sign(game.player.y-e.y)});log('Todos te odian un poco más.','combat')}}
 if(id==='lootMagnet'){let n=0;for(const c of game.chests)if(!c.opened&&Math.abs(c.x-game.player.x)+Math.abs(c.y-game.player.y)<=3){openChest(c);n++}for(const k of [...game.keys])if(Math.abs(k.x-game.player.x)+Math.abs(k.y-game.player.y)<=3){game.keys=game.keys.filter(x=>x!==k);game.player.keys++;n++}if(!n)used=false}
 if(id==='ironRain'){const a=game.enemies.filter(e=>game.seen[e.y][e.x]);if(!a.length)used=false;else for(let i=0;i<Math.min(6,a.length+2);i++)attack(pick(a),Math.round((3+game.player.stats.intelligence+rng(6))*skillMult),{skillId:id})}
 


 if(!used&&def.classId&&def.targetMode==='self'&&!GENERIC_CLASS_EFFECTS.has(def.classEffect))used=applyCreativeClassEffect(id,null,game.player.x,game.player.y);
 if(!used&&def.classEffect){
  const lvl=skillLevel(id),visible=visibleEnemiesInRange(def.range||8),nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const base=resolveSkillPower(id);
  if(def.classEffect==='ranged'&&nearest){attack(nearest,base,{skillId:id});used=true}
  else if(def.classEffect==='shield'){const turns=def.buffTurns??(4+Math.floor(lvl/2));applyBuff(id,def.name,turns,{armor:.22+lvl*.01});game.player.shield+=resolveSkillPower(id);used=true}
  else if(def.classEffect==='dash'&&nearest){const dx=Math.sign(nearest.x-game.player.x),dy=Math.sign(nearest.y-game.player.y);for(let i=0;i<3;i++){const nx=game.player.x+dx,ny=game.player.y+dy;if(blocked(nx,ny)||game.enemies.some(e=>e!==nearest&&e.x===nx&&e.y===ny)||nearest.x===nx&&nearest.y===ny)break;game.player.x=nx;game.player.y=ny}attack(nearest,base,{skillId:id});reveal(game.player.x,game.player.y);used=true}
  else if(def.classEffect==='debuff'&&nearest){attack(nearest,base,{skillId:id});const turns=def.debuffTurns??(2+Math.floor(lvl/3));if(def.debuffStat){const mode=def.debuffStatMode||'add';applyEnemyStatDebuff(nearest,def.debuffStat,mode,def.debuffStatCoef??(mode==='mult'?.8:2),turns,def.name)}else nearest.weakened=turns;used=true}
  else if(def.classEffect==='aoe'){const a=near(2+Math.floor(lvl/5));if(a.length){a.forEach(e=>attack(e,Math.round(base*.8),{skillId:id}));used=true}}
  else if(def.classEffect==='heal'){healEntity(game.player,base*2);game.player[def.resource]=Math.min(game.player[def.resource==='mana'?'maxMana':'maxStamina'],game.player[def.resource]+base);used=true}
  else if(def.classEffect==='multihit'&&visible.length){for(let i=0;i<Math.min(3+Math.floor(lvl/3),visible.length+1);i++)attack(pick(visible),Math.round(base*.7),{skillId:id});used=true}
  else if(def.classEffect==='utility'){const radius=7+lvl;for(let y=Math.max(0,game.player.y-radius);y<Math.min(ROWS,game.player.y+radius+1);y++)for(let x=Math.max(0,game.player.x-radius);x<Math.min(COLS,game.player.x+radius+1);x++)if(Math.hypot(x-game.player.x,y-game.player.y)<=radius)game.seen[y][x]=true;game.player.shadowVeil=1;used=true}
  else if(def.classEffect==='ultimate'&&visible.length){visible.slice(0,6+lvl).forEach(e=>attack(e,Math.round(base*1.25),{skillId:id}));used=true}
  else if(def.classEffect==='execute'&&nearest){attack(nearest,Math.round(base*(nearest.hp/nearest.maxHp<.4?2.5:1)),{skillId:id});used=true}
  else if(def.classEffect==='buff'){const turns=def.buffTurns??(6+Math.floor(lvl/2));const stat=def.buffStat||'strength';const mode=def.buffStatMode||'add';const value=def.buffStatCoef??(mode==='mult'?1.2:5);applyBuff(id,def.name,turns,{[stat]:{mode,value}});game.player.shield+=5+lvl*2;used=true}
  else if(def.classEffect==='massive'&&visible.length){visible.forEach(e=>attack(e,Math.round(base*1.7),{skillId:id}));used=true}
 }

 if(!used&&def.type==='utility'){
  const lvl=skillLevel(id);
  if(id==='arcaneLantern'){
   const radius=8+lvl*2;for(let y=Math.max(0,game.player.y-radius);y<Math.min(ROWS,game.player.y+radius+1);y++)for(let x=Math.max(0,game.player.x-radius);x<Math.min(COLS,game.player.x+radius+1);x++)if(Math.hypot(x-game.player.x,y-game.player.y)<=radius)game.seen[y][x]=true;
   log('La luz arcana revela corredores y salas cercanas.','good');used=true
  }else if(id==='phaseKey'){
   let n=0;for(const d of game.doors)if(!d.open&&Math.abs(d.x-game.player.x)+Math.abs(d.y-game.player.y)<=4+lvl){d.open=true;d.locked=false;n++}
   used=n>0;if(used)log(`Abres ${n} puerta(s) con magia de fase.`,'good')
  }else if(id==='mistStep'){
   const candidates=[];for(let y=Math.max(1,game.player.y-6);y<Math.min(ROWS-1,game.player.y+7);y++)for(let x=Math.max(1,game.player.x-6);x<Math.min(COLS-1,game.player.x+7);x++)if(game.seen[y][x]&&!blocked(x,y)&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))candidates.push({x,y,d:Math.abs(x-game.player.x)+Math.abs(y-game.player.y)});
   const dest=candidates.sort((a,b)=>b.d-a.d)[0];if(dest){game.player.x=dest.x;game.player.y=dest.y;anim.heroX=anim.targetX=dest.x;anim.heroY=anim.targetY=dest.y;reveal(dest.x,dest.y);used=true}
  }else if(id==='cleanse'){
   game.player.debuff=0;healEntity(game.player,8+lvl*3);used=true
  }else if(id==='campfire'){
   healEntity(game.player,Math.round(game.player.maxHp*(.22+lvl*.02)));
   game.player.mana=Math.min(game.player.maxMana,game.player.mana+Math.round(game.player.maxMana*.35));
   game.player.stamina=Math.min(game.player.maxStamina,game.player.stamina+Math.round(game.player.maxStamina*.45));used=true
  }else if(id==='treasureSense'){
   const r=10+lvl*2;for(const c of [...game.chests,...game.keys])if(Math.abs(c.x-game.player.x)+Math.abs(c.y-game.player.y)<=r)game.seen[c.y][c.x]=true;
   log('Percibes el rastro de cofres y llaves cercanas.','loot');used=true
  }else if(id==='shadowVeil'){
   game.player.shadowVeil=1;log('Te fundes con las sombras durante un movimiento.','good');used=true
  }else if(id==='transmute'){
   const candidates=game.inventory.filter(i=>i.type!=='potion'&&!isItemInMyTradeOffer(i.id)).sort((a,b)=>(a.score||0)-(b.score||0));const item=candidates[0];
   if(item){game.inventory=game.inventory.filter(i=>i.id!==item.id);const value=Math.max(8,Math.round((item.score||10)*1.4));game.player.gold+=value;log(`${item.name} se convierte en ${value} monedas.`,'loot');used=true}
  }else if(id==='recallRune'){
   const s=game.rooms?.[0];if(s){game.player.x=s.cx;game.player.y=s.cy;anim.heroX=anim.targetX=s.cx;anim.heroY=anim.targetY=s.cy;reveal(s.cx,s.cy);used=true}
  }else if(id==='dimensionalPocket'){
   let n=0;for(const c of game.chests)if(!c.opened&&game.seen[c.y]?.[c.x]&&n<2+Math.floor(lvl/2)){openChest(c);n++}used=n>0
  }
 }

 if(!used&&skillDefs[id]?.unlock==='Botín'&&def.type!=='utility'){
  const visible=visibleEnemiesInRange(skillRange(id));
  const nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const lvl=skillLevel(id),base=8+lvl*3+(def.type==='magic'?game.player.stats.intelligence:game.player.stats.strength);
  if(id==='healingPulse'){healEntity(game.player,Math.round((8+lvl*4+game.player.stats.wisdom)*skillMult));used=true}
  else if(['mirrorWard','boneArmor'].includes(id)){game.player.shield+=(id==='boneArmor'?12:8)+lvl*4;used=true}
  else if(id==='bloodRush'){game.player.hp=Math.max(1,game.player.hp-5);game.player.stamina=Math.min(game.player.maxStamina,game.player.stamina+20+lvl*4);used=true}
  else if(id==='quickStep'){used=true}
  else if(nearest){
   if(['blackSun','worldBreaker','alchemicalNova','entropyWave','stormTotem','chainSpark','gravityWell','holyCircuit'].includes(id)){
    const targets=id==='blackSun'?visible:visible.slice(0,Math.min(6,2+lvl));
    targets.forEach(e=>attack(e,Math.round(base*(id==='blackSun'?2.1:1.25)*skillMult),{skillId:id}));used=true
   }else{
    attack(nearest,Math.round(base*(def.rarity==='legendary'?2.4:def.rarity==='epic'?1.8:def.rarity==='rare'?1.45:1.15)*skillMult),{skillId:id});
    if(id==='shockTrap'||id==='ironHook')nearest.stunned=1;
    if(id==='quantumThief'){healEntity(game.player,5+lvl);game.player.mana=Math.min(game.player.maxMana,game.player.mana+5+lvl);game.player.gold+=2+lvl}
    used=true
   }
  }
 }

 if(!used){log('No hay un objetivo válido.','sys');return}
 if(!apCan('skill',skillApCost(id)))return;
 game.player[def.resource]-=def.cost;game.player.cooldowns[id]=Math.max(1,skillDefs[id].cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');actionDone('skill',skillApCost(id));
}
function learnItemSkills(item){for(const id of item?.skillIds||[])learnSkill(id)}
function equipItem(id){
 const item=game.inventory.find(i=>i.id===id);if(!item)return;
 if(isItemInMyTradeOffer(id)){log('Este objeto está en oferta de intercambio: retíralo antes de equiparlo.','sys');return}
 learnItemSkills(item);let slot=item.slot;if(slot==='ring1'&&game.player.equipment.ring1)slot='ring2';if(slot==='trinket1'&&game.player.equipment.trinket1)slot='trinket2';
 const old=game.player.equipment[slot];if(old)game.inventory.push(old);game.player.equipment[slot]=item;game.inventory=game.inventory.filter(i=>i.id!==id);log(`Equipado: ${item.name}.`,'loot');recomputeDerived();updateUI();draw()
}
function equipSkill(id,slot){if(!game.player.knownSkills.includes(id))return;game.player.equippedSkills=game.player.equippedSkills.map(x=>x===id?null:x);game.player.equippedSkills[slot]=id;updateUI()}


function equippedSlotHtml(slot,item){
 if(!item)return`<span class="small">Vacío</span>`;
 return`<button type="button" class="equippedItemButton" onclick="showEquippedItem('${slot}')" title="Ver detalles de ${item.name}"><canvas class="equippedItemIcon" width="48" height="48" data-equipped-slot="${slot}"></canvas></button><div class="equippedItemInfo"><b class="${item.rarity}">${item.name}</b><span class="small">Nv. ${item.itemLevel||1} · Poder ${item.score||0}</span></div>`;
}
function showEquippedItem(slot){
 const item=game?.player?.equipment?.[slot];if(!item)return;
 storyTitle.textContent=`${slotNames[slot]} — ${item.name}`;
 storyBody.innerHTML=`<div class="narrative itemDetail"><canvas class="itemDetailIcon" width="48" height="48" data-detail-slot="${slot}"></canvas><div><p><b class="${item.rarity}">${item.name}</b></p><p class="small">${slotNames[item.slot]} · ${item.label} · Nivel ${item.itemLevel||1} · Poder ${item.score||0}</p>${item.weaponCategory?`<p class="small">Categoría: ${item.weaponCategory}</p>`:''}<p>${item.flavor||item.desc||''}</p>${describeItem(item)}<div class="startActions"><button id="closeItemDetail">Cerrar</button></div></div></div>`;
 storyOverlay.classList.remove('hidden');
 setTimeout(()=>{const c=document.querySelector('[data-detail-slot]');if(c)drawItemIcon(c,item);document.getElementById('closeItemDetail')?.addEventListener('click',()=>storyOverlay.classList.add('hidden'))},0)
}

function updateObjectiveHud(){
 const el=document.getElementById('floorObjective');if(!el||!game)return;
 const obj=game.objective;
 if(!obj||obj.type==='stairs'&&!game.floorArchetypeLabel){el.classList.add('hidden');return}
 el.classList.remove('hidden');
 const label=game.floorArchetypeLabel||'Piso estándar';
 let urgent=false;
 if(obj?.type==='timed'){const left=(obj.limit||0)-(obj.elapsed||0);urgent=obj.expired||left<=8}
 else if(obj?.type==='survive'&&!obj.done)urgent=true;
 el.classList.toggle('urgent',urgent);
 el.innerHTML=`${label} · <b>${objectiveText(obj)}</b>`;
}
function updateUI(){
 if(!game)return;const p=game.player;heroName.textContent=p.name.toUpperCase();buildLabel.textContent=`${(p.raceName||raceDefs[p.race]?.name||p.race).toUpperCase()} · ${(p.className||resolveClassDef(p.cls)?.name||p.cls).toUpperCase()} · 🔑 ${p.keys}`;level.textContent=p.level;floor.textContent=game.floor;damage.textContent=total('damage');armor.textContent=total('armor');gold.textContent=p.gold;const fs=p.derived?.finalStats||p.stats;strength.textContent=fs.strength;vitality.textContent=fs.vitality;agility.textContent=fs.agility;luck.textContent=fs.luck;intelligence.textContent=fs.intelligence;wisdom.textContent=fs.wisdom;themeLabel.textContent=`Zona: ${floorTheme().name}${game.boss?' · PISO DE JEFE':''}`;updateObjectiveHud();renderTradeTab();renderShardsTab();
 equipmentMini.innerHTML=['weapon','chest','ring1','neck'].map(s=>`<div class="small">${slotNames[s]}: <b>${p.equipment[s]?.name||'—'}</b></div>`).join('');
 inventory.innerHTML=game.inventory.length?game.inventory.map(i=>{const canDisenchant=i.type!=='potion'&&i.slot!=='consumable';return `<div class="item" onclick="${i.type==='potion'?'usePotion':'equipItem'}('${i.id}')"><canvas class="itemThumb" width="48" height="48" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}${i.type==='potion'&&i.quantity>1?` x${i.quantity}`:''}</b><span class="itemLevel">${i.type==='potion'?'Poción':slotNames[i.slot]} · ${i.label} · Nivel ${i.itemLevel||1}</span><span class="itemScore">Poder de objeto: ${i.score||0}</span>${describeItem(i)}</div>${canDisenchant?`<button type="button" class="disenchantMiniBtn" title="Deshacer: 10-20 shards de ${tierDefs[i.rarity]?.label||i.rarity}" onclick="event.stopPropagation();confirmDisenchantItem('${i.id}')"><canvas class="shardTierIcon" width="16" height="16" data-shard-tier="${i.rarity}"></canvas></button>`:''}</div>`}).join(''):'<p class="small">La mochila solo contiene pelusas.</p>';
 setTimeout(()=>{document.querySelectorAll('.itemThumb').forEach(c=>{const it=game.inventory.find(x=>x.id===c.dataset.item);if(it)drawItemIcon(c,it)});document.querySelectorAll('#inventory .shardTierIcon').forEach(c=>drawShardTierIconToCanvas(c,c.dataset.shardTier))},0);
 equipment.innerHTML=`<div class="equipVisual"><canvas id="equipmentHeroCanvas" class="equipmentHeroCanvas" width="128" height="192"></canvas>${slots.map(s=>`<div class="visualSlot vs-${s}"><span class="slotName">${slotNames[s]}</span>${equippedSlotHtml(s,p.equipment[s])}</div>`).join('')}</div>`;
 skills.innerHTML=p.knownSkills.map(id=>[id,skillDefs[id]]).filter(([,d])=>d).map(([id,d])=>{const eq=p.equippedSkills.indexOf(id),iconHtml=d.iconImage?`<canvas class="skillIconImg" width="20" height="20" data-skill-icon="${id}"></canvas>`:d.icon;return`<div class="skillCard"><b>${iconHtml} ${d.name}</b><span class="small">${d.desc}<span class='rangeTag'>${d.type==='utility'?'Utilidad':skillRangeLabel(id)}</span><br>Coste: ${d.cost} ${d.resource==='mana'?'maná':'stamina'}${apModeOn()?` · ${skillApCost(id)} PA`:''} · Daño: ${diceDamageLabel(id)} · <span class='skillLevel'>Nivel ${skillLevel(id)} · ${game.player.skillProgress?.[id]?.xp||0}/${skillXpNeeded(skillLevel(id))} XP</span><div class='skillXpBar'><i style='width:${((game.player.skillProgress?.[id]?.xp||0)/skillXpNeeded(skillLevel(id))*100)}%'></i></div> Aprendida ${eq>=0?`· <span class="equippedTag">Equipada en ${eq+1}</span>`:''}</span><div>${[0,1,2,3].map(n=>`<button onclick="equipSkill('${id}',${n})">${n+1}</button>`).join(' ')}</div></div>`}).join('')||'<p class="small">Todavía no has aprendido habilidades.</p>';
 achievements.innerHTML=[['crowd','Reunión multitudinaria','Tres enemigos adyacentes.'],['chest5','Coleccionista de basura','Abrir cinco cofres.'],['firstBoss','Rey de nada','Derrotar al primer jefe.']].map(a=>`<div class="skillCard ${game.achievements[a[0]]?'':'locked'}"><b>${game.achievements[a[0]]?'✓':'?'} ${a[1]}</b><span class="small">${a[2]}</span></div>`).join('');
 setTimeout(()=>{const ec=document.getElementById('equipmentHeroCanvas');if(ec)drawPaperDoll(ec,p);document.querySelectorAll('[data-equipped-slot]').forEach(c=>{const it=p.equipment[c.dataset.equippedSlot];if(it)drawItemIcon(c,it)})},0);
 // Compact one-row cards: hotkey+icon+short cost only. Full dice/range/defense
 // detail moves into the title tooltip instead of stacking extra lines.
 mobileSkillbar.innerHTML=`<button class="mobileSkill attackSkill" ${busy?'disabled':''} onclick="beginBasicAttack()" title="Ataque básico · ${baseAttackDice()} · ${attackRangeLabel()}"><span class="slotKey">A</span><span class="icon">⚔</span><span class="skillText"><b>Atacar</b></span></button>`+p.equippedSkills.map((id,i)=>{if(!id)return'';const d=skillDefs[id],cd=p.cooldowns[id]||0,detail=`${d.name} · ${d.cost} ${d.resource==='mana'?'maná':'stamina'}${apModeOn()?` · ${skillApCost(id)} PA`:''} · ${diceDamageLabel(id)} · ${skillRangeLabel(id)}`,iconHtml=d.iconImage?`<canvas class="skillIconImg" width="18" height="18" data-skill-icon="${id}"></canvas>`:d.icon;return`<button class="mobileSkill" ${cd||busy||p[d.resource]<d.cost?'disabled':''} onclick="useSkill(${i})" title="${detail}"><span class="slotKey">${i+1}</span><span class="icon">${iconHtml}</span><span class="skillText"><b>${d.name}</b><span class="costTag">${d.cost}${d.resource==='mana'?'✦':'⚡'}</span></span>${cd?`<span class="cooldown">${cd}</span>`:''}</button>`}).join('');
 setTimeout(()=>document.querySelectorAll('[data-skill-icon]').forEach(c=>{const dd=skillDefs[c.dataset.skillIcon];if(dd?.iconImage)drawSkillIconImg(c,dd.iconImage)}),0);
 document.getElementById('activeEffects').innerHTML=activeEffectsHtml();updateRestButton();updateGameHud();
}
function animate(){if(anim.t<1){anim.t=Math.min(1,anim.t+.2);draw();requestAnimationFrame(animate)}else draw()}

function drawTargetingOverlay(){
 if(!pendingTargetAction)return;const c=camera(),range=pendingTargetAction.range||1;
 ctx.save();ctx.globalAlpha=.28;
 for(let sy=0;sy<visibleTiles;sy++)for(let sx=0;sx<visibleTiles;sx++){const gx=c.x+sx,gy=c.y+sy;if(game.seen?.[gy]?.[gx]&&gridDistance(game.player,{x:gx,y:gy})>=(pendingTargetAction.minRange??1)&&gridDistance(game.player,{x:gx,y:gy})<=range&&hasLineOfSight(game.player,{x:gx,y:gy})){ctx.fillStyle=pendingTargetAction.mode==='area'?'#b26cff':'#ffca55';ctx.fillRect(sx*TILE+3,sy*TILE+3,TILE-6,TILE-6)}}
 ctx.restore()
}


function drawSafeRoomOverlay(sc){
 for(const room of game.safeRooms||[]){
  for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){
   if(!game.seen?.[y]?.[x])continue;const p=sc(x,y);
   ctx.fillStyle='rgba(80,170,125,.12)';ctx.fillRect(p.x+3,p.y+3,TILE-6,TILE-6);
   ctx.strokeStyle='#62c893';ctx.strokeRect(p.x+5,p.y+5,TILE-10,TILE-10)
  }
  if(game.seen?.[room.cy]?.[room.cx]){
   const p=sc(room.cx,room.cy);
   px(p.x+22,p.y+39,20,7,'#513526');px(p.x+27,p.y+25,10,18,room.rested?'#777':'#e77939');
   if(!room.rested){px(p.x+30,p.y+18,5,12,'#ffd25a');px(p.x+24,p.y+27,16,7,'#ff9b45')}
  }
 }
}

function draw(){
 if(!game)return;const c=camera();ctx.clearRect(0,0,CANVAS_SIZE,CANVAS_SIZE);
 for(let sy=0;sy<visibleTiles;sy++)for(let sx=0;sx<visibleTiles;sx++){const x=c.x+sx,y=c.y+sy;if(!game.seen[y][x]){px(sx*TILE,sy*TILE,TILE,TILE,'#040306');continue}drawDungeonTile(sx*TILE,sy*TILE,!!game.map[y][x],x,y);if(!game.map[y][x]&&roomTypeAt(x,y)==='creator')px(sx*TILE,sy*TILE,TILE,TILE,'#2a5bff26')}
 const sc=(x,y)=>({x:(x-c.x)*TILE,y:(y-c.y)*TILE});drawSafeRoomOverlay(sc);
 for(const r of game.rooms||[]){const cx=r.cx??(r.x+Math.floor(r.w/2)),cy=r.cy??(r.y+Math.floor(r.h/2));if(game.seen[cy]?.[cx])drawWorldObjectIcon('room_'+r.type,sc(cx,cy).x,sc(cx,cy).y,32,16)}
 if(game.seen[game.stairs.y][game.stairs.x]){let p=sc(game.stairs.x,game.stairs.y);stairsSprite(p.x,p.y)}
 for(const d of game.doors)if(game.seen[d.y][d.x]){let p=sc(d.x,d.y);drawDoorTile(p.x,p.y,d)}
 for(const t of game.traps||[])if(t.revealed&&!t.sprung&&game.seen[t.y]?.[t.x]){let p=sc(t.x,t.y);trapSprite(p.x,p.y)}
 for(const a of game.altars||[])if(game.seen[a.y]?.[a.x]){let p=sc(a.x,a.y);altarSprite(p.x,p.y,a)}
 for(const k of game.keys)if(game.seen[k.y][k.x]){let p=sc(k.x,k.y);keySprite(p.x,p.y)}
 for(const chest of game.chests)if(!chest.opened&&game.seen[chest.y][chest.x]){let p=sc(chest.x,chest.y);drawChestSprite(p.x,p.y,chest)}
 for(const obj of game.skillObjects||[])if(game.seen[obj.y]?.[obj.x]){let p=sc(obj.x,obj.y);skillObjectSprite(p.x,p.y,obj)}
 for(const e of game.enemies)if(e.hp>0&&game.seen[e.y]?.[e.x]){const t=e.animT??1,ix=(e.prevX??e.x)+(e.x-(e.prevX??e.x))*t,iy=(e.prevY??e.y)+(e.y-(e.prevY??e.y))*t;let p=sc(ix,iy);enemySprite(p.x,p.y,e)}
 for(const ally of game.companions||[])if(ally.hp>0&&ally.turns>0&&game.seen[ally.y]?.[ally.x]){let p=sc(ally.x,ally.y);companionSprite(p.x,p.y,ally)}
 for(const rp of game.otherPlayers||[])if(rp.hp>0&&game.seen[rp.y]?.[rp.x]){const t=rp.animT??1,ix=(rp.prevX??rp.x)+(rp.x-(rp.prevX??rp.x))*t,iy=(rp.prevY??rp.y)+(rp.y-(rp.prevY??rp.y))*t;let p=sc(ix,iy);remotePlayerSprite(p.x,p.y,rp)}
 const hx=(anim.heroX+(anim.targetX-anim.heroX)*anim.t-c.x)*TILE,hy=(anim.heroY+(anim.targetY-anim.heroY)*anim.t-c.y)*TILE;heroSprite(hx,hy,pick([0,0]));
 const center=CANVAS_SIZE/2;const g=ctx.createRadialGradient(center,center,CANVAS_SIZE*.27,center,center,CANVAS_SIZE*.73);g.addColorStop(0,'#0000');g.addColorStop(1,'#000a');ctx.fillStyle=g;ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE)
 drawTargetingOverlay();
}
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function skillObjectSprite(x,y,o){
 const color=o.kind==='trap'?'#ffcc55':o.kind==='totem'?'#9f7bff':o.kind==='decoy'?'#d989ff':'#64e0a0';
 ctx.save();ctx.globalAlpha=.88;ctx.fillStyle=color+'33';ctx.fillRect(x+8,y+8,TILE-16,TILE-16);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(x+12,y+12,TILE-24,TILE-24);ctx.fillStyle=color;ctx.font='26px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.icon||'◆',x+TILE/2,y+TILE/2);ctx.font='10px monospace';ctx.fillText(`${o.turns}T`,x+TILE/2,y+TILE-11);ctx.restore()}

const classVisuals={
 yunque:{body:'#66717d',accent:'#d3a94f',trim:'#313944',weapon:'hammer',head:'helm',bulk:2},
 berserker:{body:'#6d2838',accent:'#ff2f8b',trim:'#25131b',weapon:'axe',head:'mohawk',bulk:2},
 necromancer:{body:'#37285c',accent:'#43e6ca',trim:'#171322',weapon:'staff',head:'hood',bulk:0},
 paladin:{body:'#d1c5a1',accent:'#65d9ff',trim:'#50576b',weapon:'sword',head:'halo',bulk:2},
 jester:{body:'#7c2f77',accent:'#f4d84a',trim:'#2b1734',weapon:'wand',head:'jester',bulk:0},
 sniper:{body:'#43566a',accent:'#d5a64d',trim:'#1c2630',weapon:'rifle',head:'visor',bulk:0},
 shaman:{body:'#476c5d',accent:'#b06ee7',trim:'#25362e',weapon:'totem',head:'antlers',bulk:1},
 thief:{body:'#303b54',accent:'#5ff4e4',trim:'#121722',weapon:'dagger',head:'mask',bulk:0},
 cleric:{body:'#d9d1c0',accent:'#72b9ff',trim:'#535164',weapon:'mace',head:'cowl',bulk:1},
 entropyMage:{body:'#461d55',accent:'#ff5d79',trim:'#1a0d20',weapon:'orb',head:'hood',bulk:0},
 bountyHunter:{body:'#6a4938',accent:'#e68b42',trim:'#25201d',weapon:'pistol',head:'implant',bulk:1},
 druid:{body:'#53633d',accent:'#9fd15b',trim:'#2c3020',weapon:'staff',head:'branches',bulk:1},
 monk:{body:'#a04f33',accent:'#e7c978',trim:'#382019',weapon:'fists',head:'bald',bulk:0},
 engineer:{body:'#6b5848',accent:'#ffb445',trim:'#29231e',weapon:'cannon',head:'goggles',bulk:1},
 seer:{body:'#273b62',accent:'#c572ff',trim:'#12182a',weapon:'eye',head:'veil',bulk:0},
 beastGuardian:{body:'#4b5e49',accent:'#d0754d',trim:'#252e25',weapon:'claws',head:'beast',bulk:2}
};
const rarityColors={common:'#b7b7b7',uncommon:'#65d889',rare:'#62aef5',epic:'#c879ef',legendary:'#ffbd45'};
function shade(hex,amt){
 const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));
 return `rgb(${r},${g},${b})`
}


function showTab(name){
 const target=[...document.querySelectorAll('[data-tab]')].find(b=>b.dataset.tab===name);
 if(target)target.click();
}

function updateGameHud(){
 if(!game?.player)return;
 const p=game.player,need=p.level>=LEVEL_CAP?1:(p.nextXp||xpNeededForLevel(p.level));
 const set=(fill,text,val,max,bar)=>{const f=document.getElementById(fill),t=document.getElementById(text),b=bar&&document.getElementById(bar),pct=Math.max(0,Math.min(100,val/max*100));if(f)f.style.width=`${pct}%`;if(t)t.textContent=`${Math.ceil(val)}/${Math.ceil(max)}`;if(b)b.setAttribute('aria-valuenow',Math.round(pct))};
 set('hudHpFill','hudHpText',p.hp,p.maxHp,'hudHpBar');
 set('hudXpFill','hudXpText',p.level>=LEVEL_CAP?1:p.xp,need,'hudXpBar');if(p.level>=LEVEL_CAP){const t=document.getElementById('hudXpText');if(t)t.textContent='MÁX'}
 set('hudStaminaFill','hudStaminaText',p.stamina,p.maxStamina,'hudStaminaBar');
 set('hudManaFill','hudManaText',p.mana,p.maxMana,'hudManaBar');
 drawMinimap();
}
function drawMinimap(){
 const c=document.getElementById('minimap');if(!c||!game?.map)return;
 const q=c.getContext('2d'),w=game.map[0].length,h=game.map.length,s=Math.min(c.width/w,c.height/h);
 q.clearRect(0,0,c.width,c.height);q.fillStyle='#07050a';q.fillRect(0,0,c.width,c.height);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!game.seen?.[y]?.[x])continue;
  q.fillStyle=game.map[y][x]?'#1a1320':'#5a4665';q.fillRect(Math.floor(x*s),Math.floor(y*s),Math.ceil(s),Math.ceil(s));
 }
 for(const r of game.safeRooms||[]){if(game.seen?.[r.cy]?.[r.cx]){q.fillStyle=r.rested?'#557064':'#62c893';q.fillRect(Math.floor(r.cx*s)-1,Math.floor(r.cy*s)-1,Math.max(3,Math.ceil(s+2)),Math.max(3,Math.ceil(s+2)))}}
 for(const e of game.enemies||[]){if(e.hp>0&&game.seen?.[e.y]?.[e.x]){q.fillStyle=e.boss?'#ffd15d':'#d85a68';q.fillRect(Math.floor(e.x*s),Math.floor(e.y*s),Math.max(2,Math.ceil(s)),Math.max(2,Math.ceil(s)))}}
 q.fillStyle='#6cf0a2';q.fillRect(Math.floor(game.player.x*s),Math.floor(game.player.y*s),Math.max(3,Math.ceil(s+1)),Math.max(3,Math.ceil(s+1)));
}
function inspectedEntityAt(gx,gy){
 const enemy=game.enemies.find(e=>e.hp>0&&e.x===gx&&e.y===gy);if(enemy)return{type:'enemy',data:enemy};
 const item=game.floorItems?.find?.(i=>i.x===gx&&i.y===gy);if(item)return{type:'item',data:item};
 const chest=game.chests?.find?.(i=>i.x===gx&&i.y===gy);if(chest)return{type:'chest',data:chest};
 const door=game.doors?.find?.(i=>i.x===gx&&i.y===gy);if(door)return{type:'door',data:door};
 const altar=(game.altars||[]).find(a=>a.x===gx&&a.y===gy);if(altar)return{type:'altar',data:altar};
 const trapAt=(game.traps||[]).find(t=>t.revealed&&!t.sprung&&t.x===gx&&t.y===gy);if(trapAt)return{type:'trap',data:trapAt};
 const safe=safeRoomAt(gx,gy);if(safe)return{type:'safeRoom',data:safe};if(game.stairs?.x===gx&&game.stairs?.y===gy)return{type:'stairs',data:game.stairs};
 return game.map?.[gy]?.[gx]===0?{type:'floor',data:{x:gx,y:gy}}:{type:'wall',data:{x:gx,y:gy}};
}
function showInspect(entity,clientX,clientY){
 const pop=document.getElementById('inspectPopup'),content=document.getElementById('inspectContent');if(!pop||!content)return;
 let h='';
 if(entity.type==='enemy'){const e=entity.data;const clsLabel=e.enemyClassLabel||ENEMY_CLASS_GEAR[enemyClassOf(e)]?.label;h=`<h4>${e.name||'Enemigo'}</h4><p>${e.boss?'Jefe':'Enemigo'}${e.elite?' élite':''}${clsLabel?` · ${clsLabel}`:''}</p><p>Vida: ${Math.max(0,e.hp)}/${e.maxHp}</p><p>Daño estimado: ${e.damage||'?'}</p>${e.weapon?`<p><b>Arma:</b> ${e.weapon.name} (${e.weapon.label||e.weapon.rarity}${e.weapon.kind!=='melee'?` · alcance ${e.weapon.rangeMax}`:''})</p>`:''}<p>${enemyDefs[e.type]?.desc||'Una criatura hostil de la mazmorra.'}</p>${e.skills?.length?`<p><b>Habilidades:</b> ${e.skills.map(id=>skillDefs[id]?.name).filter(Boolean).join(' · ')}</p>`:''}`}
 else if(entity.type==='item'){const i=entity.data;h=`<h4>${i.name||'Objeto'}</h4><p>${i.desc||'Objeto encontrado en la mazmorra.'}</p><p>${i.flavor||''}</p>${describeItem(i)}`}
 else if(entity.type==='chest')h=`<h4>Cofre</h4><p>${entity.data.open?'Está vacío.':'Contiene botín aleatorio y puede ocultar habilidades.'}</p>`;
 else if(entity.type==='door')h=`<h4>Puerta ${entity.data.locked?'cerrada':'abierta'}</h4><p>${entity.data.locked?'Necesitas una llave o un efecto especial.':'Puedes atravesarla.'}</p>`;
 else if(entity.type==='safeRoom')h=`<h4>Sala segura</h4><p>Los enemigos no pueden entrar.</p><p>${entity.data.rested?'Ya has descansado aquí.':'Sitúate sobre el fuego central y pulsa DESCANSAR para recuperar toda la vida, stamina y maná.'}</p>`;
 else if(entity.type==='altar')h=`<h4>${entity.data.kind==='disenchant'?'Altar del Creador':'Altar'}</h4><p>${entity.data.kind==='disenchant'?'Crea y mejora equipo con shards. Reutilizable. (Deshacer objetos ya no requiere esta sala: hazlo desde la Mochila.)':entity.data.used?'Ya lo has usado.':entity.data.kind==='heal'?'Restaura una parte importante de tu vida.':entity.data.kind==='shield'?'Te concede un escudo.':'Potencia tu daño y armadura durante varios turnos.'}</p>`;
 else if(entity.type==='trap')h=`<h4>Trampa</h4><p>Un mecanismo oculto. Evita pisarlo.</p>`;
 else if(entity.type==='stairs')h=`<h4>Escaleras</h4><p>Conducen al siguiente nivel de la mazmorra.</p>`;
 else if(entity.type==='wall')h=`<h4>Muro</h4><p>Piedra antigua. No parece impresionada por tus credenciales.</p>`;
 else h=`<h4>Suelo explorado</h4><p>Una zona ya revelada de la mazmorra.</p>`;
 content.innerHTML=h;pop.classList.add('open');
 const host=gameCanvasWrap?.getBoundingClientRect?.()||document.getElementById('game').parentElement.getBoundingClientRect();
 pop.style.left=`${Math.min(host.width-310,Math.max(8,clientX-host.left+10))}px`;
 pop.style.top=`${Math.min(host.height-190,Math.max(8,clientY-host.top+10))}px`;
}
function closeInspect(){document.getElementById('inspectPopup')?.classList.remove('open')}




const defaultTilesetFloors=[
 {id:'verdant-cave',name:'Caverna verdeante',story:'Cavernas húmedas cubiertas de musgo, raíces y piedra viva.',floorTiles:[{name:'Musgo húmedo',color:'#263927',alt:'#314832',accent:'#8fbf63',icon:''},{name:'Raíz y limo',color:'#213420',alt:'#39523a',accent:'#6f9457',icon:''}],wallTiles:[{name:'Piedra musgosa',color:'#1c2b1d',top:'#304832',accent:'#8fbf63',rotatable:true,icon:''}],doorTiles:[{name:'Puerta de raíces',color:'#6b4a2f',accent:'#8fbf63',icon:''}]},
 {id:'crypt',name:'Cripta violeta',story:'Tumbas antiguas y corredores bajo una luna que no existe.',floorTiles:[{name:'Losa arcana',color:'#30283a',alt:'#3b3146',accent:'#b08bd3',icon:''}],wallTiles:[{name:'Muro funerario',color:'#24202e',top:'#3b3349',accent:'#b08bd3',rotatable:true,icon:''}],doorTiles:[{name:'Puerta funeraria',color:'#4b394f',accent:'#b08bd3',icon:''}]},
 {id:'foundry',name:'Fundición carmesí',story:'Hornos, cadenas y metal fundido.',floorTiles:[{name:'Baldosa caliente',color:'#4b241d',alt:'#5c2c22',accent:'#ff8a45',icon:''}],wallTiles:[{name:'Ladrillo abrasado',color:'#3a1d19',top:'#612c20',accent:'#ff8a45',rotatable:true,icon:''}],doorTiles:[{name:'Compuerta oxidada',color:'#5b3328',accent:'#ff8a45',icon:''}]},
 {id:'archive',name:'Archivo del Vacío',story:'Bibliotecas imposibles y pasillos que olvidan dónde estaban.',floorTiles:[{name:'Suelo imposible',color:'#211d3c',alt:'#2c2750',accent:'#66e0df',icon:''}],wallTiles:[{name:'Muro imposible',color:'#18162b',top:'#29234b',accent:'#66e0df',rotatable:true,icon:''}],doorTiles:[{name:'Umbral de datos',color:'#25203d',accent:'#66e0df',icon:''}]}
];
function normalizedSupabaseFloors(){return configFloors.map(r=>({...(r.floor_json||{}),dbId:r.id,name:r.floor_json?.name||r.floor_name,source:'config_floor'})).filter(f=>f&&f.name)}
function normalizedConfigFloors(){const saved=normalizedSupabaseFloors();return saved.length?saved:defaultTilesetFloors}
function pickFloorTilesetForLevel(level){const floors=normalizedSupabaseFloors();if(!floors.length)throw new Error('No hay floors consolidados en config_floor. Crea o importa floors antes de generar la dungeon.');return pick(floors)}
function compactTileForWorld(tile){const {icon,...rest}=tile||{};return rest}
function compactFloorTilesetForWorld(floorTileset){if(!floorTileset)return null;return{...floorTileset,floorTiles:(floorTileset.floorTiles||[]).map(compactTileForWorld),wallTiles:(floorTileset.wallTiles||[]).map(compactTileForWorld),doorTiles:(floorTileset.doorTiles||[]).map(compactTileForWorld)}}
function hydrateFloorTilesetForWorld(saved){if(!saved)return pickFloorTilesetForLevel(game?.floor||1);const source=normalizedConfigFloors().find(f=>(saved.dbId&&String(f.dbId)===String(saved.dbId))||f.name===saved.name);if(!source)return saved;return{...source,...saved,floorTiles:(saved.floorTiles||source.floorTiles||[]).map((t,i)=>({...source.floorTiles?.[i],...t,icon:t.icon||source.floorTiles?.[i]?.icon||''})),wallTiles:(saved.wallTiles||source.wallTiles||[]).map((t,i)=>({...source.wallTiles?.[i],...t,icon:t.icon||source.wallTiles?.[i]?.icon||''})),doorTiles:(saved.doorTiles||source.doorTiles||[]).map((t,i)=>({...source.doorTiles?.[i],...t,icon:t.icon||source.doorTiles?.[i]?.icon||''}))}}
function activeFloorTileset(){return game?.floorTileset||pickFloorTilesetForLevel(game?.floor||1)}
function wallDirectionForCell(gx,gy){const open=(x,y)=>game?.map?.[y]?.[x]===0,up=open(gx,gy-1),down=open(gx,gy+1),left=open(gx-1,gy),right=open(gx+1,gy);if(up&&down&&!left&&!right)return'vertical';if(left&&right&&!up&&!down)return'horizontal';if(down&&!up)return'top';if(up&&!down)return'bottom';if(right&&!left)return'left';if(left&&!right)return'right';return'center'}
function wallRotationForDirection(direction){return {top:0,right:90,bottom:180,left:270,horizontal:90,vertical:0,center:0}[direction]||0}
function directionalWallTile(tiles,direction,seed){const exact=tiles.filter(t=>!t.direction||t.direction===direction||(direction==='horizontal'&&t.direction==='right')||(direction==='vertical'&&t.direction==='top'));return (exact.length?exact:tiles)[seed%(exact.length?exact.length:tiles.length)]}
function tileImageFromHex(hex){if(!hex)return null;const img=new Image();img.src='data:image/png;base64,'+btoa(String(hex).match(/.{1,2}/g).map(h=>String.fromCharCode(parseInt(h,16))).join(''));return img}
const tileImageCache=new Map();
// Skill icon override (skillDefs[id].iconImage, a hex PNG from the class
// editor's image icon tool): renders in place of the plain text/emoji glyph
// wherever a skill is shown. Existing skills keep their emoji by default -
// this only draws when an override has actually been set.
function drawSkillIconImg(canvas,hex){
 let img=tileImageCache.get('skill:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('skill:'+hex,img)}
 const paint=()=>{const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height)};
 if(img.complete)paint();else img.onload=paint;
}
function drawConfiguredTile(tile,x,y,rotate=0){if(!tile?.icon)return false;let img=tileImageCache.get(tile.icon);if(!img){img=tileImageFromHex(tile.icon);tileImageCache.set(tile.icon,img)}if(!img)return false;const paint=()=>{ctx.save();ctx.translate(x+TILE/2,y+TILE/2);if(rotate)ctx.rotate(rotate*Math.PI/180);ctx.drawImage(img,-TILE/2,-TILE/2,TILE,TILE);ctx.restore()};if(img.complete){paint();return true}img.onload=()=>game&&draw();return false}

const floorVisualThemes={
 1:{name:'Fortaleza Verde',wall:'#1c2b1d',wallTop:'#304832',floor:'#263927',floorAlt:'#314832',accent:'#8fbf63',fog:'#071009',story:'Fortaleza tomada por trasgos, mercenarios y bestias de los bosques.'},
 2:{name:'Criptas del Duque',wall:'#24202e',wallTop:'#3b3349',floor:'#30283a',floorAlt:'#3b3146',accent:'#b08bd3',fog:'#0b0810',story:'Tumbas antiguas, capillas rotas y corredores bajo una luna que no existe.'},
 3:{name:'Fundición Carmesí',wall:'#3a1d19',wallTop:'#612c20',floor:'#4b241d',floorAlt:'#5c2c22',accent:'#ff8a45',fog:'#120705',story:'Hornos, cadenas, metal fundido y obreros monstruosos al servicio del Tirano.'},
 4:{name:'Archivo del Vacío',wall:'#18162b',wallTop:'#29234b',floor:'#211d3c',floorAlt:'#2c2750',accent:'#66e0df',fog:'#05040c',story:'Bibliotecas imposibles, magia rota y pasillos que olvidan dónde estaban.'}
};
function currentFloorTheme(){const f=activeFloorTileset();return {name:f.name,story:f.story||f.desc||'Set de tiles configurado.',floor:f.floorTiles?.[0]?.color||'#263927',floorAlt:f.floorTiles?.[0]?.alt||'#314832',wall:f.wallTiles?.[0]?.color||'#1c2b1d',wallTop:f.wallTiles?.[0]?.top||'#304832',accent:f.floorTiles?.[0]?.accent||f.wallTiles?.[0]?.accent||'#8fbf63',fog:'#071009'}}

function drawDungeonTile(x,y,wall,gx,gy){
 const floorSet=activeFloorTileset(),seed=(gx*73856093^gy*19349663)>>>0;
 const t=currentFloorTheme();
 if(wall){
  const wallTiles=floorSet.wallTiles?.length?floorSet.wallTiles:[{}],dir=wallDirectionForCell(gx,gy),wt=directionalWallTile(wallTiles,dir,seed),rot=wt.rotatable?wallRotationForDirection(dir):0;
  if(drawConfiguredTile(wt,x,y,rot)){ctx.strokeStyle=shade(t.wall,-10);ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);return}
  px(x,y,TILE,TILE,t.wall);px(x,y,TILE,7,t.wallTop);px(x+5,y+9,TILE-10,TILE-14,shade(t.wall,6));
  for(let i=0;i<4;i++){const yy=y+12+i*13,off=((i&1)*8);for(let xx=x-8+off;xx<x+TILE;xx+=24){px(xx,yy,20,2,shade(t.wall,-10));px(xx+19,yy-10,2,12,shade(t.wall,-7))}}
  if(game.floor===3&&seed%7===0){px(x+49,y+8,5,27,'#8b351e');px(x+48,y+7,7,5,'#ff9b45')}
  if(game.floor===4&&seed%8===0){px(x+11,y+12,2,30,t.accent);px(x+8,y+25,8,2,t.accent)}
 }else{
  const floorTiles=floorSet.floorTiles?.length?floorSet.floorTiles:[{}],ft=floorTiles[seed%floorTiles.length];
  if(drawConfiguredTile(ft,x,y,0)){ctx.strokeStyle=shade(t.floor,-10);ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);return}
  px(x,y,TILE,TILE,t.floor);px(x+2,y+2,TILE-4,TILE-4,t.floorAlt);
  px(x+3,y+3,TILE-6,2,shade(t.floorAlt,12));px(x+3,y+TILE-5,TILE-6,2,shade(t.floor,-12));
  if(seed%5===0)px(x+12+(seed%31),y+10+((seed>>4)%35),3,3,shade(t.floorAlt,16));
  if(game.floor===1&&seed%11===0){px(x+8,y+48,14,3,'#4d6a3f');px(x+16,y+41,3,10,'#6f9457')}
  if(game.floor===2&&seed%13===0){px(x+13,y+17,3,20,'#55435e');px(x+9,y+32,10,3,'#55435e')}
  if(game.floor===3&&seed%9===0){px(x+50,y+8,4,20,'#d45a32');px(x+48,y+8,8,4,'#ff9c42')}
  if(game.floor===4&&seed%9===0){px(x+11,y+12,2,30,'#7c5cff');px(x+8,y+25,8,2,'#43d9df')}
 }
 ctx.strokeStyle=shade(t.floor,-10);ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1)
}

const weaponPixelAnchors={
 hammer:{x:18,y:-8,rotation:0},axe:{x:18,y:-9,rotation:0},sword:{x:18,y:-12,rotation:0},
 staff:{x:19,y:-10,rotation:0},totem:{x:19,y:-9,rotation:0},rifle:{x:17,y:-9,rotation:0},
 cannon:{x:16,y:-8,rotation:0},pistol:{x:18,y:-8,rotation:0},dagger:{x:18,y:-10,rotation:0},
 mace:{x:18,y:-9,rotation:0},wand:{x:18,y:-10,rotation:0},orb:{x:19,y:-11,rotation:0},
 eye:{x:19,y:-11,rotation:0},claws:{x:17,y:-7,rotation:0},fists:{x:16,y:-5,rotation:0}
};
const classPixelAdjust={
 yunque:{weapon:{x:2,y:1},offhand:{x:-1,y:0}},berserker:{weapon:{x:1,y:-1}},paladin:{weapon:{x:0,y:-2},offhand:{x:-1,y:-2}},
 sniper:{weapon:{x:-2,y:-1}},thief:{weapon:{x:0,y:1}},cleric:{weapon:{x:0,y:-1}},bountyHunter:{weapon:{x:1,y:0}},
 engineer:{weapon:{x:-2,y:1}},monk:{weapon:{x:0,y:2}},beastGuardian:{weapon:{x:-1,y:1}}
};
function equipmentAnchor(cls,type,side='weapon',facing=1){
 const b=weaponPixelAnchors[type]||{x:18,y:-8,rotation:0},c=classPixelAdjust[cls]?.[side]||{x:0,y:0};
 const x=(b.x+c.x)*(facing>0?1:-1);
 return{x,y:b.y+c.y,rotation:(b.rotation||0)*(facing>0?1:-1)}
}

function drawPixelWeapon(q,x,y,type,color,flip=1){
 q.fillStyle='#221a24';
 const r=(a,b,c,d,col=color)=>{q.fillStyle=col;q.fillRect(x+a*flip-(flip<0?c:0),y+b,c,d)};
 if(type==='hammer'){r(0,15,4,24,'#6d4b32');r(-7,8,18,10,color);r(-5,6,14,3,shade(color,20))}
 else if(type==='axe'){r(0,13,4,27,'#72503a');r(-8,5,14,13,color);r(5,8,7,8,shade(color,-20))}
 else if(type==='sword'){r(0,-1,4,29,color);r(1,-4,2,5,shade(color,22));r(-4,27,12,4,'#c89b55');r(0,31,4,8,'#64442f')}
 else if(type==='staff'||type==='totem'){r(0,5,4,37,'#72503b');r(-5,0,14,12,color);r(-2,2,8,6,shade(color,25))}
 else if(type==='rifle'||type==='cannon'){r(-12,16,27,7,color);r(6,21,5,13,'#6b4934');r(-10,23,9,3,shade(color,-15))}
 else if(type==='pistol'){r(-7,14,16,7,color);r(1,20,5,11,'#634532')}
 else if(type==='dagger'){r(0,12,4,18,color);r(-3,28,10,3,'#d3a64e')}
 else if(type==='mace'){r(0,14,4,25,'#6e4b34');r(-5,6,14,12,color)}
 else if(type==='wand'){r(0,13,4,25,'#77503a');r(-4,5,12,11,color)}
 else if(type==='orb'||type==='eye'){r(-5,6,14,14,color);r(-2,3,8,4,shade(color,25))}
 else if(type==='claws'){for(let i=0;i<3;i++)r(i*4-6,13-i*2,3,18,color)}
}
function drawHeadGear(q,v,x,y,type,color){
 q.fillStyle=color;
 if(type==='helm'){q.fillRect(x-12,y-9,24,10);q.fillRect(x-15,y-4,5,13);q.fillRect(x+10,y-4,5,13);q.fillStyle=shade(color,20);q.fillRect(x-8,y-7,16,3)}
 else if(type==='mohawk'){q.fillRect(x-3,y-17,6,14);q.fillRect(x-8,y-14,6,5);q.fillRect(x+3,y-14,6,5)}
 else if(type==='hood'||type==='cowl'){q.fillRect(x-14,y-11,28,15);q.fillRect(x-16,y-2,6,15);q.fillRect(x+10,y-2,6,15)}
 else if(type==='halo'){q.fillRect(x-12,y-17,24,3);q.fillRect(x-15,y-14,4,4);q.fillRect(x+11,y-14,4,4)}
 else if(type==='jester'){q.fillRect(x-14,y-11,28,7);q.fillRect(x-14,y-16,6,8);q.fillRect(x+8,y-16,6,8);q.fillStyle='#ffd95e';q.fillRect(x-15,y-18,4,4);q.fillRect(x+11,y-18,4,4)}
 else if(type==='visor'){q.fillRect(x-13,y-5,26,6);q.fillStyle='#ef3e66';q.fillRect(x-10,y-3,20,2)}
 else if(type==='antlers'||type==='branches'){q.fillRect(x-11,y-15,3,12);q.fillRect(x+8,y-15,3,12);q.fillRect(x-15,y-15,7,3);q.fillRect(x+8,y-15,7,3)}
 else if(type==='mask'){q.fillRect(x-13,y-5,26,8);q.fillStyle='#50f0df';q.fillRect(x-8,y-2,5,2);q.fillRect(x+3,y-2,5,2)}
 else if(type==='implant'){q.fillRect(x+8,y-6,6,8);q.fillStyle='#ff9a42';q.fillRect(x+10,y-4,3,3)}
 else if(type==='goggles'){q.fillRect(x-13,y-6,26,6);q.fillStyle='#ffc34b';q.fillRect(x-10,y-4,7,3);q.fillRect(x+3,y-4,7,3)}
 else if(type==='veil'){q.globalAlpha=.7;q.fillRect(x-15,y-10,30,23);q.globalAlpha=1}
 else if(type==='beast'){q.fillRect(x-14,y-10,7,9);q.fillRect(x+7,y-10,7,9);q.fillRect(x-10,y-15,5,7);q.fillRect(x+5,y-15,5,7)}
}

function drawEquippedWeaponIcon(q,item,x,y,facing=1){
 const img=item?weaponIconImage(item):null;
 if(!(img?.complete&&img.naturalWidth))return false;
 const rect=weaponUsesSwordSpritesheet(item.weaponIconRow)?swordSpriteRect(item.weaponIconRow,item.weaponIconCol):null;
 const displaySize=(rect||img.naturalWidth>=WEAPON_TYPE_ICON_SIZE)?24:16;
 q.save();q.translate(x,y);q.scale(facing,1);q.rotate(facing>0?.55:-.55);
 if(rect)q.drawImage(img,rect.x,rect.y,rect.size,rect.size,-displaySize/2,-displaySize-2,displaySize,displaySize);else q.drawImage(img,-displaySize/2,-displaySize-2,displaySize,displaySize);
 q.restore();
 return true;
}

function drawCharacter(q,x,y,scale,cls,equipment={},frame=0,facing=1){
 const v=classVisuals[cls]||classVisuals.yunque, bob=frame%2?1:0;
 q.save();q.translate(x,y+bob);q.scale(scale,scale);
 const r=(a,b,c,d,col)=>{q.fillStyle=col;q.fillRect(a,b,c,d)};
 const skin='#c99062', dark='#1b141d',body=v.body,accent=v.accent,trim=v.trim,bulk=v.bulk||0;
 // shadow
 r(-17,25,34,6,'#09070b88');
 // cape/back silhouette by class
 if(['necromancer','entropyMage','seer','cleric','druid'].includes(cls)){r(-13,-2,26,31,shade(body,-18));r(-17,10,7,19,shade(body,-25));r(10,10,7,19,shade(body,-25))}
 // legs and boots
 r(-10,13,8,15,trim);r(2,13,8,15,trim);
 const boots=equipment.boots,bootCol=boots?rarityColors[boots.rarity]:shade(trim,10);
 r(-12,24,11,6,bootCol);r(1,24,11,6,bootCol);
 // torso, chest visible
 r(-12-bulk,-5,24+bulk*2,20,body);r(-10-bulk,-3,20+bulk*2,4,shade(body,20));
 const chest=equipment.chest;
 if(chest){const cc=rarityColors[chest.rarity];r(-13-bulk,-6,26+bulk*2,8,cc);r(-11-bulk,3,22+bulk*2,3,shade(cc,-25));r(-3,-4,6,16,shade(cc,12))}
 // arms and gloves
 r(-18-bulk,-2,7,18,skin);r(11+bulk,-2,7,18,skin);
 const gloves=equipment.hands,gc=gloves?rarityColors[gloves.rarity]:shade(body,-12);
 r(-19-bulk,10,8,7,gc);r(11+bulk,10,8,7,gc);
 // neck
 if(equipment.neck){const nc=rarityColors[equipment.neck.rarity];r(-5,-4,10,2,nc);r(-1,-2,3,4,shade(nc,20))}
 // head/face
 r(-10,-18,20,15,skin);r(-8,-16,16,3,shade(skin,12));r(-6,-11,3,3,dark);r(3,-11,3,3,dark);
 // hair
 if(!['hood','cowl','helm'].includes(v.head)){r(-10,-19,20,4,shade(trim,-5));r(-11,-16,4,7,shade(trim,-5))}
 drawHeadGear(q,v,0,-9,v.head,accent);
 if(equipment.head)drawHeadGear(q,v,0,-9,'helm',rarityColors[equipment.head.rarity]);
 // weapon and offhand
 const weapon=equipment.weapon, wc=weapon?rarityColors[weapon.rarity]:accent;
 const wa=equipmentAnchor(cls,v.weapon,'weapon',facing);
 if(!drawEquippedWeaponIcon(q,weapon,wa.x,wa.y,facing)){q.save();q.translate(wa.x,wa.y);if(wa.rotation)q.rotate(wa.rotation);drawPixelWeapon(q,0,0,v.weapon,wc,facing);q.restore();}
 if(equipment.offhand){const oc=rarityColors[equipment.offhand.rarity],oa=equipmentAnchor(cls,v.weapon,'offhand',-facing);q.save();q.translate(oa.x+(facing>0?-2:2),oa.y+8);q.fillStyle=oc;q.fillRect(-6,-5,12,17);q.fillStyle=shade(oc,-20);q.fillRect(-4,-3,8,13);q.fillStyle=shade(oc,18);q.fillRect(-3,-2,6,3);q.restore()}
 // rings/trinkets glow
 const glow=[equipment.ring1,equipment.ring2,equipment.trinket1,equipment.trinket2].filter(Boolean);
 if(glow.length){q.globalAlpha=.55;for(let i=0;i<glow.length;i++){q.strokeStyle=rarityColors[glow[i].rarity];q.strokeRect(-19-i, -20-i,38+i*2,50+i*2)}q.globalAlpha=1}
 q.restore()
}
function drawTrimmedImage(q,img,x,y,w,h,padding=0){
 const src=document.createElement('canvas');src.width=img.naturalWidth||img.width;src.height=img.naturalHeight||img.height;const s=src.getContext('2d');s.imageSmoothingEnabled=false;s.clearRect(0,0,src.width,src.height);s.drawImage(img,0,0);
 const data=s.getImageData(0,0,src.width,src.height).data;let minX=src.width,minY=src.height,maxX=-1,maxY=-1;
 for(let yy=0;yy<src.height;yy++)for(let xx=0;xx<src.width;xx++){if(data[(yy*src.width+xx)*4+3]>8){if(xx<minX)minX=xx;if(yy<minY)minY=yy;if(xx>maxX)maxX=xx;if(yy>maxY)maxY=yy}}
 q.imageSmoothingEnabled=false;
 if(maxX<0){q.drawImage(img,x,y,w,h);return}
 const sw=maxX-minX+1,sh=maxY-minY+1,scale=Math.min((w-padding*2)/sw,(h-padding*2)/sh),dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale)),dx=x+Math.round((w-dw)/2),dy=y+Math.round((h-dh)/2);
 q.drawImage(img,minX,minY,sw,sh,dx,dy,dw,dh)
}
function drawCharacterIcon(q,iconHex,x,y,w,h,padding=0){
 if(!iconHex)return false;
 try{const data='data:image/png;base64,'+hexToBase64(iconHex.startsWith('#')?iconHex.slice(1):iconHex),img=configIconImage(data);
  const draw=()=>drawTrimmedImage(q,img,x,y,w,h,padding);
  if(img.complete&&img.naturalWidth){draw();return true}
  img.onload=()=>{draw();if(game)draw()};
 }catch(e){}
 return false;
}
function heroSprite(x,y){
 const icon=game.player.classIcon||classIconForId(game.player.cls);
 if(icon&&drawCharacterIcon(ctx,icon,x+3,y+3,58,58,2))return;
 const facing=game.player.facing||1,frame=game.turn%4<2?0:1;
 drawCharacter(ctx,x+32,y+34,1.18,game.player.cls,game.player.equipment,frame,facing)
}
function remotePlayerSprite(x,y,rp){
 const icon=rp.classIcon||classIconForId(rp.cls);
 if(!(icon&&drawCharacterIcon(ctx,icon,x+3,y+3,58,58,2))){
  const facing=rp.facing||1,frame=game.turn%4<2?0:1;
  drawCharacter(ctx,x+32,y+34,1.18,rp.cls||'yunque',rp.equipment||{},frame,facing);
 }
 ctx.strokeStyle='#73aaff';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54);
 px(x+8,y+3,48,5,'#132433');
 px(x+8,y+3,48*Math.max(0,(rp.hp||0)/(rp.maxHp||1)),5,'#73aaff');
 ctx.fillStyle='#dce8ff';ctx.font='7px monospace';ctx.textAlign='center';
 ctx.fillText((rp.name||'JUGADOR').toUpperCase().slice(0,14),x+32,y+63);
}
function drawClassPreview(canvas,cls){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=false;q.clearRect(0,0,64,64);
 q.fillStyle='#120c18';q.fillRect(0,0,64,64);
 q.fillStyle='#25182e';for(let i=0;i<4;i++)q.fillRect(i*18,50+(i%2)*3,15,8);
 if(drawCharacterIcon(q,classIconForId(cls),3,3,58,58,2))return;
 drawCharacter(q,32,38,.85,cls,{},0,1)
}
function drawPaperDoll(canvas,p){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=false;q.clearRect(0,0,128,192);
 const grad=q.createLinearGradient(0,0,0,192);grad.addColorStop(0,'#21162b');grad.addColorStop(1,'#0d0912');q.fillStyle=grad;q.fillRect(0,0,128,192);
 q.strokeStyle='#493454';q.strokeRect(5,5,118,182);
 for(let y=12;y<188;y+=16){q.fillStyle=y%32?'#16101d':'#1a1222';q.fillRect(8,y,112,1)}
 if(p.classIcon||classIconForId(p.cls)){drawCharacterIcon(q,p.classIcon||classIconForId(p.cls),24,26,80,112,4)}else{q.save();q.translate(64,103);q.scale(2.25,2.25);drawCharacter(q,0,0,1,p.cls,p.equipment,game.turn%2,p.facing||1);q.restore();}
 q.fillStyle='#e8d8a7';q.font='6px monospace';q.textAlign='center';q.fillText((p.className||'CLASE').toUpperCase().slice(0,20),64,181)
}
function chestSprite(x,y){px(x+8,y+27,48,27,'#553018');px(x+10,y+19,44,15,'#a65d2c');px(x+14,y+21,36,4,'#d38a43');px(x+28,y+24,8,22,'#f2c456');px(x+13,y+47,38,4,'#321b12')}
// Renders the chest's own config_chest icon when it has one (same hex-icon
// pipeline used for tiles/doors); falls back to the procedural sprite only
// while that image is still loading.
function drawChestSprite(x,y,c){
 const icon=c.chestDef?.icon;
 if(icon){
  let img=tileImageCache.get(icon);
  if(!img){img=tileImageFromHex(icon);tileImageCache.set(icon,img)}
  if(img.complete){ctx.drawImage(img,x+7,y+7,TILE-14,TILE-14);return}
  img.onload=()=>game&&draw();
 }
 chestSprite(x,y);
}
function trapSprite(x,y){
 if(drawWorldObjectIcon('trap',x,y))return;
 ctx.strokeStyle='#ff9d4f';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(x+16,y+16);ctx.lineTo(x+48,y+48);ctx.moveTo(x+48,y+16);ctx.lineTo(x+16,y+48);ctx.stroke();
 ctx.strokeStyle='rgba(255,157,79,.45)';ctx.strokeRect(x+10,y+10,44,44);
}
function altarSprite(x,y,a){
 if(drawWorldObjectIcon('altar_'+a.kind,x,y))return;
 const disenchant=a.kind==='disenchant';
 const col=disenchant?'#4d7dff':a.used?'#5b6472':a.kind==='heal'?'#8dffa8':a.kind==='shield'?'#9be8ff':'#ffd45f';
 const grayed=!disenchant&&a.used;
 px(x+18,y+40,28,14,grayed?'#2a2f3a':disenchant?'#1c2d5c':'#3a4356');
 px(x+22,y+22,20,20,col);
 ctx.fillStyle=grayed?'#7d8595':'#0c0f16';ctx.font='12px monospace';ctx.textAlign='center';
 ctx.fillText(disenchant?'⚒':a.kind==='heal'?'✚':a.kind==='shield'?'▣':'✦',x+32,y+37);
}
function stairsSprite(x,y){if(drawWorldObjectIcon('stairsDown',x,y))return;for(let i=0;i<5;i++){px(x+8+i*5,y+10+i*9,48-i*10,7,shade('#9d8ba8',i*4));px(x+8+i*5,y+17+i*9,48-i*10,2,'#3b3142')}}
function doorSprite(x,y,d){px(x+8,y+5,48,57,'#2b1a16');px(x+11,y+8,42,54,d.open?'#342a23':'#8b4e2c');if(!d.open){for(let i=0;i<3;i++)px(x+15,y+13+i*15,34,3,'#5b301f');px(x+17,y+10,3,48,'#b16d3c');px(x+44,y+10,3,48,'#5e321f');px(x+39,y+34,7,7,d.locked?'#ffd24f':'#271713')}}
// Each floor's tileset can define its own door look (config_floor.doorTiles,
// same icon editor as walls/floors); replaces the generic doorSprite whenever
// one is configured, falling back to it otherwise. Locked doors get a gold
// glow hugging whatever silhouette actually gets drawn (icon or procedural).
function drawDoorTile(x,y,d){
 const doorTiles=activeFloorTileset().doorTiles;
 let painted=false;
 if(doorTiles?.length){
  const seed=(d.x*73856093^d.y*19349663)>>>0;
  painted=drawConfiguredTile(doorTiles[seed%doorTiles.length],x,y,0);
 }
 if(!painted)doorSprite(x,y,d);
 // locked doors get an unmistakable 5px gold stripe down the middle of the
 // tile, on top of whatever art was drawn (icon or procedural)
 if(d.locked)px(x+Math.floor((TILE-5)/2),y+6,5,TILE-12,'#ffd24f');
} 
function keySprite(x,y){if(drawWorldObjectIcon('key',x,y))return;px(x+14,y+28,27,7,'#d6a832');px(x+37,y+18,16,25,'#f1cb55');px(x+42,y+23,6,6,'#392614');px(x+11,y+23,7,18,'#f1cb55');px(x+7,y+27,7,5,'#f1cb55')}

function companionSprite(x,y,c){
 const shape=c.shape||'allyCompanion';
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 ctx.save();
 ctx.shadowColor='#70dc9b';
 ctx.shadowBlur=9;
 R(8,54,48,5,'#07140d99');

 if(c.iconImage){
  // author-picked image for a stackable 'summon'/'summonturret' effect,
  // takes over from the procedural allyX shapes below
  let img=tileImageCache.get('companion:'+c.iconImage);
  if(!img){img=tileImageFromHex(c.iconImage);tileImageCache.set('companion:'+c.iconImage,img)}
  if(img.complete)ctx.drawImage(img,x+7,y+7,50,50);else img.onload=()=>game&&draw();
 }else if(shape==='allySkeleton'){
  R(20,6,24,18,'#ded8bc');R(24,11,5,5,'#18211c');R(36,11,5,5,'#18211c');
  R(27,24,10,16,'#c7c0a5');R(15,25,9,23,'#d8d1b7');R(41,25,9,23,'#d8d1b7');
  R(23,39,6,17,'#d8d1b7');R(36,39,6,17,'#d8d1b7');
  R(48,15,3,37,'#7f6947');R(44,15,11,4,'#a58b5e');
 }else if(shape==='allyTurret'){
  R(13,29,38,20,'#657078');R(20,18,24,14,'#8e9aa3');R(42,22,17,5,'#b7c4cc');R(28,11,8,8,'#70dc9b');
 }else if(shape==='allyWolf'){
  R(9,28,39,17,'#66766d');R(39,17,18,17,'#77897f');R(42,10,7,10,'#77897f');R(52,10,7,10,'#77897f');
  R(43,22,4,4,'#d6ff8e');R(51,22,4,4,'#d6ff8e');R(13,43,6,13,'#5b6961');R(39,43,6,13,'#5b6961');
 }else if(shape==='allyHealer'){
  R(21,7,22,17,'#d9e8e2');R(17,24,30,27,'#6d8f87');R(29,31,7,7,'#9fffd2');
  R(50,10,3,40,'#c5b16d');R(46,10,11,5,'#9fffd2');
 }else if(shape==='allyTank'){
  R(15,12,34,40,'#536b62');R(8,23,13,27,'#708a80');R(44,23,13,27,'#708a80');R(25,18,6,6,'#b7f3d2');R(37,18,6,6,'#b7f3d2');
 }else if(shape==='allyClone'){
  ctx.globalAlpha=.72;R(18,9,28,19,'#8a72d8');R(14,28,36,25,'#4d3f87');R(23,14,5,5,'#d9ccff');R(36,14,5,5,'#d9ccff');ctx.globalAlpha=1;
 }else{
  R(18,10,28,19,'#9fc8b4');R(14,29,36,24,'#527565');R(24,15,5,5,'#13231c');R(36,15,5,5,'#13231c');
 }

 ctx.restore();

 // marco aliado y barra de vida
 ctx.strokeStyle='#70dc9b';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54);
 R(8,3,48,5,'#163323');
 R(8,3,48*Math.max(0,c.hp/c.maxHp),5,'#70dc9b');
 ctx.fillStyle='#d7ffe5';ctx.font='7px monospace';ctx.textAlign='center';
 ctx.fillText((c.name||'ALIADO').toUpperCase().slice(0,14),x+32,y+63);
}

function enemySprite(x,y,e){
 // some configured enemies (elites especially, since they're built by boosting
 // an already-built enemy rather than a separate template) can end up with no
 // icon of their own - fall back to their base template's icon instead of
 // rendering fully transparent
 if(e.customEnemy&&!e.icon){const t=configuredEnemyTemplateFor(e);if(t?.icon)e.icon=t.icon}
 if(e.customEnemy&&drawEnemyIconHex(e.icon,x,y,e.boss)){enemyStatusOverlay(x,y,e);return}
 const d=enemyDefs[e.type]||{},shape=d.shape||d.sprite||e.type,c=d.color||({
  cultist:'#8c3b31',slagBeast:'#754032',fireImp:'#d84a2e',chainKnight:'#59606a',magmaPriest:'#8d392a',ashGolem:'#6c625c',
  FurnaceTyrant:'#9b3f24',voidClerk:'#4b416f',phaseHound:'#51466f',dataWraith:'#4b65a2',nullMage:'#34265f',quantumGuard:'#4d587c',errorSpawn:'#8a3f85',NullArchivist:'#3a2864'
 }[shape]||'#866080'),a=d.accent||({
  cultist:'#ff8a42',slagBeast:'#f2693d',fireImp:'#ffd158',chainKnight:'#d7a65b',magmaPriest:'#ffca55',ashGolem:'#d17749',
  FurnaceTyrant:'#ffb33f',voidClerk:'#c07cff',phaseHound:'#59e6ef',dataWraith:'#66f1da',nullMage:'#e36aff',quantumGuard:'#7ce2ef',errorSpawn:'#ff5ccf',NullArchivist:'#60e6e0'
 }[shape]||'#ffd36a');
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 R(10,53,44,6,'#08060999');
 if(['goblin','cultist','voidClerk'].includes(shape)){R(17,20,30,29,c);R(11,17,10,13,c);R(43,17,10,13,c);R(20,12,24,10,shade(c,14));R(22,28,6,5,a);R(36,28,6,5,a);R(22,43,20,4,shade(c,-20));if(shape==='cultist'){R(14,10,36,8,'#39161c');R(7,26,8,27,'#7a3327')}if(shape==='voidClerk'){R(12,43,40,10,'#25203d');R(26,13,12,5,a)}}
 else if(['orc','bossOrc','chainKnight','quantumGuard'].includes(shape)){R(10,18,44,37,c);R(4,28,13,24,c);R(47,28,13,24,c);R(17,12,30,11,shade(c,15));R(19,29,7,6,a);R(38,29,7,6,a);R(23,43,18,5,shade(c,-25));if(['chainKnight','quantumGuard'].includes(shape)){R(8,16,48,9,shade(c,20));R(13,25,38,19,shade(c,-8));for(let i=0;i<4;i++)R(15+i*9,28,5,5,a)}if(d.boss||e.boss){R(7,7,50,9,a);R(13,3,7,8,a);R(44,3,7,8,a)}}
 else if(['wolf','phaseHound','slagBeast'].includes(shape)){R(9,30,45,22,c);R(36,18,23,24,c);R(44,12,6,10,c);R(54,17,6,12,c);R(48,26,5,5,a);R(12,49,8,11,shade(c,-15));R(42,49,8,11,shade(c,-15));R(4,34,10,6,shade(c,-10));if(shape==='phaseHound'){R(13,27,8,3,a);R(25,34,8,3,a);R(38,41,8,3,a)}if(shape==='slagBeast'){R(15,24,8,7,'#e75b37');R(28,22,9,6,'#e75b37')}}
 else if(shape==='rider'){R(6,36,52,20,a);R(12,28,40,13,shade(a,-10));R(21,14,28,27,c);R(18,9,8,10,c);R(43,9,8,10,c);R(27,23,6,5,'#f4cf58')}
 else if(['bomber','fireImp','errorSpawn'].includes(shape)){R(15,19,34,34,c);R(7,25,11,19,a);R(46,25,11,19,a);R(23,10,18,13,shade(a,10));R(22,29,6,6,'#1c1017');R(36,29,6,6,'#1c1017');if(shape==='errorSpawn'){for(let i=0;i<5;i++)R(5+rng(50),8+rng(45),5+rng(9),3,a)}}
 else if(['shaman','magmaPriest','nullMage'].includes(shape)){R(17,20,30,35,c);R(22,13,20,12,shade(c,12));R(25,28,6,5,a);R(36,28,6,5,a);R(7,18,5,40,'#765037');R(2,10,15,15,a);R(19,48,26,10,shade(c,-18));if(shape==='magmaPriest'){R(21,7,22,7,'#ff6937')}if(shape==='nullMage'){R(13,15,38,4,a);R(28,5,8,12,a)}}
 else if(['ghoul','ashGolem'].includes(shape)){R(14,15,36,40,c);R(6,35,18,9,c);R(40,35,18,9,c);R(20,24,6,6,a);R(38,24,6,6,a);R(22,42,20,5,shade(c,-20));if(shape==='ashGolem'){R(8,12,48,12,shade(c,-10));R(10,46,44,10,shade(c,-15));R(19,18,7,7,'#e55a32');R(38,18,7,7,'#e55a32')}}
 else if(['vampire','dataWraith'].includes(shape)){R(18,13,28,40,c);R(7,21,18,35,shade(c,-25));R(39,21,18,35,shade(c,-25));R(23,21,5,5,a);R(36,21,5,5,a);R(27,35,10,4,'#e5d5cc');if(shape==='dataWraith'){ctx.globalAlpha=.55;R(10,9,44,48,a);ctx.globalAlpha=1}}
 else if(shape==='mummy'){R(17,10,30,46,c);for(let i=0;i<6;i++)R(13,13+i*8,38,4,a);R(22,19,5,5,'#151015');R(38,19,5,5,'#151015')}
 else if(['lich','madlich','bossLich','NullArchivist'].includes(shape)){R(18,12,28,40,c);R(12,34,40,24,shade(c,-28));R(23,20,6,6,a);R(36,20,6,6,a);R(5,8,7,48,a);R(2,5,13,12,shade(a,15));if(d.boss||e.boss){R(9,5,46,8,a);R(14,1,7,7,a);R(43,1,7,7,a)}if(shape==='NullArchivist'){R(18,39,28,4,'#60e6e0');R(26,10,12,4,'#ff5bd6')}}
 else if(['abomination','FurnaceTyrant'].includes(shape)){R(7,11,50,45,c);R(1,22,15,31,a);R(48,18,15,37,a);for(let i=0;i<3;i++)R(17+i*13,24,7,7,'#ffe57a');if(shape==='FurnaceTyrant'){R(12,7,40,9,'#5a2116');R(18,43,28,8,'#ff6537')}}
 enemyStatusOverlay(x,y,e);
}
// colored border by enemy tier (boss overrides tier coloring with red);
// elites additionally get a black border outside the tier border instead of
// the old fixed purple box. Shared by both the hand-drawn sprite path and
// the icon-hex (customEnemy) path, which used to skip it entirely.
function enemyStatusOverlay(x,y,e){
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 if(e.boss){ctx.strokeStyle='#ff4d4d';ctx.lineWidth=3;ctx.strokeRect(x+3,y+3,58,58)}
 else{ctx.strokeStyle=ENEMY_TIER_BORDER_COLORS[e.tier]||ENEMY_TIER_BORDER_COLORS.i;ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54)}
 if(e.elite){ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.strokeRect(x+2,y+2,60,60);R(27,6,10,4,'#000')}
 if(e.hp<e.maxHp){R(8,58,48,5,'#330d14');R(8,58,48*Math.max(0,e.hp/e.maxHp),5,'#e45c68')}
}



function normalizeClassName(name){return String(name||'').trim().toLowerCase()}
function configClassRowForId(id){const def=classDefs[id];const wanted=normalizeClassName(def?.name||id);return configClasses.find(c=>String(c.class_json?.classId||'')===id)||configClasses.find(c=>normalizeClassName(c.nombre)===wanted)}
function classIconForId(id){const row=configClassRowForId(id);return row?.class_json?.icon||row?.icon||''}
// A class def, whether hardcoded (classDefs) or a fully custom one that only
// exists as a config_class row (no matching classDefs entry at all).
function resolveClassDef(id){
 const base=classDefs[id],row=configClassRowForId(id),j=row?.class_json;
 if(!base&&!j)return null;
 // a DB override (stats edited in the class editor) always wins over the
 // hardcoded baseline, for both built-in and fully custom classes
 return {
  name:j?.name||base?.name||id,
  desc:j?.desc||base?.desc||'Clase personalizada.',
  // merge over full defaults (not just fall back when the whole stats
  // object is missing) - a custom Advanced-mode class saved with a partial
  // stats blob (e.g. missing agility) must not leave that stat undefined,
  // which cascades into NaN vision/maxHp/maxStamina/etc at character creation
  stats:{strength:2,vitality:2,agility:2,luck:2,intelligence:2,wisdom:2,...(j?.stats||base?.stats||{})},
  skills:j?.starterSkills||base?.skills||[],
  resourceBias:j?.resourceBias||base?.resourceBias||'stamina',
  custom:!base
 };
}
function allClassIds(){
 const ids=new Set(Object.keys(classDefs));
 for(const row of configClasses){const cid=row.class_json?.classId;if(cid&&!classDefs[cid])ids.add(cid)}
 return [...ids];
}

async function fetchConfigItems(){try{const r=await fetch('/api/config-items');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar objetos');configItems=Array.isArray(data)?data:[];renderConfigItems();if(document.getElementById('configChestItemResults'))renderChestItemResults()}catch(e){const st=document.getElementById('configStatus');if(st)st.textContent=`Error cargando config_items: ${e.message}`}}

function potionTierLevel(tier){return {common:1,uncommon:2,rare:3,epic:4,legendary:5,artifact:6}[tier]||1}
function potionEffectFromConfig(){
 const type=configPotionEffect?.value||'heal',resource=configPotionResource?.value||'hp',mode=configPotionValueMode?.value||'percent',amount=Number(configPotionAmount?.value)||0,turns=Number(configPotionTurns?.value)||0,stat=configPotionStat?.value||'strength',statAmount=Number(configPotionStatAmount?.value)||1,effect={};
 if(type==='heal'||type==='regen')effect[`${resource}${mode==='percent'?'Pct':'Flat'}`]=mode==='percent'?amount/100:amount;
 if(type==='temporaryStats'||type==='permanentStats')effect.stats={[stat]:statAmount};
 if(type==='learnSkill')effect.skillId=configPotionSkill?.value||selectedConfigSkillIds()[0]||'';
 if(type==='invulnerable')effect.invulnerable=true;if(type==='invisible')effect.invisible=true;
 return {type,effect,turns}
}
function potionKindForEffect(type){return ['permanentStats','learnSkill'].includes(type)?'permanent':['temporaryStats','regen','invulnerable','invisible'].includes(type)?'temporary':'instant'}

function selectedConfigSkillIds(){return [...(document.getElementById('configSkills')?.selectedOptions||[])].map(o=>o.value)}
function currentConfigItemJson(){
 const itemType=configItemType?.value||'equipment',skillIds=selectedConfigSkillIds(),rarity=configTier.value,ilvl=potionTierLevel(rarity);
 if(itemType==='potion'){
  const pot=potionEffectFromConfig(),name=configNombre.value.trim()||'Poción sin nombre',desc=describePotionEffect({type:'potion',potionEffectType:pot.type,effect:pot.effect,duration:pot.turns});
  return {type:'potion',name,slot:'consumable',rarity,label:tierDefs[rarity]?.label||rarity,itemLevel:ilvl,score:ilvl*8,icon:window.currentConfigIconHex||'',iconShape:'vial',potionEffectType:pot.type,kind:potionKindForEffect(pot.type),duration:pot.turns,effect:pot.effect,potionEffect:pot.effect,skillIds:[],stats:configStats.value,affixes:[],passives:[],effects:[],desc:desc||`Poción configurada · ${potionEffectLabels[pot.type]||pot.type}`}
 }
 const slot=configSlot.value,weaponType=slot==='weapon'?(configWeaponCategory.value||configWeaponTypes[0]):null,weaponCategory=weaponType?(configWeaponTypeCategories[weaponType]||weaponCategories[0]):null,weaponIconRow=weaponCategory?weaponRowForCategory(weaponCategory):null,weaponIconCol=weaponCategory?weaponPowerColumn(ilvl,rarity,ilvl*8):null,rangePreset=weaponTypeRanges[weaponType]||{min:1,max:1},rangeMin=slot==='weapon'?normalizeWeaponRangeValue(configRangeMin?.value,rangePreset.min):null,rangeMax=slot==='weapon'?normalizeWeaponRangeValue(configRangeMax?.value,rangePreset.max):null;
 return {type:'equipment',name:configNombre.value.trim()||'Objeto sin nombre',slot,rarity,label:tierDefs[rarity]?.label||rarity,itemLevel:ilvl,score:ilvl*8,icon:window.currentConfigIconHex||'',damageDice:slot==='weapon'?configDamageDice.value:null,rangeMin:slot==='weapon'?Math.min(rangeMin,rangeMax):null,rangeMax:slot==='weapon'?Math.max(rangeMin,rangeMax):null,weaponType,weaponCategory,weaponIconRow,weaponIconCol,weaponIconPath:weaponCategory?weaponIconPath(weaponIconRow,weaponIconCol):null,defenseStat:weaponCategory?(weaponCategoryStats[weaponCategory]||'strength'):null,skillIds,stats:configStats.value,affixes:parseConfigStats(configStats.value),passives:[],effects:[],desc:`Configurado · ${configStats.value||'sin stats'}${skillIds.length?` · Habilidades: ${skillIds.map(id=>skillDefs[id]?.name||id).join(', ')}`:''}`}
}

async function readDeflatedZipEntry(bytes){
 if(!('DecompressionStream' in window))throw new Error('Tu navegador no permite descomprimir ZIP. Extrae el ZIP e importa los JSON sueltos.');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return await new Response(stream).arrayBuffer()
}
function textFromBytes(bytes){return new TextDecoder('utf-8').decode(bytes)}
async function jsonTextsFromFile(file){
 const lower=(file.name||'').toLowerCase();
 if(lower.endsWith('.zip')||file.type==='application/zip'||file.type==='application/x-zip-compressed')return await jsonTextsFromZip(file);
 return [{name:file.name||'archivo.json',text:await file.text()}]
}
async function jsonTextsFromZip(file){
 const buf=await file.arrayBuffer(),view=new DataView(buf),bytes=new Uint8Array(buf),texts=[];
 for(let pos=0;pos<view.byteLength-30;){
  if(view.getUint32(pos,true)!==0x04034b50){pos++;continue}
  const method=view.getUint16(pos+8,true),compressedSize=view.getUint32(pos+18,true),fileNameLength=view.getUint16(pos+26,true),extraLength=view.getUint16(pos+28,true);
  const name=textFromBytes(bytes.slice(pos+30,pos+30+fileNameLength)),dataStart=pos+30+fileNameLength+extraLength,dataEnd=dataStart+compressedSize;
  if(!name.endsWith('/')&&name.toLowerCase().endsWith('.json')){
   let data=bytes.slice(dataStart,dataEnd);
   if(method===8)data=new Uint8Array(await readDeflatedZipEntry(data));
   else if(method!==0)throw new Error(`ZIP no soportado (${name} usa método ${method}).`);
   texts.push({name,text:textFromBytes(data)})
  }
  pos=Math.max(dataEnd,pos+30+fileNameLength+extraLength+compressedSize)
 }
 if(!texts.length)throw new Error('El ZIP no contiene archivos .json válidos.');
 return texts
}
async function parseImportedJsonFiles(files){
 const rows=[];
 for(const f of files){
  for(const entry of await jsonTextsFromFile(f)){
   const parsed=JSON.parse(entry.text);
   rows.push(...(Array.isArray(parsed)?parsed:[parsed]))
  }
 }
 return rows
}
async function postJsonRows(url,rows,{onProgress}={}){
 const saved=[];
 for(let i=0;i<rows.length;i++){
  onProgress?.(i+1,rows.length);
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rows[i])});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||`No se pudo guardar el registro ${i+1}/${rows.length}`);
  saved.push(data)
 }
 return saved
}
async function saveConfigItems(items){const data=await postJsonRows('/api/config-items',items);await fetchConfigItems();return data}
async function updateConfigItem(id,item){const r=await fetch(`/api/config-items?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,id,item_json:item})});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo actualizar');await fetchConfigItems();return data}
async function deleteConfigItem(id){const r=await fetch(`/api/config-items?id=${encodeURIComponent(id)}`,{method:'DELETE'});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo borrar');await fetchConfigItems();return data}
function skillNames(ids=[]){return ids.map(id=>skillDefs[id]?.name||id).join(', ')}
// skills_json on a config_class row overrides/extends skillDefs by id (adds
// new ones, replaces fields on existing ones); classSkillTrees is synthesized
// from the bag's `tier` field for any class without a hardcoded tree already
// (custom classes created purely in the editor). The engine always reads
// skillDefs/classSkillTrees directly elsewhere, so merging here is enough to
// make every other call site "read the DB first, fall back to the hardcoded
// system" for free.
const HARDCODED_CLASS_SKILL_TREE_IDS=new Set(Object.keys(classSkillTrees));
// A skills_json row saved before the buff/debuff add-or-multiply rework
// carries a buffStatCoef/debuffStatCoef written under the OLD percentage
// semantics (e.g. 0.15 meaning "+15%") but has no buffStatMode/debuffStatMode
// key at all, since that field didn't exist yet. Blindly merging it in would
// silently reintroduce the "buffs round down to +0" bug that motivated this
// fix - the stale coefficient wins over the already-corrected hardcoded
// default. Strip it so the merge falls back to the current hardcoded value.
function stripStaleCoefficients(override){
 const o={...override};
 if(o.buffStatCoef!=null&&!('buffStatMode' in override))delete o.buffStatCoef;
 if(o.debuffStatCoef!=null&&!('debuffStatMode' in override))delete o.debuffStatCoef;
 return o;
}
function applyClassSkillOverrides(){
 for(const row of configClasses){
  const bag=row.skills_json;if(!bag||typeof bag!=='object')continue;
  const classId=row.class_json?.classId||normalizeClassName(row.nombre);
  for(const [skillId,override] of Object.entries(bag))skillDefs[skillId]={...(skillDefs[skillId]||{}),...stripStaleCoefficients(override)};
  // classes without a hardcoded tree get theirs (re)synthesized every time,
  // so editing a custom class's skill tiers takes effect on the next load
  if(!HARDCODED_CLASS_SKILL_TREE_IDS.has(classId)){
   const tiers={I:[],II:[],III:[]};
   for(const [skillId,s] of Object.entries(bag))tiers[s.tier===3?'III':s.tier===2?'II':'I'].push(skillId);
   classSkillTrees[classId]=tiers;
  }
 }
}
// Advanced-mode character creation depends on config_class being loaded,
// but the class-choice screen can render before anything ever triggers
// this fetch (it's normally only pulled in when the admin Configuración
// screen opens). configClassesLoaded/configClassesFetchInFlight let
// renderClassChoices() self-heal: fetch once, dedupe concurrent callers,
// and tell "still loading" apart from "genuinely no rows yet".
async function fetchConfigClasses(){
 if(configClassesFetchInFlight)return configClassesFetchInFlight;
 configClassesFetchInFlight=(async()=>{
  try{const r=await fetch('/api/config-class');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar clases');configClasses=Array.isArray(data)?data:[];applyClassSkillOverrides();renderConfigClasses()}
  catch(e){const st=document.getElementById('configClassStatus')||document.getElementById('configStatus');if(st)st.textContent=`Error cargando config_class: ${e.message}`}
  // set the "loaded" flag before the self-healing render below, or a
  // genuinely-empty result would re-trigger the loading state forever
  // (renderClassChoices only re-fetches while configClassesLoaded is false)
  configClassesLoaded=true;configClassesFetchInFlight=null;
  renderClassChoices();
 })();
 return configClassesFetchInFlight;
}
function selectedGameClassId(){return configClassSelect?.value||selectedClass}
// ---- Class/skill editor (config_class, skills_json) ----------------------
// 'bleed'/'burn' are intentionally absent: any periodic-damage effect is
// authored as 'dot' now (they behaved identically to 'dot' anyway - same
// tick handling in tickEnemyStatuses - so the split tags only added
// confusion in this dropdown). Still recognized by the engine if an old
// save or a hand-written skills_json override still uses them.
const ALL_CLASS_EFFECTS=['ranged','shield','dash','debuff','aoe','heal','multihit','utility','ultimate','execute','buff','massive','root','pullRoot','rootBleed','bountyRoot','freeze','delayedFreeze','poison','dot','decayDot','echoDot','delayedPoison','drain','holyLeech','steal','stun','silence','age','wither','doomMark','mark','bountyMark','holyMark','shadowStrike','holyDash','leapBuff','hookBleed','combo','comboMark','markedExecute','bountyExecute','packExecute','pierce','lineShot','ricochet','chain','blinkChain','swapConfuse','teleportDecoy','teleportBuff','randomTeleport','freeTeleport','teleportShield','teleportClones','trap','rootZone','consecrate','stormTotem','areaDot','summon','summonTurret','summonHealer','summonTank','summonScanner','summonElite','multiSummon','clones','clone','cleanseHeal','bigHeal','regenHeal','survivalHeal','healShield','buffArmor','counter','bloodBuff','lifestealBuff','rampage','overcharge','fortress','holyShield','holyAvatar','randomBuff','luckBuff','sniperBuff','stealthShot','shapeShift','lichBuff','implantBuff','mechBuff','wisdomBuff','martyrBuff','oakBuff','resourceRegen','reflect','monkAvatar','tauntBuff','beastAvatar','cheatDeath','cheatDeathHeal','rewind'];
function slugifyClassName(name){return 'custom_'+String(name||'clase').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'')+'_'+Math.random().toString(36).slice(2,6)}
// The editable skill bag for a class: its own skills_json if it has one,
// else synthesized from the hardcoded classSkillTrees+skillDefs so editing
// an unmodified class starts from its real current data.
function classSkillBagFor(id){
 const row=configClassRowForId(id);
 if(row?.skills_json&&Object.keys(row.skills_json).length)return JSON.parse(JSON.stringify(row.skills_json));
 const tree=classSkillTrees[id];if(!tree)return {};
 const bag={};
 for(const [roman,ids] of Object.entries(tree)){const tierNum=roman==='III'?3:roman==='II'?2:1;for(const sid of ids)if(skillDefs[sid])bag[sid]={...skillDefs[sid],tier:tierNum}}
 return bag;
}
function renderClassSkillSelect(){
 const sel=document.getElementById('configClassSkillSelect');if(!sel)return;
 const bag=window.currentClassSkillsDraft||{};
 const ids=Object.keys(bag).sort((a,b)=>(bag[a].tier||1)-(bag[b].tier||1)||a.localeCompare(b));
 sel.innerHTML=ids.map(id=>`<option value="${id}">T${bag[id].tier||1} · ${bag[id].name||id}</option>`).join('')||'<option value="">Sin skills</option>';
 if(ids.length)loadSkillIntoForm(ids.includes(sel.value)?sel.value:ids[0]);
}
// ---- Composable effects list editor (admin) --------------------------------
const STAT_KEYS_CORE=['strength','vitality','agility','luck','intelligence','wisdom'];
const STAT_LABELS_ES={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría',armor:'Armadura',damage:'Daño',ap:'PA'};
function statOptionsHtml(selected,extra=[]){return [...STAT_KEYS_CORE,...extra].map(s=>`<option value="${s}" ${selected===s?'selected':''}>${STAT_LABELS_ES[s]||s}</option>`).join('')}
function defaultComponentFor(kind){
 const base={kind};
 if(kind==='dmg')return {...base,target:'enemy',dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1};
 if(kind==='dot')return {...base,target:'enemy',dotDice:1,dotDie:6,dotStat:'strength',dotStatMode:'add',dotStatCoef:.5,turns:4,flavor:'dot'};
 if(kind==='buff')return {...base,target:'self',stat:'strength',mode:'add',value:5,turns:6};
 if(kind==='debuff')return {...base,target:'enemy',stat:'strength',mode:'add',value:2,turns:3};
 if(kind==='heal')return {...base,target:'self',dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1};
 if(kind==='move')return {...base,mode:'dash',range:3};
 if(kind==='cc')return {...base,target:'enemy',type:'stun',turns:2};
 if(kind==='drain')return {...base,target:'enemy',dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1};
 if(kind==='aoe')return {...base,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,range:2};
 if(kind==='multihit')return {...base,hits:3,dmgDice:1,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:.6};
 if(kind==='mark')return {...base,target:'enemy',value:25,turns:4};
 if(kind==='summon')return {...base,hp:20,turns:8,ap:10,effectType:'damage',dmgDice:1,dmgDie:6,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,effectTurns:2,iconImage:''};
 if(kind==='summonturret')return {...base,hp:16,turns:8,ap:10,range:7,dmgDice:1,dmgDie:6,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,iconImage:''};
 if(kind==='utility')return {...base,mode:'reveal',value:10};
 if(kind==='hot')return {...base,target:'self',dmgDice:1,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:.5,turns:4};
 if(kind==='execute')return {...base,target:'enemy',dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,threshold:35,execMultiplier:2.5};
 if(kind==='pullroot')return {...base,target:'enemy',turns:2};
 if(kind==='counter')return {...base,shield:10,dmgDice:1,dmgDie:8,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,turns:5};
 if(kind==='cheatdeath')return {...base,turns:5};
 return base;
}
function effectComponentTargetOptions(kind){
 if(kind==='dmg')return [{v:'enemy',l:'Enemigo'},{v:'area',l:'Área'},{v:'self',l:'A ti mismo (daño propio)'}];
 if(kind==='dot'||kind==='cc'||kind==='drain'||kind==='mark'||kind==='execute'||kind==='pullroot')return [{v:'enemy',l:'Enemigo'},{v:'area',l:'Área'}];
 if(kind==='heal')return [{v:'self',l:'A ti mismo'},{v:'ally',l:'Aliado (multijugador)'}];
 return null
}
function effectDiceFieldsHtml(comp,i,prefix='dmg'){
 const f=k=>`${prefix}${k}`,dice=comp[f('Dice')],die=comp[f('Die')],stat=comp[f('Stat')],mode=comp[f('StatMode')],coef=comp[f('StatCoef')];
 return `<label>Nº de dados <input type="number" min="0" value="${dice||0}" data-effect-idx="${i}" data-effect-field="${f('Dice')}"></label>
 <label>Dado <select data-effect-idx="${i}" data-effect-field="${f('Die')}">${[4,6,8,10,12,20].map(n=>`<option value="${n}" ${Number(die)===n?'selected':''}>d${n}</option>`).join('')}</select></label>
 <label>Stat <select data-effect-idx="${i}" data-effect-field="${f('Stat')}"><option value="">Automática</option>${statOptionsHtml(stat)}</select></label>
 <label>Modo <select data-effect-idx="${i}" data-effect-field="${f('StatMode')}"><option value="add" ${mode!=='mult'?'selected':''}>Sumatorio</option><option value="mult" ${mode==='mult'?'selected':''}>Multiplicador</option></select></label>
 <label>Coeficiente <input type="number" step="0.1" value="${coef??1}" data-effect-idx="${i}" data-effect-field="${f('StatCoef')}"></label>`
}
function effectComponentCardHtml(comp,i){
 const targetOpts=effectComponentTargetOptions(comp.kind);
 const targetHtml=targetOpts?`<label>Objetivo <select data-effect-idx="${i}" data-effect-field="target">${targetOpts.map(o=>`<option value="${o.v}" ${comp.target===o.v?'selected':''}>${o.l}</option>`).join('')}</select></label>`:'';
 let fields='';
 if(comp.kind==='dmg'||comp.kind==='drain'||comp.kind==='heal')fields=effectDiceFieldsHtml(comp,i);
 else if(comp.kind==='dot')fields=`${effectDiceFieldsHtml(comp,i,'dot')}<label>Turnos <input type="number" min="1" value="${comp.turns??4}" data-effect-idx="${i}" data-effect-field="turns"></label><label>Etiqueta visual <select data-effect-idx="${i}" data-effect-field="flavor"><option value="dot" ${comp.flavor==='dot'?'selected':''}>Genérico</option><option value="bleed" ${comp.flavor==='bleed'?'selected':''}>Sangrado</option><option value="burn" ${comp.flavor==='burn'?'selected':''}>Quemadura</option><option value="poison" ${comp.flavor==='poison'?'selected':''}>Veneno</option></select></label>`;
 else if(comp.kind==='buff'||comp.kind==='debuff')fields=`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,comp.kind==='buff'?['armor','damage','ap']:[])}</select></label><label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label><label>Valor <input type="number" step="0.1" value="${comp.value??(comp.kind==='buff'?5:2)}" data-effect-idx="${i}" data-effect-field="value"></label><label>Turnos <input type="number" min="1" value="${comp.turns??(comp.kind==='buff'?6:3)}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='move')fields=`<label>Tipo <select data-effect-idx="${i}" data-effect-field="mode"><option value="dash" ${comp.mode!=='teleport'?'selected':''}>Dash (avanza y golpea)</option><option value="teleport" ${comp.mode==='teleport'?'selected':''}>Teletransporte</option></select></label><label>Alcance (casillas) <input type="number" min="1" value="${comp.range||3}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 else if(comp.kind==='cc')fields=`<label>Tipo <select data-effect-idx="${i}" data-effect-field="type"><option value="stun" ${comp.type==='stun'?'selected':''}>Aturdir</option><option value="freeze" ${comp.type==='freeze'?'selected':''}>Congelar</option><option value="silence" ${comp.type==='silence'?'selected':''}>Silenciar</option><option value="root" ${comp.type==='root'?'selected':''}>Enraizar</option></select></label><label>Turnos <input type="number" min="1" value="${comp.turns??2}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='aoe')fields=`${effectDiceFieldsHtml(comp,i)}<label>Radio de área (casillas) <input type="number" min="1" value="${comp.range??2}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 else if(comp.kind==='multihit')fields=`<label>Nº de impactos <input type="number" min="1" value="${comp.hits??3}" data-effect-idx="${i}" data-effect-field="hits"></label>${effectDiceFieldsHtml(comp,i)}`;
 else if(comp.kind==='mark')fields=`<label>% de daño adicional recibido <input type="number" min="1" value="${comp.value??25}" data-effect-idx="${i}" data-effect-field="value"></label><label>Turnos <input type="number" min="1" value="${comp.turns??4}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='summon'){
  const effectType=comp.effectType||'damage';
  fields=`<label>HP de la invocación <input type="number" min="1" value="${comp.hp??20}" data-effect-idx="${i}" data-effect-field="hp"></label>
  <label>Turnos de vida <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label>
  <label>PA de la invocación (cada 10 = 1 acción/turno) <input type="number" min="10" step="10" value="${comp.ap??10}" data-effect-idx="${i}" data-effect-field="ap"></label>
  <label>Efecto de la invocación <select data-effect-idx="${i}" data-effect-field="effectType">
   <option value="damage" ${effectType==='damage'?'selected':''}>Daño (ataca al enemigo más cercano)</option>
   <option value="heal" ${effectType==='heal'?'selected':''}>Curación (te cura cada acción)</option>
   <option value="root" ${effectType==='root'?'selected':''}>Raíz (enraíza al enemigo más cercano)</option>
  </select></label>
  ${effectType==='root'?`<label>Turnos de raíz por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:effectDiceFieldsHtml(comp,i)}
  ${summonIconRowHtml(comp,i)}`;
 }
 else if(comp.kind==='summonturret'){
  fields=`<label>HP de la invocación <input type="number" min="1" value="${comp.hp??16}" data-effect-idx="${i}" data-effect-field="hp"></label>
  <label>Turnos de vida <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label>
  <label>PA de la invocación (cada 10 = 1 acción/turno) <input type="number" min="10" step="10" value="${comp.ap??10}" data-effect-idx="${i}" data-effect-field="ap"></label>
  <label>Alcance de ataque (casillas) <input type="number" min="1" value="${comp.range??7}" data-effect-idx="${i}" data-effect-field="range"></label>
  ${effectDiceFieldsHtml(comp,i)}
  ${summonIconRowHtml(comp,i)}`;
 }
 else if(comp.kind==='utility'){
  const mode=comp.mode||'reveal';
  fields=`<label>Tipo <select data-effect-idx="${i}" data-effect-field="mode">
   <option value="reveal" ${mode==='reveal'?'selected':''}>Revelar mapa (radio)</option>
   <option value="stealth" ${mode==='stealth'?'selected':''}>Sigilo (evita la respuesta enemiga)</option>
   <option value="shield" ${mode==='shield'?'selected':''}>Escudo plano</option>
   <option value="resource" ${mode==='resource'?'selected':''}>Restaurar recurso (maná/stamina)</option>
  </select></label>
  ${mode!=='stealth'?`<label>${mode==='reveal'?'Radio':mode==='shield'?'Cantidad de escudo':'Cantidad restaurada'} <input type="number" min="1" value="${comp.value??10}" data-effect-idx="${i}" data-effect-field="value"></label>`:''}`;
 }
 else if(comp.kind==='hot')fields=`${effectDiceFieldsHtml(comp,i)}<label>Turnos <input type="number" min="1" value="${comp.turns??4}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='execute')fields=`${effectDiceFieldsHtml(comp,i)}<label>Umbral de vida del objetivo (%) <input type="number" min="1" max="99" value="${comp.threshold??35}" data-effect-idx="${i}" data-effect-field="threshold"></label><label>Multiplicador de ejecución (por debajo del umbral) <input type="number" step="0.1" min="1" value="${comp.execMultiplier??2.5}" data-effect-idx="${i}" data-effect-field="execMultiplier"></label>`;
 else if(comp.kind==='pullroot')fields=`<label>Turnos enraizado <input type="number" min="1" value="${comp.turns??2}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='counter')fields=`<label>Escudo otorgado <input type="number" min="0" value="${comp.shield??10}" data-effect-idx="${i}" data-effect-field="shield"></label>${effectDiceFieldsHtml(comp,i)}<label>Turnos de ventana (hasta el próximo golpe) <input type="number" min="1" value="${comp.turns??5}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='cheatdeath')fields=`<label>Turnos activo <input type="number" min="1" value="${comp.turns??5}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 return `<details class="effectCard" open><summary class="effectCardHead"><b>${i+1}. ${effectKindLabel(comp.kind)}</b><button type="button" data-remove-effect="${i}">Quitar</button></summary><div class="configForm">${targetHtml}${fields}</div></details>`;
}
// Icon picker row embedded inside a summon/summonturret effect card: shows
// the currently assigned image (if any) plus buttons that pull from / clear
// against the shared "Imagen de invocación" editor above (window.currentSummonIconHex).
function summonIconRowHtml(comp,i){
 return `<div class="effectIconRow">
  <canvas class="effectIconThumb" width="50" height="50" ${comp.iconImage?`data-summon-icon-idx="${i}"`:''}></canvas>
  <button type="button" data-use-summon-icon="${i}">Usar imagen del editor de arriba →</button>
  ${comp.iconImage?`<button type="button" data-clear-summon-icon="${i}">Quitar imagen</button>`:'<span class="small">Sin imagen: usará el sprite genérico de aliado.</span>'}
 </div>`;
}
// Every already-uploaded custom icon in the system (items, enemies, classes,
// skills), deduped by hex, so a summon effect can reuse one instead of the
// admin having to crop the same image again.
function summonIconOptionsList(){
 const seen=new Set(),opts=[];
 const add=(hex,label)=>{if(!hex||seen.has(hex))return;seen.add(hex);opts.push({hex,label})};
 for(const row of configItems||[]){const item=row.item_json||row;add(item.icon||row.icon,`Objeto: ${item.name||row.nombre||row.id}`)}
 for(const row of configEnemyDetails||[]){add(row.icon,`Enemigo: ${row.class||row.type||row.id}`)}
 for(const row of configClasses||[]){
  const cj=row.class_json||{};
  add(cj.icon,`Clase: ${cj.name||row.nombre||row.id}`);
  for(const [sid,s] of Object.entries(row.skills_json||{}))add(s.iconImage,`Skill: ${s.name||sid}`);
 }
 return opts;
}
function populateSummonIconExistingList(){
 const sel=document.getElementById('configSummonIconExisting');if(!sel)return;
 const current=sel.value,opts=summonIconOptionsList();
 sel.innerHTML='<option value="">— Elegir de la lista —</option>'+opts.map(o=>`<option value="${o.hex}">${o.label}</option>`).join('');
 if(opts.some(o=>o.hex===current))sel.value=current;
}
function renderSkillEffectsList(){
 const wrap=document.getElementById('configSkillEffectsList');if(!wrap)return;
 populateSummonIconExistingList();
 const list=window.currentSkillEffectsDraft||[];
 wrap.innerHTML=list.map((comp,i)=>effectComponentCardHtml(comp,i)).join('')||'<p class="small">Sin efectos apilables añadidos todavía: elige un tipo arriba y pulsa "Añadir efecto".</p>';
 wrap.querySelectorAll('[data-effect-idx]').forEach(el=>{
  el.addEventListener('change',()=>{
   const idx=Number(el.dataset.effectIdx),field=el.dataset.effectField;
   const isNumber=el.type==='number';
   window.currentSkillEffectsDraft[idx][field]=isNumber?Number(el.value):el.value;
   // these two fields change which sub-fields the card shows, so re-render
   // that one card's layout instead of leaving stale/hidden inputs behind
   if(field==='effectType'||field==='mode')renderSkillEffectsList();
  });
 });
 wrap.querySelectorAll('[data-remove-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentSkillEffectsDraft.splice(Number(btn.dataset.removeEffect),1);renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-use-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const idx=Number(btn.dataset.useSummonIcon);
  if(!window.currentSummonIconHex){alert('Primero elige o recorta una imagen en "Imagen de invocación".');return}
  window.currentSkillEffectsDraft[idx].iconImage=window.currentSummonIconHex;renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-clear-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentSkillEffectsDraft[Number(btn.dataset.clearSummonIcon)].iconImage='';renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-summon-icon-idx]').forEach(c=>{
  const comp=window.currentSkillEffectsDraft[Number(c.dataset.summonIconIdx)];
  if(comp?.iconImage)drawSkillIconImg(c,comp.iconImage);
 });
}
// Old skills (authored before the stackable effects list existed) stored
// their damage/buff/debuff/dot config as flat fields on the skill itself
// instead of in `effects`. The dedicated form fields for those are gone now
// that everything routes through the stackable list, so translate them into
// the equivalent component(s) once, on load, instead of losing them.
function legacyEffectsFromSkill(s){
 const list=[],selfTarget=['buff','shield','heal','utility'].includes(s.classEffect);
 if(s.dmgDice>0)list.push({kind:'dmg',target:selfTarget?'self':'enemy',dmgDice:s.dmgDice,dmgDie:s.dmgDie||6,dmgStat:s.dmgStat||'',dmgStatMode:s.dmgStatMode||'add',dmgStatCoef:s.dmgStatCoef??1});
 if(s.buffStat)list.push({kind:'buff',target:'self',stat:s.buffStat,mode:s.buffStatMode||'add',value:s.buffStatCoef??5,turns:s.buffTurns||6});
 if(s.debuffStat)list.push({kind:'debuff',target:'enemy',stat:s.debuffStat,mode:s.debuffStatMode||'add',value:s.debuffStatCoef??2,turns:s.debuffTurns||3});
 if(s.dotDice>0)list.push({kind:'dot',target:'enemy',dotDice:s.dotDice,dotDie:s.dotDie||6,dotStat:s.dotStat||'',dotStatMode:s.dotStatMode||'add',dotStatCoef:s.dotStatCoef??1,turns:s.dotTurns||4,flavor:'dot'});
 return list;
}
function loadSkillIntoForm(skillId){
 const s=(window.currentClassSkillsDraft||{})[skillId];if(!s)return;
 window.editingConfigSkillId=skillId;
 window.currentSkillEffectsDraft=(s.effects&&s.effects.length)?JSON.parse(JSON.stringify(s.effects)):legacyEffectsFromSkill(s);
 renderSkillEffectsList();
 document.getElementById('configClassSkillSelect').value=skillId;
 document.getElementById('configSkillId').value=skillId;
 document.getElementById('configSkillName').value=s.name||'';
 document.getElementById('configSkillIconText').value=s.icon||'';
 document.getElementById('configSkillTier').value=String(s.tier||1);
 document.getElementById('configSkillResource').value=s.resource||'stamina';
 document.getElementById('configSkillCost').value=s.cost??10;
 document.getElementById('configSkillCd').value=s.cd??5;
 document.getElementById('configSkillApCost').value=s.apCost??10;
 document.getElementById('configSkillType').value=s.type||'physical';
 document.getElementById('configSkillRarity').value=s.rarity||'common';
 document.getElementById('configSkillRange').value=s.range??1;
 document.getElementById('configSkillTargetMode').value=s.targetMode||'';
 document.getElementById('configSkillEffect').value=s.classEffect||'ranged';
 document.getElementById('configSkillEnemyUsable').checked=s.enemyUsable!==false;
 document.getElementById('configSkillDesc').value=s.desc||'';
 window.currentConfigSkillIconHex=s.iconImage||'';
 renderConfigIconPreview(window.currentConfigSkillIconHex,'configSkillIconPreview','configSkillIconStatus');
 document.getElementById('configSkillIconStatus').textContent=window.currentConfigSkillIconHex?'Imagen personalizada activa.':'Sin imagen: se usa el icono de texto/emoji.';
 const st=document.getElementById('configSkillStatus');if(st)st.textContent=`Editando ${s.name||skillId}.`;
}
function currentSkillFormJson(){
 return {
  name:document.getElementById('configSkillName').value.trim()||'Skill sin nombre',
  icon:document.getElementById('configSkillIconText').value.trim()||'✦',
  iconImage:window.currentConfigSkillIconHex||'',
  desc:document.getElementById('configSkillDesc').value.trim(),
  cd:Number(document.getElementById('configSkillCd').value)||1,
  apCost:Number(document.getElementById('configSkillApCost').value)||10,
  resource:document.getElementById('configSkillResource').value,
  cost:Number(document.getElementById('configSkillCost').value)||0,
  type:document.getElementById('configSkillType').value,
  rarity:document.getElementById('configSkillRarity').value,
  range:Number(document.getElementById('configSkillRange').value)||0,
  targetMode:document.getElementById('configSkillTargetMode').value||undefined,
  classEffect:document.getElementById('configSkillEffect').value,
  tier:Number(document.getElementById('configSkillTier').value)||1,
  classId:window.pendingNewClassId||selectedGameClassId(),
  enemyUsable:document.getElementById('configSkillEnemyUsable').checked,
  effects:(window.currentSkillEffectsDraft&&window.currentSkillEffectsDraft.length)?window.currentSkillEffectsDraft:undefined,
  unlock:'Clase'
 };
}
function currentConfigClassJson(){
 const id=window.pendingNewClassId||selectedGameClassId(),base=resolveClassDef(id);
 const starterWeaponSel=document.getElementById('configClassStarterWeapon');
 return {
  classId:id,
  name:document.getElementById('configClassName').value.trim()||id,
  desc:document.getElementById('configClassDesc').value.trim()||'Clase personalizada.',
  icon:window.currentConfigClassIconHex||'',
  stats:{strength:Number(configClassStr.value)||0,vitality:Number(configClassVit.value)||0,agility:Number(configClassAgi.value)||0,luck:Number(configClassLuck.value)||0,intelligence:Number(configClassInt.value)||0,wisdom:Number(configClassWis.value)||0},
  starterSkills:base?.skills||[],
  resourceBias:base?.resourceBias||'stamina',
  starterWeaponType:starterWeaponSel?.value||'',
  starterPotionIds:[...(window.currentClassStarterPotionIds||[])]
 };
}
async function saveConfigClass(item,skillsBag){
 const row=window.pendingNewClassId?null:configClassRowForId(item.classId);
 const method=row?'PUT':'POST',url=row?`/api/config-class?id=${encodeURIComponent(row.id)}`:'/api/config-class';
 // saving a class from this editor is the explicit signal that it's ready
 // for Advanced skill mode - flips config_class.advanced to true so
 // classIdsForSkillMode('advanced') picks it up regardless of whether its
 // classId happens to reuse a hardcoded one (a reskinned/renamed class).
 const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row?.id,nombre:item.name,icon:item.icon,class_json:item,skills_json:skillsBag,advanced:true})});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar la clase');
 window.pendingNewClassId=null;
 await fetchConfigClasses();
 return data;
}
function renderConfigClasses(){
 const sel=document.getElementById('configClassSelect'),list=document.getElementById('configClassesList');if(!sel)return;
 const previous=sel.value||selectedClass,ids=allClassIds();
 sel.innerHTML=ids.map(id=>`<option value="${id}">${resolveClassDef(id)?.name||id}</option>`).join('');
 sel.value=ids.includes(previous)?previous:selectedClass;
 if(list)list.innerHTML=ids.map(id=>{const row=configClassRowForId(id),icon=row?.class_json?.icon||row?.icon||'',c=resolveClassDef(id);return `<div class="configItem"><span class="tierDot" style="background:${icon?'#8c72e8':'#4d395a'}"></span><div><b>${c.name}</b><span class="small">${c.custom?'Clase personalizada':'Clase base'} · ${row?`BDD #${row.id}`:'Sin fila BDD'} · ${icon?'Icono subido':'Pixels por defecto'}${row?.skills_json?' · Skills personalizadas':''}${row?.advanced?' · <b style="color:#ffc35a">Advanced</b>':''}</span></div></div>`}).join('');
 loadSelectedConfigClass();
}
function loadSelectedConfigClass(){
 window.pendingNewClassId=null;
 const id=selectedGameClassId(),def=resolveClassDef(id),row=configClassRowForId(id);
 configClassName.value=def?.name||id;
 document.getElementById('configClassDesc').value=def?.desc||'';
 const stats=def?.stats||{};
 configClassStr.value=stats.strength??2;configClassVit.value=stats.vitality??2;configClassAgi.value=stats.agility??2;configClassLuck.value=stats.luck??2;configClassInt.value=stats.intelligence??2;configClassWis.value=stats.wisdom??2;
 window.currentConfigClassIconHex=row?.class_json?.icon||row?.icon||'';
 renderConfigIconPreview(window.currentConfigClassIconHex,'configClassIconPreview','configClassIconStatus');
 configClassIconStatus.textContent=window.currentConfigClassIconHex?'Icono cargado para esta clase.':'Sin icono: usará los pixels por defecto.';
 // only fall back to the generic sprite preview when there's genuinely no
 // uploaded icon - drawClassPreview's own image-loading path raced with
 // renderConfigIconPreview's above and could clobber a real DB icon with
 // the default sprite while the (already-cached) image was still resolving
 if(!window.currentConfigClassIconHex)drawClassPreview(configClassIconPreview,id);
 window.currentClassSkillsDraft=classSkillBagFor(id);
 renderClassSkillSelect();
 renderConfigClassStarterGearOptions(row?.class_json?.starterWeaponType||'',row?.class_json?.starterPotionIds||[]);
}
// Populates the starter-weapon-type picker and the searchable starter-
// potions checklist for the advanced class editor, selecting whatever this
// class row already has (empty = fall back to the generic per-classId
// table / default potions at character creation, see
// makeStarterWeapon/addStarterPotions).
function renderConfigClassStarterGearOptions(selectedWeaponType='',selectedPotionIds=[]){
 const weaponSel=document.getElementById('configClassStarterWeapon');
 if(weaponSel){
  weaponSel.innerHTML='<option value="">— Automático (genérico) —</option>'+configWeaponTypes.map(t=>`<option value="${t}" ${t===selectedWeaponType?'selected':''}>${t}</option>`).join('');
 }
 window.currentClassStarterPotionIds=(selectedPotionIds||[]).map(String);
 const search=document.getElementById('configClassPotionSearch');if(search)search.value='';
 renderConfigClassPotionResults();
}
// Searchable checklist of every configured potion, mirroring the chest
// item picker (renderChestItemResults) so starter potions are actually
// visible/browsable instead of buried in a barely-usable <select multiple>.
function renderConfigClassPotionResults(){
 const root=document.getElementById('configClassPotionResults'),summary=document.getElementById('configClassPotionSummary');
 if(!root)return;
 window.currentClassStarterPotionIds=window.currentClassStarterPotionIds||[];
 const q=(document.getElementById('configClassPotionSearch')?.value||'').trim().toLowerCase();
 const pool=configItems.filter(r=>(r.item_json||r).type==='potion').map(r=>({id:String(r.id),name:(r.item_json||r).name||r.nombre||String(r.id)})).filter(x=>!q||x.name.toLowerCase().includes(q));
 const selected=new Set(window.currentClassStarterPotionIds.map(String));
 root.innerHTML=pool.length?pool.map(x=>`<label class="configItem"><input type="checkbox" data-class-potion-pick="${x.id}" ${selected.has(x.id)?'checked':''}><span>${x.name}</span></label>`).join(''):'<p class="small">No hay pociones configuradas todavía.</p>';
 const updateSummary=()=>{if(summary)summary.textContent=window.currentClassStarterPotionIds.length?`${window.currentClassStarterPotionIds.length} poción(es) seleccionada(s) como equipo inicial.`:'Nada seleccionado: se usarán las 2 pociones de curación por defecto.'};
 root.querySelectorAll('[data-class-potion-pick]').forEach(cb=>cb.onchange=()=>{
  const id=cb.dataset.classPotionPick;
  window.currentClassStarterPotionIds=cb.checked?[...window.currentClassStarterPotionIds,id]:window.currentClassStarterPotionIds.filter(x=>x!==id);
  updateSummary();
 });
 updateSummary();
}

function renderConfigItemRow(i){const item=i.item_json||i,skills=Array.isArray(item.skillIds)?item.skillIds:[],isPotion=item.type==='potion',weaponType=item.slot==='weapon'&&(item.weaponType||item.weaponCategory)?` · ${item.weaponType||item.weaponCategory}`:'',weaponRange=item.slot==='weapon'?` · alcance ${weaponRangeBounds(item).min}-${weaponRangeBounds(item).max}`:'';return `<div class="configItem"><span class="tierDot" style="background:${tierColor(i.tier)}"></span><div><b>${i.nombre||'Sin nombre'}</b><span class="small">${isPotion?'Poción · ':''}${tierDefs[item.rarity||i.tier]?.label||item.rarity||i.tier} · iLvl ${item.itemLevel||i.ilvl||1}${weaponType}${weaponRange}${isPotion?` · ${potionEffectLabels[item.potionEffectType]||item.kind||'efecto'}`:''}${skills.length?` · ${skillNames(skills)}`:''}</span><div class="configItemActions"><button type="button" data-config-edit="${i.id}">Editar</button><button type="button" data-config-duplicate="${i.id}">Duplicar</button><button type="button" data-config-delete="${i.id}">Borrar</button></div></div></div>`}
function renderConfigItems(){const root=document.getElementById('configItemsList');if(!root)return;if(!configItems.length){root.innerHTML='<p class="small">No hay objetos configurados.</p>';return}const knownConfigGroups=[...slots,'consumable'];const grouped=configItems.reduce((acc,i)=>{const item=i.item_json||i,slot=item.type==='potion'?'consumable':(i.slot||item.slot||'otros'),weaponGroup=slot==='weapon'?(item.weaponType||item.weaponCategory||'Sin tipo de arma'):null,key=weaponGroup?`${slot}::${weaponGroup}`:slot;(acc[key]??={slot,weaponGroup,items:[]}).items.push(i);return acc},{}),orderedKeys=[...knownConfigGroups.flatMap(slot=>Object.keys(grouped).filter(key=>grouped[key].slot===slot).sort((a,b)=>(grouped[a].weaponGroup||'').localeCompare(grouped[b].weaponGroup||'','es'))),...Object.keys(grouped).filter(key=>!knownConfigGroups.includes(grouped[key].slot)).sort((a,b)=>a.localeCompare(b,'es'))];root.innerHTML=orderedKeys.map((key,index)=>{const group=grouped[key],title=group.weaponGroup?`${slotNames[group.slot]||group.slot} · ${group.weaponGroup}`:(group.slot==='consumable'?itemTypes.potion:(slotNames[group.slot]||group.slot));return `<details class="configSlotGroup" ${index===0?'open':''}><summary><span>${title}</span><b>${group.items.length}</b></summary><div class="configSlotItems">${group.items.map(renderConfigItemRow).join('')}</div></details>`}).join('');root.querySelectorAll('[data-config-edit]').forEach(b=>b.onclick=()=>loadConfigItemForEdit(b.dataset.configEdit));root.querySelectorAll('[data-config-duplicate]').forEach(b=>b.onclick=()=>duplicateConfigItem(b.dataset.configDuplicate));root.querySelectorAll('[data-config-delete]').forEach(b=>b.onclick=()=>removeConfigItem(b.dataset.configDelete))}
function configStatDefinitions(){const seen=new Set();return [...primaryAffixes,...secondaryAffixes].filter(def=>{if(seen.has(def.key))return false;seen.add(def.key);return true})}
function renderConfigStatsHelp(){const root=document.getElementById('configStatsHelp');if(!root)return;root.innerHTML='<p class="small"><b>Bonos disponibles:</b> pulsa uno para añadirlo a Stats.</p>'+configStatDefinitions().map(def=>`<button type="button" class="statBonusButton" data-stat-bonus="${def.key}" title="${def.label}. Slots: ${def.slots.map(s=>slotNames[s]||s).join(', ')}"><b>${def.key}</b><span>${def.label}${def.percent?' %':''}</span></button>`).join('');root.querySelectorAll('[data-stat-bonus]').forEach(btn=>btn.onclick=()=>{const sep=configStats.value.trim()? ', ':'';configStats.value+=`${sep}${btn.dataset.statBonus}:+1`;configStats.focus()})}
function renderConfigSkillSelect(){const sel=document.getElementById('configSkills'),pot=document.getElementById('configPotionSkill');if(!sel)return;const html=Object.entries(skillDefs).sort((a,b)=>(a[1].name||a[0]).localeCompare(b[1].name||b[0],'es')).map(([id,d])=>`<option value="${id}">${d.icon||'•'} ${d.name} · ${tierDefs[d.rarity]?.label||d.rarity||'Común'}</option>`).join('');sel.innerHTML=html;if(pot)pot.innerHTML=html}
function setConfigSkillSelection(ids=[]){const set=new Set(ids);document.querySelectorAll('#configSkills option').forEach(o=>o.selected=set.has(o.value))}
function addIconSilhouetteBorder(canvas,size=2,color=[0,0,0,255]){const q=canvas.getContext('2d'),w=canvas.width,h=canvas.height,orig=document.createElement('canvas');orig.width=w;orig.height=h;orig.getContext('2d').drawImage(canvas,0,0);const src=q.getImageData(0,0,w,h),border=q.createImageData(w,h),r=Math.max(1,Math.round(size));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(src.data[i+3]>8)continue;let near=false;for(let dy=-r;dy<=r&&!near;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;if(src.data[(ny*w+nx)*4+3]>8){near=true;break}}if(near){border.data[i]=color[0];border.data[i+1]=color[1];border.data[i+2]=color[2];border.data[i+3]=color[3]}}q.putImageData(border,0,0);q.drawImage(orig,0,0);return canvas}
function renderConfigIconPreview(hex,previewId='configIconPreview',statusId='configIconStatus',withBorder=!String(previewId).toLowerCase().includes('tile')){const preview=document.getElementById(previewId);if(!preview)return;const c=preview.getContext('2d');c.clearRect(0,0,50,50);if(!hex)return;try{const data='data:image/png;base64,'+hexToBase64(hex.startsWith('#')?hex.slice(1):hex),img=configIconImage(data);const draw=()=>{const out=document.createElement('canvas');out.width=out.height=50;const o=out.getContext('2d');o.imageSmoothingEnabled=false;o.clearRect(0,0,50,50);o.drawImage(img,0,0,50,50);if(withBorder)addIconSilhouetteBorder(out,2);c.clearRect(0,0,50,50);c.drawImage(out,0,0)};if(img.complete&&img.naturalWidth)draw();else img.onload=draw}catch(e){const st=document.getElementById(statusId);if(st)st.textContent='No se pudo previsualizar el icono guardado.'}}
function resetConfigForm(){window.editingConfigItemId=null;configItemType.value='equipment';configNombre.value='';configTier.value='common';configSlot.value='weapon';configIlvl.value='1';configPotionEffect.value='heal';configPotionResource.value='hp';configPotionValueMode.value='percent';configPotionAmount.value='25';configPotionTurns.value='6';configPotionStat.value='strength';configPotionStatAmount.value='1';configWeaponCategory.value=configWeaponTypes[0];configDamageDice.value='1d6';if(configRangeMin)configRangeMin.value='1';if(configRangeMax)configRangeMax.value='1';configStats.value='';window.currentConfigIconHex='';setConfigSkillSelection([]);configIconStatus.textContent='Sin icono';renderConfigIconPreview('');configStatus.textContent='Nuevo objeto.';configSlot.dispatchEvent(new Event('change'))}
function loadConfigItemForEdit(id){const row=configItems.find(i=>String(i.id)===String(id));if(!row)return;const item=row.item_json||row;window.editingConfigItemId=row.id;configNombre.value=item.name||row.nombre||'';configTier.value=item.rarity||row.tier||'common';configItemType.value=item.type==='potion'?'potion':'equipment';configSlot.value=item.slot==='consumable'?'trinket1':(item.slot||row.slot||'trinket1');configIlvl.value=item.itemLevel||row.ilvl||1;configDamageDice.value=item.damageDice||'1d6';configWeaponCategory.value=item.weaponType||item.weaponCategory||configWeaponTypes[0];const bounds=weaponRangeBounds(item);if(configRangeMin)configRangeMin.value=bounds.min;if(configRangeMax)configRangeMax.value=bounds.max;configStats.value=item.stats||row.stats||'';window.currentConfigIconHex=item.icon||row.icon||'';setConfigSkillSelection(item.skillIds||[]);if(item.type==='potion'){configPotionEffect.value=item.potionEffectType||'heal';configPotionTurns.value=item.duration||6;const e=item.effect||{},resource=['hp','mana','stamina'].find(r=>e[`${r}Pct`]||e[`${r}Flat`]||e.healPct||e.regenPct)||'hp';configPotionResource.value=resource;configPotionValueMode.value=e[`${resource}Flat`]?'flat':'percent';configPotionAmount.value=e[`${resource}Flat`]||Math.round((e[`${resource}Pct`]||e.healPct||e.regenPct||0)*100)||25;const statEntry=Object.entries(e.stats||{})[0];if(statEntry){configPotionStat.value=statEntry[0];configPotionStatAmount.value=statEntry[1]}configPotionSkill.value=e.skillId||configPotionSkill.value;togglePotionEffectFields();}renderConfigIconPreview(window.currentConfigIconHex);configIconStatus.textContent=window.currentConfigIconHex?'Icono cargado desde objeto guardado.':'Sin icono';configSlot.dispatchEvent(new Event('change'));configStatus.textContent=`Editando #${row.id}: ${configNombre.value||'Sin nombre'}`}
async function duplicateConfigItem(id){const row=configItems.find(i=>String(i.id)===String(id));if(!row)return;configStatus.textContent='Duplicando...';try{const item={...(row.item_json||row),name:`${(row.item_json||row).name||row.nombre||'Objeto'} (copia)`};await saveConfigItems([{...item,nombre:item.name,slot:item.slot,tier:item.rarity,ilvl:item.itemLevel,item_json:item}]);configStatus.textContent='Objeto duplicado.'}catch(e){configStatus.textContent=e.message}}
async function removeConfigItem(id){if(!confirm('¿Borrar este objeto configurado?'))return;configStatus.textContent='Borrando...';try{await deleteConfigItem(id);if(String(window.editingConfigItemId)===String(id))resetConfigForm();configStatus.textContent='Objeto borrado.'}catch(e){configStatus.textContent=e.message}}

function emptyFloorDraft(){return {name:'Caverna verdeante',story:'Cavernas húmedas cubiertas de musgo, raíces y piedra viva.',floorTiles:[],wallTiles:[],doorTiles:[]}}
function currentFloorDraft(){return window.editingConfigFloorJson||emptyFloorDraft()}
async function fetchConfigFloors(){try{const r=await fetch('/api/config-floor');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar floors');configFloors=Array.isArray(data)?data:[];renderConfigTilesets();setupWorldSettings()}catch(e){const st=document.getElementById('configTilesetStatus');if(st)st.textContent=`Error cargando config_floor: ${e.message}`}}
async function saveConfigFloorRow(floor){const id=window.editingConfigFloorId;const r=await fetch(id?`/api/config-floor?id=${encodeURIComponent(id)}`:'/api/config-floor',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({floor_name:floor.name,floor_json:floor})});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar floor');await fetchConfigFloors();setupWorldSettings();return data}
function tileLabel(t,i){return `${t.name||'Tile '+(i+1)} · ${t.type==='wall'?'Muro':t.type==='door'?'Puerta':'Suelo'}${t.direction?` · ${t.direction}`:''}`}
function renderConfigTilesets(){const floor=currentFloorDraft(),tiles=[...(floor.floorTiles||[]).map((t,i)=>({...t,_key:'floorTiles',_index:i})),...(floor.wallTiles||[]).map((t,i)=>({...t,_key:'wallTiles',_index:i})),...(floor.doorTiles||[]).map((t,i)=>({...t,_key:'doorTiles',_index:i}))];const list=document.getElementById('configTilesList'),fl=document.getElementById('configFloorsList');if(list)list.innerHTML=tiles.length?tiles.map((t,i)=>`<div class="configItem"><span class="tierDot" style="background:${t.color||'#263927'}"></span><div><b>${tileLabel(t,i)}</b><span class="small">Rotación: ${t.rotatable?'sí':'no'} · Icono: ${t.icon?'imagen':'colores'}</span><div class="configItemActions"><button type="button" data-edit-tile-key="${t._key}" data-edit-tile-index="${t._index}">Editar tile</button><button type="button" data-delete-tile-key="${t._key}" data-delete-tile-index="${t._index}">Borrar tile</button></div></div></div>`).join(''):'<p class="small">Aún no hay tiles en este floor.</p>';if(fl)fl.innerHTML=[...configFloors.map(r=>({...(r.floor_json||{}),id:r.id,name:r.floor_json?.name||r.floor_name})),...(!configFloors.length?defaultTilesetFloors:[])].map((f,i)=>`<div class="configItem"><span class="tierDot" style="background:${f.floorTiles?.[0]?.color||'#263927'}"></span><div><b>${f.name}</b><span class="small">${f.floorTiles?.length||0} suelo · ${f.wallTiles?.length||0} muro · ${f.doorTiles?.length||0} puerta</span><div class="configItemActions"><button type="button" data-load-floor="${f.id||''}" data-default-floor="${!f.id?i:''}">Editar floor</button></div></div></div>`).join('');document.querySelectorAll('[data-load-floor]').forEach(btn=>btn.onclick=()=>loadConfigFloor(btn.dataset.loadFloor,btn.dataset.defaultFloor));document.querySelectorAll('[data-edit-tile-key]').forEach(btn=>btn.onclick=()=>loadConfigTile(btn.dataset.editTileKey,Number(btn.dataset.editTileIndex)));document.querySelectorAll('[data-delete-tile-key]').forEach(btn=>btn.onclick=()=>deleteConfigTile(btn.dataset.deleteTileKey,Number(btn.dataset.deleteTileIndex)));renderTileSelects()}
function renderTileSelects(){const floor=currentFloorDraft();for(const [id,key] of [['configFloorTiles','floorTiles'],['configWallTiles','wallTiles'],['configDoorTiles','doorTiles']]){const el=document.getElementById(id);if(el)el.innerHTML=(floor[key]||[]).map((t,i)=>`<option value="${i}" selected>${t.name}</option>`).join('')}}
function selectedTilesForKey(key){return currentFloorDraft()[key]||[]}
function loadConfigFloor(id,defaultIndex){const row=configFloors.find(r=>String(r.id)===String(id));const f=row?{...(row.floor_json||{}),name:row.floor_json?.name||row.floor_name}:defaultTilesetFloors[Number(defaultIndex)]||emptyFloorDraft();window.editingConfigFloorId=row?.id||null;window.editingConfigFloorJson=JSON.parse(JSON.stringify(f));window.editingConfigTileRef=null;configFloorName.value=f.name||'';configFloorStory.value=f.story||'';configTilesetStatus.textContent=`Editando floor ${f.name}.`;resetConfigTileForm(false);renderConfigTilesets()}
function tileArrayKey(type){return type==='wall'?'wallTiles':type==='door'?'doorTiles':'floorTiles'}
function resetConfigTileForm(clearIcon=true){configTileName.value='';configTileType.value='floor';configTileColor.value='#263927';configTileAlt.value='#314832';configTileAccent.value='#8fbf63';configWallDirection.value='top';configTileRotatable.checked=true;if(clearIcon){window.currentConfigTileIconHex='';renderConfigIconPreview('','configTileIconPreview','configTileIconStatus')}configTileType.dispatchEvent(new Event('change'))}
function loadConfigTile(key,index){const floor=currentFloorDraft(),tile=floor[key]?.[index];if(!tile)return;window.editingConfigTileRef={key,index};configTileName.value=tile.name||'';configTileType.value=tile.type||({floorTiles:'floor',wallTiles:'wall',doorTiles:'door'}[key]||'floor');configTileColor.value=tile.color||'#263927';configTileAlt.value=tile.alt||tile.top||'#314832';configTileAccent.value=tile.accent||'#8fbf63';configWallDirection.value=tile.direction||'top';configTileRotatable.checked=!!tile.rotatable;window.currentConfigTileIconHex=tile.icon||'';renderConfigIconPreview(window.currentConfigTileIconHex,'configTileIconPreview','configTileIconStatus');configTileType.dispatchEvent(new Event('change'));configTilesetStatus.textContent=`Editando tile ${tile.name||index+1}. Guarda el tile para aplicar cambios al floor.`}
function deleteConfigTile(key,index){const floor=currentFloorDraft();if(!floor[key]?.[index])return;if(!confirm('¿Borrar este tile del floor actual?'))return;floor[key].splice(index,1);window.editingConfigFloorJson=floor;window.editingConfigTileRef=null;resetConfigTileForm();configTilesetStatus.textContent='Tile borrado del floor actual. Guarda el floor para consolidar en config_floor.';renderConfigTilesets()}
function setupTilesetConfigMode(){setupImageIconEditor({inputId:'configTileImageInput',canvasId:'configTileCropCanvas',previewId:'configTileIconPreview',statusId:'configTileIconStatus',zoomId:'configTileCropZoom',eraserId:'configTileMagicEraserBtn',toleranceId:'configTileMagicTolerance',hexKey:'currentConfigTileIconHex',statusPrefix:'Tile',outline:false});window.editingConfigFloorJson=window.editingConfigFloorJson||emptyFloorDraft();renderConfigTilesets();configTileType.onchange=()=>configWallDirectionWrap?.classList.toggle('hidden',configTileType.value!=='wall');configTileType.onchange();addConfigTileBtn.onclick=()=>{const floor=currentFloorDraft(),key=tileArrayKey(configTileType.value),ref=window.editingConfigTileRef,tile={name:configTileName.value.trim()||'Tile sin nombre',type:configTileType.value,direction:configTileType.value==='wall'?configWallDirection.value:'',color:configTileColor.value,alt:configTileAlt.value,top:configTileAlt.value,accent:configTileAccent.value,rotatable:configTileType.value==='wall'&&configTileRotatable.checked,icon:window.currentConfigTileIconHex||''};if(ref&&floor[ref.key]?.[ref.index]){if(ref.key!==key){floor[ref.key].splice(ref.index,1);floor[key]=floor[key]||[];floor[key].push(tile)}else floor[key][ref.index]=tile;configTilesetStatus.textContent='Tile actualizado en el floor actual. Guarda el floor para consolidarlo.'}else{floor[key]=floor[key]||[];floor[key].push(tile);configTilesetStatus.textContent='Tile añadido al floor actual. Guarda el floor para consolidarlo.'}window.editingConfigFloorJson=floor;window.editingConfigTileRef=null;resetConfigTileForm(false);renderConfigTilesets()};newConfigTileBtn.onclick=()=>{window.editingConfigTileRef=null;resetConfigTileForm();configTilesetStatus.textContent='Formulario listo para un tile nuevo.'};newConfigFloorBtn.onclick=()=>{window.editingConfigFloorId=null;window.editingConfigFloorJson=emptyFloorDraft();configFloorName.value=window.editingConfigFloorJson.name;configFloorStory.value=window.editingConfigFloorJson.story;window.editingConfigTileRef=null;resetConfigTileForm();configTilesetStatus.textContent='Nuevo floor iniciado.';renderConfigTilesets()};saveConfigFloorBtn.onclick=async()=>{const floor=currentFloorDraft();floor.name=configFloorName.value.trim()||'Floor sin nombre';floor.story=configFloorStory.value.trim();configTilesetStatus.textContent='Guardando floor en config_floor...';try{await saveConfigFloorRow(floor);configTilesetStatus.textContent='Floor guardado.'}catch(e){configTilesetStatus.textContent=e.message}};exportConfigTilesetBtn.onclick=()=>{const blob=new Blob([JSON.stringify(currentFloorDraft(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='config-floor.json';a.click();URL.revokeObjectURL(a.href)};importConfigFloorInput.onchange=async()=>{const files=[...importConfigFloorInput.files];configTilesetStatus.textContent='Leyendo floor(s) JSON/ZIP...';try{let count=0;const floorsRaw=await parseImportedJsonFiles(files);for(const raw of floorsRaw){const floor={...emptyFloorDraft(),...(raw.floor_json||raw)};floor.name=floor.name||raw.floor_name||'Floor importado';floor.floorTiles=Array.isArray(floor.floorTiles)?floor.floorTiles:[];floor.wallTiles=Array.isArray(floor.wallTiles)?floor.wallTiles:[];floor.doorTiles=Array.isArray(floor.doorTiles)?floor.doorTiles:[];window.editingConfigFloorId=null;configTilesetStatus.textContent=`Importando floor ${count+1}/${floorsRaw.length}...`;await saveConfigFloorRow(floor);count++}window.editingConfigFloorId=null;configTilesetStatus.textContent=`Importados ${count} floor(s) en config_floor.`}catch(e){configTilesetStatus.textContent=e.message}finally{importConfigFloorInput.value=''}}}


const enemyTypeStats={rogue:{hp:.9,atk:1.15,armor:0},warrior:{hp:1.1,atk:1.05,armor:1},caster:{hp:.85,atk:1.25,armor:0},invocador:{hp:1,atk:1.05,armor:0},clerigo:{hp:1.05,atk:.95,armor:1},chaman:{hp:1,atk:1.1,armor:0},arquero:{hp:.9,atk:1.15,armor:0},francotirador:{hp:.8,atk:1.35,armor:0},tanque:{hp:1.45,atk:.85,armor:3}};
const ENEMY_TIER_BORDER_COLORS={i:'#5fd97a',ii:'#5b9bff',iii:'#b26bff',iv:'#ffd24f'};
const enemyTierWeights={i:44,ii:30,iii:18,iv:8};
function parseEnemyStatsBase(v){if(!v)return{hp:12,atk:4,armor:0,xp:8};if(typeof v==='object')return{...v,hp:+v.hp||12,atk:+(v.atk??v.damage)||4,armor:+v.armor||0,xp:+v.xp||8};try{return parseEnemyStatsBase(JSON.parse(v))}catch(e){return Object.fromEntries(String(v).split(',').map(x=>x.trim().split(':')).filter(x=>x[0]).map(([k,v])=>[k,Number(v)||0]))}}
function normalizeEnemyCoreStats(v,type='warrior'){const defaults={strength:2,vitality:2,agility:2,luck:1,intelligence:1,wisdom:1},bias={rogue:{agility:3,luck:2},warrior:{strength:3,vitality:3},caster:{intelligence:4,wisdom:2},invocador:{intelligence:3,wisdom:3},clerigo:{wisdom:4,vitality:2},chaman:{wisdom:3,intelligence:2},arquero:{agility:3,strength:2},francotirador:{agility:4,luck:2},tanque:{vitality:4,strength:2}}[type]||{};let raw={...defaults,...bias};if(v){try{raw=typeof v==='object'?{...raw,...v}:{...raw,...JSON.parse(v)}}catch(e){String(v).split(',').map(x=>x.trim().split(':')).filter(x=>x[0]).forEach(([k,val])=>raw[k]=Number(val)||0)}}return Object.fromEntries(Object.entries(defaults).map(([k])=>[k,Math.max(0,Math.round(Number(raw[k])||0))]))}
function normalizeEnemyDetail(row){const stats=parseEnemyStatsBase(row.stats_base),type=row.type||'warrior',coreStats=normalizeEnemyCoreStats(stats.coreStats||stats.stats,type),boss=String(row.boss||'no').toLowerCase().startsWith('s');return{id:row.id,family:row.family||'Sin familia',name:row.class||type||'Enemigo',class:row.class||'',type,icon:row.icon||'',boss,tier:String(row.tier||'i').toLowerCase(),weaponType:row.weapon_type||'',stats:coreStats,statsBase:{hp:stats.hp||12,atk:stats.atk||stats.damage||4,armor:stats.armor||0,xp:stats.xp||8},skillIds:String(row.skill||'').split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean)}}
function familyJsonFromDetails(name){return{schemaVersion:1,name,enemies:configEnemyDetails.map(normalizeEnemyDetail).filter(e=>e.family===name),weights:{tiers:enemyTierWeights,bossChance:.06},generatedAt:new Date().toISOString()}}
function enemyDetailRowFromImportedEnemy(enemy,familyName){const e=normalizeEnemyDetail({...enemy,family:enemy.family||familyName,stats_base:enemy.stats_base||enemy.statsBase||enemy.stats||null,class:enemy.class||enemy.name||'',weapon_type:enemy.weapon_type||enemy.weaponType||'',skill:enemy.skill||enemy.skillIds||''});return{family:familyName,icon:e.icon||'',class:e.class||e.name||e.type,type:e.type,boss:e.boss?'si':'no',stats_base:JSON.stringify({...e.statsBase,coreStats:e.stats}),weapon_type:e.weaponType,tier:e.tier,skill:e.skillIds.join(',')}}
function normalizedEnemyFamilies(){return configEnemyFamilies.map(r=>({...(r.family_json||{}),dbId:r.id,name:r.family_json?.name||r.family_name,source:'enemy_family'})).filter(f=>f.name&&Array.isArray(f.enemies)&&f.enemies.length)}
// Enemy level is always anchored to the player's CURRENT level (read live
// from `game`), with a modest per-floor bonus so deeper floors within the
// same dungeon still feel harder at any given character level. This makes
// fresh floor generation correct automatically; precomputed floors (baked
// once at world creation against a synthetic level-1 preview character) are
// re-anchored on load, see scaleFloorForPlayerLevel().
function enemyLevelForFloor(floor){const playerLevel=game?.player?.level||1;return Math.max(1,Math.round(playerLevel+(floor-1)*1.4+rng(3)-1))}
// Enemy TIER mix shifts from mostly-weak to mostly-strong across the
// dungeon's depth (d=0 at floor 1, d=1 at the last floor), so every run
// reads as a progression on top of any room-specific tier rules, regardless
// of how many floors the world has.
function enemyTierWeightsForDepth(d){
 d=Math.max(0,Math.min(1,d));
 return {
  i:Math.max(6,72-66*d),
  ii:16+14*Math.min(1,d/.5),
  iii:46*Math.max(0,Math.min(1,(d-.08)/.6)),
  iv:56*Math.max(0,Math.min(1,(d-.45)/.55))
 };
}
function weightedFamilyEnemy(family,wantBoss=false,floor=1,totalFloors=20){
 let pool=(family.enemies||[]).filter(e=>wantBoss?e.boss:!e.boss);if(!pool.length)pool=family.enemies||[];
 const depth=(floor-1)/Math.max(1,totalFloors-1),tierWeights=enemyTierWeightsForDepth(depth);
 const bag=[];pool.forEach(e=>{const w=(wantBoss?2:1)*(tierWeights[e.tier]??12);for(let i=0;i<w;i++)bag.push(e)});
 return pick(bag)||pool[0];
}
function buildConfiguredEnemy(template,pos,floor,wantBoss=false){const lvl=enemyLevelForFloor(floor),t=enemyTypeStats[template.type]||enemyTypeStats.warrior,base=template.statsBase||{},tierMult={i:1,ii:1.18,iii:1.38,iv:1.7}[template.tier]||1,boss=wantBoss||template.boss;const varMult=.88+Math.random()*.24,bossMult=boss?1.9:1;const stats=normalizeEnemyCoreStats(template.stats,template.type),statHp=1+stats.vitality*.035,statAtk=1+actorStatDamageBonus({stats},template.type==='caster'||template.type==='invocador'||template.type==='clerigo'||template.type==='chaman'?'magic':'physical')*.018,statArmor=Math.floor(stats.vitality/5)+Math.floor(stats.wisdom/7);const hp=Math.round((base.hp||12)*(1+lvl*.13)*t.hp*tierMult*bossMult*varMult*statHp*worldLifeMultiplier()*ENEMY_HP_BASE_MULT),atk=Math.round((base.atk||4)*(1+lvl*.08)*t.atk*tierMult*(boss?1.35:1)*varMult*statAtk);let e={...pos,type:template.type,name:template.name||template.class||template.type,customEnemy:true,icon:template.icon,level:lvl,tier:template.tier,boss,stats,hp,maxHp:hp,atk,damage:atk,armor:Math.round((base.armor||0)+(t.armor||0)+lvl*.08+statArmor),xp:Math.round((base.xp||8)*(1+lvl*.08)*tierMult*(boss?2.5:1)),skills:[],skillCooldowns:{}};const maxSkills=boss?Math.min(3,1+Math.floor(lvl/8)):Math.min(2,1+Math.floor(lvl/14));e.configuredSkillIds=(template.skillIds||[]).filter(id=>skillDefs[id]).slice(0,maxSkills);return assignEnemySkills(equipEnemy(e,floor))}
function compactEnemyForWorld(e){const {icon,...rest}=e;return rest}
function configuredEnemyTemplateFor(e){const families=normalizedEnemyFamilies(),family=families.find(f=>f.name===(e.enemyFamily||e.family))||families.find(f=>(f.enemies||[]).some(t=>t.type===e.type||t.name===e.name));return (family?.enemies||[]).find(t=>(t.type===e.type&&(!e.name||t.name===e.name||t.class===e.name))||t.name===e.name||t.class===e.name)||null}
function hydratePrecomputedEnemy(e){if(e.customEnemy&&!e.icon){const t=configuredEnemyTemplateFor(e);if(t?.icon)e.icon=t.icon}return equipEnemy(e)}
function pickConfiguredFamilyForFloor(floor){const families=normalizedEnemyFamilies();if(!families.length)throw new Error('No hay familias consolidadas en enemy_family. Crea o importa familias antes de generar la dungeon.');return pick(families)}
function applyInnerAlphaOutline(q,size,px=2){
 const img=q.getImageData(0,0,size,size),src=new Uint8ClampedArray(img.data),dst=img.data;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const idx=(y*size+x)*4;if(src[idx+3]<=8)continue;let edge=false;
  for(let oy=-px;oy<=px&&!edge;oy++)for(let ox=-px;ox<=px;ox++){
   if(Math.abs(ox)+Math.abs(oy)>px)continue;const nx=x+ox,ny=y+oy;
   if(nx<0||ny<0||nx>=size||ny>=size||src[(ny*size+nx)*4+3]<=8){edge=true;break}
  }
  if(edge){dst[idx]=0;dst[idx+1]=0;dst[idx+2]=0;dst[idx+3]=255}
 }
 q.putImageData(img,0,0)
}
function drawEnemyIconHex(hex,x,y,boss=false){
 if(!hex)return false;
 let img=tileImageCache.get('enemy:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('enemy:'+hex,img)}if(!img)return false;
 const size=boss?78:58,off=(64-size)/2,dx=x+off,dy=y+off;
 const paint=()=>{
  const layer=document.createElement('canvas');layer.width=layer.height=size;
  const lc=layer.getContext('2d');lc.imageSmoothingEnabled=false;lc.drawImage(img,0,0,size,size);
  lc.globalCompositeOperation='source-atop';
  const g=lc.createRadialGradient(size/2,size*.45,3,size/2,size/2,size*.58);
  g.addColorStop(0,boss?'#fff1a84f':'#d7c6ff42');
  g.addColorStop(.62,boss?'#ff9d2840':'#6b4cff35');
  g.addColorStop(1,'#05030858');
  lc.fillStyle=g;lc.fillRect(0,0,size,size);
  applyInnerAlphaOutline(lc,size,2);
  ctx.save();
  ctx.shadowColor=boss?'#ffb94a88':'#8e6dff77';ctx.shadowBlur=boss?10:7;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.drawImage(layer,dx,dy,size,size);
  ctx.restore();
 };
 if(img.complete){paint();return true}img.onload=()=>game&&draw();return false
}
async function fetchEnemyConfig(){try{const [f,d]=await Promise.all([fetch('/api/enemy-family').then(r=>r.json()),fetch('/api/enemy-detail').then(r=>r.json())]);configEnemyFamilies=Array.isArray(f)?f:[];configEnemyDetails=Array.isArray(d)?d:[];renderEnemyConfig();setupWorldSettings()}catch(e){configEnemyStatus&&(configEnemyStatus.textContent='No se pudo cargar configuración de enemigos: '+e.message)}}
function renderEnemySkillSelect(){const sel=document.getElementById('configEnemySkills');if(sel)sel.innerHTML='<option value="">Selecciona para añadir...</option>'+Object.entries(skillDefs).filter(([,d])=>d.enemyUsable).map(([id,d])=>`<option value="${id}">${d.icon||'•'} ${d.name}</option>`).join('')}
function selectedEnemySkills(){return [...(window.currentEnemySkillPool||[])]}
function renderEnemySkillPool(){const el=document.getElementById('configEnemySkillPool'),ids=selectedEnemySkills();if(!el)return;el.innerHTML=ids.length?ids.map(id=>{const d=skillDefs[id]||{};return`<button type="button" class="enemySkillChip" data-remove-enemy-skill="${id}">${d.icon||'•'} ${d.name||id} ×</button>`}).join(''):'<span class="small">Pool vacío.</span>';document.querySelectorAll('[data-remove-enemy-skill]').forEach(b=>b.onclick=()=>{window.currentEnemySkillPool=selectedEnemySkills().filter(id=>id!==b.dataset.removeEnemySkill);renderEnemySkillPool()})}
function addEnemySkillToPool(id){if(!id)return;const pool=selectedEnemySkills();if(!pool.includes(id))pool.push(id);window.currentEnemySkillPool=pool;configEnemySkills.value='';renderEnemySkillPool()}
function setEnemySkills(ids){window.currentEnemySkillPool=[...(ids||[])];if(configEnemySkills)configEnemySkills.value='';renderEnemySkillPool()}
function currentEnemyRow(){const stats=normalizeEnemyCoreStats({strength:+configEnemyStrength.value||0,vitality:+configEnemyVitality.value||0,agility:+configEnemyAgility.value||0,luck:+configEnemyLuck.value||0,intelligence:+configEnemyIntelligence.value||0,wisdom:+configEnemyWisdom.value||0},configEnemyType.value),statsBase={hp:+configEnemyHp.value||12,atk:+configEnemyAtk.value||4,armor:+configEnemyArmor.value||0,xp:+configEnemyXp.value||8,coreStats:stats};return{family:configEnemyFamilyName.value.trim()||'Sin familia',icon:window.currentConfigEnemyIconHex||'',class:configEnemyClass.value.trim(),type:configEnemyType.value,boss:configEnemyBoss.value,stats_base:JSON.stringify(statsBase),weapon_type:configEnemyWeaponType.value,tier:configEnemyTier.value,skill:selectedEnemySkills().join(',')}}
function resetEnemyForm(){window.editingConfigEnemyId=null;configEnemyClass.value='';configEnemyBoss.value='no';configEnemyTier.value='i';configEnemyHp.value=12;configEnemyAtk.value=4;configEnemyArmor.value=0;configEnemyXp.value=8;configEnemyStrength.value=2;configEnemyVitality.value=2;configEnemyAgility.value=2;configEnemyLuck.value=1;configEnemyIntelligence.value=1;configEnemyWisdom.value=1;setEnemySkills([]);window.currentConfigEnemyIconHex='';renderConfigIconPreview('','configEnemyIconPreview','configEnemyIconStatus');configEnemyStatus.textContent='Nuevo enemigo.'}
function loadEnemyForEdit(id){const row=configEnemyDetails.find(e=>String(e.id)===String(id));if(!row)return;const e=normalizeEnemyDetail(row);window.editingConfigEnemyId=row.id;configEnemyFamilyName.value=e.family;configEnemyClass.value=e.class;configEnemyType.value=e.type;configEnemyBoss.value=e.boss?'si':'no';configEnemyTier.value=e.tier;configEnemyWeaponType.value=e.weaponType;configEnemyHp.value=e.statsBase.hp;configEnemyAtk.value=e.statsBase.atk;configEnemyArmor.value=e.statsBase.armor;configEnemyXp.value=e.statsBase.xp;configEnemyStrength.value=e.stats.strength;configEnemyVitality.value=e.stats.vitality;configEnemyAgility.value=e.stats.agility;configEnemyLuck.value=e.stats.luck;configEnemyIntelligence.value=e.stats.intelligence;configEnemyWisdom.value=e.stats.wisdom;setEnemySkills(e.skillIds);window.currentConfigEnemyIconHex=e.icon;renderConfigIconPreview(e.icon,'configEnemyIconPreview','configEnemyIconStatus');configEnemyIconStatus.textContent=e.icon?'Icono cargado desde enemigo guardado.':'Sin icono';configEnemyStatus.textContent=`Editando enemigo #${row.id}.`}
function renderEnemyConfig(){renderEnemySkillSelect();renderEnemySkillPool();if(configEnemyWeaponType&&!configEnemyWeaponType.options.length)configEnemyWeaponType.innerHTML=configWeaponTypes.map(c=>`<option value="${c}">${c}</option>`).join('');if(configEnemyFamiliesList)configEnemyFamiliesList.innerHTML=(configEnemyFamilies.length?configEnemyFamilies.map(r=>`<div class="configItem"><span class="tierDot" style="background:#9b65d8"></span><div><b>${r.family_name}</b><span class="small">${(r.family_json?.enemies||[]).length} enemigos en JSON</span><div class="configItemActions"><button type="button" data-load-family="${r.id}">Editar familia</button></div></div></div>`).join(''):'<p class="small">No hay familias consolidadas.</p>');if(configEnemiesList){if(configEnemyDetails.length){const groups={};configEnemyDetails.map(normalizeEnemyDetail).forEach(e=>{(groups[e.family]||(groups[e.family]=[])).push(e)});configEnemiesList.innerHTML=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([family,enemies])=>`<details class="configSlotGroup" open><summary>${family}<b>${enemies.length}</b></summary><div class="configSlotItems">${enemies.map(e=>`<div class="configItem"><span class="tierDot" style="background:${e.boss?'#ffb746':'#75e39d'}"></span><div><b>${e.class||e.type}</b><span class="small">${e.type} · tier ${e.tier.toUpperCase()} · boss ${e.boss?'sí':'no'} · ${e.skillIds.length} skill(s)</span><div class="configItemActions"><button type="button" data-edit-enemy="${e.id}">Editar</button></div></div></div>`).join('')}</div></details>`).join('')}else configEnemiesList.innerHTML='<p class="small">No hay enemigos individuales.</p>'}document.querySelectorAll('[data-edit-enemy]').forEach(b=>b.onclick=()=>loadEnemyForEdit(b.dataset.editEnemy));document.querySelectorAll('[data-load-family]').forEach(b=>b.onclick=()=>{const r=configEnemyFamilies.find(x=>String(x.id)===b.dataset.loadFamily);if(r){configEnemyFamilyName.value=r.family_name;configEnemyStatus.textContent=`Familia ${r.family_name} cargada para editar enemigos.`}})}
function setupEnemyConfigMode(){setupImageIconEditor({inputId:'configEnemyImageInput',canvasId:'configEnemyCropCanvas',previewId:'configEnemyIconPreview',statusId:'configEnemyIconStatus',zoomId:'configEnemyCropZoom',eraserId:'configEnemyMagicEraserBtn',toleranceId:'configEnemyMagicTolerance',hexKey:'currentConfigEnemyIconHex',statusPrefix:'Icono enemigo'});window.currentEnemySkillPool=window.currentEnemySkillPool||[];renderEnemyConfig();configEnemySkills.onchange=()=>addEnemySkillToPool(configEnemySkills.value);saveConfigEnemyBtn.onclick=async()=>{configEnemyStatus.textContent='Guardando enemigo...';try{const row=currentEnemyRow(),id=window.editingConfigEnemyId,r=await fetch(id?`/api/enemy-detail?id=${encodeURIComponent(id)}`:'/api/enemy-detail',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar enemigo');await fetchEnemyConfig();configEnemyStatus.textContent='Enemigo guardado.'}catch(e){configEnemyStatus.textContent=e.message}};newConfigEnemyBtn.onclick=resetEnemyForm;saveEnemyFamilyBtn.onclick=async()=>{try{const name=configEnemyFamilyName.value.trim()||'Sin familia',json=familyJsonFromDetails(name),existing=configEnemyFamilies.find(r=>r.family_name===name),r=await fetch(existing?`/api/enemy-family?id=${existing.id}`:'/api/enemy-family',{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({family_name:name,family_json:json})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo consolidar');await fetchEnemyConfig();configEnemyStatus.textContent='Familia consolidada en enemy_family.'}catch(e){configEnemyStatus.textContent=e.message}};exportEnemyFamilyBtn.onclick=()=>{const blob=new Blob([JSON.stringify(familyJsonFromDetails(configEnemyFamilyName.value.trim()||'Sin familia'),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='enemy-family.json';a.click();URL.revokeObjectURL(a.href)};importEnemyFamilyInput.onchange=async()=>{try{let familyCount=0,enemyCount=0;const familiesRaw=await parseImportedJsonFiles([...importEnemyFamilyInput.files]);for(const raw of familiesRaw){const j=raw.family_json||raw,name=j.name||raw.family_name||'Familia importada',r=await fetch('/api/enemy-family',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({family_name:name,family_json:{...j,name}})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo importar familia');familyCount++;const enemies=Array.isArray(j.enemies)?j.enemies:[];if(enemies.length){const detailRows=enemies.map(e=>enemyDetailRowFromImportedEnemy(e,name));await postJsonRows('/api/enemy-detail',detailRows);enemyCount+=detailRows.length}}await fetchEnemyConfig();configEnemyStatus.textContent=`Importadas ${familyCount} familia(s) y ${enemyCount} enemigo(s) individuales en enemy_detail.`}catch(e){configEnemyStatus.textContent=e.message}finally{importEnemyFamilyInput.value=''}}}

// ---- Treasure chest config (config_chest) --------------------------------
// A chest definition = tier (1-5, chest rarity/quality) + type (equipment/
// weapon/potion/skill) + icon + which item rarities it can drop + optionally
// a hand-picked pool of specific items/skills (empty pool = fully random
// within the selected item tiers). These replace the generic chests during
// dungeon generation; the chest TIER actually rolled depends on floor+level
// (see chestTierForFloor()).
let configChests=[];
async function fetchConfigChests(){try{const r=await fetch('/api/config-chest');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar cofres');configChests=Array.isArray(data)?data:[];renderConfigChests()}catch(e){const st=document.getElementById('configChestStatus');if(st)st.textContent=`Error cargando config_chest: ${e.message}`}}
// offhand ("mano secundaria"/mano izquierda) counts as weapon type, not equipment
function chestItemMatchesType(j,type,slotFilter='all',weaponTypeFilter='all'){
 if(type==='potion')return j.type==='potion';
 if(type==='weapon'){
  if(j.slot!=='weapon'&&j.slot!=='offhand')return false;
  if(weaponTypeFilter&&weaponTypeFilter!=='all'&&j.weaponType!==weaponTypeFilter)return false;
  return true;
 }
 if(j.type==='potion'||j.slot==='weapon'||j.slot==='offhand')return false;
 if(slotFilter&&slotFilter!=='all'&&j.slot!==slotFilter)return false;
 return true;
}
function chestSearchPool(type,slotFilter='all',weaponTypeFilter='all'){
 if(type==='skill')return Object.entries(skillDefs).map(([id,s])=>({id,label:s.name,rarity:s.rarity||'common'}));
 return configItems.filter(i=>chestItemMatchesType(i.item_json||i,type,slotFilter,weaponTypeFilter)).map(i=>({id:String(i.id),label:i.nombre||(i.item_json||i).name||'Sin nombre',rarity:(i.item_json||i).rarity||i.tier||'common'}));
}
function checkedChestItemTiers(){return [...document.querySelectorAll('#configChestItemTiers input[type=checkbox]:checked')].map(cb=>cb.value)}
// A special "Aleatorio" pick sits alongside the concrete items: when it's
// among the selected ids, the chest can also resolve to any item matching
// the chest's own rarity+type instead of only the hand-picked ones.
const CHEST_RANDOM_PICK_ID='__random__';
function renderChestItemResults(){
 const root=document.getElementById('configChestItemResults'),summary=document.getElementById('configChestSpecificSummary');
 if(!root)return;
 const type=document.getElementById('configChestType')?.value||'equipment',q=(document.getElementById('configChestItemSearch')?.value||'').trim().toLowerCase();
 const slotFilter=document.getElementById('configChestSlotFilter')?.value||'all',weaponTypeFilter=document.getElementById('configChestWeaponTypeFilter')?.value||'all';
 window.currentChestItemIds=window.currentChestItemIds||[];
 const tiers=checkedChestItemTiers();
 const pool=chestSearchPool(type,slotFilter,weaponTypeFilter).filter(x=>tiers.includes(x.rarity)).filter(x=>!q||x.label.toLowerCase().includes(q)).slice(0,60);
 const randomRow=`<label class="configItem"><input type="checkbox" data-chest-item-pick="${CHEST_RANDOM_PICK_ID}" ${window.currentChestItemIds.includes(CHEST_RANDOM_PICK_ID)?'checked':''}><span>🎲 Aleatorio (cualquier item de la rareza y tipo definidos)</span></label>`;
 root.innerHTML=randomRow+(pool.length?pool.map(x=>`<label class="configItem"><input type="checkbox" data-chest-item-pick="${x.id}" ${window.currentChestItemIds.includes(x.id)?'checked':''}><span>${x.label}</span></label>`).join(''):'<p class="small">Sin resultados para esos tiers.</p>');
 const updateSummary=()=>{if(summary)summary.textContent=window.currentChestItemIds.length?`${window.currentChestItemIds.length} opción(es) posibles al abrir (incluye aleatorio si está marcado).`:'Nada seleccionado: el cofre no soltará objeto.'};
 root.querySelectorAll('[data-chest-item-pick]').forEach(cb=>cb.onchange=()=>{
  const id=cb.dataset.chestItemPick;
  window.currentChestItemIds=cb.checked?[...window.currentChestItemIds,id]:window.currentChestItemIds.filter(x=>x!==id);
  updateSummary();
 });
 updateSummary();
}
function toggleChestTypeFields(){
 const type=document.getElementById('configChestType')?.value||'equipment';
 document.getElementById('configChestSlotFilterWrap')?.classList.toggle('hidden',type!=='equipment');
 document.getElementById('configChestWeaponTypeFilterWrap')?.classList.toggle('hidden',type!=='weapon');
}
function currentConfigChestJson(){
 const itemTiers=checkedChestItemTiers();
 return {
  name:document.getElementById('configChestName')?.value.trim()||'Cofre sin nombre',
  tier:Number(document.getElementById('configChestTier')?.value)||1,
  type:document.getElementById('configChestType')?.value||'equipment',
  slotFilter:document.getElementById('configChestSlotFilter')?.value||'all',
  weaponTypeFilter:document.getElementById('configChestWeaponTypeFilter')?.value||'all',
  icon:window.currentConfigChestIconHex||'',
  itemTiers:itemTiers.length?itemTiers:['common'],
  itemIds:[...(window.currentChestItemIds||[])]
 };
}
function resetConfigChestForm(){
 window.editingConfigChestId=null;window.currentChestItemIds=[CHEST_RANDOM_PICK_ID];window.currentConfigChestIconHex='';
 document.getElementById('configChestName').value='';
 document.getElementById('configChestTier').value='1';
 document.getElementById('configChestType').value='equipment';
 document.getElementById('configChestSlotFilter').value='all';
 document.getElementById('configChestWeaponTypeFilter').value='all';
 document.getElementById('configChestItemSearch').value='';
 document.querySelectorAll('#configChestItemTiers input[type=checkbox]').forEach(cb=>cb.checked=cb.value==='common');
 toggleChestTypeFields();
 renderConfigIconPreview('','configChestIconPreview','configChestIconStatus');
 renderChestItemResults();
 const st=document.getElementById('configChestStatus');if(st)st.textContent='Formulario listo para un cofre nuevo.';
}
function loadConfigChestForEdit(id){
 const row=configChests.find(r=>String(r.id)===String(id));if(!row)return;
 const c=row.chest_json||{};
 window.editingConfigChestId=row.id;window.currentChestItemIds=[...(c.itemIds||[])];window.currentConfigChestIconHex=c.icon||'';
 document.getElementById('configChestName').value=c.name||'';
 document.getElementById('configChestTier').value=String(c.tier||1);
 document.getElementById('configChestType').value=c.type||'equipment';
 document.getElementById('configChestSlotFilter').value=c.slotFilter||'all';
 document.getElementById('configChestWeaponTypeFilter').value=c.weaponTypeFilter||'all';
 document.getElementById('configChestItemSearch').value='';
 toggleChestTypeFields();
 document.querySelectorAll('#configChestItemTiers input[type=checkbox]').forEach(cb=>cb.checked=(c.itemTiers||['common']).includes(cb.value));
 renderConfigIconPreview(c.icon||'','configChestIconPreview','configChestIconStatus');
 renderChestItemResults();
 const st=document.getElementById('configChestStatus');if(st)st.textContent=`Editando ${c.name||'cofre'}.`;
}
async function removeConfigChest(id){
 if(!confirm('¿Borrar este cofre?'))return;
 try{const r=await fetch(`/api/config-chest?id=${encodeURIComponent(id)}`,{method:'DELETE'});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo borrar');await fetchConfigChests();if(String(window.editingConfigChestId)===String(id))resetConfigChestForm()}catch(e){const st=document.getElementById('configChestStatus');if(st)st.textContent=e.message}
}
function renderConfigChests(){
 const root=document.getElementById('configChestsList');if(!root)return;
 if(!configChests.length){root.innerHTML='<p class="small">No hay cofres configurados.</p>';return}
 const typeLabels={equipment:'Equipo',weapon:'Arma',potion:'Poción',skill:'Habilidad'};
 const sorted=[...configChests].sort((a,b)=>(a.chest_json?.tier||1)-(b.chest_json?.tier||1)||String(a.chest_json?.type||'').localeCompare(String(b.chest_json?.type||'')));
 root.innerHTML=sorted.map(r=>{const c=r.chest_json||{},ids=c.itemIds||[],specificCount=ids.filter(id=>id!==CHEST_RANDOM_PICK_ID).length,hasRandom=!ids.length||ids.includes(CHEST_RANDOM_PICK_ID),parts=[specificCount?`${specificCount} concreto(s)`:null,hasRandom?'Aleatorio':null].filter(Boolean).join(' + ')||'Sin objetos';return `<div class="configItem"><span class="tierDot" style="background:${tierDefs[(c.itemTiers||[])[0]]?.color||'#ddd'}"></span><div><b>${c.name||'Cofre'}</b><span class="small">Tier ${c.tier||1} · ${typeLabels[c.type]||c.type} · ${parts}</span><div class="configItemActions"><button type="button" data-chest-edit="${r.id}">Editar</button><button type="button" data-chest-delete="${r.id}">Borrar</button></div></div></div>`}).join('');
 root.querySelectorAll('[data-chest-edit]').forEach(b=>b.onclick=()=>loadConfigChestForEdit(b.dataset.chestEdit));
 root.querySelectorAll('[data-chest-delete]').forEach(b=>b.onclick=()=>removeConfigChest(b.dataset.chestDelete));
}
function setupChestConfigMode(){
 setupImageIconEditor({inputId:'configChestImageInput',canvasId:'configChestCropCanvas',previewId:'configChestIconPreview',statusId:'configChestIconStatus',zoomId:'configChestCropZoom',eraserId:'configChestMagicEraserBtn',toleranceId:'configChestMagicTolerance',hexKey:'currentConfigChestIconHex',statusPrefix:'Icono cofre'});
 window.currentChestItemIds=window.currentChestItemIds||[];
 const weaponTypeSel=document.getElementById('configChestWeaponTypeFilter');
 if(weaponTypeSel&&weaponTypeSel.options.length<=1)weaponTypeSel.insertAdjacentHTML('beforeend',configWeaponTypes.map(c=>`<option value="${c}">${c}</option>`).join(''));
 toggleChestTypeFields();
 renderConfigChests();renderChestItemResults();
 document.getElementById('configChestType').onchange=()=>{toggleChestTypeFields();renderChestItemResults()};
 document.getElementById('configChestSlotFilter').onchange=renderChestItemResults;
 document.getElementById('configChestWeaponTypeFilter').onchange=renderChestItemResults;
 document.getElementById('configChestItemSearch').oninput=renderChestItemResults;
 document.querySelectorAll('#configChestItemTiers input[type=checkbox]').forEach(cb=>cb.onchange=renderChestItemResults);
 document.getElementById('saveConfigChestBtn').onclick=async()=>{
  const st=document.getElementById('configChestStatus');st.textContent='Guardando cofre...';
  try{
   const chest=currentConfigChestJson(),id=window.editingConfigChestId;
   const r=await fetch(id?`/api/config-chest?id=${encodeURIComponent(id)}`:'/api/config-chest',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chest_name:chest.name,chest_json:chest})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar el cofre');
   await fetchConfigChests();st.textContent='Cofre guardado.';
  }catch(e){st.textContent=e.message}
 };
 document.getElementById('newConfigChestBtn').onclick=resetConfigChestForm;
}
// ---- World object icons (config_world_object) ------------------------------
// A fixed, known set of non-user-created world props (altars per kind, keys,
// stairs down, traps, one marker per ROOM_TYPES entry) that can each get a
// custom icon overriding their procedural pixel sprite. Unlike every other
// config_* table, rows are upserted by object_key instead of by id, and this
// hits /api/config-floor?kind=object instead of its own serverless function
// - Vercel's Hobby plan caps a project at 12 Serverless Functions and this
// repo was already at that limit (see api/config-floor.js).
const WORLD_OBJECT_KINDS=[
 {key:'altar_heal',label:'Altar: Curación'},
 {key:'altar_shield',label:'Altar: Escudo'},
 {key:'altar_power',label:'Altar: Poder'},
 {key:'altar_disenchant',label:'Altar: Creador (deshacer objetos)'},
 {key:'key',label:'Llave'},
 {key:'stairsDown',label:'Escaleras de bajada'},
 {key:'trap',label:'Trampa'},
 ...LOOT_RARITY_ORDER.map(t=>({key:`shard_${t}`,label:`Shard: ${tierDefs[t]?.label||t}`})),
 ...Object.entries(ROOM_TYPES).map(([id,T])=>({key:`room_${id}`,label:`Sala: ${T.label}`}))
];
let configWorldObjects={};
let configWorldObjectsLoaded=false;
async function fetchConfigWorldObjects(){
 try{
  const r=await fetch('/api/config-floor?kind=object');const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudieron cargar los objetos del mundo');
  configWorldObjects=Object.fromEntries((Array.isArray(data)?data:[]).map(row=>[row.object_key,row.icon||'']));
  configWorldObjectsLoaded=true;
  renderConfigWorldObjectsList();
  if(game)draw();
 }catch(e){const st=document.getElementById('configWorldObjectStatus');if(st)st.textContent=`Error cargando config_world_object: ${e.message}`}
}
function renderConfigWorldObjectsList(){
 const root=document.getElementById('configWorldObjectsList');if(!root)return;
 root.innerHTML=WORLD_OBJECT_KINDS.map(k=>{const hex=configWorldObjects[k.key];return `<div class="configItem"><span class="tierDot" style="background:${hex?'#8c72e8':'#4d395a'}"></span><div><b>${k.label}</b><span class="small">${hex?'Icono personalizado':'Sprite por defecto'}</span><div class="configItemActions"><button type="button" data-edit-world-object="${k.key}">Editar</button></div></div></div>`}).join('');
 root.querySelectorAll('[data-edit-world-object]').forEach(b=>b.onclick=()=>loadWorldObjectForEdit(b.dataset.editWorldObject));
}
function loadWorldObjectForEdit(objectKey){
 window.editingWorldObjectKey=objectKey;
 const kind=WORLD_OBJECT_KINDS.find(k=>k.key===objectKey);
 document.getElementById('configWorldObjectSelected').textContent=`Editando: ${kind?.label||objectKey}`;
 window.currentConfigWorldObjectIconHex=configWorldObjects[objectKey]||'';
 renderConfigIconPreview(window.currentConfigWorldObjectIconHex,'configWorldObjectIconPreview','configWorldObjectIconStatus');
 document.getElementById('configWorldObjectIconStatus').textContent=window.currentConfigWorldObjectIconHex?'Icono personalizado activo.':'Sin icono: usará el sprite por defecto.';
}
function setupConfigWorldObjectsMode(){
 setupImageIconEditor({inputId:'configWorldObjectImageInput',canvasId:'configWorldObjectCropCanvas',previewId:'configWorldObjectIconPreview',statusId:'configWorldObjectIconStatus',zoomId:'configWorldObjectCropZoom',eraserId:'configWorldObjectMagicEraserBtn',toleranceId:'configWorldObjectMagicTolerance',hexKey:'currentConfigWorldObjectIconHex',statusPrefix:'Icono objeto'});
 renderConfigWorldObjectsList();
 document.getElementById('saveConfigWorldObjectBtn').onclick=async()=>{
  const st=document.getElementById('configWorldObjectStatus'),objectKey=window.editingWorldObjectKey;
  if(!objectKey){st.textContent='Elige primero un objeto de la lista.';return}
  st.textContent='Guardando icono...';
  try{
   const r=await fetch('/api/config-floor?kind=object',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({object_key:objectKey,icon:window.currentConfigWorldObjectIconHex||''})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar el icono');
   configWorldObjects[objectKey]=window.currentConfigWorldObjectIconHex||'';
   renderConfigWorldObjectsList();
   st.textContent='Icono guardado.';
   if(game)draw();
  }catch(e){st.textContent=e.message}
 };
 document.getElementById('rollbackConfigWorldObjectBtn').onclick=()=>{
  window.currentConfigWorldObjectIconHex='';
  renderConfigIconPreview('','configWorldObjectIconPreview','configWorldObjectIconStatus');
  document.getElementById('configWorldObjectIconStatus').textContent='Sin icono: usará el sprite por defecto.';
 };
}
// Shared draw helper: if object_key has a custom icon, draws it and returns
// true; otherwise the caller falls back to its own procedural sprite.
function drawWorldObjectIcon(objectKey,x,y,size=TILE-14,offset=7){
 const hex=configWorldObjects[objectKey];if(!hex)return false;
 let img=tileImageCache.get('wobj:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('wobj:'+hex,img)}
 if(img.complete){ctx.drawImage(img,x+offset,y+offset,size,size);return true}
 img.onload=()=>game&&draw();
 return false
}
// Same lookup as drawWorldObjectIcon but paints onto an arbitrary UI canvas
// (inventory rows, shards tab, ...) instead of the game's main ctx. Falls
// back to a tier-colored dot when the admin hasn't configured a custom icon.
function drawShardTierIconToCanvas(canvas,tier){
 if(!canvas)return;
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=false;q.clearRect(0,0,canvas.width,canvas.height);
 const hex=configWorldObjects[`shard_${tier}`];
 if(hex){
  let img=tileImageCache.get('wobj:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('wobj:'+hex,img)}
  if(img.complete&&img.naturalWidth){q.drawImage(img,0,0,canvas.width,canvas.height);return}
  img.onload=()=>drawShardTierIconToCanvas(canvas,tier);
 }
 q.fillStyle=tierColor(tier);q.beginPath();q.arc(canvas.width/2,canvas.height/2,canvas.width/2-2,0,Math.PI*2);q.fill();
}
function setupConfigTabs(){document.querySelectorAll('[data-config-tab]').forEach(btn=>btn.onclick=()=>{const tab=btn.dataset.configTab;document.querySelectorAll('[data-config-tab]').forEach(b=>b.classList.toggle('active',b===btn));configTabItems.classList.toggle('hidden',tab!=='items');configTabClasses.classList.toggle('hidden',tab!=='classes');configTabTilesets.classList.toggle('hidden',tab!=='tilesets');configTabEnemies?.classList.toggle('hidden',tab!=='enemies');configTabChests?.classList.toggle('hidden',tab!=='chests');configTabWorldObjects?.classList.toggle('hidden',tab!=='worldobjects');if(tab==='worldobjects'&&!configWorldObjectsLoaded)fetchConfigWorldObjects()})}

function setupImageIconEditor({inputId,canvasId,previewId,statusId,zoomId,eraserId,toleranceId,hexKey,statusPrefix,outline=true}){const imgInput=document.getElementById(inputId),crop=document.getElementById(canvasId),preview=document.getElementById(previewId),status=document.getElementById(statusId),zoom=document.getElementById(zoomId),eraserBtn=document.getElementById(eraserId),tolerance=document.getElementById(toleranceId);if(!imgInput||!crop)return null;let source=null,rect=null,drag=null,eraser=false;function canvasZoom(){const scale=(Number(zoom?.value)||100)/100;crop.style.width=`${Math.max(1,Math.round(crop.width*scale))}px`;crop.style.height=`${Math.max(1,Math.round(crop.height*scale))}px`}function clampRect(r){const size=Math.max(1,Math.min(Math.round(r.w),crop.width,crop.height));return{x:Math.max(0,Math.min(Math.round(r.x),Math.max(0,crop.width-size))),y:Math.max(0,Math.min(Math.round(r.y),Math.max(0,crop.height-size))),w:size,h:size}}function pointerPos(e){const b=crop.getBoundingClientRect();return{x:(e.clientX-b.left)*crop.width/b.width,y:(e.clientY-b.top)*crop.height/b.height}}function inRect(p,r){return r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h}function checker(c){c.fillStyle='#241b2c';c.fillRect(0,0,crop.width,crop.height);c.fillStyle='#392d44';for(let y=0;y<crop.height;y+=16)for(let x=0;x<crop.width;x+=16)if((x/16+y/16)%2===0)c.fillRect(x,y,16,16)}function drawCrop(){const c=crop.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,crop.width,crop.height);checker(c);if(source)c.drawImage(source,0,0);if(rect){c.save();c.fillStyle='#0008';c.fillRect(0,0,crop.width,rect.y);c.fillRect(0,rect.y+rect.h,crop.width,crop.height-rect.y-rect.h);c.fillRect(0,rect.y,rect.x,rect.h);c.fillRect(rect.x+rect.w,rect.y,crop.width-rect.x-rect.w,rect.h);c.strokeStyle=eraser?'#7cffd4':'#ffd68b';c.lineWidth=2;c.strokeRect(rect.x+.5,rect.y+.5,rect.w,rect.h);c.fillStyle=c.strokeStyle;c.fillRect(rect.x+rect.w-5,rect.y+rect.h-5,5,5);c.restore()}}function saveIcon(){if(!source||!rect)return;const out=document.createElement('canvas');out.width=out.height=50;const o=out.getContext('2d');o.imageSmoothingEnabled=false;o.clearRect(0,0,50,50);o.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,50,50);if(outline)addIconSilhouetteBorder(out,2);const pc=preview.getContext('2d');pc.clearRect(0,0,50,50);pc.drawImage(out,0,0);fetch(out.toDataURL('image/png')).then(r=>r.arrayBuffer()).then(buf=>{window[hexKey]=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');if(status)status.textContent=`${statusPrefix} 50x50 desde x:${rect.x}, y:${rect.y}, lado:${rect.w}`})}function eraseAt(p){const c=source.getContext('2d'),dataObj=c.getImageData(0,0,source.width,source.height),data=dataObj.data,x=Math.max(0,Math.min(source.width-1,Math.round(p.x))),y=Math.max(0,Math.min(source.height-1,Math.round(p.y))),idx=(y*source.width+x)*4,base=[data[idx],data[idx+1],data[idx+2]],tol=Number(tolerance?.value||38);for(let i=0;i<data.length;i+=4){if(Math.hypot(data[i]-base[0],data[i+1]-base[1],data[i+2]-base[2])<=tol)data[i+3]=0}c.putImageData(dataObj,0,0);drawCrop();saveIcon();if(status)status.textContent=`Magic eraser aplicado con sutileza ${tol}.`}function updateDrag(e){if(!source||!drag)return;const p=pointerPos(e);if(drag.mode==='move')rect=clampRect({x:p.x-drag.dx,y:p.y-drag.dy,w:drag.start.w,h:drag.start.h});else{const size=Math.max(1,Math.min(Math.abs(p.x-drag.origin.x),Math.abs(p.y-drag.origin.y)));rect=clampRect({x:p.x<drag.origin.x?drag.origin.x-size:drag.origin.x,y:p.y<drag.origin.y?drag.origin.y-size:drag.origin.y,w:size,h:size})}drawCrop();saveIcon()}imgInput.onchange=()=>{const f=imgInput.files?.[0];if(!f)return;const img=new Image();img.onload=()=>{crop.width=img.naturalWidth;crop.height=img.naturalHeight;source=document.createElement('canvas');source.width=crop.width;source.height=crop.height;const sc=source.getContext('2d');sc.imageSmoothingEnabled=false;sc.clearRect(0,0,source.width,source.height);sc.drawImage(img,0,0);rect=clampRect({x:0,y:0,w:Math.min(50,crop.width,crop.height),h:Math.min(50,crop.width,crop.height)});canvasZoom();drawCrop();saveIcon();if(status)status.textContent=`Imagen original ${crop.width}x${crop.height}. Ajusta zoom, recorte o Magic eraser.`};img.src=URL.createObjectURL(f)};crop.onpointerdown=e=>{if(!source)return;crop.setPointerCapture?.(e.pointerId);const p=pointerPos(e);if(eraser){eraseAt(p);return}if(inRect(p,rect))drag={mode:'move',start:{...rect},dx:p.x-rect.x,dy:p.y-rect.y};else{drag={mode:'draw',origin:p};rect=clampRect({x:p.x,y:p.y,w:1,h:1})}drawCrop()};crop.onpointermove=e=>{if(e.buttons&&!eraser)updateDrag(e)};crop.onpointerup=e=>{crop.releasePointerCapture?.(e.pointerId);if(!eraser){updateDrag(e);drag=null;saveIcon()}};if(zoom)zoom.oninput=canvasZoom;if(eraserBtn)eraserBtn.onclick=()=>{eraser=!eraser;eraserBtn.textContent=`Magic eraser: ${eraser?'on':'off'}`;crop.classList.toggle('magicEraserActive',eraser);drawCrop()};canvasZoom();return{drawCrop,saveIcon}}
function setupClassConfigMode(){
 const editor=setupImageIconEditor({inputId:'configClassImageInput',canvasId:'configClassCropCanvas',previewId:'configClassIconPreview',statusId:'configClassIconStatus',zoomId:'configClassCropZoom',eraserId:'configClassMagicEraserBtn',toleranceId:'configClassMagicTolerance',hexKey:'currentConfigClassIconHex',statusPrefix:'Icono'});
 if(!editor)return;
 setupImageIconEditor({inputId:'configSkillImageInput',canvasId:'configSkillCropCanvas',previewId:'configSkillIconPreview',statusId:'configSkillIconStatus',zoomId:'configSkillCropZoom',eraserId:'configSkillMagicEraserBtn',toleranceId:'configSkillMagicTolerance',hexKey:'currentConfigSkillIconHex',statusPrefix:'Icono skill'});
 setupImageIconEditor({inputId:'configSummonImageInput',canvasId:'configSummonCropCanvas',previewId:'configSummonIconPreview',statusId:'configSummonIconStatus',zoomId:'configSummonCropZoom',eraserId:'configSummonMagicEraserBtn',toleranceId:'configSummonMagicTolerance',hexKey:'currentSummonIconHex',statusPrefix:'Icono invocación'});
 const summonExistingSel=document.getElementById('configSummonIconExisting');
 if(summonExistingSel)summonExistingSel.onchange=()=>{
  if(!summonExistingSel.value)return;
  window.currentSummonIconHex=summonExistingSel.value;
  renderConfigIconPreview(summonExistingSel.value,'configSummonIconPreview','configSummonIconStatus');
  document.getElementById('configSummonIconStatus').textContent='Imagen reutilizada de la lista.';
 };
 populateSummonIconExistingList();
 document.getElementById('configClassPotionSearch')?.addEventListener('input',renderConfigClassPotionResults);
 const effectSel=document.getElementById('configSkillEffect');
 if(effectSel&&!effectSel.options.length)effectSel.innerHTML=ALL_CLASS_EFFECTS.map(e=>`<option value="${e}">${e}</option>`).join('');
 configClassSelect.onchange=loadSelectedConfigClass;
 document.getElementById('configClassSkillSelect').onchange=e=>loadSkillIntoForm(e.target.value);
 document.getElementById('newConfigClassBtn').onclick=()=>{
  const name=prompt('Nombre de la nueva clase:');if(!name)return;
  window.pendingNewClassId=slugifyClassName(name);
  configClassName.value=name;document.getElementById('configClassDesc').value='Clase personalizada.';
  configClassStr.value=configClassVit.value=configClassAgi.value=configClassLuck.value=configClassInt.value=configClassWis.value=2;
  window.currentConfigClassIconHex='';renderConfigIconPreview('','configClassIconPreview','configClassIconStatus');
  window.currentClassSkillsDraft={};renderClassSkillSelect();
  renderConfigClassStarterGearOptions('',[]);
  configClassStatus.textContent=`Nueva clase "${name}" lista para configurar. Añade skills y pulsa Guardar clase.`;
 };
 document.getElementById('duplicateConfigClassBtn').onclick=()=>{
  const baseId=selectedGameClassId(),base=resolveClassDef(baseId);if(!base)return;
  const name=prompt('Nombre de la copia:',`${base.name} (copia)`);if(!name)return;
  const newId=slugifyClassName(name);
  window.pendingNewClassId=newId;
  configClassName.value=name;document.getElementById('configClassDesc').value=base.desc||'';
  configClassStr.value=base.stats.strength;configClassVit.value=base.stats.vitality;configClassAgi.value=base.stats.agility;configClassLuck.value=base.stats.luck;configClassInt.value=base.stats.intelligence;configClassWis.value=base.stats.wisdom;
  const sourceBag=classSkillBagFor(baseId),newBag={};
  for(const [sid,s] of Object.entries(sourceBag))newBag[`${newId}_${sid}`]={...s,classId:newId};
  window.currentClassSkillsDraft=newBag;
  renderClassSkillSelect();
  const baseRow=configClassRowForId(baseId);
  renderConfigClassStarterGearOptions(baseRow?.class_json?.starterWeaponType||'',baseRow?.class_json?.starterPotionIds||[]);
  configClassStatus.textContent=`Copia de "${base.name}" lista como "${name}". Pulsa Guardar clase para crearla.`;
 };
 document.getElementById('newConfigSkillBtn').onclick=()=>{
  const id=window.pendingNewClassId||selectedGameClassId(),n=Object.keys(window.currentClassSkillsDraft||{}).length+1;
  const skillId=`${id}_custom_${n}`;
  window.currentClassSkillsDraft=window.currentClassSkillsDraft||{};
  window.currentClassSkillsDraft[skillId]={name:'Nueva skill',icon:'✦',iconImage:'',desc:'Descripción pendiente.',cd:5,apCost:10,resource:'stamina',cost:10,type:'physical',rarity:'common',range:1,classEffect:'ranged',tier:1,classId:id,enemyUsable:true,unlock:'Clase'};
  renderClassSkillSelect();
  document.getElementById('configClassSkillSelect').value=skillId;loadSkillIntoForm(skillId);
 };
 document.getElementById('duplicateConfigSkillBtn').onclick=()=>{
  const src=window.editingConfigSkillId;if(!src||!window.currentClassSkillsDraft?.[src])return;
  const n=Object.keys(window.currentClassSkillsDraft).length+1,newId=`${src}_copy${n}`;
  window.currentClassSkillsDraft[newId]={...window.currentClassSkillsDraft[src],effects:JSON.parse(JSON.stringify(window.currentClassSkillsDraft[src].effects||[]))};
  renderClassSkillSelect();
  document.getElementById('configClassSkillSelect').value=newId;loadSkillIntoForm(newId);
 };
 const saveSkillAndClass=async()=>{
  const oldId=window.editingConfigSkillId,newId=document.getElementById('configSkillId').value.trim()||oldId;
  const skill=currentSkillFormJson();
  window.currentClassSkillsDraft=window.currentClassSkillsDraft||{};
  if(oldId&&oldId!==newId)delete window.currentClassSkillsDraft[oldId];
  window.currentClassSkillsDraft[newId]=skill;
  renderClassSkillSelect();
  document.getElementById('configClassSkillSelect').value=newId;
  const st=document.getElementById('configSkillStatus');
  st.textContent='Guardando skill y clase...';
  try{await saveConfigClass(currentConfigClassJson(),window.currentClassSkillsDraft);st.textContent='Skill y clase guardadas en BDD.'}catch(e){st.textContent=e.message}
 };
 document.getElementById('saveConfigSkillBtn').onclick=saveSkillAndClass;
 document.getElementById('saveConfigSkillBtnTop').onclick=saveSkillAndClass;
 document.getElementById('rollbackConfigSkillIconBtn').onclick=()=>{
  window.currentConfigSkillIconHex='';renderConfigIconPreview('','configSkillIconPreview','configSkillIconStatus');
  document.getElementById('configSkillIconStatus').textContent='Sin imagen: se usa el icono de texto/emoji.';
 };
 document.getElementById('addSkillEffectBtn').onclick=()=>{
  const kind=document.getElementById('configEffectKindPicker').value;
  window.currentSkillEffectsDraft=window.currentSkillEffectsDraft||[];
  window.currentSkillEffectsDraft.push(defaultComponentFor(kind));
  renderSkillEffectsList();
 };
 document.getElementById('exportConfigSkillsBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify(window.currentClassSkillsDraft||{},null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`skills-${selectedGameClassId()}.json`;a.click();URL.revokeObjectURL(a.href);
 };
 document.getElementById('importConfigSkillsInput').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const st=document.getElementById('configSkillStatus');
  try{
   const bag=JSON.parse(await file.text());
   if(!bag||typeof bag!=='object')throw new Error('El JSON debe ser un objeto {skillId:{...}}');
   window.currentClassSkillsDraft={...(window.currentClassSkillsDraft||{}),...bag};
   renderClassSkillSelect();
   st.textContent=`Importadas ${Object.keys(bag).length} skill(s) al borrador. Pulsa "Guardar skill" o "Guardar clase" para persistir.`;
  }catch(err){st.textContent=`Error importando JSON: ${err.message}`}
  finally{e.target.value=''}
 };
 saveConfigClassBtn.onclick=async()=>{
  configClassStatus.textContent='Guardando clase...';
  try{await saveConfigClass(currentConfigClassJson(),window.currentClassSkillsDraft||{});configClassStatus.textContent='Clase guardada en BDD.'}catch(e){configClassStatus.textContent=e.message}
 };
 rollbackConfigClassBtn.onclick=async()=>{
  configClassStatus.textContent='Restaurando pixels por defecto...';
  try{window.currentConfigClassIconHex='';renderConfigIconPreview('','configClassIconPreview','configClassIconStatus');await saveConfigClass(currentConfigClassJson(),window.currentClassSkillsDraft||{});configClassStatus.textContent='Rollback aplicado: la clase vuelve al sprite original.'}catch(e){configClassStatus.textContent=e.message}
 };
}
function togglePotionEffectFields(){
 const type=configPotionEffect?.value||'heal';
 document.querySelectorAll('[data-potion-field]').forEach(el=>el.classList.add('hidden'));
 const show=name=>document.querySelector(`[data-potion-field="${name}"]`)?.classList.remove('hidden');
 if(type==='heal'){show('resource')}
 else if(type==='regen'){show('resource');show('turns')}
 else if(type==='temporaryStats'){show('stat');show('turns')}
 else if(type==='permanentStats'){show('stat')}
 else if(type==='learnSkill'){show('skill')}
 else if(type==='invulnerable'||type==='invisible'){show('turns')}
}
function setupConfigMode(){renderConfigStatsHelp();renderConfigSkillSelect();const slotSel=document.getElementById('configSlot');if(slotSel&&!slotSel.options.length)slotSel.innerHTML=slots.map(s=>`<option value="${s}">${slotNames[s]}</option>`).join('');if(configWeaponCategory&&!configWeaponCategory.options.length)configWeaponCategory.innerHTML=configWeaponTypes.map(c=>`<option value="${c}">${c}</option>`).join('');const toggleWeaponFields=()=>{const isPotion=configItemType?.value==='potion',isWeapon=!isPotion&&configSlot.value==='weapon';configDamageDiceWrap.classList.toggle('hidden',!isWeapon);configWeaponCategoryWrap.classList.toggle('hidden',!isWeapon);configRangeMinWrap?.classList.toggle('hidden',!isWeapon);configRangeMaxWrap?.classList.toggle('hidden',!isWeapon);configSlotWrap?.classList.toggle('hidden',isPotion);configStats.parentElement?.classList.toggle('hidden',isPotion);document.querySelector('.configSkillSelectWrap')?.classList.toggle('hidden',isPotion);configPotionFields?.classList.toggle('hidden',!isPotion);togglePotionEffectFields()};const applyWeaponRangePreset=()=>{const preset=weaponTypeRanges[configWeaponCategory?.value]||{min:1,max:1};if(configRangeMin)configRangeMin.value=preset.min;if(configRangeMax)configRangeMax.value=preset.max};slotSel.onchange=toggleWeaponFields;if(configWeaponCategory)configWeaponCategory.onchange=applyWeaponRangePreset;if(configItemType)configItemType.onchange=toggleWeaponFields;if(configPotionEffect)configPotionEffect.onchange=togglePotionEffectFields;toggleWeaponFields();setupImageIconEditor({inputId:'configImageInput',canvasId:'configCropCanvas',previewId:'configIconPreview',statusId:'configIconStatus',zoomId:'configCropZoom',eraserId:'configMagicEraserBtn',toleranceId:'configMagicTolerance',hexKey:'currentConfigIconHex',statusPrefix:'Icono'});saveConfigItemBtn.onclick=async()=>{configStatus.textContent=window.editingConfigItemId?'Actualizando...':'Guardando...';try{const item=currentConfigItemJson();if(window.editingConfigItemId)await updateConfigItem(window.editingConfigItemId,item);else await saveConfigItems([{...item,nombre:configNombre.value,slot:item.slot,tier:configTier.value,ilvl:item.itemLevel,item_json:item}]);configStatus.textContent=window.editingConfigItemId?'Objeto actualizado.':'Objeto guardado.'}catch(e){configStatus.textContent=e.message}};newConfigItemBtn.onclick=resetConfigForm;exportConfigJsonBtn.onclick=()=>{const blob=new Blob([JSON.stringify(currentConfigItemJson(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='config-item.json';a.click();URL.revokeObjectURL(a.href)};importConfigJsonInput.onchange=async()=>{const files=[...importConfigJsonInput.files];configStatus.textContent='Leyendo JSON/ZIP...';try{const items=await parseImportedJsonFiles(files);configStatus.textContent=`Importando ${items.length} objeto(s) sin lote máximo...`;await saveConfigItems(items.map(x=>({...x,item_json:x})));configStatus.textContent=`Importados ${items.length} objeto(s).`}catch(e){configStatus.textContent=e.message}finally{importConfigJsonInput.value=''}}}

async function fetchDungeonWorlds(){
 const status=document.getElementById('worldStatus'),list=document.getElementById('worldList');if(!status||!list)return;
 status.textContent='Cargando dungeons desde Supabase...';list.innerHTML='';
 try{const r=await fetch('/api/dungeon-worlds?light=1');const data=await r.json();if(!r.ok)throw new Error(data.error||data.message||'No se pudieron cargar las dungeons');
  if(!data.length){status.textContent='No hay dungeons guardadas. Crea una nueva.';return}
  status.textContent=`${data.length} dungeon(s) disponibles.`;
  list.innerHTML=data.map(w=>`<button type="button" class="worldCard" data-world-id="${w.id}"><b>${w.world_name||'Dungeon sin nombre'}</b><span>#${w.id} · ${new Date(w.created_at).toLocaleString()}</span></button>`).join('');
  list.querySelectorAll('[data-world-id]').forEach(btn=>btn.onclick=async()=>{
   btn.disabled=true;status.textContent='Cargando dungeon seleccionada...';
   try{
    const wr=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(btn.dataset.worldId)}`);
    const world=await wr.json();
    if(!wr.ok)throw new Error(world.error||world.message||'No se pudo cargar la dungeon');
    if(!world)throw new Error('La dungeon ya no existe.');
    selectedDungeonWorld=world;proceedAfterWorldChosen();
   }catch(e){status.textContent=`Error cargando dungeon_world: ${e.message}`;btn.disabled=false}
  });
 }catch(e){status.textContent=`Error cargando dungeon_world: ${e.message}`}
}
async function createDungeonWorld(){
 const btn=document.getElementById('createWorldBtn'),status=document.getElementById('worldStatus'),name=(document.getElementById('worldNameInput')?.value||'Dungeon sin nombre').trim(),params=readWorldParamsForm();
 btn.disabled=true;status.textContent='Cargando floors y familias desde Supabase...';
 try{if(!configFloors.length)await fetchConfigFloors();if(!configEnemyFamilies.length)await fetchEnemyConfig();if(!configItems.length)await fetchConfigItems();if(!configChests.length)await fetchConfigChests();if(!normalizedEnemyFamilies().length)throw new Error('Debes consolidar al menos una familia en enemy_family antes de crear una dungeon.');if(!normalizedSupabaseFloors().length)throw new Error('Debes consolidar al menos un floor en config_floor antes de crear una dungeon.');const world_json=createDungeonWorldJson(name,params);const r=await fetch('/api/dungeon-worlds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world_name:name,world_json})});const text=await r.text();let data;try{data=JSON.parse(text)}catch(e){throw new Error(text||'Respuesta no JSON al crear la dungeon')}if(!r.ok)throw new Error(data.error||data.message||'No se pudo crear la dungeon');
  selectedDungeonWorld=data;proceedAfterWorldChosen();
 }catch(e){status.textContent=`Error: ${e.message}`;btn.disabled=false}
}

function sumEquippedItemLevel(equipment){
 if(!equipment)return 0;
 return Object.values(equipment).reduce((sum,item)=>sum+(item?.itemLevel||item?.score||0),0);
}
function computeScore(bundle){
 const player=bundle?.player||{};
 const level=player.level||1;
 const ilvl=sumEquippedItemLevel(player.equipment);
 const maxFloor=bundle?.maxFloorReached||1;
 const gold=player.gold||0;
 return Math.round(level*100+ilvl*5+maxFloor*50+gold/10);
}
function characterBundleFromGame(){
 return {player:game.player,inventory:game.inventory||[],achievements:game.achievements||{},bossesKilled:game.bossesKilled||0,chestsOpened:game.chestsOpened||0,maxFloorReached:Math.max(game.maxFloorReached||1,game.floor||1)};
}

async function finishCharacterCreation(){
 const bundle={player:game.player,inventory:game.inventory||[],achievements:game.achievements||{},bossesKilled:0,chestsOpened:0,maxFloorReached:1};
 const score=computeScore(bundle);
 try{
  const r=await fetch('/api/user-pj',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,pj_name:bundle.player.name,pj_json:bundle,pj_status:'alive',pj_score:score,last_use:new Date().toISOString()})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudo guardar el personaje');
  banner(`PERSONAJE ${bundle.player.name} CREADO`);
 }catch(e){alert('Error al guardar el personaje: '+e.message)}
 game=null;
 startOverlay.classList.add('hidden');
 app.classList.add('hidden');
 openSinglePlayerScreen();
}

function openSinglePlayerScreen(){
 if(!configItems.length)fetchConfigItems();if(!configChests.length)fetchConfigChests();if(!configClasses.length)fetchConfigClasses();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();
 landingOverlay.classList.add('hidden');
 singlePlayerOverlay.classList.remove('hidden');
 document.getElementById('spListStatus')?.classList.add('hidden');
 document.getElementById('spList')?.classList.add('hidden');
}
function closeSinglePlayerScreen(){
 singlePlayerOverlay.classList.add('hidden');
 landingOverlay.classList.remove('hidden');
}

async function fetchMyCharacters(){
 const r=await fetch(`/api/user-pj?nombre=${encodeURIComponent(window.currentUser.nombre)}`);
 const data=await r.json();
 if(!r.ok)throw new Error(data.error||'No se pudieron cargar tus personajes');
 return Array.isArray(data)?data:[];
}

function openCharacterCreation(){
 landingOverlay.classList.add('hidden');
 singlePlayerOverlay.classList.add('hidden');
 app.classList.remove('hidden');
 startOverlay.classList.remove('hidden');
 fetchConfigClasses();
}

async function openCharacterSelection(){
 const status=document.getElementById('spListStatus'),list=document.getElementById('spList');
 status.classList.remove('hidden');list.classList.remove('hidden');
 status.textContent='Cargando tus personajes...';list.innerHTML='';
 try{
  const chars=(await fetchMyCharacters()).filter(c=>c.pj_status==='alive');
  if(!chars.length){status.textContent='No tienes personajes vivos. Crea uno nuevo.';return}
  status.textContent=`${chars.length} personaje(s) disponibles.`;
  list.innerHTML=chars.map(c=>`<button type="button" class="worldCard" data-pj-id="${c.id}"><b>${c.pj_name||'Sin nombre'}</b><span>${c.pj_json?.player?.className||''} · ${c.pj_json?.player?.raceName||''} · Nivel ${c.pj_json?.player?.level||1}</span><small>Score ${Math.round(c.pj_score||0)} · Último uso ${c.last_use?new Date(c.last_use).toLocaleString():'-'}</small></button>`).join('');
  list.querySelectorAll('[data-pj-id]').forEach(btn=>btn.onclick=()=>{
   currentCharacter=chars.find(c=>String(c.id)===btn.dataset.pjId);
   singlePlayerOverlay.classList.add('hidden');
   app.classList.remove('hidden');
   dungeonOverlay.classList.remove('hidden');
   const p=currentCharacter.pj_json?.player;
   document.getElementById('dungeonCharacterLabel').textContent=`Personaje: ${currentCharacter.pj_name} · ${p?.className||''} nivel ${p?.level||1}`;
   fetchDungeonWorlds();fetchConfigItems();fetchConfigClasses();fetchConfigFloors();fetchEnemyConfig();fetchConfigChests();setupWorldSettings();
  });
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function openSessionContinue(){
 const status=document.getElementById('spListStatus'),list=document.getElementById('spList');
 status.classList.remove('hidden');list.classList.remove('hidden');
 status.textContent='Cargando sesiones...';list.innerHTML='';
 try{
  const [chars,sessionsRes,worldsRes]=await Promise.all([fetchMyCharacters(),fetch('/api/dungeon-status?light=1'),fetch('/api/dungeon-worlds?light=1')]);
  const myIds=new Set(chars.map(c=>String(c.id)));
  const sessions=await sessionsRes.json();
  if(!sessionsRes.ok)throw new Error(sessions.error||sessions.message||'No se pudieron cargar las sesiones');
  const worlds=await worldsRes.json();
  if(!worldsRes.ok)throw new Error(worlds.error||worlds.message||'No se pudieron cargar los mundos');
  const mine=sessions.filter(s=>{if(s.dungeon_status?.multiplayer)return false;try{return (JSON.parse(s.players_ID||'[]')||[]).some(id=>myIds.has(String(id)))}catch(e){return false}});
  if(!mine.length){status.textContent='No tienes sesiones activas.';return}
  status.textContent=`${mine.length} sesión(es) activas.`;
  list.innerHTML=mine.map(s=>{
   let ids=[];try{ids=JSON.parse(s.players_ID||'[]')}catch(e){}
   const owner=chars.find(c=>ids.map(String).includes(String(c.id)));
   const world=worlds.find(w=>String(w.id)===String(s.dungeon_world_id));
   const floor=s.dungeon_status?.currentFloor||1,turn=s.dungeon_status?.turn||0;
   return `<button type="button" class="worldCard" data-session-id="${s.id}"><b>${owner?.pj_name||'Sesión'}</b><span>${world?.world_name||('Mundo #'+s.dungeon_world_id)} · Piso ${floor}</span><small>Turno ${turn} · Creada ${new Date(s.created_at).toLocaleString()}</small></button>`;
  }).join('');
  list.querySelectorAll('[data-session-id]').forEach(btn=>btn.onclick=()=>resumeSession(btn.dataset.sessionId));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function resumeSession(sessionId){
 try{
  if(!configItems.length)fetchConfigItems();if(!configChests.length)fetchConfigChests();if(!configClasses.length)fetchConfigClasses();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();
  const statusRes=await fetch(`/api/dungeon-status?id=${encodeURIComponent(sessionId)}`);
  const session=await statusRes.json();if(!statusRes.ok)throw new Error(session.error||session.message||'No se pudo cargar la sesión');
  let ids=[];try{ids=JSON.parse(session.players_ID||'[]')}catch(e){}
  const pjId=ids[0];
  const [worldRes,pjRes]=await Promise.all([fetch(`/api/dungeon-worlds?id=${encodeURIComponent(session.dungeon_world_id)}`),fetch(`/api/user-pj?id=${encodeURIComponent(pjId)}`)]);
  const world=await worldRes.json();if(!worldRes.ok)throw new Error(world.error||world.message||'No se pudieron cargar los mundos');
  if(!world)throw new Error('El mundo de esta sesión ya no existe.');
  const pj=await pjRes.json();if(!pjRes.ok)throw new Error(pj.error||pj.message||'No se pudo cargar el personaje');
  if(!pj||pj.pj_status!=='alive')throw new Error('El personaje de esta sesión ya no está vivo.');
  currentCharacter=pj;selectedDungeonWorld=world;
  const state=session.dungeon_status||{};
  const bundle=pj.pj_json||{};
  const player=bundle.player;
  const floorNum=state.currentFloor||1;
  const overlay=state.floors?.[String(floorNum)]||null;
  game={floor:floorNum,themeIndex:0,turn:state.turn||0,dungeonWorldId:world.id,dungeonWorldName:world.world_name,worldParams:normalizeWorldParams(world.world_json?.params),inventory:bundle.inventory||[],achievements:bundle.achievements||{},bossesKilled:bundle.bossesKilled||0,chestsOpened:bundle.chestsOpened||0,maxFloorReached:bundle.maxFloorReached||1,player,pjId:pj.id,dungeonStatusId:session.id,sessionFloors:state.floors||{}};
 game.player.shards=pj.shards?normalizeShards(pj.shards):(game.player.shards||{});
 game.player.customItems=pj.custom_items||game.player.customItems||[];
  singlePlayerOverlay.classList.add('hidden');
  app.classList.remove('hidden');
  if(overlay&&overlay.map){
   applyFloorSnapshot(overlay);
  }else{
   generateFloor();
   if(overlay){
    if(overlay.enemies)game.enemies=overlay.enemies;
    if(overlay.chests)game.chests=overlay.chests;
    if(overlay.doors)game.doors=overlay.doors;
    if(overlay.keys)game.keys=overlay.keys;
    if(overlay.companions)game.companions=overlay.companions;
    if(overlay.skillObjects)game.skillObjects=overlay.skillObjects;
    if(overlay.seen&&overlay.seen.length)game.seen=decodeSeen(overlay.seen);
    game.boss=game.enemies.find(e=>e.boss)||null;
   }
  }
  const pos=state.players?.[String(pj.id)];
  if(pos){game.player.x=pos.x;game.player.y=pos.y;game.player.facing=pos.facing||game.player.facing}
  anim.heroX=anim.targetX=game.player.x;anim.heroY=anim.targetY=game.player.y;anim.t=1;reveal(game.player.x,game.player.y);
  recomputeDerived();updateUI();draw();banner(`SESIÓN RESTAURADA · PISO ${game.floor}`);
 }catch(e){alert('Error al continuar la sesión: '+e.message)}
}

async function enterWorldWithCharacter(){
 if(!currentCharacter){banner('Selecciona un personaje primero.');return}
 dungeonOverlay.classList.add('hidden');
 const bundle=currentCharacter.pj_json||{};
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,worldParams:normalizeWorldParams(selectedDungeonWorld?.world_json?.params),inventory:bundle.inventory||[],achievements:bundle.achievements||{},bossesKilled:bundle.bossesKilled||0,chestsOpened:bundle.chestsOpened||0,maxFloorReached:bundle.maxFloorReached||1,player:bundle.player,pjId:currentCharacter.id};
 // shards live in their own user_pj column (not pj_json) so they survive
 // independently of the rest of the character bundle - see persistShards()
 game.player.shards=currentCharacter.shards?normalizeShards(currentCharacter.shards):(game.player.shards||{});
 // custom-crafted items (Creator's Room) live in their own user_pj column too
 game.player.customItems=currentCharacter.custom_items||game.player.customItems||[];
 generateFloor();
 try{
  const r=await fetch('/api/dungeon-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_world_id:String(selectedDungeonWorld.id),players_ID:JSON.stringify([currentCharacter.id]),dungeon_status:{turn:0,currentFloor:1,floors:{},players:{[currentCharacter.id]:{x:game.player.x,y:game.player.y,floor:1,facing:game.player.facing||1}}}})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||data.message||'No se pudo crear la sesión');
  game.dungeonStatusId=data.id;
 }catch(e){log(`No se pudo crear la sesión persistente: ${e.message}`,'sys')}
 banner(`ENTRAS EN ${selectedDungeonWorld.world_name} CON ${game.player.name}`);
}

function encodeSeen(seen){return (seen||[]).map(row=>row.map(v=>v?1:0).join(''))}
function decodeSeen(seen){
 if(!seen||!seen.length)return Array.from({length:ROWS},()=>Array(COLS).fill(false));
 if(typeof seen[0]==='string')return seen.map(row=>Array.from(row,ch=>ch==='1'));
 return seen;
}
function floorSnapshot(){
 return {map:game.map,rooms:game.rooms,safeRooms:game.safeRooms||[],stairs:game.stairs,floorTileset:game.floorTileset,enemyFamily:game.enemyFamily||null,enemies:game.enemies||[],chests:game.chests||[],doors:game.doors||[],keys:game.keys||[],traps:game.traps||[],altars:game.altars||[],companions:game.companions||[],skillObjects:game.skillObjects||[],seen:encodeSeen(game.seen),objective:game.objective||null,floorArchetype:game.floorArchetype||'standard',floorArchetypeLabel:game.floorArchetypeLabel||'',floorArchetypeDesc:game.floorArchetypeDesc||'',rewardRarityBonus:game.rewardRarityBonus||0};
}
// dynamic-only parts (the static map/rooms/tileset never change within a floor)
function floorSnapshotDynamic(){
 return {stairs:game.stairs,enemyFamily:game.enemyFamily||null,enemies:game.enemies||[],chests:game.chests||[],doors:game.doors||[],keys:game.keys||[],traps:game.traps||[],altars:game.altars||[],companions:game.companions||[],skillObjects:game.skillObjects||[],seen:encodeSeen(game.seen),objective:game.objective||null};
}
function applyFloorSnapshot(overlay){
 Object.assign(game,{map:overlay.map,rooms:overlay.rooms,safeRooms:overlay.safeRooms||[],stairs:overlay.stairs,floorTileset:overlay.floorTileset,enemyFamily:overlay.enemyFamily||null,enemies:overlay.enemies||[],chests:overlay.chests||[],doors:overlay.doors||[],keys:overlay.keys||[],traps:overlay.traps||[],altars:overlay.altars||[],companions:overlay.companions||[],skillObjects:overlay.skillObjects||[],seen:decodeSeen(overlay.seen),objective:overlay.objective||game.objective||null,floorArchetype:overlay.floorArchetype||game.floorArchetype||'standard',floorArchetypeLabel:overlay.floorArchetypeLabel||game.floorArchetypeLabel||'',floorArchetypeDesc:overlay.floorArchetypeDesc||game.floorArchetypeDesc||'',rewardRarityBonus:overlay.rewardRarityBonus??game.rewardRarityBonus??0});
 game.boss=(game.enemies||[]).find(e=>e.boss)||null;
}
function persistTurnState(){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 game.maxFloorReached=bundle.maxFloorReached;
 fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})}).catch(e=>console.error('No se pudo guardar el personaje',e));
 if(!game.dungeonStatusId)return;
 const dungeonState={turn:game.turn,currentFloor:game.floor,floors:{[game.floor]:floorSnapshot()},players:{[game.pjId]:{x:game.player.x,y:game.player.y,floor:game.floor,facing:game.player.facing||1}}};
 game.sessionFloors=dungeonState.floors;
 fetch(`/api/dungeon-status?id=${encodeURIComponent(game.dungeonStatusId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_status:dungeonState})}).catch(e=>console.error('No se pudo guardar la sesión',e));
}

async function finalizeCharacterDeath(){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 try{
  await fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,pj_score:computeScore(bundle),pj_status:'dead',last_use:new Date().toISOString()})});
 }catch(e){console.error('No se pudo marcar el personaje como muerto',e)}
 if(game.multiplayer){
  if(mpGamePollTimer){clearInterval(mpGamePollTimer);mpGamePollTimer=null}
  stopMpTradePolling();
  const deadId=String(game.pjId);
  mpClearLiveTimers();
  mpResetActionQueues();
  game.mpSeq=(game.mpSeq||0)+1; // death outranks any in-flight live turn
  game.turnOrder=(game.turnOrder||[]).filter(id=>String(id)!==deadId);
  // remove the dead player from the shared turn order and mark hp 0 so nobody waits on them
  await mpSaveSession(game.dungeonStatusId,fresh=>{
   const order=(fresh.turnOrder||[]).map(String);
   const idx=order.indexOf(deadId);
   const newOrder=(fresh.turnOrder||[]).filter(id=>String(id)!==deadId);
   let active=fresh.activePlayerIndex||0,turn=fresh.turn||0;
   if(idx>-1){
    if(idx<active)active--;
    else if(idx===active&&idx===order.length-1){active=0;turn++}
   }
   if(active<0||active>=newOrder.length)active=0;
   const players={...fresh.players};
   if(players[deadId])players[deadId]={...players[deadId],hp:0};
   return {dungeon_status:{...fresh,turnOrder:newOrder,activePlayerIndex:active,turn,players,seq:Math.max(Number(fresh.seq)||0,game.mpSeq||0)}};
  });
  return;
 }
 if(game.dungeonStatusId){
  try{await fetch(`/api/dungeon-status?id=${encodeURIComponent(game.dungeonStatusId)}`,{method:'DELETE'})}catch(e){console.error('No se pudo borrar la sesión',e)}
 }
}

async function fetchScores(){
 const status=document.getElementById('scoresStatus'),table=document.getElementById('scoresTable');
 status.textContent='Cargando puntuaciones...';table.innerHTML='';
 try{
  const r=await fetch('/api/user-pj');const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudieron cargar las puntuaciones');
  if(!data.length){status.textContent='Todavía no hay personajes.';return}
  status.textContent=`${data.length} personaje(s).`;
  table.innerHTML=`<table class="scoresGrid"><thead><tr><th>#</th><th>Personaje</th><th>Usuario</th><th>Estado</th><th>Clase</th><th>Raza</th><th>Nivel</th><th>Score</th><th>Último uso</th></tr></thead><tbody>${data.map((c,i)=>{const p=c.pj_json?.player||{};return `<tr class="${c.pj_status==='dead'?'deadRow':''}"><td>${i+1}</td><td>${c.pj_name||'-'}</td><td>${c.nombre||'-'}</td><td>${c.pj_status==='dead'?'Muerto':'Vivo'}</td><td>${p.className||'-'}</td><td>${p.raceName||'-'}</td><td>${p.level||1}</td><td>${Math.round(c.pj_score||0)}</td><td>${c.last_use?new Date(c.last_use).toLocaleString():'-'}</td></tr>`}).join('')}</tbody></table>`;
 }catch(e){status.textContent=`Error: ${e.message}`}
}

function renderCharacterCards(chars){
 return chars.map(c=>`<button type="button" class="worldCard" data-pj-id="${c.id}"><b>${c.pj_name||'Sin nombre'}</b><span>${c.pj_json?.player?.className||''} · ${c.pj_json?.player?.raceName||''} · Nivel ${c.pj_json?.player?.level||1}</span><small>Score ${Math.round(c.pj_score||0)} · Último uso ${c.last_use?new Date(c.last_use).toLocaleString():'-'}</small></button>`).join('');
}

async function enterMultiplayerScreen(){
 landingOverlay.classList.add('hidden');
 multiplayerOverlay.classList.remove('hidden');
 loadRtConfig();
 if(!multiSessionId)await loginMultiSession();
 refreshOnlineUsers();
 refreshOpenSessions();
 startMultiHeartbeat();
}
function startMultiHeartbeat(){
 if(!multiHeartbeatTimer)multiHeartbeatTimer=setInterval(()=>{heartbeatMultiSession();refreshOnlineUsers();refreshOpenSessions()},8000);
}
// The 8s presence timer refetches the whole session list; during a game it
// competes with turn sync (multi-second stalls), so it must stop here.
function stopMultiHeartbeat(){
 if(multiHeartbeatTimer){clearInterval(multiHeartbeatTimer);multiHeartbeatTimer=null}
}
async function loginMultiSession(){
 try{
  const r=await fetch('/api/multi-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:window.currentUser.nombre})});
  const data=await r.json();
  if(r.ok)multiSessionId=data.id;
 }catch(e){console.error('No se pudo registrar presencia multijugador',e)}
}
function heartbeatMultiSession(){
 if(!multiSessionId)return;
 fetch(`/api/multi-session?id=${encodeURIComponent(multiSessionId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({heartbeat:true})}).catch(e=>console.error(e));
}
function logoutMultiSession(){
 if(!multiSessionId)return;
 const id=multiSessionId;multiSessionId=null;
 fetch(`/api/multi-session?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({logout:true})}).catch(e=>console.error(e));
}
const MAIN_MENU_SCREEN_IDS=['app','singlePlayerOverlay','multiplayerOverlay','mpLobbyOverlay','configScreen','scoresScreen','dungeonOverlay','dungeonPreviewOverlay','startOverlay','storyOverlay'];
function goToMainMenu(){
 if(game&&!confirm('¿Volver al menú principal? Perderás el progreso no guardado de este piso.'))return;
 if(game?.multiplayer){logoutMultiSession();mpFlushCheckpointBeacon();cleanupMultiplayerRuntime()}
 if(multiHeartbeatTimer){clearInterval(multiHeartbeatTimer);multiHeartbeatTimer=null}
 if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
 if(mpGamePollTimer){clearInterval(mpGamePollTimer);mpGamePollTimer=null}
 game=null;
 for(const id of MAIN_MENU_SCREEN_IDS)document.getElementById(id)?.classList.add('hidden');
 landingOverlay.classList.remove('hidden');
 mainMenuActions?.classList.remove('hidden');
 loginForm?.classList.add('hidden');
}
document.getElementById('globalMenuBtn').onclick=goToMainMenu;
function leaveMultiplayerScreen(){
 logoutMultiSession();
 mpFlushCheckpointBeacon();
 cleanupMultiplayerRuntime();
 if(multiHeartbeatTimer){clearInterval(multiHeartbeatTimer);multiHeartbeatTimer=null}
 multiplayerOverlay.classList.add('hidden');
 landingOverlay.classList.remove('hidden');
}
async function refreshOnlineUsers(){
 const list=document.getElementById('onlineUsersList');
 try{
  const since=new Date(Date.now()-45000).toISOString();
  const r=await fetch(`/api/multi-session?online=1&since=${encodeURIComponent(since)}`);
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudo cargar');
  const seen=new Set();
  const names=data.map(u=>u.user_id).filter(n=>{if(!n||seen.has(n))return false;seen.add(n);return true});
  list.innerHTML=names.length?names.map(n=>`<div class="onlineUserRow">${n===window.currentUser?.nombre?`<b>${n} (tú)</b>`:n}</div>`).join(''):'<p class="small">Nadie más conectado.</p>';
 }catch(e){list.innerHTML=`<p class="small">Error: ${e.message}</p>`}
}

async function refreshOpenSessions(){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Cargando sesiones...';list.innerHTML='';
 try{
  const [chars,r]=await Promise.all([fetchMyCharacters(),fetch('/api/dungeon-status?light=1')]);
  const sessions=await r.json();
  if(!r.ok)throw new Error(sessions.error||sessions.message||'No se pudieron cargar sesiones');
  const myIds=new Set(chars.map(c=>String(c.id)));
  const open=sessions.filter(s=>{
   if(!s.dungeon_status?.multiplayer)return false;
   let ids=[];try{ids=JSON.parse(s.players_ID||'[]')||[]}catch(e){}
   return !ids.some(id=>myIds.has(String(id)));
  });
  if(!open.length){status.textContent='No hay sesiones a las que unirse. Crea una.';return}
  status.textContent=`${open.length} sesión(es) disponibles.`;
  list.innerHTML=open.map(s=>{const st=s.dungeon_status||{};const names=(st.roster||[]).map(r=>r.pjName).join(', ');return `<button type="button" class="worldCard" data-open-session="${s.id}"><b>${st.hostUser||'Anfitrión'}</b><span>${st.started?`En curso · Piso ${st.currentFloor||1}`:'Sala de espera'} · ${names}</span><small>Creada ${new Date(s.created_at).toLocaleString()}</small></button>`}).join('');
  list.querySelectorAll('[data-open-session]').forEach(btn=>btn.onclick=()=>mpStartJoinFlow(btn.dataset.openSession));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function mpStartCreateFlow(){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Elige un personaje para alojar la partida...';list.innerHTML='';
 try{
  const chars=(await fetchMyCharacters()).filter(c=>c.pj_status==='alive');
  if(!chars.length){status.innerHTML='No tienes personajes vivos. Ve a SINGLE PLAYER → NUEVO PERSONAJE primero.';return}
  list.innerHTML=renderCharacterCards(chars);
  list.querySelectorAll('[data-pj-id]').forEach(btn=>btn.onclick=()=>{
   currentCharacter=chars.find(c=>String(c.id)===btn.dataset.pjId);
   mpPendingAction={type:'host'};
   multiplayerOverlay.classList.add('hidden');
   app.classList.remove('hidden');
   dungeonOverlay.classList.remove('hidden');
   document.getElementById('dungeonCharacterLabel').textContent=`Personaje: ${currentCharacter.pj_name} (anfitrión multijugador)`;
   fetchDungeonWorlds();fetchConfigItems();fetchConfigClasses();fetchConfigFloors();fetchEnemyConfig();fetchConfigChests();setupWorldSettings();
  });
 }catch(e){status.textContent=`Error: ${e.message}`}
}

const ENEMY_TIER_LABELS={i:'I',ii:'II',iii:'III',iv:'IV'};
// Reads the world's already-precomputed floors (world_json.floors, baked in
// createDungeonWorldJson) - no need to regenerate anything, this is exactly
// what will actually be used when the player enters each floor.
function buildDungeonPreviewText(worldJson){
 const floors=worldJson?.floors||[];
 if(!floors.length)return 'Esta dungeon no tiene pisos precalculados.';
 return floors.map(f=>{
  const enemyTiers={};for(const e of f.enemies||[]){const t=e.tier||'i';enemyTiers[t]=(enemyTiers[t]||0)+1}
  const enemyLine=Object.keys(ENEMY_TIER_LABELS).map(t=>`Tier ${ENEMY_TIER_LABELS[t]}: ${enemyTiers[t]||0}`).join(' · ');
  const bossLine=f.boss?` · Jefe: ${f.boss.name||'Jefe'}`:'';
  const chestTiers={},chestNames=[];
  for(const c of f.chests||[]){const t=c.chestDef?.tier||'?';chestTiers[t]=(chestTiers[t]||0)+1;if(c.chestDef?.name)chestNames.push(c.chestDef.name)}
  const chestTierLine=[1,2,3,4,5].map(t=>`Tier ${t}: ${chestTiers[t]||0}`).join(' · ');
  const nameCounts=chestNames.reduce((acc,n)=>{acc[n]=(acc[n]||0)+1;return acc},{});
  const namesLine=Object.keys(nameCounts).length?Object.entries(nameCounts).map(([n,c])=>c>1?`${n} x${c}`:n).join(', '):'Ninguno';
  return `PISO ${f.floor} (${f.themeName||''})\n Enemigos -> ${enemyLine}${bossLine}\n Cofres por tier -> ${chestTierLine}\n Cofres asignados -> ${namesLine}`;
 }).join('\n\n');
}
function proceedAfterWorldChosen(){
 const text=document.getElementById('dungeonPreviewText');
 if(text)text.textContent=buildDungeonPreviewText(selectedDungeonWorld?.world_json);
 dungeonOverlay.classList.add('hidden');
 document.getElementById('dungeonPreviewOverlay')?.classList.remove('hidden');
 document.getElementById('dungeonPreviewContinueBtn').onclick=()=>{
  document.getElementById('dungeonPreviewOverlay')?.classList.add('hidden');
  if(mpPendingAction?.type==='host'){mpCreateHostSession();return}
  enterWorldWithCharacter();
 };
 document.getElementById('dungeonPreviewBackBtn').onclick=()=>{
  document.getElementById('dungeonPreviewOverlay')?.classList.add('hidden');
  dungeonOverlay.classList.remove('hidden');
 };
}

async function mpCreateHostSession(){
 dungeonOverlay.classList.add('hidden');
 const bundle=currentCharacter.pj_json||{};
 const roster=[{pjId:currentCharacter.id,nombre:window.currentUser.nombre,pjName:currentCharacter.pj_name,className:bundle.player?.className,level:bundle.player?.level||1}];
 const status={multiplayer:true,started:false,host:currentCharacter.id,hostUser:window.currentUser.nombre,roster,turnOrder:[currentCharacter.id],activePlayerIndex:0,turn:0,currentFloor:1,floors:{},players:{},rev:0};
 try{
  const r=await fetch('/api/dungeon-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_world_id:String(selectedDungeonWorld.id),players_ID:JSON.stringify([currentCharacter.id]),dungeon_status:status})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||data.message||'No se pudo crear la sesión multijugador');
  mpPendingAction=null;
  openMpLobby(data.id,true);
 }catch(e){alert('Error al crear la sesión: '+e.message)}
}

async function mpStartJoinFlow(sessionId){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Elige un personaje para unirte...';list.innerHTML='';
 try{
  const chars=(await fetchMyCharacters()).filter(c=>c.pj_status==='alive');
  if(!chars.length){status.innerHTML='No tienes personajes vivos.';return}
  list.innerHTML=renderCharacterCards(chars);
  list.querySelectorAll('[data-pj-id]').forEach(btn=>btn.onclick=()=>mpJoinSession(sessionId,chars.find(c=>String(c.id)===btn.dataset.pjId)));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

function isWalkableTile(map,x,y){return !!(map&&map[y]&&map[y][x]===0)}
function mpFreeSpawnNear(map,enemies,occupiedList,base){
 if(!base)return null;
 if(!map)return {x:base.x,y:base.y};
 const occupied=occupiedList||[];
 const candidates=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
 for(const [dx,dy] of candidates){
  const pos={x:base.x+dx,y:base.y+dy};
  if(isWalkableTile(map,pos.x,pos.y)&&!(enemies||[]).some(e=>e.x===pos.x&&e.y===pos.y)&&!occupied.includes(`${pos.x},${pos.y}`))return pos;
 }
 return {x:base.x,y:base.y};
}

// ---- Multiplayer low-latency transport -------------------------------------
// Hot-path reads/writes go straight to Supabase REST (no serverless cold
// starts) and committed writes are pushed to the other clients via Supabase
// Realtime broadcast. /api/dungeon-status remains as fallback and polling
// stays as a 2s safety net. Correctness is unchanged: every apply and every
// write still goes through the rev optimistic lock, so a late/out-of-order
// message can never re-grant an already-passed turn.
async function loadRtConfig(){
 if(rtConfig!==undefined)return rtConfig;
 try{
  const r=await fetch('/api/rt-config');
  rtConfig=r.ok?await r.json():null;
  if(rtConfig&&!rtConfig.url)rtConfig=null;
 }catch(e){rtConfig=null}
 return rtConfig;
}
function dsHeaders(){return {apikey:rtConfig.key,Authorization:`Bearer ${rtConfig.key}`,'Content-Type':'application/json'}}
async function dsGet(id){
 if(rtConfig?.url){
  try{
   const r=await fetch(`${rtConfig.url}/rest/v1/dungeon_status?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:dsHeaders()});
   if(r.ok){const d=await r.json();return Array.isArray(d)?d[0]||null:d}
  }catch(e){}
 }
 const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(id)}`);
 const d=await r.json();
 return r.ok?d:null;
}
async function dsGetRev(id){
 if(rtConfig?.url){
  try{
   const r=await fetch(`${rtConfig.url}/rest/v1/dungeon_status?select=rev:dungeon_status->>rev&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:dsHeaders()});
   if(r.ok){const d=await r.json();return Number((Array.isArray(d)?d[0]:d)?.rev)||0}
  }catch(e){}
 }
 const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(id)}&light=1`);
 if(!r.ok)return null;
 return Number((await r.json())?.rev)||0;
}
// returns {ok,conflict,data}
// minimal=true skips the row echo in the response (saves ~50KB of download per
// write); the CAS conflict is then detected via the Content-Range count. If the
// header is missing we conservatively report a conflict so the caller re-reads
// (the retry uses the representation path, so this can never loop).
async function dsPatch(id,row,expectedRev,minimal=false){
 if(rtConfig?.url){
  try{
   let f=`id=eq.${encodeURIComponent(id)}`;
   const hasRev=expectedRev!==undefined&&expectedRev!==null;
   if(hasRev)f+=`&dungeon_status->>rev=eq.${encodeURIComponent(String(expectedRev))}`;
   const prefer=minimal?'return=minimal,count=exact':'return=representation';
   const r=await fetch(`${rtConfig.url}/rest/v1/dungeon_status?${f}`,{method:'PATCH',headers:{...dsHeaders(),Prefer:prefer},body:JSON.stringify(row)});
   if(r.ok){
    if(minimal){
     if(!hasRev)return {ok:true,data:null};
     const cr=r.headers.get('content-range');
     if(!cr||/\/0$/.test(cr))return {ok:false,conflict:true};
     return {ok:true,data:null};
    }
    const d=await r.json();
    if(hasRev&&Array.isArray(d)&&!d.length)return {ok:false,conflict:true};
    return {ok:true,data:d};
   }
  }catch(e){}
 }
 const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...row,expectedRev})});
 if(r.status===409)return {ok:false,conflict:true};
 const d=await r.json().catch(()=>null);
 return {ok:r.ok,data:d};
}
let rtConnectPromise=null;
async function mpRealtimeConnect(sessionId){
 if(rtConnectPromise)await rtConnectPromise.catch(()=>{});
 if(rtChannel&&String(rtChannelSessionId)===String(sessionId))return;
 rtConnectPromise=(async()=>{
  mpSetRealtimeStatus('connecting');
  const cfg=await loadRtConfig();
  if(!cfg||!window.supabase){mpSetRealtimeStatus('error');return}
  mpRealtimeDisconnect();
  mpSetRealtimeStatus('connecting'); // mpRealtimeDisconnect() reset it to idle
  if(!rtClient)rtClient=window.supabase.createClient(cfg.url,cfg.key);
  rtChannelSessionId=String(sessionId);
  rtChannel=rtClient.channel(`ds-${sessionId}`,{config:{broadcast:{self:false}}});
  rtChannel.on('broadcast',{event:'state'},({payload})=>mpOnRemoteBroadcast(sessionId,payload));
  rtChannel.on('broadcast',{event:'turn'},({payload})=>mpOnRemoteTurn(sessionId,payload));
  rtChannel.on('broadcast',{event:'ack'},({payload})=>mpOnAck(payload));
  rtChannel.on('broadcast',{event:'need'},({payload})=>mpOnNeed(payload));
  rtChannel.on('broadcast',{event:'full'},({payload})=>mpOnFull(payload));
  rtChannel.on('broadcast',{event:'trade'},()=>mpOnRemoteTrade(sessionId));
  rtChannel.on('broadcast',{event:'action'},({payload})=>handleMpAction(payload));
  rtChannel.subscribe(status=>{
   // Supabase statuses: SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED
   mpSetRealtimeStatus(status==='SUBSCRIBED'?'subscribed':status==='CHANNEL_ERROR'?'error':status==='TIMED_OUT'?'degraded':status==='CLOSED'?'closed':'connecting');
  });
 })();
 try{await rtConnectPromise}finally{rtConnectPromise=null}
}
function mpRealtimeDisconnect(){
 if(rtChannel){try{rtClient?.removeChannel(rtChannel)}catch(e){}}
 rtChannel=null;rtChannelSessionId=null;
 mpSetRealtimeStatus('idle');
}
function mpBroadcastState(id,status){
 if(!rtChannel||!rtReady||String(rtChannelSessionId)!==String(id))return;
 // strip the static floor layout from the wire copy (~15KB less per message);
 // same-floor receivers never need it and floor-change receivers refetch full
 let wire=status;
 try{
  const floors=status.floors||{};
  const slim={};let changed=false;
  for(const [k,v] of Object.entries(floors)){
   if(v&&v.map){const {map,rooms,safeRooms,floorTileset,...rest}=v;slim[k]=rest;changed=true}
   else slim[k]=v;
  }
  if(changed)wire={...status,floors:slim,slimFloors:true};
 }catch(e){}
 try{rtChannel.send({type:'broadcast',event:'state',payload:{rev:status.rev,status:wire}})}catch(e){}
}
// =============================================================================
// MULTIPLAYER REALTIME VISUAL ACTIONS
// -----------------------------------------------------------------------------
// Separates FOUR concerns that used to be conflated into a single "turn"
// broadcast sent only once the whole action (and, worse, the whole enemy
// phase) had already resolved locally:
//   1. Immediate visual playback  -> ephemeral `action` broadcasts (this block)
//   2. Definitive turn state      -> `turn` broadcast, semantically `turn_commit`
//      (see mpTurnPayload/mpPublishTurn/mpOnRemoteTurn below; unchanged CAS,
//      seq, ACK, resend, need/full, checkpoint machinery)
//   3. Periodic persistence       -> mpCheckpoint (unchanged)
//   4. Recovery from loss/disconnect -> need/full + DB poll (unchanged)
//
// `action` messages are pure visual sugar: fire-and-forget, deduplicated by
// eventId, ordered best-effort per author with a short buffer/timeout, never
// written to Supabase, never authoritative. The authoritative state keeps
// arriving exactly as before via `turn`; if an `action` is lost, delayed, or
// duplicated, the worst case is a missed/doubled animation - the next
// `turn_commit` still reconciles position/HP/enemies/etc. correctly.
// =============================================================================

const MP_PROTOCOL_VERSION=2;
// Toggle from the console with: localStorage.mpDebugLatency='1' (or '0' to disable)
const MP_DEBUG_LATENCY=(()=>{try{return localStorage.getItem('mpDebugLatency')==='1'}catch(e){return false}})();

// ---- Telemetry --------------------------------------------------------------
// Centralized so latency can be localized to created->sent, sent->received,
// received->applied or applied->rendered without console.log scattered around.
const MP_TELEMETRY_MAX=300;
const mpTelemetryLog=[];
const mpTelemetryEvents=new Map();
function mpDebugEvent(stage,data){
 if(!MP_DEBUG_LATENCY)return;
 const entry={stage,...data,loggedAt:Date.now()};
 mpTelemetryLog.push(entry);
 if(mpTelemetryLog.length>MP_TELEMETRY_MAX)mpTelemetryLog.shift();
 console.debug('[mp]',stage,entry);
}
function mpTelemetryStart(eventId,base){
 if(!MP_DEBUG_LATENCY)return;
 mpTelemetryEvents.set(eventId,{eventId,...base,createdAt:Date.now()});
 if(mpTelemetryEvents.size>MP_TELEMETRY_MAX){const k=mpTelemetryEvents.keys().next().value;mpTelemetryEvents.delete(k)}
}
function mpTelemetryMark(eventId,field,extra){
 if(!MP_DEBUG_LATENCY)return;
 const rec=mpTelemetryEvents.get(eventId);if(!rec)return;
 rec[field]=Date.now();
 if(extra)Object.assign(rec,extra);
 mpDebugEvent(field,rec);
}
function mpPayloadBytes(payload){
 try{return new Blob([JSON.stringify(payload)]).size}catch(e){try{return JSON.stringify(payload).length}catch(e2){return -1}}
}
// Non-critical (visual) errors are logged and swallowed: the game must keep
// running on turn_commit even if a visual ping fails end to end.
function mpReportError(context,error,metadata){
 console.error(`[mp:${context}]`,error?.message||error,metadata||'');
 mpDebugEvent('error',{context,message:String(error?.message||error),...metadata});
}

// ---- Explicit Realtime connection state --------------------------------------
// A channel object existing is not the same as Realtime being usable: track
// the actual Supabase status so callers can tell "connecting" from "degraded".
let mpRealtimeStatus='idle'; // idle|connecting|subscribed|degraded|error|closed
let mpTransportMode='fallback'; // realtime|fallback
function mpSyncRealtimeStatusToGame(){
 if(!game)return;
 game.mpRealtimeStatus=mpRealtimeStatus;
 game.mpRealtimeReady=mpRealtimeStatus==='subscribed';
 game.mpTransportMode=mpTransportMode;
}
function mpSetRealtimeStatus(status){
 mpRealtimeStatus=status;
 mpTransportMode=status==='subscribed'?'realtime':'fallback';
 rtReady=status==='subscribed';
 mpSyncRealtimeStatusToGame();
 mpAdjustPollInterval();
 mpUpdateConnBadge();
 mpDebugEvent('realtime_status',{status,transportMode:mpTransportMode});
}
function mpUpdateConnBadge(){
 const el=document.getElementById('mpConnBadge');
 if(!el)return;
 if(!game?.multiplayer){el.classList.add('hidden');return}
 el.classList.remove('hidden');
 el.classList.toggle('mpConnDegraded',mpRealtimeStatus!=='subscribed');
 el.textContent=mpRealtimeStatus==='subscribed'?'● TIEMPO REAL':mpRealtimeStatus==='connecting'?'○ CONECTANDO...':'○ MODO DEGRADADO';
 el.title=mpRealtimeStatus==='subscribed'?'Conexión en tiempo real activa':'Sin tiempo real: usando guardado periódico como respaldo';
}

// ---- Per-author visual action queue (reorder tolerance + small stabilizer) --
const MP_ACTION_REORDER_WAIT_MS=80;
const MP_REMOTE_ACTION_BUFFER_MS=80;
const MP_PROCESSED_EVENT_TTL_MS=60_000;
const MP_PROCESSED_EVENT_MAX=500;
const processedActionIds=new Map(); // eventId -> Date.now(), capped + TTL-pruned
const mpAuthorQueues=new Map();     // author -> {expected, items:Map(actionSeq->{message,arrivedAt,dueAt})}
let mpActionSeqCounter=0;
let mpActionDrainTimer=null;

function mpNextActionSeq(){return ++mpActionSeqCounter}
function mpResetActionSeq(){mpActionSeqCounter=0}
function mpMarkActionProcessed(eventId){
 mpPruneProcessedActions();
 processedActionIds.set(eventId,Date.now());
 if(processedActionIds.size>MP_PROCESSED_EVENT_MAX){const k=processedActionIds.keys().next().value;processedActionIds.delete(k)}
}
function mpPruneProcessedActions(){
 const cutoff=Date.now()-MP_PROCESSED_EVENT_TTL_MS;
 for(const [id,t] of processedActionIds)if(t<cutoff)processedActionIds.delete(id);
}
// Queues are keyed by (author, turnSeq): actionSeq restarts at 1 every turn
// (see sendMpAction), so the "expected" counter must reset per turn too, or a
// reused actionSeq from a new turn could never satisfy a stale expectation
// left over from the previous one.
function mpQueueKey(author,turnSeq){return `${author}|${turnSeq}`}
function mpAuthorQueue(author,turnSeq){
 const key=mpQueueKey(author,turnSeq);
 let q=mpAuthorQueues.get(key);
 if(!q){q={expected:1,items:new Map()};mpAuthorQueues.set(key,q)}
 return q;
}
// Once a turn_commit for `seq` (or later) has been applied, any queued visual
// actions for turnSeq<=seq are moot - the confirmed state already supersedes
// them - so drop them instead of leaking queue entries forever.
function mpPruneActionQueuesUpTo(seq){
 for(const key of mpAuthorQueues.keys()){
  const turnSeq=Number(key.split('|')[1]);
  if(Number.isFinite(turnSeq)&&turnSeq<=seq)mpAuthorQueues.delete(key);
 }
}
// Called on floor change, resync, reconnect or leaving: stale visual actions
// must never be replayed against a state they no longer describe.
function mpResetActionQueues(){
 mpAuthorQueues.clear();
 processedActionIds.clear();
 mpResetActionSeq();
 if(mpActionDrainTimer){clearInterval(mpActionDrainTimer);mpActionDrainTimer=null}
 game&&(game.mpEnemyPhaseRemote=false);
}
function mpArmActionDrain(){
 if(mpActionDrainTimer)return;
 mpActionDrainTimer=setInterval(mpDrainActionQueues,20);
}
// Strict per-author ordering with a bounded wait for the expected actionSeq.
// If the gap-filler doesn't show up within MP_ACTION_REORDER_WAIT_MS, skip
// ahead and play what's available - turn_commit reconciles the true state
// regardless, so a permanently-stuck queue is worse than a small skip.
function mpDrainActionQueues(){
 const now=Date.now();
 let anyPending=false;
 for(const q of mpAuthorQueues.values()){
  while(true){
   const next=q.items.get(q.expected);
   if(next){
    if(next.dueAt<=now){
     mpPlayRemoteAction(next.message);
     q.items.delete(q.expected);
     q.expected++;
     continue;
    }
    anyPending=true;break;
   }
   let forced=false;
   for(const [seq,item] of q.items){
    if(seq>q.expected&&now-item.arrivedAt>=MP_ACTION_REORDER_WAIT_MS&&item.dueAt<=now){q.expected=seq;forced=true;break}
   }
   if(forced)continue;
   if(q.items.size>0)anyPending=true;
   break;
  }
 }
 if(!anyPending&&mpActionDrainTimer){clearInterval(mpActionDrainTimer);mpActionDrainTimer=null}
}

// ---- Sending ------------------------------------------------------------
// Fire-and-forget: never awaited by callers, so a visual ping can never delay
// the local simulation or the turn_commit that follows it. kind/data shape is
// documented in the action-kind list; keep payloads small (ids+coords only).
function sendMpAction(kind,data){
 if(!game?.multiplayer)return;
 // recorded for the turn-commit replay regardless of transport; the live
 // broadcast below is best-effort and only goes out when Realtime is ready
 if(kind!=='floor_transition_start'){game.mpTurnActions=(game.mpTurnActions||[]).concat({kind,...data}).slice(-60)}
 if(!mpLive())return;
 try{
  const turnSeq=(game.mpSeq||0)+1,actionSeq=mpNextActionSeq();
  const eventId=`${game.pjId}-${turnSeq}-${actionSeq}-${Math.random().toString(36).slice(2,8)}`;
  const now=Date.now();
  const payload={protocolVersion:MP_PROTOCOL_VERSION,type:'action',sessionId:String(game.dungeonStatusId),eventId,author:String(game.pjId),turnSeq,actionSeq,createdAt:now,sentAt:now,floor:game.floor,action:{kind,...data}};
  mpTelemetryStart(eventId,{eventType:'action',sessionId:payload.sessionId,author:payload.author,turnSeq,actionSeq,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
  const bytes=mpPayloadBytes(payload);
  mpTelemetryMark(eventId,'sentAt',{payloadBytes:bytes});
  rtChannel.send({type:'broadcast',event:'action',payload});
 }catch(e){mpReportError('sendMpAction',e,{kind})}
}

// ---- Receiving ------------------------------------------------------------
// Validates protocol/session/floor/author/eventId/entity before anything is
// queued; never applies persistent state, never writes to Supabase.
function validateMpAction(message){
 if(!message||message.type!=='action')return false;
 const ver=message.protocolVersion;
 if(ver!==undefined&&ver>MP_PROTOCOL_VERSION){mpReportError('protocol',new Error('acción con protocolo más nuevo, ignorada'),{ver});return false}
 if(!game?.multiplayer||String(message.sessionId)!==String(game.dungeonStatusId))return false;
 if(!message.eventId||!message.author||!message.action?.kind)return false;
 if(String(message.author)===String(game.pjId))return false; // never replay my own actions
 const rosterIds=new Set((game.roster||[]).map(r=>String(r.pjId)));
 if(rosterIds.size&&!rosterIds.has(String(message.author)))return false; // author must belong to this session
 if(message.floor!==undefined&&message.floor!==game.floor)return false; // stale floor: drop
 if(!MP_ACTION_RENDERERS[message.action.kind])return false; // unsupported kind: ignore, don't guess
 return true;
}
function handleMpAction(message){
 if(!validateMpAction(message))return;
 if(processedActionIds.has(message.eventId))return; // duplicate: drop, don't replay the animation
 mpMarkActionProcessed(message.eventId);
 game.mpLiveSeen=game.mpLiveSeen||{};const lk=`${message.author}|${message.turnSeq}`;game.mpLiveSeen[lk]=(game.mpLiveSeen[lk]||0)+1;
 mpTelemetryStart(message.eventId,{eventType:'action',sessionId:message.sessionId,author:message.author,turnSeq:message.turnSeq,actionSeq:message.actionSeq,sentAt:message.sentAt,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
 mpTelemetryMark(message.eventId,'receivedAt');
 enqueueRemoteAction(message);
}
function enqueueRemoteAction(message){
 const author=String(message.author);
 const q=mpAuthorQueue(author,message.turnSeq);
 const seq=Number(message.actionSeq)||1;
 const age=Date.now()-(Number(message.sentAt)||Date.now());
 const dueAt=Date.now()+Math.max(0,MP_REMOTE_ACTION_BUFFER_MS-age);
 q.items.set(seq,{message,arrivedAt:Date.now(),dueAt});
 mpArmActionDrain();
}
function mpPlayRemoteAction(message){
 if(!game?.multiplayer||message.floor!==undefined&&message.floor!==game.floor)return; // floor moved on while queued
 mpTelemetryMark(message.eventId,'appliedAt');
 const renderer=MP_ACTION_RENDERERS[message.action.kind];
 try{renderer&&renderer(message.action,message)}catch(e){mpReportError('render',e,{kind:message.action.kind})}
 mpTelemetryMark(message.eventId,'renderedAt');
}

// ---- Renderers --------------------------------------------------------------
// Pure visual playback. Never mutate persistent/logical fields (hp, inventory,
// door/chest/trap/altar flags, gold, xp) - those flow exclusively through
// turn_commit. Movement reuses the existing prevX/prevY/animT interpolation
// layer (the same one turn_commit reconciliation already drives), which is
// the minimal visual/logical split this codebase needs: confirmed x/y/hp is
// the logical state, prevX/prevY/animT is the visual state, for both players
// and (now) enemies.
function mpFx(text,x,y,color){if(game.seen?.[y]?.[x])floating(text,x,y,color)}
function mpFindOtherPlayer(pid){return (game.otherPlayers||[]).find(r=>String(r.pjId)===String(pid))}
// Companions aren't part of the synced entity model (no shared id other
// clients can resolve), so a target/attacker that is a companion has no
// visualizable reference and is skipped rather than guessed at.
function mpEntityRef(entity){
 if(!entity)return null;
 if(entity===game.player)return {type:'player',id:String(game.pjId)};
 if(entity.pjId!==undefined)return {type:'player',id:String(entity.pjId)};
 if(entity.eid!==undefined)return {type:'enemy',id:entity.eid};
 return null;
}
function mpFindEnemy(eid){return (game.enemies||[]).find(e=>e.eid===eid)}
function mpStartEntityAnim(entity,to){
 if(!entity)return;
 if(entity.x!==to.x||entity.y!==to.y){
  if(Math.abs(entity.x-to.x)+Math.abs(entity.y-to.y)<=4){entity.prevX=entity.x;entity.prevY=entity.y;entity.animT=0}
  entity.x=to.x;entity.y=to.y;
 }
 requestAnimationFrame(mpAnimateRemote);
}
function renderRemoteMove(action){
 const entity=action.entityType==='enemy'?mpFindEnemy(action.entityId):mpFindOtherPlayer(action.entityId);
 if(!entity||!action.to)return;
 mpStartEntityAnim(entity,action.to);
 if(action.entityType!=='enemy'&&action.direction)entity.facing=action.direction;
 draw();
}
function renderRemoteAttack(action){
 const target=action.targetType==='player'?(String(action.targetId)===String(game.pjId)?game.player:mpFindOtherPlayer(action.targetId)):mpFindEnemy(action.targetId);
 if(!target)return;
 const crit=action.result==='critical';
 const attacker=action.enemyId?mpFindEnemy(action.enemyId):action.attackerType==='player'?(String(action.attackerId)===String(game.pjId)?game.player:mpFindOtherPlayer(action.attackerId)):mpFindEnemy(action.attackerId);
 if(attacker&&Math.max(Math.abs(attacker.x-target.x),Math.abs(attacker.y-target.y))>1)rangedTracer(attacker.x,attacker.y,target.x,target.y,crit?'#ffd75c':'#9be8ff');
 mpFx(action.result==='evaded'?'EVITA':`${crit?'CRIT ':''}${typeof action.visualAmount==='number'?'-'+action.visualAmount:''}`,target.x,target.y,action.result==='evaded'?'#70dc9b':crit?'#ffd75c':'#ff8888');
 effect('flash');
 draw();
}
function renderRemoteSpell(action){
 const at=action.target||action.origin;if(!at)return;
 mpFx(action.icon||'✦',at.x,at.y,'#be82ff');
 effect('flash');
 draw();
}
function renderRemoteHeal(action){
 const target=action.targetId?(String(action.targetId)===String(game.pjId)?game.player:mpFindOtherPlayer(action.targetId)):null;
 const at=target||action.origin;if(!at)return;
 mpFx(typeof action.visualAmount==='number'?`+${action.visualAmount}`:'✚',at.x,at.y,'#8dffa8');
 draw();
}
function renderRemoteInteract(action){
 if(!action.at)return;
 mpFx(action.icon||'✦',action.at.x,action.at.y,'#ffd68b');
 draw();
}
function renderRemoteTrap(action){
 if(!action.at)return;
 mpFx('¡TRAMPA!',action.at.x,action.at.y,'#ff9d4f');
 effect('shake');
 draw();
}
function renderRemoteAltar(action){
 if(!action.at)return;
 mpFx('✦',action.at.x,action.at.y,'#9be8ff');
 draw();
}
function renderRemoteDeath(action){
 const at=action.at||(action.entityType==='enemy'?mpFindEnemy(action.entityId):null);
 if(!at)return;
 mpFx('💀',at.x,at.y,'#cfc7d8');
 draw();
}
function renderRemoteEnemyDeath(action){
 const e=mpFindEnemy(action.entityId);
 mpFx('💀',(e&&e.x)??action.at?.x,(e&&e.y)??action.at?.y,'#cfc7d8');
 draw();
}
function renderEnemyPhaseStart(){
 if(!game)return;
 game.mpEnemyPhaseRemote=true;
 if(!game.myTurn)mpSetMyTurn(false,'enemies');
}
function renderEnemyPhaseEnd(){
 if(!game)return;
 game.mpEnemyPhaseRemote=false;
}
function renderRemoteXpShare(action){
 game.mpXpGrantsApplied=game.mpXpGrantsApplied||new Set();
 if(!action.id||game.mpXpGrantsApplied.has(action.id))return; // dedup: never grant the same kill's share twice
 game.mpXpGrantsApplied.add(action.id);
 if(typeof action.amount==='number')grantXp(action.amount);
 updateUI();
}
// Unlike every other action renderer (pure visual sugar), this one deliberately
// mutates real state - the caster's client never has authority over the
// ally's hp/resource, so casting a heal ON an ally has no other channel to
// actually reach them. Applies only on the intended recipient's own client,
// and only once per cast (dedup, same pattern as xp_share).
function renderRemoteAllyHeal(action){
 if(String(action.targetId)!==String(game.pjId))return;
 game.mpHealGrantsApplied=game.mpHealGrantsApplied||new Set();
 if(!action.id||game.mpHealGrantsApplied.has(action.id))return;
 game.mpHealGrantsApplied.add(action.id);
 if(typeof action.hpAmount==='number')healEntity(game.player,action.hpAmount);
 if(typeof action.resAmount==='number'&&action.resType){const maxKey=action.resType==='mana'?'maxMana':'maxStamina';game.player[action.resType]=Math.min(game.player[maxKey],game.player[action.resType]+action.resAmount)}
 log('Un aliado te ha curado.','good');updateUI();
}
function renderFloorTransitionStart(){
 if(!game)return;
 game.mpFloorTransitioning=true;
 mpResetActionQueues(); // nothing queued for the old floor should survive into the new one
}
// Closed, explicit map: never dispatch a renderer by string lookup from
// unchecked network input beyond this table (no eval, no dynamic function names).
const MP_ACTION_RENDERERS={
 move:renderRemoteMove,
 attack:renderRemoteAttack,
 ranged_attack:renderRemoteAttack,
 spell:renderRemoteSpell,
 heal:renderRemoteHeal,
 use_item:renderRemoteHeal,
 interact:renderRemoteInteract,
 open_door:renderRemoteInteract,
 close_door:renderRemoteInteract,
 open_chest:renderRemoteInteract,
 pickup:renderRemoteInteract,
 trigger_trap:renderRemoteTrap,
 activate_altar:renderRemoteAltar,
 death_animation:renderRemoteDeath,
 enemy_move:renderRemoteMove,
 enemy_attack:renderRemoteAttack,
 enemy_spell:renderRemoteSpell,
 enemy_heal:renderRemoteHeal,
 enemy_death:renderRemoteEnemyDeath,
 xp_share:renderRemoteXpShare,
 ally_heal:renderRemoteAllyHeal,
 enemy_phase_start:renderEnemyPhaseStart,
 enemy_phase_end:renderEnemyPhaseEnd,
 floor_transition_start:renderFloorTransitionStart
};

// ---- Lifecycle ---------------------------------------------------------------
// Idempotent: safe to call more than once (leaving twice, dying then leaving,
// etc.) without throwing, and it must not let a stale callback from a
// previous session touch a new one.
function cleanupMultiplayerRuntime(){
 stopMpTradePolling();
 mpClearLiveTimers();
 mpRealtimeDisconnect();
 mpResetActionQueues();
 mpSetRealtimeStatus('idle');
}


// ---- Live turn sync (ephemeral, front-to-front) -----------------------------
// Turn authority no longer needs a DB round trip. A logical clock `seq` orders
// every turn transition, and a transition is only ever authored by the player
// who was active at the previous seq. A receiver accepts a `turn` message only
// when BOTH hold:
//   1. msg.seq === localSeq + 1   (no replays, no gaps, no reordering)
//   2. msg.author === turnOrder[localActiveIndex]  (only the active player may pass)
// Because exactly one client satisfies (2) for any given seq, two clients can
// never both believe it is their turn. Duplicates (seq <= localSeq) are
// dropped; gaps (seq > localSeq+1) trigger a resync instead of being applied.
// The DB is written only as a checkpoint (see MP_CHECKPOINT_EVERY).
const MP_CHECKPOINT_EVERY=10;      // full rounds between DB checkpoints
const MP_RESEND_MS=600;            // active player re-sends its transition until acked

function mpLive(){return !!(rtChannel&&rtReady&&game?.multiplayer&&String(rtChannelSessionId)===String(game.dungeonStatusId))}
function mpSend(event,payload){if(!mpLive())return false;try{rtChannel.send({type:'broadcast',event,payload});return true}catch(e){return false}}
function mpEnsureEnemyIds(){let n=0;for(const e of game.enemies||[]){if(e.eid===undefined)e.eid=`e${n}`;n++}}
function mpEnemyWire(){return (game.enemies||[]).map(e=>[e.eid,e.x,e.y,e.hp])}
function mpApplyEnemyWire(list){
 if(!Array.isArray(list))return;
 const byId=new Map((game.enemies||[]).map(e=>[e.eid,e]));
 const keep=[];
 for(const [eid,x,y,hp] of list){
  const e=byId.get(eid);
  if(!e)continue; // unknown enemy: the checkpoint/resync path will reconcile
  if(typeof hp==='number'&&hp<e.hp)floating(`-${e.hp-hp}`,e.x,e.y,'#ffd27a');
  // reconciliation: small position deltas animate the correction, large ones
  // snap - the same rule already used for other players (mpApplyLiveTurn)
  if((e.x!==x||e.y!==y)&&Math.abs(e.x-x)+Math.abs(e.y-y)<=4){e.prevX=e.x;e.prevY=e.y;e.animT=0;requestAnimationFrame(mpAnimateRemote)}
  e.x=x;e.y=y;if(typeof hp==='number')e.hp=hp;
  keep.push(e);
 }
 if(keep.length)game.enemies=keep; // enemies missing from the wire died
 game.boss=(game.enemies||[]).find(e=>e.boss)||null;
}
function mpTurnPayload(nextIdx){
 mpEnsureEnemyIds();
 return {
  protocolVersion:MP_PROTOCOL_VERSION,type:'turn_commit',
  seq:(game.mpSeq||0)+1,author:String(game.pjId),nextIdx,turn:game.turn||0,floor:game.floor,
  players:Object.fromEntries([[String(game.pjId),{x:game.player.x,y:game.player.y,facing:game.player.facing||1,hp:game.player.hp,maxHp:game.player.maxHp}],
   ...(game.otherPlayers||[]).map(p=>[String(p.pjId),{x:p.x,y:p.y,facing:p.facing,hp:p.hp,maxHp:p.maxHp}])]),
  enemies:mpEnemyWire(),
  doorsOpen:(game.doors||[]).filter(d=>d.open).map(d=>[d.x,d.y]),
  chestsOpened:(game.chests||[]).filter(c=>c.opened).map(c=>[c.x,c.y]),
  keysLeft:(game.keys||[]).map(k=>[k.x,k.y]),
  trapsHit:(game.traps||[]).filter(t=>t.sprung||t.revealed).map(t=>[t.x,t.y,t.sprung?1:0]),
  altarsUsed:(game.altars||[]).filter(a=>a.used).map(a=>[a.x,a.y]),
  objective:game.objective||null,
  actions:(game.mpTurnActions||[]).slice(-60),
  events:(game.mpPendingEvents||[]).slice(-6)
 };
}
// Called by the active player right after resolving its action (and the enemy
// phase). Publishes the transition live; the DB write is a separate concern.
function mpPublishTurn(nextIdx){
 const payload=mpTurnPayload(nextIdx);
 game.mpSeq=payload.seq;
 game.mpLastSent=payload;
 game.mpAckedBy=new Set();
 const eventId=`commit-${payload.author}-${payload.seq}`;
 mpTelemetryStart(eventId,{eventType:'turn_commit',sessionId:String(game.dungeonStatusId),author:payload.author,turnSeq:payload.seq,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
 mpTelemetryMark(eventId,'sentAt',{payloadBytes:mpPayloadBytes(payload)});
 mpSend('turn',payload);
 game.mpTurnActions=[];
 mpScheduleResend();
 return payload;
}
function mpScheduleResend(){
 clearTimeout(game.mpResendTimer);
 game.mpResendAttempts=0;
 const tick=()=>{
  if(!game?.multiplayer||!game.mpLastSent)return;
  const need=(game.turnOrder||[]).filter(id=>String(id)!==String(game.pjId)).length;
  if((game.mpAckedBy?.size||0)>=need)return;
  if((game.mpResendAttempts||0)>=5){
   // peer never acked: persist through the DB so their poll picks it up
   console.warn('turno sin confirmar por el otro jugador: guardando checkpoint');
   mpCheckpoint();
   return;
  }
  game.mpResendAttempts++;
  mpSend('turn',game.mpLastSent);
  game.mpResendTimer=setTimeout(tick,MP_RESEND_MS);
 };
 game.mpResendTimer=setTimeout(tick,MP_RESEND_MS);
}
function mpOnRemoteTurn(sessionId,p){
 if(!game?.multiplayer||game.over||String(game.dungeonStatusId)!==String(sessionId)||!p)return;
 // Unknown-newer protocol: can't safely interpret the payload shape, so ask
 // for a resync instead of silently misapplying it. No version at all means
 // a pre-protocol-versioning peer (or an old cached tab) - still accepted.
 if(p.protocolVersion!==undefined&&p.protocolVersion>MP_PROTOCOL_VERSION){mpReportError('protocol',new Error('turn_commit con protocolo más nuevo'),{ver:p.protocolVersion});mpRequestResync('protocol');return}
 if(String(p.author)===String(game.pjId))return;
 const seq=Number(p.seq)||0,local=game.mpSeq||0;
 const eventId=`commit-${p.author}-${seq}`;
 mpTelemetryStart(eventId,{eventType:'turn_commit',sessionId,author:String(p.author),turnSeq:seq,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
 mpTelemetryMark(eventId,'receivedAt');
 if(seq<=local){mpSend('ack',{seq,by:String(game.pjId)});return} // duplicate: re-ack and drop
 if(seq>local+1){mpRequestResync('gap');return}                  // gap: never apply out of order
 const expected=String((game.turnOrder||[])[game.activePlayerIndex||0]??'');
 if(expected&&String(p.author)!==expected){mpRequestResync('author');return} // not the active player
 game.mpSeq=seq;
 mpApplyLiveTurn(p);
 mpTelemetryMark(eventId,'appliedAt');
 mpSend('ack',{seq,by:String(game.pjId)});
 mpTelemetryMark(eventId,'renderedAt');
}
// Replays the author's recorded action sequence with pacing, then re-asserts
// the committed positions. Display-only: state was already applied by the commit.
function mpReplayTurnActions(p,{skipFinalSnap=false}={}){
 const acts=(p.actions||[]).filter(a=>MP_ACTION_RENDERERS[a.kind]);
 if(!acts.length)return;
 const lk=`${p.author||p.turnAuthor}|${p.seq}`;
 const seen=game.mpLiveSeen?.[lk]||0;
 if(game.mpLiveSeen)delete game.mpLiveSeen[lk];
 if(seen>=acts.length*.5)return; // already watched most of it live
 acts.forEach((a,i)=>setTimeout(()=>{if(!game?.multiplayer)return;try{MP_ACTION_RENDERERS[a.kind](a)}catch(e){}},i*140));
 if(skipFinalSnap)return; // caller already applied the authoritative state
 setTimeout(()=>{ // final snap back to the committed truth
  if(!game?.multiplayer)return;
  mpApplyEnemyWire(p.enemies);
  for(const [pid,pos] of Object.entries(p.players||{})){
   if(String(pid)===String(game.pjId))continue;
   const rp=(game.otherPlayers||[]).find(r=>String(r.pjId)===String(pid));
   if(rp){rp.x=pos.x;rp.y=pos.y;rp.animT=1}
  }
  draw();
 },acts.length*140+200);
}
function mpApplyLiveTurn(p){
 if(p.floor&&p.floor!==game.floor){mpRequestResync('floor');return} // floor change goes through the checkpoint
 // the round this commit closes is done: any queued ephemeral actions for it
 // (or older) are superseded by the confirmed state, and the enemy phase (if
 // any) has necessarily concluded by the time a commit lands
 mpPruneActionQueuesUpTo(game.mpSeq||0);
 game.mpEnemyPhaseRemote=false;
 game.mpFloorTransitioning=false;
 game.turn=p.turn??game.turn;
 for(const [pid,pos] of Object.entries(p.players||{})){
  if(String(pid)===String(game.pjId)){
   // only the enemy-phase resolver (nextIdx 0) is authoritative over my hp
   if(Number(p.nextIdx)===0&&typeof pos.hp==='number'&&pos.hp<game.player.hp){floating(`-${game.player.hp-pos.hp}`,game.player.x,game.player.y,'#ff8888');game.player.hp=Math.max(0,pos.hp)}
   continue;
  }
  const rp=(game.otherPlayers||[]).find(r=>String(r.pjId)===String(pid));
  if(!rp)continue;
  if(rp.x!==pos.x||rp.y!==pos.y){
   if(Math.abs(rp.x-pos.x)+Math.abs(rp.y-pos.y)<=3){rp.prevX=rp.x;rp.prevY=rp.y;rp.animT=0;requestAnimationFrame(mpAnimateRemote)}
   rp.x=pos.x;rp.y=pos.y;
  }
  rp.facing=pos.facing||rp.facing;
  if(typeof pos.hp==='number')rp.hp=pos.hp;
  if(typeof pos.maxHp==='number')rp.maxHp=pos.maxHp;
 }
 mpApplyEnemyWire(p.enemies);
 for(const [x,y] of p.doorsOpen||[]){const d=(game.doors||[]).find(d=>d.x===x&&d.y===y);if(d)d.open=true}
 for(const [x,y] of p.chestsOpened||[]){const c=(game.chests||[]).find(c=>c.x===x&&c.y===y);if(c)c.opened=true}
 if(Array.isArray(p.keysLeft))game.keys=(game.keys||[]).filter(k=>p.keysLeft.some(([x,y])=>x===k.x&&y===k.y));
 for(const [x,y,sprung] of p.trapsHit||[]){const t=(game.traps||[]).find(t=>t.x===x&&t.y===y);if(t){t.revealed=true;if(sprung)t.sprung=true}}
 for(const [x,y] of p.altarsUsed||[]){const a=(game.altars||[]).find(a=>a.x===x&&a.y===y);if(a)a.used=true}
 if(p.objective)game.objective=p.objective;
 for(const ev of p.events||[]){
  if(!ev?.m)continue;
  game.mpRecentEvents=game.mpRecentEvents||[];
  if(game.mpRecentEvents.includes(ev.m))continue;
  log(ev.m,ev.c||'combat');
  game.mpRecentEvents.push(ev.m);if(game.mpRecentEvents.length>12)game.mpRecentEvents.shift();
 }
 game.activePlayerIndex=Number(p.nextIdx)||0;
 if(game.player.hp<=0&&!game.over){game.player.hp=0;game.over=true;recomputeDerived();updateUI();draw();mpHandleDefeatWhileWaiting();return}
 recomputeDerived();
 mpSetMyTurn(String((game.turnOrder||[])[game.activePlayerIndex])===String(game.pjId));
 updateUI();draw();
 mpReplayTurnActions(p);
}
function mpOnAck(p){
 if(!game?.mpLastSent||Number(p?.seq)!==Number(game.mpLastSent.seq))return;
 game.mpAckedBy=game.mpAckedBy||new Set();
 game.mpAckedBy.add(String(p.by));
 const need=(game.turnOrder||[]).filter(id=>String(id)!==String(game.pjId)).length;
 if(game.mpAckedBy.size>=need)clearTimeout(game.mpResendTimer);
}
// Recovery: ask whoever holds a newer seq for a full live snapshot. Falls back
// to the DB checkpoint if nobody answers.
function mpRequestResync(reason){
 if(!game?.multiplayer)return;
 const now=Date.now();
 if(now-(game.mpLastResyncAt||0)<700)return;
 game.mpLastResyncAt=now;
 mpSend('need',{by:String(game.pjId),seq:game.mpSeq||0,reason});
 clearTimeout(game.mpResyncFallback);
 game.mpResyncFallback=setTimeout(()=>{if(game?.multiplayer&&!game.over)mpPollGameState()},900);
}
function mpOnNeed(p){
 if(!game?.multiplayer||!p||String(p.by)===String(game.pjId))return;
 if((game.mpSeq||0)<=(Number(p.seq)||0))return; // we are not ahead: nothing to offer
 mpSend('full',{seq:game.mpSeq||0,by:String(game.pjId),to:String(p.by),activeIdx:game.activePlayerIndex||0,turnOrder:game.turnOrder||[],state:mpTurnPayload(game.activePlayerIndex||0)});
}
function mpOnFull(p){
 if(!game?.multiplayer||!p||String(p.to)!==String(game.pjId))return;
 if(p.state?.protocolVersion!==undefined&&p.state.protocolVersion>MP_PROTOCOL_VERSION){mpReportError('protocol',new Error('full con protocolo más nuevo'),{ver:p.state.protocolVersion});return}
 const seq=Number(p.seq)||0;
 if(seq<=(game.mpSeq||0))return;
 if(Array.isArray(p.turnOrder)&&p.turnOrder.length)game.turnOrder=p.turnOrder;
 game.mpSeq=seq;
 const st=p.state||{};
 if(st.floor&&st.floor!==game.floor){mpPollGameState();return}
 mpApplyLiveTurn({...st,nextIdx:Number(p.activeIdx)||0,seq});
}
// If the player whose turn it is goes quiet (tab closed, lost packet), ask for
// a resync rather than stalling forever. Never grants a turn by itself.
function mpClearLiveTimers(){
 if(!game)return;
 clearTimeout(game.mpResendTimer);clearTimeout(game.mpResyncFallback);
 game.mpResendTimer=game.mpResyncFallback=null;
}
// Best-effort checkpoint when the tab goes away, so unsaved live turns are not
// lost. Uses keepalive + the rev CAS: if someone wrote more recently it simply
// loses, which is correct.
function mpFlushCheckpointBeacon(){
 if(!game?.multiplayer||!game.mpDirty||!game.dungeonStatusId||!game.mpStatusMirror)return;
 try{
  const st={...game.mpStatusMirror,turn:game.turn||0,currentFloor:game.floor,activePlayerIndex:game.activePlayerIndex||0,turnOrder:game.turnOrder||[],seq:game.mpSeq||0,rev:(game.mpLastRev||0)+1,
   players:{...(game.mpStatusMirror.players||{}),[game.pjId]:{x:game.player.x,y:game.player.y,floor:game.floor,facing:game.player.facing||1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre}},
   floors:{[game.floor]:{...(game.mpStatusMirror.floors?.[String(game.floor)]||{}),...floorSnapshotDynamic()}}};
  fetch(`/api/dungeon-status?id=${encodeURIComponent(game.dungeonStatusId)}`,{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_status:st,expectedRev:game.mpLastRev||0})});
  game.mpDirty=false;
 }catch(e){}
}
addEventListener('pagehide',mpFlushCheckpointBeacon);
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')mpFlushCheckpointBeacon()});
// ============================================================================
// MULTIPLAYER ITEM TRADE
// One active trade at a time per session, always between exactly two
// players. State lives in dungeon_status.trade and every mutation goes
// through the same rev-guarded CAS write already used for turns
// (mpSaveSession), so:
//  - a trade can only be proposed if none is currently open (mutate returns
//    null -> aborted, if fresh.trade already exists)
//  - the actual item swap can only ever be applied once per side, because
//    the write that flips trade.applied[me]=true only succeeds if the trade
//    is still the expected one, both sides are still accepted, and my side
//    had not already applied — exactly the same pattern that keeps turns
//    from crossing.
// Items stay in each player's own inventory (and keep persisting normally
// through the regular character save) until the swap is actually applied,
// so a reload or crash mid-trade never loses an item. While offered, an
// item is only soft-locked: isItemInMyTradeOffer() blocks equipping, using
// or auto-selling it, but it is never removed from game.inventory until the
// CAS-guarded apply step commits.
// ============================================================================
function mpTradeOtherId(t=game.mpTrade){if(!t)return null;return String(t.a)===String(game.pjId)?t.b:t.a}
function isItemInMyTradeOffer(id){return (game.mpTrade?.offers?.[String(game.pjId)]||[]).some(i=>i.id===id)}
function tradeableRoster(){
 const aliveIds=new Set((game.turnOrder||[]).map(String));
 return (game.roster||[]).filter(r=>String(r.pjId)!==String(game.pjId)&&aliveIds.has(String(r.pjId)));
}
function startMpTradePolling(){
 stopMpTradePolling();
 if(!game?.multiplayer)return;
 mpRefreshTrade();
 mpTradePollTimer=setInterval(mpRefreshTrade,rtReady?2500:1500);
}
function stopMpTradePolling(){
 if(mpTradePollTimer){clearInterval(mpTradePollTimer);mpTradePollTimer=null}
}
async function mpRefreshTrade(){
 if(!game?.multiplayer||!game.dungeonStatusId)return;
 try{
  const session=await dsGet(game.dungeonStatusId);
  const st=session?.dungeon_status;
  const rev=Number(st?.rev)||0;
  // mpSaveSession() trusts game.mpStatusMirror as a CAS fast-path whenever its rev
  // matches game.mpLastRev - but trade has its own polling loop, separate from the
  // main game-state poll that normally keeps that mirror fresh. Without this, once
  // the OTHER player accepts/applies the trade, checkAndApplyTrade() here would
  // silently keep reading a stale mirror forever (the "both accepted" check inside
  // its own mutate() would see outdated data and abort every time), so the trade
  // would never actually complete on this side.
  if(st&&rev>=(game.mpLastRev||0)){game.mpStatusMirror=st;game.mpLastRev=rev}
  applyIncomingTradeState(st?.trade||null);
 }catch(e){}
}
function mpOnRemoteTrade(sessionId){
 if(!game?.multiplayer||String(game.dungeonStatusId)!==String(sessionId))return;
 mpRefreshTrade();
}
function applyIncomingTradeState(t){
 if(!game?.multiplayer)return;
 const involvesMe=t&&(String(t.a)===String(game.pjId)||String(t.b)===String(game.pjId));
 const next=involvesMe?t:null;
 const isNewProposal=next&&next.id!==game.mpTradeSeenId&&String(next.a)!==String(game.pjId);
 game.mpTrade=next;
 if(isNewProposal){
  game.mpTradeSeenId=next.id;
  const meta=(game.roster||[]).find(r=>String(r.pjId)===String(next.a));
  banner('PROPUESTA DE INTERCAMBIO');
  log(`${meta?.pjName||'Otro jugador'} te propone un intercambio.`,'sys');
 }
 renderTradeTab();
 checkAndApplyTrade();
}
async function proposeTrade(otherPjId){
 if(!game?.multiplayer||!game.dungeonStatusId)return;
 if(game.mpTrade){alert('Ya hay un intercambio en curso.');return}
 const id=crypto.randomUUID(),a=String(game.pjId),b=String(otherPjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  if(fresh.trade)return null; // someone else proposed one first
  return {dungeon_status:{...fresh,trade:{id,a,b,offers:{[a]:[],[b]:[]},accepted:{[a]:false,[b]:false},applied:{},createdAt:Date.now()}}};
 });
 if(!saved){alert('No se pudo proponer el intercambio (puede que ya haya uno en curso).');return}
 game.mpTradeSeenId=id;
 applyIncomingTradeState(saved.status.trade);
 mpSend('trade',{});
}
async function cancelTrade(){
 const t=game.mpTrade;if(!t)return;
 await mpSaveSession(game.dungeonStatusId,fresh=>{
  if(!fresh.trade||fresh.trade.id!==t.id)return null; // already resolved/cancelled elsewhere
  return {dungeon_status:{...fresh,trade:null}};
 });
 game.mpTrade=null;renderTradeTab();mpSend('trade',{});
}
async function addToTradeOffer(itemId){
 const t=game.mpTrade;if(!t)return;
 const item=game.inventory.find(i=>i.id===itemId);if(!item)return;
 const me=String(game.pjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  const ft=fresh.trade;if(!ft||ft.id!==t.id)return null;
  const mine=ft.offers?.[me]||[];
  if(mine.some(i=>i.id===itemId))return null;
  const offers={...ft.offers,[me]:[...mine,{...item}]};
  // any change to the deal invalidates both prior acceptances
  return {dungeon_status:{...fresh,trade:{...ft,offers,accepted:{[ft.a]:false,[ft.b]:false}}}};
 });
 if(!saved)return;
 applyIncomingTradeState(saved.status.trade);
 updateUI();mpSend('trade',{});
}
async function removeFromTradeOffer(itemId){
 const t=game.mpTrade;if(!t)return;
 const me=String(game.pjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  const ft=fresh.trade;if(!ft||ft.id!==t.id)return null;
  const mine=(ft.offers?.[me]||[]).filter(i=>i.id!==itemId);
  const offers={...ft.offers,[me]:mine};
  return {dungeon_status:{...fresh,trade:{...ft,offers,accepted:{[ft.a]:false,[ft.b]:false}}}};
 });
 if(!saved)return;
 applyIncomingTradeState(saved.status.trade);
 updateUI();mpSend('trade',{});
}
async function setTradeAccept(accept){
 const t=game.mpTrade;if(!t)return;
 const me=String(game.pjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  const ft=fresh.trade;if(!ft||ft.id!==t.id)return null;
  return {dungeon_status:{...fresh,trade:{...ft,accepted:{...ft.accepted,[me]:accept}}}};
 });
 if(!saved)return;
 applyIncomingTradeState(saved.status.trade);
 mpSend('trade',{});
}
// Executes the swap exactly once. The write that records my half of the
// completion only succeeds if the trade is still the one I think it is, both
// sides are still accepted, and I had not already applied it — so my
// inventory is only ever touched AFTER that write has committed. A peer who
// never comes back to observe the acceptance simply delays completion on
// their own side; it can never duplicate or destroy an item.
let mpTradeApplying=false;
async function checkAndApplyTrade(){
 const t=game.mpTrade;if(!t||mpTradeApplying)return;
 const me=String(game.pjId);
 if(!t.accepted?.[t.a]||!t.accepted?.[t.b])return;
 if(t.applied?.[me])return;
 mpTradeApplying=true;
 try{
  let capturedOffers=null;
  const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
   const ft=fresh.trade;
   if(!ft||ft.id!==t.id||!ft.accepted?.[ft.a]||!ft.accepted?.[ft.b]||ft.applied?.[me])return null;
   capturedOffers=ft.offers;
   const applied={...(ft.applied||{}),[me]:true};
   const bothDone=applied[ft.a]&&applied[ft.b];
   return {dungeon_status:{...fresh,trade:bothDone?null:{...ft,applied}}};
  });
  if(!saved||!capturedOffers)return;
  const otherId=mpTradeOtherId(t);
  const myOfferedIds=new Set((capturedOffers[me]||[]).map(i=>i.id));
  game.inventory=(game.inventory||[]).filter(i=>!myOfferedIds.has(i.id));
  for(const raw of capturedOffers[String(otherId)]||[]){
   const item={...raw,id:crypto.randomUUID()};
   addInventoryItem(item);lootToast(item);
  }
  game.mpTrade=saved.status.trade||null;
  log('Intercambio completado.','loot');banner('INTERCAMBIO COMPLETADO');
  recomputeDerived();updateUI();draw();renderTradeTab();
  // persist immediately: the given/received items must survive a reload right away
  const bundle=characterBundleFromGame();
  fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})}).catch(e=>console.error('No se pudo guardar el personaje tras el intercambio',e));
  mpSend('trade',{});
 }finally{mpTradeApplying=false}
}
function renderTradeTab(){
 const btn=document.querySelector('[data-tab="trade"]'),root=document.getElementById('trade');
 if(!btn||!root)return;
 if(!game?.multiplayer){
  btn.classList.add('hidden');
  if(btn.classList.contains('active'))document.querySelector('[data-tab="inventory"]')?.click();
  return;
 }
 btn.classList.remove('hidden');
 const t=game.mpTrade;
 if(!t){
  const others=tradeableRoster();
  root.innerHTML=others.length?
   `<p class="small">Elige con quién comerciar.</p>${others.map(r=>`<div class="worldCard"><b>${r.pjName}</b><span class="small">${r.nombre||''} · Nivel ${r.level||1}</span><button type="button" data-trade-propose="${r.pjId}">Proponer intercambio</button></div>`).join('')}`:
   '<p class="small">No hay otros jugadores vivos con quien comerciar.</p>';
  root.querySelectorAll('[data-trade-propose]').forEach(b=>b.onclick=()=>proposeTrade(b.dataset.tradePropose));
  return;
 }
 const me=String(game.pjId),otherId=mpTradeOtherId(t),otherMeta=(game.roster||[]).find(r=>String(r.pjId)===String(otherId));
 const myOffer=t.offers?.[me]||[],otherOffer=t.offers?.[String(otherId)]||[];
 const myAccepted=!!t.accepted?.[me],otherAccepted=!!t.accepted?.[otherId];
 const available=(game.inventory||[]).filter(i=>!myOffer.some(o=>o.id===i.id));
 const offeredRow=(i,removable)=>`<div class="item tradeItem"><canvas class="itemThumb" width="40" height="40" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}${i.quantity>1?` x${i.quantity}`:''}</b><span class="itemLevel">${i.type==='potion'?'Poción':(slotNames[i.slot]||i.slot)} · Nivel ${i.itemLevel||1}</span></div>${removable?`<button type="button" data-trade-remove="${i.id}">Quitar</button>`:''}</div>`;
 const availRow=i=>`<div class="item tradeItem"><canvas class="itemThumb" width="40" height="40" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}${i.quantity>1?` x${i.quantity}`:''}</b><span class="itemLevel">${i.type==='potion'?'Poción':(slotNames[i.slot]||i.slot)}</span></div><button type="button" data-trade-add="${i.id}">Ofrecer</button></div>`;
 root.innerHTML=`
  <div class="tradePanel">
   <h4>Intercambio con ${otherMeta?.pjName||'jugador'}</h4>
   <div class="tradeColumns">
    <div class="tradeCol"><b>Tu oferta ${myAccepted?'✓':''}</b>${myOffer.length?myOffer.map(i=>offeredRow(i,!myAccepted)).join(''):'<p class="small">Vacía.</p>'}</div>
    <div class="tradeCol"><b>Oferta de ${otherMeta?.pjName||'jugador'} ${otherAccepted?'✓':''}</b>${otherOffer.length?otherOffer.map(i=>offeredRow(i,false)).join(''):'<p class="small">Vacía.</p>'}</div>
   </div>
   ${!myAccepted?`<h4>Añadir de tu mochila</h4><div class="tradeAvailable">${available.length?available.map(availRow).join(''):'<p class="small">Sin objetos disponibles.</p>'}</div>`:''}
   <div class="tradeActions">
    <button type="button" id="tradeAcceptBtn">${myAccepted?'Retirar aceptación':'Aceptar intercambio'}</button>
    <button type="button" id="tradeCancelBtn">Cancelar intercambio</button>
   </div>
  </div>`;
 root.querySelectorAll('[data-item]').forEach(c=>{const it=[...myOffer,...otherOffer,...available].find(x=>x.id===c.dataset.item);if(it)drawItemIcon(c,it)});
 root.querySelectorAll('[data-trade-add]').forEach(b=>b.onclick=()=>addToTradeOffer(b.dataset.tradeAdd));
 root.querySelectorAll('[data-trade-remove]').forEach(b=>b.onclick=()=>removeFromTradeOffer(b.dataset.tradeRemove));
 document.getElementById('tradeAcceptBtn').onclick=()=>setTradeAccept(!myAccepted);
 document.getElementById('tradeCancelBtn').onclick=()=>cancelTrade();
}

function mpOnRemoteBroadcast(sessionId,payload){
 const st=payload?.status,rev=Number(payload?.rev)||0;
 if(!st||!rev)return;
 if(game?.multiplayer&&String(game.dungeonStatusId)===String(sessionId)){
  if(game.over||game.mpEnemyPhase)return; // safety net poll catches up afterwards
  if(rev<=(game.mpLastRev||0))return;
  // slim broadcasts drop the static floor layout; on a floor change we need it,
  // so fetch the full row instead of applying the slim copy
  const remoteFloor=st.currentFloor||1;
  if(st.slimFloors&&remoteFloor!==game.floor&&!(st.floors?.[String(remoteFloor)]?.map)){mpForceFullSync();return}
  game.mpLastRev=rev;
  mpApplyRemoteState(st);
 }else if(String(mpLobbySessionId||'')===String(sessionId)&&!game){
  refreshMpLobby();
 }
}
async function mpForceFullSync(){
 if(!game?.multiplayer||!game.dungeonStatusId||mpPollBusy)return;
 mpPollBusy=true;
 try{
  const session=await dsGet(game.dungeonStatusId);
  const st=session?.dungeon_status||{};
  const rev=Number(st.rev)||0;
  if(rev<=(game.mpLastRev||0))return;
  game.mpLastRev=rev;
  mpApplyRemoteState(st);
 }catch(e){console.error('mp full sync error',e)}
 finally{mpPollBusy=false}
}
function mpAdjustPollInterval(){
 if(!game?.multiplayer||!mpGamePollTimer)return;
 clearInterval(mpGamePollTimer);
 mpGamePollTimer=setInterval(mpPollGameState,rtReady?6000:400);
}
// -----------------------------------------------------------------------------

// Todas las escrituras de dungeon_status pasan por aquí: se relee el estado más
// reciente, `mutate` construye el siguiente estado a partir de ESE estado fresco
// (nunca de una copia local desfasada) y se escribe con concurrencia optimista
// (columna dungeon_status->>rev). Si otro cliente escribió mientras tanto, la API
// devuelve 409 y reintentamos desde una lectura nueva. Esto evita que un cliente
// pise con datos viejos el turno/posición que otro acaba de guardar.
async function mpSaveSession(id,mutate,{retries=6}={}){
 if(!id)return null;
 for(let attempt=0;attempt<retries;attempt++){
  let session,fresh;
  // fast path (first attempt only): reuse the last applied state instead of
  // re-reading. The rev CAS below still rejects the write if it was stale.
  const mirror=game?.mpStatusMirror;
  if(attempt===0&&game&&String(id)===String(game.dungeonStatusId)&&mirror&&(Number(mirror.rev)||0)===(game.mpLastRev||0)){
   fresh=mirror;
   session={id,dungeon_status:mirror};
  }else{
   try{
    session=await dsGet(id);
    if(!session)return null;
   }catch(e){console.error('No se pudo leer la sesión multijugador',e);return null}
   fresh=session.dungeon_status||{};
  }
  const rev=Number(fresh.rev)||0;
  const result=mutate(fresh,session);
  if(!result)return null;
  const nextStatus={...result.dungeon_status,rev:rev+1};
  const row={dungeon_status:nextStatus};
  if(result.players_ID!==undefined)row.players_ID=result.players_ID;
  try{
   const pr=await dsPatch(id,row,rev,attempt===0);
   if(pr.conflict){await new Promise(res=>setTimeout(res,60+Math.random()*120));continue}
   if(!pr.ok){console.error('No se pudo guardar la sesión multijugador',pr.data);return null}
   if(game&&String(id)===String(game.dungeonStatusId)){
    game.mpLastRev=Math.max(game.mpLastRev||0,nextStatus.rev);
    game.mpStatusMirror=nextStatus;
   }
   mpBroadcastState(id,nextStatus);
   return {session,status:nextStatus};
  }catch(e){console.error('No se pudo guardar la sesión multijugador',e);await new Promise(res=>setTimeout(res,120))}
 }
 console.error('No se pudo guardar el estado multijugador: demasiados conflictos de turno.');
 return null;
}

async function mpJoinSession(sessionId,pj){
 try{
  let startedFlag=false;
  const saved=await mpSaveSession(sessionId,(st,session)=>{
   startedFlag=!!st.started;
   let ids=[];try{ids=JSON.parse(session.players_ID||'[]')}catch(e){}
   if(!ids.map(String).includes(String(pj.id)))ids.push(pj.id);
   const roster=st.roster||[];
   if(!roster.some(r=>String(r.pjId)===String(pj.id)))roster.push({pjId:pj.id,nombre:window.currentUser.nombre,pjName:pj.pj_name,className:pj.pj_json?.player?.className,level:pj.pj_json?.player?.level||1});
   const turnOrder=st.turnOrder||[];
   if(!turnOrder.map(String).includes(String(pj.id)))turnOrder.push(pj.id);
   const next={...st,roster,turnOrder};
   if(st.started){
    const hostId=st.host,hostPos=st.players?.[String(hostId)],floorNum=st.currentFloor||1,overlay=st.floors?.[String(floorNum)];
    const base=hostPos||selectedDungeonWorld?.world_json?.floors?.[floorNum-1]?.spawn||{x:0,y:0};
    const occupied=Object.values(st.players||{}).map(p=>`${p.x},${p.y}`);
    const spawn=mpFreeSpawnNear(overlay?.map,overlay?.enemies,occupied,base);
    next.players={...st.players,[pj.id]:{x:spawn.x,y:spawn.y,floor:floorNum,facing:1,hp:pj.pj_json?.player?.hp,maxHp:pj.pj_json?.player?.maxHp,cls:pj.pj_json?.player?.cls,classIcon:pj.pj_json?.player?.classIcon,name:pj.pj_json?.player?.name,nombre:window.currentUser.nombre}};
   }
   return {dungeon_status:next,players_ID:JSON.stringify(ids)};
  });
  if(!saved)throw new Error('No se pudo unir a la sesión, inténtalo de nuevo.');
  currentCharacter=pj;
  if(startedFlag){multiplayerOverlay.classList.add('hidden');mpEnterStartedSession({id:sessionId,dungeon_world_id:saved.session.dungeon_world_id,dungeon_status:saved.status})}
  else openMpLobby(sessionId,false);
 }catch(e){alert('Error al unirte: '+e.message)}
}

function openMpLobby(sessionId,isHost,resuming=false){
 mpLobbySessionId=sessionId;
 mpLobbyResuming=resuming;
 stopMultiHeartbeat();
 mpRealtimeConnect(sessionId);
 multiplayerOverlay.classList.add('hidden');
 mpLobbyOverlay.classList.remove('hidden');
 document.getElementById('mpStartGameBtn').classList.toggle('hidden',!isHost);
 document.getElementById('mpStartGameBtn').textContent=resuming?'CONTINUAR PARTIDA':'INICIAR PARTIDA';
 document.getElementById('mpLobbyWaitMsg').classList.toggle('hidden',isHost);
 refreshMpLobby();
 if(mpLobbyPollTimer)clearInterval(mpLobbyPollTimer);
 mpLobbyPollTimer=setInterval(refreshMpLobby,2000);
}
async function refreshMpLobby(){
 if(!mpLobbySessionId)return;
 try{
  const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(mpLobbySessionId)}`);
  const session=await r.json();if(!r.ok)throw new Error(session.error||'Sesión no encontrada');
  const st=session.dungeon_status||{};
  const ready=st.resumeReady||{};
  document.getElementById('mpLobbyWorldLabel').textContent=`Mundo #${session.dungeon_world_id}`;
  document.getElementById('mpLobbyRoster').innerHTML=(st.roster||[]).map(r=>`<div class="worldCard"><b>${r.pjName}</b><span>${r.nombre} · ${r.className||''} nivel ${r.level||1}</span>${mpLobbyResuming?`<small>${ready[r.pjId]?'✓ Listo':'Esperando...'}</small>`:''}</div>`).join('');
  const allReady=!mpLobbyResuming||(st.roster||[]).every(r=>ready[r.pjId]);
  document.getElementById('mpStartGameBtn').disabled=!allReady;
  if(!mpLobbyResuming&&st.started){
   // brand-new session: auto-enter joiners the moment the host presses start
   if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
   mpLobbyOverlay.classList.add('hidden');
   mpEnterStartedSession(session);
  }
 }catch(e){console.error(e)}
}

// starter=true: the host is starting the game. The dungeon (floor 1 snapshot +
// spawn positions for the WHOLE roster) is generated and written in the SAME
// atomic write that sets started:true, so joiners always find a complete floor.
async function mpEnterStartedSession(session,starter=false){
 try{
  stopMultiHeartbeat();
  if(!configItems.length)fetchConfigItems();if(!configChests.length)fetchConfigChests();if(!configClasses.length)fetchConfigClasses();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();
  await mpRealtimeConnect(session.id);
  const worldRes=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(session.dungeon_world_id)}`);
  const world=await worldRes.json();if(!worldRes.ok)throw new Error(world.error||world.message||'No se pudieron cargar los mundos');
  if(!world)throw new Error('El mundo de esta sesión ya no existe.');
  selectedDungeonWorld=world;
  const pj=currentCharacter;
  const bundle=pj.pj_json||{};
  let st=session.dungeon_status||{};
  const floorNum=starter?1:(st.currentFloor||1);
  game={floor:floorNum,themeIndex:0,turn:st.turn||0,dungeonWorldId:world.id,dungeonWorldName:world.world_name,worldParams:normalizeWorldParams(world.world_json?.params),inventory:bundle.inventory||[],achievements:bundle.achievements||{},bossesKilled:bundle.bossesKilled||0,chestsOpened:bundle.chestsOpened||0,maxFloorReached:bundle.maxFloorReached||1,player:bundle.player,pjId:pj.id,dungeonStatusId:session.id,sessionFloors:st.floors||{},multiplayer:true,turnOrder:st.turnOrder||[pj.id],activePlayerIndex:starter?0:(st.activePlayerIndex||0),hostId:st.host,roster:st.roster||[],mpLastRev:Number(st.rev)||0,mpLastEvSeq:st.evSeq||0,mpPendingEvents:[],mpSeq:Number(st.seq)||0,mpCheckpointTurn:st.turn||0,mpCheckpointFloor:starter?1:(st.currentFloor||1)};
  app.classList.remove('hidden');
  if(starter){
   if(!loadPrecomputedFloor())generateFloor();
   game.floorEventRolled=true;
   // deterministic spawn cluster in turn order, host first
   const order=(st.turnOrder&&st.turnOrder.length)?st.turnOrder:[pj.id];
   const others=(st.roster||[]).filter(r=>String(r.pjId)!==String(pj.id));
   const metas=await Promise.all(others.map(async r=>{try{const res=await fetch(`/api/user-pj?id=${encodeURIComponent(r.pjId)}`);const row=await res.json();return res.ok?row:null}catch(e){return null}}));
   const base={x:game.player.x,y:game.player.y},players={},occupied=[];
   for(const id of order){
    const spot=mpFreeSpawnNear(game.map,game.enemies,occupied,base);
    occupied.push(`${spot.x},${spot.y}`);
    if(String(id)===String(pj.id)){
     game.player.x=spot.x;game.player.y=spot.y;
     players[id]={x:spot.x,y:spot.y,floor:1,facing:1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre};
    }else{
     const row=metas.find(m=>m&&String(m.id)===String(id)),rp=row?.pj_json?.player||{};
     players[id]={x:spot.x,y:spot.y,floor:1,facing:1,hp:rp.hp??rp.maxHp??1,maxHp:rp.maxHp??1,cls:rp.cls,classIcon:rp.classIcon,name:rp.name||row?.pj_name,nombre:row?.nombre};
    }
   }
   const snap=floorSnapshot();
   const saved=await mpSaveSession(session.id,fresh=>({dungeon_status:{...fresh,multiplayer:true,started:true,currentFloor:1,turn:0,activePlayerIndex:0,floors:{1:snap},players,evSeq:0,events:[]}}));
   if(!saved)throw new Error('No se pudo iniciar la partida, inténtalo de nuevo.');
   st=saved.status;
   game.turnOrder=st.turnOrder||game.turnOrder;game.roster=st.roster||game.roster;
  }else{
   // joiners render the floor exclusively from the shared snapshot; wait for it if needed
   let overlay=st.floors?.[String(game.floor)]||null;
   for(let i=0;i<8&&!(overlay&&overlay.map);i++){
    await new Promise(res=>setTimeout(res,500));
    try{
     const s2=await dsGet(session.id);
     if(s2?.dungeon_status){st=s2.dungeon_status;game.floor=st.currentFloor||1;game.turn=st.turn||0;game.turnOrder=st.turnOrder||game.turnOrder;game.activePlayerIndex=st.activePlayerIndex||0;game.roster=st.roster||game.roster;game.mpLastRev=Number(st.rev)||0;game.mpLastEvSeq=st.evSeq||0;overlay=st.floors?.[String(game.floor)]||null}
    }catch(e){}
   }
   if(overlay&&overlay.map)applyFloorSnapshot(overlay);
   else{game.floorEventRolled=true;if(!loadPrecomputedFloor())throw new Error('El anfitrión todavía no ha generado la mazmorra. Vuelve a intentarlo en unos segundos.')}
   const pos=st.players?.[String(pj.id)];
   if(pos&&(pos.floor||game.floor)===game.floor){
    game.player.x=pos.x;game.player.y=pos.y;game.player.facing=pos.facing||game.player.facing;
   }else{
    const hostPos=st.players?.[String(st.host)];
    const base=hostPos||selectedDungeonWorld?.world_json?.floors?.[game.floor-1]?.spawn||{x:game.player.x,y:game.player.y};
    const occupied=Object.values(st.players||{}).map(p=>`${p.x},${p.y}`);
    const spawn=mpFreeSpawnNear(game.map,game.enemies,occupied,base);
    game.player.x=spawn.x;game.player.y=spawn.y;game.player.facing=1;
    // publish only my position so others see me immediately (no floor/turn touch)
    const myEntry={x:spawn.x,y:spawn.y,floor:game.floor,facing:1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre};
    await mpSaveSession(session.id,fresh=>({dungeon_status:{...fresh,players:{...fresh.players,[pj.id]:myEntry}}}));
   }
  }
  anim.heroX=anim.targetX=game.player.x;anim.heroY=anim.targetY=game.player.y;anim.t=1;reveal(game.player.x,game.player.y);
  if(!game.mpStatusMirror)game.mpStatusMirror=st;
  mpSyncRealtimeStatusToGame();mpUpdateConnBadge(); // the connect above ran before `game` existed; stamp it now
  mpSyncOtherPlayers(st);
  recomputeDerived();updateUI();draw();
  mpSetMyTurn(String((game.turnOrder||[])[game.activePlayerIndex||0])===String(game.pjId));
  if(mpGamePollTimer)clearInterval(mpGamePollTimer);
  mpGamePollTimer=setInterval(mpPollGameState,rtReady?6000:400);
  mpEnsureEnemyIds();
  game.mpTrade=null;game.mpTradeSeenId=null;startMpTradePolling();
   banner(`PARTIDA MULTIJUGADOR · PISO ${game.floor}`);
 }catch(e){game=null;app.classList.add('hidden');multiplayerOverlay.classList.remove('hidden');startMultiHeartbeat();alert('Error al entrar en la partida: '+e.message)}
}

function mpSyncOtherPlayers(st){
 const players=st.players||{};
 const prev=new Map((game.otherPlayers||[]).map(p=>[String(p.pjId),p]));
 let moved=false;
 game.otherPlayers=Object.entries(players).filter(([pid,pos])=>String(pid)!==String(game.pjId)&&(pos.floor||st.currentFloor||1)===game.floor).map(([pid,pos])=>{
  const meta=(game.roster||[]).find(r=>String(r.pjId)===String(pid))||{};
  const rp={pjId:pid,x:pos.x,y:pos.y,floor:pos.floor,facing:pos.facing||1,hp:pos.hp??1,maxHp:pos.maxHp??1,name:pos.name||meta.pjName||'Jugador',nombre:pos.nombre||meta.nombre,cls:pos.cls,classIcon:pos.classIcon,equipment:{},animT:1};
  const old=prev.get(String(pid));
  if(old&&(old.x!==pos.x||old.y!==pos.y)&&Math.abs(old.x-pos.x)+Math.abs(old.y-pos.y)<=3){rp.prevX=old.x;rp.prevY=old.y;rp.animT=0;moved=true}
  return rp;
 });
 if(moved)requestAnimationFrame(mpAnimateRemote);
}
function mpAnimateRemote(){
 if(!game)return;
 let more=false;
 for(const rp of game.otherPlayers||[])if((rp.animT??1)<1){rp.animT=Math.min(1,rp.animT+.15);if(rp.animT<1)more=true}
 for(const e of game.enemies||[])if((e.animT??1)<1){e.animT=Math.min(1,e.animT+.15);if(e.animT<1)more=true}
 draw();
 if(more)requestAnimationFrame(mpAnimateRemote);
}

function mpSetMyTurn(isMine,phase){
 game.myTurn=isMine;
 game.mpCapture=isMine;
 busy=!isMine;
 if(isMine){mpResetActionSeq();startPlayerAP();game.mpTurnActions=[]} // fresh actionSeq + points + recorder
 const el=document.getElementById('mpTurnIndicator');
 if(el){
  el.classList.remove('hidden');
  el.classList.toggle('myTurn',isMine);
  if(isMine)el.textContent='¡ES TU TURNO!';
  else if(phase==='enemies'||game.mpEnemyPhaseRemote)el.textContent='Turno de los enemigos...';
  else{
   const activeId=game.turnOrder?.[game.activePlayerIndex||0];
   const meta=(game.roster||[]).find(r=>String(r.pjId)===String(activeId));
   const who=meta?(meta.nombre?`${meta.nombre} (${meta.pjName})`:meta.pjName):'otro jugador';
   el.textContent=`Esperando a ${who}...`;
  }
 }
 updateUI();
}

// High-frequency light poll: only refetch the full state when rev changed.
// Stale responses (rev <= last applied) are discarded, which is what used to
// cause crossed turns: an in-flight old read re-granting an already-passed turn.
async function mpPollGameState(){
 if(!game?.multiplayer||!game.dungeonStatusId||game.over||mpPollBusy||game.mpEnemyPhase)return;
 mpPollBusy=true;
 try{
  const id=game.dungeonStatusId;
  const liteRev=await dsGetRev(id);
  if(liteRev===null||liteRev<=(game.mpLastRev||0))return;
  const session=await dsGet(id);
  if(!session)return;
  const st=session.dungeon_status||{};
  const rev=Number(st.rev)||0;
  if(rev<=(game.mpLastRev||0))return;
  game.mpLastRev=rev;
  mpApplyRemoteState(st);
 }catch(e){console.error('poll multiplayer error',e)}
 finally{mpPollBusy=false}
}

function mpApplyRemoteState(st){
 if(st.slimFloors){st={...st};delete st.slimFloors}
 game.mpStatusMirror=st;
 // A DB checkpoint is only authoritative over the live channel when it is not
 // behind it. An older checkpoint (seq < local seq) may refresh the map/floor
 // but must never move the turn pointer back — that is what would cross turns.
 const stSeq=Number(st.seq)||0,localSeq=game.mpSeq||0;
 const turnAuthoritative=!mpLive()||stSeq>=localSeq;
 game.turnOrder=st.turnOrder&&st.turnOrder.length?st.turnOrder:game.turnOrder;
 game.roster=st.roster||game.roster;
 if(turnAuthoritative){
  game.activePlayerIndex=st.activePlayerIndex||0;
  game.turn=st.turn??game.turn;
  if(stSeq>localSeq){game.mpSeq=stSeq;mpPruneActionQueuesUpTo(stSeq);game.mpEnemyPhaseRemote=false}
 }
 game.sessionFloors=st.floors||game.sessionFloors;
 const remoteFloor=st.currentFloor||1;
 const overlay=st.floors?.[String(remoteFloor)];
 const myPos=st.players?.[String(game.pjId)];
 if(remoteFloor!==game.floor){
  // another player descended: the whole party moves to the new floor, and any
  // visual actions still queued for the old floor must never be replayed here
  mpResetActionQueues();
  game.floor=remoteFloor;
  game.floorEventRolled=true;
  game.mpFloorTransitioning=false;
  if(overlay&&overlay.map)applyFloorSnapshot(overlay);
  else loadPrecomputedFloor();
  const pos=(myPos&&(myPos.floor||remoteFloor)===remoteFloor)?myPos:(selectedDungeonWorld?.world_json?.floors?.[remoteFloor-1]?.spawn||{x:game.player.x,y:game.player.y});
  game.player.x=pos.x;game.player.y=pos.y;
  anim.heroX=anim.targetX=pos.x;anim.heroY=anim.targetY=pos.y;anim.t=1;
  reveal(pos.x,pos.y);
  banner(`PISO ${game.floor}`);
 }else if(overlay&&!game.myTurn){
  game.enemies=overlay.enemies||game.enemies;
  game.chests=overlay.chests||game.chests;
  game.doors=overlay.doors||game.doors;
  game.keys=overlay.keys||game.keys;
  game.companions=overlay.companions||game.companions;
  game.skillObjects=overlay.skillObjects||game.skillObjects;
  game.traps=overlay.traps||game.traps;
  game.altars=overlay.altars||game.altars;
  if(overlay.objective)game.objective=overlay.objective;
  game.boss=(game.enemies||[]).find(e=>e.boss)||null;
  if(overlay.seen&&overlay.seen.length){
   const remoteSeen=decodeSeen(overlay.seen);
   for(let y=0;y<remoteSeen.length;y++)for(let x=0;x<remoteSeen[y].length;x++)if(remoteSeen[y][x]&&game.seen[y])game.seen[y][x]=true;
  }
 }
 mpSyncOtherPlayers(st);
 if(myPos&&typeof myPos.hp==='number'&&!game.myTurn){
  if(myPos.hp<=0&&game.player.hp>0){game.player.hp=0;game.over=true;updateUI();draw();mpHandleDefeatWhileWaiting();return}
  if(myPos.hp>0&&myPos.hp!==game.player.hp){
   const diff=myPos.hp-game.player.hp;
   game.player.hp=Math.min(game.player.maxHp,myPos.hp);
   if(diff<0)floating(`${diff}`,game.player.x,game.player.y,'#ff8888');
  }
 }
 // replay combat events authored by the active client
 for(const ev of st.events||[])if((ev.i||0)>(game.mpLastEvSeq||0)){if(!(game.mpRecentEvents||[]).includes(ev.m))log(ev.m,ev.c||'combat');game.mpLastEvSeq=ev.i}
 // fallback (non-Realtime) path: replay the recorded action sequence too,
 // since this checkpoint is the only way this client ever sees the turn
 if(turnAuthoritative&&remoteFloor===game.floor&&st.actions?.length)mpReplayTurnActions(st,{skipFinalSnap:true});
 if(turnAuthoritative){
  const amIActive=String((game.turnOrder||[])[game.activePlayerIndex||0])===String(game.pjId);
  mpSetMyTurn(amIActive);
  }
 recomputeDerived();updateUI();draw();
}

function mpHandleDefeatWhileWaiting(){
 if(mpGamePollTimer){clearInterval(mpGamePollTimer);mpGamePollTimer=null}
 stopMpTradePolling();
 mpClearLiveTimers();
 finalizeCharacterDeath();
 storyTitle.textContent='HAS CAÍDO';
 storyBody.innerHTML='<div class="narrative gameOverBox"><p class="gameOverName"><b>Tu personaje ha muerto en la partida multijugador.</b></p></div>';
 storyOverlay.classList.remove('hidden');
}

// advance: soy el jugador activo y acabo de terminar mi acción -> avanzar el
//   turno (calculado siempre sobre el turnOrder/activePlayerIndex FRESCOS del
//   servidor, nunca sobre la copia local, que es la causa de que un cliente
//   "pisara" el turno recién avanzado por el otro).
// includeOtherPlayers: solo lo marca el cliente que acaba de resolver
//   enemyTurn() (el único momento en el que es autoritativo sobre el daño
//   recibido por los demás); solo actualiza su HP, nunca su posición, que
//   siempre se toma del estado fresco.
async function mpPersistTurnState({advance=false,includeOtherPlayers=false,checkpoint=false}={}){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 game.maxFloorReached=bundle.maxFloorReached;
 // throttle the character save: every 3rd turn, on floor change or when hurt
 // badly, instead of every action (it competed with turn sync on the uplink)
 game.mpPjSaveCounter=(game.mpPjSaveCounter||0)+1;
 if(!game.multiplayer||game.mpPjSaveCounter%3===1||game.floor!==game.mpPjLastSavedFloor||game.player.hp<=game.player.maxHp*.35){
  game.mpPjLastSavedFloor=game.floor;
  fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})}).catch(e=>console.error('No se pudo guardar el personaje',e));
 }
 if(!game.dungeonStatusId)return;
 const floorSnap=floorSnapshot(),dynSnap=floorSnapshotDynamic();
 const myPos={x:game.player.x,y:game.player.y,floor:game.floor,facing:game.player.facing||1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre};
 const hpUpdates={};
 if(includeOtherPlayers)for(const op of game.otherPlayers||[])hpUpdates[op.pjId]={hp:op.hp,maxHp:op.maxHp};
 const events=(game.mpPendingEvents||[]).splice(0);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  let turnOrder=(fresh.turnOrder&&fresh.turnOrder.length)?fresh.turnOrder:(game.turnOrder||[game.pjId]);
  let turn=checkpoint?(game.turn||0):(fresh.turn||0);
  const wasActiveId=String(turnOrder[fresh.activePlayerIndex||0]??'');
  const players={...fresh.players,[game.pjId]:myPos};
  for(const [pid,upd] of Object.entries(hpUpdates)){
   const base=players[pid];
   if(base)players[pid]={...base,...upd};
  }
  // floor changed by me: relocate the whole party to the new floor spawn cluster
  const floorChanged=(fresh.currentFloor||1)!==game.floor;
  if(floorChanged){
   const occupied=[`${myPos.x},${myPos.y}`];
   for(const pid of Object.keys(players)){
    if(String(pid)===String(game.pjId))continue;
    const spot=mpFreeSpawnNear(game.map,game.enemies,occupied,{x:myPos.x,y:myPos.y});
    occupied.push(`${spot.x},${spot.y}`);
    players[pid]={...players[pid],x:spot.x,y:spot.y,floor:game.floor,facing:1};
   }
  }
  // dead players leave the turn order
  turnOrder=turnOrder.filter(id=>{const p=players[String(id)];return !p||typeof p.hp!=='number'||p.hp>0});
  if(!turnOrder.length)turnOrder=[game.pjId];
  let activePlayerIndex;
  if(checkpoint){
   // live mode: the channel already decided whose turn it is; the checkpoint
   // only records it (guarded by seq so an older checkpoint can never win)
   const idx=turnOrder.findIndex(id=>String(id)===String((game.turnOrder||[])[game.activePlayerIndex||0]));
   activePlayerIndex=idx===-1?(game.activePlayerIndex||0):idx;
   if(activePlayerIndex>=turnOrder.length)activePlayerIndex=0;
  }else if(advance&&(wasActiveId===String(game.pjId)||!wasActiveId)){
   // only the active player may advance the turn pointer (prevents crossed turns)
   const myIdx=turnOrder.findIndex(id=>String(id)===String(game.pjId));
   const isLast=myIdx===-1||myIdx===turnOrder.length-1;
   activePlayerIndex=isLast?0:myIdx+1;
   if(isLast)turn=(fresh.turn||0)+1;
  }else{
   const idx=turnOrder.findIndex(id=>String(id)===wasActiveId);
   activePlayerIndex=idx===-1?0:idx;
  }
  const evSeq=fresh.evSeq||0;
  const outEvents=events.length?((fresh.events||[]).concat(events.map((e,i)=>({...e,i:evSeq+i+1}))).slice(-12)):(fresh.events||[]);
  const roster=(fresh.roster&&fresh.roster.length)?fresh.roster:(game.roster||[]);
  // same floor: merge dynamic state over the stored static layout (much smaller write)
  const prevSnap=fresh.floors?.[String(game.floor)];
  const outSnap=(!floorChanged&&prevSnap&&prevSnap.map)?{...prevSnap,...dynSnap}:floorSnap;
  const seq=Math.max(Number(fresh.seq)||0,game.mpSeq||0);
  // carried so the fallback (non-Realtime) receiver can also replay the
  // sequence instead of only ever seeing the final snapshot
  const actions=(game.mpTurnActions||[]).slice(-60);
  return {dungeon_status:{...fresh,multiplayer:true,started:true,host:fresh.host||game.hostId,hostUser:fresh.hostUser||(roster.find(r=>String(r.pjId)===String(fresh.host||game.hostId))?.nombre),roster,turnOrder,activePlayerIndex,turn,currentFloor:game.floor,floors:{[game.floor]:outSnap},players,evSeq:evSeq+events.length,events:outEvents,seq,actions,turnAuthor:String(game.pjId)}};
 });
 if(advance&&saved)game.mpTurnActions=[]; // this write committed the turn: start recording fresh
 if(saved){
  const written=saved.status;
  game.turnOrder=written.turnOrder||game.turnOrder;
  game.activePlayerIndex=written.activePlayerIndex??game.activePlayerIndex;
  game.turn=written.turn??game.turn;
  game.roster=written.roster||game.roster;
  game.sessionFloors=written.floors||game.sessionFloors;
  game.mpLastEvSeq=Math.max(game.mpLastEvSeq||0,written.evSeq||0);
  mpSyncOtherPlayers(written);
 }}

async function mpOpenContinueList(){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Cargando tus sesiones multijugador...';list.innerHTML='';
 try{
  const chars=await fetchMyCharacters();
  const myIds=new Set(chars.map(c=>String(c.id)));
  const r=await fetch('/api/dungeon-status?light=1');const sessions=await r.json();
  if(!r.ok)throw new Error(sessions.error||sessions.message||'No se pudieron cargar sesiones');
  const mine=sessions.filter(s=>{if(!s.dungeon_status?.multiplayer)return false;try{return (JSON.parse(s.players_ID||'[]')||[]).some(id=>myIds.has(String(id)))}catch(e){return false}});
  if(!mine.length){status.textContent='No tienes sesiones multijugador propias.';return}
  status.textContent=`${mine.length} sesión(es).`;
  list.innerHTML=mine.map(s=>{const st=s.dungeon_status||{};const names=(st.roster||[]).map(r=>r.pjName).join(', ');return `<button type="button" class="worldCard" data-mp-session="${s.id}"><b>${st.hostUser||'Sesión'}</b><span>${st.started?'En curso':'Sala de espera'} · Piso ${st.currentFloor||1}</span><small>${names}</small></button>`}).join('');
  list.querySelectorAll('[data-mp-session]').forEach(btn=>btn.onclick=()=>mpResumeSession(btn.dataset.mpSession,chars));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function mpResumeSession(sessionId,chars){
 try{
  const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(sessionId)}`);
  const session=await r.json();if(!r.ok)throw new Error(session.error||'No se pudo cargar la sesión');
  const st=session.dungeon_status||{};
  let ids=[];try{ids=JSON.parse(session.players_ID||'[]')}catch(e){}
  const myChar=chars.find(c=>ids.map(String).includes(String(c.id)));
  if(!myChar)throw new Error('No participas en esta sesión.');
  if(myChar.pj_status!=='alive')throw new Error('Tu personaje en esta sesión ya no está vivo.');
  currentCharacter=myChar;
  const isHost=String(st.host)===String(myChar.id);
  if(st.started){
   // resuming an already-started session: wait in the lobby for every party
   // member to come back online instead of barging straight into the dungeon
   // solo, so both players enter together
   await mpSaveSession(sessionId,fresh=>({dungeon_status:{...fresh,resumeReady:{...(fresh.resumeReady||{}),[myChar.id]:true}}}));
   openMpLobby(sessionId,isHost,true);
  }else openMpLobby(sessionId,isHost);
 }catch(e){alert('Error al continuar la sesión: '+e.message)}
}

menuMultiBtn.onclick=enterMultiplayerScreen;
document.getElementById('backFromMultiplayerBtn').onclick=leaveMultiplayerScreen;
document.getElementById('mpCreateBtn').onclick=mpStartCreateFlow;
document.getElementById('mpContinueBtn').onclick=mpOpenContinueList;
document.getElementById('mpStartGameBtn').onclick=async()=>{
 try{
  // the dungeon is generated and written BEFORE started:true becomes visible to joiners
  const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(mpLobbySessionId)}`);
  const session=await r.json();if(!r.ok)throw new Error(session.error||'Sesión no encontrada');
  if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
  mpLobbyOverlay.classList.add('hidden');
  // resuming an already-started session must NOT regenerate floor 1 (starter=true
  // is only for a brand-new session's very first launch)
  await mpEnterStartedSession(session,!mpLobbyResuming);
 }catch(e){alert('Error al iniciar: '+e.message)}
};
document.getElementById('backFromLobbyBtn').onclick=()=>{
 if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
 mpLobbySessionId=null;
 cleanupMultiplayerRuntime();
 mpLobbyOverlay.classList.add('hidden');
 multiplayerOverlay.classList.remove('hidden');
 refreshOpenSessions();
 startMultiHeartbeat();
};

document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const[x,y]=b.dataset.move.split(',').map(Number);move(x,y)});waitBtn.onclick=()=>{if(waitBtn.dataset.rest==='1')restInSafeRoom();else playerFinished()};cancelTargetBtn.onclick=()=>cancelTargeting();zoomVisibleTiles.oninput=e=>setVisibleTiles(e.target.value);setVisibleTiles(visibleTiles);startBtn.onclick=start;createWorldBtn.onclick=createDungeonWorld;document.getElementById('disenchantCloseBtn')?.addEventListener('click',()=>document.getElementById('disenchantOverlay')?.classList.add('hidden'));
document.querySelectorAll('.craftTabBtn').forEach(b=>b.addEventListener('click',()=>switchCraftTab(b.dataset.craftTab)));
const enterConfig=()=>{landingOverlay.classList.add('hidden');configScreen.classList.remove('hidden');setupConfigTabs();setupConfigMode();setupClassConfigMode();setupTilesetConfigMode();setupEnemyConfigMode();setupChestConfigMode();setupConfigWorldObjectsMode();fetchConfigItems();fetchConfigClasses();fetchConfigFloors();fetchEnemyConfig();fetchConfigChests();setupWorldSettings()};
menuScoresBtn.onclick=()=>{landingOverlay.classList.add('hidden');scoresScreen.classList.remove('hidden');fetchScores()};
document.getElementById('backFromScoresBtn').onclick=()=>{scoresScreen.classList.add('hidden');landingOverlay.classList.remove('hidden')};
menuSingleBtn.onclick=openSinglePlayerScreen;
document.getElementById('backFromSingleBtn').onclick=closeSinglePlayerScreen;
document.getElementById('spSelectCharBtn').onclick=openCharacterSelection;
document.getElementById('spNewCharBtn').onclick=openCharacterCreation;
document.getElementById('spContinueBtn').onclick=openSessionContinue;
menuConfigBtn.onclick=()=>{if(!window.currentUser?.admin){alert('Solo administradores pueden acceder a Configurar.');return}enterConfig()};
loginForm.onsubmit=async e=>{e.preventDefault();loginBtn.disabled=true;loginStatus.textContent='Entrando...';try{const r=await fetch('/api/user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:loginName.value,pass:loginPass.value})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo iniciar sesión');window.currentUser=data;try{localStorage.setItem('mazmorraUser',JSON.stringify(data))}catch(err){}loginStatus.textContent=`Sesión iniciada: ${data.nombre}${data.admin?' · admin':''}`;mainMenuActions.classList.remove('hidden');loginForm.classList.add('hidden')}catch(err){loginStatus.textContent=err.message}finally{loginBtn.disabled=false}};
backToLandingBtn.onclick=()=>{configScreen.classList.add('hidden');landingOverlay.classList.remove('hidden');mainMenuActions.classList.remove('hidden');loginForm.classList.add('hidden')};



function renderRaceChoices(){
 const root=document.getElementById('raceChoices');
 root.innerHTML=Object.entries(raceDefs).map(([id,r])=>`<div class="choice ${id===selectedRace?'selected':''}" data-race="${id}"><b>${r.name}</b><p class="small">${r.desc}</p><span class="raceTag">${r.origin}</span><p class="small"><strong>Rasgo:</strong> ${r.trait}</p></div>`).join('');
 root.querySelectorAll('[data-race]').forEach(el=>el.onclick=()=>{selectedRace=el.dataset.race;renderRaceChoices()});
}
renderRaceChoices();

// Advanced eligibility is the explicit config_class.advanced flag (set by
// saveConfigClass whenever a class is saved from the editor) - not whether
// the classId happens to collide with a hardcoded one, since a class can be
// a deliberate reskin/rename of a hardcoded class (same classId, different
// name/stats/skills) and still be meant purely for Advanced mode.
function classIdsForSkillMode(mode){
 if(mode==='advanced'){
  const ids=new Set();
  for(const row of configClasses){const cid=row.class_json?.classId;if(cid&&row.advanced===true)ids.add(cid)}
  return [...ids];
 }
 return Object.keys(classDefs);
}
function renderClassChoices(){
 const root=document.getElementById('classChoices'),ids=classIdsForSkillMode(selectedSkillMode);
 if(!ids.length){
  if(selectedSkillMode==='advanced'&&!configClassesLoaded){
   root.innerHTML='<p class="small">Cargando clases Advanced desde la base de datos...</p>';
   document.getElementById('classDetail').innerHTML='';
   fetchConfigClasses();
   return;
  }
  root.innerHTML='<p class="small">No hay clases Advanced configuradas todavía. Créalas en Configuración → Clases, o vuelve a Hardcode.</p>';
  document.getElementById('classDetail').innerHTML='';
  return;
 }
 if(!ids.includes(selectedClass))selectedClass=ids[0];
 root.innerHTML=ids.map(id=>{const c=resolveClassDef(id);return `<div class="classCard ${id===selectedClass?'selected':''}" data-class="${id}"><canvas width="64" height="64" data-class-preview="${id}"></canvas><div class="classCopy"><b>${c.name}</b><span class="small">${c.desc}</span><div class="classStats">FUE ${c.stats.strength} · VIT ${c.stats.vitality} · AGI ${c.stats.agility} · SUE ${c.stats.luck} · INT ${c.stats.intelligence} · SAB ${c.stats.wisdom}</div></div></div>`}).join('');
 root.querySelectorAll('[data-class-preview]').forEach(c=>drawClassPreview(c,c.dataset.classPreview));
 root.querySelectorAll('[data-class]').forEach(el=>el.onclick=()=>{selectedClass=el.dataset.class;renderClassChoices()});
 const c=resolveClassDef(selectedClass);document.getElementById('classDetail').innerHTML=`<b>${c.name}</b><p>${c.desc}</p><p class="small">Al entrar elegirás una habilidad de Tier I. Después elegirás más en niveles 3, 5, 10, 15, 20, 30 y 40.</p>`;
}
renderClassChoices();
document.getElementById('skillModeHardcode')?.addEventListener('change',()=>{selectedSkillMode='hardcode';renderClassChoices()});
document.getElementById('skillModeAdvanced')?.addEventListener('change',()=>{selectedSkillMode='advanced';renderClassChoices()});
document.getElementById('combatModeClassic')?.addEventListener('change',()=>{selectedCombatMode='classic'});
document.getElementById('combatModeAp')?.addEventListener('change',()=>{selectedCombatMode='ap'});


document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.tabview').forEach(x=>x.classList.add('hidden'));document.getElementById(b.dataset.tab).classList.remove('hidden')});
function isTypingTarget(el){return ['INPUT','TEXTAREA','SELECT'].includes(el?.tagName)||el?.isContentEditable}
addEventListener('keydown',e=>{if(isTypingTarget(e.target)||!configScreen.classList.contains('hidden'))return;const k=e.key.toLowerCase(),m={arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]};if(k==='escape'&&pendingTargetAction){cancelTargeting();return}if(m[k]){e.preventDefault();if(!pendingTargetAction)move(...m[k]);return}if('1234'.includes(k)){e.preventDefault();useSkill(Number(k)-1);return}if(k==='a'){e.preventDefault();beginBasicAttack()}if(k==='e'){e.preventDefault();waitBtn.click()}});


document.getElementById('game').addEventListener('click',ev=>{
 const canvas=ev.currentTarget,rect=canvas.getBoundingClientRect(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
 const pxX=(ev.clientX-rect.left)*scaleX,pxY=(ev.clientY-rect.top)*scaleY;
 const c=camera(),gx=c.x+Math.floor(pxX/TILE),gy=c.y+Math.floor(pxY/TILE);
 if(pendingTargetAction){
  if(pendingTargetAction.kind==='skill')resolveTargetedSkill(pendingTargetAction.slot,gx,gy);
  else resolveBasicAttack(gx,gy);
  return
 }
 showInspect(inspectedEntityAt(gx,gy),ev.clientX,ev.clientY)
});
document.getElementById('closeInspect')?.addEventListener('click',closeInspect);
document.getElementById('hudEquipment')?.addEventListener('click',()=>{showTab('equipment')});
document.getElementById('hudSkills')?.addEventListener('click',()=>{showTab('skills')});
document.getElementById('hudMap')?.addEventListener('click',()=>{const w=document.getElementById('minimapWrap');w.classList.toggle('minimapHidden');document.getElementById('hudMap').textContent=w.classList.contains('minimapHidden')?'🗺':'✕'});
