const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const sqs = new aws.SQS();
const utils = require('/opt/nodejs/sample-layer/utils');
const uuid = require('uuid').v4;

const QUEUE_URL = process.env.QUEUE_URL;
const TABLE_NAME = process.env.TABLE_NAME;

const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

exports.publish = async (event) => {
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

        // create the new message object
        let newId = uuid();
        const params = {
            QueueUrl: QUEUE_URL,
            // MessageBody must be a string
            MessageBody: JSON.stringify({
                "id": newId,
                "payload": payload,
                "expiration": getExpirationTime()
            })
        };

        // push the message object to the queue
        console.log(`publishing object ${newId}`);
        sqs.sendMessage(params).promise()
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

exports.subscribe = async (event) => {
    for (let record of event.Records) {
        const obj = JSON.parse(record.body);
        console.log(`processing object ${obj.id}`);

        try {
            // put must be called synchronously or it
            // will be killed as the function ends
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: obj
            }).promise();
            console.log(`item ${obj.id} stored`);
        } catch (err) {
            console.error(err);
        }
    }
}
