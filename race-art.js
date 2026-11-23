"use strict";

function raceSprite(id, color) {
  // Individual pixel clusters give the six cars distinct silhouettes at board scale.
  const art = [
    [
      '       pp pp            ',
      '       pPPPPp           ',
      '       pGgGgp           ',
      '       pPPPPpp          ',
      '        pPsssp          ',
      '   y    ppSSsp          ',
      '  yy  wwwppppwwwwww     ',
      '  ywwwttttttttttttww    ',
      '  wttTTTTTTTTTTTTTtw    ',
      '  wTtttttttttttttYtw    ',
      '   tTTTTTTTTTTTTTYt     ',
      '   otttttttttttttto     ',
      '   oGGGooooooooGGGo     ',
      '    GyG        GyG      '
    ],[
      '           w  w         ',
      '           wwww         ',
      '            ww          ',
      '       oooo ww          ',
      '      orrro ww  ggg     ',
      '    ooooooooooo gGg     ',
      '   oRRRRRRRRRRRooooo    ',
      '   oRwwRRRRwwRRRRRRo    ',
      '   oRRRRRRRRRRRRRYRo    ',
      '   oRRRRRRRRRRRgggRo    ',
      '   oRRRRRRRRRRRRRYRo    ',
      '   ooooooooooooooooo    ',
      '    GGG        GGG      ',
      '    GyG        GyG      '
    ],[
      '        ssssssss        ',
      '      ssSSSSSSSSss      ',
      '       wSSSSSSSSw       ',
      '       wwwwwwwwww       ',
      '          oo            ',
      '   ooooooooooooo        ',
      '   oYYYYYYYYYYYo oo     ',
      '   oYgggggggYYYooGGo    ',
      '   oYgsgsgsgYYYoGGGo    ',
      '   oYwwwwwwwYYYYYYwo    ',
      '   ossssssssssssssso    ',
      '   ooooooooooooooooo    ',
      '    GGG        GGG      ',
      '    GyG        GyG      '
    ],[
      '                        ',
      '          yyy           ',
      '          y y           ',
      '       oooooooo         ',
      '     ooCCCCCCCCoo       ',
      '     oCYCCCCCCYCo       ',
      '    ooCYCCCCCCYCooo     ',
      '   oCCCYCCCCCCYCGGGo    ',
      '   oCCCYCCCCCCYCGGGo    ',
      '   oCCCYCCCCCCYCCYCo    ',
      '   oCCCyCCCCCCyCCYCo    ',
      '    ooooooooooooooo     ',
      '    GGG        GGG      ',
      '    GyG        GyG      '
    ],[
      '                        ',
      '     oooooooooo         ',
      '    oCwwwwwwwwCo        ',
      '    oCCCCCCCCCCo        ',
      '    oCYYCCCCYYCo        ',
      '    oCYYCCCCYYCo oo     ',
      '    oCCCCCCCCCCooGGo    ',
      '    oCCCwwwwCCCoGGGo    ',
      '    oCCCCCCCCCCCCYCo    ',
      '    oCCCCCCCCCCCCoCo    ',
      '   oooooooooooooooo     ',
      '    GYGG      GGYG      ',
      '    GGGG      GGGG      ',
      '     GG        GG       '
    ],[
      '         ww             ',
      '        ww              ',
      '           ww           ',
      '        oooo            ',
      '      wwCCCCww          ',
      '    wwCCCCCCCCwo        ',
      '   oCCCCCCCCCCCo    o   ',
      '  owoCCCCCCCCCCoooooo   ',
      '  o oCCGGGCCCCCCwwwo    ',
      '  oooCCCCCCCCCCw        ',
      '   oCCCCCCCCCwo         ',
      '   oooooooooooooooo     ',
      '    GGG        GGG      ',
      '    GyG        GyG      '
    ]
  ];
  const ink = {p:'#a6515e',P:'#f8a08f',s:'#a74737',S:'#e97e51',G:'#263043',g:'#577786',y:'#ac7b2a',Y:'#ffe08d',o:'#241c31',w:'#fff0ce',t:'#227975',T:'#48c3ae',r:'#a83540',R:'#e85b50',C:color};
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 14;
  const ctx = canvas.getContext('2d');
  art[id].forEach((row,y) => [...row].forEach((pixel,x) => {
    if (!ink[pixel]) return;
    ctx.fillStyle = ink[pixel];
    ctx.fillRect(x,y,1,1);
  }));
  return canvas.toDataURL();
}
