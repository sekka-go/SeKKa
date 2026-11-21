export type MapCoordinate = {latitude:number;longitude:number};
const tileSize=256;
const latLimit=85.05112878;
export const mapZoom=(value:number)=>Math.max(9,Math.min(17,Math.round(value)));
export function mapProject(point:MapCoordinate,zoom:number){
 const size=tileSize*Math.pow(2,zoom);
 const lat=Math.max(-latLimit,Math.min(latLimit,point.latitude))*Math.PI/180;
 return {x:(point.longitude+180)/360*size,
  y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*size};
}
export function mapUnproject(x:number,y:number,zoom:number):MapCoordinate {
 const size=tileSize*Math.pow(2,zoom);
 const yy=Math.max(0,Math.min(size,y));
 return {longitude:Math.max(-180,Math.min(180,x/size*360-180)),
  latitude:180/Math.PI*Math.atan(Math.sinh(Math.PI*(1-2*yy/size)))};
}
export function mapMove(center:MapCoordinate,dx:number,dy:number,zoom:number):MapCoordinate {
 const projected=mapProject(center,zoom);
 return mapUnproject(projected.x-dx,projected.y-dy,zoom);
}
export function visibleTiles(center:MapCoordinate,zoom:number,width:number,height:number){
 const {x,y}=mapProject(center,zoom),count=Math.pow(2,zoom);
 const left=x-width/2,top=y-height/2;
 const startX=Math.floor(left/tileSize),lastX=Math.floor((left+width)/tileSize);
 const startY=Math.max(0,Math.floor(top/tileSize)),lastY=Math.min(count-1,Math.floor((top+height)/tileSize));
 const result:{id:string;url:string;left:number;top:number}[]=[];
 for(let row=startY;row<=lastY;row++)for(let col=startX;col<=lastX;col++){
  const wrapped=((col%count)+count)%count;
  result.push({id:zoom+':'+wrapped+':'+row,
   url:'https://tile.openstreetmap.org/'+zoom+'/'+wrapped+'/'+row+'.png',
   left:col*tileSize-left,top:row*tileSize-top});
 }
 return result;
}
