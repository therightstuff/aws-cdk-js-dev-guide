const aws = require('aws-sdk');
const uuid = require('uuid').v4;
const utils = require('/opt/nodejs/sample-layer/utils');

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        resolve(utils.createResponse({
            "statusCode": 200,
            "body": {
                "generatedId": uuid()
            }
        }));
    });
    return promise;
}