
export function ceil(value, decimalPlaces = 0) {
    return Number(Math.ceil(value + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
}

export function floor(value, decimalPlaces = 0) {
    return Number(Math.floor(value + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
}
