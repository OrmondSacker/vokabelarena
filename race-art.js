"use strict";

function raceForest() {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  const block = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  let seed = 2387;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  block('#253f42', 0, 0, 400, 260);
  const moss = ['#2c4948', '#34534d', '#465852', '#23393e', '#4e6051'];
  for (let i = 0; i < 2350; i++) {
    block(moss[i % moss.length], random()*400, random()*260, 2 + Math.floor(random()*9), 1 + Math.floor(random()*4));
  }
  const points = Array.from({length: 310}, () => ({
    x: Math.floor(random()*414)-7,
    y: Math.floor(random()*274)-7,
    size: 10 + Math.floor(random()*18),
    warm: random() > .55
  })).sort((a,b) => a.y-b.y);
  for (const {x,y,size,warm} of points) {
    block('#172932', x-4, y-2, 18, 6);
    block('#765d4f', x-1, y-7, 3, 9);
    for (let row = 0; row < size; row++) {
      const tier = Math.floor(row*3/size);
      const width = 1 + tier + Math.floor(((row*3)%size)*5/size);
      const top = y-size+row;
      block('#142932', x-width-1, top, width*2+3, 1);
      block(warm ? '#49644f' : '#355b55', x-width, top, width+2, 1);
      block(warm ? '#283f3a' : '#24423f', x+2, top, width-1, 1);
      if (row % 5 === 3) block(warm ? '#84936a' : '#577d64', x-width, top, 3, 1);
    }
  }
  for (let i=0;i<55;i++) {
    const x=random()*394,y=random()*255;
    block('#26343d',x,y,6,3);
    block('#6b7370',x,y-2,4,3);
    block('#91918a',x,y-2,2,1);
  }
  return canvas;
}

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
