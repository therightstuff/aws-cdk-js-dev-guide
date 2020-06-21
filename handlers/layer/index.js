const aws = require('aws-sdk');
const uuid = require('uuid').v4;

exports.handler = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        return resolve({
            "isBase64Encoded": false,
            "statusCode": 200,
            "headers": {},
            "body": JSON.stringify({
                "generatedId": uuid()
            })
        });
    });
    return promise;
}