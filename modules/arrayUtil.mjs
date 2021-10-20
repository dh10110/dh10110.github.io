/**
 * Default Comparison Function
 * @param a First item to compare
 * @param b Second item to compare
 * @returns -1 if a < b, 1 if a > b, 0 otherwise (equal)
 */
export function defaultCompare(a, b) {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
}

/**
 * Makes an a/b comparer function from comparison criteria, usable for sorting.
 * 
 * Strings are treated as property names of the a,b items
 * Single parameter functions are evaluated for each item, like property names
 * Multi-parameter functions are treated as a/b comparers
 * If comparison is iterable (like an array), the comparer made will apply all the iterated comparisons in sequence (i.e. secondary sort criteria)
 * @param comparison Comparison to turn into an a/b comparer
 * @returns {function} comparer(a, b)
 */
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

/**
 * Turns a list of comparisons into a single a/b comparer, usable for sorting.
 * The comparer will apply the comparisons in sequence (i.e. secondary sort criteria)
 * @param comparisons parameter list of comparisons to turn into an a/b comparer
 * @returns {function} comparer(a, b)
 */
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

/**
 * Turns th provided comparison into descending a/b comparer
 * @param comparison a comparison to turn into a descending a/b comparer
 * @returns {function} comparer(a, b)
 */
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
