exports.handler = async (event) => {
    console.log("scheduled lambda function called.")

    // warmup calls do not have event.pathParameters defined
    if (!event.pathParameters) {
        console.log('warmup call detected, ending');
        return;
    }

    return new Promise((resolve, reject) => {
        resolve({
            "isBase64Encoded": false,
            "statusCode": 200,
            "headers": {
                'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
                'Access-Control-Allow-Credentials': true,
            },
            "body": JSON.stringify({
                "success": true,
                "message": "This is a the response to an unscheduled HTTP request"
            })
        });
    });
}