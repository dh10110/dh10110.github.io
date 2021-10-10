
export function getOrAdd(map, key, fnAdd) {
    if (map.has(key)) {
        return map.get(key);
    }
    const newItem = fnAdd();
    map.set(key, newItem);
    return newItem;
}

export function concat(iterable, fnToString) {
    const sb = [];
    for (const item of iterable) {
        const txt = fnToString ? fnToString(item) : item.toString();
        sb.push(txt)
    }
    return sb.join('');
}
