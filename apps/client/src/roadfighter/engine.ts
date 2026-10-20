export type Difficulty='easy'|'normal'|'hard';
export type RacePhase='countdown'|'running'|'paused'|'crashed'|'finished'|'gameover';
export type Control='left'|'right'|'accelerate'|'brake';
export interface Traffic {id:number;x:number;y:number;speed:number;color:string;passed:boolean}
export interface FuelPickup {x:number;y:number}
export const ROAD={width:256,left:70,right:211,carWidth:12,carHeight:20,stageDistance:4000,stages:3};
export const STAGES=[{name:'GREEN VALLEY',label:'หุบเขาสีเขียว'},{name:'RIVERSIDE',label:'เส้นทางเลียบแม่น้ำ'},{name:'SUNSET RUN',label:'ทางหลวงยามเย็น'}] as const;
export const DIFFICULTIES={easy:{label:'ง่าย',maxSpeed:200,traffic:2.5,fuelRate:.7,hitCost:12},normal:{label:'ปกติ',maxSpeed:240,traffic:1.9,fuelRate:1,hitCost:18},hard:{label:'ยาก',maxSpeed:260,traffic:1.35,fuelRate:1.25,hitCost:24}};
export interface RaceView {phase:RacePhase;speed:number;fuel:number;score:number;time:number;distance:number;stage:number;stageDistance:number;overtakes:number;crashes:number;countdown:number;playerX:number;pickupCount:number;reason:string}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export class RoadEngine {
  phase:RacePhase='countdown';speed=0;fuel=100;score=0;time=0;distance=0;stage=0;overtakes=0;crashes=0;pickupCount=0;reason='';
  playerX=140;height=320;scroll=0;countdown=3;shield=0;traffic:Traffic[]=[];pickups:FuelPickup[]=[];
  controls:Record<Control,boolean>={left:false,right:false,accelerate:false,brake:false};
  private crashTime=0;private spawnTime=.6;private fuelAt=300;private sequence=0;private prior:RacePhase='running';
  constructor(public readonly difficulty:Difficulty='normal',private readonly random:()=>number=Math.random){}
  get playerY(){return this.height-42;}
  get stageDistance(){return Math.min(ROAD.stageDistance,this.distance-this.stage*ROAD.stageDistance);}
  get view():RaceView{return {phase:this.phase,speed:this.speed,fuel:this.fuel,score:Math.floor(this.score),time:this.time,distance:this.distance,stage:this.stage,stageDistance:this.stageDistance,overtakes:this.overtakes,crashes:this.crashes,countdown:Math.ceil(this.countdown),playerX:this.playerX,pickupCount:this.pickupCount,reason:this.reason};}
  resize(height:number){const next=clamp(Math.round(height),128,768),ratio=next/this.height;for(const car of this.traffic)car.y*=ratio;for(const pickup of this.pickups)pickup.y*=ratio;this.height=next;}
  clearControls(){for(const key of Object.keys(this.controls) as Control[])this.controls[key]=false;}
  pause(){if(['countdown','running','crashed'].includes(this.phase)){this.prior=this.phase;this.phase='paused';this.clearControls();}}
  resume(){if(this.phase==='paused')this.phase=this.prior;}
  togglePause(){if(this.phase==='paused')this.resume();else this.pause();}
  step(dt:number){
    if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);
    if(['paused','finished','gameover'].includes(this.phase))return;
    if(this.phase==='countdown'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0)this.phase='running';return;}
    if(this.phase==='crashed'){this.crashTime-=dt;if(this.crashTime<=0){this.phase='running';this.shield=2;}return;}
    const config=DIFFICULTIES[this.difficulty];this.time+=dt;this.shield=Math.max(0,this.shield-dt);
    const offRoad=this.playerX<ROAD.left+5||this.playerX>ROAD.right-5;
    const acceleration=this.controls.brake?-105:this.controls.accelerate?55:this.speed<90?25:-5;
    this.speed=clamp(this.speed+acceleration*dt,0,offRoad?90:config.maxSpeed);
    const steer=(Number(this.controls.right)-Number(this.controls.left))*(55+this.speed*.22);
    this.playerX=clamp(this.playerX+steer*dt,ROAD.left-13,ROAD.right+13);
    const meters=this.speed/3.6*dt;this.distance+=meters;this.scroll+=this.speed*.42*dt;this.score+=meters*2;
    this.fuel=clamp(this.fuel-(.55+this.speed/210)*config.fuelRate*(offRoad?2:1)*dt,0,100);
    this.spawnTime-=dt;
    if(this.spawnTime<=0&&this.speed>20){
      const lane=Math.floor(this.random()*3);this.traffic.push({id:++this.sequence,x:ROAD.left+22+lane*47,y:-25,speed:35+this.random()*35,color:['#ffe332','#1768ef','#f6f4dc'][Math.floor(this.random()*3)],passed:false});
      this.spawnTime=config.traffic*(.8+this.random()*.4)/(1+this.stage*.12);
    }
    if(this.distance>=this.fuelAt){this.pickups.push({x:ROAD.left+14+this.random()*(ROAD.right-ROAD.left-28),y:-15});this.fuelAt=this.distance+340+this.random()*130;}
    let hit=false;
    for(const car of this.traffic){
      car.y+=(this.speed-car.speed)*.48*dt;
      if(!car.passed&&car.y>this.playerY+ROAD.carHeight){car.passed=true;this.overtakes++;this.score+=100;}
      if(this.shield===0&&Math.abs(car.x-this.playerX)<10&&Math.abs(car.y-this.playerY)<17)hit=true;
    }
    this.traffic=this.traffic.filter(car=>car.y<this.height+35&&car.y> -100);
    for(const pickup of this.pickups){pickup.y+=this.speed*.48*dt;if(Math.abs(pickup.x-this.playerX)<12&&Math.abs(pickup.y-this.playerY)<17){this.fuel=clamp(this.fuel+30,0,100);this.score+=300;this.pickupCount++;pickup.y=this.height+50;}}
    this.pickups=this.pickups.filter(p=>p.y<this.height+20);
    if(hit){this.crashes++;this.fuel=clamp(this.fuel-config.hitCost,0,100);this.speed*=.35;this.phase='crashed';this.crashTime=.8;this.traffic=this.traffic.filter(car=>Math.abs(car.y-this.playerY)>30);}
    if(this.fuel<=0){this.phase='gameover';this.reason='น้ำมันหมด';this.clearControls();return;}
    if(this.distance>=(this.stage+1)*ROAD.stageDistance){
      if(this.stage===ROAD.stages-1){this.distance=ROAD.stageDistance*ROAD.stages;this.score+=2000;this.phase='finished';this.reason='ถึงเส้นชัยแล้ว!';this.clearControls();}
      else{this.stage++;this.fuel=clamp(this.fuel+20,0,100);this.score+=1000;this.traffic=[];this.pickups=[];this.shield=2;}
    }
  }
}
