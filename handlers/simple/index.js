exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        // randomly return success or failure with the appropriate status code
        let success = Math.floor(Math.random() * 2) == 1;
        let statusCode = (success ? 200 : 500)
        let returnObject = {
            "success": success
        };

        resolve({
            "isBase64Encoded": false,
            "statusCode": statusCode,
            "headers": {},
            "body": JSON.stringify(returnObject)
        });
    });
    return promise;
}