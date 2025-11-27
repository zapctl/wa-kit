function makeEnumerable(obj) {
    return Object.getOwnPropertyNames(obj).reduce((data, prop) => {
        data[prop] = obj[prop];
        return data;
    }, {});
}