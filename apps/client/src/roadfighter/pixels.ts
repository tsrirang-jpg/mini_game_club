import {RoadEngine,ROAD} from './engine';
type C=CanvasRenderingContext2D;
const CAR=[
'...kkkkkk...','..kcccccck..','..kcwwwwck..','.kkcwwwwckk.','.bkcccccckb.','.bkcccccckb.','..kcssssck..','..kcssssck..','..kcssssck..','..kcccccck..','..kcccccck..','.bkcccccckb.','.bkcwwwwckb.','.kkcwwwwckk.','..kcccccck..','..kcrrrrck..','...kkkkkk...'];
function sprite(ctx:C,rows:readonly string[],x:number,y:number,palette:Record<string,string>,scale=1){for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++){const color=palette[rows[r][c]];if(color){ctx.fillStyle=color;ctx.fillRect(Math.round(x+c*scale),Math.round(y+r*scale),scale,scale);}}}
export function drawCar(ctx:C,x:number,y:number,color:string){sprite(ctx,CAR,x-6,y-8,{k:'#121612',b:'#060909',c:color,w:'#f5efd5',s:'#123344',r:'#cb2833'});}
function tree(ctx:C,x:number,y:number,scale=1){sprite(ctx,['....kk....','...kggk...','..kggggk..','.kgglgggk.','kggllggggk','kglggggggk','.kggggggk.','..kkggkk..','....bb....','....bb....'],x,y,{k:'#063311',g:'#0b6c20',l:'#1faa32',b:'#62351d'},scale);}
function house(ctx:C,x:number,y:number){ctx.fillStyle='#15320e';ctx.fillRect(x+4,y+3,24,34);ctx.fillStyle='#efe6b6';ctx.fillRect(x,y+10,22,20);ctx.fillStyle='#c92e25';ctx.fillRect(x-2,y+2,26,10);ctx.fillStyle='#f5d49c';for(let i=0;i<6;i++){ctx.fillRect(x+i*4,y+4+(i%2)*2,2,2);ctx.fillRect(x+i*4,y+8-(i%2)*2,2,2);}ctx.fillStyle='#2b4028';ctx.fillRect(x+4,y+16,4,5);ctx.fillRect(x+14,y+16,4,5);ctx.fillRect(x+10,y+24,5,6);}
function fuel(ctx:C,x:number,y:number){ctx.fillStyle='#171b13';ctx.fillRect(x-6,y-8,13,18);ctx.fillStyle='#f02733';ctx.fillRect(x-5,y-6,10,14);ctx.fillStyle='#fbf4db';ctx.fillRect(x-2,y-9,6,3);ctx.fillRect(x-2,y-3,1,7);ctx.fillRect(x-1,y-3,3,1);ctx.fillRect(x+1,y-2,1,2);ctx.fillRect(x-1,y,3,1);}
export function paintRoad(ctx:C,game:RoadEngine,preview=false){
  const h=game.height,scroll=game.scroll;ctx.imageSmoothingEnabled=false;
  ctx.fillStyle=game.stage===2?'#68b936':'#79d827';ctx.fillRect(0,0,ROAD.width,h);
  ctx.fillStyle='#525455';ctx.fillRect(ROAD.left,0,ROAD.right-ROAD.left,h);
  ctx.fillStyle='#a0a0a0';ctx.fillRect(0,0,17,h);ctx.fillStyle='#e9ead7';ctx.fillRect(17,0,2,h);ctx.fillStyle='#0e1810';ctx.fillRect(20,0,6,h);
  if(game.stage===1){ctx.fillStyle='#1688ef';ctx.fillRect(0,0,27,h);for(let y=-12;y<h;y+=24){ctx.fillStyle='#d1f4ff';ctx.fillRect(5,(y+scroll*.65)%h,3,2);}}
  for(let y=-24;y<h+24;y+=24){const at=Math.floor(y+scroll%24);ctx.fillStyle=(Math.floor((y+24)/24)%2===0)?'#eee8c9':'#e52e31';ctx.fillRect(ROAD.left-5,at,5,24);ctx.fillRect(ROAD.right,at,5,24);}
  ctx.fillStyle='#f3f0d5';for(let y=-40;y<h+40;y+=42)ctx.fillRect(139,Math.floor(y+scroll%42),3,19);
  for(let i=-2;i<Math.ceil(h/95)+2;i++){const y=Math.floor(i*95+scroll*.8%95);if(i%2===0)house(ctx,35,y+20);else{tree(ctx,35,y+15,2);tree(ctx,53,y+62);}tree(ctx,225,y+5,2);tree(ctx,240,y+55);ctx.fillStyle='#4aac1d';ctx.fillRect(30,y+67,2,3);ctx.fillRect(222,y+68,2,3);}
  if(preview){drawCar(ctx,106,h*.25,'#ffe438');drawCar(ctx,177,h*.36,'#1768ef');fuel(ctx,200,h*.61);drawCar(ctx,140,h*.79,'#f12432');return;}
  for(const car of game.traffic)drawCar(ctx,car.x,car.y,car.color);
  for(const pickup of game.pickups)fuel(ctx,pickup.x,pickup.y);
  if(game.shield===0||Math.floor(game.shield*9)%2===0)drawCar(ctx,game.playerX,game.playerY,game.phase==='crashed'?'#ff9028':'#f32636');
}
