
export async function getDistricts() {
    //Get text file content
    const ridings = await fetch('/datafiles/districts.txt')
        .catch(err => console.log(err))
        .then(response => response.text())
        .then(text => {
            const ridings = [];
            const lines = text.split(/\r\n|[\r\n]/g);
            const skipLines = 1; //header
            for (let lineIndex = skipLines; lineIndex < lines.length; lineIndex += 1) {
                const line = lines[lineIndex];
                const values = line.split(/,/g);
                if (values.length >= 2) {
                    ridings.push({
                        riding: values[0],
                        districts: values[1].split(/~/g)
                    });
                }
            }
            return ridings;
        });
    return ridings;
}
