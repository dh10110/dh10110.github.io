export function defaultCompare(a, b) {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
}

function makeComparer(comparison) {
    if (typeof(comparison) === 'function') return comparison;
    if (typeof(comparison) === 'string') return (a, b) => compare(a[comparison], b[comparison]);
    //default
    return defaultCompare;
}

export function desc(comparison) {
    const comparer = makeComparer(comparison);
    return (a, b) => comparer(b, a);
}

export function orderBy(iterable, ...comparisons) {
    return [...iterable].sort((a, b) => {
        for (const comparison of comparisons) {
            const comparer = makeComparer(comparison);
            const compareResult = comparer(a, b);
            if (compareResult) return compareResult;
        }
    });
}

export function withoutIndex(array, i) {
    const arrayWithoutIndex = [
        ...array.slice(0, i),
        ...array.slice(i + 1, array.length)
    ];
    return arrayWithoutIndex;
}
