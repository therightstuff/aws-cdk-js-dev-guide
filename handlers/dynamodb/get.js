const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const utils = require('/opt/nodejs/sample-layer/utils');

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        // get the requested object
        console.log(`looking up ${event.pathParameters.objectId}`);
        console.log("querystring parameters:", event.queryStringParameters);
        dynamodb.get({
            TableName: TABLE_NAME,
            Key: {
                "id": event.pathParameters.objectId
            }
        }).promise()
        .then(result => {
            resolve(utils.createResponse({
                "statusCode": 200,
                "body": result.Item
            }));
        })
        .catch((err) => {
            console.error(err);
            resolve(utils.createResponse({
                "statusCode": 500,
                "body": {
                    "success": false,
                    "reason": "an unexpected error occurred",
                    "error": err
                }
            }));
        });
    });
    return promise;
}
