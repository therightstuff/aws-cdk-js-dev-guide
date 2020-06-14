exports.handler = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        return resolve({
            "simpleResponse": `${process.env.HELLO}, ${process.env.WORLD}!`
        });
    });
    return promise;
}