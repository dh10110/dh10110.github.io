
export async function getDistricts() {
    //Get text file content
    const text = await fetch('/datafiles/districts.txt')
        .catch(err => console.log(err))
        .then(response => response.body);
    //TODO: process CSV
    return text;
}
