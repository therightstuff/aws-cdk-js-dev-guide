const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const utils = require('/opt/nodejs/sample-layer/utils');
const uuid = require('uuid').v4;

const TABLE_NAME = process.env.TABLE_NAME;
const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return resolve(utils.createResponse({
                "statusCode": 400,
                "headers": corsHeaders,
                "body": {
                    "success": false,
                    "reason": "unable to parse request body, expected valid JSON format"
                }
            }));
        }

        // add a new object to the table
        let newId = uuid();
        dynamodb.put({
            TableName: TABLE_NAME,
            Item: {
                "id": newId,
                "payload": payload,
                "expiration": getExpirationTime()
            }
        }).promise()
        .then(() => {
            resolve(utils.createResponse({
                "statusCode": 200,
                "headers": corsHeaders,
                "body": {
                    "success": true,
                    "id": newId
                }
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