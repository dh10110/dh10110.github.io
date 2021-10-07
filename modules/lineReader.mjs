
export function* readDelimitedFile(text, { skip = 0, delimiter = ',' } = {}) {
    const lines = text.split(/\r\n|[\r\n]/g);
    for (let i = skip; i < lines.length; i += 1) {
        const line = lines[i];
        yield line.split(delimiter);
    }
}
