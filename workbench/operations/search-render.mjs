// Keep the focused search field connected while its surrounding results change.
// Replacing or refocusing it resets the user's keyboard mode on mobile Safari.
export function renderSearchPage(main,markup,sameView){
  const document=main.ownerDocument;
  const next=document.createElement('template');
  next.innerHTML=markup;
  const input=main.querySelector('#view-query');
  const tools=input?.closest('.work-tools');
  const nextTools=next.content.querySelector('#view-query')?.closest('.work-tools');
  if(!sameView||document.activeElement!==input||tools?.parentNode!==main||nextTools?.parentNode!==next.content){
    main.replaceChildren(next.content);
    return;
  }
  const before=document.createDocumentFragment(),after=document.createDocumentFragment();
  while(next.content.firstChild!==nextTools)before.append(next.content.firstChild);
  while(nextTools.nextSibling)after.append(nextTools.nextSibling);
  while(main.firstChild!==tools)main.firstChild.remove();
  while(tools.nextSibling)tools.nextSibling.remove();
  main.insertBefore(before,tools);
  main.append(after);
}
