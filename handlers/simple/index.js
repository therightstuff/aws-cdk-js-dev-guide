exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        // randomly return success or failure with the appropriate status code
        let success = Math.floor(Math.random() * 2) == 1;
        let statusCode = (success ? 200 : 500)
        let returnObject = {
            "success": success,
            "notice": `Please note that status code and "success" value are randomly determined`,
            "querystring": event.queryStringParameters
        };

        resolve({
            "isBase64Encoded": false,
            "statusCode": statusCode,
            "headers": {
                'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
                'Access-Control-Allow-Credentials': true,
            },
            "body": JSON.stringify(returnObject)
        });
    });
    return promise;
}