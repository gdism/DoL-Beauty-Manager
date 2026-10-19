(() => {
const owner='DoLBeautyManager';
modUtils.getAddonPluginManager().registerAddonPlugin(owner,'HostBootstrap',{
 afterInjectEarlyLoad:async()=>{
  const mod=modUtils.getMod(owner);
  if(window.addonBeautySelectorAddon){
   mod.bootJson.addonPlugin=mod.bootJson.addonPlugin||[];
   if(!mod.bootJson.addonPlugin.some(p=>p.modName==='BeautySelectorAddon'))mod.bootJson.addonPlugin.push({modName:'BeautySelectorAddon',addonName:'BeautySelectorAddon',modVersion:'^2.9.0',params:{type:'DoLBeautyManager/managed'}});
  }
 }
});
})();
