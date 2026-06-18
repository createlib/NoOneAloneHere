'use client';
/**
 * ImageAnnotationEditor — pure HTML5 Canvas
 * ツール: 選択 / 矩形 / 円 / 直線 / 矢印 / テキスト / カーソルスタンプ
 * タッチ操作 (スマホ) 完全対応版
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Square, ArrowUpRight, Type, Undo2, Trash2, Check, Minus, MousePointer2, Move, Circle } from 'lucide-react';

const SB='#1a3024',SAGE='#4a7c59',LIME='#8ecfb2',BG='#f8f6f3',T1='#2a2520',T2='#7a7068';
const PRESETS=['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#ffffff','#000000','#1a3024'];

export type Tool='select'|'rect'|'circle'|'line'|'arrow'|'text'|'cursor';
type DragMode='move'|'nw'|'ne'|'sw'|'se'|'p1'|'p2';

export type Ann=
  |{k:'rect';  x:number;y:number;w:number;h:number;  stroke:string;fill:string;sw:number}
  |{k:'circle';cx:number;cy:number;rx:number;ry:number;stroke:string;fill:string;sw:number}
  |{k:'line';  x1:number;y1:number;x2:number;y2:number;c:string;sw:number}
  |{k:'arrow'; x1:number;y1:number;x2:number;y2:number;c:string;sw:number}
  |{k:'text';  x:number;y:number;t:string;c:string;fs:number}
  |{k:'cursor';x:number;y:number;fs:number};

interface DragState{mode:DragMode;sx:number;sy:number;origAnn:Ann;}
export interface Props{
  file:File;
  onConfirm:(f:File,overwriteUrl?:string)=>void;
  onCancel:()=>void;
  galleryProgress?:{current:number;total:number};
  /** 既存アップロード済み画像URL。指定するとこのURLを上書き編集モードになる */
  overwriteUrl?:string;
}

/* ── drawing ──────────────────────────────────────────────────── */
function drawAnn(ctx:CanvasRenderingContext2D,a:Ann){
    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    if(a.k==='rect'){
        if(a.fill&&a.fill!=='transparent'){ctx.fillStyle=a.fill;ctx.fillRect(a.x,a.y,a.w,a.h);}
        if(a.stroke){ctx.strokeStyle=a.stroke;ctx.lineWidth=a.sw;ctx.strokeRect(a.x,a.y,a.w,a.h);}
    } else if(a.k==='circle'){
        ctx.beginPath(); ctx.ellipse(a.cx,a.cy,Math.max(1,a.rx),Math.max(1,a.ry),0,0,Math.PI*2);
        if(a.fill&&a.fill!=='transparent'){ctx.fillStyle=a.fill;ctx.fill();}
        if(a.stroke){ctx.strokeStyle=a.stroke;ctx.lineWidth=a.sw;ctx.stroke();}
    } else if(a.k==='line'){
        ctx.strokeStyle=a.c;ctx.lineWidth=a.sw;
        ctx.beginPath();ctx.moveTo(a.x1,a.y1);ctx.lineTo(a.x2,a.y2);ctx.stroke();
    } else if(a.k==='arrow'){
        const dx=a.x2-a.x1,dy=a.y2-a.y1,len=Math.hypot(dx,dy);
        if(len<2){ctx.restore();return;}
        const ang=Math.atan2(dy,dx),hd=Math.max(a.sw*5,14);
        ctx.strokeStyle=a.c;ctx.lineWidth=a.sw;
        ctx.beginPath();ctx.moveTo(a.x1,a.y1);
        ctx.lineTo(a.x2-Math.cos(ang)*hd*.55,a.y2-Math.sin(ang)*hd*.55);ctx.stroke();
        ctx.fillStyle=a.c;ctx.beginPath();ctx.moveTo(a.x2,a.y2);
        ctx.lineTo(a.x2-hd*Math.cos(ang-Math.PI/6),a.y2-hd*Math.sin(ang-Math.PI/6));
        ctx.lineTo(a.x2-hd*Math.cos(ang+Math.PI/6),a.y2-hd*Math.sin(ang+Math.PI/6));
        ctx.closePath();ctx.fill();
    } else if(a.k==='text'){
        ctx.font=`bold ${a.fs}px sans-serif`;ctx.textBaseline='top';
        ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=a.fs*.07;ctx.strokeText(a.t,a.x,a.y);
        ctx.fillStyle=a.c;ctx.fillText(a.t,a.x,a.y);
    } else if(a.k==='cursor'){
        const s=a.fs/18;
        ctx.translate(a.x,a.y);
        ctx.beginPath();
        ctx.moveTo(1*s,0);   ctx.lineTo(1*s,16*s); ctx.lineTo(5*s,12*s);
        ctx.lineTo(8*s,20*s);ctx.lineTo(11*s,19*s);ctx.lineTo(8*s,10.5*s);
        ctx.lineTo(14*s,10.5*s); ctx.closePath();
        ctx.strokeStyle='#fff';ctx.lineWidth=s*2.2;ctx.stroke();
        ctx.fillStyle='#111';ctx.fill();
    }
    ctx.restore();
}

/* ── bbox / handles / hit ────────────────────────────────────── */
function bbox(a:Ann):{x:number;y:number;w:number;h:number}{
    if(a.k==='rect')  return {x:a.x,y:a.y,w:a.w,h:a.h};
    if(a.k==='circle')return {x:a.cx-a.rx,y:a.cy-a.ry,w:a.rx*2,h:a.ry*2};
    if(a.k==='line'||a.k==='arrow'){
        const p=a.sw+4;
        return {x:Math.min(a.x1,a.x2)-p,y:Math.min(a.y1,a.y2)-p,w:Math.abs(a.x2-a.x1)+p*2,h:Math.abs(a.y2-a.y1)+p*2};
    }
    if(a.k==='text')   return {x:a.x,y:a.y,w:a.t.length*a.fs*.55,h:a.fs*1.4};
    if(a.k==='cursor') return {x:a.x,y:a.y,w:a.fs*.9,h:a.fs*1.25};
    return {x:0,y:0,w:0,h:0};
}
function handles(a:Ann):{x:number;y:number;m:DragMode}[]{
    if(a.k==='rect')
        return [{x:a.x,y:a.y,m:'nw'},{x:a.x+a.w,y:a.y,m:'ne'},{x:a.x,y:a.y+a.h,m:'sw'},{x:a.x+a.w,y:a.y+a.h,m:'se'}];
    if(a.k==='circle')
        return [{x:a.cx-a.rx,y:a.cy-a.ry,m:'nw'},{x:a.cx+a.rx,y:a.cy-a.ry,m:'ne'},
                {x:a.cx-a.rx,y:a.cy+a.ry,m:'sw'},{x:a.cx+a.rx,y:a.cy+a.ry,m:'se'}];
    if(a.k==='line'||a.k==='arrow') return [{x:a.x1,y:a.y1,m:'p1'},{x:a.x2,y:a.y2,m:'p2'}];
    return [];
}
function hitHandle(a:Ann,x:number,y:number,tol=9):DragMode|null{
    for(const h of handles(a)) if(Math.hypot(x-h.x,y-h.y)<=tol) return h.m;
    return null;
}
function hitBody(a:Ann,x:number,y:number):boolean{
    const P=12; // タッチ操作のため余白を増やす
    if(a.k==='rect') return x>=a.x-P&&x<=a.x+a.w+P&&y>=a.y-P&&y<=a.y+a.h+P;
    if(a.k==='circle'){const dx=(x-a.cx)/Math.max(a.rx+P,1),dy=(y-a.cy)/Math.max(a.ry+P,1);return dx*dx+dy*dy<=1;}
    if(a.k==='line'||a.k==='arrow'){
        const dx=a.x2-a.x1,dy=a.y2-a.y1,l2=dx*dx+dy*dy;if(!l2)return false;
        const t=Math.max(0,Math.min(1,((x-a.x1)*dx+(y-a.y1)*dy)/l2));
        return Math.hypot(x-a.x1-t*dx,y-a.y1-t*dy)<=Math.max(a.sw,6)+P;
    }
    const b=bbox(a);return x>=b.x-P&&x<=b.x+b.w+P&&y>=b.y-P&&y<=b.y+b.h+P;
}
function applyDrag(orig:Ann,mode:DragMode,dx:number,dy:number):Ann{
    const a={...orig}as any,o=orig as any;
    if(mode==='move'){
        if('x'in a&&'y'in a){a.x+=dx;a.y+=dy;}
        if('cx'in a){a.cx+=dx;a.cy+=dy;}
        if('x1'in a){a.x1+=dx;a.y1+=dy;a.x2+=dx;a.y2+=dy;}
    } else if(mode==='p1'&&'x1'in a){a.x1+=dx;a.y1+=dy;}
    else if(mode==='p2'&&'x2'in a){a.x2+=dx;a.y2+=dy;}
    else if(a.k==='rect'){
        if(mode==='se'){a.w=Math.max(8,o.w+dx);a.h=Math.max(8,o.h+dy);}
        else if(mode==='sw'){const nw=Math.max(8,o.w-dx);a.x=o.x+(o.w-nw);a.w=nw;a.h=Math.max(8,o.h+dy);}
        else if(mode==='ne'){const nh=Math.max(8,o.h-dy);a.y=o.y+(o.h-nh);a.w=Math.max(8,o.w+dx);a.h=nh;}
        else if(mode==='nw'){const nw=Math.max(8,o.w-dx),nh=Math.max(8,o.h-dy);a.x=o.x+(o.w-nw);a.y=o.y+(o.h-nh);a.w=nw;a.h=nh;}
    } else if(a.k==='circle'){
        const fix={nw:{cx:o.cx+o.rx,cy:o.cy+o.ry},ne:{cx:o.cx-o.rx,cy:o.cy+o.ry},
                   sw:{cx:o.cx+o.rx,cy:o.cy-o.ry},se:{cx:o.cx-o.rx,cy:o.cy-o.ry}} as any;
        const mv={nw:{cx:o.cx-o.rx+dx,cy:o.cy-o.ry+dy},ne:{cx:o.cx+o.rx+dx,cy:o.cy-o.ry+dy},
                  sw:{cx:o.cx-o.rx+dx,cy:o.cy+o.ry+dy},se:{cx:o.cx+o.rx+dx,cy:o.cy+o.ry+dy}} as any;
        if(fix[mode]){
            const f=fix[mode],m=mv[mode];
            a.cx=(f.cx+m.cx)/2; a.cy=(f.cy+m.cy)/2;
            a.rx=Math.max(4,Math.abs(m.cx-f.cx)/2); a.ry=Math.max(4,Math.abs(m.cy-f.cy)/2);
        }
    }
    return a as Ann;
}
function drawSelection(ctx:CanvasRenderingContext2D,a:Ann){
    ctx.save();
    const b=bbox(a);
    ctx.strokeStyle=LIME;ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
    ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);ctx.setLineDash([]);
    for(const h of handles(a)){
        ctx.beginPath();ctx.arc(h.x,h.y,8,0,Math.PI*2); // タッチ用に少し大きく
        ctx.fillStyle='#fff';ctx.fill();
        ctx.strokeStyle=SAGE;ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
}

/* ══════════════════════════════════════════════════════════════ */
export default function ImageAnnotationEditor({file,onConfirm,onCancel,galleryProgress,overwriteUrl}:Props){
    const canvasRef=useRef<HTMLCanvasElement>(null);
    const containerRef=useRef<HTMLDivElement>(null);
    const ctxRef=useRef<CanvasRenderingContext2D|null>(null);
    const bgRef=useRef<HTMLImageElement|null>(null);
    const annsRef=useRef<Ann[]>([]);
    const histRef=useRef<Ann[][]>([[]])
    const selRef=useRef<number|null>(null);
    const dragRef=useRef<DragState|null>(null);
    const drawRef=useRef(false);
    const startRef=useRef({x:0,y:0});
    const liveRef=useRef<Ann|null>(null);
    const toolRef=useRef<Tool>('rect');
    const strokeColRef=useRef('#ef4444');
    const fillColRef=useRef('transparent');
    const swRef=useRef(3);
    const fsRef=useRef(24);

    const [tool,setTool]=useState<Tool>('rect');
    const [strokeCol,setStrokeCol]=useState('#ef4444');
    const [fillCol,setFillCol]=useState('transparent');
    const [strokeW,setStrokeW]=useState(3);
    const [fontSize,setFontSize]=useState(24);
    const [canUndo,setCanUndo]=useState(false);
    const [saving,setSaving]=useState(false);
    const [selIdx,setSelIdx]=useState<number|null>(null);
    const [showTxt,setShowTxt]=useState(false);
    const [txtVal,setTxtVal]=useState('');
    const [txtPos,setTxtPos]=useState({x:0,y:0});

    useEffect(()=>{toolRef.current=tool;},[tool]);
    useEffect(()=>{strokeColRef.current=strokeCol;},[strokeCol]);
    useEffect(()=>{fillColRef.current=fillCol;},[fillCol]);
    useEffect(()=>{swRef.current=strokeW;},[strokeW]);
    useEffect(()=>{fsRef.current=fontSize;},[fontSize]);

    const redrawAll=useCallback(()=>{
        const ctx=ctxRef.current,img=bgRef.current;if(!ctx||!img)return;
        const{canvas}=ctx;ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        annsRef.current.forEach((a,i)=>{drawAnn(ctx,a);if(i===selRef.current)drawSelection(ctx,a);});
        if(liveRef.current)drawAnn(ctx,liveRef.current);
    },[]);

    const saveHist=useCallback(()=>{
        histRef.current=[...histRef.current.slice(-29),[...annsRef.current]];
        setCanUndo(histRef.current.length>1);
    },[]);

    const undo=useCallback(()=>{
        if(histRef.current.length<2)return;
        histRef.current=histRef.current.slice(0,-1);
        annsRef.current=[...histRef.current[histRef.current.length-1]];
        selRef.current=null;setSelIdx(null);setCanUndo(histRef.current.length>1);redrawAll();
    },[redrawAll]);

    const delSelected=useCallback(()=>{
        const i=selRef.current;if(i===null)return;
        annsRef.current=annsRef.current.filter((_,j)=>j!==i);
        selRef.current=null;setSelIdx(null);saveHist();redrawAll();
    },[saveHist,redrawAll]);

    // canvas init on file change
    useEffect(()=>{
        const el=canvasRef.current,ctr=containerRef.current;if(!el||!ctr)return;
        const url=URL.createObjectURL(file);
        const img=new window.Image();
        img.onload=()=>{
            const maxW=Math.min(ctr.clientWidth||800,900);
            const maxH=Math.min(window.innerHeight-240,560);
            const sc=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);
            el.width=Math.round(img.naturalWidth*sc);
            el.height=Math.round(img.naturalHeight*sc);
            el.style.width=el.width+'px';el.style.height=el.height+'px';
            const ctx=el.getContext('2d')!;
            ctxRef.current=ctx;bgRef.current=img;
            annsRef.current=[];histRef.current=[[]as Ann[]];
            selRef.current=null;setSelIdx(null);setCanUndo(false);
            ctx.drawImage(img,0,0,el.width,el.height);
            URL.revokeObjectURL(url);
        };
        img.src=url;
        return()=>URL.revokeObjectURL(url);
    },[file]);

    // ── 共通の座標変換ヘルパー ──────────────────────────────────
    const getCanvasXY = useCallback((clientX:number, clientY:number):{x:number;y:number}=>{
        const el=canvasRef.current;if(!el)return{x:0,y:0};
        const r=el.getBoundingClientRect();
        return{
            x:(clientX-r.left)*(el.width/r.width),
            y:(clientY-r.top)*(el.height/r.height),
        };
    },[]);

    // ── 共通ドラッグ/描画ロジック ──────────────────────────────
    const makeLive=useCallback((t:Tool,sx:number,sy:number,x:number,y:number):Ann|null=>{
        const sc=strokeColRef.current,fc=fillColRef.current,sw=swRef.current;
        if(t==='rect')return{k:'rect',x:Math.min(x,sx),y:Math.min(y,sy),w:Math.abs(x-sx),h:Math.abs(y-sy),stroke:sc,fill:fc,sw};
        if(t==='circle'){const cx=(sx+x)/2,cy=(sy+y)/2;return{k:'circle',cx,cy,rx:Math.abs(x-sx)/2,ry:Math.abs(y-sy)/2,stroke:sc,fill:fc,sw};}
        if(t==='line')  return{k:'line', x1:sx,y1:sy,x2:x,y2:y,c:sc,sw};
        if(t==='arrow') return{k:'arrow',x1:sx,y1:sy,x2:x,y2:y,c:sc,sw};
        return null;
    },[]);

    const handlePointerDown=useCallback((clientX:number,clientY:number)=>{
        const{x,y}=getCanvasXY(clientX,clientY);
        const t=toolRef.current;
        if(t==='select'){
            if(selRef.current!==null){
                const hm=hitHandle(annsRef.current[selRef.current],x,y,14); // タッチは広めに
                if(hm){dragRef.current={mode:hm,sx:x,sy:y,origAnn:{...annsRef.current[selRef.current]}};return;}
            }
            let hit=-1;
            for(let i=annsRef.current.length-1;i>=0;i--){if(hitBody(annsRef.current[i],x,y)){hit=i;break;}}
            selRef.current=hit<0?null:hit;setSelIdx(selRef.current);
            if(hit>=0)dragRef.current={mode:'move',sx:x,sy:y,origAnn:{...annsRef.current[hit]}};
            redrawAll();return;
        }
        if(t==='text'){setTxtPos({x,y});setShowTxt(true);return;}
        if(t==='cursor'){
            const a:Ann={k:'cursor',x,y,fs:fsRef.current};
            annsRef.current=[...annsRef.current,a];saveHist();redrawAll();return;
        }
        drawRef.current=true;startRef.current={x,y};selRef.current=null;setSelIdx(null);
    },[getCanvasXY,redrawAll,saveHist]);

    const handlePointerMove=useCallback((clientX:number,clientY:number)=>{
        const{x,y}=getCanvasXY(clientX,clientY);
        if(dragRef.current&&selRef.current!==null){
            const{mode,sx,sy,origAnn}=dragRef.current;
            const updated=applyDrag(origAnn,mode,x-sx,y-sy);
            annsRef.current=[...annsRef.current.slice(0,selRef.current),updated,...annsRef.current.slice(selRef.current+1)];
            redrawAll();return;
        }
        if(!drawRef.current)return;
        liveRef.current=makeLive(toolRef.current,startRef.current.x,startRef.current.y,x,y);
        redrawAll();
    },[getCanvasXY,redrawAll,makeLive]);

    const handlePointerUp=useCallback(()=>{
        if(dragRef.current&&selRef.current!==null){dragRef.current=null;saveHist();return;}
        if(!drawRef.current)return;
        drawRef.current=false;const live=liveRef.current;liveRef.current=null;
        if(live){annsRef.current=[...annsRef.current,live];saveHist();}
        redrawAll();
    },[redrawAll,saveHist]);

    // ── マウスイベント ──────────────────────────────────────────
    useEffect(()=>{
        const el=canvasRef.current;if(!el)return;
        const onDown=(e:MouseEvent)=>{e.preventDefault();handlePointerDown(e.clientX,e.clientY);};
        const onMove=(e:MouseEvent)=>{e.preventDefault();handlePointerMove(e.clientX,e.clientY);};
        const onUp=  (e:MouseEvent)=>{e.preventDefault();handlePointerUp();};
        el.addEventListener('mousedown',onDown);
        el.addEventListener('mousemove',onMove);
        el.addEventListener('mouseup',onUp);
        el.addEventListener('mouseleave',onUp);
        return()=>{
            el.removeEventListener('mousedown',onDown);
            el.removeEventListener('mousemove',onMove);
            el.removeEventListener('mouseup',onUp);
            el.removeEventListener('mouseleave',onUp);
        };
    },[handlePointerDown,handlePointerMove,handlePointerUp]);

    // ── タッチイベント ──────────────────────────────────────────
    useEffect(()=>{
        const el=canvasRef.current;if(!el)return;
        const onTouchStart=(e:TouchEvent)=>{
            e.preventDefault(); // スクロール防止
            const t=e.touches[0];if(t)handlePointerDown(t.clientX,t.clientY);
        };
        const onTouchMove=(e:TouchEvent)=>{
            e.preventDefault();
            const t=e.touches[0];if(t)handlePointerMove(t.clientX,t.clientY);
        };
        const onTouchEnd=(e:TouchEvent)=>{
            e.preventDefault();
            handlePointerUp();
        };
        // passive:false でないと preventDefault が効かない
        el.addEventListener('touchstart',onTouchStart,{passive:false});
        el.addEventListener('touchmove', onTouchMove, {passive:false});
        el.addEventListener('touchend',  onTouchEnd,  {passive:false});
        el.addEventListener('touchcancel',onTouchEnd, {passive:false});
        return()=>{
            el.removeEventListener('touchstart',onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend',  onTouchEnd);
            el.removeEventListener('touchcancel',onTouchEnd);
        };
    },[handlePointerDown,handlePointerMove,handlePointerUp]);

    useEffect(()=>{const el=canvasRef.current;if(el)el.style.cursor=tool==='select'?'default':'crosshair';},[tool]);

    useEffect(()=>{
        const h=(e:KeyboardEvent)=>{
            const tag=(e.target as HTMLElement).tagName;
            if(tag==='INPUT'||tag==='TEXTAREA')return;
            if((e.ctrlKey||e.metaKey)&&e.key==='z')undo();
            if(e.key==='Delete'||e.key==='Backspace')delSelected();
            if(e.key==='Escape')setTool('rect');
        };
        window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
    },[undo,delSelected]);

    const commitText=useCallback(()=>{
        const v=txtVal.trim();setShowTxt(false);setTxtVal('');if(!v)return;
        const a:Ann={k:'text',x:txtPos.x,y:txtPos.y,t:v,c:strokeColRef.current,fs:fsRef.current};
        annsRef.current=[...annsRef.current,a];saveHist();redrawAll();setTool('rect');
    },[txtVal,txtPos,saveHist,redrawAll]);

    const confirm=useCallback(()=>{
        const el=canvasRef.current;if(!el)return;
        selRef.current=null;setSelIdx(null);redrawAll();setSaving(true);
        el.toBlob(blob=>{
            if(!blob){setSaving(false);return;}
            const baseName = overwriteUrl
                ? (overwriteUrl.split('/').pop()?.split('?')[0] || file.name)
                : file.name.replace(/\.[^.]+$/,'')+'_annotated.png';
            onConfirm(
                new File([blob], baseName, {type:'image/png'}),
                overwriteUrl,
            );
            setSaving(false);
        },'image/png');
    },[file,overwriteUrl,onConfirm,redrawAll]);

    const hasShape=tool==='rect'||tool==='circle';
    const hasFont= tool==='text'||tool==='cursor';

    const TOOLS:Array<{id:Tool;icon:React.ReactNode;label:string}>=[
        {id:'select', icon:<Move size={13}/>,             label:'選択'},
        {id:'rect',   icon:<Square size={13}/>,            label:'矩形'},
        {id:'circle', icon:<Circle size={13}/>,            label:'円'},
        {id:'line',   icon:<Minus size={13}/>,             label:'直線'},
        {id:'arrow',  icon:<ArrowUpRight size={13}/>,      label:'矢印'},
        {id:'text',   icon:<Type size={13}/>,              label:'テキスト'},
        {id:'cursor', icon:<MousePointer2 size={13}/>,     label:'カーソル'},
    ];

    const ColorRow=({label,val,onChange}:{label:string;val:string;onChange:(c:string)=>void})=>(
        <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <span style={{fontSize:10,color:'rgba(255,255,255,.45)',whiteSpace:'nowrap'}}>{label}</span>
            {PRESETS.map(c=>(
                <button key={c} onClick={()=>onChange(c)} style={{width:18,height:18,borderRadius:'50%',border:'none',cursor:'pointer',background:c,flexShrink:0,boxShadow:val===c?`0 0 0 2px ${LIME}`:'0 0 0 1px rgba(255,255,255,.2)'}}/>
            ))}
            <input type="color" value={val==='transparent'?'#ffffff':val} onChange={e=>onChange(e.target.value)}
                style={{width:22,height:22,borderRadius:4,border:'none',cursor:'pointer',background:'transparent',padding:0}}/>
        </div>
    );

    return(
        <div style={{position:'fixed',inset:0,zIndex:9500,background:'rgba(5,12,8,.93)',backdropFilter:'blur(12px)',display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 8px 6px',overflowY:'auto',touchAction:'none'}}>

            {/* header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',maxWidth:960,marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <div style={{width:27,height:27,borderRadius:7,background:overwriteUrl?'#7c4a59':SAGE,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <MousePointer2 size={13} color="#fff"/>
                    </div>
                    <span style={{fontSize:14,fontWeight:800,color:'#fff'}}>
                        {overwriteUrl ? '画像を再編集（上書き保存）' : '画像を編集'}
                    </span>
                    {galleryProgress&&(
                        <span style={{fontSize:11,fontWeight:700,color:LIME,background:'rgba(142,207,178,.15)',padding:'2px 8px',borderRadius:20}}>
                            {galleryProgress.current}/{galleryProgress.total}枚目
                        </span>
                    )}
                    <span style={{fontSize:9,color:'rgba(255,255,255,.3)',display:'none'}}>選択:ドラッグ移動/角リサイズ</span>
                </div>
                <button onClick={onCancel} style={{width:26,height:26,borderRadius:6,border:'none',cursor:'pointer',background:'rgba(255,255,255,.1)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <X size={13}/>
                </button>
            </div>

            {/* toolbar row 1: tools + stroke width */}
            <div style={{display:'flex',alignItems:'center',gap:3,flexWrap:'wrap',background:'rgba(26,48,36,.97)',borderRadius:11,padding:'5px 8px',marginBottom:5,maxWidth:960,width:'100%',boxShadow:'0 4px 20px rgba(0,0,0,.5)'}}>
                {TOOLS.map(t=>(
                    <button key={t.id} onClick={()=>setTool(t.id)} title={t.label}
                        style={{display:'flex',alignItems:'center',gap:2,padding:'5px 7px',borderRadius:6,border:'none',cursor:'pointer',background:tool===t.id?SAGE:'rgba(255,255,255,.07)',color:tool===t.id?'#fff':'rgba(255,255,255,.7)',fontSize:11,fontWeight:700,transition:'all .12s',minHeight:34}}>
                        {t.icon} <span style={{fontSize:10}}>{t.label}</span>
                    </button>
                ))}
                <div style={{width:1,height:18,background:'rgba(255,255,255,.12)',margin:'0 2px'}}/>
                <span style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>太さ</span>
                <input type="range" min={1} max={14} value={strokeW} onChange={e=>setStrokeW(+e.target.value)} style={{width:50,accentColor:LIME}}/>
                <span style={{fontSize:10,color:'rgba(255,255,255,.6)',minWidth:12}}>{strokeW}</span>
                {hasFont&&<>
                    <span style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>サイズ</span>
                    <input type="range" min={12} max={80} value={fontSize} onChange={e=>setFontSize(+e.target.value)} style={{width:50,accentColor:LIME}}/>
                    <span style={{fontSize:10,color:'rgba(255,255,255,.6)',minWidth:18}}>{fontSize}</span>
                </>}
                <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                    {tool==='select'&&selIdx!==null&&(
                        <button onClick={delSelected} title="Del" style={{padding:'5px 8px',borderRadius:6,border:'none',cursor:'pointer',background:'rgba(239,68,68,.2)',color:'#f87171',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',gap:3,minHeight:34}}>
                            <Trash2 size={11}/> 削除
                        </button>
                    )}
                    <button onClick={undo} disabled={!canUndo} style={{width:34,height:34,borderRadius:6,border:'none',cursor:'pointer',background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.7)',display:'flex',alignItems:'center',justifyContent:'center',opacity:canUndo?1:.35}}>
                        <Undo2 size={14}/>
                    </button>
                    <button onClick={()=>{annsRef.current=[];histRef.current=[[]as Ann[]];selRef.current=null;setSelIdx(null);setCanUndo(false);redrawAll();}} style={{width:34,height:34,borderRadius:6,border:'none',cursor:'pointer',background:'rgba(239,68,68,.18)',color:'#f87171',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Trash2 size={14}/>
                    </button>
                </div>
            </div>

            {/* toolbar row 2: colors */}
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:'rgba(26,48,36,.85)',borderRadius:9,padding:'5px 10px',marginBottom:6,maxWidth:960,width:'100%'}}>
                {hasShape?(
                    <>
                        <ColorRow label="枠色" val={strokeCol} onChange={setStrokeCol}/>
                        <div style={{width:1,height:18,background:'rgba(255,255,255,.12)',margin:'0 2px'}}/>
                        <span style={{fontSize:10,color:'rgba(255,255,255,.45)',whiteSpace:'nowrap'}}>塗り色</span>
                        <button onClick={()=>setFillCol('transparent')} style={{padding:'3px 7px',borderRadius:5,border:'none',cursor:'pointer',background:fillCol==='transparent'?SAGE:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.8)',fontSize:10,fontWeight:700}}>
                            なし
                        </button>
                        {PRESETS.map(c=>(
                            <button key={c} onClick={()=>setFillCol(c)} style={{width:18,height:18,borderRadius:'50%',border:'none',cursor:'pointer',background:c,flexShrink:0,boxShadow:fillCol===c?`0 0 0 2px ${LIME}`:'0 0 0 1px rgba(255,255,255,.2)'}}/>
                        ))}
                        <input type="color" value={fillCol==='transparent'?'#ffffff':fillCol} onChange={e=>setFillCol(e.target.value)}
                            style={{width:22,height:22,borderRadius:4,border:'none',cursor:'pointer',background:'transparent',padding:0}}/>
                    </>
                ):(
                    <ColorRow label="色" val={strokeCol} onChange={setStrokeCol}/>
                )}
            </div>

            {/* canvas */}
            <div ref={containerRef} style={{width:'100%',maxWidth:960,display:'flex',justifyContent:'center',flex:1,overflow:'hidden'}}>
                <canvas ref={canvasRef} style={{borderRadius:6,display:'block',boxShadow:'0 8px 40px rgba(0,0,0,.7)',maxWidth:'100%',touchAction:'none'}}/>
            </div>

            {/* footer */}
            <div style={{display:'flex',gap:8,marginTop:7,width:'100%',maxWidth:960}}>
                <button onClick={onCancel} style={{flex:1,padding:'11px 0',borderRadius:9,border:'none',cursor:'pointer',background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700}}>
                    {galleryProgress?'スキップ':'キャンセル'}
                </button>
                <button onClick={confirm} disabled={saving} style={{flex:3,padding:'11px 0',borderRadius:9,border:'none',cursor:'pointer',background:overwriteUrl?'#7c4a59':SB,color:LIME,fontSize:13,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(0,0,0,.4)',opacity:saving?.7:1}}>
                    <Check size={15}/>
                    {saving?'処理中...': overwriteUrl?'上書き保存する': galleryProgress&&galleryProgress.current<galleryProgress.total
                        ?`次へ (${galleryProgress.current}/${galleryProgress.total})`
                        :'この画像を使う'}
                </button>
            </div>

            {/* text dialog */}
            {showTxt&&(
                <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.6)'}}>
                    <div style={{background:BG,borderRadius:14,padding:22,boxShadow:'0 12px 50px rgba(0,0,0,.4)',display:'flex',flexDirection:'column',gap:12,minWidth:300,margin:'0 16px'}}>
                        <div style={{fontSize:13,fontWeight:700,color:T1}}>テキストを入力</div>
                        <input autoFocus value={txtVal} onChange={e=>setTxtVal(e.target.value)}
                            onKeyDown={e=>{if(e.key==='Enter')commitText();if(e.key==='Escape'){setShowTxt(false);setTxtVal('');}}}
                            placeholder="テキストを入力..." style={{padding:'9px 12px',borderRadius:8,border:'1.5px solid #d0ccc8',fontSize:14,color:T1,outline:'none',background:'#fdfcfa'}}/>
                        <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>{setShowTxt(false);setTxtVal('');}} style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',background:'#e8e4df',color:T2,fontSize:12,fontWeight:700,cursor:'pointer'}}>キャンセル</button>
                            <button onClick={commitText} style={{flex:2,padding:'8px 0',borderRadius:8,border:'none',background:SB,color:LIME,fontSize:12,fontWeight:700,cursor:'pointer'}}>追加する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
