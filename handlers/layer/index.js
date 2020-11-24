const aws = require('aws-sdk');
const uuid = require('uuid').v4;
const utils = require('/opt/nodejs/sample-layer/utils');

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        resolve(utils.createResponse({
            "statusCode": 200,
            "headers": {
                'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
                'Access-Control-Allow-Credentials': true,
            },
            "body": {
                "generatedId": uuid()
            }
        }));
    });
    return promise;
}