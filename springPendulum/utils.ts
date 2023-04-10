export function percent(number: number){
    return ((+number*100).toFixed(2))+'%'
}
export function int(number: number){
    return Math.round(number)+'';
}
export function float(number:number){
    return number+''
}
export function cutTrailingZeros(formattedNumber: string){
    return formattedNumber.replace(/\.([1-9]*)0+(%?)$/, '.$1$2').replace('.%', '%').replace(/\.$/, '');
}
export function warnIf(predicate: boolean, warning: string, ele: HTMLElement, noEmit=false) {
    if(predicate){
        ele.title = warning;
        if(!ele.classList.contains('active')) ele.classList.add('active')
        if(!noEmit) throw new Error(warning);
    }else if(ele.classList.contains('active')){
        ele.classList.remove('active');
        ele.title="Warning not active"
    }
    return predicate
}
export function changeRate(oldValue: number, newValue:number){ return (newValue-oldValue)/oldValue }