/*
 * 5k chess - by Douglas Bagnall <douglas ~ paradise.net.nz>
 * placed in public domain ['just do it' license] 
 * lives at http://p4wn.sf.net/
 * 
 * Key:
 * 
 * DEV -denotes debugging or development use only.
 * MVL -used in move list only. can be scrapped if necessary. 
 *
 */

/* TODO
 * clarify variable names
 * fix checkmate problem
 * generalise player state, (perhaps tick boxes for b and w computer control)
 * change colour bit to bit 0 
 * sensibly rearrange piece numbers [allowing bitwise parsing]
 * get rid of saftywrapper
 * test
 * perhaps improve the HTML.
 */



bmove=0;    // the moving player 0=white 8=black
inhand=0;   // piece in hand (ie, during move)
going=0;    // DEV: denotes auto play, or not. 
player=0;   // human colour (0=white, 8=black)
moveno=0;   // no of moves  
ep=0;       //en passant state (points to square behind takable pawn, ie, where the taking pawn ends up.
Bt=9999;    // extremes of evaluation range    
Al=-Bt;
ss=0;       // start click - used in display.js

d=document;         
lttrs="abcdefgh";    // for display
dirs=[10,-10];
off_board=120;

boardheap=[];  // history of board state, for undo.
pieces=[];
board=[]; 
castle=[3,3];

debug=0;

q=[1,10,11,9,-1,-10,-11,-9]; //queen moves -used in moves array
moves=[0,0,[1,10,-1,-10],[21,19,12,8,-21,-19,-12,-8],[11,9,-11,-9],q,q];   //in order _,p,r,n,b,q,k       
pv=[0,16,80,48,48,144,999,0,0,16,80,48,48,144,999]  //piece values

// this next bit fills the board
// the text compression is for the short version
x='g00000000g';
y='gggggggggg';
bstring=y+y+"g23456432gg11111111g"+x+x+x+x+"g99999999ggABCDECBAg"+y+y;
wstring=x+x+x+"000111100000123321000123553210";

pw='000012346900';  //pawn weighting - reward for advancement.

weights=[];
b_pweights=[];   //base pawn weights
b_weights=[];    //base weights  central weighting for ordinary pieces.
for(y=0;y<12;y++){
    for(x=0;x<10;x++){
	z=(y*10)+x;
	b_pweights[z]=parseInt(pw.charAt(y));    //also need to add main weight set at start.
	b_weights[z]=parseInt(wstring.charAt((z<60)?z:119-z),35)&7; // for all the ordinary pieces
	board[z]=parseInt(bstring.charAt(z),35);
    }
}
board[off_board]=0;

//**************some display stuff.

E=d.all;
if (!E)event=0; //else errors in onmouseover.


///////////////////////////treeclimb begins

var comp=new Function('a','b','return b[0]-a[0]'); //comparison function for treeclimb integer sort (descending)


/****treeclimber */
//function safetywrapper(count,bm,s,e,ep){
//  var E=board[e];
//  var S=board[e]=board[s];
//  board[s]=0;
//  prepare();
//  bm=treeclimber(count,bm,0,off_board,off_board,Al,Bt,ep);
//  board[s]=S;
//  board[e]=E;
//  return bm[0];
//}

function treeclimber(count, bm, sc, s, e, alpha, beta, EP){
    var z=-1;
    var nbm=8-bm;
    sc=-sc;
    if (sc <-400)return [sc,s,e];      //if king taken, no deepening.
    var b=Al;     //best move starts at -infinity
    var S,E=board[e];
    board[e]=S=board[s];
    board[s]=0;
    if(S)pieces[nbm][pieces[nbm].length]=[S,e];

    //now some stuff to handle queening, castling
    var rs,re;
    if(S&7==1 && board[e+dirs[bm>>3]]>15){
    	board[e]+=4-queener; //queener is choice for pawn queening
    }
    if(S&7==6 && (s-e==2||e-s==2)){  //castling - move rook too
    	rs=s-4+(s<e)*7;
	re=(s+e)>>1; //avg of s,e=rook's spot
	board[rs]=0;
	board[re]=bm+2;	
    }

    var movelist=parse(bm,EP,sc);
    var movecount=movelist.length;
    var mv;
    if (movecount) {
	if(count){	
	    //BRANCH NODES
	    var t;
	    var cmp=comp;	
	    movelist.sort(cmp); //descending order
	    count--;
	    best=movelist[0];
	    var bs=best[1];
	    var be=best[2];
	    b=-treeclimber(count, nbm, best[0], bs, be, -beta, -alpha, best[3])[0];
	    for(z=1;z<movecount;z++){		
		if (b>alpha)alpha=b;  //b is best
		mv = movelist[z];	
		t= -treeclimber(count, nbm, mv[0], mv[1], mv[2], -alpha-1, -alpha, mv[3])[0];
		if ((t>alpha) && (t<beta)){
		    t= -treeclimber(count, nbm, mv[0],mv[1],mv[2],-beta,-t, mv[3])[0];
		}		
		if (t>b){
		    b=t;
		    bs=mv[1];
		    be=mv[2];
		    if(t>alpha)alpha=t;
		    if (b>beta){
			break;
		    }
		}
	    }
	}	
	else{
	    b=Al;
	    //LEAF NODES
	    while(--movecount &&  beta>b){
		if(movelist[movecount][0]>b){
		    b=movelist[movecount][0];
		}
	    }
	}
    }else{trace('no movelist')};
    if(rs){
	board[rs]=bm+2;
	board[re]=0;
    }
    board[s]=S;
    board[e]=E;
    pieces[nbm].length--;

    return [b,bs,be];
}









//************************************* findmove();

function findmove(){
    level=d.fred.hep.selectedIndex+1;
    var t=treeclimber(level,bmove,0,off_board,off_board,Al,Bt,ep);
    return move(t[1],t[2],0);
}



//**************************************** move();
function move(s,e,queener){

    var E=board[e];
    var S=board[s];
    var a=S&7;
    var bmx=bmove>>3;
    var ch=0;

    //test if this move is legal
    var t=0;
    var z=0;
    if (bmove==player){
	prepare();
	var p=parse(bmove,ep,0);
	for (;z<p.length;z++){
	    t=t||(s==p[z][1]&&e==p[z][2]);
	}
	if (!t) {
	    going=0;
	    trace ('no such move!',p,'\ns e',s,e,'\n',S,E);
	    return 0;
	}
	// get best other player's move
	// if it's check, squawk
	t=treeclimber(0,8-bmove,0,s,e,Al,Bt,ep);
	//	t=safetywrapper(0,8-bmove,s,e,ep);
	if (t[0]>400){
	    trace('in check',t);
	    return 0;
	}	
    }
    t=treeclimber(0,bmove,0,s,e,Al,Bt,ep);
    //    t=safetywrapper(0,bmove,s,e,ep);
    if (t[0]>400){
	trace('check!',t);
	ch=1;
    }
    // and if it isn't check before opposition's best move, it's stalemate.
    t=treeclimber(1,8-bmove,0,s,e,Al,Bt,ep);
    //t=safetywrapper(1,8-bmove,s,e,ep);
    if(t<-400){	
	going=0;
	trace(ch?'checkmate':'stalemate',t);
	finish(ch);
    }
    if(E&7==6){finish('checkmate - got thru checks')}

    //put board on heap.
    boardheap[moveno]=[board.toString(),castle.toString(),ep];
    display2(s,e,E,ch);
    ep=0;
    var x=s%10;
    var gap=e-s;
    var dir=dirs[bmx];
    if(a==1){ // pawns
	if(board[e+dir]>15)board[s]+=4-queener;
	if(gap==2*dir && (board[e-1]&1||board[e+1]&1))ep=s+dir;
	if(!E&& gap%10)shift(e,e-dir);
    }
    if(s==21+bmx*70||s==28+bmx*70)castle[bmx]&=(x<5)+1;        //castle flags (blank on any move from rook points)
    if(e==21+bmx*70||e==28+bmx*70)castle[!bmx]&=(x<5)+1;       //(or on any move *too* opposition corners)
    if(a==6){
	if(gap*gap==4){  //castling - move rook too
	    shift(s-4+(s<e)*7,s+gap/2);
	}
	castle[bmx]=0;
    }
    shift(s,e);
    prepare();   // get stuff ready for next move
    moveno++;
    bmove=8-bmove;
    return 1;
}

function finish(ch){
    trace(ch);
}




////////////////////////////////////parse

function prepare(){
    var z=99,Q;
    //    alert('in prepare');
    earliness=(moveno<32)?4-(moveno>>3):(moveno>64); // indicates low move number
    pieces[0]=[];
    pieces[8]=[];
    kweights=[];
    pweights=[[],[]];
    for(;z>20;z--){
	a=board[z];
	if(a&7){
	    pieces[a&8][pieces[a&8].length]=[a,z];
	}
	weights[z]=b_weights[z]*earliness;
	kweights[z]=(moveno>40)||(10-2*b_weights[z])*earliness;// while moveno <= 40, weight to edge.
	Q=pweights[1][119-z]=pweights[0][z]=b_pweights[z];//centralising for first 8 moves, then forwards only.
	if (moveno<5 && z>40){
	    pweights[0][z]=pweights[1][119-z]=Q+((debug?0.5:Math.random())*weights[z])>>1;
	    weights[24]=weights[94]=14;
	}
    }
    //    trace("moveno earliness",moveno,earliness);

}




function parse(bm,EP,tpn) {
    var yx,tyx;    //start and end position
    var h;         //for pawn taking moves
    var E,a;       //E=piece at end place, a= piece moving
    var cx;     // loop for move direction
    var mv;     // list of move direction
    var k=-1;   // length of movelist (mvl)
    var bmx=bm>>3; //0 for white, 1 for black
    var nbm=bm^8;  //not bm (bm is the players colour)
    var nx=nbm>>3; //not bmx (ie 1 for white, 0 for black)
    var dir=dirs[bmx]; //dir= 10 for white, -10 for black
    var mvl=[];        // movelist (built up with found moves
    var m;             // current value in mv[cx]
    var wate;          // initial weighting of piece's position
    var pweight=pweights[bmx];//=pweights[bmx]
    //var pv=pv;            //localised pv
    var weight;       //=weight localised weight
    var cbmx=castle[bmx];    // flags whether this side can castle
    //var pv=PV[bm==bmove];
    var z;//loop counter.
    var ak;              //flags piece moving is king.
    var mlen;            //mv length in inner loop
    var pbm=pieces[bm];  //list of pieces that can move
    if (! pbm) alert('no pbm');
    var pbl=pbm.length;   //marginal time saving
    var B=board;          //local ref to board
    for (z=0;z<pbl;z++){
	yx=pbm[z][1];
	a=B[yx];
	if (pbm[z][0]==a){	
	    //	    if(a&7&&bm==(a&8)) { // already know a is bm safe, from pieces[bm] list
	    a&=7;
	    if(a>1){    //non-pawns
		ak=a==6;
		weight=ak?kweights:weights //different weight tables for king/knight
		wate=tpn-weight[yx];
		mv=moves[a];
		if(a==3||ak){
		    for(cx=0;cx<8;){     //knights,kings
			tyx=yx+mv[cx++];
			E=B[tyx];
			if(!E||(E&24)==nbm){
			mvl[++k]=[wate+pv[E]+weight[tyx],yx,tyx];
			}
		    }
		    if(ak&&cbmx){
			if(cbmx&1&&!(B[yx-1]+B[yx-2]+B[yx-3])&&check(yx-2,nbm,dir,-1)){//Q side
			    mvl[++k]=[wate+11,yx,yx-2];     //no analysis, just encouragement
			}
			if(cbmx&2&&!(B[yx+1]+B[yx+2])&&check(yx,nbm,dir,1)){//K side
			    mvl[++k]=[wate+12,yx,yx+2];    //no analysis, just encouragement
			}
		    }
		}
		else{//rook, bishop, queen
		    mlen=mv.length;
		    for(cx=0;cx<mlen;){     //goeth thru list of moves
			E=0;
			m=mv[cx++];
			tyx=yx;
			while(!E){   //while on board && no piece
			    tyx+=m;
			    E=B[tyx];
			    if(!E||(E&24)==nbm){
				mvl[++k]=[wate+pv[E]+weight[tyx],yx,tyx];
			    }
			}
		    }
		}
	    }
	    else{    //pawns
		wate=tpn-pweight[yx];
		tyx=yx+dir;
		if(!B[tyx]){
		    mvl[++k]=[wate+pweight[tyx],yx,tyx];
		    if(! pweight[yx] && (!B[tyx+dir])){  //2 squares at start - start flagged by 0 pweights weighting
			mvl[++k]=[wate+pweight[tyx+dir],yx,tyx+dir,tyx];    //ep points to the takeable spot
		    }
		}
		if(EP&&(EP==tyx+1||EP==tyx-1)){
		    mvl[++k]=[wate+pweight[tyx],yx,EP];
		}		
		for(h=tyx-1;h<tyx+2;h+=2){                        //h=-1,1 --for pawn capturing
		    E=B[h]+bm;
		    if(E&7&&E&8){
			mvl[++k]=[wate+pv[E]+pweight[h],yx,h];
		    }
		}
	    }
	}
    }
    return mvl;
}


//************************************CHECK

function check(yx,nbm,dir,side){         //dir is direction
    var tyx;     //
    var E;
    var sx=yx%10;
    var x;
    var m;
    var ex=yx+3;
    var md=dir+2;
    var k=moves[3];
    var B=board;  //localise board ref for speed
    for(;yx<ex;yx++){ //go thru 3positions, checking for check in each
	for(m=dir-2;++m<md;){
	    E=B[yx+m];
	    if(E&&(E&8)==nbm&&((E&7)==1||(E&7)==6))return 0;        //don't need to check for pawn position --cannot arrive at centre without passing thru check
	    E=0;
	    tyx=yx;
	    while(!E){   //while on B && no piece
		tyx+=m;
		E=B[tyx];
		//                if (E&16)break
		if((E==nbm+2+(m!=dir)*2)||E==nbm+5)return 0;
	    }
	}
	for (z=0;z<8;){
	    if(B[yx+k[z++]]-nbm==3)return 0;      //knights
	}
    }
    E=0;
    yx-=3;
    while (!E){   //queen or rook out on other side
	yx-=side;
	E=B[yx];
	if(E==nbm+2||E==nbm+5)return 0;
    }
    return 1;
}



//////////////////////display


//*************************************** macro-control

function B(it,e){ //it is clicked square
    var a=board[it],p='pih';
    if (ss==it && inhand){   //ss is global, for starting place of moving piece.
	Bim(p,0);         //this bit replaces a piece if you click on the square it came from.
	//Bim(ss,inhand,1);
	inhand=0;
	return;
    }
    if (a&&(bmove==(a&8))){     //ie, if one picked up of right colour, it becomes start
        if (inhand) Bim(ss,inhand,1); //put back old piece, if any
	inhand=a;
        ss=it;
        //Bim(ss,0,1);     //not real shift, but blank start
        Bim(p,a);     //dragging piece
        drag(e);      //puts in right place
        d.onmousemove=drag;  //link in hand image to mouse
    	return;
    }
    if (inhand){
	if(move(ss,it,d.fred.hob.selectedIndex,y)){
	    Bim(p,0); //blank moving
	    d.onmousemove=null;         //and switch off mousemove.
	    var itch=d.getElementById("pih").style;

	    itch.top=itch.left='0px';
	    inhand=0;
	    B2();
	}
    }
}


//////////////////////////////to go:

//B1 is auto
Btime=0;
nextTimeout = 1000;
function B1(){
    if(findmove()){          //do other colour
	Btime=setTimeout("B2()",nextTimeout);
    }
    else{ going=0}
}
function B2(){
	if (going || player!=bmove){
		clearTimeout(Btime);
		B1();
	}
}




//*******************************shift & display
var nextCap = {w:0,b:0}
function shift(s,e){
    var z=0,a=board[s];
    board[e]=a;
    board[s]=0;
    var se = d.getElementById("i"+(player?119-s:s));
    var ee = d.getElementById("i"+(player?119-e:e));
    if (ee != null) {
    	var isBlack = ee.className.indexOf('black') >= 0;
    	var capArea = isBlack ? 'b': 'w';
    	var newPos = nextCap[capArea]++;
    	var newClassName = ee.className.replace(/ top_[0-9]+ left_[0-9]+/, ' cp cap' + capArea + newPos);
    	ee.id = 'dead';
    	var timeOut = isBlack ? 0: 1000;
    	nextTimeout += timeOut;
    	window.setTimeout(function() { ee.className = newClassName; nextTimeout -= timeOut; }, timeOut);
    }
    se.id = "i"+(player?119-e:e);
    var sc = se.className;
    var x = e %10;
    var y = e-x;
    var newPos = ' top_' + y + ' left_' + x;
    se.className = sc.replace(/ top_[0-9]+ left_[0-9]+/, newPos);
//    Bim(s,0,1);
//    Bim(e,a,1);
}

function display2(s,e,b,c){
    var x=s%10,tx=e%10,mn=1+(moveno>>1)
    d.getElementById("bib").innerHTML+=(bmove?' ':"<br>"+(mn<10?" ":"")+mn+".  ")+lttrs.charAt(x-1)+((s-x)/10-1)+(b?'x':'-')+lttrs.charAt(tx-1)+((e-tx)/10-1)+(c?'+':' ')
}


//*******************************************redraw screen from board

function refresh(bw){
    player=bw;
    for (var z=0;z<off_board;z++){
	if(board[z]<16)Bim(z,board[z],1);
    }
    //    if (player!=bmove)B2();
}


function goback(){
    if (!moveno)return;
    moveno-=2;
    var b=boardheap[moveno];
    board=eval("["+b[0]+"]");
    castle=eval("["+b[1]+"]");
    d.getElementById("bib").innerHTML+='<br> --undo--';
    ep=b[2];
    bmove=moveno%2;
    refresh(bmove);
    prepare();
}

//*********************************************drag piece
var px="px";
function drag(e) {
    e=e||event;
    var itch=d.getElementById("pih").style;

    itch.left=(e.clientX+1)+px;
    itch.top=(e.clientY-4)+px;
}

function Bim(img,src,swap){
    if (swap){
        img="i"+(player?119-img:img);
    }
    d.getElementById(img).innerHTML=src?"&#98"+[0,17,14,16,15,13,12,0,0,23,20,22,21,19,18][src]+";":"&nbsp;";
}


//*********************************************final write,etc
    // can be merged with weighters;

function boardClicked(event) {
    var board = document.getElementById("board");
    var z = -1;
    var target = event.target;
    if (target == board) {
    	var bx = board.offsetLeft;
    	var by = board.offsetTop;
    	var op = board.offsetParent;
    	while (op != null) {
	    bx += op.offsetLeft;
	    by += op.offsetTop;
	    op = op.offsetParent;
    	}
    	var x = Math.floor((event.pageX-bx)/50);
    	var y = Math.floor((event.pageY-by)/64);
    	z = (9-y)*10+(x+1);
    }
    else {
    	z = parseInt(target.id.substr(1), 10);
    }
    if (z >= 0) {
	B(player?119-z:z, event);
    }
}

// stuff for mere testing, or debug display.


debug=1;

function trace(){
    if (debug){
    	var line = "";
	for (var z=0;z<arguments.length;z++){
            var az=arguments[z]
	    line += az+"  "
	}
	console.log(line);
    }
}


function parsetest(){
    var z,x,y=500
    x=new Date()
    for (z=0;z<y;z++){
        parse(bmove,ep,0)
    }
    x-=new Date()
    trace ('parse took '+ -x/y +' milliseconds')
}

function loadposition(){
    board=[16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,0,13,0,0,0,0,0,0,16,16,0,0,0,0,0,0,0,0,16,16,0,0,0,0,0,0,0,0,16,16,0,0,0,0,10,9,0,0,16,16,0,0,0,0,0,0,0,0,16,16,0,0,0,6,0,0,0,0,16,16,0,14,0,0,0,0,0,0,16,16,0,0,0,0,0,0,0,0,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,0];
    castle=[0,0];
    ep=0;
    refresh(0);
}
