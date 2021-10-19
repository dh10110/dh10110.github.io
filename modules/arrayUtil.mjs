export function defaultCompare(a, b) {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
}

export function makeComparer(comparison) {
    if (comparison == null) return defaultCompare;
    if (typeof(comparison) === 'function') {
        if (comparison.length === 1) return (a, b) => defaultCompare(comparison(a), comparison(b));
        else return comparison;
    }
    if (typeof(comparison) === 'string') return (a, b) => defaultCompare(a[comparison], b[comparison]);
    if (typeof comparison[Symbol.iterator] === 'function') return orderCriteria(comparison);
    //default
    return defaultCompare;
}

export function orderCriteria(...comparisons) {
    //define all the comparers
    const comparers = [];
    for (const comparison of comparisons) {
        comparers.push(makeComparer(comparison));
    }
    return (a, b) => {
        //Evaluate each comparer in turn
        for (const comparer of comparers) {
            const compareResult = comparer(a, b);
            //if comparing gives a non-zero (non-equal) result, return it
            if (compareResult) return compareResult;
        }
        //All comparers evaluated, items are equal for all comparisons
        return 0;
    }
}

export function desc(comparison) {
    const comparer = makeComparer(comparison);
    return (a, b) => comparer(b, a);
}

export function orderBy(iterable, ...comparisons) {
    return [...iterable].sort(orderCriteria(...comparisons));
}

export function first(iterable, ...comparisons) {
    const comparer = orderCriteria(...comparisons);
    let firstItem = null;
    for (const item of iterable) {
        if (firstItem === null) {
            firstItem = item;
        } else if (comparer(item, firstItem) < 0) {
            firstItem = item;
        }
    }
    return firstItem;
}

export function withoutIndex(array, i) {
    const arrayWithoutIndex = [
        ...array.slice(0, i),
        ...array.slice(i + 1, array.length)
    ];
    return arrayWithoutIndex;
}
