const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const uuid = require('uuid').v4;

const TABLE_NAME = process.env.TABLE_NAME;
const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

function createResponse(status, json) {
    return {
        "isBase64Encoded": false,
        "statusCode": status,
        "headers": {},
        "body": JSON.stringify(json)
    }
}

exports.handler = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return resolve(
                createResponse(400, {
                    "success": false,
                    "reason": "unable to parse request body, expected valid JSON format"
                })
            );
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
            resolve(
                createResponse(200, {
                    "success": true,
                    "id": newId
                })
            );
        })
        .catch(reject);
    });
    return promise;
}