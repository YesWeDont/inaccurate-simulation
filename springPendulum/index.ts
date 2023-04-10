import { CONFIG } from "./config";
import { changeRate, cutTrailingZeros, float, int, percent, warnIf } from "./utils";
import { polarToCanvas, energy, createIntegrator } from "./sim";

// @ts-ignore esbuild live reload
if(window.IS_DEV){
    let reloader = new EventSource('/esbuild');
    reloader.addEventListener('change', () => location.reload());
}

document.addEventListener('DOMContentLoaded', async () => {

    // init physics
    let ctx = getRenderingContext();
    let lastT: number;
    let conditions = [CONFIG.CONSTS.r0 * 0.8, Math.PI + 0.0000001, 0, 0];
    let prevEnergy = energy(conditions[0], conditions[1], conditions[2], conditions[3]);
    let trail = polarToCanvas(conditions[0], conditions[1]);
    let integrator = createIntegrator();
    let conditionsModified = false;
    let updatedPanel = true;
    let panelUpdateCallback: number;
    let renderCallback: number;
    let paused = false;
    let rendered = true;

    // Numerical displays
    const fpsSpan = document.querySelector('span.fps') as HTMLSpanElement;
    const energySpan = document.querySelector('span.energy') as HTMLSpanElement;
    const energyChangeSpan = document.querySelector('span.energy-change') as HTMLSpanElement;
    const keSpan = document.querySelector('span.ke') as HTMLSpanElement;
    const keChangeSpan = document.querySelector('span.ke-change') as HTMLSpanElement;
    const gpeSpan = document.querySelector('span.gpe') as HTMLSpanElement;
    const gpeChangeSpan = document.querySelector('span.gpe-change') as HTMLSpanElement;
    const peSpan = document.querySelector('span.pe') as HTMLSpanElement;
    const peChangeSpan = document.querySelector('span.pe-change') as HTMLSpanElement;
    const rSpan = document.querySelector('span.r') as HTMLSpanElement;
    const thetaSpan = document.querySelector('span.theta') as HTMLSpanElement;
    const rDotSpan = document.querySelector('span.rdot') as HTMLSpanElement;
    const thetaDotSpan = document.querySelector('span.thetadot') as HTMLSpanElement;
    
    // warning lights
    const panelHungWarning = document.querySelector('span.panel-hung-warn') as HTMLElement;
    const notRenderedWarning = document.querySelector('span.not-rendered-warn') as HTMLElement;
    const settingsTooQuick = document.querySelector('span.settings-too-quick-warn') as HTMLElement;
    const energyChangeWarning = document.querySelector('span.energy-change-warn') as HTMLElement;
    const fpsWarning = document.querySelector('span.fps-warn') as HTMLElement;
    const pauseWarning = document.querySelector('span.pause-warn') as HTMLElement;

    // Settings
    const timeWarpSpan = document.querySelector('span.time-warp') as HTMLSpanElement;
    const gSpan = document.querySelector('span.g') as HTMLSpanElement;
    const trailLengthSpan = document.querySelector('span.trail-length') as HTMLSpanElement;
    const kSpan = document.querySelector('span.k') as HTMLSpanElement;
    const mSpan = document.querySelector('span.m') as HTMLSpanElement;
    const scaleSpan = document.querySelector('span.scale') as HTMLSpanElement;
    const r0Span = document.querySelector('span.r0') as HTMLSpanElement;

    if (
        !fpsSpan || !energySpan || !energyChangeSpan || !keSpan
        || !keChangeSpan || !gpeSpan || !gpeChangeSpan
        || !peSpan || !peChangeSpan || !panelHungWarning
        || !energyChangeWarning || !fpsWarning || !timeWarpSpan
        || !gSpan || !trailLengthSpan || !pauseWarning
        || !kSpan || !mSpan || !scaleSpan || !r0Span
        || !rSpan || !thetaSpan || !rDotSpan || !thetaDotSpan
    )
        throw new Error('Could not get display panel');

    // Bind CONFIG to Settings pane
    document.querySelector('button[name=pause]')?.addEventListener('click', e=>{
        paused = !paused;
        (e.target as HTMLButtonElement).innerHTML = paused?'Play':'Pause';
    })
    document.querySelector('input[name=trail-length]')?.addEventListener('input', e => {
        if(!e) return;
        trailLengthSpan.innerHTML = float((CONFIG.trailLength = 1000 * CONFIG.timewarp * +(e.target as HTMLInputElement)?.value || CONFIG.trailLength)/1000/CONFIG.timewarp);
    });
    document.querySelector('input[name=time-warp]')?.addEventListener('input', e => {
        if (!e) return;
        const original = CONFIG.timewarp;
        timeWarpSpan.innerHTML = cutTrailingZeros(percent(CONFIG.timewarp = Math.pow(2, parseFloat((e.target as HTMLInputElement)?.value)) || CONFIG.timewarp));
        CONFIG.trailLength /= original;
        CONFIG.trailLength *= CONFIG.timewarp;
    });
    document.querySelector('input[name=g]')?.addEventListener('input', ev=> gSpan.innerHTML = float(modifyConfig('g', +(ev.target as HTMLInputElement).value)));
    document.querySelector('input[name=r0]')?.addEventListener('input', ev=> r0Span.innerHTML= float(modifyConfig('r0', +(ev.target as HTMLInputElement).value)))
    document.querySelector('input[name=k]')?.addEventListener('input', ev => kSpan.innerHTML = int(modifyConfig('k',+(ev.target as HTMLInputElement).value)));
    document.querySelector('input[name=m]')?.addEventListener('input', ev => mSpan.innerHTML = int(modifyConfig('m', +(ev.target as HTMLInputElement).value)));

    document.querySelector('input[name=scale]')?.addEventListener('input', ev => {
        scaleSpan.innerHTML = float(CONFIG.pxPerM = +(ev.target as HTMLInputElement).value || CONFIG.pxPerM);
        ctx = getRenderingContext();
        render()
    });
    document.querySelector('button.update')?.addEventListener('click', ev=>{
        let e = energy(conditions[0], conditions[1], conditions[2], conditions[3]);
        updatePanel(true, NaN, e, changeRate(prevEnergy[0], e[0]));
    })

    window.addEventListener('resize', () => ctx = getRenderingContext());
    document.querySelector('button.reset-ctx')?.addEventListener('click', () => ctx = getRenderingContext());

    requestAnimationFrame(function tick(t) {
        requestAnimationFrame(tick);
        cancelIdleCallback(panelUpdateCallback);
        cancelIdleCallback(renderCallback);
        conditionsModified = false;
        if(warnIf(paused, 'Simulation paused', pauseWarning, true)) return;
        warnIf(!updatedPanel && !paused, 'Stats panel disconnected, close some programs or slow down time warp', panelHungWarning, true);
        warnIf(!rendered && !paused, 'Renderer disconnected, close some programs or slow down time warp', notRenderedWarning, true);
        updatedPanel = false
        rendered = false
        if (!lastT) return lastT = t;
        const dt = ((lastT - (lastT = t)) / -1000);
        if(warnIf(dt > 0.5, 'Critically low frame rate detected (or maybe you were changing windows too much). Close some programs.', fpsWarning))
            ctx = getRenderingContext();

        let newConditions = conditions.slice();
        let temp = conditions.slice();

        let e:number[];
        let powerPercent:number = 0;
        const iterations = Math.floor(CONFIG.steps * CONFIG.timewarp);
        for (let i = 0; i < iterations; i++) {
            temp = integrator(t, dt/CONFIG.steps, temp);
            if(conditionsModified) return;
            if((CONFIG.timewarp >= 1 && Math.round(i * Math.round(CONFIG.timewarp)) % CONFIG.samplingFrequency == 0) || i == iterations-1){
                e = energy(newConditions[0], newConditions[1], newConditions[2], newConditions[3]);
                powerPercent = (e[0] - prevEnergy[0]) / e[0] / dt;
                if(!warnIf(Math.abs(powerPercent) >= 0.05 || isNaN(powerPercent), `Large energy change ${percent(powerPercent)} detected, ignoring this frame.`, energyChangeWarning, true)){
                    newConditions = temp;
                    trail.push(...polarToCanvas(newConditions[0], newConditions[1]))
                }
            }
        }

        if(conditionsModified){
            updatedPanel = true; rendered = true;
            return;
        }
        conditions = newConditions;
        panelUpdateCallback = requestIdleCallback(()=>updatePanel(false, dt, e, powerPercent));
        renderCallback = requestIdleCallback(render);

    });

    function render(){
        rendered = true;
        ctx.clearRect(-innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight);

        while (trail.length > CONFIG.trailLength){ trail = trail.slice(2) };
        for (let i = 0; i < trail.length; i+=2) {
            let x = trail[i], y = trail[i+1];
            let percentage = i/trail.length, fromHalf = 0.5-percentage;
            ctx.strokeStyle = `rgb(${percentage < 0.5 ? fromHalf * 510:0}, ${percentage <= 0.5 ? percentage * 510 : (1+fromHalf) * 255}, ${percentage < 0.5 ? 0: -fromHalf * 510})`;
            ctx.beginPath();
            ctx.moveTo(trail[i > 0 ? i - 2 : 0], trail[i > 0 ? i - 1 : 1])
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        const x = trail[trail.length - 2], y = trail[trail.length - 1];
        ctx.strokeStyle = "#000"
        ctx.beginPath();
        ctx.moveTo(x, y)
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, Math.min(Math.max(0.5, CONFIG.CONSTS.m/CONFIG.pxPerM), 5), 0, 2 * Math.PI);
        ctx.fill();
    }

    function updatePanel(force: boolean, dt:number, e:number[], powerPercent:number) {
        if(!force && updatedPanel) return; // no need to update the panel
        updatedPanel = true;
        // bind stats to display panel
        fpsSpan.innerHTML = isNaN(dt)?'[Unknown]':int(1 / dt);
        energySpan.innerHTML = int(e[0]);
        energyChangeSpan.innerHTML = isNaN(dt)?'[Unknown]':percent(powerPercent * dt);
        keSpan.innerHTML = int(e[1]);
        keChangeSpan.innerHTML = percent(changeRate(prevEnergy[1], e[1]));
        gpeSpan.innerHTML = int(e[2]);
        gpeChangeSpan.innerHTML = percent(changeRate(prevEnergy[2], e[2]));
        peSpan.innerHTML = int(e[3]);
        peChangeSpan.innerHTML = percent(changeRate(prevEnergy[3], e[3]));
        rSpan.innerHTML = (conditions[0]/CONFIG.CONSTS.r0).toFixed(2);
        thetaSpan.innerHTML = (conditions[1]/Math.PI % 2).toFixed(2);
        rDotSpan.innerHTML = (conditions[2]/CONFIG.CONSTS.r0).toFixed(2);
        thetaDotSpan.innerHTML = (conditions[3]/Math.PI % 2).toFixed(2);
        // @ts-ignore GC
        prevEnergy = null;
        prevEnergy = e;
    }
    function modifyConfig(setting: keyof typeof CONFIG.CONSTS, value: number){
        let cache = JSON.parse(JSON.stringify(CONFIG.CONSTS));
        CONFIG.CONSTS[setting] = value;
        let newEnergy = energy(conditions[0], conditions[1], conditions[2], conditions[3]),
        rate = changeRate(prevEnergy[0], newEnergy[0]);
        let message = `Large energy change detected (${percent(rate)}) after changing of settings. Please change them slowly.`;
        if(warnIf(isNaN(rate) || Math.abs(rate) >= 0.05, message, settingsTooQuick, true)){
            CONFIG.CONSTS = cache;
            (document.querySelector(`input[name=${setting}]`) as HTMLInputElement).value = float(CONFIG.CONSTS[setting]);
            throw new Error(message);
        }
        else prevEnergy = newEnergy;
        return value
    }
});

function getRenderingContext() {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        alert('Your browser is too old!');
        throw new Error('Browser does not support `2d` canvas context');
    }
    canvas.height = innerHeight;
    canvas.width = innerWidth;
    let ctx = canvas?.getContext('2d');
    if (!ctx) {
        alert('Your browser is too old!');
        throw new Error('Browser does not support `2d` canvas context');
    }
    ctx.setTransform(CONFIG.pxPerM, 0, 0, CONFIG.pxPerM, innerWidth / 2, innerHeight / 2);
    ctx.lineWidth = 1 / CONFIG.pxPerM;
    return ctx;
}