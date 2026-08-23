// Class skills: progression, tier presentation and configurable cast animations.
// Kept separate from the combat engine so class-skill rules have one owner.
const CLASS_SKILL_TIER_COLORS={1:'#55d878',2:'#55a7ff',3:'#bd72ff',4:'#ff5c62'};
const CLASS_SKILL_ANIMATIONS={
 default:{label:'Automática (comportamiento actual)',preview:'shake'},
 shake:{label:'Sacudida de impacto',preview:'shake'},
 flash:{label:'Destello',preview:'flash'},
 pulse:{label:'Pulso mágico',preview:'pulse'},
 projectile:{label:'Proyectil / chispa',preview:'projectile'},
 enemy:{label:'Enemigo (por defecto)',preview:'enemy'}
};
function classSkillTierColor(tier){return CLASS_SKILL_TIER_COLORS[Math.max(1,Math.min(4,Number(tier)||1))]}
function classSkillTierClass(tier){return `class-skill-tier-${Math.max(1,Math.min(4,Number(tier)||1))}`}
function maxSkillTierForLevel(level){return level>=11?4:level>=8?3:level>=5?2:1}
function playClassSkillAnimation(skill,actor='player'){
 const chosen=skill?.animation||'default',key=chosen==='default'?(actor==='enemy'?'enemy':'shake'):chosen;
 if(key==='pulse'&&typeof areaPulse==='function'&&game?.player)areaPulse(game.player.x,game.player.y,2,{color:classSkillTierColor(skill?.tier)});
 else if((key==='projectile'||key==='enemy')&&typeof procFx==='function'){
  const entity=actor==='enemy'?arguments[2]:game?.player;if(entity)procFx(entity.x,entity.y,{color:actor==='enemy'?'#ff596f':classSkillTierColor(skill?.tier),icon:skill?.icon||'✦'});
 }else if(typeof effect==='function')effect(key==='flash'?'flash':'shake');
}
function populateClassSkillAnimationEditor(selected='default'){
 const select=document.getElementById('configSkillAnimation');if(!select)return;
 select.innerHTML=Object.entries(CLASS_SKILL_ANIMATIONS).map(([id,a])=>`<option value="${id}">${a.label}</option>`).join('');
 select.value=CLASS_SKILL_ANIMATIONS[selected]?selected:'default';
}
function previewClassSkillAnimation(){
 const key=document.getElementById('configSkillAnimation')?.value||'default',stage=document.getElementById('configSkillAnimationPreview');if(!stage)return;
 stage.className=`skillAnimationPreview playing preview-${CLASS_SKILL_ANIMATIONS[key]?.preview||'shake'}`;
 stage.innerHTML='<span>✦</span>';setTimeout(()=>stage.classList.remove('playing'),850);
}
