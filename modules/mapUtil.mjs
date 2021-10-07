
export function getOrAdd(map, key, fnAdd) {
    if (map.has(key)) {
        return map.get(key);
    }
    const newItem = fnAdd();
    map.set(key, newItem);
    return newItem;
}
