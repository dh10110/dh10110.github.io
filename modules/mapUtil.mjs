
/**
 * Gets an item from a map with key, or adds one if key is not in map yet
 * @param {Map} map Map to get 
 * @param key Key of item to get or add
 * @param {function()} fnAdd Callback to create item to add to map if key not present
 * @returns item from Map with key (possible just created with fnAdd)
 */
export function getOrAdd(map, key, fnAdd) {
    if (map.has(key)) {
        return map.get(key);
    }
    const newItem = fnAdd();
    map.set(key, newItem);
    return newItem;
}

/**
 * Concatenate items of an iterable into a string.
 * Intended for use in template literals, so you don't have to remember to use .join('').
 * @param {Iterable} iterable 
 * @param {function(any):string} fnToString 
 * @param {string} separator
 * @returns {string} iterable items converted to string.
 */
export function concat(iterable, fnToString, separator = '') {
    if (!iterable) return '';
    
    const sb = [];
    for (const item of iterable) {
        if (sb.length > 0 && separator.length > 0) sb.push(separator);
        const txt = fnToString ? fnToString(item) : item.toString();
        sb.push(txt)
    }
    return sb.join('');
}
