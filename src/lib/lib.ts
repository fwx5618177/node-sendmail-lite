export const base64_encode = (str: string) => {
    return new Buffer(str).toString('base64');
}

export const toInt = (str: string, def: number = 0) => {
    const r = parseInt(str, 10);
    return isNaN(r) ? def : r;
}


