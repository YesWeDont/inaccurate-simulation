export function secondOrderToFirstOrder<Consts>(func: (consts: Consts, x: number[], dx: number[])=>number[]): (consts: Consts, xAndDx: number[])=>number[]{
    return (consts, xAndDx)=>{
        const length = xAndDx.length, half = length/2;
        if(!Number.isInteger(half)) throw new Error('Expected even number of inputs, '+xAndDx);
        const x = xAndDx.slice(0, half);
        const dx = xAndDx.slice(half);
        const ddx = func(consts, x, dx);
        const concat = new Array(length);
        for(let i=0; i<half;i++) concat[i] = dx[i]
        for(let i=half; i<length; i++) concat[i]=ddx[i-half];
        return concat;
    }
}

/**
 * 
 * @param dt Time interval to integrate for
 * @param input Conditions at t_0
 * @param derivative dictates how the input shall change
 * @returns Conditions at t_0+dt
 */
export function rk4<Consts>(consts: Consts, t:number, dt: number, input: number[], derivative: (consts: Consts, input: number[])=>number[]):number[]{
    const k1 = derivative(consts, input);
    const k2 = derivative(consts, add(input, mul(k1, dt/2)));
    const k3 = derivative(consts, add(input, mul(k2, dt/2)));
    const k4 = derivative(consts, add(input, mul(k3, dt)));
    const f = add(input, add(add(mul(k1, dt/6), mul(k2, dt/3)), add(mul(k3, dt/3),  mul(k4, dt/6))));
    return f;
}


// https://jsperf.app/map-reduce-named-functions: for loops are INSANELY fast
function add(a: number[], b: number[]):number[]{
    let ret = new Array(a.length);
    for(let i = 0, len = ret.length; i < len; i++) ret[i] = a[i] + b[i];
    return ret;
}
function mul(v: number[], t: number):number[]{
    let ret = new Array(v.length);
    for(let i = 0, len = ret.length; i < len; i++) ret[i] = v[i]*t;
    return ret;
}