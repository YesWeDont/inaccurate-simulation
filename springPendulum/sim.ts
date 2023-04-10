import {CONFIG} from './config'
import { rk4, secondOrderToFirstOrder } from './solvers';
export function dot(CONSTS: typeof CONFIG.CONSTS, [r, theta]: number[], [rdot, thetadot]: number[]){
    const rdd = r*thetadot*thetadot+CONSTS.g*Math.cos(theta)-CONSTS.k/CONSTS.m*(r-CONSTS.r0);
    const tdd = -2*rdot*thetadot/r-CONSTS.g*Math.sin(theta)/r;
    return [rdd, tdd]
}
export function polarToCanvas(r: number, theta: number) { return [r * Math.sin(theta), r * Math.cos(theta)] }
export function energy(r: number, theta: number, rdot: number, thetadot: number) {
    const vSquared = (rdot * rdot) + (r * thetadot) * (r * thetadot);
    const ke = 0.5 * CONFIG.CONSTS.m * vSquared;
    const gpe = CONFIG.CONSTS.g * CONFIG.CONSTS.m * -r * Math.cos(theta);
    const pe = 0.5 * CONFIG.CONSTS.k * (r - CONFIG.CONSTS.r0) * (r - CONFIG.CONSTS.r0);
    return [
        ke + gpe + pe,
        ke, gpe, pe,
    ];
}


export function createIntegrator(){
    const dot2 = secondOrderToFirstOrder(dot);
    return (t:number, dt: number, conditions:number[])=>rk4(CONFIG.CONSTS, t, dt, conditions, dot2)
}
