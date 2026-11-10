/* Parent bridge. Accept only height/scroll messages from this exact hosted frame. */
(function () {
  const frame=document.getElementById('rrhs-cfa-preorder-frame');
  if(!frame || frame.dataset.bridgeReady) return;
  frame.dataset.bridgeReady='1';
  const origin=new URL(frame.src).origin;
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow || event.origin!==origin || !event.data) return;
    const data=event.data;
    if(data.type==='rrhs-cfa-preorder-height' && Number.isFinite(data.height) && data.height>0 && data.height<100000) frame.style.height=Math.ceil(data.height)+'px';
    if(data.type==='rrhs-cfa-preorder-scroll' && Number.isFinite(data.top) && data.top>=0 && data.top<=frame.offsetHeight) {
      const header=document.querySelector('.ins-header');
      const inset=header ? header.getBoundingClientRect().height+24 : 24;
      window.scrollTo({top:Math.max(0,frame.getBoundingClientRect().top+window.scrollY+data.top-inset),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
  });
  const request=()=>frame.contentWindow.postMessage({type:'rrhs-cfa-preorder-request-height'},origin);
  frame.addEventListener('load',request);window.addEventListener('pageshow',request);request();
}());
