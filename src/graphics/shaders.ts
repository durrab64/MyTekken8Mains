export const atmosphereVertexSource =  `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)& 2),float(gl_VertexID & 2));gl_Position=vec4(p*2.0 - 1.0,0.0,1.0);}`;
export const ART = new URLSearchParams(location.search).get('art') === 'on';
const base =  `#version 300 es
precision highp float;uniform float uTime,uWipe;uniform vec2 uResolution,uPointer;uniform vec3 uDeep,uFog,uGlow,uVein;uniform int uOctaves,uMode;out vec4 outColor;float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float nv(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),u.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),u.x),u.y);}float fm(vec2 p){float v=0.,a=.55;for(int i=0;i<6;i++){if(i>=uOctaves)break;v+=a*nv(p);p=p*2.03+vec2(17.31,9.13);a*=.52;}return v;}void main(){vec2 p=(gl_FragCoord.xy*2.0 - uResolution)/uResolution.y;vec2 pw=gl_FragCoord.xy/uResolution;vec2 pd=pw - uPointer;float pl=smoothstep(0.55,0.0,length(pd));p+=(pd*-0.14+vec2(-pd.y,pd.x)*0.04)*pl;float t=uTime*0.055;vec2 wp;wp.x=fm(p*1.6+vec2(t,-t*0.6)+1.7);wp.y=fm(p*1.6+vec2(-t*0.8+5.2,t+3.1)+4.3);wp=(wp - 0.5)*1.35;float hz=fm(p*1.35+wp+vec2(0.0,-t*1.7));float vn=fm(p*2.55+wp*1.8+vec2(t*0.5,-t*2.5));vn=smoothstep(0.52,0.76,vn)*(1.0 - smoothstep(0.25,1.15,abs(p.x)));vec3 col=mix(uDeep,uFog,smoothstep(0.12,0.78,hz)*0.9);col=mix(col,uGlow*0.55,smoothstep(0.55,0.95,hz)*0.6);col=mix(col,uVein,clamp(vn*0.8,0.0,1.0));if(uMode==0){float fl=1.0 - smoothstep(-0.95,0.25,p.y);float fp=0.82+0.18*sin(uTime*0.7+hz*3.0);col=mix(col,uGlow*0.9,fl*fl*0.6*fp);float pil=exp(-pow((p.x - 0.62)*4.3,2.0));float cr=exp(-pow((p.x - 0.62)*11.0,2.0));float pu=0.72+0.28*sin(uTime*0.85);float hf=1.0 - smoothstep(-0.35,1.15,p.y);col=mix(col,uGlow*0.95,pil*hf*0.5*pu);col=mix(col,uVein*0.75,cr*hf*0.32*pu);float ke=(1.0 - smoothstep(-0.35,0.95,p.y))*(1.0 - smoothstep(-1.1,0.35,p.x));col=mix(col,uGlow*0.45,ke*0.22);}else if(uMode==1){float ry=pow(max(0.0,1.0 - abs(p.x+0.15)*1.9),3.5)*(1.0 - smoothstep(-0.4,1.1,p.y));ry*=0.6+0.4*fm(p*3.0+vec2(0.0,t*0.4));col=mix(col,uGlow,ry*0.5);float bd=smoothstep(-0.15,0.35,p.y)*(1.0 - smoothstep(0.5,0.9,p.y));col=mix(col,uGlow*0.5,bd*0.22);}else if(uMode==2){float sn=exp(-pow((p.y+0.74)*6.0,2.0));sn*=exp(-pow((p.x+0.72)*2.4,2.0));col=mix(col,uVein,sn*0.75);col=mix(col,uFog*0.5,(1.0 - smoothstep(-0.9,0.4,p.y))*0.35);}else if(uMode==3){float bl=exp(-pow((p.y - 0.55 - 0.18*sin(t*0.24))*7.0,2.0));bl*=exp(-pow(abs(p.x)*2.1,2.0));col=mix(col,uVein,bl*0.7);float sp=exp(-pow(p.x*1.5,2.0))*(1.0 - smoothstep(-0.2,0.9,p.y));col=mix(col,uGlow,sp*0.4);}else{float bd=smoothstep(0.5,0.9,p.y);float jg=fm(p*vec2(9.0,26.0)+vec2(t*3.2,0.0));float ev=0.5+0.5*sin(uTime*1.7+floor(t*2.0));float ar=(1.0 - smoothstep(0.46,0.5,abs(jg - 0.5)))*bd*ev;col=mix(col,uVein,ar*0.8);col=mix(col,uGlow*0.6,bd*0.25);}float eg=length(p*vec2(0.72,1.0));col*=1.0 - smoothstep(0.95,1.75,eg)*0.35;col*=0.9;col=col/(1.0+col*0.5);col+=uGlow*0.045*pl;if(uWipe<1.0){float sw=dot(p,normalize(vec2(1.0,0.55)));float wx=mix(-1.6,1.6,uWipe);float d=sw - wx;col+=exp(-d*d*26.0)*mix(vec3(1.0),uGlow*1.4,0.35)*0.55;}outColor=vec4(col,1.0);}`;
export const atmosphereFragmentSource = ART?base.replace('out vec4 ', 'uniform sampler2D uArtTex;uniform vec4 uArtRect;out vec4 ').replace('outColor=', 'if(uArtRect.z>0.){vec2 q=(pw-uArtRect.xy)/uArtRect.zw;q.y=1.-q.y;float e=0.;for(int i=0;i<4;i++){vec2 d=vec2(.01)*vec2(i%2*2-1,i/2*2-1);e+=textureLod(uArtTex,q+d,3.).a;}col+=uGlow*e*.07;}outColor='):base;
export const particleVertexSource = `#version 300 es
precision highp float;uniform float uTime,uSwirl,uSize,uSeed,uAspect,uSharp,uCount;uniform highp int uFormation,uFormationDetail;uniform float uFormationRadius,uFilaments;uniform vec2 uOrigin,uDir,uPointer;uniform vec3 uTintA,uTintB,uFog;out vec3 vTint;out float vFade;out float vSpark;out vec2 vQuad;out float vLambda;out float vComp;
out vec3 vColor;
out float vAlpha;
out float vHard;
out float vGlyph;float h11(float n){return fract(sin(n)*43758.5453123);}float larsHash11(float p){p=fract(p*0.1031);p*=p+33.33;p*=p+p;return fract(p);}float larsComponent(float seed,float ud){if(ud==0.0){if(seed<0.72)return 0.0;if(seed<0.88)return 1.0;return 2.0;}if(ud==2.0){if(seed<0.514)return 0.0;if(seed<0.734)return 1.0;if(seed<0.884)return 2.0;if(seed<0.909)return 3.0;if(seed<0.934)return 4.0;if(seed<0.959)return 5.0;if(seed<0.984)return 6.0;if(seed<0.992)return 7.0;return 8.0;}if(seed<0.56)return 0.0;if(seed<0.79)return 1.0;if(seed<0.94)return 2.0;if(seed<0.965)return 3.0;if(seed<0.99)return 4.0;if(seed<0.995)return 7.0;return 8.0;}vec3 larsTrunkBase(float s){float t=clamp(s,0.0,0.9999)*6.0;int seg=int(floor(t));float f=t-float(seg);vec3 a0,a1;if(seg==0){a0=vec3(-0.340,-1.180,-0.020);a1=vec3(-0.120,-0.790,0.050);}else if(seg==1){a0=vec3(-0.120,-0.790,0.050);a1=vec3(-0.270,-0.430,-0.060);}else if(seg==2){a0=vec3(-0.270,-0.430,-0.060);a1=vec3(0.060,-0.040,0.040);}else if(seg==3){a0=vec3(0.060,-0.040,0.040);a1=vec3(-0.020,0.390,-0.030);}else if(seg==4){a0=vec3(-0.020,0.390,-0.030);a1=vec3(0.280,0.760,0.060);}else{a0=vec3(0.280,0.760,0.060);a1=vec3(0.350,1.160,0.020);}return mix(a0,a1,f);}vec3 larsForkABase(float f){float u;vec3 a0,a1;if(f<0.30){u=f/0.30;a0=vec3(0.002,0.270,-0.010);a1=vec3(0.310,0.470,0.030);}else if(f<0.62){u=(f-0.30)/0.32;a0=vec3(0.310,0.470,0.030);a1=vec3(0.380,0.670,-0.020);}else if(f<0.82){u=(f-0.62)/0.20;a0=vec3(0.380,0.670,-0.020);a1=vec3(0.700,0.800,0.040);}else{u=(f-0.82)/0.18;a0=vec3(0.700,0.800,0.040);a1=vec3(0.920,0.970,0.000);}return mix(a0,a1,clamp(u,0.0,1.0));}vec3 larsForkBBase(float f){float t=clamp(f,0.0,0.9999)*4.0;int seg=int(floor(t));float u=t-float(seg);vec3 a0,a1;if(seg==0){a0=vec3(-0.240,-0.502,-0.038);a1=vec3(-0.480,-0.360,0.020);}else if(seg==1){a0=vec3(-0.480,-0.360,0.020);a1=vec3(-0.520,-0.190,-0.040);}else if(seg==2){a0=vec3(-0.520,-0.190,-0.040);a1=vec3(-0.760,-0.060,0.030);}else{a0=vec3(-0.760,-0.060,0.030);a1=vec3(-0.860,0.080,0.000);}return mix(a0,a1,u);}vec3 larsBarbPoint(float barbId,float f){vec3 parent,tip;if(barbId<3.5){parent=larsForkABase(0.62);tip=vec3(0.450,0.850,parent.z+0.02);}else if(barbId<4.5){parent=larsForkBBase(0.50);tip=vec3(-0.680,-0.240,parent.z+0.02);}else if(barbId<5.5){parent=larsTrunkBase(0.50);tip=vec3(-0.080,0.020,parent.z+0.02);}else{parent=larsTrunkBase(0.70);tip=vec3(0.180,0.464,parent.z+0.02);}return mix(parent,tip,f);}float larsSizeScale(float comp){if(comp>6.5)return 0.55;if(comp<0.5)return 1.30;if(comp<1.5)return 1.15;if(comp<2.5)return 1.10;return 0.95;}vec3 larsHome(float lambda,float seed,float t,float filament,float ud){float comp=larsComponent(seed,ud);float strand=mod(filament,2.0);float side=strand*2.0-1.0;float microX=(larsHash11(seed*31.7+5.3)-0.5)*0.012;float microY=(larsHash11(seed*47.1+7.9)-0.5)*0.010;float microZ=(larsHash11(seed*23.3+3.7)-0.5)*0.012;if(comp<0.5){vec3 base=larsTrunkBase(lambda);float jx=(larsHash11(seed*31.7+5.3)-0.5)*0.008;float jy=(larsHash11(seed*47.1+7.9)-0.5)*0.006;float jz=(larsHash11(seed*23.3+3.7)-0.5)*0.012;return vec3(base.x+jx,base.y+jy,base.z+jz);}if(comp<2.5){float branchSide=comp<1.5?1.0:-1.0;vec3 base=(branchSide>0.0)?larsForkABase(lambda):larsForkBBase(lambda);if(ud==0.0){float jx0=branchSide>0.0?0.002:-0.240;base.x=jx0+(base.x-jx0)*0.45;}float jx=(larsHash11(seed*31.7+5.3)-0.5)*0.008;float jy=(larsHash11(seed*47.1+7.9)-0.5)*0.006;float jz=(larsHash11(seed*23.3+3.7)-0.5)*0.012;return vec3(base.x+jx,base.y+jy,base.z+jz);}if(comp<6.5){return larsBarbPoint(comp,lambda);}float socketSide=comp<7.5?1.0:-1.0;float socketY=comp<7.5?0.35:-0.30;return vec3(larsTrunkBase(clamp((socketY+1.18)/2.34,0.0,1.0)).x+socketSide*0.04+microX*1.4,socketY+microY*1.2,0.12+socketSide*0.02+microZ*1.2);}

const float LAB_TAU = 6.283185307179586;

float labHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float formationLambda(float base) {
  return base + 0.05 * sin(LAB_TAU * base);
}

vec3 labJinHome(float lambda, float seed, float filament, float t) {
  float ribbonCount = max(1.0, ceil(uFilaments * 0.5));
  float ribbon = floor(filament * 0.5);
  float edge = mod(filament, 2.0);
  float phase = (ribbon / ribbonCount) * LAB_TAU + (edge - 0.5) * 0.09;
  float profile = 0.30 + 0.70 * pow(max(sin(3.14159265359 * lambda), 0.0), 1.5);
  profile *= 1.0 + 0.10 * sin(3.14159265359 * (lambda * 2.0 - 0.15));
  profile *= 1.0 - 0.10 * smoothstep(0.72, 1.0, lambda);
  float radialJitter = labHash11(seed * 71.3 + 13.7) - 0.5;
  float angularJitter = labHash11(seed * 19.1 + 3.3) - 0.5;
  float spark = step(0.88, seed);
  float sparkPulse = 0.5 + 0.5 * sin(t * 1.35 + seed * 61.0 + lambda * 9.0);
  float angle = lambda * LAB_TAU * 2.2 + t * 0.35 + phase;
  angle += angularJitter * 0.10;
  angle += spark * (0.10 + 0.16 * sparkPulse);
  float radius = uFormationRadius * profile;
  radius *= 1.0 + radialJitter * 0.10;
  radius *= 1.0 + spark * (0.10 + 0.24 * sparkPulse);
  float sway = 0.055 * sin(lambda * 3.14159265359 * 1.2 - 0.35);
  float y = mix(-1.18, 1.18, lambda)
          + 0.016 * sin(t * 0.7 + seed * 9.0)
          + (seed - 0.5) * 0.010
          + spark * (0.018 + 0.045 * sparkPulse);
  float x = cos(angle) * radius + sway;
  float z = sin(angle) * radius * 0.58;
  return vec3(x, y, z);
}

float claudioComponent(float seed) {
  if (uFormationDetail == 0) {
    return seed < 0.22 ? 0.0 : 1.0;
  }
  if (uFormationDetail == 2) {
    if (seed < 0.07) return 0.0;
    if (seed < 0.30) return 1.0;
    if (seed < 0.60) return 2.0;
    if (seed < 0.76) return 3.0;
    if (seed < 0.88) return 4.0;
    return 5.0;
  }
  if (seed < 0.08) return 0.0;
  if (seed < 0.34) return 1.0;
  if (seed < 0.70) return 2.0;
  if (seed < 0.90) return 3.0;
  return 4.0;
}

float claudioSizeScale(float seed) {
  return claudioComponent(seed) < 0.5 ? 0.80 : 0.78;
}

float dragunovSizeScale(float seed) {
  return labHash11(seed * 91.7 + 3.1) > 0.94 ? 0.95 : 1.15;
}

const float CLAUDIO_SIN_INC_A = 0.3746066;
const float CLAUDIO_COS_INC_A = 0.9271839;
const float CLAUDIO_SIN_INC_C = -0.3746066;
const float CLAUDIO_COS_INC_C = 0.9271839;
const float CLAUDIO_SIN_ORBIT = 0.0697565;
const float CLAUDIO_COS_ORBIT = 0.9975641;
const float CLAUDIO_SIN_AZ = 0.8829476;
const float CLAUDIO_COS_AZ = 0.4694716;
const float CLAUDIO_ZOFF = -0.05;

vec3 claudioHome(float lambda, float seed, float t) {
  float comp = claudioComponent(seed);
  float rJitter = (labHash11(seed * 29.7 + 4.1) - 0.5) * 0.055;
  float aJitter = (labHash11(seed * 17.3 + 9.7) - 0.5) * 0.045;
  float zJitter = (labHash11(seed * 23.9 + 1.3) - 0.5) * 0.02;
  float bob = 0.018 * sin(t * 0.8 + seed * 6.0);

  if (comp < 0.5) {
    float g = labHash11(seed * 29.1 + 2.4) + labHash11(seed * 41.7 + 3.1)
            + labHash11(seed * 53.3 + 5.9) - 1.5;
    float r = max(0.018, 0.058 + g * 0.022);
    float theta = 0.16 * t + (lambda - 0.5) * 0.9 + aJitter;
    return vec3(cos(theta) * r * (1.0 + rJitter),
                sin(theta) * r * 0.9 + bob,
                g * 0.02);
  }

  if (comp > 3.5 && comp < 4.5) {
    float r = 0.46 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda + 0.9 + 0.030 * t + aJitter;
    return vec3(cos(theta) * r * CLAUDIO_COS_AZ,
                sin(theta) * r + bob,
                -cos(theta) * r * CLAUDIO_SIN_AZ + CLAUDIO_ZOFF + zJitter);
  }

  float radius;
  float sy;
  float sz;
  float phase;
  float rate;
  if (comp < 1.5) {
    radius = 0.22; sy = CLAUDIO_COS_INC_A; sz = CLAUDIO_SIN_INC_A; phase = 0.0; rate = 0.10;
  } else if (comp < 2.5) {
    radius = 0.42; sy = 1.0; sz = 0.0; phase = 2.1; rate = 0.07;
  } else if (comp < 3.5) {
    radius = 0.68; sy = CLAUDIO_COS_INC_C; sz = CLAUDIO_SIN_INC_C; phase = 4.2; rate = 0.045;
  } else {
    radius = 0.56; sy = CLAUDIO_COS_ORBIT; sz = CLAUDIO_SIN_ORBIT; phase = 3.0; rate = -0.055;
  }

  float r = radius * (1.0 + rJitter);
  float theta = LAB_TAU * lambda + phase + rate * t + aJitter;
  return vec3(cos(theta) * r,
              sin(theta) * r * sy + bob,
              sin(theta) * r * sz + zJitter);
}

float dragunovSheetOf(float seed) {
  if (uFormationDetail == 0) return 1.0;
  if (seed < 0.36) return 0.0;
  if (seed < 0.68) return 1.0;
  return 2.0;
}

float dragunovColsFor(float sheet) {
  if (uFormationDetail == 2) return 9.0;
  if (sheet < 0.5) return 6.0;
  return 7.0;
}

vec2 dragunovColumnBounds(float sheet) {
  if (sheet < 0.5) return vec2(-1.15, 1.15);
  if (sheet < 1.5) return vec2(-1.25, 1.25);
  return vec2(-1.35, 1.35);
}

float dragunovColumnIndex(float seed, float sheet) {
  return floor(labHash11(seed * 13.7 + sheet * 91.0 + 7.0)
               * dragunovColsFor(sheet));
}

float dragunovColumnHash(float sheet, float index) {
  return labHash11(index * 3.71 + sheet * 17.3 + 3.1);
}

vec3 dragunovHome(float lambda, float seed, float t) {
  float comp = uFormationDetail == 0 ? 1.0 : dragunovSheetOf(seed);
  float cols = dragunovColsFor(comp);
  vec2 span = dragunovColumnBounds(comp);
  float index = dragunovColumnIndex(seed, comp);
  float colHash = dragunovColumnHash(comp, index);
  float base = mix(span.x, span.y, (index + 0.5) / cols);
  float x = base + (colHash - 0.5) * 0.06;
  float gauss = (labHash11(seed * 29.1 + 2.4) + labHash11(seed * 41.7 + 3.1)
               + labHash11(seed * 53.3 + 5.9) - 1.5) * 2.0;
  x += gauss * (0.022 + comp * 0.005);
  x += 0.025 * sin(t * 0.55 + comp * 2.3 + x * 0.6);
  float warp = 0.055 * sin(x * 2.3 + t * 0.25 + comp * 2.1)
             + 0.030 * sin(x * 4.9 - t * 0.4 + comp);
  if (uFormationDetail == 2 && labHash11(seed * 57.7 + 13.1) > 0.92) {
    x += (labHash11(seed * 41.3 + 8.8) - 0.5) * 0.16;
  }
  float fallRate = 0.16 + 0.08 * labHash11(seed * 47.3 + 11.1);
  float phase = labHash11(seed * 23.7 + 9.4);
  float u = fract(lambda + phase + t * fallRate * 0.5);
  float y = mix(0.98, -1.08, u) + (labHash11(seed * 61.7 + 3.3) - 0.5) * 0.024;
  float zSheet = (comp - 1.0) * 0.19;
  float z = zSheet + warp * 0.55 + (labHash11(seed * 33.1 + 7.7) - 0.5) * 0.04;
  return vec3(x, y, z);
}

float victorComponent(float seed) {
  if (uFormationDetail == 0) {
    if (seed < 0.475) return 0.0;
    if (seed < 0.95) return 1.0;
    return 5.0;
  }
  if (uFormationDetail == 2) {
    if (seed < 0.26) return 0.0;
    if (seed < 0.52) return 1.0;
    if (seed < 0.74) return 2.0;
    if (seed < 0.85) return 3.0;
    if (seed < 0.91) return 4.0;
    if (seed < 0.97) return 6.0;
    return 5.0;
  }
  if (seed < 0.28) return 0.0;
  if (seed < 0.56) return 1.0;
  if (seed < 0.80) return 2.0;
  if (seed < 0.92) return 3.0;
  if (seed < 0.97) return 4.0;
  return 5.0;
}

float victorSizeScale(float seed) {
  float comp = victorComponent(seed);
  if (comp < 0.5) return 1.06;
  if (comp < 1.5) return 0.98;
  if (comp < 2.5) return 1.02;
  if (comp < 3.5) return 1.08;
  if (comp < 4.5) return 0.86;
  if (comp < 5.5) return 1.12;
  return 0.72;
}

const float VICTOR_STEP_INTERVAL = 1.1;
const float VICTOR_STEP_RAD = 0.5235987756;
const float VICTOR_STEP_RATE = 0.4759998;
const float VICTOR_ORBIT_RATE = 0.2617993878;

float victorDialPhase(float t) {
  float raw = t / VICTOR_STEP_INTERVAL;
  float segment = floor(raw);
  float frac = raw - segment;
  float inv = 1.0 - frac;
  float ease = 1.0 - inv * inv * inv;
  return mod(segment, 12.0) * VICTOR_STEP_RAD + ease * VICTOR_STEP_RAD;
}

float victorClunkEnvelope(float t) {
  float frac = fract(t / VICTOR_STEP_INTERVAL);
  return pow(1.0 - frac, 7.0);
}

vec3 victorHome(float lambda, float seed, float t) {
  float comp = victorComponent(seed);
  float phase = victorDialPhase(t);
  float rJitter = (labHash11(seed * 27.1 + 4.7) - 0.5) * 0.012;
  float aJitter = (labHash11(seed * 19.3 + 8.1) - 0.5) * 0.03;

  if (comp < 0.5) {
    float radius = 0.5 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda + phase + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, 0.18);
  }
  if (comp < 1.5) {
    float radius = 0.24 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda - 0.5 * VICTOR_STEP_RATE * t + 0.6 + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, -0.15);
  }
  if (comp < 2.5) {
    float spoke = floor(labHash11(seed * 31.7 + 6.3) * 6.0);
    float theta = spoke * (LAB_TAU / 6.0) + phase + aJitter * 0.12;
    float radius = mix(0.24, 0.5, lambda) + rJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, 0.0);
  }
  if (comp < 3.5) {
    float edge = floor(lambda * 6.0);
    float tt = fract(lambda * 6.0);
    float a0 = edge * (LAB_TAU / 6.0) + phase;
    float a1 = (edge + 1.0) * (LAB_TAU / 6.0) + phase;
    vec2 v0 = vec2(cos(a0), sin(a0)) * 0.13;
    vec2 v1 = vec2(cos(a1), sin(a1)) * 0.13;
    vec2 p = mix(v0, v1, tt);
    p += normalize(p) * rJitter * 0.20;
    return vec3(p, 0.03);
  }
  if (comp < 4.5) {
    float band = labHash11(seed * 37.3 + 9.2);
    float outerBand = band < 0.5 ? 1.0 : 0.0;
    float radius = mix(0.56, 0.37, outerBand) * (1.0 + rJitter);
    float theta = LAB_TAU * lambda
                + mix(-1.0, 1.0, outerBand) * VICTOR_ORBIT_RATE * t
                + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius,
                mix(-0.05, 0.05, outerBand));
  }
  if (comp > 5.5) {
    float radius = 0.44 * (1.0 + rJitter);
    float theta = LAB_TAU * lambda - phase + aJitter;
    return vec3(cos(theta) * radius, sin(theta) * radius, 0.0);
  }
  float gx = labHash11(seed * 29.1 + 2.4) + labHash11(seed * 41.7 + 3.1) - 1.0;
  float gy = labHash11(seed * 53.3 + 5.9) + labHash11(seed * 61.3 + 7.7) - 1.0;
  return vec3(gx * 0.018, gy * 0.018, 0.06);
}

vec3 restoredHome(float lambda, float seed, float filament, float t) {
  if (uFormation == 0) return labJinHome(lambda, seed, filament, t);
  if (uFormation == 1) return claudioHome(lambda, seed, t);
  if (uFormation == 2) return dragunovHome(lambda, seed, t);
  return victorHome(lambda, seed, t);
}


void main() {
  vec2 cn=vec2(float((0x1A>>gl_VertexID)&1),float((0x34>>gl_VertexID)&1))-0.5;vQuad=cn;float sd=float(gl_InstanceID)*13.37+uSeed*91.7;float r1=h11(sd+1.0),r2=h11(sd+2.0),r3=h11(sd+3.0);float lf=fract(uTime/(9.0+r3*7.0)+r2);
  vColor = vec3(0.0);
  vAlpha = 0.0;
  vHard = 0.0;
  vGlyph = 0.0;
  if(uFormation==4){float lambda=r1;float compSeed=r2;float comp=larsComponent(compSeed,float(uFormationDetail));float strand=mod(float(gl_InstanceID),2.0);vec3 pos=larsHome(lambda,compSeed,uTime,strand,float(uFormationDetail));float bodyMix=comp<0.5?0.15:(comp<1.5?0.10:(comp<2.5?0.08:0.08));vFade=smoothstep(0.0,0.14,r3)*(1.0-smoothstep(0.72,1.0,r3));if(comp<0.5){vTint=mix(uTintA,uTintB,bodyMix);vSpark=0.08+0.92*pow(r1,uSharp);}else if(comp<2.5){vTint=mix(uTintA,uTintB,bodyMix);vSpark=0.08+0.92*pow(r1,uSharp);}else if(comp<6.5){vTint=mix(uTintA,uTintB,bodyMix);vSpark=larsHash11(compSeed*91.7+3.1)>0.97?1.0:0.0;}else{vTint=vec3(0.82,0.92,1.00);vSpark=1.0;}vLambda=lambda;vComp=comp;float size=mix(0.008,0.026,r3)*uSize*larsSizeScale(comp);vec2 clip=vec2(pos.x/uAspect,pos.y)*0.82;vec2 corner=vec2(cn.x*size/uAspect,cn.y*size);gl_Position=vec4(clip+corner*2.0,0.0,1.0);return;}
  if (uFormation < 4) {
    float fi = float(gl_InstanceID);
    float streams = uFormation == 0 ? max(1.0, uFilaments) : 1.0;
    float filament = mod(fi, streams);
    float rows = max(1.0, ceil(uCount / streams));
    float edge = mod(fi, streams);
    float stagger = 0.5 * mod(edge, 2.0);
    float lambda = formationLambda((floor(fi / streams) + 0.5 + stagger) / rows);
    float seed = labHash11(fi * 1.37 + 4.11);

    vec3 home = restoredHome(lambda, seed, filament, uTime);
    vec3 previous = restoredHome(lambda, seed, filament, uTime - 0.045);
    vec3 motion = (home - previous) / 0.045;
    vec2 vel = motion.xy;

    vec2 pointer = uPointer * 2.0 - 1.0;
    vec2 delta = home.xy - pointer;
    float dist2 = dot(delta, delta);
    float fall = exp(-dist2 / max(0.22 * 0.22, 1e-4));
    vec2 dir = delta * inversesqrt(max(dist2, 1e-6));
    vec3 pos = vec3(home.xy
                  + (dir * 4.2 + vec2(-dir.y, dir.x) * 2.1) * fall * 0.035,
                  home.z);

    float alphaFloor = uFormation == 0
      ? 0.22 + 0.32 * labHash11(seed * 11.0 + 2.0)
      : 0.36 + 0.13 * labHash11(seed * 11.0 + 2.0);
    float spark;
    float comp = -1.0;
    float gain = 1.0;
    float compAlpha = 1.0;

    if (uFormation == 0) {
      spark = step(0.88, seed);
    } else if (uFormation == 1) {
      comp = claudioComponent(seed);
      spark = (comp < 0.5 || labHash11(seed * 91.7 + 3.1) > 0.94) ? 1.0 : 0.0;
      if (comp < 0.5) { gain = 2.0; compAlpha = 2.4; }
      else if (comp < 1.5) { gain = 1.35; compAlpha = 2.1; }
      else if (comp < 2.5) { gain = 1.25; compAlpha = 1.9; }
      else if (comp < 3.5) { gain = 1.1; compAlpha = 1.4; }
      else if (comp < 4.5) { gain = 0.85; compAlpha = 1.0; }
      else { gain = 0.95; compAlpha = 1.4; }
    } else if (uFormation == 2) {
      comp = uFormationDetail == 0 ? 1.0 : dragunovSheetOf(seed);
      spark = step(0.94, labHash11(seed * 91.7 + 3.1));
      if (comp < 0.5) { gain = 1.10; compAlpha = 0.95; }
      else if (comp < 1.5) { gain = 1.30; compAlpha = 1.25; }
      else { gain = 1.45; compAlpha = 1.55; }
      float dFallRate = 0.16 + 0.08 * labHash11(seed * 47.3 + 11.1);
      float dPhase = labHash11(seed * 23.7 + 9.4);
      float dU = fract(lambda + dPhase + uTime * dFallRate * 0.5);
      float spawnFade = smoothstep(0.0, 0.14, dU);
      float dissolve = 1.0 - smoothstep(0.82, 1.0, dU);
      compAlpha *= spawnFade * dissolve;
      gain *= 0.82 + 0.35 * dissolve;
    } else {
      comp = victorComponent(seed);
      spark = (comp > 4.5 && comp < 5.5) ? 1.0 : 0.0;
      if (comp < 0.5) { gain = 1.28; compAlpha = 1.32; }
      else if (comp < 1.5) { gain = 0.96; compAlpha = 1.12; }
      else if (comp < 2.5) { gain = 1.05; compAlpha = 1.10; }
      else if (comp < 3.5) { gain = 1.22; compAlpha = 1.24; }
      else if (comp < 4.5) { gain = 0.92; compAlpha = 0.98; }
      else if (comp < 5.5) { gain = 2.10; compAlpha = 2.25; }
      else { gain = 0.58; compAlpha = 0.62; }
      if (comp < 0.5) {
        float clunk = victorClunkEnvelope(uTime);
        gain *= 1.0 + 0.55 * clunk;
        compAlpha *= 1.0 + 0.35 * clunk;
      }
      if (comp > 4.5 && comp < 5.5) {
        float breath = 0.5 + 0.5 * sin(uTime * 0.9 + seed * 17.0);
        gain *= 0.85 + 0.35 * breath;
        compAlpha *= 0.90 + 0.20 * breath;
      }
    }

    float depth = clamp(pos.z * 2.1 + 0.5, 0.0, 1.0);

    if (uFormation == 2 && uFormationDetail != 0) {
      float period = uFormationDetail == 2 ? 1.3 : 1.8;
      float n = floor(uTime / period);
      float local = fract(uTime / period);
      float pulsePhase = local * local * (3.0 - 2.0 * local);
      float pulseY = mix(0.98, -1.08, pulsePhase);
      float targetSheet = mod(n, 3.0);
      if (abs(comp - targetSheet) < 0.5) {
        float cols = dragunovColsFor(comp);
        float targetCol = floor(mod(n * 3.71 + 1.3, cols));
        if (abs(dragunovColumnIndex(seed, comp) - targetCol) < 0.5) {
          float pulse = exp(-pow((pos.y - pulseY) * 5.0, 2.0));
          gain *= 1.0 + pulse * 1.5;
          compAlpha *= 1.0 + pulse * 1.1;
          if (pulse > 0.25) spark = 1.0;
        }
      }
    }

    vec2 screenVel = vec2(vel.x / uAspect, vel.y);
    float speed = length(screenVel);
    vec2 screenDir = speed > 1e-4 ? screenVel / speed : vec2(0.0, 1.0);
    vec2 perp = vec2(-screenDir.y, screenDir.x);
    float stretchBase = uFormation == 0 ? 1.18
                      : (uFormation == 1 ? 1.32
                      : (uFormation == 2 ? 2.10 : 1.00));
    float stretchSpeed = uFormation == 0 ? 0.50
                       : (uFormation == 1 ? 0.90
                       : (uFormation == 2 ? 0.90 : 0.35));
    float stretch = stretchBase + min(speed, 2.5) * stretchSpeed + spark * 0.55;
    float sizeScale = uFormation == 0 ? 1.0
                    : (uFormation == 1 ? claudioSizeScale(seed)
                    : (uFormation == 2 ? dragunovSizeScale(seed)
                    : victorSizeScale(seed)));
    float size = mix(0.0048, 0.0105, labHash11(seed * 91.7 + 3.1)) * uSize
               * (0.82 + 0.46 * depth) * (1.0 - spark * 0.18) * sizeScale;
    vec2 clip = vec2(pos.x / uAspect, pos.y) * 0.82;
    vec2 offset = (screenDir * cn.x * stretch + perp * cn.y) * (2.0 * size);
    offset.x /= uAspect;
    gl_Position = vec4(clip + offset, 0.0, 1.0);

    vec3 color;
    if (uFormation == 0) {
      float heat = clamp(0.35 + lambda * 0.45 + labHash11(seed * 37.0) * 0.2, 0.0, 1.0);
      color = mix(uTintA, uTintB, clamp(heat * 0.8 + spark, 0.0, 1.0));
    } else if (uFormation == 1) {
      if (comp < 0.5) color = mix(uTintB, vec3(1.0), 0.32);
      else if (comp < 1.5) color = mix(uTintA, uTintB, 0.35);
      else if (comp < 2.5) color = uTintA;
      else if (comp < 3.5) color = mix(uTintA, uTintB, 0.65);
      else if (comp < 4.5) color = mix(uTintB, uFog, 0.30);
      else color = mix(uTintA, uTintB, 0.25);
    } else if (uFormation == 2) {
      if (spark > 0.5) color = mix(uTintB, vec3(1.0), 0.30);
      else if (comp < 0.5) color = mix(uTintA, uFog, 0.55);
      else if (comp < 1.5) color = uTintA;
      else color = mix(uTintA, uTintB, 0.32);
    } else {
      if (comp < 0.5) color = uTintA;
      else if (comp < 1.5) color = uTintB;
      else if (comp < 2.5) color = mix(uTintA, uTintB, 0.55);
      else if (comp < 3.5) color = mix(uTintB, vec3(1.0), 0.15);
      else if (comp < 4.5) color = mix(uTintA, uTintB, 0.25);
      else if (comp < 5.5) color = mix(uTintB, vec3(1.0), 0.55);
      else color = mix(uTintA, uTintB, 0.40);
    }
    color = mix(color, uFog, (1.0 - depth) * 0.34);
    vColor = color * (0.90 + 0.52 * depth) * gain;
    vAlpha = alphaFloor
           * (0.60 + 0.44 * depth)
           * (0.78 + 0.50 * spark)
           * compAlpha;
    vHard = max(spark, 0.0);
    vGlyph = uFormation == 3 ? 1.0 : 0.0;
    vTint = color;
    vFade = 1.0;
    vSpark = spark;
    vLambda = lambda;
    vComp = comp;
    return;
  }
  float size=mix(0.008,0.026,r3)*uSize*(1.0-lf*0.55);vec2 pos=uOrigin+vec2((r1-0.5)*0.82,(r2-0.5)*0.2)+uDir*lf;pos.x+=sin(uTime*0.9+sd*6.1+lf*9.4)*uSwirl*0.055;pos.y+=cos(uTime*0.65+sd*3.7+lf*7.9)*uSwirl*0.04;vec2 dp=pos-(uPointer*2.0-1.0);dp.x*=uAspect;float dl=length(dp);float inf=1.0-smoothstep(0.0,0.42,dl);vec2 dir=dp/max(dl,0.001);pos+=(dir*0.13+vec2(-dir.y,dir.x)*0.045)*inf;vFade=smoothstep(0.0,0.14,lf)*(1.0-smoothstep(0.72,1.0,lf));vSpark=0.08+0.92*pow(r1,uSharp)+inf*0.22;vTint=mix(uTintA,uTintB,r3*r3*0.75)*(0.65+0.5*r2);vLambda=0.0;vComp=-1.0;gl_Position=vec4(pos+cn*size*2.0,0.0,1.0);
}
`;

export const particleFragmentSource = `#version 300 es
precision highp float;uniform float uTime,uFormationGain;uniform highp int uFormation,uFormationDetail;in vec3 vTint;in float vFade;in float vSpark;in vec2 vQuad;in float vLambda;in float vComp;
in vec3 vColor;
in float vAlpha;
in float vHard;
in float vGlyph;out vec4 outColor;float h11(float n){return fract(sin(n)*43758.5453123);}
void main() {
  float d = length(vQuad);
  float a = exp(-d * d * 9.0) * vFade * (0.07 + 0.6 * vSpark);
  if(uFormation==4){float localS;if(vComp<0.5)localS=vLambda;else if(vComp<1.5)localS=0.62+0.55*vLambda;else if(vComp<2.5)localS=0.30+0.55*vLambda;else localS=vLambda;float phase=fract(uTime/2.2-localS);float dPulse=min(phase,1.0-phase);float larsPulse=1.0-smoothstep(0.0,0.18,dPulse);float larsRidge=exp(-pow(dPulse/0.05,2.0));float pulseAlpha=1.0+0.35*larsPulse+0.20*larsRidge;a*=pulseAlpha;if(vComp>6.5){float pulseIdx=floor(uTime/2.2);float chosen=mod(pulseIdx,2.0);float socketIndex=vComp>7.5?1.0:0.0;if(abs(chosen-socketIndex)<0.5){float pop=larsPulse*(0.55+0.45*h11(pulseIdx*7.3+1.7));a*=(1.0+0.85*pop);a=min(a,2.30);}}if(vComp>=3.0&&vComp<6.5){float pulseIdx=floor(uTime/2.2);float barbId=vComp-3.0;float sel1=floor(mod(pulseIdx*3.7,4.0));float sel2=floor(mod(pulseIdx*7.3+1.0,4.0));float isPopped=(abs(barbId-sel1)<0.5||abs(barbId-sel2)<0.5)?1.0:0.0;float popPhase=fract(uTime/1.1);float popEnv=smoothstep(0.0,0.1,popPhase)*(1.0-smoothstep(0.1,0.2,popPhase));float barbPop=isPopped*popEnv;a*=(1.0+0.60*barbPop);}if(vComp>6.5){a=mix(a,1.0,larsRidge*0.10);}}
  if (uFormation < 4) {
    float r2 = dot(vQuad, vQuad);
    float soft;
    float core;
    vec3 coreTint;
    if (vGlyph > 0.5) {
      float dd = abs(vQuad.x) + abs(vQuad.y);
      if (dd > 1.0) {
        discard;
      }
      r2 = dd * dd;
      soft = exp(-r2 * 2.6);
      core = exp(-r2 * 12.0);
      coreTint = vec3(0.68, 0.94, 1.0);
    } else {
      if (r2 > 1.0) {
        discard;
      }
      soft = exp(-r2 * 3.6);
      core = exp(-r2 * 17.0);
      coreTint = vec3(1.0, 0.91, 0.76);
    }
    vec3 color = vColor + coreTint * core * (0.35 + 1.05 * vHard);
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    float brightnessClip = 1.0 - smoothstep(0.78, 1.0, luminance) * 0.55;
    outColor = vec4(color, soft * vAlpha * brightnessClip * uFormationGain);
    return;
  }
  a *= uFormationGain;
  outColor = vec4(vTint, a);
}
`;
