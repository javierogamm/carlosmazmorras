const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const gameCanvasWrap=document.getElementById('gameStage');
ctx.imageSmoothingEnabled=false;
const TILE=64,COLS=70,ROWS=70,VIEW=10;
let game=null,busy=false,anim={heroX:0,heroY:0,targetX:0,targetY:0,t:1};
let selectedClass='yunque';
let selectedRace='humano';
let selectedDungeonWorld=null;
const APP_VERSION='0.28.0';
let configItems=[];
const tierDefs={common:{label:'Común',color:'#ddd'},uncommon:{label:'Infrecuente',color:'#75e39d'},rare:{label:'Raro',color:'#71b4ff'},epic:{label:'Épico',color:'#d68cff'},legendary:{label:'Legendario',color:'#ffb746'},artifact:{label:'Artefacto',color:'#ff5bd6'}};
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
 {name:'artifact',label:'Artefacto',weight:.6,color:'#ff5bd6',affixes:[6,7],passives:1,effects:1,mult:2.65}
];

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
 yunque_t1_1:{"name": "Martillazo Sísmico", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "yunque", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 yunque_t1_2:{"name": "Muralla Viviente", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "yunque", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 yunque_t1_3:{"name": "Ancla de Acero", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "yunque", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 yunque_t1_4:{"name": "Contraataque de Bastión", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "yunque", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 yunque_t2_1:{"name": "Carga del Coloso", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "yunque", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 yunque_t2_2:{"name": "Piel de Fortaleza", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "yunque", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 yunque_t2_3:{"name": "Cadena Demoledora", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "yunque", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 yunque_t2_4:{"name": "Rugido del Yunque", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "yunque", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 yunque_t3_1:{"name": "Ciudadela Ambulante", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "yunque", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 yunque_t3_2:{"name": "Juicio de Hierro", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "yunque", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 yunque_t3_3:{"name": "Corazón Inquebrantable", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "yunque", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 yunque_t3_4:{"name": "Cataclismo del Bastión", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "yunque", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 berserker_t1_1:{"name": "Cuchillada de Neón", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "berserker", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 berserker_t1_2:{"name": "Frenesí Callejero", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "berserker", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 berserker_t1_3:{"name": "Salto Rabioso", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "berserker", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 berserker_t1_4:{"name": "Sangre por Combustible", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "berserker", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 berserker_t2_1:{"name": "Torbellino Magenta", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "berserker", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 berserker_t2_2:{"name": "Implante Sobrecargado", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "berserker", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 berserker_t2_3:{"name": "Aullido de Guerra", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "berserker", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 berserker_t2_4:{"name": "Desgarro de Cromo", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "berserker", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 berserker_t3_1:{"name": "Apocalipsis Rosa", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "berserker", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 berserker_t3_2:{"name": "Última Sobrecarga", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "berserker", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 berserker_t3_3:{"name": "Rabia Inmortal", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "berserker", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 berserker_t3_4:{"name": "Carnicería de Neón", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "berserker", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 necromancer_t1_1:{"name": "Perno Funerario", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "necromancer", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 necromancer_t1_2:{"name": "Esqueleto de Datos", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "necromancer", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 necromancer_t1_3:{"name": "Marca Cadavérica", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "necromancer", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 necromancer_t1_4:{"name": "Drenaje de Memoria", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "necromancer", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 necromancer_t2_1:{"name": "Explosión de Restos", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "necromancer", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 necromancer_t2_2:{"name": "Muro de Huesos", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "necromancer", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 necromancer_t2_3:{"name": "Legión Corrupta", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "necromancer", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 necromancer_t2_4:{"name": "Peste Binaria", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "necromancer", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 necromancer_t3_1:{"name": "Reinicio de Cadáver", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "necromancer", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 necromancer_t3_2:{"name": "Trono del Archiliche", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "necromancer", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 necromancer_t3_3:{"name": "Cosecha de Almas", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "necromancer", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 necromancer_t3_4:{"name": "Apagón de los Muertos", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "necromancer", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 paladin_t1_1:{"name": "Golpe Radiante", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "paladin", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 paladin_t1_2:{"name": "Escudo de Firmware", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "paladin", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 paladin_t1_3:{"name": "Rezo de Combate", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "paladin", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 paladin_t1_4:{"name": "Sello de Protección", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "paladin", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 paladin_t2_1:{"name": "Lanza Solar", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "paladin", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 paladin_t2_2:{"name": "Aura de Valor", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "paladin", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 paladin_t2_3:{"name": "Juicio Compilado", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "paladin", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 paladin_t2_4:{"name": "Milagro de Emergencia", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "paladin", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 paladin_t3_1:{"name": "Cruzada de Circuitos", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "paladin", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 paladin_t3_2:{"name": "Resurrección Parcial", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "paladin", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 paladin_t3_3:{"name": "Bastión Sagrado", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "paladin", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 paladin_t3_4:{"name": "Veredicto Celestial", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "paladin", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 jester_t1_1:{"name": "Carta Cortante", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "jester", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 jester_t1_2:{"name": "Broma Cruel", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "jester", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 jester_t1_3:{"name": "Paso de Bufón", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "jester", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 jester_t1_4:{"name": "Dado Trucado", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "jester", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 jester_t2_1:{"name": "Confeti Explosivo", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "jester", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 jester_t2_2:{"name": "Risa Contagiosa", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "jester", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 jester_t2_3:{"name": "Sombrero Infinito", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "jester", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 jester_t2_4:{"name": "Cambio de Papeles", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "jester", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 jester_t3_1:{"name": "Gran Chiste Final", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "jester", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 jester_t3_2:{"name": "Ruleta del Vacío", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "jester", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 jester_t3_3:{"name": "Ovación Mortal", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "jester", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 jester_t3_4:{"name": "Caos de Camerino", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "jester", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 sniper_t1_1:{"name": "Disparo Rúnico", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "sniper", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 sniper_t1_2:{"name": "Paso del Tirador", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "sniper", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 sniper_t1_3:{"name": "Marca de Presa", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "sniper", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 sniper_t1_4:{"name": "Ojo de Halcón", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "sniper", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 sniper_t2_1:{"name": "Flecha Perforante", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "sniper", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 sniper_t2_2:{"name": "Trampa de Cazador", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "sniper", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 sniper_t2_3:{"name": "Descarga Gemela", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "sniper", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 sniper_t2_4:{"name": "Camuflaje Rúnico", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "sniper", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 sniper_t3_1:{"name": "Tiro a Través del Mundo", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "sniper", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 sniper_t3_2:{"name": "Lluvia de Flechas", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "sniper", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 sniper_t3_3:{"name": "Ejecución Perfecta", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "sniper", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 sniper_t3_4:{"name": "Horizonte Partido", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "sniper", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 shaman_t1_1:{"name": "Chispa Espiritual", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "shaman", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 shaman_t1_2:{"name": "Tótem Menor", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "shaman", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 shaman_t1_3:{"name": "Voz del Trueno", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "shaman", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 shaman_t1_4:{"name": "Piel de Tormenta", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "shaman", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 shaman_t2_1:{"name": "Cadena de Relámpagos", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "shaman", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 shaman_t2_2:{"name": "Tótem Sanador", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "shaman", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 shaman_t2_3:{"name": "Paso del Viento", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "shaman", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 shaman_t2_4:{"name": "Maldición Estática", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "shaman", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 shaman_t3_1:{"name": "Tempestad Ancestral", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "shaman", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 shaman_t3_2:{"name": "Avatar del Rayo", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "shaman", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 shaman_t3_3:{"name": "Consejo de Espíritus", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "shaman", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 shaman_t3_4:{"name": "Cielo Quebrado", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "shaman", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 thief_t1_1:{"name": "Daga de Fase", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "thief", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 thief_t1_2:{"name": "Humo Cuántico", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "thief", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 thief_t1_3:{"name": "Paso Trasero", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "thief", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 thief_t1_4:{"name": "Dedos Ligeros", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "thief", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 thief_t2_1:{"name": "Corte Imposible", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "thief", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 thief_t2_2:{"name": "Bomba de Sombra", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "thief", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 thief_t2_3:{"name": "Robo de Energía", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "thief", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 thief_t2_4:{"name": "Duplicado Fantasma", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "thief", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 thief_t3_1:{"name": "Atraco Temporal", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "thief", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 thief_t3_2:{"name": "Evasión Absoluta", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "thief", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 thief_t3_3:{"name": "Mil Cortes", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "thief", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 thief_t3_4:{"name": "Desaparición Cuántica", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "thief", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 cleric_t1_1:{"name": "Luz Reparadora", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "cleric", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 cleric_t1_2:{"name": "Maza Bendita", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "cleric", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 cleric_t1_3:{"name": "Barrera Piadosa", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "cleric", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 cleric_t1_4:{"name": "Cántico Breve", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "cleric", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 cleric_t2_1:{"name": "Rayo de Silicio", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "cleric", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 cleric_t2_2:{"name": "Purga de Corrupción", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "cleric", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 cleric_t2_3:{"name": "Santuario Portátil", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "cleric", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 cleric_t2_4:{"name": "Manos del Servidor", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "cleric", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 cleric_t3_1:{"name": "Resurrección de Emergencia", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "cleric", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 cleric_t3_2:{"name": "Diluvio Sagrado", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "cleric", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 cleric_t3_3:{"name": "Avatar del Templo", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "cleric", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 cleric_t3_4:{"name": "Juicio del Dios Roto", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "cleric", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 entropyMage_t1_1:{"name": "Dardo Entrópico", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "entropyMage", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 entropyMage_t1_2:{"name": "Escudo Inestable", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "entropyMage", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 entropyMage_t1_3:{"name": "Paso Improbable", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "entropyMage", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 entropyMage_t1_4:{"name": "Desgaste Acelerado", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "entropyMage", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 entropyMage_t2_1:{"name": "Onda de Ruina", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "entropyMage", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 entropyMage_t2_2:{"name": "Colapso Local", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "entropyMage", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 entropyMage_t2_3:{"name": "Robo de Tiempo", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "entropyMage", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 entropyMage_t2_4:{"name": "Campo de Decadencia", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "entropyMage", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 entropyMage_t3_1:{"name": "Fin Estadístico", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "entropyMage", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 entropyMage_t3_2:{"name": "Agujero de Entropía", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "entropyMage", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 entropyMage_t3_3:{"name": "Deshacer Realidad", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "entropyMage", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 entropyMage_t3_4:{"name": "Muerte Térmica", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "entropyMage", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 bountyHunter_t1_1:{"name": "Tiro de Contrato", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "bountyHunter", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 bountyHunter_t1_2:{"name": "Red Magnética", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "bountyHunter", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 bountyHunter_t1_3:{"name": "Impulso de Cadera", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "bountyHunter", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 bountyHunter_t1_4:{"name": "Marca de Recompensa", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "bountyHunter", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 bountyHunter_t2_1:{"name": "Granada Rastreadora", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "bountyHunter", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 bountyHunter_t2_2:{"name": "Doble Disparo", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "bountyHunter", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 bountyHunter_t2_3:{"name": "Blindaje Mercenario", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "bountyHunter", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 bountyHunter_t2_4:{"name": "Cobro Anticipado", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "bountyHunter", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 bountyHunter_t3_1:{"name": "Caza Total", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "bountyHunter", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 bountyHunter_t3_2:{"name": "Misil de Bolsillo", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "bountyHunter", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 bountyHunter_t3_3:{"name": "Sentencia del Contrato", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "bountyHunter", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 bountyHunter_t3_4:{"name": "Nadie Escapa", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "bountyHunter", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 druid_t1_1:{"name": "Espina de Chatarra", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "druid", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 druid_t1_2:{"name": "Corteza Reforzada", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "druid", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 druid_t1_3:{"name": "Raíz Enredadora", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "druid", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 druid_t1_4:{"name": "Brote Curativo", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "druid", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 druid_t2_1:{"name": "Enjambre Metálico", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "druid", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 druid_t2_2:{"name": "Forma de Bestia", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "druid", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 druid_t2_3:{"name": "Bosque Improvisado", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "druid", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 druid_t2_4:{"name": "Polen Tóxico", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "druid", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 druid_t3_1:{"name": "Avatar del Chatarral", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "druid", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 druid_t3_2:{"name": "Raíces del Mundo", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "druid", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 druid_t3_3:{"name": "Manada Aumentada", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "druid", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 druid_t3_4:{"name": "Primavera Radiactiva", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "druid", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 monk_t1_1:{"name": "Puño del Instante", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "monk", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 monk_t1_2:{"name": "Paso Circular", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "monk", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 monk_t1_3:{"name": "Respiración Serena", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "monk", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 monk_t1_4:{"name": "Patada Repetida", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "monk", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 monk_t2_1:{"name": "Eco del Golpe", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "monk", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 monk_t2_2:{"name": "Bucle Defensivo", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "monk", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 monk_t2_3:{"name": "Palma del Segundo Perdido", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "monk", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 monk_t2_4:{"name": "Meditación Acelerada", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "monk", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 monk_t3_1:{"name": "Mil Puños Simultáneos", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "monk", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 monk_t3_2:{"name": "Detener el Turno", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "monk", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 monk_t3_3:{"name": "Regreso al Instante", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "monk", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 monk_t3_4:{"name": "Rueda Infinita", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "monk", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 engineer_t1_1:{"name": "Pistola Alquímica", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "engineer", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 engineer_t1_2:{"name": "Torreta de Bolsillo", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "engineer", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 engineer_t1_3:{"name": "Mina Improvisada", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "engineer", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 engineer_t1_4:{"name": "Dron Reparador", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "engineer", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 engineer_t2_1:{"name": "Lanzallamas Casero", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "engineer", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 engineer_t2_2:{"name": "Campo Magnético", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "engineer", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 engineer_t2_3:{"name": "Autómata de Guerra", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "engineer", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 engineer_t2_4:{"name": "Cóctel Transmutador", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "engineer", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 engineer_t3_1:{"name": "Fábrica Instantánea", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "engineer", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 engineer_t3_2:{"name": "Cañón de Singularidad", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "engineer", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 engineer_t3_3:{"name": "Ejército Mecánico", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "engineer", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 engineer_t3_4:{"name": "Reactor Prohibido", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "engineer", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 seer_t1_1:{"name": "Aguja Psíquica", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 15, "type": "magic", "rarity": "common", "range": 8, "classId": "seer", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 seer_t1_2:{"name": "Visión Cercana", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "seer", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 seer_t1_3:{"name": "Paso Predicho", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 19, "type": "magic", "rarity": "common", "range": 5, "classId": "seer", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 seer_t1_4:{"name": "Mal Augurio", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "mana", "cost": 21, "type": "magic", "rarity": "common", "range": 0, "classId": "seer", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 seer_t2_1:{"name": "Rayo del Futuro", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 22, "type": "magic", "rarity": "rare", "range": 0, "classId": "seer", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 seer_t2_2:{"name": "Espejo de Posibilidades", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "seer", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 seer_t2_3:{"name": "Destino Torcido", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 26, "type": "magic", "rarity": "rare", "range": 8, "classId": "seer", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 seer_t2_4:{"name": "Ojo del Abismo", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "mana", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "seer", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 seer_t3_1:{"name": "Profecía Cumplida", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 29, "type": "magic", "rarity": "epic", "range": 8, "classId": "seer", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 seer_t3_2:{"name": "Detener la Catástrofe", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 31, "type": "magic", "rarity": "epic", "range": 8, "classId": "seer", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 seer_t3_3:{"name": "Mil Futuros", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "seer", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 seer_t3_4:{"name": "Fin Inevitable", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "mana", "cost": 35, "type": "magic", "rarity": "epic", "range": 8, "classId": "seer", "tier": 3, "classEffect": "massive", "enemyUsable": true},
 beastGuardian_t1_1:{"name": "Garra Aumentada", "icon": "✦", "desc": "Ataque a distancia contra el enemigo visible más cercano.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 15, "type": "physical", "rarity": "common", "range": 8, "classId": "beastGuardian", "tier": 1, "classEffect": "ranged", "enemyUsable": true},
 beastGuardian_t1_2:{"name": "Rugido Protector", "icon": "▣", "desc": "Obtienes un escudo que escala con el nivel de habilidad.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 17, "type": "utility", "rarity": "common", "range": 0, "classId": "beastGuardian", "tier": 1, "classEffect": "shield", "enemyUsable": true},
 beastGuardian_t1_3:{"name": "Salto de Depredador", "icon": "➤", "desc": "Avanzas hacia un enemigo y golpeas al llegar.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 19, "type": "physical", "rarity": "common", "range": 5, "classId": "beastGuardian", "tier": 1, "classEffect": "dash", "enemyUsable": true},
 beastGuardian_t1_4:{"name": "Olfato de Sangre", "icon": "☠", "desc": "Daña y reduce temporalmente el daño del objetivo.", "cd": 5, "unlock": "Clase", "resource": "stamina", "cost": 21, "type": "physical", "rarity": "common", "range": 0, "classId": "beastGuardian", "tier": 1, "classEffect": "debuff", "enemyUsable": true},
 beastGuardian_t2_1:{"name": "Embate Bestial", "icon": "✹", "desc": "Golpea a varios enemigos cercanos.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 22, "type": "physical", "rarity": "rare", "range": 0, "classId": "beastGuardian", "tier": 2, "classEffect": "aoe", "enemyUsable": true},
 beastGuardian_t2_2:{"name": "Piel de Quimera", "icon": "✚", "desc": "Recupera vida y parte del recurso principal.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 24, "type": "utility", "rarity": "rare", "range": 0, "classId": "beastGuardian", "tier": 2, "classEffect": "heal", "enemyUsable": true},
 beastGuardian_t2_3:{"name": "Manada Cibernética", "icon": "ϟ", "desc": "Realiza varios impactos contra enemigos visibles.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 26, "type": "physical", "rarity": "rare", "range": 8, "classId": "beastGuardian", "tier": 2, "classEffect": "multihit", "enemyUsable": true},
 beastGuardian_t2_4:{"name": "Mordida Paralizante", "icon": "◐", "desc": "Revela terreno y mejora temporalmente tu posición.", "cd": 7, "unlock": "Clase", "resource": "stamina", "cost": 28, "type": "utility", "rarity": "rare", "range": 0, "classId": "beastGuardian", "tier": 2, "classEffect": "utility", "enemyUsable": true},
 beastGuardian_t3_1:{"name": "Avatar de la Bestia", "icon": "★", "desc": "Ataque potente en un área amplia.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 29, "type": "physical", "rarity": "epic", "range": 8, "classId": "beastGuardian", "tier": 3, "classEffect": "ultimate", "enemyUsable": true},
 beastGuardian_t3_2:{"name": "Caza Salvaje", "icon": "✂", "desc": "Inflige daño enorme a enemigos heridos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 31, "type": "physical", "rarity": "epic", "range": 8, "classId": "beastGuardian", "tier": 3, "classEffect": "execute", "enemyUsable": true},
 beastGuardian_t3_3:{"name": "Corazón de Alfa", "icon": "Ψ", "desc": "Mejora daño, armadura y regeneración durante varios turnos.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 33, "type": "utility", "rarity": "epic", "range": 0, "classId": "beastGuardian", "tier": 3, "classEffect": "buff", "enemyUsable": true},
 beastGuardian_t3_4:{"name": "Estampida Aumentada", "icon": "☄", "desc": "Habilidad definitiva de gran daño contra todos los enemigos visibles.", "cd": 10, "unlock": "Clase", "resource": "stamina", "cost": 35, "type": "physical", "rarity": "epic", "range": 8, "classId": "beastGuardian", "tier": 3, "classEffect": "massive", "enemyUsable": true}
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

const classSkillMilestones={1:1,3:1,5:1,10:2,15:2,20:2,30:3,40:3};



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
function visibleEnemiesInRange(range){
 return game.enemies.filter(e=>e.hp>0&&game.seen?.[e.y]?.[e.x]&&(Math.abs(e.x-game.player.x)+Math.abs(e.y-game.player.y))<=range)
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
 {category:'Armas a distancia mecánicas',legacy:['Katanas y hachas pesadas'],stat:'agility',iconFolder:'weaponsCP',names:['Pistola de chispa', 'Revólver de latón', 'Pistola de presión', 'Cañón de mano', 'Carabina compacta', 'Ballesta mecánica', 'Arco de poleas', 'Sierra arrojadiza', 'Bomba de relojería', 'Dron escarabajo']},
 {category:'Armas pesadas steampunk',legacy:['Hachas de guerra y mazas con pinchos'],stat:'vitality',iconFolder:'weaponsCP',names:['Garrote de clavos', 'Mayal de engranajes', 'Hacha de vapor', 'Martillo industrial', 'Puñal de válvula', 'Alabarda mecánica', 'Mayal de presión', 'Guantelete de impacto', 'Látigo de cobre', 'Escudo de turbina']},
 {category:'Espadas eléctricas iniciales',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:1,legacy:['Dagas, lanzas y alabardas'],stat:'strength',names:['Daga de bobina', 'Kukri electrificado', 'Sable de dientes', 'Espada conductora', 'Espada de plasma azul', 'Estoque de descarga', 'Bastón de bobina Tesla', 'Hacha de inducción', 'Lanza de arco eléctrico', 'Maza acumuladora']},
 {category:'Armas de fuego eléctricas',legacy:['Arcos'],stat:'agility',iconFolder:'weaponsCP',names:['Pistola de condensador', 'Revólver voltaico', 'Pistola de bobina azul', 'Cañón eléctrico corto', 'Fusil de arco', 'Rifle de inducción', 'Ballesta de energía', 'Arco voltaico', 'Mina de pulso', 'Granada de plasma azul']},
 {category:'Armas eléctricas pesadas',legacy:['Ballestas'],stat:'vitality',iconFolder:'weaponsCP',names:['Maza de bobina', 'Mayal voltaico', 'Hacha de inducción pesada', 'Martillo Tesla', 'Daga de plasma concentrado', 'Alabarda de tormenta', 'Cadena de descarga', 'Guantelete eléctrico', 'Látigo voltaico', 'Dron de descarga']},
 {category:'Armas de latón refinadas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:2,legacy:['Varitas mágicas'],stat:'strength',names:['Espada de duelista mecánico', 'Sable del capitán aéreo', 'Machete de engranajes', 'Espada de relojero', 'Hoja ceremonial de latón', 'Estoque de autómata', 'Maza solar mecánica', 'Hacha de aviador', 'Lanza de pistón', 'Bastón giroscópico']},
 {category:'Armamento steampunk avanzado',legacy:['Guadañas'],stat:'agility',iconFolder:'weaponsCP',names:['Pistola neumática', 'Revólver de triple cámara', 'Pistola de turbina', 'Cañón de presión reforzado', 'Fusil de vapor azul', 'Rifle de caldera', 'Ballesta de autómata', 'Arco de precisión mecánico', 'Mina de engranajes', 'Granada de presión']},
 {category:'Reliquias mecánicas',legacy:['Mayales'],stat:'wisdom',iconFolder:'weaponsCP',names:['Bastón del gran engranaje', 'Mayal de relojería', 'Hacha del maquinista', 'Martillo de núcleo azul', 'Daga del inventor', 'Alabarda del reloj eterno', 'Cadena de engranajes gemelos', 'Guantelete del constructor', 'Látigo de transmisión', 'Araña mecánica']},
 {category:'Armas ciberpunk de neón',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:3,legacy:['Garras y guanteletes'],stat:'agility',names:['Daga de neón azul', 'Kukri de neón violeta', 'Hoja monomolecular cian', 'Espada de plasma magenta', 'Mandoble holográfico', 'Estoque de energía violeta', 'Bastón de plasma dual', 'Hacha de neón', 'Lanza fotónica', 'Maza de núcleo violeta']},
 {category:'Armas de fuego ciberpunk',legacy:['Pistolas y armas de fuego mágicas'],stat:'agility',iconFolder:'weaponsCP',names:['Pistola inteligente', 'Subfusil de neón', 'Pistola de plasma compacta', 'Cañón sónico', 'Rifle de pulsos', 'Fusil de partículas', 'Ballesta magnética', 'Arco holográfico', 'Mina de pulso violeta', 'Granada de antimateria']},
 {category:'Armas ciberpunk pesadas',legacy:['Hoces, armas curvas y armas exóticas'],stat:'vitality',iconFolder:'weaponsCP',names:['Maza de núcleo oscuro', 'Mayal de plasma', 'Hacha de combate cibernética', 'Martillo de sobrecarga', 'Daga de datos corruptos', 'Alabarda de fase', 'Cadena de energía', 'Guantelete de fuerza', 'Látigo neuronal', 'Dron depredador']},
 {category:'Armas térmicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:4,legacy:['Látigos'],stat:'strength',names:['Daga incandescente', 'Kukri térmico', 'Sable de fuego', 'Espada láser roja', 'Mandoble de magma', 'Estoque ígneo', 'Bastón de combustión', 'Hacha térmica', 'Lanza de fusión', 'Maza de reactor rojo']},
 {category:'Armas criogénicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:5,legacy:['Bastones mágicos'],stat:'intelligence',names:['Daga criogénica', 'Kukri de hielo tecnológico', 'Sable glacial', 'Espada láser azul', 'Mandoble criónico', 'Estoque de escarcha', 'Bastón de congelación', 'Hacha criogénica', 'Lanza de hielo comprimido', 'Maza de núcleo glacial']},
 {category:'Armas tóxicas y biotecnológicas',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:6,legacy:['Martillos de guerra'],stat:'luck',names:['Daga biocortante', 'Kukri venenoso', 'Sable de ácido', 'Espada de plasma verde', 'Mandoble biotecnológico', 'Estoque tóxico', 'Pistola de esporas', 'Hacha corrosiva', 'Lanza de bioenergía', 'Granada química']},
 {category:'Armas de pólvora industrial',legacy:['Hachas mágicas'],stat:'agility',iconFolder:'weaponsCP',names:['Pistola de percusión', 'Escopeta recortada', 'Revólver de cañones múltiples', 'Fusil pesado de vapor', 'Ametralladora de engranajes', 'Lanzagranadas industrial', 'Ballesta de asedio compacta', 'Arco neumático', 'Cañón portátil', 'Mortero de hombro']},
 {category:'Artillería steampunk',legacy:['Lanzas cortas y jabalinas'],stat:'vitality',iconFolder:'weaponsCP',names:['Pistola lanzallamas', 'Fusil rotatorio de vapor', 'Cañón de bobina mecánico', 'Lanzacohetes de latón', 'Rifle explosivo', 'Mortero de presión', 'Ballesta pesada plegable', 'Mina magnética', 'Cañón automático', 'Torreta mecánica']},
 {category:'Artefactos de energía',legacy:['Mandobles mágicos'],stat:'intelligence',iconFolder:'weaponsCP',names:['Núcleo de plasma azul', 'Portal de fase', 'Proyector de singularidad', 'Garra gravitatoria', 'Cuchilla del vacío', 'Orbe de agujero negro', 'Cañón dimensional', 'Reactor temporal', 'Reloj de estasis', 'Mina de singularidad']},
 {category:'Armas tecnomágicas legendarias',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:7,legacy:['Espadas legendarias'],stat:'wisdom',names:['Pistola del reloj divino', 'Sable de energía dorada', 'Hoja sierra de plasma', 'Espada del núcleo celeste', 'Mandoble del cronoingeniero', 'Bastón del sol mecánico', 'Hacha de tormenta Tesla', 'Lanza del autómata real', 'Maza del gran reloj', 'Dron serafín mecánico']},
 {category:'Armas míticas ciberpunk',iconFolder:SWORD_ICON_FOLDER,iconAssetRow:8,legacy:['Armas artefacto y armas míticas'],stat:'wisdom',names:['Cañón del corazón azul', 'Guadaña del vacío violeta', 'Espada de plasma imperial', 'Hoja del reactor carmesí', 'Estrella de energía criónica', 'Rifle del arcángel mecánico', 'Hacha del señor de las máquinas', 'Lanza de fotones', 'Bastón de singularidad violeta', 'Núcleo del apocalipsis mecánico']}
];
const weaponCategories=weaponRows.map(r=>r.category);
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
 if(['blade','spear'].includes(shape)){rect(22,5,6,29);rect(14,31,22,5);rect(20,36,10,8)}
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
function weightedRarity(level){
 const luck=game?.player?.stats?.luck||0;
 const bonus=(level-1)*.22+luck*.18+(game?.player?.derived?.rarityFind||0)*.25;
 const adjusted=rarities.map((r,i)=>({...r,w:Math.max(.2,r.weight*(1+(i-1)*bonus/45))}));
 let total=adjusted.reduce((s,r)=>s+r.w,0),roll=Math.random()*total;
 for(const r of adjusted){roll-=r.w;if(roll<=0)return r}
 return adjusted[0];
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
 return chooseUnique(passivePool,count).map(p=>({...p,value:affixValue(p,itemLevel,rarity)}));
}
function buildEffects(rarity){
 const out=[];
 if(Math.random()<rarity.effects)out.push({...pick(legendaryEffects)});
 return out;
}
function describeItem(item){item.defenseStat=item.defenseStat||inferWeaponDefenseStat(item);
 const lines=[];
 if(item.flavor)lines.push(`<span class="small">${item.flavor}</span>`);for(const a of item.affixes||[])lines.push(`<span class="affixLine">+${a.value}${a.percent?'%':''} ${a.label}</span>`);
 for(const p of item.passives||[])lines.push(`<span class="passiveLine">◆ ${p.name}: ${p.desc} (${p.value}${p.percent?'%':''})</span>`);
 for(const e of item.effects||[])lines.push(`<span class="effectLine">✦ ${e.name}: ${e.desc}</span>`);
 return lines.join('');
}
function recomputeDerived(){
 const p=game.player,base={...p.stats};
 const rb=p.raceBonuses||raceDefs[p.race]?.bonuses||{},pp=p.permanentPotionStats||{};
 for(const k of ['strength','vitality','agility','luck','intelligence','wisdom']){if(rb[k])base[k]=(base[k]||0)+rb[k];if(pp[k])base[k]=(base[k]||0)+pp[k]}
 const d={damage:p.baseDamage,armor:p.baseArmor+(rb.armor||0),maxHp:30+base.vitality*3+(rb.maxHp||0)+(pp.maxHp||0),maxStamina:45+base.vitality*4+base.agility*2+(rb.maxStamina||0),maxMana:30+base.intelligence*5+base.wisdom*3+(rb.maxMana||0),
 critChance:5+base.luck*.6+(rb.critChance||0),critDamage:150,dodge:base.agility*.45+(rb.dodge||0),physicalPower:rb.physicalPower||0,magicPower:rb.magicPower||0,staminaRegen:6+Math.floor(base.vitality/4)+(rb.staminaRegen||0),manaRegen:4+Math.floor(base.wisdom/4)+(rb.manaRegen||0),rarityFind:rb.rarityFind||0};
 const allStats={...base};
 for(const item of Object.values(p.equipment||{})){
  if(!item)continue;
  for(const a of item.affixes||[]){
   if(a.key in allStats)allStats[a.key]+=a.value;
   else d[a.key]=(d[a.key]||0)+a.value;
  }
  for(const pa of item.passives||[])d[pa.stat]=(d[pa.stat]||0)+pa.value;
 }
 d.maxHp+=Math.max(0,(allStats.vitality-base.vitality)*3);
 d.maxStamina+=Math.max(0,(allStats.vitality-base.vitality)*4+(allStats.agility-base.agility)*2);
 d.maxMana+=Math.max(0,(allStats.intelligence-base.intelligence)*5+(allStats.wisdom-base.wisdom)*3);
 d.damage+=Math.floor((allStats.strength-base.strength)*1.2);
 d.armor+=Math.floor((allStats.vitality-base.vitality)*.6);
 for(const b of p.activeBuffs||[]){
  if(b.effects?.armor)d.armor=Math.round(d.armor*(1+b.effects.armor));
  if(b.effects?.maxHp)d.maxHp+=b.effects.maxHp;
 }
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
function potionRarityWeight(tier,quality){
 const base={common:50,uncommon:28,rare:14,epic:6,legendary:2}[tier]||1;
 return base*Math.max(.25,1+(quality-1)*({common:-.16,uncommon:-.06,rare:.10,epic:.22,legendary:.32}[tier]||0))
}
function makePotion(quality=1){
 let total=potionDefs.reduce((s,p)=>s+potionRarityWeight(p.tier,quality),0),roll=Math.random()*total;
 let def=potionDefs[0];
 for(const p of potionDefs){roll-=potionRarityWeight(p.tier,quality);if(roll<=0){def=p;break}}
 return{id:crypto.randomUUID(),type:'potion',slot:'consumable',rarity:def.tier,label:skillRarities[def.tier]?.label||def.tier,name:def.name,desc:def.desc,potionId:def.id,kind:def.kind,duration:def.duration||0,effect:{...def.effect},iconShape:'vial',itemLevel:Math.max(1,Math.round(quality))}
}
function usePotion(item){const p=game.player;let message='';if(item.kind==='instant'){const bh=p.hp,bm=p.mana,bs=p.stamina;if(item.effect.healPct)healEntity(p,Math.round(p.maxHp*item.effect.healPct));if(item.effect.manaPct)p.mana=Math.min(p.maxMana,p.mana+Math.round(p.maxMana*item.effect.manaPct));if(item.effect.staminaPct)p.stamina=Math.min(p.maxStamina,p.stamina+Math.round(p.maxStamina*item.effect.staminaPct));const parts=[];if(p.hp>bh)parts.push(`+${p.hp-bh} vida`);if(p.mana>bm)parts.push(`+${p.mana-bm} maná`);if(p.stamina>bs)parts.push(`+${p.stamina-bs} stamina`);message=parts.join(', ')||'Sin efecto: recursos completos.'}else if(item.kind==='temporary'){p.activePotions=p.activePotions||[];p.activePotions.push({name:item.name,turns:item.duration,effect:{...item.effect}});message=`Efecto temporal durante ${item.duration} turnos: ${item.desc}`}else{p.permanentPotionStats=p.permanentPotionStats||{};for(const [k,v] of Object.entries(item.effect))p.permanentPotionStats[k]=(p.permanentPotionStats[k]||0)+v;message=`Mejora permanente: ${item.desc}`}game.inventory=game.inventory.filter(i=>i.id!==item.id);recomputeDerived();updateUI();draw();banner(item.name.toUpperCase());log(`${item.name}: ${message}`,'loot');storyTitle.textContent='POCIÓN UTILIZADA';storyBody.innerHTML=`<div class="narrative"><p><b>${item.name}</b></p><p>${message}</p><div class="startActions"><button id="closePotionMessage">Continuar</button></div></div>`;storyOverlay.classList.remove('hidden');setTimeout(()=>document.getElementById('closePotionMessage')?.addEventListener('click',()=>storyOverlay.classList.add('hidden')),0)}
function tickPotionEffects(){
 const p=game.player;if(!p?.activePotions)return;
 p.activePotions.forEach(e=>e.turns--);p.activePotions=p.activePotions.filter(e=>e.turns>0)
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
 const category=classStarterWeaponCategories[classId]||'Espadas básicas y elementales';
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

function makeConfiguredLoot(level){if(!configItems.length)return null;const row=pick(configItems),raw=row.item_json||row,item={...raw};item.id=crypto.randomUUID();item.name=item.name||row.nombre||'Objeto configurado';item.slot=item.slot||row.slot||'trinket1';item.rarity=item.rarity||row.tier||'common';item.label=item.label||tierDefs[item.rarity]?.label||item.rarity;item.itemLevel=Number(item.itemLevel||row.ilvl||level||1);item.score=Number(item.score||item.itemLevel*8);item.icon=item.icon||row.icon||'';item.affixes=Array.isArray(item.affixes)?item.affixes:parseConfigStats(row.stats||item.stats);item.passives=item.passives||[];item.effects=item.effects||[];item.desc=item.desc||`Configurado · Nivel ${item.itemLevel} · Poder ${item.score}`;item.flavor=item.flavor||'Objeto creado en modo configuración.';return item}
function parseConfigStats(text){return String(text||'').split(/[\n,;]/).map(x=>x.trim()).filter(Boolean).map(part=>{const m=part.match(/^([^:+-]+)\s*:?\s*([+-]?\d+)/);return m?{key:m[1].trim(),label:m[1].trim(),value:Number(m[2]),percent:false}:null}).filter(Boolean)}
function tierColor(tier){return tierDefs[tier]?.color||'#ddd'}
const configImageCache={};function configIconImage(src){if(!configImageCache[src]){const img=new Image();img.src=src;configImageCache[src]=img}return configImageCache[src]}
function hexToBase64(hex){const bytes=hex.match(/.{1,2}/g)||[];let bin='';bytes.forEach(b=>bin+=String.fromCharCode(parseInt(b,16)));return btoa(bin)}
function makeLoot(level,source='normal'){const configured=makeConfiguredLoot(level);if(configured&&Math.random()<.55)return configured;if(Math.random()<Math.min(.22,.07+game.floor*.025+(source==='boss'? .08:0)))return makePotion(encounterLootQuality(source));
 const slot=pick(slots),rar=weightedRarity(level);
 const itemLevel=Math.max(1,level+rng(3)-1);
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
 return{
  id:crypto.randomUUID(),slot,iconShape,rarity:rar.name,label:rar.label,itemLevel,score,
  name:slot==='weapon'?weaponNameForCategory(weaponCategory,weaponIconCol):slot==='chest'?armorName(armorIconRow,armorIconCol):(themed?.name||`${pick(itemBases[slot])} ${pick(prefixes)}`),
  theme:themed?.theme||'fantasy',
  weaponCategory,weaponIconRow,weaponIconCol,weaponIconPath:weaponIconPathValue,
  armorCategory:slot==='chest'?armorRows[armorIconRow]?.category:null,armorIconRow,armorIconCol,armorIconPath:armorIconPathValue,
  flavor:slot==='weapon'?`${weaponCategory}. Imagen individual: ${weaponIconPathValue}. La progresión por fila respeta rareza y nivel.`:slot==='chest'?`${armorRows[armorIconRow]?.category}. Imagen individual: ${armorIconPathValue}. La progresión por fila va de menos a más poder.`:(themed?.flavor||'Un objeto con más historia de la que conviene preguntar.'),
  defenseStat:slot==='weapon'?(weaponCategoryStats[weaponCategory]||'strength'):inferWeaponDefenseStat({name:themed?.name||'',iconShape,theme:themed?.theme||'fantasy'}),
  affixes,passives,effects,
  desc:`Nivel ${itemLevel} · Poder ${score}`
 };
}
function log(msg,cls=''){const d=document.createElement('div');d.className=cls;d.textContent=msg;document.getElementById('log').prepend(d)}
function banner(text){const d=document.createElement('div');d.className='banner';d.textContent=text;document.body.appendChild(d);setTimeout(()=>d.remove(),2100)}
function camera(){return{x:Math.max(0,Math.min(COLS-VIEW,game.player.x-Math.floor(VIEW/2))),y:Math.max(0,Math.min(ROWS-VIEW,game.player.y-Math.floor(VIEW/2)))}}
function floating(text,x,y,color='#fff'){const r=canvas.getBoundingClientRect(),c=camera(),d=document.createElement('div');d.className='floatText';d.textContent=text;d.style.color=color;d.style.left=`${r.left+(x-c.x+.45)*r.width/VIEW}px`;d.style.top=`${r.top+(y-c.y+.25)*r.height/VIEW}px`;document.body.appendChild(d);setTimeout(()=>d.remove(),850)}

function healEntity(entity,amount,x=entity.x??game.player.x,y=entity.y??game.player.y){
 const max=Number(entity.maxHp)||0,before=Number(entity.hp)||0;
 if(max<=0||amount<=0)return 0;
 entity.hp=Math.min(max,before+Math.max(0,Math.round(amount)));
 const healed=Math.max(0,Math.round(entity.hp-before));
 if(healed>0)floating(`+${healed}`,x,y,'#70dc9b');
 return healed
}

function effect(cls){canvas.classList.remove(cls);void canvas.offsetWidth;canvas.classList.add(cls)}
function reveal(cx,cy,r=game.player.vision){for(let y=Math.max(0,cy-r);y<=Math.min(ROWS-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(COLS-1,cx+r);x++)if(Math.hypot(x-cx,y-cy)<=r+.4)game.seen[y][x]=true}


let pendingSkillChoices=[];
function classTierForLevel(level){return classSkillMilestones[level]||0}
const CLASS_SKILL_LEVELS=[1,3,5,10,15,20,30,40];
function ensureSkillChoiceState(){
 const p=game.player;
 p.skillChoicesAwarded=p.skillChoicesAwarded||{};
 pendingSkillChoices=pendingSkillChoices||[];
}
function queueClassSkillChoice(level,initial=false){
 ensureSkillChoiceState();
 const tier=classTierForLevel(level);
 if(!tier||game.player.skillChoicesAwarded[level])return;
 if(pendingSkillChoices.some(q=>q.level===level))return;
 game.player.skillChoicesAwarded[level]='queued';
 pendingSkillChoices.push({tier,level,initial});
 processPendingSkillChoices();
}
function queueMissingClassSkillChoices(){
 if(!game?.player)return;
 ensureSkillChoiceState();
 for(const level of CLASS_SKILL_LEVELS){
  if(level<=game.player.level&&!game.player.skillChoicesAwarded[level])queueClassSkillChoice(level,level===1&&game.player.level===1);
 }
}
function processPendingSkillChoices(){
 if(!game?.player||game.player.unspentStatPoints>0||document.getElementById('statPointModal')?.classList.contains('open'))return;
 const modal=document.getElementById('skillChoiceModal');if(modal.classList.contains('open')||!pendingSkillChoices.length)return;
 const request=pendingSkillChoices.shift(),roman=['','I','II','III'][request.tier],tree=classSkillTrees[game.player.cls]?.[roman]||[];
 const choices=tree.filter(id=>!game.player.knownSkills.includes(id));
 if(!choices.length){game.player.skillChoicesAwarded[request.level]='complete';processPendingSkillChoices();return}
 document.getElementById('skillChoiceTitle').textContent=request.initial?'ELIGE TU PRIMERA HABILIDAD':`NUEVA HABILIDAD · TIER ${roman}`;
 document.getElementById('skillChoiceText').textContent=`${game.player.className} · nivel ${request.level}. Elige una habilidad; las demás podrán aparecer más adelante como botín o en enemigos.`;
 document.getElementById('skillChoiceGrid').innerHTML=choices.map(id=>{const s=skillDefs[id];return `<button type="button" class="skillChoiceCard" data-pick-skill="${id}"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${roman}</span><p>${s.desc}</p><span class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</span></button>`}).join('');
 modal.classList.add('open');
 modal.querySelectorAll('[data-pick-skill]').forEach(b=>b.addEventListener('click',()=>{
  learnSkill(b.dataset.pickSkill);
  game.player.skillChoicesAwarded[request.level]='chosen';
  modal.classList.remove('open');updateUI();
  if(request.initial){openInitialNarrative()}else processPendingSkillChoices()
 }))
}
function openInitialNarrative(){
 const n=pick(levelOneNarratives);storyTitle.textContent='NIVEL 1 — '+n.title;storyBody.innerHTML=`<div class="narrative"><p>${n.text}</p><p><b>Objetivo:</b> encuentra la salida, saquea la fortaleza y derrota al Rey Tuercecolmillos.</p></div>`;storyOverlay.classList.remove('hidden')
}

function start(){
 const race=selectedRace,cls=classDefs[selectedClass],stats={...cls.stats},maxHp=30+stats.vitality*3;
 const maxStamina=45+stats.vitality*4+stats.agility*2,maxMana=30+stats.intelligence*5+stats.wisdom*3;
 const equipment=Object.fromEntries(slots.map(s=>[s,null]));equipment.weapon=makeStarterWeapon(selectedClass);
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,inventory:[],achievements:{},bossesKilled:0,chestsOpened:0,player:{name:nameInput.value||'Sin nombre',race,cls:selectedClass,className:cls.name,level:1,xp:0,nextXp:xpNeededForLevel(1),hp:maxHp,maxHp,stamina:maxStamina,maxStamina,mana:maxMana,maxMana,baseDamage:2+stats.strength,baseArmor:4+Math.floor(stats.vitality/2),gold:0,keys:0,vision:4+Math.floor(stats.agility/4),shield:0,stats,equipment,knownSkills:[],skillProgress:{},skillChoicesAwarded:{},equippedSkills:[null,null,null,null],cooldowns:{},debuff:0}};
 const rb=raceDefs[race]?.bonuses||{};
 game.player.raceName=raceDefs[race]?.name||race;
 game.player.raceBonuses={...rb};
 if(rb.armor)game.player.baseArmor+=rb.armor;
 recomputeDerived();startOverlay.classList.add('hidden');queueClassSkillChoice(1,true);
}
storyContinue.onclick=()=>{storyOverlay.classList.add('hidden');if(!game.map)generateFloor();updateUI()};

function createDungeonWorldJson(name){
 const floors=[];
 const oldGame=game;
 const tempPlayer={level:1,stats:{strength:4,vitality:4,agility:3,luck:2,intelligence:2,wisdom:2},raceBonuses:{},derived:{floorShield:0},shield:0,hp:1,maxHp:1};
 for(let floor=1;floor<=20;floor++){
  const map=Array.from({length:ROWS},()=>Array(COLS).fill(1)),rooms=[];
  const targetRooms=30+Math.min(18,Math.floor(floor/2))+rng(7);
  for(let tries=0;tries<1400&&rooms.length<targetRooms;tries++){const w=4+rng(8),h=4+rng(8),x=1+rng(COLS-w-2),y=1+rng(ROWS-h-2);if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;const room={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};rooms.push(room);carve(map,room)}
  for(let i=1;i<rooms.length;i++){let a=rooms[i-1],b=rooms[i],x=a.cx,y=a.cy;if(Math.random()<.5){while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}}else{while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}}}
  game={floor,player:tempPlayer};
  const spawn=rooms[0],distanceFromSpawn=r=>Math.abs(r.cx-spawn.cx)+Math.abs(r.cy-spawn.cy),distantRooms=[...rooms].slice(1).sort((a,b)=>distanceFromSpawn(b)-distanceFromSpawn(a));
  const stairRoom=distantRooms[0]||rooms.at(-1),bossRoom=distantRooms[1]||distantRooms[0]||rooms.at(-1),stairs={x:stairRoom.cx,y:stairRoom.cy};
  const excludedRooms=new Set([spawn,stairRoom,bossRoom]);
  const safeRooms=[...rooms].filter(r=>!excludedRooms.has(r)&&distanceFromSpawn(r)>10).sort(()=>Math.random()-.5).slice(0,2+rng(3)).map((r,i)=>({...r,id:`safe-${floor}-${i}`,rested:false}));
  const safeCellKeys=new Set(safeRooms.flatMap(r=>[...roomCellSet(r)]));
  const occ=new Set([key(spawn.cx,spawn.cy),key(stairs.x,stairs.y)]);safeRooms.forEach(r=>occ.add(key(r.cx,r.cy)));
  const cells=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y)))cells.push({x,y});
  const free=()=>{let p;do{p=pick(cells)}while(occ.has(key(p.x,p.y)));occ.add(key(p.x,p.y));return{...p}};
  const doors=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y))){const h=map[y][x-1]===0&&map[y][x+1]===0&&map[y-1][x]===1&&map[y+1][x]===1,v=map[y-1][x]===0&&map[y+1][x]===0&&map[y][x-1]===1&&map[y][x+1]===1;if((h||v)&&Math.random()<.065&&!occ.has(key(x,y))){doors.push({x,y,open:false,locked:Math.random()<.25});occ.add(key(x,y))}}
  const keys=[];for(let i=0;i<Math.max(1,doors.filter(d=>d.locked).length);i++)keys.push(free());
  const chests=[];for(let i=0;i<14+Math.floor(floor*.8);i++)chests.push({...free(),opened:false});
  const family=floorEnemyFamily(),theme={name:family.floorTheme,enemies:family.enemies,boss:pick(family.bosses)},enemies=[],isBossFloor=floor%2===0,count=32+floor*5+rng(13);
  for(let i=0;i<count;i++){const type=pick(theme.enemies),def=enemyDefs[type],p=free(),scale=1+(floor-1)*.16;enemies.push({x:p.x,y:p.y,type,name:def.name,hp:Math.round(def.hp*scale*1.5),maxHp:Math.round(def.hp*scale*1.5),atk:Math.round(def.atk*scale),boss:false})}
  const bossCount=isBossFloor?Math.min(4,1+Math.floor(floor/10)):Math.min(2,Math.floor(floor/15));let boss=null;
  for(let bi=0;bi<bossCount;bi++){const room=bi===0?bossRoom:distantRooms[Math.min(distantRooms.length-1,2+bi)]||bossRoom,type=theme.boss,def=enemyDefs[type],scale=1+(floor-1)*.13,b={x:room.cx,y:room.cy,type,name:bi?`${def.name} · Campeón ${bi+1}`:def.name,hp:Math.round(def.hp*scale*1.5*(1+bi*.18)),maxHp:Math.round(def.hp*scale*1.5*(1+bi*.18)),atk:Math.round(def.atk*scale*(1+bi*.08)),boss:true};enemies.push(b);if(!boss)boss=b}
  const event=Math.random()<=.09?{id:pick(eventDefs).id}:null;
  floors.push({floor,map,rooms,safeRooms,spawn:{x:spawn.cx,y:spawn.cy},stairs,doors,keys,chests,event,enemies:enemies.map(assignEnemySkills),enemyFamily:family.name,themeName:theme.name,boss});
 }
 game=oldGame;
 return {schemaVersion:1,appVersion:APP_VERSION,worldName:name,generatedAt:new Date().toISOString(),floors};
}
function loadPrecomputedFloor(){
 const data=selectedDungeonWorld?.world_json?.floors?.[game.floor-1];if(!data)return false;
 if(game?.player){recomputeDerived();if(game.player.raceBonuses?.floorHeal)healEntity(game.player,game.player.raceBonuses.floorHeal);game.player.secondLifeReady=true;game.player.shield=(game.player.shield||0)+(game.player.derived?.floorShield||0)}
 Object.assign(game,{map:data.map,rooms:data.rooms,safeRooms:data.safeRooms||[],stairs:data.stairs,doors:data.doors,keys:data.keys,chests:data.chests,precomputedEvent:data.event||null,enemies:(data.enemies||[]).map(e=>assignEnemySkills({...e})),enemyFamily:data.enemyFamily,seen:Array.from({length:ROWS},()=>Array(COLS).fill(false)),boss:data.boss});
 game.player.x=data.spawn.x;game.player.y=data.spawn.y;anim.heroX=anim.targetX=data.spawn.x;anim.heroY=anim.targetY=data.spawn.y;anim.t=1;reveal(data.spawn.x,data.spawn.y);
 banner(`PISO ${game.floor} · ${data.themeName||'Mundo precomputado'}`);log(`Entras en ${data.themeName||'la dungeon'}. Mundo: ${selectedDungeonWorld.world_name} (#${selectedDungeonWorld.id}).`,'story');updateUI();draw();rollFloorEvent();return true;
}

function floorTheme(){return themes[Math.min(themes.length-1,Math.floor((game.floor-1)/2))]}
function carve(map,r){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)map[y][x]=0}


const eventStats=['strength','vitality','agility','luck','intelligence','wisdom'];
const eventDefs=[
 {id:'goblinHorde',type:'horde',name:'Horda de saqueadores',stat:'agility',threshold:10,
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
 {id:'dartHall',type:'trap',name:'Galería de dardos',stat:'agility',threshold:9,
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
 {id:'thievesDeal',type:'reward',name:'Trato de ladrones',stat:'agility',threshold:11,
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
  for(let i=0;i<count;i++){const item=makeLoot(game.player.level+game.floor+2,'specialReward');if(i===0&&Math.random()<.6)item.rarity=['rare','epic','legendary'][rng(3)];game.inventory.push(item);lootToast(item)}
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
 return Object.entries(skillDefs).filter(([id,s])=>s.enemyUsable&&(!s.tier||s.tier<=maxTier)).map(([id])=>id)
}
function assignEnemySkills(e){
 const chance=e.boss?.95:e.elite?.55:.18+Math.min(.22,game.floor*.012);
 e.skills=[];e.skillCooldowns={};
 if(Math.random()<chance){const pool=enemySkillPool(e),count=e.boss?2+(Math.random()<.45?1:0):1;while(e.skills.length<count&&pool.length){const id=pool.splice(rng(pool.length),1)[0];e.skills.push(id)}}
 return e
}
function enemyUseSkill(e,dist){
 if(!e.skills?.length)return false;
 for(const id of e.skills){
  e.skillCooldowns[id]=Math.max(0,(e.skillCooldowns[id]||0)-1);
  const s=skillDefs[id];if(e.skillCooldowns[id]>0)continue;
  const ranged=isRangedSkill(id)||s.classEffect==='ranged'||s.classEffect==='multihit'||s.classEffect==='ultimate'||s.classEffect==='massive';
  if((ranged&&dist<=Math.max(4,s.range||6))||(!ranged&&dist<=1)){
   const mult=e.boss?1.35:e.elite?1.15:1,amount=Math.max(2,Math.round((e.atk||e.damage||4)*mult*(s.tier?1+s.tier*.12:1)));
   if(s.classEffect==='shield'||s.classEffect==='buff'||s.type==='utility'){healEntity(e,Math.round(amount*.9),e.x,e.y);floating('✦',e.x,e.y,'#76e0ff');log(`${e.name} usa ${s.name} y se refuerza.`,'combat')}
   else{damagePlayer(amount,inferSkillDefenseStat(id),`${e.name} usa ${s.name}`);floating(s.icon||'✦',e.x,e.y,'#e68cff')}
   e.skillCooldowns[id]=Math.max(2,s.cd||5);return true
  }
 }
 return false
}

function scaleEnemy(e){
 const d=difficultyScale();
 e.maxHp=e.hp=Math.round((e.maxHp||e.hp)*d.hp);
 e.damage=Math.max(1,Math.round(e.damage*d.damage));
 e.xp=Math.round((e.xp||5)*d.xp);
 if(!e.boss&&Math.random()<d.eliteChance){
  e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.55);e.damage=Math.round(e.damage*1.3);e.xp=Math.round(e.xp*1.8);
 }
 return assignEnemySkills(e);
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
 else{btn.textContent='ESPERAR';btn.disabled=false;delete btn.dataset.rest}
}

function generateFloor(){if(loadPrecomputedFloor())return;game.floorEventRolled=false;game.activeEvent=null;if(game?.player){recomputeDerived();if(game.player.raceBonuses?.floorHeal)healEntity(game.player,game.player.raceBonuses.floorHeal);game.player.secondLifeReady=true;game.player.shield=(game.player.shield||0)+(game.player.derived?.floorShield||0)}
 busy=false;const map=Array.from({length:ROWS},()=>Array(COLS).fill(1)),rooms=[];
 const targetRooms=30+Math.min(18,Math.floor(game.floor/2))+rng(7);
 for(let tries=0;tries<1400&&rooms.length<targetRooms;tries++){const w=4+rng(8),h=4+rng(8),x=1+rng(COLS-w-2),y=1+rng(ROWS-h-2);if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;const room={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};rooms.push(room);carve(map,room)}
 for(let i=1;i<rooms.length;i++){let a=rooms[i-1],b=rooms[i],x=a.cx,y=a.cy;if(Math.random()<.5){while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}}else{while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}}}
 const spawn=rooms[0];
 const distanceFromSpawn=r=>Math.abs(r.cx-spawn.cx)+Math.abs(r.cy-spawn.cy);
 const distantRooms=[...rooms].slice(1).sort((a,b)=>distanceFromSpawn(b)-distanceFromSpawn(a));
 const stairRoom=distantRooms[0]||rooms.at(-1),bossRoom=distantRooms[1]||distantRooms[0]||rooms.at(-1);
 const stairs={x:stairRoom.cx,y:stairRoom.cy};
 const safeRoomCount=2+rng(3);
 const excludedRooms=new Set([spawn,stairRoom,bossRoom]);
 const safeRooms=[...rooms].filter(r=>!excludedRooms.has(r)&&distanceFromSpawn(r)>10).sort(()=>Math.random()-.5).slice(0,safeRoomCount).map((r,i)=>({...r,id:`safe-${game.floor}-${i}`,rested:false}));
 const safeCellKeys=new Set(safeRooms.flatMap(r=>[...roomCellSet(r)]));
 const occ=new Set();occ.add(key(spawn.cx,spawn.cy));occ.add(key(stairs.x,stairs.y));safeRooms.forEach(r=>occ.add(key(r.cx,r.cy)));
 const cells=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y)))cells.push({x,y});
 const free=()=>{let p;do{p=pick(cells)}while(occ.has(key(p.x,p.y)));occ.add(key(p.x,p.y));return{...p}};
 const doors=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y))){const h=map[y][x-1]===0&&map[y][x+1]===0&&map[y-1][x]===1&&map[y+1][x]===1,v=map[y-1][x]===0&&map[y+1][x]===0&&map[y][x-1]===1&&map[y][x+1]===1;if((h||v)&&Math.random()<.065&&!occ.has(key(x,y))){doors.push({x,y,open:false,locked:Math.random()<.25});occ.add(key(x,y))}}
 const keys=[];for(let i=0;i<Math.max(1,doors.filter(d=>d.locked).length);i++)keys.push(free());
 const chests=[];for(let i=0;i<14+Math.floor(game.floor*.8);i++)chests.push({...free(),opened:false});
 const family=floorEnemyFamily(),theme={name:family.floorTheme,enemies:family.enemies,boss:pick(family.bosses)},enemies=[],isBossFloor=game.floor%2===0;
 const populationScale=1+Math.min(1.2,(game.player.level-1)*.012);
 const count=Math.round((32+game.floor*5+rng(13))*populationScale);for(let i=0;i<count;i++){const type=pick(theme.enemies),def=enemyDefs[type],p=free(),scale=1+(game.floor-1)*.16;enemies.push(assignEnemySkills({...p,type,name:def.name,hp:Math.round(def.hp*scale*1.5),maxHp:Math.round(def.hp*scale*1.5),atk:Math.round(def.atk*scale),boss:false}))}
 let boss=null;
 const bossCount=isBossFloor?Math.min(4,1+Math.floor(game.floor/10)):Math.min(2,Math.floor(game.floor/15));
 for(let bi=0;bi<bossCount;bi++){
  const room=bi===0?bossRoom:distantRooms[Math.min(distantRooms.length-1,2+bi)]||bossRoom;
  const p={x:room.cx,y:room.cy},type=theme.boss,def=enemyDefs[type],scale=1+(game.floor-1)*.13;
  const b=assignEnemySkills({...p,type,name:bi?`${def.name} · Campeón ${bi+1}`:def.name,hp:Math.round(def.hp*scale*1.5*(1+bi*.18)),maxHp:Math.round(def.hp*scale*1.5*(1+bi*.18)),atk:Math.round(def.atk*scale*(1+bi*.08)),boss:true});
  enemies.push(b);if(!boss)boss=b
 }
 Object.assign(game,{map,rooms,safeRooms,stairs,doors,keys,chests,enemies,enemyFamily:family.name,seen:Array.from({length:ROWS},()=>Array(COLS).fill(false)),boss});
 game.player.x=spawn.cx;game.player.y=spawn.cy;anim.heroX=anim.targetX=spawn.cx;anim.heroY=anim.targetY=spawn.cy;anim.t=1;reveal(spawn.cx,spawn.cy);
 banner(bossCount?`PISO ${game.floor} · ${bossCount} JEFE${bossCount>1?'S':''}`:`PISO ${game.floor} · ${theme.name}`);log(`Entras en ${theme.name}. Familia dominante: ${family.name}. ${count} enemigos y ${bossCount} jefe${bossCount===1?'':'s'}.`,'story');
 if(false){game.level2StoryShown=true;const n=pick(levelTwoNarratives);setTimeout(()=>{storyTitle.textContent='NIVEL 2 — '+n.title;storyBody.innerHTML=`<div class="narrative"><p>${n.text}</p><p><b>Objetivo:</b> derrota al jefe y rompe el sello de salida.</p></div>`;storyOverlay.classList.remove('hidden')},250)}
 const extra=difficultyScale().count;
 for(let i=0;i<extra;i++){const room=pick(game.rooms||[]);if(room){const type=pick(theme.enemies);const def=enemyDefs[type];if(def){const exPos={x:room.x+rng(Math.max(1,room.w)),y:room.y+rng(Math.max(1,room.h))};if(!isSafeCell(exPos.x,exPos.y)){const ex=scaleEnemy({...def,type,...exPos,maxHp:def.hp});game.enemies.push(ex)}}}}
 updateUI();draw();rollFloorEvent();
}


const DEFENSE_STAT_LABELS={
 strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',
 luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'
};
function inferWeaponDefenseStat(item){
 const text=`${item?.name||''} ${item?.iconShape||''} ${item?.theme||''}`.toLowerCase();
 if(/(arco|ballesta|rifle|pistola|fusil|rail|bláster|blaster|cañón|canon|daga|dagger|spear|lanza)/.test(text))return'agility';
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
 const armorPart=['strength','vitality'].includes(stat)?Math.floor(armorValue/3):Math.floor(armorValue/6);
 return base+armorPart
}
function resolveEnemyDefense(e,stat,attackPower){
 const die=rollDie(20),bonus=enemyDefenseScore(e,stat),dc=10+Math.max(1,Math.floor(attackPower*.55));
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
 if(r>=9)return'1d8';
 if(r>=7)return'1d6+1';
 if(r>=3)return'1d8+1';
 const text=`${w.name||''} ${w.iconShape||''}`.toLowerCase();
 if(/(martillo|hammer|hacha|axe|maza|mace)/.test(text))return'1d10';
 if(/(espada|sword|blade)/.test(text))return'1d8';
 if(/(daga|dagger)/.test(text))return'1d6+1';
 return'1d6'
}
function skillDiceExpr(id){
 const d=skillDefs[id]||{},tier=d.tier||({common:1,uncommon:1,rare:2,epic:3,legendary:3}[d.rarity]||1);
 if(d.type==='utility'||['buff','shield','heal','utility'].includes(d.classEffect))return null;
 if(d.classEffect==='massive'||id==='blackSun'||id==='worldBreaker')return tier>=3?'4d8+6':'3d8+4';
 if(d.classEffect==='ultimate')return tier>=3?'4d6+5':'3d6+3';
 if(['aoe','multihit'].includes(d.classEffect)||AREA_SKILLS.has(id))return tier>=3?'3d6+4':tier===2?'2d6+3':'2d4+2';
 if(d.classEffect==='execute'||id==='execute')return tier>=3?'3d10+5':'2d8+3';
 if(d.resource==='mana')return tier>=3?'3d8+4':tier===2?'2d8+2':'1d8+2';
 return tier>=3?'3d8+5':tier===2?'2d8+3':'1d8+2'
}
function skillStatModifier(id){
 const d=skillDefs[id]||{},s=game.player.derived?.finalStats||game.player.stats;
 return d.resource==='mana'
  ?Math.floor((s.intelligence*2+s.wisdom)/3)
  :Math.floor((s.strength*2+s.agility)/3)
}
function activeBuffDamageMultiplier(){
 return (game.player.activeBuffs||[]).reduce((m,b)=>m*(1+(b.effects?.damage||0)),1)
}
function diceDamageLabel(id){
 const expr=skillDiceExpr(id);return expr?`${expr} + atributo`:'Sin daño'
}

function total(stat){let v=stat==='damage'?game.player.baseDamage:stat==='armor'?game.player.baseArmor:0;for(const item of Object.values(game.player.equipment))if(item?.stat===stat)v+=item.power;if(stat==='armor')v+=game.player.shield;if(stat==='maxHp')v=game.player.maxHp;return v}
function critChance(){return Math.min(.38,.04+game.player.stats.agility*.012+game.player.stats.luck*.005)}
function attack(e,bonus=0,options={}){
 const skillId=options.skillId||null,expr=options.dice||skillDiceExpr(skillId)||baseAttackDice();
 const roll=rollDice(expr);
 const statMod=skillId?skillStatModifier(skillId):Math.max(0,Math.floor(total('damage')*.45));
 const defenseStat=options.defenseStat||(skillId?inferSkillDefenseStat(skillId):inferWeaponDefenseStat(equippedWeapon()));
 let raw=Math.max(1,Math.round((roll.total+statMod+Math.max(0,bonus)*.35)*(options.multiplier||1)*(game.player.nextSkillMultiplier||1)*activeBuffDamageMultiplier()));
 if(skillId&&game.player.nextSkillMultiplier)game.player.nextSkillMultiplier=1;
 const defense=resolveEnemyDefense(e,defenseStat,raw);
 let d=Math.max(defense.mult===0?0:1,Math.round(raw*defense.mult));
 const crit=Math.random()<critChance();if(crit&&d>0)d=Math.round(d*1.75);
 e.hp-=d;floating(d?`${crit?'CRIT ':''}-${d}`:'EVITA',e.x,e.y,d?(crit?'#ffd75c':'#fff'):'#70dc9b');effect('flash');
 log(`${e.name}: ${defense.result}. Tirada 1d20 (${defense.die}) + ${defense.bonus} contra CD ${defense.dc}. ${d?`Recibe ${d}${crit?' crítico':''}`:'No recibe daño'} [${expr}: ${roll.rolls.join('+')}${roll.bonus?`${roll.bonus>0?'+':''}${roll.bonus}`:''}; ataque +${statMod}].`,'combat');
 if(e.hp<=0)kill(e)
}
function kill(e){
 game.enemies=game.enemies.filter(x=>x!==e);gainXp(e.boss?60:8+Math.floor(game.floor/2));game.player.gold+=e.boss?75:3+rng(6);
 if(Math.random()<.13+game.player.stats.luck*.008||e.boss||e.eventBoss){const item=makeLoot(game.player.level+(e.boss?3:0),e.eventBoss?'eventBoss':e.boss?'boss':e.elite?'elite':'normal');game.inventory.push(item);lootToast(item)}if(e.skills?.length&&Math.random()<(e.boss?.38:e.elite?.18:.055)){const drop=pick(e.skills.filter(id=>!game.player.knownSkills.includes(id)));if(drop)unlockSkillLoot(drop)}else if(e.boss||e.eventBoss||Math.random()<.018)unlockSkillLoot(randomLootableSkill())
 log(`${e.name} ha sido eliminado.`,'good');
 if(e.boss){game.bossesKilled++;unlock('firstBoss','Rey de nada','Derrota al primer jefe.');learnSkill('ironRain');banner('JEFE DERROTADO · HABILIDAD DESBLOQUEADA')}
}
function damagePlayer(amount,defenseStat='vitality',sourceName='Ataque enemigo'){
 const p=game.player;
 const defenseDie=rollDie(20),defenseBonus=playerDefenseBonus(defenseStat);
 const attackDC=10+Math.max(1,Math.round(amount));
 let mult=1,result=`fallo defensivo de ${attackDefenseLabel(defenseStat)}`;
 if(defenseDie===20){mult=0;result=`evasión perfecta con ${attackDefenseLabel(defenseStat)}`}
 else if(defenseDie+defenseBonus>=attackDC){mult=.5;result=`defensa de ${attackDefenseLabel(defenseStat)} superada`}
 else if(defenseDie===1){mult=1.25;result=`pifia en ${attackDefenseLabel(defenseStat)}`}
 const d=Math.max(mult===0?0:1,Math.round(amount*mult));
 let finalDamage=d;
 const lifeBuff=(p.activeBuffs||[]).find(b=>b.effects?.lifesteal);
 if(lifeBuff&&options?.skillId)healEntity(p,Math.max(1,Math.round(finalDamage*lifeBuff.effects.lifesteal)));
 if(p.counterReady&&d>0){p.counterReady.turns--;const attacker=(game.enemies||[]).filter(e=>e.hp>0).sort((a,b)=>gridDistance(p,a)-gridDistance(p,b))[0];if(attacker)attack(attacker,0,{dice:p.counterReady.damage,multiplier:.8});p.counterReady=null}
 p.hp-=d;
 if(p.hp<=0&&p.cheatDeathTurns>0){p.hp=1;p.cheatDeathTurns=0;banner('TE NIEGAS A MORIR');log('La habilidad evita la muerte y te deja con 1 de vida.','good')}
 floating(d?`-${d}`:'EVITA',p.x,p.y,d?'#ff6666':'#70dc9b');effect(d?'shake':'flash');
 log(`${sourceName}: ${result}. 1d20 (${defenseDie}) + ${defenseBonus} contra CD ${attackDC}. ${d?`Recibes ${d} de daño.`:'No recibes daño.'}`,'combat');
 if(p.hp<=0){p.hp=0;game.over=true;updateUI();draw();permanentDeath()}
}

const statDescriptions={strength:'Aumenta daño físico y pruebas de fuerza.',vitality:'Aumenta vida y resistencia.',agility:'Aumenta evasión y movilidad.',luck:'Mejora crítico, botín y eventos.',intelligence:'Aumenta poder mágico y maná.',wisdom:'Mejora regeneración y percepción.'};
function queueStatPoint(){game.player.unspentStatPoints=(game.player.unspentStatPoints||0)+1;showStatPointModal()}
function showStatPointModal(){const p=game.player;if(!p?.unspentStatPoints)return;const modal=document.getElementById('statPointModal'),grid=document.getElementById('statChoiceGrid'),labels={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'};grid.innerHTML=Object.keys(labels).map(k=>`<button type="button" class="statChoice" data-stat-choice="${k}"><b>${labels[k]}: ${p.stats[k]}</b><span>${statDescriptions[k]}</span></button>`).join('');modal.classList.add('open');grid.querySelectorAll('[data-stat-choice]').forEach(btn=>btn.addEventListener('click',()=>{const stat=btn.dataset.statChoice;p.stats[stat]=(p.stats[stat]||0)+1;p.unspentStatPoints--;recomputeDerived();updateUI();draw();banner(`+1 ${labels[stat].toUpperCase()}`);log(`Asignas 1 punto a ${labels[stat]}.`,'good');if(p.unspentStatPoints>0)showStatPointModal();else{modal.classList.remove('open');queueMissingClassSkillChoices();processPendingSkillChoices()}}))}
function gainXp(v){
 const p=game.player;if(p.level>=LEVEL_CAP)return;
 v=Math.ceil(v*(p.raceBonuses?.xpMult||1));p.xp+=v;
 while(p.level<LEVEL_CAP&&p.xp>=p.nextXp){
  p.xp-=p.nextXp;p.level++;
  const g=levelGrowth(p.level);
  p.nextXp=p.level<LEVEL_CAP?xpNeededForLevel(p.level):0;
  p.maxHp+=g.hp+p.stats.vitality;p.hp=p.maxHp;
  p.maxStamina+=g.stamina+Math.floor(p.stats.vitality/3);p.stamina=p.maxStamina;
  p.maxMana+=g.mana+Math.floor((p.stats.intelligence+p.stats.wisdom)/3);p.mana=p.maxMana;
  p.baseDamage+=g.damage;p.baseArmor+=g.armor;
  if(p.level%10===0){p.stats.strength++;p.stats.vitality++;p.stats.agility++;p.stats.luck++;p.stats.intelligence++;p.stats.wisdom++}
  banner(`NIVEL ${p.level}`);queueClassSkillChoice(p.level);queueStatPoint();
 }
 if(p.level>=LEVEL_CAP){p.level=LEVEL_CAP;p.xp=0;p.nextXp=0;banner('NIVEL MÁXIMO 100')}
}
function learnSkill(id){if(game.player.knownSkills.includes(id))return;game.player.knownSkills.push(id);game.player.skillProgress=game.player.skillProgress||{};game.player.skillProgress[id]={level:1,xp:0,uses:0};const free=game.player.equippedSkills.findIndex(x=>!x);if(free>=0)game.player.equippedSkills[free]=id;log(`Nueva habilidad: ${skillDefs[id].name}.`,'loot')}
function unlock(id,title,desc){if(game.achievements[id])return;game.achievements[id]={title,desc};log(`LOGRO: ${title}`,'loot');if(id==='crowd')learnSkill('taunt');if(id==='chest5')learnSkill('lootMagnet')}

function blocked(x,y){const d=game.doors.find(d=>d.x===x&&d.y===y);return game.map[y]?.[x]!==0||(d&&!d.open)}
function move(dx,dy){
 if(!game||busy||game.over)return;const p=game.player,nx=p.x+dx,ny=p.y+dy,d=game.doors.find(d=>d.x===nx&&d.y===ny);
 if(d&&!d.open){if(d.locked&&p.keys<=0){log('Puerta cerrada: necesitas llave.','sys');return}if(d.locked)p.keys--;d.open=true;log('Abres una puerta.','sys');playerFinished();return}
 if(blocked(nx,ny))return;
 const e=game.enemies.find(e=>e.x===nx&&e.y===ny);if(e)attack(e);else{anim.heroX=p.x;anim.heroY=p.y;p.x=nx;p.y=ny;anim.targetX=nx;anim.targetY=ny;anim.t=0;reveal(nx,ny);checkTile()}
 playerFinished();
}
function checkTile(){
 const p=game.player,k=game.keys.find(k=>k.x===p.x&&k.y===p.y);if(k){game.keys=game.keys.filter(x=>x!==k);p.keys++;log('Recoges una llave.','loot')}
 const c=game.chests.find(c=>!c.opened&&c.x===p.x&&c.y===p.y);if(c)openChest(c);
 if(p.x===game.stairs.x&&p.y===game.stairs.y){if(game.boss&&game.enemies.includes(game.boss)){log('La salida está sellada mientras el jefe siga vivo.','combat')}else{game.floor++;generateFloor()}}
}
function openChest(c){c.opened=true;game.chestsOpened++;const n=1+(Math.random()<.24?1:0);for(let i=0;i<n;i++){const item=makeLoot(game.player.level+game.floor-1,'normal');game.inventory.push(item);setTimeout(()=>lootToast(item),i*220)}if(Math.random()<.16+game.floor*.025)unlockSkillLoot(randomLootableSkill());game.player.gold+=5+rng(14);floating('¡BOTÍN!',c.x,c.y,'#ffd45f');log(`Cofre: ${n} objeto(s).`,'loot');if(game.chestsOpened>=5)unlock('chest5','Coleccionista de basura','Abre 5 cofres.')}

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
function summonCompanion(kind='companion',turns=8,power=1){
 game.companions=game.companions||[];
 const names={companion:'Compañero',skeleton:'Siervo óseo',turret:'Torreta',healer:'Custodio',tank:'Guardián',wolf:'Lobo espiritual',clone:'Clon'};
 const pos=findFreeAdjacentToPlayer();
 const stats={
  skeleton:{hp:18+Math.round(power*5),atk:'1d6+2',range:1,shape:'allySkeleton'},
  turret:{hp:14+Math.round(power*3),atk:'1d6+2',range:7,shape:'allyTurret'},
  healer:{hp:16+Math.round(power*4),atk:'1d4',range:4,shape:'allyHealer'},
  tank:{hp:28+Math.round(power*7),atk:'1d6+1',range:1,shape:'allyTank'},
  wolf:{hp:20+Math.round(power*5),atk:'1d8',range:1,shape:'allyWolf'},
  clone:{hp:10+Math.round(power*2),atk:'1d4+1',range:1,shape:'allyClone'},
  companion:{hp:18+Math.round(power*4),atk:'1d6',range:1,shape:'allyCompanion'}
 }[kind]||{hp:18,atk:'1d6',range:1,shape:'allyCompanion'};
 game.companions.push({
  id:`comp-${Date.now()}-${Math.random()}`,kind,name:names[kind]||'Aliado',
  turns,power,x:pos.x,y:pos.y,hp:stats.hp,maxHp:stats.hp,atk:stats.atk,range:stats.range,shape:stats.shape,
  friendly:true
 });
 reveal(pos.x,pos.y,2);draw();log(`${names[kind]||'Un aliado'} aparece en (${pos.x}, ${pos.y}) y luchará a tu lado durante ${turns} turnos.`,'good')
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
function teleportPlayerTo(x,y){
 if(blocked(x,y)||game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))return false;
 game.player.x=x;game.player.y=y;anim.heroX=anim.targetX=x;anim.heroY=anim.targetY=y;reveal(x,y);return true
}

function applyClassEffectState(effect,id,target,x,y,lvl){
 const p=game.player,d=skillDefs[id],turns=2+Math.floor(lvl/3);
 const area=(r=2)=>game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=r);
 const status=(e,type,t,power,label)=>addEnemyStatus(e,type,t,power,label);
 const hit=(e,m=1)=>attack(e,0,{skillId:id,multiplier:m});

 if(effect==='armorBreak'){hit(target,.9);status(target,'armorBreak',4,.20,'Quebradura');return true}
 if(effect==='pullRoot'){hit(target,.8);const dx=Math.sign(p.x-target.x),dy=Math.sign(p.y-target.y);const nx=target.x+dx,ny=target.y+dy;if(!blocked(nx,ny)&&!game.enemies.some(e=>e!==target&&e.x===nx&&e.y===ny)){target.x=nx;target.y=ny}status(target,'root',2,0,'Inmovilizado');return true}
 if(effect==='counter'){p.shield+=8+lvl*2;p.counterReady={turns:5,damage:'1d8+'+lvl};applyBuff(id,d.name,5,{armor:.12});return true}
 if(effect==='bloodBuff'){const loss=Math.max(1,Math.floor(p.hp*.10));p.hp=Math.max(1,p.hp-loss);applyBuff(id,d.name,5,{damage:.25,dodge:.15});return true}
 if(effect==='lifestealBuff'){applyBuff(id,d.name,6,{lifesteal:.20});return true}
 if(effect==='overcharge'){p.hp=Math.max(1,p.hp-Math.floor(p.hp*.30));p.nextSkillMultiplier=2;return true}
 if(effect==='cheatDeath'){p.cheatDeathTurns=5;return true}
 if(effect==='missingHpNova'){const bonus=1+Math.min(.75,1-p.hp/p.maxHp);for(const e of area(3))hit(e,bonus);return true}
 if(effect==='raiseMark'){status(target,'raiseMark',5,1,'Segunda Muerte');return true}
 if(effect==='holyMark'||effect==='mark'||effect==='bountyMark'){hit(target,.65);status(target,effect,6,effect==='bountyMark'?.5:.2,d.name);return true}
 if(effect==='doomMark'){status(target,'doomMark',5,1,'Mal Presagio');return true}
 if(effect==='doomCountdown'){status(target,'doomCountdown',4,8+lvl*3,'Cuenta final');return true}
 if(effect==='repeatSkill'){p.repeatNextSkill=.60;return true}
 if(effect==='resetCooldowns'){for(const k of Object.keys(p.cooldowns))p.cooldowns[k]=0;p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+Math.ceil(d.cost*.30));return true}
 if(effect==='reveal'){const r=12+lvl;for(let yy=Math.max(0,p.y-r);yy<=Math.min(ROWS-1,p.y+r);yy++)for(let xx=Math.max(0,p.x-r);xx<=Math.min(COLS-1,p.x+r);xx++)if(Math.hypot(xx-p.x,yy-p.y)<=r)game.seen[yy][xx]=true;return true}
 if(effect==='resourceRegen'){p.stamina=Math.min(p.maxStamina,p.stamina+12+lvl*3);applyBuff(id,d.name,4,{staminaRegen:4+lvl});return true}
 if(effect==='cleanseHeal'||effect==='purge'||effect==='absolution'){p.debuff=0;healEntity(p,10+lvl*4);if(effect!=='cleanseHeal')for(const e of area(3))hit(e,.75);return true}
 if(effect==='steal'){hit(target,.65);const roll=rng(3);if(roll===0){const v=5+lvl;healEntity(p,v)}else if(roll===1){p.gold+=5+lvl*2}else{const res=d.resource;p[res]=Math.min(p[res==='mana'?'maxMana':'maxStamina'],p[res]+6+lvl)}return true}
 if(effect==='freeze'){hit(target,.8);status(target,'freeze',2,0,'Congelado');return true}
 if(effect==='stun'||effect==='silence'){hit(target,.75);status(target,effect,effect==='stun'?1:3,0,d.name);return true}
 if(effect==='poison'||effect==='burn'||effect==='bleed'||effect==='dot'||effect==='decayDot'){hit(target,.7);status(target,effect,4,2+lvl*.7,d.name);return true}
 if(effect==='root'||effect==='rootBleed'||effect==='bountyRoot'){hit(target,.7);status(target,'root',2,0,'Inmovilizado');if(effect==='rootBleed')status(target,'bleed',4,2+lvl*.6,'Sangrado');return true}
 return false
}

function applyCreativeClassEffect(id,target,x,y){
 const d=skillDefs[id],lvl=skillLevel(id),effect=d.classEffect,turns=2+Math.floor(lvl/3),p=game.player;
 if(applyClassEffectState(effect,id,target,x,y,lvl))return true;
 const enemiesIn=(radius)=>game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=radius);
 const hit=(e,m=.9)=>attack(e,0,{skillId:id,multiplier:m});
 if(['root','pullRoot','rootBleed','bountyRoot'].includes(effect)){hit(target);addEnemyStatus(target,'root',2+Math.floor(lvl/4),0,'Inmovilizado');if(effect.includes('Bleed'))addEnemyStatus(target,'bleed',4,2+lvl*.5,'Sangrado');return true}
 if(['freeze','delayedFreeze'].includes(effect)){hit(target,.8);addEnemyStatus(target,'freeze',2,0,'Congelado');return true}
 if(['bleed','burn','poison','dot','decayDot','echoDot','delayedPoison'].includes(effect)){hit(target,.75);addEnemyStatus(target,effect.includes('burn')?'burn':effect.includes('poison')?'poison':effect.includes('bleed')?'bleed':'dot',4+Math.floor(lvl/4),2+lvl*.8,d.name);return true}
 if(['drain','holyLeech','steal'].includes(effect)){hit(target,.8);healEntity(p,5+lvl*2);p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+4+lvl);return true}
 if(['stun','silence','age','wither','doomMark','mark','bountyMark','holyMark'].includes(effect)){hit(target,.75);addEnemyStatus(target,effect,2+Math.floor(lvl/5),1,d.name);return true}
 if(['shadowStrike','holyDash','leapBuff'].includes(effect)){teleportPlayerTo(Math.max(1,target.x-Math.sign(target.x-p.x)),Math.max(1,target.y-Math.sign(target.y-p.y)));hit(target,1.15);if(effect==='shadowStrike')addEnemyStatus(target,'bleed',4,2+lvl*.5,'Sangrado');return true}
 if(['hookBleed'].includes(effect)){hit(target,.9);addEnemyStatus(target,'bleed',4,2+lvl*.5,'Sangrado');return true}
 if(['combo','comboMark','markedExecute','bountyExecute','packExecute','pierce','lineShot','ricochet','chain','blinkChain'].includes(effect)){hit(target,effect.includes('Execute')||effect==='markedExecute'?1.7:1.15);return true}
 if(['swapConfuse'].includes(effect)){const ox=p.x,oy=p.y;p.x=target.x;p.y=target.y;target.x=ox;target.y=oy;addEnemyStatus(target,'confuse',2,0,'Confuso');return true}
 if(['teleportDecoy','teleportBuff','randomTeleport','freeTeleport','teleportShield','teleportClones'].includes(effect)){if(!teleportPlayerTo(x,y))return false;applyBuff(id,d.name,3+Math.floor(lvl/3),{armor:.12,damage:.08});if(effect==='teleportClones')summonCompanion('clone',5,1+lvl*.15);return true}
 if(['summon','summonTurret','summonHealer','summonTank','summonScanner','summonElite','multiSummon','clones','clone'].includes(effect)){
  const kind=effect.includes('Turret')?'turret':effect.includes('Healer')?'healer':effect.includes('Tank')?'tank':effect.includes('clone')?'clone':(id==='necromancer_t1_2'||d.classId==='necromancer')?'skeleton':d.classId==='shaman'?'wolf':'companion';
  const n=effect==='multiSummon'||effect==='clones'?2:1;for(let i=0;i<n;i++)summonCompanion(kind,7+lvl,1+lvl*.18);return true
 }
 if(['cleanseHeal','bigHeal','regenHeal','survivalHeal','healShield'].includes(effect)){healEntity(p,10+lvl*4+Math.floor(p.stats.wisdom||p.stats.vitality));if(effect==='healShield')p.shield+=8+lvl*2;applyBuff(id,d.name,3,{maxHp:0});return true}
 if(['buffArmor','counter','bloodBuff','lifestealBuff','rampage','overcharge','fortress','holyShield','holyAvatar','randomBuff','luckBuff','sniperBuff','stealthShot','shapeShift','lichBuff','implantBuff','mechBuff','wisdomBuff','martyrBuff','oakBuff','resourceRegen','reflect','monkAvatar','tauntBuff','beastAvatar','cheatDeath','cheatDeathHeal','rewind'].includes(effect)){
  const armor=effect.includes('Armor')||effect.includes('Shield')||effect.includes('fortress')||effect.includes('Avatar')?.28:.12;
  const damage=effect.includes('blood')||effect.includes('rampage')||effect.includes('overcharge')||effect.includes('Avatar')?.24:.10;
  applyBuff(id,d.name,5+Math.floor(lvl/2),{armor,damage});if(effect.includes('Shield'))p.shield+=8+lvl*3;if(effect.includes('cheatDeath'))p.cheatDeath=1;return true
 }
 const radius=d.tier===3?3:2,targets=enemiesIn(radius);
 if(!targets.length)return false;
 for(const e of targets){hit(e,d.tier===3?1.25:.85);
  if(/root|cage|forest|blackHole/.test(effect))addEnemyStatus(e,'root',2,0,'Inmovilizado');
  if(/freeze|thermal/.test(effect))addEnemyStatus(e,'freeze',2,0,'Congelado');
  if(/burn|plague|dot|storm|rain|decay|nova/.test(effect))addEnemyStatus(e,/burn/.test(effect)?'burn':'dot',3,2+lvl*.6,d.name);
  if(/stun|knockdown|massStun/.test(effect))addEnemyStatus(e,'stun',1+Math.floor(lvl/5),0,'Aturdido');
 }
 return true
}

function playerFinished(){
 busy=true;game.turn++;tickPotionEffects();tickBuffs();tickEnemyStatuses();companionTurn();game.player.stamina=Math.min(game.player.maxStamina,game.player.stamina+(game.player.derived?.staminaRegen||6+Math.floor(game.player.stats.vitality/4)));game.player.mana=Math.min(game.player.maxMana,game.player.mana+(game.player.derived?.manaRegen||4+Math.floor(game.player.stats.wisdom/4)));for(const id in game.player.cooldowns)if(game.player.cooldowns[id]>0)game.player.cooldowns[id]--;if(game.player.shield>0)game.player.shield--;
 updateUI();requestAnimationFrame(animate);
 setTimeout(()=>{enemyTurn();busy=false;updateUI();draw()},500);
}

function permanentDeath(){const p=game.player;game.over=true;try{localStorage.clear()}catch(e){}storyTitle.textContent='GAME OVER';storyBody.innerHTML=`<div class="narrative gameOverBox"><p class="gameOverName"><b>${p.name||'Tu personaje'} ha muerto.</b></p><div class="gameOverStats"><div><span class="small">Nivel de héroe</span><b>${p.level}</b></div><div><span class="small">Nivel de mazmorra</span><b>${game.floor}</b></div></div><p class="small">Muerte permanente: la partida se ha eliminado y no puede continuar.</p><div class="startActions"><button id="restartAfterDeath">Crear nuevo personaje</button></div></div>`;storyOverlay.classList.remove('hidden');setTimeout(()=>document.getElementById('restartAfterDeath')?.addEventListener('click',()=>location.reload()),0)}
function enemyTurn(){if(game.over)return;if(game.player.shadowVeil){game.player.shadowVeil=0;log('El velo de sombras evita la respuesta enemiga.','good');return}
 const visible=game.enemies.filter(e=>game.seen[e.y][e.x]);if(visible.filter(e=>Math.abs(e.x-game.player.x)<=1&&Math.abs(e.y-game.player.y)<=1).length>=3)unlock('crowd','Reunión multitudinaria','Ten 3 enemigos adyacentes.');
 for(const e of [...game.enemies]){
  if(game.over)return;
  if(!game.seen[e.y][e.x])continue;
  if(enemyHasStatus(e,'freeze')||enemyHasStatus(e,'stun')||enemyHasStatus(e,'root')&&Math.abs(e.x-game.player.x)+Math.abs(e.y-game.player.y)>1)continue;
  const possibleTargets=[game.player,...(game.companions||[]).filter(c=>c.hp>0)];
  const chosen=possibleTargets.sort((a,b)=>(Math.abs(e.x-a.x)+Math.abs(e.y-a.y))-(Math.abs(e.x-b.x)+Math.abs(e.y-b.y)))[0];
  const dist=Math.abs(e.x-chosen.x)+Math.abs(e.y-chosen.y);
  if(enemyUseSkill(e,dist))continue;
  if(dist===1&&chosen!==game.player){
   const dmg=Math.max(1,Math.round(e.atk||e.damage||4));chosen.hp-=dmg;floating(`-${dmg}`,chosen.x,chosen.y,'#ff8888');log(`${e.name} golpea a ${chosen.name} por ${dmg}.`,'combat');continue
  }
  if(dist===1){if(e.type==='orcoKamikaze'){floating('¡BOOM!',e.x,e.y,'#ff8b4f');damagePlayer(e.atk+5,'vitality',`${e.name} explota`);e.hp=0;kill(e);continue}damagePlayer(Math.max(1,e.atk-(game.player.debuff||0)-(e.weakened||0)),/wolf|hound|goblin|vamp/i.test(e.type)?'agility':'vitality',`${e.name} ataca`);if(e.type==='vampiro')healEntity(e,3,e.x,e.y);continue}
  if(['chamanGoblin','liche','licheEnloquecido','archiliche'].includes(e.type)&&dist<=5&&Math.random()<.45){damagePlayer(e.atk,/liche|chaman|mage|priest/i.test(e.type)?'wisdom':'intelligence',`${e.name} lanza un ataque mágico`);floating('✦',e.x,e.y,'#be82ff');continue}
  if(dist<8){const opts=Math.random()<.5?[[Math.sign(game.player.x-e.x),0],[0,Math.sign(game.player.y-e.y)]]:[[0,Math.sign(game.player.y-e.y)],[Math.sign(game.player.x-e.x),0]];for(const[mx,my]of opts){const nx=e.x+mx,ny=e.y+my;if(!blocked(nx,ny)&&!isSafeCell(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)&&!(game.player.x===nx&&game.player.y===ny)){e.x=nx;e.y=ny;break}}}
 }
 if(game.player.hp<=0&&!game.over){game.player.hp=0;game.over=true;updateUI();draw();permanentDeath();return}
}

let pendingTargetAction=null;
const AREA_SKILLS=new Set(['smash','quake','ironRain','scrapGrenade','chainSpark','gravityWell','holyCircuit','entropyWave','stormTotem','alchemicalNova','blackSun','worldBreaker','adminOverride','lootSingularity']);
const ENEMY_TARGET_SKILLS=new Set(['arcSlash','ironHook','manaBolt','shockTrap','toxicEdge','spiritWolf','quantumThief','charge','execute']);
function equippedWeapon(){return game?.player?.equipment?.weapon||null}
function weaponIsRanged(item=equippedWeapon()){
 if(!item)return false;
 const text=`${item.name||''} ${item.iconShape||''}`.toLowerCase();
 return /(arco|ballesta|rifle|pistola|rail|smart|cañón|canon|bláster|blaster|fusil|tirador|spear)/.test(text)
}
function weaponRange(item=equippedWeapon()){
 if(!item)return 1;const text=`${item.name||''} ${item.iconShape||''}`.toLowerCase();
 if(/(rifle|arco largo|ballesta|rail|fusil)/.test(text))return 9;
 if(/(pistola|bláster|blaster|cañón|canon|smart)/.test(text))return 7;
 if(/(lanza|spear)/.test(text))return 3;
 return 1
}

function rangeDamageMultiplier(range,area=false){
 range=Math.max(1,Number(range)||1);
 // Cada casilla adicional sacrifica una pequeña parte del daño. Las áreas pagan además por cobertura.
 const distancePenalty=Math.min(.32,(range-1)*.035);
 const areaPenalty=area?.10:0;
 return Math.max(.58,1-distancePenalty-areaPenalty)
}
function attackRangeLabel(){
 const r=weaponRange(),def=inferWeaponDefenseStat(equippedWeapon());
 return `Alcance ${r} casilla${r===1?'':'s'} · defensa: ${attackDefenseLabel(def)} · ${r>1?Math.round(rangeDamageMultiplier(r)*100)+'% daño':'daño completo'}`
}
function skillRangeLabel(id){
 const r=skillRange(id),area=skillTargetMode(id)==='area',pct=Math.round(rangeDamageMultiplier(r,area)*100);
 return `Alcance ${r} · ${area?'Área · ':''}defensa: ${attackDefenseLabel(inferSkillDefenseStat(id))} · ${pct}% daño base`
}

function skillTargetMode(id){
 const d=skillDefs[id];if(!d)return null;
 if(d.targetMode==='self')return null;
 if(d.targetMode==='area')return 'area';
 if(d.targetMode==='enemy')return 'enemy';
 if(d.type==='utility')return null;
 if(AREA_SKILLS.has(id)||['aoe','ultimate','massive','multihit'].includes(d.classEffect))return 'area';
 if(ENEMY_TARGET_SKILLS.has(id)||d.classEffect==='ranged'||d.classEffect==='debuff'||d.classEffect==='execute'||isRangedSkill(id))return 'enemy';
 return null
}
function beginTargeting(action){
 pendingTargetAction=action;updateUI();document.getElementById('waitBtn')?.classList.add('hidden');document.getElementById('cancelTargetBtn')?.classList.remove('hidden');
 document.getElementById('gameStage')?.classList.add('targeting');
 const hint=document.getElementById('targetHint');
 if(hint){hint.textContent=action.mode==='area'?`Selecciona el centro del área · alcance ${action.range} · ESC para cancelar`:`Selecciona un enemigo · alcance ${action.range} · ESC para cancelar`;hint.classList.remove('hidden')}
 closeInspect()
}
function cancelTargeting(message='Apuntado cancelado.'){
 pendingTargetAction=null;document.getElementById('waitBtn')?.classList.remove('hidden');document.getElementById('cancelTargetBtn')?.classList.add('hidden');document.getElementById('gameStage')?.classList.remove('targeting');document.getElementById('targetHint')?.classList.add('hidden');if(message)log(message,'sys')
}
function gridDistance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))}
function validateTargetCell(x,y,range){return game.seen?.[y]?.[x]&&gridDistance(game.player,{x,y})<=range}
function targetedSkillDamage(id){const d=skillDefs[id],lvl=skillLevel(id),stat=d.resource==='mana'?game.player.stats.intelligence+game.player.stats.wisdom/2:game.player.stats.strength+game.player.stats.agility/3;return Math.round((5+lvl*2+stat)*skillPowerMultiplier(id))}
function resolveTargetedSkill(slot,x,y){
 const id=game.player.equippedSkills[slot],d=skillDefs[id];if(!id||!d)return false;
 const range=skillRange(id)||1;if(!validateTargetCell(x,y,range)){log(`Objetivo fuera de alcance (${range}).`,'sys');return false}
 const cd=game.player.cooldowns[id]||0;
 if(cd>0){log('La habilidad está en enfriamiento.','sys');return false}
 if(game.player[d.resource]<d.cost){log(`Necesitas ${d.cost} ${d.resource==='mana'?'de maná':'de stamina'}; tienes ${game.player[d.resource]}.`,'sys');cancelTargeting('');return false}
 const mode=skillTargetMode(id),rangeMult=rangeDamageMultiplier(range,mode==='area'),base=Math.max(1,Math.round(targetedSkillDamage(id)*rangeMult));let used=false;
 if(mode==='enemy'){
  const enemy=game.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);if(!enemy){log('Debes seleccionar un enemigo.','sys');return false}
  if(d.classId&&applyCreativeClassEffect(id,enemy,x,y)){used=true}
  if(used){}else{
  let mult=d.rarity==='legendary'?2.2:d.rarity==='epic'?1.75:d.rarity==='rare'?1.4:1.1;
  if(d.classEffect==='execute'||id==='execute')mult*=enemy.hp/enemy.maxHp<.4?2.35:1;
  attack(enemy,0,{skillId:id,multiplier:mult*rangeMult});
  if(d.classEffect==='debuff'||['shockTrap','ironHook'].includes(id)){enemy.weakened=2+Math.floor(skillLevel(id)/3);enemy.stunned=1}
  if(id==='quantumThief'){healEntity(game.player,6+skillLevel(id));game.player.mana=Math.min(game.player.maxMana,game.player.mana+5+skillLevel(id));game.player.gold+=3+skillLevel(id)}
  used=true}
 }else if(mode==='area'){
  const radius=Math.min(4,1+Math.floor(skillLevel(id)/4)+(d.tier===3?1:0));
  const targets=game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=radius&&game.seen?.[e.y]?.[e.x]);
  if(d.classId&&applyCreativeClassEffect(id,targets[0]||null,x,y)){used=true}
  if(!used&&!targets.length){log('No hay enemigos dentro del área seleccionada.','sys');return false}
  const mult=['blackSun','worldBreaker'].includes(id)||d.classEffect==='massive'?1.65:d.classEffect==='ultimate'?1.35:1;
  if(!used){targets.forEach(e=>attack(e,0,{skillId:id,multiplier:mult*rangeMult*.85}));floating('ÁREA',x,y,'#d989ff');used=true}
 }
 if(!used)return false;
 game.player[d.resource]-=d.cost;game.player.cooldowns[id]=Math.max(1,d.cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');cancelTargeting('');playerFinished();return true
}
function beginBasicAttack(){
 if(!game||busy||game.over)return;
 const weapon=equippedWeapon();
 if(weaponIsRanged(weapon)){beginTargeting({kind:'attack',mode:'enemy',range:weaponRange(weapon)});return}
 const adjacent=game.enemies.filter(e=>gridDistance(game.player,e)<=1);
 if(adjacent.length===1){attack(adjacent[0]);playerFinished()}else if(adjacent.length>1){beginTargeting({kind:'attack',mode:'enemy',range:1})}else log('No hay ningún enemigo al alcance del arma.','sys')
}
function resolveBasicAttack(x,y){
 const range=pendingTargetAction?.range||weaponRange(),enemy=game.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
 if(!enemy){log('Selecciona un enemigo.','sys');return false}
 if(!validateTargetCell(x,y,range)){log(`Enemigo fuera de alcance (${range}).`,'sys');return false}
 attack(enemy,0,{dice:baseAttackDice(),multiplier:rangeDamageMultiplier(range,false)});cancelTargeting('');playerFinished();return true
}

function useSkill(slot){
 if(!game||busy||game.over)return;const id=game.player.equippedSkills[slot];if(!id)return;const def=skillDefs[id],cd=game.player.cooldowns[id]||0;if(cd>0){log('La habilidad está en enfriamiento.','sys');return}if(game.player[def.resource]<def.cost){log(`No tienes suficiente ${def.resource==='mana'?'maná':'stamina'}.`,'sys');return}
 const targetMode=skillTargetMode(id);if(targetMode){beginTargeting({kind:'skill',slot,mode:targetMode,range:skillRange(id)});return}
 const near=(r)=>game.enemies.filter(e=>Math.max(Math.abs(e.x-game.player.x),Math.abs(e.y-game.player.y))<=r);
 let used=!def.classEffect&&skillDefs[id]?.unlock!=='Botín';
 const skillMult=skillPowerMultiplier(id);if(id==='smash'){const a=near(1);if(!a.length)used=false;else a.forEach(e=>attack(e,Math.round(Math.floor(total('armor')/2)*skillMult)))}
 if(id==='fortify'){const turns=4+Math.floor(skillLevel(id)/2);applyBuff(id,'Fortificar',turns,{armor:.30});game.player.shield+=5+Math.floor(game.player.stats.vitality/2);used=true}
 if(id==='charge'){let target=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let n=1;n<=3;n++){const x=game.player.x+dx*n,y=game.player.y+dy*n,e=game.enemies.find(e=>e.x===x&&e.y===y);if(e){target={e,dx,dy,n};break}if(blocked(x,y))break;if(target)break}if(!target)used=false;else{for(let n=1;n<target.n;n++){game.player.x+=target.dx;game.player.y+=target.dy}attack(target.e,Math.round((game.player.stats.strength)*skillMult));reveal(game.player.x,game.player.y)}}
 if(id==='quake'){const a=near(2);if(!a.length)used=false;else a.forEach(e=>attack(e,Math.round((2+game.player.stats.intelligence+Math.floor(game.player.stats.wisdom/2))*skillMult)))}
 if(id==='taunt'){const a=game.enemies.filter(e=>game.seen[e.y][e.x]);if(!a.length)used=false;else{game.player.debuff=2;a.forEach(e=>{if(Math.abs(e.x-game.player.x)>1)e.x+=Math.sign(game.player.x-e.x);if(Math.abs(e.y-game.player.y)>1)e.y+=Math.sign(game.player.y-e.y)});log('Todos te odian un poco más.','combat')}}
 if(id==='execute'){const a=near(1).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(!a)used=false;else attack(a,Math.round((a.hp/a.maxHp<.35?total('damage')*2:2)*skillMult))}
 if(id==='lootMagnet'){let n=0;for(const c of game.chests)if(!c.opened&&Math.abs(c.x-game.player.x)+Math.abs(c.y-game.player.y)<=3){openChest(c);n++}for(const k of [...game.keys])if(Math.abs(k.x-game.player.x)+Math.abs(k.y-game.player.y)<=3){game.keys=game.keys.filter(x=>x!==k);game.player.keys++;n++}if(!n)used=false}
 if(id==='ironRain'){const a=game.enemies.filter(e=>game.seen[e.y][e.x]);if(!a.length)used=false;else for(let i=0;i<Math.min(6,a.length+2);i++)attack(pick(a),Math.round((3+game.player.stats.intelligence+rng(6))*skillMult))}
 


 if(!used&&def.classId&&def.targetMode==='self')used=applyCreativeClassEffect(id,null,game.player.x,game.player.y);
 if(!used&&def.classEffect){
  const lvl=skillLevel(id),power=skillPowerMultiplier(id),visible=visibleEnemiesInRange(def.range||8),nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const base=Math.round((4+lvl*2+(def.resource==='mana'?game.player.stats.intelligence+game.player.stats.wisdom/2:game.player.stats.strength+game.player.stats.agility/3))*power);
  if(def.classEffect==='ranged'&&nearest){attack(nearest,base);used=true}
  else if(def.classEffect==='shield'){const turns=4+Math.floor(lvl/2);applyBuff(id,def.name,turns,{armor:.22+lvl*.01});game.player.shield+=8+lvl*4+Math.floor(game.player.stats.vitality/2);used=true}
  else if(def.classEffect==='dash'&&nearest){const dx=Math.sign(nearest.x-game.player.x),dy=Math.sign(nearest.y-game.player.y);for(let i=0;i<3;i++){const nx=game.player.x+dx,ny=game.player.y+dy;if(blocked(nx,ny)||game.enemies.some(e=>e!==nearest&&e.x===nx&&e.y===ny)||nearest.x===nx&&nearest.y===ny)break;game.player.x=nx;game.player.y=ny}attack(nearest,base);reveal(game.player.x,game.player.y);used=true}
  else if(def.classEffect==='debuff'&&nearest){attack(nearest,base);nearest.weakened=2+Math.floor(lvl/3);used=true}
  else if(def.classEffect==='aoe'){const a=near(2+Math.floor(lvl/5));if(a.length){a.forEach(e=>attack(e,Math.round(base*.8)));used=true}}
  else if(def.classEffect==='heal'){healEntity(game.player,base*2);game.player[def.resource]=Math.min(game.player[def.resource==='mana'?'maxMana':'maxStamina'],game.player[def.resource]+base);used=true}
  else if(def.classEffect==='multihit'&&visible.length){for(let i=0;i<Math.min(3+Math.floor(lvl/3),visible.length+1);i++)attack(pick(visible),Math.round(base*.7));used=true}
  else if(def.classEffect==='utility'){const radius=7+lvl;for(let y=Math.max(0,game.player.y-radius);y<Math.min(ROWS,game.player.y+radius+1);y++)for(let x=Math.max(0,game.player.x-radius);x<Math.min(COLS,game.player.x+radius+1);x++)if(Math.hypot(x-game.player.x,y-game.player.y)<=radius)game.seen[y][x]=true;game.player.shadowVeil=1;used=true}
  else if(def.classEffect==='ultimate'&&visible.length){visible.slice(0,6+lvl).forEach(e=>attack(e,Math.round(base*1.25)));used=true}
  else if(def.classEffect==='execute'&&nearest){attack(nearest,Math.round(base*(nearest.hp/nearest.maxHp<.4?2.5:1)));used=true}
  else if(def.classEffect==='buff'){const turns=6+Math.floor(lvl/2);applyBuff(id,def.name,turns,{damage:.15+lvl*.01,armor:.15+lvl*.01});game.player.shield+=5+lvl*2;used=true}
  else if(def.classEffect==='massive'&&visible.length){visible.forEach(e=>attack(e,Math.round(base*1.7)));used=true}
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
   const candidates=game.inventory.filter(i=>i.type!=='potion').sort((a,b)=>(a.score||0)-(b.score||0));const item=candidates[0];
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
  const lvl=skillLevel(id),base=4+lvl*2+(def.type==='magic'?game.player.stats.intelligence:game.player.stats.strength);
  if(id==='healingPulse'){healEntity(game.player,Math.round((8+lvl*4+game.player.stats.wisdom)*skillMult));used=true}
  else if(['mirrorWard','boneArmor'].includes(id)){game.player.shield+=(id==='boneArmor'?12:8)+lvl*4;used=true}
  else if(id==='bloodRush'){game.player.hp=Math.max(1,game.player.hp-5);game.player.stamina=Math.min(game.player.maxStamina,game.player.stamina+20+lvl*4);used=true}
  else if(id==='quickStep'){used=true}
  else if(nearest){
   if(['blackSun','worldBreaker','alchemicalNova','entropyWave','stormTotem','chainSpark','gravityWell','holyCircuit'].includes(id)){
    const targets=id==='blackSun'?visible:visible.slice(0,Math.min(6,2+lvl));
    targets.forEach(e=>attack(e,Math.round(base*(id==='blackSun'?2.1:1.25)*skillMult)));used=true
   }else{
    attack(nearest,Math.round(base*(def.rarity==='legendary'?2.4:def.rarity==='epic'?1.8:def.rarity==='rare'?1.45:1.15)*skillMult));
    if(id==='shockTrap'||id==='ironHook')nearest.stunned=1;
    if(id==='quantumThief'){healEntity(game.player,5+lvl);game.player.mana=Math.min(game.player.maxMana,game.player.mana+5+lvl);game.player.gold+=2+lvl}
    used=true
   }
  }
 }

 if(!used){log('No hay un objetivo válido.','sys');return}
 game.player[def.resource]-=def.cost;game.player.cooldowns[id]=Math.max(1,skillDefs[id].cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');playerFinished();
}
function equipItem(id){
 const item=game.inventory.find(i=>i.id===id);if(!item)return;let slot=item.slot;if(slot==='ring1'&&game.player.equipment.ring1)slot='ring2';if(slot==='trinket1'&&game.player.equipment.trinket1)slot='trinket2';
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

function updateUI(){
 if(!game)return;const p=game.player;heroName.textContent=p.name.toUpperCase();buildLabel.textContent=`${(p.raceName||raceDefs[p.race]?.name||p.race).toUpperCase()} · ${(p.className||classDefs[p.cls]?.name||p.cls).toUpperCase()} · 🔑 ${p.keys}`;level.textContent=p.level;hpText.textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;hpBar.style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;xpText.textContent=p.level>=LEVEL_CAP?'MÁXIMO':`${p.xp} / ${p.nextXp}`;xpBar.style.width=p.level>=LEVEL_CAP?'100%':`${p.xp/p.nextXp*100}%`;staminaText.textContent=`${p.stamina} / ${p.maxStamina}`;staminaBar.style.width=`${p.stamina/p.maxStamina*100}%`;manaText.textContent=`${p.mana} / ${p.maxMana}`;manaBar.style.width=`${p.mana/p.maxMana*100}%`;floor.textContent=game.floor;damage.textContent=total('damage');armor.textContent=total('armor');gold.textContent=p.gold;const fs=p.derived?.finalStats||p.stats;strength.textContent=fs.strength;vitality.textContent=fs.vitality;agility.textContent=fs.agility;luck.textContent=fs.luck;intelligence.textContent=fs.intelligence;wisdom.textContent=fs.wisdom;themeLabel.textContent=`Zona: ${floorTheme().name}${game.boss?' · PISO DE JEFE':''}`;
 equipmentMini.innerHTML=['weapon','chest','ring1','neck'].map(s=>`<div class="small">${slotNames[s]}: <b>${p.equipment[s]?.name||'—'}</b></div>`).join('');
 inventory.innerHTML=game.inventory.length?game.inventory.map(i=>`<div class="item" onclick="equipItem('${i.id}')"><canvas class="itemThumb" width="48" height="48" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}</b><span class="itemLevel">${slotNames[i.slot]} · ${i.label} · Nivel ${i.itemLevel||1}</span><span class="itemScore">Poder de objeto: ${i.score||0}</span>${describeItem(i)}</div></div>`).join(''):'<p class="small">La mochila solo contiene pelusas.</p>';
 setTimeout(()=>document.querySelectorAll('.itemThumb').forEach(c=>{const it=game.inventory.find(x=>x.id===c.dataset.item);if(it)drawItemIcon(c,it)}),0);
 equipment.innerHTML=`<div class="equipVisual"><canvas id="equipmentHeroCanvas" class="equipmentHeroCanvas" width="128" height="192"></canvas>${slots.map(s=>`<div class="visualSlot vs-${s}"><span class="slotName">${slotNames[s]}</span>${equippedSlotHtml(s,p.equipment[s])}</div>`).join('')}</div>`;
 skills.innerHTML=p.knownSkills.map(id=>[id,skillDefs[id]]).filter(([,d])=>d).map(([id,d])=>{const eq=p.equippedSkills.indexOf(id);return`<div class="skillCard"><b>${d.icon} ${d.name}</b><span class="small">${d.desc}<span class='rangeTag'>${d.type==='utility'?'Utilidad':skillRangeLabel(id)}</span><br>Coste: ${d.cost} ${d.resource==='mana'?'maná':'stamina'} · Daño: ${diceDamageLabel(id)} · <span class='skillLevel'>Nivel ${skillLevel(id)} · ${game.player.skillProgress?.[id]?.xp||0}/${skillXpNeeded(skillLevel(id))} XP</span><div class='skillXpBar'><i style='width:${((game.player.skillProgress?.[id]?.xp||0)/skillXpNeeded(skillLevel(id))*100)}%'></i></div> Aprendida ${eq>=0?`· <span class="equippedTag">Equipada en ${eq+1}</span>`:''}</span><div>${[0,1,2,3].map(n=>`<button onclick="equipSkill('${id}',${n})">${n+1}</button>`).join(' ')}</div></div>`}).join('')||'<p class="small">Todavía no has aprendido habilidades.</p>';
 achievements.innerHTML=[['crowd','Reunión multitudinaria','Tres enemigos adyacentes.'],['chest5','Coleccionista de basura','Abrir cinco cofres.'],['firstBoss','Rey de nada','Derrotar al primer jefe.']].map(a=>`<div class="skillCard ${game.achievements[a[0]]?'':'locked'}"><b>${game.achievements[a[0]]?'✓':'?'} ${a[1]}</b><span class="small">${a[2]}</span></div>`).join('');
 setTimeout(()=>{const ec=document.getElementById('equipmentHeroCanvas');if(ec)drawPaperDoll(ec,p);document.querySelectorAll('[data-equipped-slot]').forEach(c=>{const it=p.equipment[c.dataset.equippedSlot];if(it)drawItemIcon(c,it)})},0);
 mobileSkillbar.innerHTML=`<button class="mobileSkill attackSkill" ${busy?'disabled':''} onclick="beginBasicAttack()"><span class="slotKey">A</span><span class="icon">⚔</span><b>ATACAR</b><span class="costTag">${baseAttackDice()} · ${attackRangeLabel()}</span></button>`+p.equippedSkills.map((id,i)=>{if(!id)return'';const d=skillDefs[id],cd=p.cooldowns[id]||0;return`<button class="mobileSkill" ${cd||busy||p[d.resource]<d.cost?'disabled':''} onclick="useSkill(${i})"><span class="slotKey">${i+1}</span><span class="icon">${d.icon}</span><b>${d.name}</b><span class="costTag">${d.cost} ${d.resource==='mana'?'MP':'STA'} · ${diceDamageLabel(id)} · ${skillRangeLabel(id)}</span>${cd?`<span class="cooldown">${cd}</span>`:''}</button>`}).join('');
 document.getElementById('activeEffects').innerHTML=activeEffectsHtml();updateRestButton();updateGameHud();
}
function animate(){if(anim.t<1){anim.t=Math.min(1,anim.t+.2);draw();requestAnimationFrame(animate)}else draw()}

function drawTargetingOverlay(){
 if(!pendingTargetAction)return;const c=camera(),range=pendingTargetAction.range||1;
 ctx.save();ctx.globalAlpha=.28;
 for(let sy=0;sy<VIEW;sy++)for(let sx=0;sx<VIEW;sx++){const gx=c.x+sx,gy=c.y+sy;if(game.seen?.[gy]?.[gx]&&gridDistance(game.player,{x:gx,y:gy})<=range){ctx.fillStyle=pendingTargetAction.mode==='area'?'#b26cff':'#ffca55';ctx.fillRect(sx*TILE+3,sy*TILE+3,TILE-6,TILE-6)}}
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
 if(!game)return;const c=camera();ctx.clearRect(0,0,640,640);
 for(let sy=0;sy<VIEW;sy++)for(let sx=0;sx<VIEW;sx++){const x=c.x+sx,y=c.y+sy;if(!game.seen[y][x]){px(sx*TILE,sy*TILE,TILE,TILE,'#040306');continue}drawDungeonTile(sx*TILE,sy*TILE,!!game.map[y][x],x,y)}
 const sc=(x,y)=>({x:(x-c.x)*TILE,y:(y-c.y)*TILE});drawSafeRoomOverlay(sc);
 if(game.seen[game.stairs.y][game.stairs.x]){let p=sc(game.stairs.x,game.stairs.y);stairsSprite(p.x,p.y)}
 for(const d of game.doors)if(game.seen[d.y][d.x]){let p=sc(d.x,d.y);doorSprite(p.x,p.y,d)}
 for(const k of game.keys)if(game.seen[k.y][k.x]){let p=sc(k.x,k.y);keySprite(p.x,p.y)}
 for(const chest of game.chests)if(!chest.opened&&game.seen[chest.y][chest.x]){let p=sc(chest.x,chest.y);chestSprite(p.x,p.y)}
 for(const e of game.enemies)if(e.hp>0&&game.seen[e.y]?.[e.x]){let p=sc(e.x,e.y);enemySprite(p.x,p.y,e)}
 for(const ally of game.companions||[])if(ally.hp>0&&ally.turns>0&&game.seen[ally.y]?.[ally.x]){let p=sc(ally.x,ally.y);companionSprite(p.x,p.y,ally)}
 const hx=(anim.heroX+(anim.targetX-anim.heroX)*anim.t-c.x)*TILE,hy=(anim.heroY+(anim.targetY-anim.heroY)*anim.t-c.y)*TILE;heroSprite(hx,hy,pick([0,0]));
 const g=ctx.createRadialGradient(320,320,170,320,320,470);g.addColorStop(0,'#0000');g.addColorStop(1,'#000a');ctx.fillStyle=g;ctx.fillRect(0,0,640,640)
 drawTargetingOverlay();
}
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}

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
 const set=(fill,text,val,max)=>{const f=document.getElementById(fill),t=document.getElementById(text);if(f)f.style.width=`${Math.max(0,Math.min(100,val/max*100))}%`;if(t)t.textContent=`${Math.ceil(val)}/${Math.ceil(max)}`};
 set('hudHpFill','hudHpText',p.hp,p.maxHp);
 set('hudXpFill','hudXpText',p.level>=LEVEL_CAP?1:p.xp,need);if(p.level>=LEVEL_CAP){const t=document.getElementById('hudXpText');if(t)t.textContent='MÁX'}
 set('hudStaminaFill','hudStaminaText',p.stamina,p.maxStamina);
 set('hudManaFill','hudManaText',p.mana,p.maxMana);
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
 const safe=safeRoomAt(gx,gy);if(safe)return{type:'safeRoom',data:safe};if(game.stairs?.x===gx&&game.stairs?.y===gy)return{type:'stairs',data:game.stairs};
 return game.map?.[gy]?.[gx]===0?{type:'floor',data:{x:gx,y:gy}}:{type:'wall',data:{x:gx,y:gy}};
}
function showInspect(entity,clientX,clientY){
 const pop=document.getElementById('inspectPopup'),content=document.getElementById('inspectContent');if(!pop||!content)return;
 let h='';
 if(entity.type==='enemy'){const e=entity.data;h=`<h4>${e.name||'Enemigo'}</h4><p>${e.boss?'Jefe':'Enemigo'}${e.elite?' élite':''}</p><p>Vida: ${Math.max(0,e.hp)}/${e.maxHp}</p><p>Daño estimado: ${e.damage||'?'}</p><p>${enemyDefs[e.type]?.desc||'Una criatura hostil de la mazmorra.'}</p>${e.skills?.length?`<p><b>Habilidades:</b> ${e.skills.map(id=>skillDefs[id]?.name).filter(Boolean).join(' · ')}</p>`:''}`}
 else if(entity.type==='item'){const i=entity.data;h=`<h4>${i.name||'Objeto'}</h4><p>${i.desc||'Objeto encontrado en la mazmorra.'}</p><p>${i.flavor||''}</p>${describeItem(i)}`}
 else if(entity.type==='chest')h=`<h4>Cofre</h4><p>${entity.data.open?'Está vacío.':'Contiene botín aleatorio y puede ocultar habilidades.'}</p>`;
 else if(entity.type==='door')h=`<h4>Puerta ${entity.data.locked?'cerrada':'abierta'}</h4><p>${entity.data.locked?'Necesitas una llave o un efecto especial.':'Puedes atravesarla.'}</p>`;
 else if(entity.type==='safeRoom')h=`<h4>Sala segura</h4><p>Los enemigos no pueden entrar.</p><p>${entity.data.rested?'Ya has descansado aquí.':'Sitúate sobre el fuego central y pulsa DESCANSAR para recuperar toda la vida, stamina y maná.'}</p>`;
 else if(entity.type==='stairs')h=`<h4>Escaleras</h4><p>Conducen al siguiente nivel de la mazmorra.</p>`;
 else if(entity.type==='wall')h=`<h4>Muro</h4><p>Piedra antigua. No parece impresionada por tus credenciales.</p>`;
 else h=`<h4>Suelo explorado</h4><p>Una zona ya revelada de la mazmorra.</p>`;
 content.innerHTML=h;pop.classList.add('open');
 const host=gameCanvasWrap?.getBoundingClientRect?.()||document.getElementById('game').parentElement.getBoundingClientRect();
 pop.style.left=`${Math.min(host.width-310,Math.max(8,clientX-host.left+10))}px`;
 pop.style.top=`${Math.min(host.height-190,Math.max(8,clientY-host.top+10))}px`;
}
function closeInspect(){document.getElementById('inspectPopup')?.classList.remove('open')}


const floorVisualThemes={
 1:{name:'Fortaleza Verde',wall:'#1c2b1d',wallTop:'#304832',floor:'#263927',floorAlt:'#314832',accent:'#8fbf63',fog:'#071009',story:'Fortaleza tomada por trasgos, mercenarios y bestias de los bosques.'},
 2:{name:'Criptas del Duque',wall:'#24202e',wallTop:'#3b3349',floor:'#30283a',floorAlt:'#3b3146',accent:'#b08bd3',fog:'#0b0810',story:'Tumbas antiguas, capillas rotas y corredores bajo una luna que no existe.'},
 3:{name:'Fundición Carmesí',wall:'#3a1d19',wallTop:'#612c20',floor:'#4b241d',floorAlt:'#5c2c22',accent:'#ff8a45',fog:'#120705',story:'Hornos, cadenas, metal fundido y obreros monstruosos al servicio del Tirano.'},
 4:{name:'Archivo del Vacío',wall:'#18162b',wallTop:'#29234b',floor:'#211d3c',floorAlt:'#2c2750',accent:'#66e0df',fog:'#05040c',story:'Bibliotecas imposibles, magia rota y pasillos que olvidan dónde estaban.'}
};
function currentFloorTheme(){return floorVisualThemes[Math.min(4,game.floor)]||floorVisualThemes[4]}

function drawDungeonTile(x,y,wall,gx,gy){
 const t=currentFloorTheme(),seed=(gx*73856093^gy*19349663)>>>0;
 if(wall){
  px(x,y,TILE,TILE,t.wall);px(x,y,TILE,7,t.wallTop);px(x+5,y+9,TILE-10,TILE-14,shade(t.wall,6));
  for(let i=0;i<4;i++){const yy=y+12+i*13,off=((i&1)*8);for(let xx=x-8+off;xx<x+TILE;xx+=24){px(xx,yy,20,2,shade(t.wall,-10));px(xx+19,yy-10,2,12,shade(t.wall,-7))}}
  if(game.floor===3&&seed%7===0){px(x+49,y+8,5,27,'#8b351e');px(x+48,y+7,7,5,'#ff9b45')}
  if(game.floor===4&&seed%8===0){px(x+11,y+12,2,30,t.accent);px(x+8,y+25,8,2,t.accent)}
 }else{
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
function heroSprite(x,y){
 const facing=game.player.facing||1,frame=game.turn%4<2?0:1;
 drawCharacter(ctx,x+32,y+34,1.18,game.player.cls,game.player.equipment,frame,facing)
}
function drawClassPreview(canvas,cls){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=false;q.clearRect(0,0,64,64);
 q.fillStyle='#120c18';q.fillRect(0,0,64,64);
 q.fillStyle='#25182e';for(let i=0;i<4;i++)q.fillRect(i*18,50+(i%2)*3,15,8);
 drawCharacter(q,32,38,.85,cls,{},0,1)
}
function drawPaperDoll(canvas,p){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=false;q.clearRect(0,0,128,192);
 const grad=q.createLinearGradient(0,0,0,192);grad.addColorStop(0,'#21162b');grad.addColorStop(1,'#0d0912');q.fillStyle=grad;q.fillRect(0,0,128,192);
 q.strokeStyle='#493454';q.strokeRect(5,5,118,182);
 for(let y=12;y<188;y+=16){q.fillStyle=y%32?'#16101d':'#1a1222';q.fillRect(8,y,112,1)}
 q.save();q.translate(64,103);q.scale(2.25,2.25);drawCharacter(q,0,0,1,p.cls,p.equipment,game.turn%2,p.facing||1);q.restore();
 q.fillStyle='#e8d8a7';q.font='6px monospace';q.textAlign='center';q.fillText((p.className||'CLASE').toUpperCase().slice(0,20),64,181)
}
function chestSprite(x,y){px(x+8,y+27,48,27,'#553018');px(x+10,y+19,44,15,'#a65d2c');px(x+14,y+21,36,4,'#d38a43');px(x+28,y+24,8,22,'#f2c456');px(x+13,y+47,38,4,'#321b12')}
function stairsSprite(x,y){for(let i=0;i<5;i++){px(x+8+i*5,y+10+i*9,48-i*10,7,shade('#9d8ba8',i*4));px(x+8+i*5,y+17+i*9,48-i*10,2,'#3b3142')}}
function doorSprite(x,y,d){px(x+8,y+5,48,57,'#2b1a16');px(x+11,y+8,42,54,d.open?'#342a23':'#8b4e2c');if(!d.open){for(let i=0;i<3;i++)px(x+15,y+13+i*15,34,3,'#5b301f');px(x+17,y+10,3,48,'#b16d3c');px(x+44,y+10,3,48,'#5e321f');px(x+39,y+34,7,7,d.locked?'#ffd24f':'#271713')}} 
function keySprite(x,y){px(x+14,y+28,27,7,'#d6a832');px(x+37,y+18,16,25,'#f1cb55');px(x+42,y+23,6,6,'#392614');px(x+11,y+23,7,18,'#f1cb55');px(x+7,y+27,7,5,'#f1cb55')}

function companionSprite(x,y,c){
 const shape=c.shape||'allyCompanion';
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 ctx.save();
 ctx.shadowColor='#70dc9b';
 ctx.shadowBlur=9;
 R(8,54,48,5,'#07140d99');

 if(shape==='allySkeleton'){
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
 if(e.elite){ctx.strokeStyle='#d77cff';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54);R(27,6,10,4,'#d77cff')}
 if(e.boss){ctx.strokeStyle='#ffcb57';ctx.lineWidth=3;ctx.strokeRect(x+3,y+3,58,58)}
 if(e.hp<e.maxHp){R(8,4,48,5,'#330d14');R(8,4,48*Math.max(0,e.hp/e.maxHp),5,'#e45c68')}
}



async function fetchConfigItems(){try{const r=await fetch('/api/config-items');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar objetos');configItems=Array.isArray(data)?data:[];renderConfigItems()}catch(e){const st=document.getElementById('configStatus');if(st)st.textContent=`Error cargando config_items: ${e.message}`}}
function currentConfigItemJson(){return {name:configNombre.value.trim()||'Objeto sin nombre',slot:configSlot.value,rarity:configTier.value,label:tierDefs[configTier.value]?.label||configTier.value,itemLevel:Number(configIlvl.value||1),score:Number(configIlvl.value||1)*8,icon:window.currentConfigIconHex||'',stats:configStats.value,affixes:parseConfigStats(configStats.value),passives:[],effects:[],desc:`Configurado · ${configStats.value||'sin stats'}`}}
async function saveConfigItems(items){const r=await fetch('/api/config-items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(items)});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar');await fetchConfigItems();return data}
function renderConfigItems(){const root=document.getElementById('configItemsList');if(!root)return;root.innerHTML=configItems.length?configItems.map(i=>`<div class="configItem"><span class="tierDot" style="background:${tierColor(i.tier)}"></span><b>${i.nombre||'Sin nombre'}</b><span class="small">${slotNames[i.slot]||i.slot} · ${tierDefs[i.tier]?.label||i.tier} · iLvl ${i.ilvl||1}</span></div>`).join(''):'<p class="small">No hay objetos configurados.</p>'}
function setupConfigMode(){const slotSel=document.getElementById('configSlot');if(slotSel&&!slotSel.options.length)slotSel.innerHTML=slots.map(s=>`<option value="${s}">${slotNames[s]}</option>`).join('');const imgInput=document.getElementById('configImageInput'),crop=document.getElementById('configCropCanvas'),preview=document.getElementById('configIconPreview');let img=null,rect=null,start=null;function drawCrop(){const c=crop.getContext('2d');c.clearRect(0,0,320,320);c.fillStyle='#100b16';c.fillRect(0,0,320,320);if(img)c.drawImage(img,0,0,320,320);if(rect){c.strokeStyle='#ffd68b';c.lineWidth=2;c.strokeRect(rect.x,rect.y,rect.w,rect.h)}}function saveIcon(){if(!img||!rect)return;const out=document.createElement('canvas');out.width=out.height=50;out.getContext('2d').drawImage(crop,rect.x,rect.y,rect.w,rect.h,0,0,50,50);preview.getContext('2d').drawImage(out,0,0);fetch(out.toDataURL('image/png')).then(r=>r.arrayBuffer()).then(buf=>{window.currentConfigIconHex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');configIconStatus.textContent='Icono 50x50 listo'})}imgInput.onchange=()=>{const f=imgInput.files?.[0];if(!f)return;img=new Image();img.onload=()=>{rect={x:80,y:80,w:160,h:160};drawCrop();saveIcon()};img.src=URL.createObjectURL(f)};crop.onpointerdown=e=>{const r=crop.getBoundingClientRect();start={x:(e.clientX-r.left)*320/r.width,y:(e.clientY-r.top)*320/r.height};rect={x:start.x,y:start.y,w:1,h:1};drawCrop()};crop.onpointermove=e=>{if(!start)return;const r=crop.getBoundingClientRect(),x=(e.clientX-r.left)*320/r.width,y=(e.clientY-r.top)*320/r.height,size=Math.max(8,Math.min(Math.abs(x-start.x),Math.abs(y-start.y)));rect={x:Math.max(0,Math.min(start.x,x)),y:Math.max(0,Math.min(start.y,y)),w:size,h:size};drawCrop()};crop.onpointerup=()=>{start=null;saveIcon()};saveConfigItemBtn.onclick=async()=>{configStatus.textContent='Guardando...';try{await saveConfigItems([{...currentConfigItemJson(),nombre:configNombre.value,slot:configSlot.value,tier:configTier.value,ilvl:configIlvl.value,item_json:currentConfigItemJson()}]);configStatus.textContent='Objeto guardado.'}catch(e){configStatus.textContent=e.message}};exportConfigJsonBtn.onclick=()=>{const blob=new Blob([JSON.stringify(currentConfigItemJson(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='config-item.json';a.click();URL.revokeObjectURL(a.href)};importConfigJsonInput.onchange=async()=>{const files=[...importConfigJsonInput.files];configStatus.textContent='Importando...';try{const items=[];for(const f of files){const parsed=JSON.parse(await f.text());items.push(...(Array.isArray(parsed)?parsed:[parsed]))}await saveConfigItems(items.map(x=>({...x,item_json:x})));configStatus.textContent=`Importados ${items.length} objeto(s).`}catch(e){configStatus.textContent=e.message}}}

async function fetchDungeonWorlds(){
 const status=document.getElementById('worldStatus'),list=document.getElementById('worldList');if(!status||!list)return;
 status.textContent='Cargando dungeons desde Supabase...';list.innerHTML='';
 try{const r=await fetch('/api/dungeon-worlds');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar las dungeons');
  if(!data.length){status.textContent='No hay dungeons guardadas. Crea una nueva.';return}
  status.textContent=`${data.length} dungeon(s) disponibles.`;
  list.innerHTML=data.map(w=>`<button type="button" class="worldCard" data-world-id="${w.id}"><b>${w.world_name||'Dungeon sin nombre'}</b><span>#${w.id} · ${new Date(w.created_at).toLocaleString()}</span><small>${w.world_json?.floors?.length||0} pisos precomputados</small></button>`).join('');
  list.querySelectorAll('[data-world-id]').forEach(btn=>btn.onclick=()=>{selectedDungeonWorld=data.find(w=>String(w.id)===btn.dataset.worldId);dungeonOverlay.classList.add('hidden');startOverlay.classList.remove('hidden');banner(`DUNGEON #${selectedDungeonWorld.id} SELECCIONADA`)});
 }catch(e){status.textContent=`Error: ${e.message}. Revisa SUPABASE_URL y SUPABASE_ANON_KEY en Vercel.`}
}
async function createDungeonWorld(){
 const btn=document.getElementById('createWorldBtn'),status=document.getElementById('worldStatus'),name=(document.getElementById('worldNameInput')?.value||'Dungeon sin nombre').trim();
 btn.disabled=true;status.textContent='Calculando pisos, enemigos, cofres, eventos y diseño de niveles...';
 try{const world_json=createDungeonWorldJson(name);const r=await fetch('/api/dungeon-worlds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world_name:name,world_json})});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo crear la dungeon');
  selectedDungeonWorld=data;dungeonOverlay.classList.add('hidden');startOverlay.classList.remove('hidden');banner(`DUNGEON #${data.id} CREADA`);
 }catch(e){status.textContent=`Error: ${e.message}`;btn.disabled=false}
}

document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const[x,y]=b.dataset.move.split(',').map(Number);move(x,y)});waitBtn.onclick=()=>{if(waitBtn.dataset.rest==='1')restInSafeRoom();else playerFinished()};cancelTargetBtn.onclick=()=>cancelTargeting();startBtn.onclick=start;createWorldBtn.onclick=createDungeonWorld;landingPlayBtn.onclick=()=>{landingOverlay.classList.add('hidden');app.classList.remove('hidden');dungeonOverlay.classList.remove('hidden');fetchDungeonWorlds();fetchConfigItems()};landingConfigBtn.onclick=()=>{landingOverlay.classList.add('hidden');configScreen.classList.remove('hidden');setupConfigMode();fetchConfigItems()};backToLandingBtn.onclick=()=>{configScreen.classList.add('hidden');landingOverlay.classList.remove('hidden')};



function renderRaceChoices(){
 const root=document.getElementById('raceChoices');
 root.innerHTML=Object.entries(raceDefs).map(([id,r])=>`<div class="choice ${id===selectedRace?'selected':''}" data-race="${id}"><b>${r.name}</b><p class="small">${r.desc}</p><span class="raceTag">${r.origin}</span><p class="small"><strong>Rasgo:</strong> ${r.trait}</p></div>`).join('');
 root.querySelectorAll('[data-race]').forEach(el=>el.onclick=()=>{selectedRace=el.dataset.race;renderRaceChoices()});
}
renderRaceChoices();

function renderClassChoices(){
 const root=document.getElementById('classChoices');
 root.innerHTML=Object.entries(classDefs).map(([id,c])=>`<div class="classCard ${id===selectedClass?'selected':''}" data-class="${id}"><canvas width="64" height="64" data-class-preview="${id}"></canvas><div class="classCopy"><b>${c.name}</b><span class="small">${c.desc}</span><div class="classStats">FUE ${c.stats.strength} · VIT ${c.stats.vitality} · AGI ${c.stats.agility} · SUE ${c.stats.luck} · INT ${c.stats.intelligence} · SAB ${c.stats.wisdom}</div></div></div>`).join('');
 root.querySelectorAll('[data-class-preview]').forEach(c=>drawClassPreview(c,c.dataset.classPreview));
 root.querySelectorAll('[data-class]').forEach(el=>el.onclick=()=>{selectedClass=el.dataset.class;renderClassChoices()});
 const c=classDefs[selectedClass];document.getElementById('classDetail').innerHTML=`<b>${c.name}</b><p>${c.desc}</p><p class="small">Al entrar elegirás una habilidad de Tier I. Después elegirás más en niveles 3, 5, 10, 15, 20, 30 y 40.</p>`;
}
renderClassChoices();

function serializeGame(){
 return JSON.stringify({version:'0.25',savedAt:new Date().toISOString(),game},null,2);
}
function downloadSave(){
 if(!game){alert('Primero inicia una partida.');return}
 const blob=new Blob([serializeGame()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`mazmorra-botin-${game.player.name.replace(/[^a-z0-9_-]/gi,'_')}-piso-${game.floor}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 log('Partida exportada a JSON.','sys');
}
function restoreGame(data){
 if(!data||!data.game||!data.game.player||!data.game.map)throw new Error('El archivo no contiene una partida válida.');
 game=data.game;
 game.player.equipment=Object.assign(Object.fromEntries(slots.map(s=>[s,null])),game.player.equipment||{});
 game.player.cooldowns=game.player.cooldowns||{};
 game.player.knownSkills=game.player.knownSkills||['smash','fortify'];game.player.skillProgress=game.player.skillProgress||{};for(const id of game.player.knownSkills)game.player.skillProgress[id]=game.player.skillProgress[id]||{level:1,xp:0,uses:0};
 game.player.equippedSkills=(game.player.equippedSkills||['smash','fortify',null,null]).slice(0,4);
 while(game.player.equippedSkills.length<4)game.player.equippedSkills.push(null);
 game.player.className=game.player.className||classDefs[game.player.cls]?.name||'Clase desconocida';game.player.raceName=game.player.raceName||raceDefs[game.player.race]?.name||game.player.race;game.player.activePotions=game.player.activePotions||[];game.player.activeBuffs=game.player.activeBuffs||[];game.player.level=Math.min(LEVEL_CAP,game.player.level||1);game.player.nextXp=game.player.level<LEVEL_CAP?xpNeededForLevel(game.player.level):0;game.player.unspentStatPoints=game.player.unspentStatPoints||0;game.player.permanentPotionStats=game.player.permanentPotionStats||{};game.player.raceBonuses=game.player.raceBonuses||{...(raceDefs[game.player.race]?.bonuses||{})};
 game.inventory=game.inventory||[];game.achievements=game.achievements||{};game.safeRooms=game.safeRooms||[];game.companions=game.companions||[];for(const c of game.companions){c.friendly=true;c.hp=c.hp||12;c.maxHp=c.maxHp||c.hp;c.shape=c.shape||'allyCompanion'};game.player.skillChoicesAwarded=game.player.skillChoicesAwarded||{};for(const e of game.enemies||[])e.statuses=e.statuses||[];ensureAttackDefenseMetadata();setTimeout(()=>queueMissingClassSkillChoices(),0);pendingSkillChoices=[];for(const e of game.enemies||[]){e.skills=e.skills||[];e.skillCooldowns=e.skillCooldowns||{}}
 const migrate=i=>{if(!i)return i;i.itemLevel=i.itemLevel||game.player.level||1;i.affixes=i.affixes||[];i.passives=i.passives||[];i.effects=i.effects||[];i.score=i.score||i.power||0;normalizeWeaponIcon(i);return i};
 game.inventory=game.inventory.map(migrate);for(const s of slots)game.player.equipment[s]=migrate(game.player.equipment[s]);recomputeDerived();
 anim.heroX=anim.targetX=game.player.x;anim.heroY=anim.targetY=game.player.y;anim.t=1;
 startOverlay.classList.add('hidden');storyOverlay.classList.add('hidden');busy=false;updateUI();draw();banner('PARTIDA CARGADA');log('Partida restaurada desde JSON.','sys');
}
document.getElementById('saveGameBtn').onclick=downloadSave;
document.getElementById('loadGameInput').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{const data=JSON.parse(await file.text());restoreGame(data)}
 catch(err){alert('No se pudo cargar la partida: '+err.message)}
 finally{e.target.value=''}
};

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.tabview').forEach(x=>x.classList.add('hidden'));document.getElementById(b.dataset.tab).classList.remove('hidden')});
addEventListener('keydown',e=>{const k=e.key.toLowerCase(),m={arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]};if(k==='escape'&&pendingTargetAction){cancelTargeting();return}if(m[k]){e.preventDefault();if(!pendingTargetAction)move(...m[k]);return}if('1234'.includes(k)){e.preventDefault();useSkill(Number(k)-1);return}if(k==='a'){e.preventDefault();beginBasicAttack()}});


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
