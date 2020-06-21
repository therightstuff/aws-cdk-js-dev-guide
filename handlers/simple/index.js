exports.handler = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        return resolve({
            "isBase64Encoded": false,
            "statusCode": 200,
            "headers": {},
            "body": JSON.stringify({
                "simpleResponse": `${process.env.HELLO}, ${process.env.WORLD}!`
            })
        });
    });
    return promise;
}