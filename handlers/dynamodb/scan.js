const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const utils = require('/opt/nodejs/sample-layer/utils');

const TABLE_NAME = process.env.TABLE_NAME;

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        // scan the table for unexpired results
        dynamodb.scan({
            TableName: TABLE_NAME
        }).promise()
        .then((data) => {
            resolve(utils.createResponse({
                "statusCode": 200,
                "headers": corsHeaders,
                "body": data.Items
            }));
        })
        .catch((err) => {
            console.error(err);
            resolve(utils.createResponse({
                "statusCode": 500,
                "headers": corsHeaders,
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
