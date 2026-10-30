/* Round visible numbers only; keep the original values for rules and saves. */
(function(root){
  'use strict';
  function formatGameText(value){
    return String(value).replace(/([+\-−]?)(\d+\.\d+(?:e[+-]?\d+)?|\d+e[+-]?\d+)/gi,(match,sign,digits)=>{
      const number=Number(digits);
      if(!Number.isFinite(number))return match;
      // Ignore floating-point noise around a rounding boundary (e.g. 3.4499999999999997).
      const rounded=Math.round((number+Number.EPSILON*Math.max(1,number)*4)*10)/10;
      return (rounded===0&&sign!=='+'?'':sign)+String(rounded);
    });
  }
  root.formatGameText=formatGameText;
  if(typeof module!=='undefined')module.exports=formatGameText;
})(typeof window!=='undefined'?window:globalThis);
